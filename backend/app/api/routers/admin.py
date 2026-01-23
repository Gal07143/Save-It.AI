"""Admin/Platform API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Organization, User, AuditLog, PeriodLock, PeriodStatus, UserRole
from backend.app.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    UserCreate,
    UserResponse,
    AuditLogResponse,
    PeriodLockCreate,
    PeriodLockResponse,
)
from backend.app.api.routers.auth import get_current_user, get_password_hash

router = APIRouter(prefix="/api/v1", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for endpoint access."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require super admin role for critical operations."""
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return current_user


@router.post("/organizations", response_model=OrganizationResponse)
def create_organization(
    org: OrganizationCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    """Create a new organization. Requires super admin access."""
    db_org = Organization(**org.model_dump())
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    return db_org


@router.get("/organizations", response_model=List[OrganizationResponse])
def list_organizations(
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    """List all organizations. Requires super admin access."""
    return db.query(Organization).all()


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
def get_organization(
    org_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get organization by ID. Admins can only view their own organization."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Non-super admins can only view their own organization
    if current_user.role != UserRole.SUPER_ADMIN and current_user.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Access denied to this organization")

    return org


@router.post("/users", response_model=UserResponse)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new user. Requires admin access."""
    # Check for existing user with same email
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Non-super admins can only create users in their own organization
    if current_user.role != UserRole.SUPER_ADMIN:
        if user.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Cannot create users in other organizations")
        # Org admins cannot create super admins
        if user.role == UserRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Only super admins can create super admin users")

    # Use bcrypt for password hashing (from auth module)
    password_hash = get_password_hash(user.password)
    db_user = User(
        organization_id=user.organization_id,
        email=user.email,
        password_hash=password_hash,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        role=user.role,
        is_active=1
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/users", response_model=List[UserResponse])
def list_users(
    organization_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List users, optionally filtered by organization. Requires admin access."""
    query = db.query(User)

    # Non-super admins can only see users in their own organization
    if current_user.role != UserRole.SUPER_ADMIN:
        query = query.filter(User.organization_id == current_user.organization_id)
    elif organization_id:
        query = query.filter(User.organization_id == organization_id)

    return query.offset(skip).limit(limit).all()


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get user by ID. Requires admin access."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Non-super admins can only view users in their own organization
    if current_user.role != UserRole.SUPER_ADMIN and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied to this user")

    return user


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    organization_id: Optional[int] = None,
    site_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List audit logs with optional filters. Requires admin access."""
    query = db.query(AuditLog)

    # Non-super admins can only see audit logs for their own organization
    if current_user.role != UserRole.SUPER_ADMIN:
        query = query.filter(AuditLog.organization_id == current_user.organization_id)
    elif organization_id:
        query = query.filter(AuditLog.organization_id == organization_id)

    if site_id:
        query = query.filter(AuditLog.site_id == site_id)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/period-locks", response_model=List[PeriodLockResponse])
def list_period_locks(
    site_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List period locks. Requires admin access."""
    query = db.query(PeriodLock)
    if site_id:
        query = query.filter(PeriodLock.site_id == site_id)
    return query.order_by(PeriodLock.period_start.desc()).offset(skip).limit(limit).all()


@router.post("/period-locks", response_model=PeriodLockResponse)
def create_period_lock(
    lock: PeriodLockCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Create a new period lock. Requires admin access."""
    db_lock = PeriodLock(**lock.model_dump())
    db.add(db_lock)
    db.commit()
    db.refresh(db_lock)
    return db_lock


@router.post("/period-locks/{lock_id}/lock", response_model=PeriodLockResponse)
def lock_period(
    lock_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Lock a period to prevent edits. Requires admin access."""
    lock = db.query(PeriodLock).filter(PeriodLock.id == lock_id).first()
    if not lock:
        raise HTTPException(status_code=404, detail="Period lock not found")
    lock.status = PeriodStatus.LOCKED
    lock.locked_at = datetime.utcnow()
    db.commit()
    db.refresh(lock)
    return lock


@router.post("/reset-demo-data")
def reset_demo_data_endpoint(
    db: Session = Depends(get_db),
    admin: User = Depends(require_super_admin)
):
    """
    Reset all demo/instance data while preserving system templates.

    This clears sites, meters, gateways, devices, readings, bills, tenants,
    and other instance data. System templates, catalogs, and policies are preserved.

    WARNING: This action cannot be undone. Requires super admin access.
    """
    from backend.app.services.reset_demo_data import reset_demo_data

    result = reset_demo_data(db)

    if result["success"]:
        audit_log = AuditLog(
            action="reset_demo_data",
            entity_type="system",
            entity_id=0,
            user_id=admin.id,
            organization_id=admin.organization_id,
            details=f"Deleted records: {result.get('deleted_counts', {})}"
        )
        db.add(audit_log)
        db.commit()

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["message"])

    return result
