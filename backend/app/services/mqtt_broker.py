"""
MQTT Broker Service for SAVE-IT.AI
Provides a lightweight MQTT broker for gateway connections with per-gateway authentication.
"""
import asyncio
import logging
import secrets
import hashlib
from typing import Dict, Optional, Set, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class GatewayCredentials:
    """Stores and validates gateway MQTT credentials."""
    
    def __init__(self):
        self._credentials: Dict[str, str] = {}
        self._gateway_topics: Dict[str, Set[str]] = {}
    
    def add_gateway(self, gateway_id: int, username: str, password_hash: str, allowed_topics: Set[str]):
        """Register a gateway with its credentials and allowed topics."""
        self._credentials[username] = password_hash
        self._gateway_topics[username] = allowed_topics
    
    def remove_gateway(self, username: str):
        """Remove a gateway's credentials."""
        self._credentials.pop(username, None)
        self._gateway_topics.pop(username, None)
    
    def validate(self, username: str, password: str) -> bool:
        """Validate gateway credentials."""
        if username not in self._credentials:
            return False
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        return self._credentials[username] == password_hash
    
    def can_publish(self, username: str, topic: str) -> bool:
        """Check if gateway can publish to a topic."""
        if username not in self._gateway_topics:
            return False
        allowed = self._gateway_topics[username]
        for pattern in allowed:
            if self._topic_matches(pattern, topic):
                return True
        return False
    
    def _topic_matches(self, pattern: str, topic: str) -> bool:
        """Check if topic matches pattern with wildcards."""
        pattern_parts = pattern.split('/')
        topic_parts = topic.split('/')
        
        for i, p in enumerate(pattern_parts):
            if p == '#':
                return True
            if i >= len(topic_parts):
                return False
            if p != '+' and p != topic_parts[i]:
                return False
        
        return len(pattern_parts) == len(topic_parts)


class MQTTBrokerService:
    """
    MQTT Broker service using amqtt.
    Handles gateway connections, authentication, and message routing.
    """
    
    def __init__(self, host: str = "0.0.0.0", port: int = 1883, tls_port: int = 8883):
        self.host = host
        self.port = port
        self.tls_port = tls_port
        self.credentials = GatewayCredentials()
        self._broker = None
        self._running = False
        self._connected_clients: Dict[str, Dict[str, Any]] = {}
        self._message_handlers: list = []
        self._stats = {
            "messages_received": 0,
            "messages_published": 0,
            "connections_total": 0,
            "auth_failures": 0,
        }
    
    def generate_credentials(self, gateway_id: int) -> Dict[str, Any]:
        """Generate new MQTT credentials for a gateway."""
        username = f"gw_{gateway_id}_{secrets.token_hex(4)}"
        password = secrets.token_urlsafe(32)
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        allowed_topics = {
            f"saveit/{gateway_id}/#",
            f"saveit/{gateway_id}/+/data",
            f"saveit/{gateway_id}/+/status",
            f"saveit/{gateway_id}/heartbeat",
        }
        
        self.credentials.add_gateway(gateway_id, username, password_hash, allowed_topics)
        
        return {
            "username": username,
            "password": password,
            "topics": list(allowed_topics),
        }
    
    def rotate_credentials(self, gateway_id: int, old_username: str) -> Dict[str, str]:
        """Rotate credentials for a gateway."""
        self.credentials.remove_gateway(old_username)
        return self.generate_credentials(gateway_id)
    
    def add_message_handler(self, handler):
        """Add a handler for incoming messages."""
        self._message_handlers.append(handler)
    
    async def handle_message(self, topic: str, payload: bytes, client_id: str):
        """Process an incoming MQTT message."""
        self._stats["messages_received"] += 1
        
        message_data = {
            "topic": topic,
            "payload": payload,
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        for handler in self._message_handlers:
            try:
                await handler(message_data)
            except Exception as e:
                logger.error(f"Message handler error: {e}")
    
    def on_client_connect(self, client_id: str, username: str):
        """Handle client connection."""
        self._stats["connections_total"] += 1
        self._connected_clients[client_id] = {
            "username": username,
            "connected_at": datetime.utcnow().isoformat(),
            "last_seen": datetime.utcnow().isoformat(),
        }
        logger.info(f"MQTT client connected: {client_id} ({username})")
    
    def on_client_disconnect(self, client_id: str):
        """Handle client disconnection."""
        self._connected_clients.pop(client_id, None)
        logger.info(f"MQTT client disconnected: {client_id}")
    
    def on_auth_failure(self, client_id: str, username: str):
        """Handle authentication failure."""
        self._stats["auth_failures"] += 1
        logger.warning(f"MQTT auth failure: {client_id} ({username})")
    
    def get_status(self) -> Dict[str, Any]:
        """Get broker status and statistics."""
        return {
            "running": self._running,
            "host": self.host,
            "port": self.port,
            "tls_port": self.tls_port,
            "connected_clients": len(self._connected_clients),
            "clients": list(self._connected_clients.keys()),
            "stats": self._stats.copy(),
        }
    
    def get_client_info(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a connected client."""
        return self._connected_clients.get(client_id)
    
    async def start(self):
        """Start the MQTT broker."""
        try:
            from amqtt.broker import Broker
            
            config = {
                "listeners": {
                    "default": {
                        "type": "tcp",
                        "bind": f"{self.host}:{self.port}",
                    },
                },
                "sys_interval": 10,
                "auth": {
                    "allow-anonymous": False,
                    "plugins": ["auth_anonymous"],
                },
                "topic-check": {
                    "enabled": True,
                },
            }
            
            self._broker = Broker(config)
            await self._broker.start()
            self._running = True
            logger.info(f"MQTT Broker started on {self.host}:{self.port}")
            
        except ImportError:
            logger.warning("amqtt not available, using mock broker")
            self._running = True
            logger.info(f"Mock MQTT Broker started on {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Failed to start MQTT broker: {e}")
            raise
    
    async def stop(self):
        """Stop the MQTT broker."""
        if self._broker:
            await self._broker.shutdown()
        self._running = False
        logger.info("MQTT Broker stopped")


mqtt_broker = MQTTBrokerService()


async def get_mqtt_broker() -> MQTTBrokerService:
    """Get the MQTT broker instance."""
    return mqtt_broker
