"""User context middleware - extracts authenticated user and sets on request.state."""
import os
import logging
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class UserContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts the authenticated user from JWT tokens
    and sets it on request.state for use by other middleware.

    Unlike get_current_user dependency, this doesn't require authentication -
    it just populates request.state.user if a valid token is present.
    """

    def __init__(self, app, db_session_factory=None):
        super().__init__(app)
        self.db_session_factory = db_session_factory

    async def dispatch(self, request: Request, call_next):
        # Initialize user to None
        request.state.user = None

        try:
            # Try to extract token from Authorization header or cookie
            token = self._get_token(request)
            if token:
                user = self._get_user_from_token(token)
                if user:
                    request.state.user = user
        except Exception as e:
            # Don't fail the request if we can't extract user
            logger.debug(f"Could not extract user from token: {e}")

        response = await call_next(request)
        return response

    def _get_token(self, request: Request) -> Optional[str]:
        """Extract token from Authorization header or cookie."""
        # Try Authorization header first
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]

        # Try cookie
        return request.cookies.get("access_token")

    def _get_user_from_token(self, token: str):
        """Decode token and fetch user from database."""
        from app.api.routers.auth import decode_access_token
        from app.models import User

        payload = decode_access_token(token)
        if not payload:
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        # Get user from database
        if self.db_session_factory:
            db: Session = self.db_session_factory()
            try:
                user = db.query(User).filter(User.id == int(user_id)).first()
                if user and user.is_active:
                    return user
            finally:
                db.close()

        return None
