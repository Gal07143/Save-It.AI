"""Request validation middleware for input sanitization."""
import re
import html
from typing import Any, Dict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for centralized input sanitization and validation.
    
    Sanitizes string inputs to prevent XSS and SQL injection attempts.
    """
    
    MAX_BODY_SIZE = 10 * 1024 * 1024
    
    DANGEROUS_PATTERNS = [
        r"<script[^>]*>",
        r"javascript:",
        r"on\w+\s*=",
        r"data:text/html",
    ]
    
    SQL_PATTERNS = [
        r";\s*(drop|delete|truncate|alter)\s+",
        r"union\s+select",
        r"'\s*or\s+'?\d",
        r"--\s*$",
    ]
    
    def __init__(self, app, sanitize_html: bool = True):
        super().__init__(app)
        self.sanitize_html = sanitize_html
        self.dangerous_re = [re.compile(p, re.IGNORECASE) for p in self.DANGEROUS_PATTERNS]
        self.sql_re = [re.compile(p, re.IGNORECASE) for p in self.SQL_PATTERNS]
    
    def _check_dangerous_content(self, value: str) -> bool:
        for pattern in self.dangerous_re:
            if pattern.search(value):
                return True
        return False
    
    def _check_sql_injection(self, value: str) -> bool:
        for pattern in self.sql_re:
            if pattern.search(value):
                return True
        return False
    
    def _sanitize_string(self, value: str) -> str:
        if self.sanitize_html:
            value = html.escape(value)
        return value.strip()
    
    def _sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                sanitized[key] = self._sanitize_string(value)
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self._sanitize_string(v) if isinstance(v, str)
                    else self._sanitize_dict(v) if isinstance(v, dict)
                    else v
                    for v in value
                ]
            else:
                sanitized[key] = value
        return sanitized
    
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi"):
            return await call_next(request)
        
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.MAX_BODY_SIZE:
            return JSONResponse(
                status_code=413,
                content={"error": "Request body too large", "max_size_mb": self.MAX_BODY_SIZE // (1024 * 1024)}
            )
        
        for key, value in request.query_params.items():
            if self._check_dangerous_content(value):
                return JSONResponse(
                    status_code=400,
                    content={"error": "Potentially dangerous content detected in query parameters"}
                )
            if self._check_sql_injection(value):
                return JSONResponse(
                    status_code=400,
                    content={"error": "Potentially dangerous SQL pattern detected"}
                )
        
        return await call_next(request)


def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """Validate phone number format (international)."""
    pattern = r"^\+?[1-9]\d{1,14}$"
    cleaned = re.sub(r"[\s\-\(\)]", "", phone)
    return bool(re.match(pattern, cleaned))


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename to prevent path traversal."""
    filename = re.sub(r"[^\w\-_\. ]", "", filename)
    filename = filename.replace("..", "")
    return filename[:255]
