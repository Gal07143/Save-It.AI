"""Middleware components for SAVE-IT.AI API."""
from backend.app.middleware.rate_limit import (
    RateLimitMiddleware,
    set_tenant_rate_limit,
    remove_tenant_rate_limit,
)
from backend.app.middleware.audit_log import AuditLogMiddleware
from backend.app.middleware.request_log import RequestLogMiddleware
from backend.app.middleware.error_handler import error_handler_middleware
from backend.app.middleware.api_key_auth import (
    get_api_key_auth,
    require_api_key,
    generate_api_key,
    hash_api_key,
)
from backend.app.middleware.cache import CacheMiddleware, cache, cached
from backend.app.middleware.validation import RequestValidationMiddleware
from backend.app.middleware.security_headers import SecurityHeadersMiddleware
from backend.app.middleware.csrf import CSRFMiddleware, get_csrf_token
from backend.app.middleware.user_context import UserContextMiddleware

__all__ = [
    "RateLimitMiddleware",
    "set_tenant_rate_limit",
    "remove_tenant_rate_limit",
    "AuditLogMiddleware",
    "RequestLogMiddleware",
    "error_handler_middleware",
    "get_api_key_auth",
    "require_api_key",
    "generate_api_key",
    "hash_api_key",
    "CacheMiddleware",
    "cache",
    "cached",
    "RequestValidationMiddleware",
    "SecurityHeadersMiddleware",
    "CSRFMiddleware",
    "get_csrf_token",
    "UserContextMiddleware",
]
