"""Webhook service for outbound event notifications."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio
import hashlib
import hmac
import json
import logging
import httpx

logger = logging.getLogger(__name__)


class WebhookEventType(str, Enum):
    METER_READING = "meter_reading.created"
    DEVICE_STATUS = "device.status_changed"
    ALERT_TRIGGERED = "alert.triggered"
    BILL_UPLOADED = "bill.uploaded"
    INVOICE_GENERATED = "invoice.generated"
    REPORT_READY = "report.ready"
    USER_CREATED = "user.created"
    SITE_CREATED = "site.created"


@dataclass
class WebhookEndpoint:
    """Represents a webhook endpoint configuration."""
    id: str
    url: str
    secret: str
    events: List[WebhookEventType]
    organization_id: int
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WebhookDelivery:
    """Represents a webhook delivery attempt."""
    id: str
    endpoint_id: str
    event_type: WebhookEventType
    payload: Dict[str, Any]
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    success: bool = False
    attempts: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    error: Optional[str] = None


class WebhookService:
    """Service for managing and delivering webhooks."""
    
    def __init__(self):
        self.endpoints: Dict[str, WebhookEndpoint] = {}
        self.deliveries: List[WebhookDelivery] = []
        self._max_deliveries = 1000
        self._max_retries = 3
        self._retry_delays = [60, 300, 900]
    
    def register_endpoint(
        self,
        endpoint_id: str,
        url: str,
        secret: str,
        events: List[WebhookEventType],
        organization_id: int,
        metadata: Optional[Dict] = None,
    ) -> WebhookEndpoint:
        """Register a new webhook endpoint."""
        endpoint = WebhookEndpoint(
            id=endpoint_id,
            url=url,
            secret=secret,
            events=events,
            organization_id=organization_id,
            metadata=metadata or {},
        )
        self.endpoints[endpoint_id] = endpoint
        logger.info(f"Registered webhook endpoint: {endpoint_id}")
        return endpoint
    
    def unregister_endpoint(self, endpoint_id: str):
        """Unregister a webhook endpoint."""
        if endpoint_id in self.endpoints:
            del self.endpoints[endpoint_id]
            logger.info(f"Unregistered webhook endpoint: {endpoint_id}")
    
    def enable_endpoint(self, endpoint_id: str):
        """Enable a webhook endpoint."""
        if endpoint_id in self.endpoints:
            self.endpoints[endpoint_id].enabled = True
    
    def disable_endpoint(self, endpoint_id: str):
        """Disable a webhook endpoint."""
        if endpoint_id in self.endpoints:
            self.endpoints[endpoint_id].enabled = False
    
    async def trigger(
        self,
        event_type: WebhookEventType,
        payload: Dict[str, Any],
        organization_id: Optional[int] = None,
    ):
        """Trigger webhooks for an event."""
        for endpoint in self.endpoints.values():
            if not endpoint.enabled:
                continue
            if event_type not in endpoint.events:
                continue
            if organization_id and endpoint.organization_id != organization_id:
                continue
            
            asyncio.create_task(self._deliver(endpoint, event_type, payload))
    
    async def _deliver(
        self,
        endpoint: WebhookEndpoint,
        event_type: WebhookEventType,
        payload: Dict[str, Any],
    ):
        """Deliver a webhook to an endpoint."""
        import uuid
        
        delivery = WebhookDelivery(
            id=str(uuid.uuid4()),
            endpoint_id=endpoint.id,
            event_type=event_type,
            payload=payload,
        )
        
        self.deliveries.append(delivery)
        if len(self.deliveries) > self._max_deliveries:
            self.deliveries = self.deliveries[-self._max_deliveries:]
        
        full_payload = {
            "event": event_type.value,
            "timestamp": datetime.utcnow().isoformat(),
            "data": payload,
        }
        
        body = json.dumps(full_payload)
        signature = self._sign_payload(body, endpoint.secret)
        
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": event_type.value,
            "X-Webhook-Delivery": delivery.id,
        }
        
        for attempt in range(self._max_retries):
            delivery.attempts = attempt + 1
            
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.post(
                        endpoint.url,
                        content=body,
                        headers=headers,
                    )
                
                delivery.status_code = response.status_code
                delivery.response_body = response.text[:1000]
                
                if 200 <= response.status_code < 300:
                    delivery.success = True
                    delivery.delivered_at = datetime.utcnow()
                    logger.info(f"Webhook delivered: {delivery.id} to {endpoint.url}")
                    return
                
            except Exception as e:
                delivery.error = str(e)
                logger.error(f"Webhook delivery failed: {delivery.id} - {e}")
            
            if attempt < self._max_retries - 1:
                await asyncio.sleep(self._retry_delays[attempt])
        
        logger.error(f"Webhook delivery exhausted retries: {delivery.id}")
    
    def _sign_payload(self, payload: str, secret: str) -> str:
        """Sign the webhook payload."""
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()
    
    def get_deliveries(
        self,
        endpoint_id: Optional[str] = None,
        event_type: Optional[WebhookEventType] = None,
        limit: int = 100,
    ) -> List[dict]:
        """Get webhook delivery history."""
        deliveries = self.deliveries
        
        if endpoint_id:
            deliveries = [d for d in deliveries if d.endpoint_id == endpoint_id]
        if event_type:
            deliveries = [d for d in deliveries if d.event_type == event_type]
        
        return [
            {
                "id": d.id,
                "endpoint_id": d.endpoint_id,
                "event_type": d.event_type.value,
                "success": d.success,
                "status_code": d.status_code,
                "attempts": d.attempts,
                "created_at": d.created_at.isoformat(),
                "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
                "error": d.error,
            }
            for d in deliveries[-limit:]
        ]
    
    def get_stats(self) -> dict:
        """Get webhook service statistics."""
        total = len(self.deliveries)
        successful = sum(1 for d in self.deliveries if d.success)
        
        return {
            "endpoint_count": len(self.endpoints),
            "total_deliveries": total,
            "successful_deliveries": successful,
            "failed_deliveries": total - successful,
            "success_rate": (successful / total * 100) if total > 0 else 0,
        }


webhook_service = WebhookService()
