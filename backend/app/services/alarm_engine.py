"""
Alarm Engine for SAVE-IT.AI
Real-time alarm evaluation with:
- All condition types (gt, lt, eq, neq, gte, lte, between, outside, change, no_data)
- Duration-based alarms (must exceed for X seconds)
- Auto-clear capability
- Acknowledgment workflow
- Notification triggers
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Tuple
from dataclasses import dataclass, field

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from backend.app.models.devices import (
    Device, Datapoint, AlarmRule, AlarmCondition, AlarmSeverity
)
from backend.app.models.telemetry import (
    DeviceAlarm, AlarmStatus, NoDataTracker
)

logger = logging.getLogger(__name__)


@dataclass
class AlarmEvent:
    """Alarm event triggered or cleared."""
    alarm_id: Optional[int]
    device_id: int
    rule_id: int
    rule_name: str
    datapoint_name: str
    severity: str
    event_type: str  # "triggered" or "cleared"
    value: Any
    threshold: Any
    message: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DurationTracker:
    """Tracks duration for time-based alarm conditions."""
    rule_id: int
    device_id: int
    condition_start: datetime
    last_value: Any
    required_seconds: int


@dataclass
class ActiveAlarm:
    """In-memory tracking of active alarms."""
    alarm_id: int
    device_id: int
    rule_id: int
    triggered_at: datetime
    value: Any


class AlarmConditionEvaluator:
    """Evaluates all Zoho IoT alarm condition types."""

    @staticmethod
    def evaluate(
        condition: AlarmCondition,
        value: Any,
        threshold: Optional[float],
        threshold2: Optional[float] = None,
        previous_value: Optional[Any] = None
    ) -> bool:
        """
        Evaluate alarm condition.

        Args:
            condition: The alarm condition type
            value: Current value
            threshold: Primary threshold
            threshold2: Secondary threshold (for between/outside)
            previous_value: Previous value (for change detection)

        Returns:
            True if condition is met (alarm should trigger)
        """
        if value is None:
            return False

        try:
            v = float(value)
        except (ValueError, TypeError):
            # Handle non-numeric comparisons
            if condition == AlarmCondition.EQUAL:
                return value == threshold
            elif condition == AlarmCondition.NOT_EQUAL:
                return value != threshold
            elif condition == AlarmCondition.CHANGE:
                return value != previous_value
            return False

        if threshold is None and condition not in [AlarmCondition.CHANGE, AlarmCondition.NO_DATA]:
            return False

        t = float(threshold) if threshold is not None else 0
        t2 = float(threshold2) if threshold2 is not None else None

        if condition == AlarmCondition.GREATER_THAN:
            return v > t
        elif condition == AlarmCondition.LESS_THAN:
            return v < t
        elif condition == AlarmCondition.EQUAL:
            return v == t
        elif condition == AlarmCondition.NOT_EQUAL:
            return v != t
        elif condition == AlarmCondition.GREATER_EQUAL:
            return v >= t
        elif condition == AlarmCondition.LESS_EQUAL:
            return v <= t
        elif condition == AlarmCondition.BETWEEN:
            if t2 is None:
                return False
            return t <= v <= t2
        elif condition == AlarmCondition.OUTSIDE:
            if t2 is None:
                return False
            return v < t or v > t2
        elif condition == AlarmCondition.CHANGE:
            if previous_value is None:
                return False
            try:
                return v != float(previous_value)
            except (ValueError, TypeError):
                return value != previous_value

        return False


class AlarmEngine:
    """
    Real-time alarm evaluation engine.
    Handles alarm triggering, duration tracking, auto-clear, and notifications.
    """

    def __init__(self, db: Session):
        self.db = db
        self.evaluator = AlarmConditionEvaluator()
        # In-memory caches for efficient alarm processing
        self._active_alarms: Dict[str, ActiveAlarm] = {}  # key: "{device_id}_{rule_id}"
        self._duration_trackers: Dict[str, DurationTracker] = {}  # key: "{device_id}_{rule_id}"
        self._last_values: Dict[str, Any] = {}  # key: "{device_id}_{datapoint_id}"
        self._alarm_handlers: List[Callable[[AlarmEvent], None]] = []

    def evaluate(
        self,
        device_id: int,
        datapoint: Datapoint,
        value: Any,
        timestamp: Optional[datetime] = None
    ) -> List[AlarmEvent]:
        """
        Evaluate all alarm rules for a datapoint value.

        Args:
            device_id: Device ID
            datapoint: Datapoint definition
            value: Current value
            timestamp: Value timestamp

        Returns:
            List of triggered or cleared AlarmEvents
        """
        timestamp = timestamp or datetime.utcnow()
        events = []

        # Get device
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device or not device.model_id:
            return events

        # Get active alarm rules for this datapoint
        rules = self.db.query(AlarmRule).filter(
            AlarmRule.model_id == device.model_id,
            AlarmRule.datapoint_id == datapoint.id,
            AlarmRule.is_active == 1
        ).all()

        # Get previous value for change detection
        value_key = f"{device_id}_{datapoint.id}"
        previous_value = self._last_values.get(value_key)
        self._last_values[value_key] = value

        for rule in rules:
            alarm_key = f"{device_id}_{rule.id}"

            # Check if condition is met
            condition_met = self.evaluator.evaluate(
                condition=rule.condition,
                value=value,
                threshold=rule.threshold_value,
                threshold2=rule.threshold_value_2,
                previous_value=previous_value
            )

            # Handle duration-based alarms
            if rule.duration_seconds and rule.duration_seconds > 0:
                events.extend(self._handle_duration_alarm(
                    alarm_key, device_id, rule, datapoint, value, condition_met, timestamp
                ))
            else:
                # Immediate alarm evaluation
                if condition_met:
                    if alarm_key not in self._active_alarms:
                        event = self._trigger_alarm(device_id, rule, datapoint, value, timestamp)
                        events.append(event)
                else:
                    # Check for auto-clear
                    if alarm_key in self._active_alarms and rule.auto_clear:
                        event = self._auto_clear_alarm(alarm_key, device_id, rule, datapoint, value, timestamp)
                        if event:
                            events.append(event)

        # Notify handlers
        for event in events:
            self._notify_handlers(event)

        return events

    def _handle_duration_alarm(
        self,
        alarm_key: str,
        device_id: int,
        rule: AlarmRule,
        datapoint: Datapoint,
        value: Any,
        condition_met: bool,
        timestamp: datetime
    ) -> List[AlarmEvent]:
        """Handle duration-based alarm evaluation."""
        events = []

        if condition_met:
            # Start or continue tracking duration
            if alarm_key not in self._duration_trackers:
                self._duration_trackers[alarm_key] = DurationTracker(
                    rule_id=rule.id,
                    device_id=device_id,
                    condition_start=timestamp,
                    last_value=value,
                    required_seconds=rule.duration_seconds
                )
            else:
                tracker = self._duration_trackers[alarm_key]
                elapsed = (timestamp - tracker.condition_start).total_seconds()

                if elapsed >= tracker.required_seconds:
                    # Duration threshold met, trigger alarm
                    if alarm_key not in self._active_alarms:
                        event = self._trigger_alarm(
                            device_id, rule, datapoint, value, timestamp,
                            duration_seconds=int(elapsed)
                        )
                        events.append(event)
        else:
            # Condition no longer met, reset tracker
            if alarm_key in self._duration_trackers:
                del self._duration_trackers[alarm_key]

            # Auto-clear if active
            if alarm_key in self._active_alarms and rule.auto_clear:
                event = self._auto_clear_alarm(alarm_key, device_id, rule, datapoint, value, timestamp)
                if event:
                    events.append(event)

        return events

    def _trigger_alarm(
        self,
        device_id: int,
        rule: AlarmRule,
        datapoint: Datapoint,
        value: Any,
        timestamp: datetime,
        duration_seconds: int = 0
    ) -> AlarmEvent:
        """Create and persist a new alarm."""
        message = self._build_alarm_message(rule, datapoint, value)

        # Create database record
        alarm = DeviceAlarm(
            device_id=device_id,
            alarm_rule_id=rule.id,
            datapoint_id=datapoint.id,
            status=AlarmStatus.TRIGGERED,
            severity=rule.severity.value,
            title=f"{rule.name}: {datapoint.display_name or datapoint.name}",
            message=message,
            trigger_value=float(value) if self._is_numeric(value) else None,
            threshold_value=rule.threshold_value,
            condition=rule.condition.value,
            triggered_at=timestamp,
            duration_seconds=duration_seconds,
            data_json=json.dumps({
                "datapoint": datapoint.name,
                "value": value,
                "threshold": rule.threshold_value,
                "threshold2": rule.threshold_value_2,
                "unit": datapoint.unit,
            }),
        )
        self.db.add(alarm)
        self.db.flush()

        # Track in memory
        alarm_key = f"{device_id}_{rule.id}"
        self._active_alarms[alarm_key] = ActiveAlarm(
            alarm_id=alarm.id,
            device_id=device_id,
            rule_id=rule.id,
            triggered_at=timestamp,
            value=value
        )

        logger.info(f"Alarm triggered: {rule.name} for device {device_id}, value={value}")

        return AlarmEvent(
            alarm_id=alarm.id,
            device_id=device_id,
            rule_id=rule.id,
            rule_name=rule.name,
            datapoint_name=datapoint.name,
            severity=rule.severity.value,
            event_type="triggered",
            value=value,
            threshold=rule.threshold_value,
            message=message,
            timestamp=timestamp
        )

    def _auto_clear_alarm(
        self,
        alarm_key: str,
        device_id: int,
        rule: AlarmRule,
        datapoint: Datapoint,
        value: Any,
        timestamp: datetime
    ) -> Optional[AlarmEvent]:
        """Auto-clear an alarm when condition is no longer met."""
        active = self._active_alarms.get(alarm_key)
        if not active:
            return None

        # Update database record
        alarm = self.db.query(DeviceAlarm).filter(DeviceAlarm.id == active.alarm_id).first()
        if alarm and alarm.status == AlarmStatus.TRIGGERED:
            alarm.status = AlarmStatus.AUTO_CLEARED
            alarm.cleared_at = timestamp

            logger.info(f"Alarm auto-cleared: {rule.name} for device {device_id}")

            # Remove from active tracking
            del self._active_alarms[alarm_key]

            return AlarmEvent(
                alarm_id=alarm.id,
                device_id=device_id,
                rule_id=rule.id,
                rule_name=rule.name,
                datapoint_name=datapoint.name,
                severity=rule.severity.value,
                event_type="cleared",
                value=value,
                threshold=rule.threshold_value,
                message=f"Alarm cleared: value returned to normal ({value})",
                timestamp=timestamp
            )

        return None

    def check_no_data_conditions(self) -> List[AlarmEvent]:
        """
        Check for devices that stopped sending data.
        Should be called periodically by scheduler.

        Returns:
            List of triggered no-data AlarmEvents
        """
        events = []
        now = datetime.utcnow()

        # Get all no_data alarm rules
        no_data_rules = self.db.query(AlarmRule).filter(
            AlarmRule.condition == AlarmCondition.NO_DATA,
            AlarmRule.is_active == 1
        ).all()

        for rule in no_data_rules:
            # Get devices with this model
            devices = self.db.query(Device).filter(
                Device.model_id == rule.model_id,
                Device.is_active == 1
            ).all()

            threshold_seconds = int(rule.threshold_value or 300)  # Default 5 minutes

            for device in devices:
                # Check tracker or device last_telemetry_at
                tracker = self.db.query(NoDataTracker).filter(
                    NoDataTracker.device_id == device.id,
                    NoDataTracker.alarm_rule_id == rule.id
                ).first()

                last_data_at = tracker.last_data_at if tracker else device.last_telemetry_at

                if not last_data_at:
                    continue

                elapsed = (now - last_data_at).total_seconds()

                alarm_key = f"{device.id}_{rule.id}"

                if elapsed > threshold_seconds:
                    # No data for too long - trigger alarm
                    if alarm_key not in self._active_alarms:
                        # Create pseudo-datapoint for no_data alarm
                        datapoint = self.db.query(Datapoint).filter(
                            Datapoint.id == rule.datapoint_id
                        ).first() if rule.datapoint_id else None

                        dp_name = datapoint.name if datapoint else "device"

                        alarm = DeviceAlarm(
                            device_id=device.id,
                            alarm_rule_id=rule.id,
                            datapoint_id=rule.datapoint_id,
                            status=AlarmStatus.TRIGGERED,
                            severity=rule.severity.value,
                            title=f"No Data: {device.name}",
                            message=f"No data received for {int(elapsed)} seconds (threshold: {threshold_seconds}s)",
                            threshold_value=float(threshold_seconds),
                            condition="no_data",
                            triggered_at=now,
                        )
                        self.db.add(alarm)
                        self.db.flush()

                        self._active_alarms[alarm_key] = ActiveAlarm(
                            alarm_id=alarm.id,
                            device_id=device.id,
                            rule_id=rule.id,
                            triggered_at=now,
                            value=elapsed
                        )

                        # Update tracker
                        if tracker:
                            tracker.alarm_triggered = 1
                            tracker.alarm_triggered_at = now

                        event = AlarmEvent(
                            alarm_id=alarm.id,
                            device_id=device.id,
                            rule_id=rule.id,
                            rule_name=rule.name,
                            datapoint_name=dp_name,
                            severity=rule.severity.value,
                            event_type="triggered",
                            value=elapsed,
                            threshold=threshold_seconds,
                            message=f"No data received for {int(elapsed)} seconds",
                            timestamp=now
                        )
                        events.append(event)
                        logger.warning(f"No-data alarm triggered for device {device.id}")

                else:
                    # Data received - auto-clear if active
                    if alarm_key in self._active_alarms and rule.auto_clear:
                        active = self._active_alarms[alarm_key]
                        alarm = self.db.query(DeviceAlarm).filter(
                            DeviceAlarm.id == active.alarm_id
                        ).first()

                        if alarm and alarm.status == AlarmStatus.TRIGGERED:
                            alarm.status = AlarmStatus.AUTO_CLEARED
                            alarm.cleared_at = now

                        del self._active_alarms[alarm_key]

                        if tracker:
                            tracker.alarm_triggered = 0
                            tracker.alarm_triggered_at = None

        return events

    def acknowledge(
        self,
        alarm_id: int,
        user_id: int,
        notes: Optional[str] = None
    ) -> Optional[DeviceAlarm]:
        """
        Acknowledge an alarm.

        Args:
            alarm_id: Alarm ID to acknowledge
            user_id: User performing acknowledgment
            notes: Optional acknowledgment notes

        Returns:
            Updated DeviceAlarm or None
        """
        alarm = self.db.query(DeviceAlarm).filter(DeviceAlarm.id == alarm_id).first()
        if not alarm:
            return None

        if alarm.status != AlarmStatus.TRIGGERED:
            logger.warning(f"Cannot acknowledge alarm {alarm_id} with status {alarm.status}")
            return alarm

        alarm.status = AlarmStatus.ACKNOWLEDGED
        alarm.acknowledged_at = datetime.utcnow()
        alarm.acknowledged_by = user_id
        if notes:
            alarm.notes = notes

        self.db.flush()
        logger.info(f"Alarm {alarm_id} acknowledged by user {user_id}")

        return alarm

    def clear(
        self,
        alarm_id: int,
        user_id: Optional[int] = None,
        auto: bool = False
    ) -> Optional[DeviceAlarm]:
        """
        Clear an alarm.

        Args:
            alarm_id: Alarm ID to clear
            user_id: User clearing the alarm (None for auto-clear)
            auto: Whether this is an auto-clear

        Returns:
            Updated DeviceAlarm or None
        """
        alarm = self.db.query(DeviceAlarm).filter(DeviceAlarm.id == alarm_id).first()
        if not alarm:
            return None

        if alarm.status == AlarmStatus.CLEARED or alarm.status == AlarmStatus.AUTO_CLEARED:
            return alarm

        alarm.status = AlarmStatus.AUTO_CLEARED if auto else AlarmStatus.CLEARED
        alarm.cleared_at = datetime.utcnow()
        if user_id:
            alarm.cleared_by = user_id

        # Remove from active tracking
        alarm_key = f"{alarm.device_id}_{alarm.alarm_rule_id}"
        if alarm_key in self._active_alarms:
            del self._active_alarms[alarm_key]

        self.db.flush()
        logger.info(f"Alarm {alarm_id} cleared")

        return alarm

    def get_active(
        self,
        device_id: Optional[int] = None,
        site_id: Optional[int] = None,
        severity: Optional[str] = None,
        limit: int = 100
    ) -> List[DeviceAlarm]:
        """
        Get active alarms with optional filters.

        Args:
            device_id: Filter by device
            site_id: Filter by site
            severity: Filter by severity
            limit: Max results

        Returns:
            List of active DeviceAlarm records
        """
        query = self.db.query(DeviceAlarm).filter(
            DeviceAlarm.status.in_([AlarmStatus.TRIGGERED, AlarmStatus.ACKNOWLEDGED])
        )

        if device_id:
            query = query.filter(DeviceAlarm.device_id == device_id)

        if site_id:
            # Join with Device to filter by site
            query = query.join(Device).filter(Device.site_id == site_id)

        if severity:
            query = query.filter(DeviceAlarm.severity == severity)

        return query.order_by(DeviceAlarm.triggered_at.desc()).limit(limit).all()

    def get_history(
        self,
        device_id: int,
        limit: int = 100,
        include_active: bool = True
    ) -> List[DeviceAlarm]:
        """
        Get alarm history for a device.

        Args:
            device_id: Device ID
            limit: Max results
            include_active: Include currently active alarms

        Returns:
            List of DeviceAlarm records
        """
        query = self.db.query(DeviceAlarm).filter(
            DeviceAlarm.device_id == device_id
        )

        if not include_active:
            query = query.filter(
                DeviceAlarm.status.in_([AlarmStatus.CLEARED, AlarmStatus.AUTO_CLEARED])
            )

        return query.order_by(DeviceAlarm.triggered_at.desc()).limit(limit).all()

    def get_statistics(
        self,
        device_id: Optional[int] = None,
        site_id: Optional[int] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get alarm statistics.

        Args:
            device_id: Filter by device
            site_id: Filter by site
            start: Start time
            end: End time

        Returns:
            Dict with alarm statistics
        """
        query = self.db.query(DeviceAlarm)

        if device_id:
            query = query.filter(DeviceAlarm.device_id == device_id)
        if site_id:
            query = query.join(Device).filter(Device.site_id == site_id)
        if start:
            query = query.filter(DeviceAlarm.triggered_at >= start)
        if end:
            query = query.filter(DeviceAlarm.triggered_at <= end)

        alarms = query.all()

        # Calculate statistics
        total = len(alarms)
        active = sum(1 for a in alarms if a.status in [AlarmStatus.TRIGGERED, AlarmStatus.ACKNOWLEDGED])
        acknowledged = sum(1 for a in alarms if a.status == AlarmStatus.ACKNOWLEDGED)
        cleared = sum(1 for a in alarms if a.status in [AlarmStatus.CLEARED, AlarmStatus.AUTO_CLEARED])
        auto_cleared = sum(1 for a in alarms if a.status == AlarmStatus.AUTO_CLEARED)

        by_severity = {}
        for a in alarms:
            sev = a.severity or "unknown"
            by_severity[sev] = by_severity.get(sev, 0) + 1

        return {
            "total": total,
            "active": active,
            "acknowledged": acknowledged,
            "cleared": cleared,
            "auto_cleared": auto_cleared,
            "by_severity": by_severity,
        }

    def bulk_acknowledge(
        self,
        alarm_ids: List[int],
        user_id: int,
        notes: Optional[str] = None
    ) -> int:
        """
        Acknowledge multiple alarms at once.

        Args:
            alarm_ids: List of alarm IDs
            user_id: User performing acknowledgment
            notes: Optional notes

        Returns:
            Count of alarms acknowledged
        """
        count = self.db.query(DeviceAlarm).filter(
            DeviceAlarm.id.in_(alarm_ids),
            DeviceAlarm.status == AlarmStatus.TRIGGERED
        ).update({
            "status": AlarmStatus.ACKNOWLEDGED,
            "acknowledged_at": datetime.utcnow(),
            "acknowledged_by": user_id,
            "notes": notes
        }, synchronize_session=False)

        self.db.flush()
        logger.info(f"Bulk acknowledged {count} alarms by user {user_id}")

        return count

    def add_handler(self, handler: Callable[[AlarmEvent], None]):
        """Add a handler to be called when alarms trigger/clear."""
        self._alarm_handlers.append(handler)

    def _notify_handlers(self, event: AlarmEvent):
        """Notify all registered handlers of an alarm event."""
        for handler in self._alarm_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"Alarm handler error: {e}")

    def _build_alarm_message(
        self,
        rule: AlarmRule,
        datapoint: Datapoint,
        value: Any
    ) -> str:
        """Build human-readable alarm message."""
        condition_names = {
            AlarmCondition.GREATER_THAN: "exceeded",
            AlarmCondition.LESS_THAN: "below",
            AlarmCondition.EQUAL: "equals",
            AlarmCondition.NOT_EQUAL: "changed from",
            AlarmCondition.GREATER_EQUAL: "at or above",
            AlarmCondition.LESS_EQUAL: "at or below",
            AlarmCondition.BETWEEN: "within range",
            AlarmCondition.OUTSIDE: "outside range",
            AlarmCondition.CHANGE: "changed",
            AlarmCondition.NO_DATA: "no data",
        }

        cond_name = condition_names.get(rule.condition, rule.condition.value)
        unit = datapoint.unit or ""

        if rule.condition in [AlarmCondition.BETWEEN, AlarmCondition.OUTSIDE]:
            return f"{datapoint.display_name or datapoint.name} value {value}{unit} is {cond_name} [{rule.threshold_value} - {rule.threshold_value_2}]{unit}"
        elif rule.condition == AlarmCondition.CHANGE:
            return f"{datapoint.display_name or datapoint.name} value {cond_name} to {value}{unit}"
        else:
            return f"{datapoint.display_name or datapoint.name} value {value}{unit} {cond_name} threshold {rule.threshold_value}{unit}"

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

    def load_active_alarms(self):
        """
        Load active alarms from database into memory.
        Call on startup to restore state.
        """
        active = self.db.query(DeviceAlarm).filter(
            DeviceAlarm.status.in_([AlarmStatus.TRIGGERED, AlarmStatus.ACKNOWLEDGED])
        ).all()

        for alarm in active:
            alarm_key = f"{alarm.device_id}_{alarm.alarm_rule_id}"
            self._active_alarms[alarm_key] = ActiveAlarm(
                alarm_id=alarm.id,
                device_id=alarm.device_id,
                rule_id=alarm.alarm_rule_id,
                triggered_at=alarm.triggered_at,
                value=alarm.trigger_value
            )

        logger.info(f"Loaded {len(self._active_alarms)} active alarms from database")


def get_alarm_engine(db: Session) -> AlarmEngine:
    """Get AlarmEngine instance."""
    return AlarmEngine(db)
