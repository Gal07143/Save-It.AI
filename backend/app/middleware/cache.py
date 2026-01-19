"""Response caching middleware for frequently accessed data."""
import hashlib
import json
import time
from typing import Dict, Optional, Any
from functools import wraps
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse


class InMemoryCache:
    """Simple in-memory cache with TTL support."""
    
    def __init__(self, max_size: int = 1000):
        self._cache: Dict[str, tuple] = {}
        self._max_size = max_size
    
    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        
        value, expires_at = self._cache[key]
        if expires_at and time.time() > expires_at:
            del self._cache[key]
            return None
        
        return value
    
    def set(self, key: str, value: Any, ttl: int = 300) -> None:
        if len(self._cache) >= self._max_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        
        expires_at = time.time() + ttl if ttl > 0 else None
        self._cache[key] = (value, expires_at)
    
    def delete(self, key: str) -> None:
        if key in self._cache:
            del self._cache[key]
    
    def clear(self) -> None:
        self._cache.clear()
    
    def clear_pattern(self, pattern: str) -> int:
        keys_to_delete = [k for k in self._cache.keys() if pattern in k]
        for key in keys_to_delete:
            del self._cache[key]
        return len(keys_to_delete)
    
    def stats(self) -> Dict[str, int]:
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
        }


cache = InMemoryCache()


def cache_key(request: Request) -> str:
    """Generate a cache key from request path and query params."""
    query = str(sorted(request.query_params.items()))
    key_str = f"{request.method}:{request.url.path}:{query}"
    return hashlib.md5(key_str.encode()).hexdigest()


CACHEABLE_PATHS = {
    "/api/v1/sites": 60,
    "/api/v1/assets": 60,
    "/api/v1/meters": 60,
    "/api/v1/tariffs": 300,
    "/api/v1/device-templates": 300,
    "/api/v1/bess/vendors": 600,
    "/api/v1/bess/models": 600,
    "/api/v1/pv/catalog": 600,
}


class CacheMiddleware(BaseHTTPMiddleware):
    """
    Middleware to cache GET responses for frequently accessed endpoints.
    
    Uses in-memory cache with configurable TTL per endpoint.
    """
    
    async def dispatch(self, request: Request, call_next):
        if request.method != "GET":
            if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
                path_prefix = "/".join(request.url.path.split("/")[:4])
                cache.clear_pattern(path_prefix)
            return await call_next(request)
        
        path = request.url.path
        ttl = None
        for cacheable_path, cache_ttl in CACHEABLE_PATHS.items():
            if path.startswith(cacheable_path):
                ttl = cache_ttl
                break
        
        if ttl is None:
            return await call_next(request)
        
        key = cache_key(request)
        cached = cache.get(key)
        if cached:
            response = JSONResponse(content=cached)
            response.headers["X-Cache"] = "HIT"
            return response
        
        response = await call_next(request)
        
        if response.status_code == 200:
            body_bytes = b""
            async for chunk in response.body_iterator:
                body_bytes += chunk
            
            try:
                body_json = json.loads(body_bytes)
                cache.set(key, body_json, ttl)
            except:
                pass
            
            new_response = Response(
                content=body_bytes,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
            new_response.headers["X-Cache"] = "MISS"
            return new_response
        
        return response


def cached(ttl: int = 300):
    """
    Decorator to cache function results.
    
    Usage:
        @cached(ttl=60)
        def get_sites(site_id: int):
            ...
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            cached_value = cache.get(key)
            if cached_value is not None:
                return cached_value
            
            result = func(*args, **kwargs)
            cache.set(key, result, ttl)
            return result
        return wrapper
    return decorator
