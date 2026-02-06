"""Authentication Pydantic schemas for login, register, tokens."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.platform import UserRole, UserResponse


class LoginRequest(BaseModel):
    """Schema for login request."""
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    """Schema for user registration."""
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    organization_name: Optional[str] = None


class TokenResponse(BaseModel):
    """Response schema for authentication token."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class AuthUserResponse(BaseModel):
    """Response schema for current authenticated user."""
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: UserRole
    organization_id: int
    organization_name: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class PasswordResetRequest(BaseModel):
    """Schema for password reset request."""
    email: str = Field(..., min_length=5, max_length=255)


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation."""
    token: str
    new_password: str = Field(..., min_length=8)


class UserProfileUpdate(BaseModel):
    """Schema for updating user profile."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """Schema for changing password."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)
