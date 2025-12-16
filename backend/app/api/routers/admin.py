"""Admin/Platform API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import hashlib

from backend.app.core.database import get_db
from backend.app.models import Organization, User, AuditLog, PeriodLock, PeriodStatus
from backend.app.schemas import (
    OrganizationCreate,
    OrganizationResponse,
    UserCreate,
    UserResponse,
    AuditLogResponse,
    PeriodLockCreate,
    PeriodLockResponse,
)

router = APIRouter(prefix="/api/v1", tags=["admin"])


@router.post("/organizations", response_model=OrganizationResponse)
def create_organization(org: OrganizationCreate, db: Session = Depends(get_db)):
    """Create a new organization."""
    db_org = Organization(**org.model_dump())
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    return db_org


@router.get("/organizations", response_model=List[OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)):
    """List all organizations."""
    return db.query(Organization).all()


@router.get("/organizations/{org_id}", response_model=OrganizationResponse)
def get_organization(org_id: int, db: Session = Depends(get_db)):
    """Get organization by ID."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.post("/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user."""
    password_hash = hashlib.sha256(user.password.encode()).hexdigest()
    db_user = User(
        organization_id=user.organization_id,
        email=user.email,
        password_hash=password_hash,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/users", response_model=List[UserResponse])
def list_users(organization_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List users, optionally filtered by organization."""
    query = db.query(User)
    if organization_id:
        query = query.filter(User.organization_id == organization_id)
    return query.all()


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/audit-logs", response_model=List[AuditLogResponse])
def list_audit_logs(
    organization_id: Optional[int] = None,
    site_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List audit logs with optional filters."""
    query = db.query(AuditLog)
    if organization_id:
        query = query.filter(AuditLog.organization_id == organization_id)
    if site_id:
        query = query.filter(AuditLog.site_id == site_id)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    return query.order_by(AuditLog.created_at.desc()).limit(limit).all()


@router.get("/period-locks", response_model=List[PeriodLockResponse])
def list_period_locks(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List period locks."""
    query = db.query(PeriodLock)
    if site_id:
        query = query.filter(PeriodLock.site_id == site_id)
    return query.order_by(PeriodLock.period_start.desc()).all()


@router.post("/period-locks", response_model=PeriodLockResponse)
def create_period_lock(lock: PeriodLockCreate, db: Session = Depends(get_db)):
    """Create a new period lock."""
    db_lock = PeriodLock(**lock.model_dump())
    db.add(db_lock)
    db.commit()
    db.refresh(db_lock)
    return db_lock


@router.post("/period-locks/{lock_id}/lock", response_model=PeriodLockResponse)
def lock_period(lock_id: int, db: Session = Depends(get_db)):
    """Lock a period to prevent edits."""
    lock = db.query(PeriodLock).filter(PeriodLock.id == lock_id).first()
    if not lock:
        raise HTTPException(status_code=404, detail="Period lock not found")
    lock.status = PeriodStatus.LOCKED
    lock.locked_at = datetime.utcnow()
    db.commit()
    db.refresh(lock)
    return lock
