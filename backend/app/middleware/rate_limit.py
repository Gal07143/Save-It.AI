"""Rate limiting middleware for API protection."""
import time
from collections import defaultdict
from typing import Dict, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Token bucket rate limiting middleware.
    
    Limits requests per IP address with configurable rates for different endpoint groups.
    """
    
    def __init__(
        self,
        app,
        default_limit: int = 100,
        default_window: int = 60,
        burst_limit: int = 20,
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        self.burst_limit = burst_limit
        self.requests: Dict[str, list] = defaultdict(list)
        self.endpoint_limits = {
            "/api/v1/auth": (20, 60),
            "/api/v1/bills/scan": (10, 60),
            "/api/v1/ai": (30, 60),
            "/api/v1/data-sources/discover": (5, 60),
        }
    
    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def _get_limit_for_path(self, path: str) -> Tuple[int, int]:
        for prefix, limits in self.endpoint_limits.items():
            if path.startswith(prefix):
                return limits
        return (self.default_limit, self.default_window)
    
    def _clean_old_requests(self, client_key: str, window: int) -> None:
        now = time.time()
        self.requests[client_key] = [
            ts for ts in self.requests[client_key]
            if now - ts < window
        ]
    
    def _check_burst(self, client_key: str) -> bool:
        now = time.time()
        recent = [ts for ts in self.requests[client_key] if now - ts < 1]
        return len(recent) < self.burst_limit
    
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi"):
            return await call_next(request)
        
        if request.url.path.startswith("/api/v1/public"):
            return await call_next(request)
        
        client_ip = self._get_client_ip(request)
        path = request.url.path
        limit, window = self._get_limit_for_path(path)
        
        client_key = f"{client_ip}:{path.split('/')[3] if len(path.split('/')) > 3 else 'root'}"
        
        self._clean_old_requests(client_key, window)
        
        if not self._check_burst(client_key):
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests",
                    "detail": "Burst limit exceeded. Please slow down.",
                    "retry_after": 1
                },
                headers={"Retry-After": "1"}
            )
        
        if len(self.requests[client_key]) >= limit:
            oldest = min(self.requests[client_key]) if self.requests[client_key] else time.time()
            retry_after = int(window - (time.time() - oldest)) + 1
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Too many requests",
                    "detail": f"Rate limit of {limit} requests per {window} seconds exceeded.",
                    "retry_after": retry_after
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        self.requests[client_key].append(time.time())
        
        response = await call_next(request)
        
        remaining = limit - len(self.requests[client_key])
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window)
        
        return response
