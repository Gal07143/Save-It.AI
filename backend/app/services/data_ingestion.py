"""
Data Ingestion Service for SAVE-IT.AI
Unified service for processing incoming device telemetry from all sources.
Implements datapoint mapping, storage, and alarm evaluation via AlarmEngine.
"""
import json
import logging
from typing import Dict, Any, Optional, List, TYPE_CHECKING
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.devices import (
    Device, DeviceModel, Datapoint, DeviceDatapoint, DeviceTelemetry,
    DeviceEvent, AlarmRule, AlarmSeverity, AlarmCondition
)
from app.services.device_onboarding import EdgeKeyResolver

if TYPE_CHECKING:
    from app.services.alarm_engine import AlarmEngine

logger = logging.getLogger(__name__)


class DataIngestionService:
    """
    Unified data ingestion pipeline for all telemetry sources.
    Handles MQTT, webhook, and Modbus data.
    Delegates alarm evaluation to AlarmEngine for full alarm lifecycle support.
    """

    def __init__(self, db: Session, alarm_engine: Optional["AlarmEngine"] = None):
        self.db = db
        self.resolver = EdgeKeyResolver(db)
        self._alarm_engine = alarm_engine
    
    def ingest_telemetry(
        self,
        device_id: Optional[int] = None,
        gateway_id: Optional[int] = None,
        edge_key: Optional[str] = None,
        datapoints: Dict[str, Any] = None,
        timestamp: Optional[datetime] = None,
        source: str = "unknown",
    ) -> Dict[str, Any]:
        """
        Ingest telemetry data from a device.
        Resolves device, maps datapoints, stores values, and evaluates alarms.
        
        Args:
            device_id: Direct device ID (optional)
            gateway_id: Gateway ID for peripheral devices
            edge_key: Edge key for device resolution
            datapoints: Dict of datapoint_name -> value
            timestamp: Data timestamp (defaults to now)
            source: Source identifier (mqtt, webhook, modbus)
        
        Returns:
            Dict with ingestion status and any triggered alarms
        """
        if not datapoints:
            return {"status": "error", "message": "No datapoints provided"}
        
        timestamp = timestamp or datetime.utcnow()
        
        device = self.resolver.resolve(
            device_id=device_id,
            gateway_id=gateway_id,
            edge_key=edge_key,
        )
        
        if not device:
            logger.warning(f"Device not found: device_id={device_id}, gateway={gateway_id}, edge_key={edge_key}")
            return {"status": "error", "message": "Device not found"}
        
        device.last_seen_at = timestamp
        device.last_telemetry_at = timestamp
        device.is_online = 1
        
        result = {
            "status": "success",
            "device_id": device.id,
            "timestamp": timestamp.isoformat(),
            "datapoints_received": len(datapoints),
            "datapoints_stored": 0,
            "alarms_triggered": [],
        }
        
        model_datapoints = {}
        if device.model_id:
            dps = self.db.query(Datapoint).filter(
                Datapoint.model_id == device.model_id
            ).all()
            model_datapoints = {dp.name: dp for dp in dps}
        
        for name, raw_value in datapoints.items():
            try:
                dp_def = model_datapoints.get(name)
                
                if dp_def:
                    value = self._normalize_value(raw_value, dp_def)
                else:
                    value = self._parse_value(raw_value)
                
                telemetry = DeviceTelemetry(
                    device_id=device.id,
                    datapoint_id=dp_def.id if dp_def else None,
                    timestamp=timestamp,
                    value=value if isinstance(value, (int, float)) else None,
                    string_value=str(value) if not isinstance(value, (int, float)) else None,
                    raw_value=float(raw_value) if self._is_numeric(raw_value) else None,
                    edge_key=edge_key,
                    quality="good",
                )
                self.db.add(telemetry)
                result["datapoints_stored"] += 1
                
                if dp_def:
                    device_dp = self.db.query(DeviceDatapoint).filter(
                        DeviceDatapoint.device_id == device.id,
                        DeviceDatapoint.datapoint_id == dp_def.id
                    ).first()
                    
                    if device_dp:
                        device_dp.previous_value = device_dp.current_value
                        device_dp.current_value = str(value)
                        device_dp.last_updated_at = timestamp
                        device_dp.quality = "good"
                
                if dp_def and isinstance(value, (int, float)) and self._alarm_engine:
                    events = self._alarm_engine.evaluate(device.id, dp_def, value, timestamp)
                    for event in events:
                        result["alarms_triggered"].append({
                            "alarm_id": event.alarm_id,
                            "rule_id": event.rule_id,
                            "rule_name": event.rule_name,
                            "severity": event.severity,
                            "event_type": event.event_type,
                            "value": event.value,
                        })
                    
            except Exception as e:
                logger.error(f"Error processing datapoint {name}: {e}")
        
        logger.info(f"Ingested {result['datapoints_stored']} datapoints for device {device.id} from {source}")
        
        return result
    
    def _normalize_value(self, raw_value: Any, datapoint: Datapoint) -> Any:
        """Apply scale factor and offset to normalize value."""
        if not self._is_numeric(raw_value):
            return raw_value
        
        try:
            value = float(raw_value)
            value = value * datapoint.scale_factor + datapoint.offset
            
            if datapoint.precision is not None:
                value = round(value, datapoint.precision)
            
            return value
        except (ValueError, TypeError):
            return raw_value
    
    def _parse_value(self, raw_value: Any) -> Any:
        """Parse value to appropriate type."""
        if isinstance(raw_value, (int, float, bool)):
            return raw_value
        
        if isinstance(raw_value, str):
            if raw_value.lower() in ("true", "false"):
                return raw_value.lower() == "true"
            try:
                if "." in raw_value:
                    return float(raw_value)
                return int(raw_value)
            except ValueError:
                return raw_value
        
        return str(raw_value)
    
    def _is_numeric(self, value: Any) -> bool:
        """Check if value is numeric or can be converted."""
        if isinstance(value, (int, float)):
            return True
        if isinstance(value, str):
            try:
                float(value)
                return True
            except ValueError:
                return False
        return False
    
    def set_alarm_engine(self, alarm_engine: "AlarmEngine"):
        """Set or update the AlarmEngine reference."""
        self._alarm_engine = alarm_engine
    
    def ingest_event(
        self,
        device_id: int,
        event_type: str,
        severity: str,
        title: str,
        message: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> DeviceEvent:
        """
        Ingest an event directly from a device.
        Used for device/{device_id}/events topic.
        """
        try:
            severity_enum = AlarmSeverity(severity)
        except ValueError:
            severity_enum = AlarmSeverity.INFO
        
        event = DeviceEvent(
            device_id=device_id,
            event_type=event_type,
            severity=severity_enum,
            title=title,
            message=message,
            data=json.dumps(data) if data else None,
            triggered_at=datetime.utcnow(),
            is_active=1,
        )
        self.db.add(event)
        
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if device:
            device.last_seen_at = datetime.utcnow()
            device.is_online = 1
        
        logger.info(f"Ingested event from device {device_id}: {title}")
        
        return event
    
    def get_device_telemetry(
        self,
        device_id: int,
        datapoint_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
    ) -> List[DeviceTelemetry]:
        """Query telemetry data for a device."""
        query = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == device_id
        )
        
        if datapoint_name:
            datapoint = self.db.query(Datapoint).filter(
                Datapoint.name == datapoint_name
            ).first()
            if datapoint:
                query = query.filter(DeviceTelemetry.datapoint_id == datapoint.id)
        
        if start_time:
            query = query.filter(DeviceTelemetry.timestamp >= start_time)
        if end_time:
            query = query.filter(DeviceTelemetry.timestamp <= end_time)
        
        return query.order_by(DeviceTelemetry.timestamp.desc()).limit(limit).all()
    
    def get_device_events(
        self,
        device_id: int,
        event_type: Optional[str] = None,
        is_active: Optional[bool] = None,
        limit: int = 100,
    ) -> List[DeviceEvent]:
        """Query events for a device."""
        query = self.db.query(DeviceEvent).filter(
            DeviceEvent.device_id == device_id
        )
        
        if event_type:
            query = query.filter(DeviceEvent.event_type == event_type)
        if is_active is not None:
            query = query.filter(DeviceEvent.is_active == (1 if is_active else 0))
        
        return query.order_by(DeviceEvent.triggered_at.desc()).limit(limit).all()


def get_ingestion_service(db: Session, alarm_engine: Optional["AlarmEngine"] = None) -> DataIngestionService:
    """Get data ingestion service instance."""
    return DataIngestionService(db, alarm_engine=alarm_engine)
