"""Middleware components for SAVE-IT.AI API."""
from backend.app.middleware.rate_limit import RateLimitMiddleware
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

__all__ = [
    "RateLimitMiddleware",
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
]
