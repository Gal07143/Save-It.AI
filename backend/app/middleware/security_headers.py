"""Security headers middleware for HTTP response hardening."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Optional
import os


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all HTTP responses.

    Implements OWASP recommended security headers:
    - HSTS (HTTP Strict Transport Security)
    - Content-Security-Policy
    - X-Frame-Options
    - X-Content-Type-Options
    - X-XSS-Protection
    - Referrer-Policy
    - Permissions-Policy
    """

    def __init__(
        self,
        app,
        hsts_max_age: int = 31536000,  # 1 year
        hsts_include_subdomains: bool = True,
        hsts_preload: bool = True,
        frame_options: str = "DENY",
        content_type_options: str = "nosniff",
        xss_protection: str = "1; mode=block",
        referrer_policy: str = "strict-origin-when-cross-origin",
        csp_policy: Optional[str] = None,
        permissions_policy: Optional[str] = None,
    ):
        super().__init__(app)
        self.hsts_max_age = hsts_max_age
        self.hsts_include_subdomains = hsts_include_subdomains
        self.hsts_preload = hsts_preload
        self.frame_options = frame_options
        self.content_type_options = content_type_options
        self.xss_protection = xss_protection
        self.referrer_policy = referrer_policy
        self.is_production = os.getenv("DEBUG", "false").lower() != "true"

        # Default CSP if not provided
        self.csp_policy = csp_policy or self._build_default_csp()

        # Default Permissions-Policy
        self.permissions_policy = permissions_policy or self._build_default_permissions_policy()

    def _build_default_csp(self) -> str:
        """Build a secure default Content-Security-Policy."""
        directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Needed for React dev, tighten in prod
            "style-src 'self' 'unsafe-inline'",  # Needed for inline styles
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' ws: wss:",  # Allow WebSocket connections
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
        ]

        if self.is_production:
            # Stricter CSP for production
            directives[1] = "script-src 'self'"  # Remove unsafe-inline/eval

        return "; ".join(directives)

    def _build_default_permissions_policy(self) -> str:
        """Build default Permissions-Policy (formerly Feature-Policy)."""
        permissions = [
            "accelerometer=()",
            "camera=()",
            "geolocation=()",
            "gyroscope=()",
            "magnetometer=()",
            "microphone=()",
            "payment=()",
            "usb=()",
        ]
        return ", ".join(permissions)

    def _build_hsts_header(self) -> str:
        """Build HSTS header value."""
        value = f"max-age={self.hsts_max_age}"
        if self.hsts_include_subdomains:
            value += "; includeSubDomains"
        if self.hsts_preload:
            value += "; preload"
        return value

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Skip security headers for certain paths (docs, health checks)
        path = request.url.path
        if path.startswith("/docs") or path.startswith("/openapi") or path.startswith("/redoc"):
            return response

        # Add security headers
        response.headers["X-Frame-Options"] = self.frame_options
        response.headers["X-Content-Type-Options"] = self.content_type_options
        response.headers["X-XSS-Protection"] = self.xss_protection
        response.headers["Referrer-Policy"] = self.referrer_policy
        response.headers["Content-Security-Policy"] = self.csp_policy
        response.headers["Permissions-Policy"] = self.permissions_policy

        # Only add HSTS in production (requires HTTPS)
        if self.is_production:
            response.headers["Strict-Transport-Security"] = self._build_hsts_header()

        # Additional security headers
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"

        return response
