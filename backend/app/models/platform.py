"""Platform Foundation models: Organization, User, OrgSite, UserSitePermission, AuditLog, FileAsset, PeriodLock, NotificationTemplate, NotificationPreference, NotificationDelivery."""
from datetime import datetime, date
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text, Date
from sqlalchemy.orm import relationship

from backend.app.core.database import Base
from backend.app.models.base import NotificationType


class UserRole(PyEnum):
    """User roles for RBAC."""
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    SITE_MANAGER = "site_manager"
    ANALYST = "analyst"
    OPERATOR = "operator"
    VIEWER = "viewer"


class AuditAction(PyEnum):
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


class FileStatus(PyEnum):
    """Status of uploaded files."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class PeriodStatus(PyEnum):
    """Status of billing/reporting periods."""
    OPEN = "open"
    LOCKED = "locked"
    CLOSED = "closed"


class NotificationChannel(PyEnum):
    """Channels for notifications."""
    INBOX = "inbox"
    EMAIL = "email"
    WEBHOOK = "webhook"
    PUSH = "push"


class Organization(Base):
    """Organization model for multi-tenant hierarchy (Org → Sites → Users)."""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(20), default="#1a56db")
    secondary_color = Column(String(20), default="#7e22ce")
    billing_email = Column(String(255), nullable=True)
    billing_address = Column(Text, nullable=True)
    tax_id = Column(String(100), nullable=True)
    subscription_plan = Column(String(50), default="starter")
    is_active = Column(Integer, default=1)
    mfa_required = Column(Integer, default=0)
    # Secure status page token (hash of the public token)
    status_page_token_hash = Column(String(64), unique=True, nullable=True, index=True)
    status_page_enabled = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    org_sites = relationship("OrgSite", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    """User model with RBAC support."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    role = Column(Enum(UserRole, values_callable=lambda x: [e.value for e in x]), default=UserRole.VIEWER)
    is_active = Column(Integer, default=1)
    mfa_enabled = Column(Integer, default=0)
    mfa_secret = Column(String(255), nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="users")
    site_permissions = relationship("UserSitePermission", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    notification_preferences = relationship("NotificationPreference", back_populates="user", cascade="all, delete-orphan")


class OrgSite(Base):
    """Links Organizations to Sites (many-to-many with metadata)."""
    __tablename__ = "org_sites"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    is_primary = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="org_sites")


class UserSitePermission(Base):
    """User permissions for specific sites."""
    __tablename__ = "user_site_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    can_view = Column(Integer, default=1)
    can_edit = Column(Integer, default=0)
    can_delete = Column(Integer, default=0)
    can_manage_users = Column(Integer, default=0)
    can_approve = Column(Integer, default=0)
    can_export = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="site_permissions")


class AuditLog(Base):
    """Immutable audit log for tracking all significant changes."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    action = Column(Enum(AuditAction), nullable=False, index=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(Integer, nullable=True, index=True)
    before_state = Column(Text, nullable=True)
    after_state = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    correlation_id = Column(String(100), nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")


class FileAsset(Base):
    """File management with versioning and status tracking."""
    __tablename__ = "file_assets"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    file_name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_type = Column(String(100), nullable=True)
    mime_type = Column(String(100), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    storage_path = Column(String(500), nullable=False)
    storage_provider = Column(String(50), default="local")
    version = Column(Integer, default=1)
    parent_file_id = Column(Integer, ForeignKey("file_assets.id"), nullable=True)
    status = Column(Enum(FileStatus), default=FileStatus.PENDING)
    processing_result = Column(Text, nullable=True)
    checksum = Column(String(100), nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PeriodLock(Base):
    """Period lock for billing/reporting periods - prevents edits to historical data."""
    __tablename__ = "period_locks"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    period_type = Column(String(50), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    status = Column(Enum(PeriodStatus), default=PeriodStatus.OPEN)
    locked_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    unlock_reason = Column(Text, nullable=True)
    snapshot_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationTemplate(Base):
    """Templates for notification messages."""
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    subject_template = Column(String(255), nullable=True)
    body_template = Column(Text, nullable=False)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationPreference(Base):
    """User preferences for notification channels."""
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    notification_type = Column(Enum(NotificationType), nullable=False)
    channel = Column(Enum(NotificationChannel), nullable=False)
    is_enabled = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notification_preferences")


class NotificationDelivery(Base):
    """Tracks delivery status of notifications."""
    __tablename__ = "notification_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("notifications.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    channel = Column(Enum(NotificationChannel), nullable=False)
    status = Column(String(50), default="pending")
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class APIKey(Base):
    """API keys for external API consumers."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    key_hash = Column(String(64), unique=True, nullable=False, index=True)
    key_prefix = Column(String(20), nullable=False)
    permissions = Column(Text, nullable=True)
    rate_limit = Column(Integer, default=1000)
    is_active = Column(Integer, default=1)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization")
