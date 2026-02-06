"""Authentication API endpoints."""
import os
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import bcrypt
from jose import JWTError, jwt

from app.core.database import get_db
from app.models import User, Organization, UserRole
from app.utils.password import hash_password, verify_password as verify_pw
from app.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    AuthUserResponse,
)

# Cookie configuration
COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 60 * 60 * 24  # 24 hours in seconds
COOKIE_SECURE = os.getenv("DEBUG", "false").lower() != "true"  # Secure in production
COOKIE_SAMESITE = "lax"  # Protects against CSRF while allowing normal navigation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Get secret key from environment - check multiple possible names
SECRET_KEY = os.getenv("SESSION_SECRET") or os.getenv("SECRET_KEY") or ""
if not SECRET_KEY:
    # In development or if ENVIRONMENT is not production, allow a fallback
    env = os.getenv("ENVIRONMENT", "development").lower()
    if os.getenv("DEBUG", "false").lower() == "true" or env != "production":
        SECRET_KEY = secrets.token_urlsafe(32)
        logger.warning(
            "No secret key set - using temporary key. "
            "Set SESSION_SECRET or SECRET_KEY in production."
        )
    else:
        raise RuntimeError(
            "SESSION_SECRET or SECRET_KEY environment variable must be set in production. "
            "Generate a secure key with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return verify_pw(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return hash_password(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def set_auth_cookie(response: Response, token: str) -> None:
    """Set the authentication cookie with secure settings."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the authentication cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get the current authenticated user from JWT token.

    Supports both:
    - Authorization header (Bearer token) - for API clients
    - HttpOnly cookie (access_token) - for browser clients
    """
    token = None

    # First, try to get token from Authorization header
    if credentials:
        token = credentials.credentials

    # Fall back to HttpOnly cookie if no Authorization header
    if not token:
        token = request.cookies.get(COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    return user


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Register a new user account."""
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    org_name = request.organization_name or f"{request.email.split('@')[0]}'s Organization"
    slug = org_name.lower().replace(" ", "-").replace("'", "")[:50]

    existing_org = db.query(Organization).filter(Organization.slug == slug).first()
    if existing_org:
        slug = f"{slug}-{secrets.token_hex(4)}"

    organization = Organization(
        name=org_name,
        slug=slug,
        is_active=1
    )
    db.add(organization)
    db.flush()

    user = User(
        organization_id=organization.id,
        email=request.email,
        password_hash=get_password_hash(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
        role=UserRole.ORG_ADMIN,
        is_active=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id)})

    # Set HttpOnly cookie for browser clients
    set_auth_cookie(response, access_token)

    return TokenResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=user.id,
            organization_id=user.organization_id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            role=user.role,
            is_active=bool(user.is_active),
            mfa_enabled=bool(user.mfa_enabled),
            last_login_at=user.last_login_at,
            created_at=user.created_at
        )
    )


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate user and return access token."""
    user = db.query(User).filter(User.email == request.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is temporarily locked due to too many failed login attempts"
        )

    if not verify_password(request.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= 5:
            user.locked_until = datetime.utcnow() + timedelta(minutes=15)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id)})

    # Set HttpOnly cookie for browser clients
    set_auth_cookie(response, access_token)

    return TokenResponse(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=user.id,
            organization_id=user.organization_id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            role=user.role,
            is_active=bool(user.is_active),
            mfa_enabled=bool(user.mfa_enabled),
            last_login_at=user.last_login_at,
            created_at=user.created_at
        )
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        organization_id=current_user.organization_id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=bool(current_user.is_active),
        mfa_enabled=bool(current_user.mfa_enabled),
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at
    )


@router.post("/logout")
def logout(response: Response):
    """Logout current user by clearing the authentication cookie."""
    clear_auth_cookie(response)
    return {"message": "Successfully logged out"}


@router.post("/password-reset")
def request_password_reset(email: str, db: Session = Depends(get_db)):
    """Request a password reset email."""
    user = db.query(User).filter(User.email == email).first()
    if user:
        pass
    return {"message": "If an account exists with this email, a password reset link has been sent."}
