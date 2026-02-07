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
    edge_key: Optional[str]
    message_type: str
    timestamp: datetime
    
    @classmethod
    def from_raw(cls, topic: str, payload: bytes) -> "MQTTMessage":
        """
        Parse raw MQTT message.
        
        Topic patterns supported:
        - saveit/{gateway_id}/telemetry - Gateway-level telemetry
        - saveit/{gateway_id}/{device_id}/telemetry - Device-level telemetry
        - device/{device_id}/telemetry - Direct device connection
        - device/{device_id}/events - Device events
        - device/{device_id}/commands/ack - Command acknowledgments
        
        Edge key routing: When payload contains 'edge_key', it's used to resolve
        which peripheral device the data belongs to (for gateways aggregating
        multiple meters/sensors).
        """
        parts = topic.split('/')
        gateway_id = None
        device_id = None
        edge_key = None
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
        elif len(parts) >= 2 and parts[0] == "device":
            device_id = parts[1]
            if len(parts) >= 3:
                message_type = parts[2]
            if len(parts) >= 4 and parts[2] == "commands":
                message_type = "commands/" + parts[3]
        
        try:
            payload_data = json.loads(payload.decode('utf-8'))
            edge_key = payload_data.get('edge_key') or payload_data.get('edgeKey')
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
        
        return cls(
            topic=topic,
            payload=payload,
            gateway_id=gateway_id,
            device_id=device_id,
            edge_key=edge_key,
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
    
    def __init__(self, broker_host: str = None, broker_port: int = None):
        import os
        self.broker_host = broker_host or os.getenv("MQTT_BROKER_HOST", "localhost")
        self.broker_port = broker_port or int(os.getenv("MQTT_BROKER_PORT", "1883"))
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

    def __init__(self, db_session_factory, alarm_engine=None):
        self.db_session_factory = db_session_factory
        self._alarm_engine = alarm_engine
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
        """Handle gateway heartbeat — mark gateway as online in DB."""
        if not message.gateway_id:
            logger.debug("Heartbeat with no gateway_id, ignoring")
            return

        db = self.db_session_factory()
        try:
            from app.models.integrations import Gateway, GatewayStatus
            gateway = db.query(Gateway).filter(Gateway.id == message.gateway_id).first()
            if gateway:
                gateway.status = GatewayStatus.ONLINE
                gateway.last_seen_at = message.timestamp
                db.commit()
                logger.debug(f"Heartbeat from gateway {message.gateway_id} — marked ONLINE")
            else:
                logger.warning(f"Heartbeat from unknown gateway {message.gateway_id}")
        except Exception as e:
            db.rollback()
            logger.error(f"Error processing heartbeat for gateway {message.gateway_id}: {e}")
        finally:
            db.close()

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

        db = self.db_session_factory()
        try:
            from app.services.data_ingestion import get_ingestion_service
            from app.models.integrations import Gateway, GatewayStatus, CommunicationLog

            ingestion_service = get_ingestion_service(db, alarm_engine=self._alarm_engine)

            success_count = 0
            error_count = 0
            gateway_ids_seen = set()

            for reading in readings:
                try:
                    gateway_id = reading.get("gateway_id")
                    device_id = reading.get("device_id")
                    data = reading.get("data", {})

                    edge_key = data.pop("edge_key", None) or data.pop("edgeKey", None)

                    ingestion_service.ingest_telemetry(
                        device_id=int(device_id) if device_id and device_id.isdigit() else None,
                        gateway_id=gateway_id,
                        edge_key=edge_key,
                        datapoints=data,
                        source="mqtt",
                    )
                    success_count += 1
                    if gateway_id:
                        gateway_ids_seen.add(gateway_id)
                except Exception as e:
                    error_count += 1
                    logger.error(f"Failed to ingest reading: {e}")

            # Update gateway last_seen_at for all gateways that sent data
            for gw_id in gateway_ids_seen:
                gw = db.query(Gateway).filter(Gateway.id == gw_id).first()
                if gw:
                    gw.status = GatewayStatus.ONLINE
                    gw.last_seen_at = datetime.utcnow()

            # Log communication event per gateway
            for gw_id in gateway_ids_seen:
                comm_log = CommunicationLog(
                    gateway_id=gw_id,
                    event_type="mqtt_ingest",
                    status="success" if error_count == 0 else "partial",
                    request_count=success_count + error_count,
                    success_count=success_count,
                    error_count=error_count,
                    message=f"Flushed {success_count} readings via MQTT",
                    timestamp=datetime.utcnow(),
                )
                db.add(comm_log)

            db.commit()
            logger.info(f"Successfully flushed {success_count} readings ({error_count} errors)")

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to flush buffer: {e}")
        finally:
            db.close()


mqtt_subscriber = MQTTSubscriber()


async def get_mqtt_subscriber() -> MQTTSubscriber:
    """Get the MQTT subscriber instance."""
    return mqtt_subscriber
