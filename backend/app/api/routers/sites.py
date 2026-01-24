"""Site API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Site, User, UserRole
from backend.app.models.base import soft_delete_filter, include_deleted_filter
from backend.app.schemas import SiteCreate, SiteUpdate, SiteResponse
from backend.app.middleware.multi_tenant import TenantContext, MultiTenantValidation
from backend.app.api.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/sites", tags=["sites"])


@router.get("", response_model=List[SiteResponse])
def list_sites(
    skip: int = 0, 
    limit: int = 100, 
    include_deleted: bool = Query(False, description="Include soft-deleted sites"),
    db: Session = Depends(get_db)
):
    """Get all sites (excluding soft-deleted unless requested)."""
    query = db.query(Site)
    query = include_deleted_filter(query, Site, include_deleted)
    
    accessible_sites = MultiTenantValidation.get_accessible_site_ids(db)
    if accessible_sites and not TenantContext.is_super_admin():
        query = query.filter(Site.id.in_(accessible_sites))
    
    sites = query.offset(skip).limit(limit).all()
    return sites


@router.get("/{site_id}", response_model=SiteResponse)
def get_site(site_id: int, db: Session = Depends(get_db)):
    """Get a specific site by ID."""
    query = db.query(Site).filter(Site.id == site_id)
    query = soft_delete_filter(query, Site)
    site = query.first()
    
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    if not MultiTenantValidation.validate_site_access(db, site_id):
        raise HTTPException(status_code=403, detail="Access denied to this site")
    
    return site


@router.post("", response_model=SiteResponse)
def create_site(
    site: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new site."""
    db_site = Site(**site.model_dump())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


@router.put("/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: int,
    site: SiteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a site. Users can only update sites they have access to."""
    db_site = db.query(Site).filter(Site.id == site_id).first()
    if not db_site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Validate user has access to this site
    if not MultiTenantValidation.validate_site_access(db, site_id):
        raise HTTPException(status_code=403, detail="Access denied to this site")

    # Prevent changing organization_id unless super admin
    update_data = site.model_dump(exclude_unset=True)
    if 'organization_id' in update_data and current_user.role != UserRole.SUPER_ADMIN:
        if update_data['organization_id'] != db_site.organization_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot transfer site to another organization"
            )

    for field, value in update_data.items():
        setattr(db_site, field, value)

    db.commit()
    db.refresh(db_site)
    return db_site


@router.delete("/{site_id}")
def delete_site(
    site_id: int, 
    hard_delete: bool = Query(False, description="Permanently delete instead of soft delete"),
    db: Session = Depends(get_db)
):
    """Delete a site (soft delete by default, hard delete with parameter)."""
    query = db.query(Site).filter(Site.id == site_id)
    query = soft_delete_filter(query, Site)
    db_site = query.first()
    
    if not db_site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    if not MultiTenantValidation.validate_site_access(db, site_id):
        raise HTTPException(status_code=403, detail="Access denied to this site")
    
    if hard_delete:
        db.delete(db_site)
    else:
        db_site.soft_delete()
    
    db.commit()
    return {"message": "Site deleted successfully", "soft_delete": not hard_delete}


@router.post("/{site_id}/restore")
def restore_site(site_id: int, db: Session = Depends(get_db)):
    """Restore a soft-deleted site."""
    db_site = db.query(Site).filter(Site.id == site_id, Site.is_deleted == 1).first()
    
    if not db_site:
        raise HTTPException(status_code=404, detail="Deleted site not found")
    
    if not MultiTenantValidation.validate_site_access(db, site_id):
        raise HTTPException(status_code=403, detail="Access denied to this site")
    
    db_site.restore()
    db.commit()
    db.refresh(db_site)
    
    return {"message": "Site restored successfully", "site": db_site}
