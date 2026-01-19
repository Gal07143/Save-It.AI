"""Event bus for internal pub/sub communication."""
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio
import logging

logger = logging.getLogger(__name__)


class EventPriority(int, Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class Event:
    """Represents an event in the system."""
    type: str
    data: Dict[str, Any]
    source: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    priority: EventPriority = EventPriority.NORMAL
    correlation_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Subscriber:
    """Represents an event subscriber."""
    id: str
    event_types: List[str]
    callback: Callable
    filter_func: Optional[Callable[[Event], bool]] = None
    priority: EventPriority = EventPriority.NORMAL


class EventBus:
    """Internal event bus for decoupled component communication."""
    
    def __init__(self):
        self.subscribers: Dict[str, List[Subscriber]] = {}
        self._lock = asyncio.Lock()
        self._event_history: List[Event] = []
        self._max_history = 1000
    
    async def subscribe(
        self,
        subscriber_id: str,
        event_types: List[str],
        callback: Callable,
        filter_func: Optional[Callable[[Event], bool]] = None,
        priority: EventPriority = EventPriority.NORMAL,
    ):
        """Subscribe to event types."""
        subscriber = Subscriber(
            id=subscriber_id,
            event_types=event_types,
            callback=callback,
            filter_func=filter_func,
            priority=priority,
        )
        
        async with self._lock:
            for event_type in event_types:
                if event_type not in self.subscribers:
                    self.subscribers[event_type] = []
                self.subscribers[event_type].append(subscriber)
                self.subscribers[event_type].sort(
                    key=lambda s: s.priority.value, reverse=True
                )
        
        logger.debug(f"Subscriber {subscriber_id} registered for {event_types}")
    
    async def unsubscribe(self, subscriber_id: str):
        """Unsubscribe from all event types."""
        async with self._lock:
            for event_type in self.subscribers:
                self.subscribers[event_type] = [
                    s for s in self.subscribers[event_type] if s.id != subscriber_id
                ]
        
        logger.debug(f"Subscriber {subscriber_id} unregistered")
    
    async def publish(
        self,
        event_type: str,
        data: Dict[str, Any],
        source: str,
        priority: EventPriority = EventPriority.NORMAL,
        correlation_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> Event:
        """Publish an event to all subscribers."""
        event = Event(
            type=event_type,
            data=data,
            source=source,
            priority=priority,
            correlation_id=correlation_id,
            metadata=metadata or {},
        )
        
        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history = self._event_history[-self._max_history:]
        
        subscribers = self.subscribers.get(event_type, [])
        subscribers.extend(self.subscribers.get("*", []))
        
        for subscriber in subscribers:
            if subscriber.filter_func and not subscriber.filter_func(event):
                continue
            
            try:
                if asyncio.iscoroutinefunction(subscriber.callback):
                    asyncio.create_task(subscriber.callback(event))
                else:
                    subscriber.callback(event)
            except Exception as e:
                logger.error(f"Event handler error ({subscriber.id}): {e}")
        
        logger.debug(f"Published event: {event_type} to {len(subscribers)} subscribers")
        return event
    
    def get_recent_events(
        self,
        event_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[Event]:
        """Get recent events from history."""
        events = self._event_history
        if event_type:
            events = [e for e in events if e.type == event_type]
        return events[-limit:]
    
    def get_stats(self) -> dict:
        """Get event bus statistics."""
        return {
            "subscriber_count": sum(len(subs) for subs in self.subscribers.values()),
            "event_types": list(self.subscribers.keys()),
            "history_size": len(self._event_history),
            "subscribers_by_type": {
                k: len(v) for k, v in self.subscribers.items()
            },
        }


event_bus = EventBus()


class Events:
    """Standard event types."""
    METER_READING_RECEIVED = "meter_reading.received"
    METER_READING_VALIDATED = "meter_reading.validated"
    DEVICE_CONNECTED = "device.connected"
    DEVICE_DISCONNECTED = "device.disconnected"
    DEVICE_ERROR = "device.error"
    ALERT_TRIGGERED = "alert.triggered"
    ALERT_RESOLVED = "alert.resolved"
    BILL_UPLOADED = "bill.uploaded"
    BILL_VALIDATED = "bill.validated"
    INVOICE_GENERATED = "invoice.generated"
    REPORT_GENERATED = "report.generated"
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"
    SETTING_CHANGED = "setting.changed"


async def handle_meter_reading(event: Event):
    """Handle meter reading events."""
    logger.info(f"Processing meter reading: {event.data}")


async def handle_device_status(event: Event):
    """Handle device status events."""
    logger.info(f"Device status change: {event.data}")


async def handle_alert(event: Event):
    """Handle alert events."""
    logger.info(f"Alert event: {event.data}")


async def register_default_handlers():
    """Register default event handlers."""
    await event_bus.subscribe(
        "meter_processor",
        [Events.METER_READING_RECEIVED],
        handle_meter_reading,
    )
    
    await event_bus.subscribe(
        "device_monitor",
        [Events.DEVICE_CONNECTED, Events.DEVICE_DISCONNECTED, Events.DEVICE_ERROR],
        handle_device_status,
    )
    
    await event_bus.subscribe(
        "alert_handler",
        [Events.ALERT_TRIGGERED, Events.ALERT_RESOLVED],
        handle_alert,
    )
