"""Request logging middleware for API monitoring."""
import time
import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.utils.ip import get_client_ip

logger = logging.getLogger("saveit.requests")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s - %(levelname)s - %(message)s"
    ))
    logger.addHandler(handler)


class RequestLogMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all API requests with timing information.
    
    Logs request method, path, status code, and response time.
    """
    
    SKIP_PATHS = {"/docs", "/openapi.json", "/redoc", "/favicon.ico"}
    
    def _get_client_ip(self, request: Request) -> str:
        return get_client_ip(request)
    
    async def dispatch(self, request: Request, call_next):
        for skip_path in self.SKIP_PATHS:
            if request.url.path.startswith(skip_path):
                return await call_next(request)
        
        start_time = time.time()
        
        response = await call_next(request)
        
        duration_ms = (time.time() - start_time) * 1000
        
        status_emoji = "✓" if response.status_code < 400 else "✗"
        
        log_level = logging.INFO
        if response.status_code >= 500:
            log_level = logging.ERROR
        elif response.status_code >= 400:
            log_level = logging.WARNING
        
        logger.log(
            log_level,
            f"{status_emoji} {request.method} {request.url.path} "
            f"[{response.status_code}] {duration_ms:.2f}ms "
            f"IP:{self._get_client_ip(request)}"
        )
        
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        
        return response
