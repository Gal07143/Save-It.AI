"""
HTTPS Webhook Handler for SAVE-IT.AI
Receives data from external systems via secure HTTP POST requests.
"""
import hashlib
import hmac
import secrets
import time
import json
import logging
from typing import Dict, Any, Optional, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
from collections import defaultdict

from app.core.database import SessionLocal
from app.models.integrations import GatewayCredentials as GatewayCredentialsModel

logger = logging.getLogger(__name__)


@dataclass
class WebhookCredentials:
    """Webhook authentication credentials for a gateway."""
    gateway_id: int
    api_key: str
    secret_key: str
    created_at: datetime
    last_rotated: Optional[datetime] = None
    
    def verify_signature(self, payload: bytes, signature: str, timestamp: str) -> bool:
        """Verify HMAC signature of webhook payload."""
        message = f"{timestamp}.{payload.decode('utf-8')}"
        expected = hmac.new(
            self.secret_key.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


class RateLimiter:
    """Token bucket rate limiter for webhooks."""
    
    def __init__(self, requests_per_minute: int = 60, burst: int = 10):
        self.rate = requests_per_minute / 60.0
        self.burst = burst
        self._tokens: Dict[str, float] = defaultdict(lambda: burst)
        self._last_update: Dict[str, float] = {}
    
    def allow(self, key: str) -> bool:
        """Check if request is allowed."""
        now = time.time()
        
        if key in self._last_update:
            elapsed = now - self._last_update[key]
            self._tokens[key] = min(self.burst, self._tokens[key] + elapsed * self.rate)
        
        self._last_update[key] = now
        
        if self._tokens[key] >= 1:
            self._tokens[key] -= 1
            return True
        return False
    
    def get_retry_after(self, key: str) -> int:
        """Get seconds until next request is allowed."""
        if self._tokens[key] >= 1:
            return 0
        needed = 1 - self._tokens[key]
        return int(needed / self.rate) + 1


class IdempotencyStore:
    """Stores idempotency keys to prevent duplicate processing."""
    
    def __init__(self, ttl_seconds: int = 86400):
        self.ttl = ttl_seconds
        self._keys: Dict[str, datetime] = {}
    
    def check_and_store(self, key: str) -> bool:
        """Check if key exists, store if not. Returns True if new."""
        self._cleanup()
        
        if key in self._keys:
            return False
        
        self._keys[key] = datetime.utcnow()
        return True
    
    def _cleanup(self):
        """Remove expired keys."""
        cutoff = datetime.utcnow() - timedelta(seconds=self.ttl)
        self._keys = {k: v for k, v in self._keys.items() if v > cutoff}


class WebhookHandler:
    """
    Handles incoming webhook requests from external systems.
    """
    
    def __init__(self):
        self._credentials: Dict[str, WebhookCredentials] = {}
        self._rate_limiter = RateLimiter(requests_per_minute=120, burst=20)
        self._idempotency = IdempotencyStore(ttl_seconds=86400)
        self._stats = {
            "requests_received": 0,
            "requests_processed": 0,
            "requests_rejected": 0,
            "auth_failures": 0,
            "rate_limited": 0,
            "duplicates_blocked": 0,
        }
        self._handlers: list = []
    
    def generate_credentials(self, gateway_id: int) -> Dict[str, str]:
        """Generate new webhook credentials for a gateway."""
        api_key = f"wh_{gateway_id}_{secrets.token_hex(16)}"
        secret_key = secrets.token_urlsafe(48)
        
        creds = WebhookCredentials(
            gateway_id=gateway_id,
            api_key=api_key,
            secret_key=secret_key,
            created_at=datetime.utcnow(),
        )
        
        self._credentials[api_key] = creds
        
        return {
            "api_key": api_key,
            "secret_key": secret_key,
            "webhook_url": f"/api/v1/webhooks/ingest/{gateway_id}",
        }
    
    def rotate_credentials(self, gateway_id: int, old_api_key: str) -> Dict[str, str]:
        """Rotate webhook credentials for a gateway."""
        if old_api_key in self._credentials:
            del self._credentials[old_api_key]
        return self.generate_credentials(gateway_id)
    
    def invalidate_cache_for_gateway(self, gateway_id: int) -> None:
        """Invalidate all cached credentials for a gateway."""
        keys_to_remove = [
            api_key for api_key, creds in self._credentials.items()
            if creds.gateway_id == gateway_id
        ]
        for key in keys_to_remove:
            del self._credentials[key]
    
    def _load_credentials_from_db(self, api_key: str) -> Optional[WebhookCredentials]:
        """Load credentials from database and cache them."""
        try:
            db = SessionLocal()
            try:
                db_creds = db.query(GatewayCredentialsModel).filter(
                    GatewayCredentialsModel.webhook_api_key == api_key
                ).first()
                
                if db_creds:
                    creds = WebhookCredentials(
                        gateway_id=db_creds.gateway_id,
                        api_key=db_creds.webhook_api_key,
                        secret_key=db_creds.webhook_secret_key or "",
                        created_at=db_creds.created_at or datetime.utcnow(),
                        last_rotated=db_creds.last_rotated,
                    )
                    self._credentials[api_key] = creds
                    return creds
                return None
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error loading credentials from DB: {e}")
            return None

    def validate_request(
        self,
        api_key: str,
        payload: bytes,
        signature: Optional[str] = None,
        timestamp: Optional[str] = None,
        idempotency_key: Optional[str] = None,
    ) -> tuple[bool, str, Optional[WebhookCredentials]]:
        """
        Validate an incoming webhook request.
        Returns (is_valid, error_message, credentials).
        """
        self._stats["requests_received"] += 1
        
        creds = self._credentials.get(api_key)
        if not creds:
            creds = self._load_credentials_from_db(api_key)
        
        if not creds:
            self._stats["auth_failures"] += 1
            return False, "Invalid API key", None
        
        if not self._rate_limiter.allow(api_key):
            self._stats["rate_limited"] += 1
            retry_after = self._rate_limiter.get_retry_after(api_key)
            return False, f"Rate limited. Retry after {retry_after}s", None
        
        if signature and timestamp:
            if not creds.verify_signature(payload, signature, timestamp):
                self._stats["auth_failures"] += 1
                return False, "Invalid signature", None
            
            try:
                ts = int(timestamp)
                if abs(time.time() - ts) > 300:
                    return False, "Timestamp too old or in future", None
            except ValueError:
                return False, "Invalid timestamp format", None
        
        if idempotency_key:
            if not self._idempotency.check_and_store(idempotency_key):
                self._stats["duplicates_blocked"] += 1
                return False, "Duplicate request (idempotency key already used)", None
        
        return True, "", creds
    
    def add_handler(self, handler):
        """Add a handler for incoming webhook data."""
        self._handlers.append(handler)
    
    async def process_webhook(
        self,
        gateway_id: int,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Process validated webhook payload."""
        self._stats["requests_processed"] += 1
        
        result = {
            "status": "received",
            "gateway_id": gateway_id,
            "timestamp": datetime.utcnow().isoformat(),
            "items_processed": 0,
        }
        
        for handler in self._handlers:
            try:
                await handler(gateway_id, payload)
                result["items_processed"] += 1
            except Exception as e:
                logger.error(f"Webhook handler error: {e}")
        
        return result
    
    def get_status(self) -> Dict[str, Any]:
        """Get webhook handler status."""
        return {
            "registered_gateways": len(self._credentials),
            "stats": self._stats.copy(),
        }
    
    def get_gateway_credentials(self, api_key: str) -> Optional[WebhookCredentials]:
        """Get credentials for an API key."""
        return self._credentials.get(api_key)


webhook_handler = WebhookHandler()


async def get_webhook_handler() -> WebhookHandler:
    """Get the webhook handler instance."""
    return webhook_handler
