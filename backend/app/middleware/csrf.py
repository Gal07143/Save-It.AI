"""CSRF protection middleware using double-submit cookie pattern."""
import secrets
import hmac
import hashlib
import os
import logging
from typing import Optional, Set
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

logger = logging.getLogger(__name__)

CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_TOKEN_LENGTH = 32
CSRF_COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours

# Methods that require CSRF protection
PROTECTED_METHODS: Set[str] = {"POST", "PUT", "DELETE", "PATCH"}

# Paths exempt from CSRF protection (e.g., API key authenticated endpoints)
EXEMPT_PATHS: Set[str] = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/webhooks/",
    "/api/v1/public/",
    "/api/v1/ingestion/",
}


def get_csrf_secret() -> str:
    """Get CSRF signing secret from environment or SESSION_SECRET."""
    return os.getenv("CSRF_SECRET", os.getenv("SESSION_SECRET", ""))


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(CSRF_TOKEN_LENGTH)


def sign_token(token: str, secret: str) -> str:
    """Sign a token with HMAC-SHA256."""
    return hmac.new(
        secret.encode(),
        token.encode(),
        hashlib.sha256
    ).hexdigest()


def verify_token(token: str, signature: str, secret: str) -> bool:
    """Verify a token signature."""
    expected = sign_token(token, secret)
    return hmac.compare_digest(expected, signature)


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware using double-submit cookie pattern.

    For every request:
    1. If no CSRF cookie exists, generate and set one
    2. For state-changing requests (POST/PUT/DELETE/PATCH):
       - Verify the X-CSRF-Token header matches the cookie value
       - Reject if missing or mismatched

    The frontend must:
    1. Read the csrf_token cookie
    2. Send it as X-CSRF-Token header on mutations
    """

    def __init__(
        self,
        app,
        cookie_name: str = CSRF_COOKIE_NAME,
        header_name: str = CSRF_HEADER_NAME,
        cookie_secure: Optional[bool] = None,
        cookie_samesite: str = "lax",
        exempt_paths: Optional[Set[str]] = None,
    ):
        super().__init__(app)
        self.cookie_name = cookie_name
        self.header_name = header_name
        self.cookie_samesite = cookie_samesite
        self.exempt_paths = exempt_paths or EXEMPT_PATHS
        self.secret = get_csrf_secret()

        # Auto-detect secure: explicit COOKIE_SECURE env overrides DEBUG check.
        # Set COOKIE_SECURE=false for HTTP-only deployments (e.g. Raspberry Pi on LAN).
        if cookie_secure is None:
            _cs = os.getenv("COOKIE_SECURE", "").lower()
            if _cs in ("false", "0", "no"):
                self.cookie_secure = False
            elif _cs in ("true", "1", "yes"):
                self.cookie_secure = True
            else:
                self.cookie_secure = os.getenv("DEBUG", "false").lower() != "true"
        else:
            self.cookie_secure = cookie_secure

    def _is_exempt(self, request: Request) -> bool:
        """Check if the request path is exempt from CSRF protection."""
        path = request.url.path

        # Check exact matches and prefixes
        for exempt_path in self.exempt_paths:
            if path == exempt_path or path.startswith(exempt_path.rstrip("/")):
                return True

        # API key authenticated requests are exempt
        if request.headers.get("X-API-Key"):
            return True

        return False

    def _get_token_from_cookie(self, request: Request) -> Optional[str]:
        """Get CSRF token from cookie."""
        return request.cookies.get(self.cookie_name)

    def _get_token_from_header(self, request: Request) -> Optional[str]:
        """Get CSRF token from header."""
        return request.headers.get(self.header_name)

    def _set_csrf_cookie(self, response: Response, token: str) -> None:
        """Set CSRF token cookie."""
        response.set_cookie(
            key=self.cookie_name,
            value=token,
            max_age=CSRF_COOKIE_MAX_AGE,
            httponly=False,  # Must be readable by JavaScript
            secure=self.cookie_secure,
            samesite=self.cookie_samesite,
            path="/",
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip CSRF validation in test mode
        if os.getenv("TESTING") == "true":
            return await call_next(request)

        # Get existing token from cookie
        cookie_token = self._get_token_from_cookie(request)

        # For protected methods, validate CSRF token
        if request.method in PROTECTED_METHODS:
            # Check if path is exempt
            if not self._is_exempt(request):
                header_token = self._get_token_from_header(request)

                # Validate token presence
                if not cookie_token:
                    logger.warning(
                        f"CSRF validation failed: missing cookie token for {request.method} {request.url.path}"
                    )
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "CSRF validation failed",
                            "detail": "Missing CSRF token cookie"
                        }
                    )

                if not header_token:
                    logger.warning(
                        f"CSRF validation failed: missing header token for {request.method} {request.url.path}"
                    )
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "CSRF validation failed",
                            "detail": "Missing X-CSRF-Token header"
                        }
                    )

                # Validate token match (constant-time comparison)
                if not hmac.compare_digest(cookie_token, header_token):
                    logger.warning(
                        f"CSRF validation failed: token mismatch for {request.method} {request.url.path}"
                    )
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": "CSRF validation failed",
                            "detail": "CSRF token mismatch"
                        }
                    )

        # Process request
        response = await call_next(request)

        # Generate new token if none exists
        if not cookie_token:
            new_token = generate_csrf_token()
            self._set_csrf_cookie(response, new_token)

        return response


def get_csrf_token(request: Request) -> str:
    """Get or generate CSRF token for the current request."""
    token = request.cookies.get(CSRF_COOKIE_NAME)
    if not token:
        token = generate_csrf_token()
    return token
