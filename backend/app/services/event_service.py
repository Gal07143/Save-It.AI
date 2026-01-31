"""
Event Service for SAVE-IT.AI
Handles discrete device events (vs continuous telemetry):
- State changes
- System events
- User actions
- Maintenance events
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from backend.app.models.devices import Device, DeviceEvent, AlarmSeverity

logger = logging.getLogger(__name__)


@dataclass
class EventFilter:
    """Filter criteria for event queries."""
    device_id: Optional[int] = None
    site_id: Optional[int] = None
    event_type: Optional[str] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


@dataclass
class CorrelatedEventGroup:
    """Group of correlated events."""
    primary_event_id: int
    related_event_ids: List[int]
    device_id: int
    time_window_start: datetime
    time_window_end: datetime
    event_count: int
    summary: str


@dataclass
class EventTimeline:
    """Timeline of events for visualization."""
    device_id: int
    start: datetime
    end: datetime
    events: List[Dict[str, Any]]
    event_count: int
    by_type: Dict[str, int]
    by_severity: Dict[str, int]


class EventService:
    """
    Handles discrete device events.
    Logs, queries, correlates, and visualizes device events.
    """

    def __init__(self, db: Session):
        self.db = db
        self._event_handlers: List[callable] = []

    def log_event(
        self,
        device_id: int,
        event_type: str,
        severity: str,
        title: str,
        message: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        alarm_rule_id: Optional[int] = None
    ) -> DeviceEvent:
        """
        Log a new device event.

        Args:
            device_id: Device ID
            event_type: Event type (alarm, status_change, maintenance, system, user_action)
            severity: Severity level (info, warning, error, critical)
            title: Event title
            message: Detailed message
            data: Additional event data
            alarm_rule_id: Related alarm rule if applicable

        Returns:
            Created DeviceEvent
        """
        # Validate severity
        try:
            severity_enum = AlarmSeverity(severity)
        except ValueError:
            severity_enum = AlarmSeverity.INFO

        event = DeviceEvent(
            device_id=device_id,
            alarm_rule_id=alarm_rule_id,
            event_type=event_type,
            severity=severity_enum,
            title=title,
            message=message,
            data=json.dumps(data) if data else None,
            triggered_at=datetime.utcnow(),
            is_active=1
        )
        self.db.add(event)
        self.db.flush()

        # Update device last seen
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if device:
            device.last_seen_at = datetime.utcnow()

        logger.info(f"Event logged for device {device_id}: {title} ({event_type}/{severity})")

        # Notify handlers
        for handler in self._event_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"Event handler error: {e}")

        return event

    def get_events(
        self,
        filters: EventFilter,
        limit: int = 100,
        offset: int = 0
    ) -> List[DeviceEvent]:
        """
        Query events with filters.

        Args:
            filters: EventFilter with query criteria
            limit: Max results
            offset: Skip results

        Returns:
            List of DeviceEvent records
        """
        query = self.db.query(DeviceEvent)

        if filters.device_id:
            query = query.filter(DeviceEvent.device_id == filters.device_id)

        if filters.site_id:
            query = query.join(Device).filter(Device.site_id == filters.site_id)

        if filters.event_type:
            query = query.filter(DeviceEvent.event_type == filters.event_type)

        if filters.severity:
            try:
                severity_enum = AlarmSeverity(filters.severity)
                query = query.filter(DeviceEvent.severity == severity_enum)
            except ValueError:
                pass

        if filters.is_active is not None:
            query = query.filter(DeviceEvent.is_active == (1 if filters.is_active else 0))

        if filters.start_time:
            query = query.filter(DeviceEvent.triggered_at >= filters.start_time)

        if filters.end_time:
            query = query.filter(DeviceEvent.triggered_at <= filters.end_time)

        return query.order_by(
            DeviceEvent.triggered_at.desc()
        ).offset(offset).limit(limit).all()

    def correlate(
        self,
        device_id: int,
        time_window_seconds: int = 60
    ) -> List[CorrelatedEventGroup]:
        """
        Group related events that occurred close together.

        Args:
            device_id: Device ID
            time_window_seconds: Time window for correlation

        Returns:
            List of CorrelatedEventGroup
        """
        # Get recent events
        cutoff = datetime.utcnow() - timedelta(hours=24)
        events = self.db.query(DeviceEvent).filter(
            DeviceEvent.device_id == device_id,
            DeviceEvent.triggered_at >= cutoff
        ).order_by(DeviceEvent.triggered_at).all()

        if not events:
            return []

        groups = []
        current_group = [events[0]]
        group_start = events[0].triggered_at

        for event in events[1:]:
            time_diff = (event.triggered_at - current_group[-1].triggered_at).total_seconds()

            if time_diff <= time_window_seconds:
                # Same group
                current_group.append(event)
            else:
                # New group
                if len(current_group) > 1:
                    groups.append(self._create_correlated_group(
                        current_group, device_id, group_start
                    ))
                current_group = [event]
                group_start = event.triggered_at

        # Handle last group
        if len(current_group) > 1:
            groups.append(self._create_correlated_group(
                current_group, device_id, group_start
            ))

        return groups

    def get_timeline(
        self,
        device_id: int,
        start: datetime,
        end: datetime
    ) -> EventTimeline:
        """
        Get event timeline for visualization.

        Args:
            device_id: Device ID
            start: Start time
            end: End time

        Returns:
            EventTimeline with events and statistics
        """
        events = self.db.query(DeviceEvent).filter(
            DeviceEvent.device_id == device_id,
            DeviceEvent.triggered_at >= start,
            DeviceEvent.triggered_at <= end
        ).order_by(DeviceEvent.triggered_at).all()

        # Count by type and severity
        by_type = {}
        by_severity = {}

        event_list = []
        for event in events:
            # Count by type
            et = event.event_type or "unknown"
            by_type[et] = by_type.get(et, 0) + 1

            # Count by severity
            sev = event.severity.value if event.severity else "unknown"
            by_severity[sev] = by_severity.get(sev, 0) + 1

            # Build event dict
            event_list.append({
                "id": event.id,
                "timestamp": event.triggered_at.isoformat() if event.triggered_at else None,
                "type": event.event_type,
                "severity": sev,
                "title": event.title,
                "message": event.message,
                "is_active": bool(event.is_active),
                "cleared_at": event.cleared_at.isoformat() if event.cleared_at else None
            })

        return EventTimeline(
            device_id=device_id,
            start=start,
            end=end,
            events=event_list,
            event_count=len(events),
            by_type=by_type,
            by_severity=by_severity
        )

    def acknowledge_event(
        self,
        event_id: int,
        user_id: int
    ) -> Optional[DeviceEvent]:
        """
        Acknowledge an event.

        Args:
            event_id: Event ID
            user_id: User performing acknowledgment

        Returns:
            Updated DeviceEvent
        """
        event = self.db.query(DeviceEvent).filter(DeviceEvent.id == event_id).first()
        if not event:
            return None

        event.acknowledged_at = datetime.utcnow()
        event.acknowledged_by = user_id

        return event

    def clear_event(self, event_id: int) -> Optional[DeviceEvent]:
        """
        Clear/resolve an event.

        Args:
            event_id: Event ID

        Returns:
            Updated DeviceEvent
        """
        event = self.db.query(DeviceEvent).filter(DeviceEvent.id == event_id).first()
        if not event:
            return None

        event.is_active = 0
        event.cleared_at = datetime.utcnow()

        return event

    def get_active_events(
        self,
        device_id: Optional[int] = None,
        site_id: Optional[int] = None,
        limit: int = 100
    ) -> List[DeviceEvent]:
        """
        Get currently active events.

        Args:
            device_id: Filter by device
            site_id: Filter by site
            limit: Max results

        Returns:
            List of active events
        """
        query = self.db.query(DeviceEvent).filter(DeviceEvent.is_active == 1)

        if device_id:
            query = query.filter(DeviceEvent.device_id == device_id)

        if site_id:
            query = query.join(Device).filter(Device.site_id == site_id)

        return query.order_by(DeviceEvent.triggered_at.desc()).limit(limit).all()

    def get_event_statistics(
        self,
        device_id: Optional[int] = None,
        site_id: Optional[int] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get event statistics.

        Args:
            device_id: Filter by device
            site_id: Filter by site
            start: Start time
            end: End time

        Returns:
            Dict with event statistics
        """
        query = self.db.query(DeviceEvent)

        if device_id:
            query = query.filter(DeviceEvent.device_id == device_id)
        if site_id:
            query = query.join(Device).filter(Device.site_id == site_id)
        if start:
            query = query.filter(DeviceEvent.triggered_at >= start)
        if end:
            query = query.filter(DeviceEvent.triggered_at <= end)

        events = query.all()

        # Calculate statistics
        total = len(events)
        active = sum(1 for e in events if e.is_active)
        acknowledged = sum(1 for e in events if e.acknowledged_at)
        cleared = sum(1 for e in events if e.cleared_at)

        by_type = {}
        by_severity = {}

        for event in events:
            et = event.event_type or "unknown"
            by_type[et] = by_type.get(et, 0) + 1

            sev = event.severity.value if event.severity else "unknown"
            by_severity[sev] = by_severity.get(sev, 0) + 1

        return {
            "total": total,
            "active": active,
            "acknowledged": acknowledged,
            "cleared": cleared,
            "by_type": by_type,
            "by_severity": by_severity
        }

    def bulk_clear_events(
        self,
        device_id: Optional[int] = None,
        event_type: Optional[str] = None,
        before: Optional[datetime] = None
    ) -> int:
        """
        Bulk clear events.

        Args:
            device_id: Filter by device
            event_type: Filter by type
            before: Clear events before this time

        Returns:
            Count of events cleared
        """
        query = self.db.query(DeviceEvent).filter(DeviceEvent.is_active == 1)

        if device_id:
            query = query.filter(DeviceEvent.device_id == device_id)
        if event_type:
            query = query.filter(DeviceEvent.event_type == event_type)
        if before:
            query = query.filter(DeviceEvent.triggered_at < before)

        count = query.update({
            "is_active": 0,
            "cleared_at": datetime.utcnow()
        }, synchronize_session=False)

        logger.info(f"Bulk cleared {count} events")
        return count

    def add_event_handler(self, handler: callable):
        """Add handler for new events."""
        self._event_handlers.append(handler)

    def _create_correlated_group(
        self,
        events: List[DeviceEvent],
        device_id: int,
        group_start: datetime
    ) -> CorrelatedEventGroup:
        """Create a correlated event group."""
        primary = events[0]
        related_ids = [e.id for e in events[1:]]

        # Build summary
        types = set(e.event_type for e in events)
        summary = f"{len(events)} events ({', '.join(types)}) within {(events[-1].triggered_at - group_start).seconds}s"

        return CorrelatedEventGroup(
            primary_event_id=primary.id,
            related_event_ids=related_ids,
            device_id=device_id,
            time_window_start=group_start,
            time_window_end=events[-1].triggered_at,
            event_count=len(events),
            summary=summary
        )


def get_event_service(db: Session) -> EventService:
    """Get EventService instance."""
    return EventService(db)
