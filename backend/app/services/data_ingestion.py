"""
Data Ingestion Service for SAVE-IT.AI
Unified service for processing incoming device telemetry from all sources.
Implements datapoint mapping, storage, and alarm evaluation.
"""
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from backend.app.models.devices import (
    Device, DeviceModel, Datapoint, DeviceDatapoint, DeviceTelemetry,
    DeviceEvent, AlarmRule, AlarmSeverity, AlarmCondition
)
from backend.app.services.device_onboarding import EdgeKeyResolver

logger = logging.getLogger(__name__)


class DataIngestionService:
    """
    Unified data ingestion pipeline for all telemetry sources.
    Handles MQTT, webhook, and Modbus data.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.resolver = EdgeKeyResolver(db)
        self._alarm_handlers: List[callable] = []
    
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
                
                if dp_def and isinstance(value, (int, float)):
                    alarms = self._evaluate_alarms(device, dp_def, value)
                    result["alarms_triggered"].extend(alarms)
                    
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
    
    def _evaluate_alarms(
        self,
        device: Device,
        datapoint: Datapoint,
        value: float,
    ) -> List[Dict[str, Any]]:
        """Evaluate alarm rules for a datapoint value."""
        triggered = []
        
        rules = self.db.query(AlarmRule).filter(
            AlarmRule.model_id == device.model_id,
            AlarmRule.datapoint_id == datapoint.id,
            AlarmRule.is_active == 1
        ).all()
        
        for rule in rules:
            if self._check_alarm_condition(rule, value):
                event = self._create_alarm_event(device, datapoint, rule, value)
                triggered.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "severity": rule.severity.value,
                    "value": value,
                })
                
                for handler in self._alarm_handlers:
                    try:
                        handler(device, rule, event)
                    except Exception as e:
                        logger.error(f"Alarm handler error: {e}")
        
        return triggered
    
    def _check_alarm_condition(self, rule: AlarmRule, value: float) -> bool:
        """Check if value triggers alarm condition."""
        threshold = rule.threshold_value
        threshold2 = rule.threshold_value_2
        
        if rule.condition == AlarmCondition.GREATER_THAN:
            return value > threshold if threshold is not None else False
        elif rule.condition == AlarmCondition.LESS_THAN:
            return value < threshold if threshold is not None else False
        elif rule.condition == AlarmCondition.EQUAL:
            return value == threshold if threshold is not None else False
        elif rule.condition == AlarmCondition.NOT_EQUAL:
            return value != threshold if threshold is not None else False
        elif rule.condition == AlarmCondition.GREATER_EQUAL:
            return value >= threshold if threshold is not None else False
        elif rule.condition == AlarmCondition.LESS_EQUAL:
            return value <= threshold if threshold is not None else False
        elif rule.condition == AlarmCondition.BETWEEN:
            if threshold is not None and threshold2 is not None:
                return threshold <= value <= threshold2
        elif rule.condition == AlarmCondition.OUTSIDE:
            if threshold is not None and threshold2 is not None:
                return value < threshold or value > threshold2
        
        return False
    
    def _create_alarm_event(
        self,
        device: Device,
        datapoint: Datapoint,
        rule: AlarmRule,
        value: float,
    ) -> DeviceEvent:
        """Create alarm event record."""
        event = DeviceEvent(
            device_id=device.id,
            alarm_rule_id=rule.id,
            event_type="alarm",
            severity=rule.severity,
            title=f"{rule.name}: {datapoint.display_name or datapoint.name}",
            message=f"Value {value} {rule.condition.value} threshold {rule.threshold_value}",
            data=json.dumps({
                "datapoint": datapoint.name,
                "value": value,
                "threshold": rule.threshold_value,
                "unit": datapoint.unit,
            }),
            triggered_at=datetime.utcnow(),
            is_active=1,
        )
        self.db.add(event)
        return event
    
    def add_alarm_handler(self, handler: callable):
        """Add handler for triggered alarms."""
        self._alarm_handlers.append(handler)
    
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


def get_ingestion_service(db: Session) -> DataIngestionService:
    """Get data ingestion service instance."""
    return DataIngestionService(db)
