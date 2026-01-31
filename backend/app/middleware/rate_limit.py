"""Rate limiting middleware for API protection with Redis support."""
import time
import os
import logging
from collections import OrderedDict
from typing import Dict, Tuple, Optional, Any
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from backend.app.utils.ip import get_client_ip

logger = logging.getLogger(__name__)


class LRUCache:
    """Memory-bounded LRU cache for rate limiting fallback."""

    def __init__(self, max_size: int = 10000):
        self._cache: OrderedDict = OrderedDict()
        self._max_size = max_size

    def get(self, key: str) -> Optional[list]:
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        return None

    def set(self, key: str, value: list) -> None:
        if key in self._cache:
            self._cache.move_to_end(key)
        else:
            if len(self._cache) >= self._max_size:
                # Evict oldest entry
                self._cache.popitem(last=False)
        self._cache[key] = value

    def delete(self, key: str) -> None:
        if key in self._cache:
            del self._cache[key]

    def size(self) -> int:
        return len(self._cache)


class RedisRateLimiter:
    """Redis-based rate limiter for horizontal scaling."""

    def __init__(self, redis_url: Optional[str] = None):
        self._redis = None
        self._redis_url = redis_url or os.getenv("REDIS_URL")
        self._connected = False
        self._connect()

    def _connect(self) -> None:
        """Attempt to connect to Redis."""
        if not self._redis_url:
            return

        try:
            import redis
            self._redis = redis.from_url(
                self._redis_url,
                decode_responses=True,
                socket_timeout=1,
                socket_connect_timeout=1,
            )
            # Test connection
            self._redis.ping()
            self._connected = True
            logger.info("Redis rate limiter connected")
        except Exception as e:
            logger.warning(f"Redis connection failed, using in-memory fallback: {e}")
            self._redis = None
            self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected and self._redis is not None

    def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int,
    ) -> Tuple[bool, int, int]:
        """
        Check rate limit using Redis sliding window.

        Returns:
            Tuple of (allowed, remaining, reset_time)
        """
        if not self.is_connected:
            return True, limit, int(time.time()) + window

        try:
            now = time.time()
            window_start = now - window
            redis_key = f"ratelimit:{key}"

            pipe = self._redis.pipeline()

            # Remove old entries
            pipe.zremrangebyscore(redis_key, 0, window_start)

            # Count current requests
            pipe.zcard(redis_key)

            # Add current request
            pipe.zadd(redis_key, {str(now): now})

            # Set expiry
            pipe.expire(redis_key, window)

            results = pipe.execute()
            current_count = results[1]

            remaining = max(0, limit - current_count - 1)
            reset_time = int(now) + window

            if current_count >= limit:
                # Remove the request we just added
                self._redis.zrem(redis_key, str(now))
                return False, 0, reset_time

            return True, remaining, reset_time

        except Exception as e:
            logger.warning(f"Redis rate limit check failed: {e}")
            return True, limit, int(time.time()) + window

    def check_burst(self, key: str, burst_limit: int) -> bool:
        """Check burst limit (requests per second)."""
        if not self.is_connected:
            return True

        try:
            now = time.time()
            redis_key = f"burst:{key}"

            pipe = self._redis.pipeline()
            pipe.zremrangebyscore(redis_key, 0, now - 1)
            pipe.zcard(redis_key)
            pipe.zadd(redis_key, {str(now): now})
            pipe.expire(redis_key, 2)

            results = pipe.execute()
            current_count = results[1]

            if current_count >= burst_limit:
                self._redis.zrem(redis_key, str(now))
                return False

            return True

        except Exception as e:
            logger.warning(f"Redis burst check failed: {e}")
            return True


class InMemoryRateLimiter:
    """In-memory rate limiter with LRU eviction."""

    def __init__(self, max_entries: int = 10000):
        self._requests = LRUCache(max_size=max_entries)
        self._burst = LRUCache(max_size=max_entries)

    def check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int,
    ) -> Tuple[bool, int, int]:
        """Check rate limit using in-memory sliding window."""
        now = time.time()
        window_start = now - window

        # Get or create request list
        requests = self._requests.get(key) or []

        # Remove old entries
        requests = [ts for ts in requests if ts > window_start]

        # Check limit
        if len(requests) >= limit:
            oldest = min(requests) if requests else now
            reset_time = int(oldest + window)
            self._requests.set(key, requests)
            return False, 0, reset_time

        # Add current request
        requests.append(now)
        self._requests.set(key, requests)

        remaining = limit - len(requests)
        reset_time = int(now) + window

        return True, remaining, reset_time

    def check_burst(self, key: str, burst_limit: int) -> bool:
        """Check burst limit (requests per second)."""
        now = time.time()

        # Get or create burst list
        bursts = self._burst.get(key) or []

        # Remove entries older than 1 second
        bursts = [ts for ts in bursts if now - ts < 1]

        if len(bursts) >= burst_limit:
            self._burst.set(key, bursts)
            return False

        bursts.append(now)
        self._burst.set(key, bursts)
        return True


