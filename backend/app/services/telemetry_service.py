"""
Telemetry Service for SAVE-IT.AI
Comprehensive time-series telemetry storage and retrieval.
Optimized for high-volume ingestion and efficient queries.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.models.devices import (
    Device, Datapoint, DeviceDatapoint, DeviceTelemetry
)
from app.models.telemetry import (
    TelemetryAggregation, AggregationPeriod, NoDataTracker
)

logger = logging.getLogger(__name__)


@dataclass
class TelemetryRecord:
    """Record for batch telemetry ingestion."""
    device_id: int
    datapoint_id: Optional[int]
    datapoint_name: Optional[str]
    timestamp: datetime
    value: Optional[float]
    string_value: Optional[str] = None
    raw_value: Optional[float] = None
    quality: str = "good"
    edge_key: Optional[str] = None


@dataclass
class TelemetryValue:
    """Single telemetry value with metadata."""
    timestamp: datetime
    value: Any
    quality: str
    datapoint_name: Optional[str] = None
    datapoint_id: Optional[int] = None
    raw_value: Optional[float] = None


@dataclass
class AggregatedValue:
    """Aggregated telemetry value."""
    period_start: datetime
    period_end: datetime
    min: Optional[float]
    max: Optional[float]
    avg: Optional[float]
    sum: Optional[float]
    count: int
    first: Optional[float]
    last: Optional[float]


class TelemetryService:
    """
    Time-series telemetry storage and retrieval.
    Optimized for high-volume ingestion and efficient queries.
    """

    def __init__(self, db: Session):
        self.db = db

    def store_telemetry(
        self,
        device_id: int,
        datapoints: Dict[str, Any],
        timestamp: Optional[datetime] = None,
        source: str = "api"
    ) -> int:
        """
        Store telemetry data points for a device.

        Args:
            device_id: The device ID
            datapoints: Dict mapping datapoint names to values
            timestamp: Data timestamp (defaults to now)
            source: Data source identifier

        Returns:
            Count of datapoints stored
        """
        timestamp = timestamp or datetime.utcnow()
        stored_count = 0

        # Get device and its datapoint definitions
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            logger.warning(f"Device {device_id} not found for telemetry storage")
            return 0

        # Get model datapoints if device has a model
        model_datapoints = {}
        if device.model_id:
            dps = self.db.query(Datapoint).filter(
                Datapoint.model_id == device.model_id
            ).all()
            model_datapoints = {dp.name: dp for dp in dps}

        for name, raw_value in datapoints.items():
            dp_def = model_datapoints.get(name)
            value, string_value = self._process_value(raw_value, dp_def)

            telemetry = DeviceTelemetry(
                device_id=device_id,
                datapoint_id=dp_def.id if dp_def else None,
                timestamp=timestamp,
                value=value if isinstance(value, (int, float)) else None,
                string_value=string_value,
                raw_value=float(raw_value) if self._is_numeric(raw_value) else None,
                quality="good",
            )
            self.db.add(telemetry)
            stored_count += 1

            # Update current value in DeviceDatapoint
            if dp_def:
                self._update_device_datapoint(device_id, dp_def.id, value, timestamp)

            # Update no-data tracker
            self._update_no_data_tracker(device_id, dp_def.id if dp_def else None, timestamp)

        # Update device last seen
        device.last_seen_at = timestamp
        device.last_telemetry_at = timestamp
        device.is_online = 1

        self.db.flush()
        logger.debug(f"Stored {stored_count} telemetry points for device {device_id}")

        return stored_count

    def store_batch(self, records: List[TelemetryRecord]) -> int:
        """
        Batch insert telemetry records for high-throughput scenarios.

        Args:
            records: List of TelemetryRecord objects

        Returns:
            Count of records stored
        """
        stored_count = 0
        device_updates = {}

        for record in records:
            telemetry = DeviceTelemetry(
                device_id=record.device_id,
                datapoint_id=record.datapoint_id,
                timestamp=record.timestamp,
                value=record.value,
                string_value=record.string_value,
                raw_value=record.raw_value,
                quality=record.quality,
                edge_key=record.edge_key,
            )
            self.db.add(telemetry)
            stored_count += 1

            # Track device updates
            if record.device_id not in device_updates:
                device_updates[record.device_id] = record.timestamp
            else:
                if record.timestamp > device_updates[record.device_id]:
                    device_updates[record.device_id] = record.timestamp

        # Bulk update devices
        for device_id, last_timestamp in device_updates.items():
            self.db.query(Device).filter(Device.id == device_id).update({
                "last_seen_at": last_timestamp,
                "last_telemetry_at": last_timestamp,
                "is_online": 1
            })

        self.db.flush()
        logger.info(f"Batch stored {stored_count} telemetry records for {len(device_updates)} devices")

        return stored_count

    def query(
        self,
        device_id: int,
        datapoint_names: Optional[List[str]] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        aggregation: Optional[str] = None,
        interval: Optional[str] = None,
        limit: int = 10000
    ) -> List[Dict[str, Any]]:
        """
        Query telemetry with optional aggregation.

        Args:
            device_id: Device to query
            datapoint_names: List of datapoint names (None = all)
            start: Start timestamp
            end: End timestamp
            aggregation: Aggregation type (sum, avg, min, max, count)
            interval: Time interval (1h, 1d, etc.)
            limit: Maximum records to return

        Returns:
            List of telemetry data dicts
        """
        query = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == device_id
        )

        if datapoint_names:
            datapoints = self.db.query(Datapoint).filter(
                Datapoint.name.in_(datapoint_names)
            ).all()
            dp_ids = [dp.id for dp in datapoints]
            query = query.filter(DeviceTelemetry.datapoint_id.in_(dp_ids))

        if start:
            query = query.filter(DeviceTelemetry.timestamp >= start)
        if end:
            query = query.filter(DeviceTelemetry.timestamp <= end)

        # If aggregation requested, use pre-computed aggregations if available
        if aggregation and interval:
            return self._query_aggregated(device_id, datapoint_names, start, end, aggregation, interval)

        results = query.order_by(DeviceTelemetry.timestamp.desc()).limit(limit).all()

        return [
            {
                "id": r.id,
                "device_id": r.device_id,
                "datapoint_id": r.datapoint_id,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "value": r.value,
                "string_value": r.string_value,
                "quality": r.quality,
            }
            for r in results
        ]

    def _query_aggregated(
        self,
        device_id: int,
        datapoint_names: Optional[List[str]],
        start: Optional[datetime],
        end: Optional[datetime],
        aggregation: str,
        interval: str
    ) -> List[Dict[str, Any]]:
        """Query pre-computed aggregations."""
        # Map interval to aggregation period
        period_map = {
            "1h": AggregationPeriod.HOURLY,
            "1d": AggregationPeriod.DAILY,
            "1M": AggregationPeriod.MONTHLY,
        }
        period = period_map.get(interval, AggregationPeriod.HOURLY)

        query = self.db.query(TelemetryAggregation).filter(
            TelemetryAggregation.device_id == device_id,
            TelemetryAggregation.period == period
        )

        if datapoint_names:
            datapoints = self.db.query(Datapoint).filter(
                Datapoint.name.in_(datapoint_names)
            ).all()
            dp_ids = [dp.id for dp in datapoints]
            query = query.filter(TelemetryAggregation.datapoint_id.in_(dp_ids))

        if start:
            query = query.filter(TelemetryAggregation.period_start >= start)
        if end:
            query = query.filter(TelemetryAggregation.period_end <= end)

        results = query.order_by(TelemetryAggregation.period_start.desc()).all()

        # Map aggregation type to field
        agg_field_map = {
            "sum": "value_sum",
            "avg": "value_avg",
            "min": "value_min",
            "max": "value_max",
            "count": "value_count",
        }
        agg_field = agg_field_map.get(aggregation, "value_avg")

        return [
            {
                "device_id": r.device_id,
                "datapoint_id": r.datapoint_id,
                "period_start": r.period_start.isoformat(),
                "period_end": r.period_end.isoformat(),
                "value": getattr(r, agg_field),
                "count": r.value_count,
            }
            for r in results
        ]

    def get_latest(self, device_id: int) -> Dict[str, TelemetryValue]:
        """
        Get latest value for all datapoints of a device.

        Args:
            device_id: Device ID

        Returns:
            Dict mapping datapoint names to latest TelemetryValue
        """
        # Use DeviceDatapoint for current values (more efficient than scanning telemetry)
        device_dps = self.db.query(DeviceDatapoint).filter(
            DeviceDatapoint.device_id == device_id
        ).all()

        result = {}
        for ddp in device_dps:
            dp = self.db.query(Datapoint).filter(Datapoint.id == ddp.datapoint_id).first()
            if dp:
                value = self._parse_stored_value(ddp.current_value)
                result[dp.name] = TelemetryValue(
                    timestamp=ddp.last_updated_at or datetime.utcnow(),
                    value=value,
                    quality=ddp.quality or "good",
                    datapoint_name=dp.name,
                    datapoint_id=dp.id,
                )

        return result

    def get_history(
        self,
        device_id: int,
        datapoint: str,
        limit: int = 1000,
        offset: int = 0,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> List[TelemetryValue]:
        """
        Get historical values for a single datapoint.

        Args:
            device_id: Device ID
            datapoint: Datapoint name
            limit: Max records
            offset: Skip records
            start: Start time filter
            end: End time filter

        Returns:
            List of TelemetryValue objects
        """
        dp = self.db.query(Datapoint).filter(Datapoint.name == datapoint).first()

        query = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == device_id
        )

        if dp:
            query = query.filter(DeviceTelemetry.datapoint_id == dp.id)

        if start:
            query = query.filter(DeviceTelemetry.timestamp >= start)
        if end:
            query = query.filter(DeviceTelemetry.timestamp <= end)

        results = query.order_by(
            DeviceTelemetry.timestamp.desc()
        ).offset(offset).limit(limit).all()

        return [
            TelemetryValue(
                timestamp=r.timestamp,
                value=r.value if r.value is not None else r.string_value,
                quality=r.quality or "good",
                datapoint_name=datapoint,
                datapoint_id=dp.id if dp else None,
                raw_value=r.raw_value,
            )
            for r in results
        ]

    def delete_old_data(self, retention_days: int, device_id: Optional[int] = None) -> int:
        """
        Delete data older than retention period.

        Args:
            retention_days: Delete data older than this many days
            device_id: Optional - only delete for specific device

        Returns:
            Count of records deleted
        """
        cutoff = datetime.utcnow() - timedelta(days=retention_days)

        query = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.timestamp < cutoff
        )

        if device_id:
            query = query.filter(DeviceTelemetry.device_id == device_id)

        deleted = query.delete(synchronize_session=False)
        self.db.flush()

        logger.info(f"Deleted {deleted} telemetry records older than {retention_days} days")
        return deleted

    def get_statistics(
        self,
        device_id: int,
        datapoint: str,
        start: datetime,
        end: datetime
    ) -> Dict[str, Any]:
        """
        Get statistical summary for a datapoint over a time range.

        Args:
            device_id: Device ID
            datapoint: Datapoint name
            start: Start time
            end: End time

        Returns:
            Dict with min, max, avg, sum, count, first, last
        """
        dp = self.db.query(Datapoint).filter(Datapoint.name == datapoint).first()
        dp_id = dp.id if dp else None

        result = self.db.query(
            func.min(DeviceTelemetry.value).label("min"),
            func.max(DeviceTelemetry.value).label("max"),
            func.avg(DeviceTelemetry.value).label("avg"),
            func.sum(DeviceTelemetry.value).label("sum"),
            func.count(DeviceTelemetry.id).label("count"),
        ).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.timestamp >= start,
            DeviceTelemetry.timestamp <= end,
            DeviceTelemetry.value.isnot(None),
        )

        if dp_id:
            result = result.filter(DeviceTelemetry.datapoint_id == dp_id)

        stats = result.first()

        # Get first and last values
        first_record = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.timestamp >= start,
            DeviceTelemetry.timestamp <= end,
        )
        if dp_id:
            first_record = first_record.filter(DeviceTelemetry.datapoint_id == dp_id)
        first_record = first_record.order_by(DeviceTelemetry.timestamp.asc()).first()

        last_record = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.timestamp >= start,
            DeviceTelemetry.timestamp <= end,
        )
        if dp_id:
            last_record = last_record.filter(DeviceTelemetry.datapoint_id == dp_id)
        last_record = last_record.order_by(DeviceTelemetry.timestamp.desc()).first()

        return {
            "device_id": device_id,
            "datapoint": datapoint,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "min": stats.min if stats else None,
            "max": stats.max if stats else None,
            "avg": float(stats.avg) if stats and stats.avg else None,
            "sum": float(stats.sum) if stats and stats.sum else None,
            "count": stats.count if stats else 0,
            "first": first_record.value if first_record else None,
            "last": last_record.value if last_record else None,
            "first_timestamp": first_record.timestamp.isoformat() if first_record else None,
            "last_timestamp": last_record.timestamp.isoformat() if last_record else None,
        }

    def _process_value(
        self,
        raw_value: Any,
        datapoint: Optional[Datapoint]
    ) -> Tuple[Any, Optional[str]]:
        """Process and normalize a value."""
        if raw_value is None:
            return None, None

        # Apply scale factor and offset if datapoint defined
        if datapoint and self._is_numeric(raw_value):
            try:
                value = float(raw_value)
                value = value * (datapoint.scale_factor or 1.0) + (datapoint.offset or 0.0)
                if datapoint.precision is not None:
                    value = round(value, datapoint.precision)
                return value, None
            except (ValueError, TypeError):
                pass

        # Handle non-numeric values
        if isinstance(raw_value, bool):
            return 1 if raw_value else 0, None
        elif isinstance(raw_value, (int, float)):
            return raw_value, None
        else:
            return None, str(raw_value)

    def _is_numeric(self, value: Any) -> bool:
        """Check if value is numeric."""
        if isinstance(value, (int, float)):
            return True
        if isinstance(value, str):
            try:
                float(value)
                return True
            except ValueError:
                return False
        return False

    def _parse_stored_value(self, value: Optional[str]) -> Any:
        """Parse a stored string value back to appropriate type."""
        if value is None:
            return None
        try:
            if "." in value:
                return float(value)
            return int(value)
        except ValueError:
            return value

    def _update_device_datapoint(
        self,
        device_id: int,
        datapoint_id: int,
        value: Any,
        timestamp: datetime
    ):
        """Update current value in DeviceDatapoint table."""
        device_dp = self.db.query(DeviceDatapoint).filter(
            DeviceDatapoint.device_id == device_id,
            DeviceDatapoint.datapoint_id == datapoint_id
        ).first()

        if device_dp:
            device_dp.previous_value = device_dp.current_value
            device_dp.current_value = str(value) if value is not None else None
            device_dp.last_updated_at = timestamp
            device_dp.quality = "good"
        else:
            # Create new DeviceDatapoint record
            device_dp = DeviceDatapoint(
                device_id=device_id,
                datapoint_id=datapoint_id,
                current_value=str(value) if value is not None else None,
                last_updated_at=timestamp,
                quality="good",
            )
            self.db.add(device_dp)

    def _update_no_data_tracker(
        self,
        device_id: int,
        datapoint_id: Optional[int],
        timestamp: datetime
    ):
        """Update no-data tracker for alarm detection."""
        tracker = self.db.query(NoDataTracker).filter(
            NoDataTracker.device_id == device_id,
            NoDataTracker.datapoint_id == datapoint_id
        ).first()

        if tracker:
            tracker.last_data_at = timestamp
            # Clear any triggered alarm since we received data
            if tracker.alarm_triggered:
                tracker.alarm_triggered = 0
                tracker.alarm_triggered_at = None
        # Tracker will be created by alarm engine if needed


def get_telemetry_service(db: Session) -> TelemetryService:
    """Get TelemetryService instance."""
    return TelemetryService(db)
