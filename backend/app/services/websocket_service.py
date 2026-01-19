"""WebSocket service for real-time data push."""
from typing import Dict, Set, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
import json
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
import logging

logger = logging.getLogger(__name__)


@dataclass
class Connection:
    """Represents an active WebSocket connection."""
    websocket: WebSocket
    user_id: Optional[int] = None
    organization_id: Optional[int] = None
    site_ids: Set[int] = field(default_factory=set)
    subscriptions: Set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=datetime.utcnow)


class WebSocketManager:
    """Manages WebSocket connections and message broadcasting."""
    
    def __init__(self):
        self.connections: Dict[str, Connection] = {}
        self._lock = asyncio.Lock()
    
    async def connect(
        self,
        websocket: WebSocket,
        connection_id: str,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> Connection:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        
        connection = Connection(
            websocket=websocket,
            user_id=user_id,
            organization_id=organization_id,
        )
        
        async with self._lock:
            self.connections[connection_id] = connection
        
        logger.info(f"WebSocket connected: {connection_id} (user={user_id})")
        return connection
    
    async def disconnect(self, connection_id: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if connection_id in self.connections:
                del self.connections[connection_id]
                logger.info(f"WebSocket disconnected: {connection_id}")
    
    async def subscribe(self, connection_id: str, channel: str):
        """Subscribe a connection to a channel."""
        async with self._lock:
            if connection_id in self.connections:
                self.connections[connection_id].subscriptions.add(channel)
    
    async def unsubscribe(self, connection_id: str, channel: str):
        """Unsubscribe a connection from a channel."""
        async with self._lock:
            if connection_id in self.connections:
                self.connections[connection_id].subscriptions.discard(channel)
    
    async def send_personal(self, connection_id: str, message: dict):
        """Send a message to a specific connection."""
        if connection_id in self.connections:
            try:
                await self.connections[connection_id].websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to {connection_id}: {e}")
                await self.disconnect(connection_id)
    
    async def broadcast(self, message: dict, channel: Optional[str] = None):
        """Broadcast a message to all connections or a specific channel."""
        disconnected = []
        
        for conn_id, connection in self.connections.items():
            if channel and channel not in connection.subscriptions:
                continue
            
            try:
                await connection.websocket.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast failed for {conn_id}: {e}")
                disconnected.append(conn_id)
        
        for conn_id in disconnected:
            await self.disconnect(conn_id)
    
    async def broadcast_to_site(self, site_id: int, message: dict):
        """Broadcast a message to all connections watching a specific site."""
        disconnected = []
        
        for conn_id, connection in self.connections.items():
            if site_id not in connection.site_ids:
                continue
            
            try:
                await connection.websocket.send_json(message)
            except Exception:
                disconnected.append(conn_id)
        
        for conn_id in disconnected:
            await self.disconnect(conn_id)
    
    async def broadcast_to_organization(self, org_id: int, message: dict):
        """Broadcast a message to all connections in an organization."""
        disconnected = []
        
        for conn_id, connection in self.connections.items():
            if connection.organization_id != org_id:
                continue
            
            try:
                await connection.websocket.send_json(message)
            except Exception:
                disconnected.append(conn_id)
        
        for conn_id in disconnected:
            await self.disconnect(conn_id)
    
    def get_connection_count(self) -> int:
        """Get the number of active connections."""
        return len(self.connections)
    
    def get_stats(self) -> dict:
        """Get WebSocket connection statistics."""
        return {
            "total_connections": len(self.connections),
            "connections_by_org": self._count_by_org(),
            "subscriptions": self._count_subscriptions(),
        }
    
    def _count_by_org(self) -> Dict[int, int]:
        counts: Dict[int, int] = {}
        for conn in self.connections.values():
            if conn.organization_id:
                counts[conn.organization_id] = counts.get(conn.organization_id, 0) + 1
        return counts
    
    def _count_subscriptions(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for conn in self.connections.values():
            for sub in conn.subscriptions:
                counts[sub] = counts.get(sub, 0) + 1
        return counts


ws_manager = WebSocketManager()


class RealtimeEvents:
    """Event types for real-time updates."""
    METER_READING = "meter_reading"
    DEVICE_STATUS = "device_status"
    ALERT = "alert"
    NOTIFICATION = "notification"
    ENERGY_UPDATE = "energy_update"
    BILLING_UPDATE = "billing_update"


async def publish_event(
    event_type: str,
    data: dict,
    site_id: Optional[int] = None,
    org_id: Optional[int] = None,
    channel: Optional[str] = None,
):
    """Publish an event to WebSocket clients."""
    message = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    if site_id:
        await ws_manager.broadcast_to_site(site_id, message)
    elif org_id:
        await ws_manager.broadcast_to_organization(org_id, message)
    elif channel:
        await ws_manager.broadcast(message, channel)
    else:
        await ws_manager.broadcast(message)
