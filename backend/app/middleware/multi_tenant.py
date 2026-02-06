"""Multi-tenancy middleware for organization-scoped data access."""
import logging
from contextvars import ContextVar
from typing import Optional, Callable
from functools import wraps

from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import get_db

logger = logging.getLogger(__name__)

_tenant_org_id: ContextVar[Optional[int]] = ContextVar('tenant_org_id', default=None)
_tenant_user_id: ContextVar[Optional[int]] = ContextVar('tenant_user_id', default=None)
_tenant_is_super_admin: ContextVar[bool] = ContextVar('tenant_is_super_admin', default=False)


class TenantContext:
    """Request-scoped tenant context using contextvars for thread-safety."""
    
    @classmethod
    def set(cls, organization_id: Optional[int], user_id: Optional[int] = None, is_super_admin: bool = False):
        """Set the current tenant context (request-scoped)."""
        _tenant_org_id.set(organization_id)
        _tenant_user_id.set(user_id)
        _tenant_is_super_admin.set(is_super_admin)
    
    @classmethod
    def get_organization_id(cls) -> Optional[int]:
        """Get the current organization ID."""
        return _tenant_org_id.get()
    
    @classmethod
    def get_user_id(cls) -> Optional[int]:
        """Get the current user ID."""
        return _tenant_user_id.get()
    
    @classmethod
    def is_super_admin(cls) -> bool:
        """Check if current user is super admin."""
        return _tenant_is_super_admin.get()
    
    @classmethod
    def clear(cls):
        """Clear the tenant context."""
        _tenant_org_id.set(None)
        _tenant_user_id.set(None)
        _tenant_is_super_admin.set(False)


class MultiTenantMiddleware(BaseHTTPMiddleware):
    """Middleware to set tenant context from authenticated user."""
    
    async def dispatch(self, request: Request, call_next):
        TenantContext.clear()
        
        user = getattr(request.state, 'user', None)
        if user:
            from app.models.platform import UserRole
            is_super = user.role == UserRole.SUPER_ADMIN if hasattr(user, 'role') else False
            TenantContext.set(
                organization_id=getattr(user, 'organization_id', None),
                user_id=getattr(user, 'id', None),
                is_super_admin=is_super
            )
        
        try:
            response = await call_next(request)
            return response
        finally:
            TenantContext.clear()


def require_organization(func: Callable) -> Callable:
    """Decorator to enforce organization context on endpoints."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        org_id = TenantContext.get_organization_id()
        if org_id is None and not TenantContext.is_super_admin():
            raise HTTPException(
                status_code=403,
                detail="Organization context required for this operation"
            )
        return func(*args, **kwargs)
    return wrapper


def tenant_filter(query, model_class, allow_super_admin: bool = True):
    """Apply tenant filter to a query.
    
    Args:
        query: SQLAlchemy query object
        model_class: Model class with organization_id column
        allow_super_admin: If True, super admins can see all organizations
        
    Returns:
        Filtered query scoped to current organization
    """
    org_id = TenantContext.get_organization_id()
    
    if allow_super_admin and TenantContext.is_super_admin():
        return query
    
    if org_id is None:
        return query
    
    if hasattr(model_class, 'organization_id'):
        return query.filter(model_class.organization_id == org_id)
    
    return query


def validate_organization_access(organization_id: int) -> bool:
    """Validate that the current user can access the given organization.
    
    Args:
        organization_id: Organization ID to validate access for
        
    Returns:
        True if access is allowed, False otherwise
    """
    if TenantContext.is_super_admin():
        return True
    
    current_org = TenantContext.get_organization_id()
    return current_org == organization_id


def get_organization_sites(db: Session, organization_id: int) -> list:
    """Get all site IDs belonging to an organization.
    
    Args:
        db: Database session
        organization_id: Organization ID
        
    Returns:
        List of site IDs
    """
    from app.models.platform import OrgSite
    
    org_sites = db.query(OrgSite).filter(OrgSite.organization_id == organization_id).all()
    return [os.site_id for os in org_sites]


def site_belongs_to_organization(db: Session, site_id: int, organization_id: int) -> bool:
    """Check if a site belongs to the given organization.
    
    Args:
        db: Database session
        site_id: Site ID to check
        organization_id: Organization ID to validate against
        
    Returns:
        True if site belongs to organization
    """
    from app.models.platform import OrgSite
    
    exists = db.query(OrgSite).filter(
        OrgSite.site_id == site_id,
        OrgSite.organization_id == organization_id
    ).first()
    
    return exists is not None


class MultiTenantValidation:
    """Validation helpers for multi-tenant operations."""
    
    @staticmethod
    def validate_site_access(db: Session, site_id: int) -> bool:
        """Validate current user can access the given site."""
        org_id = TenantContext.get_organization_id()
        
        if TenantContext.is_super_admin():
            return True
        
        if org_id is None:
            return False
        
        return site_belongs_to_organization(db, site_id, org_id)
    
    @staticmethod
    def validate_meter_access(db: Session, meter_id: int) -> bool:
        """Validate current user can access the given meter."""
        from app.models import Meter
        
        meter = db.query(Meter).filter(Meter.id == meter_id).first()
        if not meter:
            return False
        
        return MultiTenantValidation.validate_site_access(db, meter.site_id)
    
    @staticmethod
    def get_accessible_site_ids(db: Session) -> list:
        """Get list of site IDs accessible to current user."""
        org_id = TenantContext.get_organization_id()
        
        if TenantContext.is_super_admin():
            from app.models import Site
            sites = db.query(Site).all()
            return [s.id for s in sites]
        
        if org_id is None:
            return []
        
        return get_organization_sites(db, org_id)