# Per-tenant rate limit configuration
TENANT_RATE_LIMITS: Dict[str, Tuple[int, int]] = {
    # tenant_id: (requests_per_minute, burst_limit)
    # Can be loaded from database or config
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Token bucket rate limiting middleware with Redis support.

    Features:
    - Redis-based rate limiting for horizontal scaling
    - In-memory LRU fallback when Redis unavailable
    - Per-endpoint rate limits
    - Per-tenant custom limits for B2B clients
    - Burst protection
    """

    def __init__(
        self,
        app,
        default_limit: int = 100,
        default_window: int = 60,
        burst_limit: int = 20,
        redis_url: Optional[str] = None,
        max_memory_entries: int = 10000,
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        self.burst_limit = burst_limit

        # Initialize Redis limiter
        self._redis_limiter = RedisRateLimiter(redis_url)

        # Initialize in-memory fallback
        self._memory_limiter = InMemoryRateLimiter(max_entries=max_memory_entries)

        # Endpoint-specific limits
        self.endpoint_limits: Dict[str, Tuple[int, int]] = {
            "/api/v1/auth": (20, 60),
            "/api/v1/bills/scan": (10, 60),
            "/api/v1/bills/ocr": (10, 60),
            "/api/v1/ai": (30, 60),
            "/api/v1/agents": (30, 60),
            "/api/v1/data-sources/discover": (5, 60),
            "/api/v1/analysis": (20, 60),
            "/api/v1/forecasts": (10, 60),
        }

    def _get_client_ip(self, request: Request) -> str:
        return get_client_ip(request)

    def _get_tenant_id(self, request: Request) -> Optional[str]:
        """Extract tenant ID from request for per-tenant limits."""
        # Check header first (set by multi-tenant middleware)
        tenant_id = request.headers.get("X-Tenant-ID")
        if tenant_id:
            return tenant_id

        # Check state (set by auth middleware)
        if hasattr(request.state, "tenant_id"):
            return str(request.state.tenant_id)

        return None

    def _get_limit_for_path(self, path: str) -> Tuple[int, int]:
        """Get rate limit for a specific path."""
        for prefix, limits in self.endpoint_limits.items():
            if path.startswith(prefix):
                return limits
        return (self.default_limit, self.default_window)

    def _get_tenant_limit(self, tenant_id: str) -> Optional[Tuple[int, int]]:
        """Get custom limit for a tenant."""
        return TENANT_RATE_LIMITS.get(tenant_id)

    def _get_limiter(self):
        """Get the appropriate rate limiter."""
        if self._redis_limiter.is_connected:
            return self._redis_limiter
        return self._memory_limiter

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for docs and health checks
        path = request.url.path
        if (
            path.startswith("/docs")
            or path.startswith("/openapi")
            or path.startswith("/redoc")
            or path.startswith("/health")
            or path.startswith("/api/v1/health")
        ):
            return await call_next(request)

        # Skip for public endpoints
        if path.startswith("/api/v1/public"):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        tenant_id = self._get_tenant_id(request)

        # Determine rate limit
        limit, window = self._get_limit_for_path(path)

        # Apply tenant-specific limits if available
        if tenant_id:
            tenant_limit = self._get_tenant_limit(tenant_id)
            if tenant_limit:
                limit, window = tenant_limit

        # Build rate limit key
        path_segment = path.split("/")[3] if len(path.split("/")) > 3 else "root"
        if tenant_id:
            client_key = f"{tenant_id}:{path_segment}"
        else:
            client_key = f"{client_ip}:{path_segment}"

        limiter = self._get_limiter()

        # Check burst limit first
        if not limiter.check_burst(client_key, self.burst_limit):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests",
                    "detail": "Burst limit exceeded. Please slow down.",
                    "retry_after": 1,
                },
                headers={"Retry-After": "1"},
            )

        # Check rate limit
        allowed, remaining, reset_time = limiter.check_rate_limit(
            client_key, limit, window
        )

        if not allowed:
            retry_after = max(1, reset_time - int(time.time()))
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests",
                    "detail": f"Rate limit of {limit} requests per {window} seconds exceeded.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)

        return response


def set_tenant_rate_limit(tenant_id: str, limit: int, window: int = 60) -> None:
    """Set custom rate limit for a tenant."""
    TENANT_RATE_LIMITS[tenant_id] = (limit, window)


def remove_tenant_rate_limit(tenant_id: str) -> None:
    """Remove custom rate limit for a tenant."""
    TENANT_RATE_LIMITS.pop(tenant_id, None)
