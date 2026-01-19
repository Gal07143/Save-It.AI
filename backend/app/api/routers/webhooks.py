"""
Webhook API Router for SAVE-IT.AI
Endpoints for receiving data via HTTPS webhooks from gateways.
"""
import json
import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel, Field
from datetime import datetime

from backend.app.services.webhook_handler import webhook_handler, get_webhook_handler, WebhookHandler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


class WebhookPayload(BaseModel):
    device_id: Optional[str] = None
    timestamp: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    readings: Optional[List[Dict[str, Any]]] = None


class WebhookResponse(BaseModel):
    status: str
    message: str
    gateway_id: int
    timestamp: str
    items_processed: int = 0


@router.post("/ingest/{gateway_id}", response_model=WebhookResponse)
async def ingest_data(
    gateway_id: int,
    payload: WebhookPayload,
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    x_timestamp: Optional[str] = Header(None, alias="X-Timestamp"),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
    handler: WebhookHandler = Depends(get_webhook_handler),
):
    """
    Ingest data from a gateway via webhook.
    
    Headers:
    - X-API-Key: Required API key for authentication
    - X-Signature: Optional HMAC signature for payload verification
    - X-Timestamp: Required with signature, Unix timestamp
    - X-Idempotency-Key: Optional key to prevent duplicate processing
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    body = await request.body()
    
    is_valid, error_msg, creds = handler.validate_request(
        api_key=x_api_key,
        payload=body,
        signature=x_signature,
        timestamp=x_timestamp,
        idempotency_key=x_idempotency_key,
    )
    
    if not is_valid:
        status_code = 401 if "auth" in error_msg.lower() or "api key" in error_msg.lower() else 429 if "rate" in error_msg.lower() else 400
        raise HTTPException(status_code=status_code, detail=error_msg)
    
    if creds and creds.gateway_id != gateway_id:
        raise HTTPException(status_code=403, detail="API key does not match gateway ID")
    
    result = await handler.process_webhook(gateway_id, payload.model_dump())
    
    return WebhookResponse(
        status="success",
        message="Data received successfully",
        gateway_id=gateway_id,
        timestamp=datetime.utcnow().isoformat(),
        items_processed=result.get("items_processed", 0),
    )


@router.post("/ingest/{gateway_id}/batch")
async def ingest_batch(
    gateway_id: int,
    readings: List[Dict[str, Any]],
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    handler: WebhookHandler = Depends(get_webhook_handler),
):
    """Ingest multiple readings in a single request."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing API key")
    
    is_valid, error_msg, creds = handler.validate_request(
        api_key=x_api_key,
        payload=json.dumps(readings).encode(),
    )
    
    if not is_valid:
        raise HTTPException(status_code=401, detail=error_msg)
    
    if creds and creds.gateway_id != gateway_id:
        raise HTTPException(status_code=403, detail="API key does not match gateway ID")
    
    processed = 0
    errors = []
    
    for reading in readings:
        try:
            await handler.process_webhook(gateway_id, reading)
            processed += 1
        except Exception as e:
            errors.append({"device_id": reading.get("device_id"), "error": str(e)})
    
    return {
        "status": "success",
        "gateway_id": gateway_id,
        "total_readings": len(readings),
        "processed": processed,
        "errors": errors if errors else None,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/status")
async def get_webhook_status(handler: WebhookHandler = Depends(get_webhook_handler)):
    """Get webhook service status and statistics."""
    return handler.get_status()


@router.post("/gateways/{gateway_id}/credentials")
async def generate_gateway_credentials(
    gateway_id: int,
    handler: WebhookHandler = Depends(get_webhook_handler),
):
    """Generate webhook credentials for a gateway."""
    creds = handler.generate_credentials(gateway_id)
    
    return {
        "gateway_id": gateway_id,
        "webhook_url": f"/api/v1/webhooks/ingest/{gateway_id}",
        "api_key": creds["api_key"],
        "secret_key": creds["secret_key"],
        "headers_required": {
            "X-API-Key": creds["api_key"],
            "X-Timestamp": "<unix_timestamp>",
            "X-Signature": "<hmac_sha256(timestamp.payload, secret_key)>",
            "Content-Type": "application/json",
        },
    }


@router.post("/test")
async def test_webhook(payload: Dict[str, Any]):
    """Test endpoint for webhook integration - no auth required."""
    logger.info(f"Test webhook received: {payload}")
    return {
        "status": "received",
        "payload": payload,
        "timestamp": datetime.utcnow().isoformat(),
    }
