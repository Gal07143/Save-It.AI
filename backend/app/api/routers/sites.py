"""Site API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models import Site, User, UserRole, Meter, Asset
from app.models.telemetry import DeviceAlarm, AlarmStatus
from app.models.devices import Device
from app.models.base import soft_delete_filter, include_deleted_filter
from app.schemas import SiteCreate, SiteUpdate, SiteResponse
from app.middleware.multi_tenant import TenantContext, MultiTenantValidation
from app.api.routers.auth import get_current_user


class SiteStatsResponse(BaseModel):
    """Site statistics response."""
    site_id: int
    meters_count: int
    assets_count: int
    total_load_kw: float
    active_alarms: int

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


@router.get("/{site_id}/stats", response_model=SiteStatsResponse)
def get_site_stats(site_id: int, db: Session = Depends(get_db)):
    """Get statistics for a specific site."""
    # Verify site exists
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    if not MultiTenantValidation.validate_site_access(db, site_id):
        raise HTTPException(status_code=403, detail="Access denied to this site")

    # Count meters
    meters_count = db.query(func.count(Meter.id)).filter(
        Meter.site_id == site_id,
        Meter.is_active == True
    ).scalar() or 0

    # Count assets and sum load
    assets_query = db.query(
        func.count(Asset.id),
        func.coalesce(func.sum(Asset.rated_capacity_kw), 0)
    ).filter(Asset.site_id == site_id)

    assets_result = assets_query.first()
    assets_count = assets_result[0] or 0
    total_load_kw = float(assets_result[1] or 0)

    # Count active alarms (join through Device to get site_id)
    active_alarms = db.query(func.count(DeviceAlarm.id)).join(
        Device, Device.id == DeviceAlarm.device_id
    ).filter(
        Device.site_id == site_id,
        DeviceAlarm.acknowledged_at.is_(None)
    ).scalar() or 0

    return SiteStatsResponse(
        site_id=site_id,
        meters_count=meters_count,
        assets_count=assets_count,
        total_load_kw=total_load_kw,
        active_alarms=active_alarms
    )


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
