"""Middleware components for SAVE-IT.AI API."""
from app.middleware.rate_limit import (
    RateLimitMiddleware,
    set_tenant_rate_limit,
    remove_tenant_rate_limit,
)
from app.middleware.audit_log import AuditLogMiddleware
from app.middleware.request_log import RequestLogMiddleware
from app.middleware.error_handler import error_handler_middleware
from app.middleware.api_key_auth import (
    get_api_key_auth,
    require_api_key,
    generate_api_key,
    hash_api_key,
)
from app.middleware.cache import CacheMiddleware, cache, cached
from app.middleware.validation import RequestValidationMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.middleware.csrf import CSRFMiddleware, get_csrf_token
from app.middleware.user_context import UserContextMiddleware

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
