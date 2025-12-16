"""Platform foundation Pydantic schemas for Organization, User, AuditLog, PeriodLock."""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class UserRole(str, Enum):
    """User roles for RBAC."""
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    SITE_MANAGER = "site_manager"
    ANALYST = "analyst"
    OPERATOR = "operator"
    VIEWER = "viewer"


class AuditAction(str, Enum):
    """Actions tracked in audit logs."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    APPROVE = "approve"
    REJECT = "reject"
    LOCK = "lock"
    UNLOCK = "unlock"
    EXPORT = "export"
    IMPORT = "import"


class FileStatus(str, Enum):
    """Status of uploaded files."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class PeriodStatus(str, Enum):
    """Status of billing/reporting periods."""
    OPEN = "open"
    LOCKED = "locked"
    CLOSED = "closed"


class OrganizationCreate(BaseModel):
    """Schema for creating an organization."""
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100)
    logo_url: Optional[str] = None
    primary_color: str = "#1a56db"
    secondary_color: str = "#7e22ce"
    billing_email: Optional[str] = None
    mfa_required: bool = False


class OrganizationResponse(BaseModel):
    """Response schema for organization."""
    id: int
    name: str
    slug: str
    logo_url: Optional[str] = None
    primary_color: str
    secondary_color: str
    billing_email: Optional[str] = None
    subscription_plan: str
    is_active: bool
    mfa_required: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    """Schema for creating a user."""
    organization_id: int
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.VIEWER


class UserResponse(BaseModel):
    """Response schema for user."""
    id: int
    organization_id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    mfa_enabled: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    """Response schema for audit log entries."""
    id: int
    user_id: Optional[int] = None
    organization_id: Optional[int] = None
    site_id: Optional[int] = None
    action: AuditAction
    entity_type: str
    entity_id: Optional[int] = None
    before_state: Optional[str] = None
    after_state: Optional[str] = None
    ip_address: Optional[str] = None
    correlation_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileAssetCreate(BaseModel):
    """Schema for uploading a file."""
    organization_id: Optional[int] = None
    site_id: Optional[int] = None
    file_name: str
    original_name: str
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    storage_path: str


class FileAssetResponse(BaseModel):
    """Response schema for file assets."""
    id: int
    organization_id: Optional[int] = None
    site_id: Optional[int] = None
    file_name: str
    original_name: str
    file_type: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    storage_path: str
    version: int
    status: FileStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PeriodLockCreate(BaseModel):
    """Schema for creating a period lock."""
    site_id: Optional[int] = None
    period_type: str
    period_start: date
    period_end: date


class PeriodLockResponse(BaseModel):
    """Response schema for period locks."""
    id: int
    site_id: Optional[int] = None
    period_type: str
    period_start: date
    period_end: date
    status: PeriodStatus
    locked_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
