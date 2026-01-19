"""Audit logging middleware for tracking user actions."""
import json
import time
from datetime import datetime
from typing import Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class AuditLogMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log significant user actions for audit compliance.
    
    Tracks mutations (POST, PUT, PATCH, DELETE) and stores them in the database.
    """
    
    AUDITABLE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    
    SKIP_PATHS = {
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/v1/health",
        "/api/v1/auth/login",
    }
    
    SENSITIVE_FIELDS = {"password", "token", "secret", "api_key", "authorization"}
    
    def __init__(self, app, db_session_factory=None):
        super().__init__(app)
        self.db_session_factory = db_session_factory
    
    def _should_audit(self, request: Request) -> bool:
        if request.method not in self.AUDITABLE_METHODS:
            return False
        for skip_path in self.SKIP_PATHS:
            if request.url.path.startswith(skip_path):
                return False
        return True
    
    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def _get_user_id(self, request: Request) -> Optional[int]:
        if hasattr(request.state, "user"):
            return getattr(request.state.user, "id", None)
        return None
    
    def _sanitize_body(self, body: dict) -> dict:
        sanitized = {}
        for key, value in body.items():
            if key.lower() in self.SENSITIVE_FIELDS:
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_body(value)
            else:
                sanitized[key] = value
        return sanitized
    
    def _extract_resource_info(self, path: str, method: str) -> tuple:
        parts = path.strip("/").split("/")
        if len(parts) >= 3 and parts[0] == "api" and parts[1] == "v1":
            resource_type = parts[2]
            resource_id = parts[3] if len(parts) > 3 and parts[3].isdigit() else None
            return resource_type, resource_id
        return "unknown", None
    
    async def dispatch(self, request: Request, call_next):
        if not self._should_audit(request):
            return await call_next(request)
        
        start_time = time.time()
        
        body = None
        if request.method in {"POST", "PUT", "PATCH"}:
            try:
                body_bytes = await request.body()
                if body_bytes:
                    body = json.loads(body_bytes)
                    body = self._sanitize_body(body)
            except:
                body = None
        
        response = await call_next(request)
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        resource_type, resource_id = self._extract_resource_info(
            request.url.path, request.method
        )
        
        action_map = {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }
        
        audit_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": self._get_user_id(request),
            "client_ip": self._get_client_ip(request),
            "method": request.method,
            "path": request.url.path,
            "action": action_map.get(request.method, "unknown"),
            "resource_type": resource_type,
            "resource_id": resource_id,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "request_body": body,
            "user_agent": request.headers.get("User-Agent", ""),
        }
        
        if self.db_session_factory:
            try:
                self._store_audit_log(audit_entry)
            except Exception as e:
                print(f"Failed to store audit log: {e}")
        else:
            print(f"AUDIT: {json.dumps(audit_entry)}")
        
        return response
    
    def _store_audit_log(self, entry: dict) -> None:
        from backend.app.models import AuditLog
        
        if self.db_session_factory is None:
            return
        
        db = self.db_session_factory()
        try:
            log = AuditLog(
                user_id=entry.get("user_id"),
                action=entry.get("action"),
                entity_type=entry.get("resource_type"),
                entity_id=entry.get("resource_id"),
                metadata_json=json.dumps(entry.get("request_body")) if entry.get("request_body") else None,
                ip_address=entry.get("client_ip"),
            )
            db.add(log)
            db.commit()
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
