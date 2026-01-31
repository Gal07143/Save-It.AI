"""
Real-time WebSocket Service for SAVE-IT.AI
WebSocket-based real-time updates:
- Telemetry broadcasts
- Alarm notifications
- Status changes
- Room-based subscriptions
"""
import json
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, List, Set
from dataclasses import dataclass, field

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


@dataclass
class ConnectionInfo:
    """Information about a WebSocket connection."""
    client_id: str
    user_id: int
    websocket: WebSocket
    connected_at: datetime
    subscriptions: Set[str] = field(default_factory=set)
    last_message_at: Optional[datetime] = None


@dataclass
class BroadcastMessage:
    """Message to broadcast to subscribers."""
    topic: str
    event_type: str
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.utcnow)


class RealtimeService:
    """
    WebSocket-based real-time update service.
    Manages connections, subscriptions, and broadcasts.
    """

    def __init__(self):
        # Active connections: client_id -> ConnectionInfo
        self._connections: Dict[str, ConnectionInfo] = {}
        # Topic subscriptions: topic -> set of client_ids
        self._subscriptions: Dict[str, Set[str]] = {}
        # Message queue for async broadcasting
        self._message_queue: asyncio.Queue = asyncio.Queue()
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        user_id: int
    ):
        """
        Handle new WebSocket connection.

        Args:
            websocket: FastAPI WebSocket
            client_id: Unique client identifier
            user_id: Authenticated user ID
        """
        await websocket.accept()

        async with self._lock:
            # Close existing connection with same client_id
            if client_id in self._connections:
                await self._close_connection(client_id, "Replaced by new connection")

            self._connections[client_id] = ConnectionInfo(
                client_id=client_id,
                user_id=user_id,
                websocket=websocket,
                connected_at=datetime.utcnow()
            )

        logger.info(f"WebSocket connected: {client_id} (user {user_id})")

        # Send welcome message
        await self._send_to_client(client_id, {
            "type": "connected",
            "client_id": client_id,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def disconnect(self, client_id: str):
        """
        Handle WebSocket disconnection.

        Args:
            client_id: Client identifier
        """
        await self._close_connection(client_id, "Client disconnected")

    async def _close_connection(self, client_id: str, reason: str):
        """Close and cleanup a connection."""
        async with self._lock:
            if client_id not in self._connections:
                return

            conn = self._connections.pop(client_id)

            # Remove from all subscriptions
            for topic in list(conn.subscriptions):
                if topic in self._subscriptions:
                    self._subscriptions[topic].discard(client_id)
                    if not self._subscriptions[topic]:
                        del self._subscriptions[topic]

            try:
                await conn.websocket.close()
            except Exception:
                pass

        logger.info(f"WebSocket disconnected: {client_id} ({reason})")

    async def subscribe(self, client_id: str, topics: List[str]):
        """
        Subscribe client to topics.

        Topics can be:
        - device:{device_id} - Device telemetry/events
        - site:{site_id} - All devices at site
        - alarm:* - All alarms
        - alarm:{severity} - Alarms of specific severity
        - status:* - All device status changes

        Args:
            client_id: Client identifier
            topics: List of topic patterns
        """
        async with self._lock:
            if client_id not in self._connections:
                return

            conn = self._connections[client_id]

            for topic in topics:
                conn.subscriptions.add(topic)

                if topic not in self._subscriptions:
                    self._subscriptions[topic] = set()
                self._subscriptions[topic].add(client_id)

        logger.debug(f"Client {client_id} subscribed to: {topics}")

        # Acknowledge subscription
        await self._send_to_client(client_id, {
            "type": "subscribed",
            "topics": topics,
            "timestamp": datetime.utcnow().isoformat()
        })

    async def unsubscribe(self, client_id: str, topics: List[str]):
        """
        Unsubscribe client from topics.

        Args:
            client_id: Client identifier
            topics: List of topics to unsubscribe from
        """
        async with self._lock:
            if client_id not in self._connections:
                return

            conn = self._connections[client_id]

            for topic in topics:
                conn.subscriptions.discard(topic)

                if topic in self._subscriptions:
                    self._subscriptions[topic].discard(client_id)
                    if not self._subscriptions[topic]:
                        del self._subscriptions[topic]

        logger.debug(f"Client {client_id} unsubscribed from: {topics}")

    async def broadcast_telemetry(self, device_id: int, data: Dict[str, Any]):
        """
        Broadcast telemetry data to subscribers.

        Args:
            device_id: Device ID
            data: Telemetry data
        """
        message = {
            "type": "telemetry",
            "device_id": device_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Find matching topics
        topics = [f"device:{device_id}"]

        # Get device's site for site-level subscriptions
        # (Would need db access here - simplified for now)

        await self._broadcast(topics, message)

    async def broadcast_alarm(self, alarm: Dict[str, Any]):
        """
        Broadcast alarm event.

        Args:
            alarm: Alarm data (device_id, severity, title, etc.)
        """
        device_id = alarm.get("device_id")
        severity = alarm.get("severity", "unknown")

        message = {
            "type": "alarm",
            "alarm": alarm,
            "timestamp": datetime.utcnow().isoformat()
        }

        topics = [
            f"device:{device_id}",
            "alarm:*",
            f"alarm:{severity}"
        ]

        await self._broadcast(topics, message)

    async def broadcast_status(self, device_id: int, online: bool):
        """
        Broadcast device status change.

        Args:
            device_id: Device ID
            online: Whether device is online
        """
        message = {
            "type": "status_change",
            "device_id": device_id,
            "online": online,
            "timestamp": datetime.utcnow().isoformat()
        }

        topics = [
            f"device:{device_id}",
            "status:*"
        ]

        await self._broadcast(topics, message)

    async def broadcast_event(
        self,
        device_id: int,
        event_type: str,
        event_data: Dict[str, Any]
    ):
        """
        Broadcast generic device event.

        Args:
            device_id: Device ID
            event_type: Event type
            event_data: Event data
        """
        message = {
            "type": "event",
            "device_id": device_id,
            "event_type": event_type,
            "data": event_data,
            "timestamp": datetime.utcnow().isoformat()
        }

        topics = [f"device:{device_id}"]

        await self._broadcast(topics, message)

    async def _broadcast(self, topics: List[str], message: Dict[str, Any]):
        """Broadcast message to all subscribers of given topics."""
        client_ids = set()

        async with self._lock:
            for topic in topics:
                if topic in self._subscriptions:
                    client_ids.update(self._subscriptions[topic])

        # Send to all matching clients
        tasks = [
            self._send_to_client(client_id, message)
            for client_id in client_ids
        ]

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _send_to_client(self, client_id: str, message: Dict[str, Any]):
        """Send message to a specific client."""
        if client_id not in self._connections:
            return

        conn = self._connections[client_id]

        try:
            await conn.websocket.send_json(message)
            conn.last_message_at = datetime.utcnow()
        except Exception as e:
            logger.warning(f"Failed to send to {client_id}: {e}")
            await self._close_connection(client_id, f"Send error: {e}")

    async def handle_message(self, client_id: str, message: Dict[str, Any]):
        """
        Handle incoming message from client.

        Args:
            client_id: Client identifier
            message: Parsed JSON message
        """
        msg_type = message.get("type")

        if msg_type == "subscribe":
            topics = message.get("topics", [])
            await self.subscribe(client_id, topics)

        elif msg_type == "unsubscribe":
            topics = message.get("topics", [])
            await self.unsubscribe(client_id, topics)

        elif msg_type == "ping":
            await self._send_to_client(client_id, {
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            })

        else:
            logger.warning(f"Unknown message type from {client_id}: {msg_type}")

    def get_connections(self) -> List[Dict[str, Any]]:
        """Get information about active connections."""
        return [
            {
                "client_id": conn.client_id,
                "user_id": conn.user_id,
                "connected_at": conn.connected_at.isoformat(),
                "subscriptions": list(conn.subscriptions),
                "last_message_at": conn.last_message_at.isoformat() if conn.last_message_at else None
            }
            for conn in self._connections.values()
        ]

    def get_subscription_stats(self) -> Dict[str, int]:
        """Get subscription statistics."""
        return {
            topic: len(clients)
            for topic, clients in self._subscriptions.items()
        }

    @property
    def connection_count(self) -> int:
        """Get number of active connections."""
        return len(self._connections)


# Global instance for application-wide use
_realtime_service: Optional[RealtimeService] = None


def get_realtime_service() -> RealtimeService:
    """Get global RealtimeService instance."""
    global _realtime_service
    if _realtime_service is None:
        _realtime_service = RealtimeService()
    return _realtime_service


async def websocket_handler(websocket: WebSocket, client_id: str, user_id: int):
    """
    Main WebSocket handler for FastAPI.

    Usage:
        @app.websocket("/ws/{client_id}")
        async def websocket_endpoint(websocket: WebSocket, client_id: str):
            user_id = get_user_from_token(...)
            await websocket_handler(websocket, client_id, user_id)
    """
    service = get_realtime_service()

    await service.connect(websocket, client_id, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            await service.handle_message(client_id, data)

    except WebSocketDisconnect:
        await service.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for {client_id}: {e}")
        await service.disconnect(client_id)
