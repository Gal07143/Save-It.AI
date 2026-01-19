"""
MQTT Subscriber Service for SAVE-IT.AI
Subscribes to gateway topics and ingests data into the system.
"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class MQTTMessage:
    """Represents an MQTT message."""
    topic: str
    payload: bytes
    gateway_id: Optional[int]
    device_id: Optional[str]
    message_type: str
    timestamp: datetime
    
    @classmethod
    def from_raw(cls, topic: str, payload: bytes) -> "MQTTMessage":
        """Parse raw MQTT message."""
        parts = topic.split('/')
        gateway_id = None
        device_id = None
        message_type = "unknown"
        
        if len(parts) >= 2 and parts[0] == "saveit":
            try:
                gateway_id = int(parts[1])
            except ValueError:
                pass
        
        if len(parts) >= 3:
            device_id = parts[2]
        
        if len(parts) >= 4:
            message_type = parts[3]
        elif len(parts) >= 3:
            message_type = parts[2]
        
        return cls(
            topic=topic,
            payload=payload,
            gateway_id=gateway_id,
            device_id=device_id,
            message_type=message_type,
            timestamp=datetime.utcnow(),
        )
    
    def get_payload_json(self) -> Optional[Dict[str, Any]]:
        """Parse payload as JSON."""
        try:
            return json.loads(self.payload.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None


class MQTTSubscriber:
    """
    MQTT Subscriber that connects to the broker and processes incoming messages.
    """
    
    def __init__(self, broker_host: str = "localhost", broker_port: int = 1883):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self._client = None
        self._running = False
        self._subscriptions: List[str] = []
        self._handlers: Dict[str, List[Callable]] = {
            "data": [],
            "status": [],
            "heartbeat": [],
            "alarm": [],
            "config": [],
        }
        self._stats = {
            "messages_processed": 0,
            "messages_failed": 0,
            "last_message_at": None,
        }
    
    def add_handler(self, message_type: str, handler: Callable):
        """Add a handler for a specific message type."""
        if message_type not in self._handlers:
            self._handlers[message_type] = []
        self._handlers[message_type].append(handler)
    
    async def process_message(self, message: MQTTMessage):
        """Process an incoming MQTT message."""
        try:
            handlers = self._handlers.get(message.message_type, [])
            
            if not handlers:
                handlers = self._handlers.get("data", [])
            
            for handler in handlers:
                try:
                    await handler(message)
                except Exception as e:
                    logger.error(f"Handler error for {message.topic}: {e}")
            
            self._stats["messages_processed"] += 1
            self._stats["last_message_at"] = datetime.utcnow().isoformat()
            
        except Exception as e:
            self._stats["messages_failed"] += 1
            logger.error(f"Failed to process message from {message.topic}: {e}")
    
    async def subscribe(self, topic_pattern: str):
        """Subscribe to a topic pattern."""
        self._subscriptions.append(topic_pattern)
        logger.info(f"Subscribed to: {topic_pattern}")
    
    async def start(self, username: Optional[str] = None, password: Optional[str] = None):
        """Start the subscriber with reconnect and exponential backoff."""
        self._running = True
        retry_count = 0
        max_retry_delay = 300
        
        while self._running:
            try:
                import aiomqtt
                
                retry_delay = min(2 ** retry_count, max_retry_delay)
                if retry_count > 0:
                    logger.info(f"MQTT Subscriber reconnecting in {retry_delay}s (attempt {retry_count + 1})")
                    await asyncio.sleep(retry_delay)
                
                logger.info(f"MQTT Subscriber connecting to {self.broker_host}:{self.broker_port}")
                
                async with aiomqtt.Client(
                    hostname=self.broker_host,
                    port=self.broker_port,
                    username=username,
                    password=password,
                ) as client:
                    self._client = client
                    retry_count = 0
                    
                    for pattern in self._subscriptions:
                        await client.subscribe(pattern)
                    
                    logger.info("MQTT Subscriber connected and subscribed")
                    
                    async for msg in client.messages:
                        if not self._running:
                            break
                        message = MQTTMessage.from_raw(str(msg.topic), msg.payload)
                        await self.process_message(message)
                        
            except ImportError:
                logger.warning("aiomqtt not available, subscriber disabled")
                break
            except Exception as e:
                logger.error(f"MQTT Subscriber error: {e}")
                retry_count += 1
                if not self._running:
                    break
        
        self._running = False
    
    async def stop(self):
        """Stop the subscriber."""
        self._running = False
        logger.info("MQTT Subscriber stopped")
    
    def get_status(self) -> Dict[str, Any]:
        """Get subscriber status."""
        return {
            "running": self._running,
            "broker": f"{self.broker_host}:{self.broker_port}",
            "subscriptions": self._subscriptions,
            "stats": self._stats.copy(),
        }


class DataIngestionHandler:
    """Handler for ingesting meter/device data from MQTT messages."""
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self._buffer: List[Dict[str, Any]] = []
        self._buffer_size = 100
        self._last_flush = datetime.utcnow()
    
    async def handle_data_message(self, message: MQTTMessage):
        """Handle incoming data message."""
        payload = message.get_payload_json()
        if not payload:
            logger.warning(f"Invalid JSON payload from {message.topic}")
            return
        
        reading = {
            "gateway_id": message.gateway_id,
            "device_id": message.device_id,
            "timestamp": message.timestamp.isoformat(),
            "data": payload,
        }
        
        self._buffer.append(reading)
        
        if len(self._buffer) >= self._buffer_size:
            await self.flush_buffer()
    
    async def handle_heartbeat(self, message: MQTTMessage):
        """Handle gateway heartbeat."""
        logger.debug(f"Heartbeat from gateway {message.gateway_id}")
    
    async def handle_status(self, message: MQTTMessage):
        """Handle device status update."""
        payload = message.get_payload_json()
        logger.info(f"Status update from {message.device_id}: {payload}")
    
    async def flush_buffer(self):
        """Flush buffered readings to database."""
        if not self._buffer:
            return
        
        readings = self._buffer.copy()
        self._buffer.clear()
        self._last_flush = datetime.utcnow()
        
        logger.info(f"Flushing {len(readings)} readings to database")


mqtt_subscriber = MQTTSubscriber()


async def get_mqtt_subscriber() -> MQTTSubscriber:
    """Get the MQTT subscriber instance."""
    return mqtt_subscriber
