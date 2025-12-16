"""Site API endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Site
from backend.app.schemas import SiteCreate, SiteUpdate, SiteResponse

router = APIRouter(prefix="/api/v1/sites", tags=["sites"])


@router.get("/", response_model=List[SiteResponse])
def list_sites(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all sites."""
    sites = db.query(Site).offset(skip).limit(limit).all()
    return sites


@router.get("/{site_id}", response_model=SiteResponse)
def get_site(site_id: int, db: Session = Depends(get_db)):
    """Get a specific site by ID."""
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.post("/", response_model=SiteResponse)
def create_site(site: SiteCreate, db: Session = Depends(get_db)):
    """Create a new site."""
    db_site = Site(**site.model_dump())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


@router.put("/{site_id}", response_model=SiteResponse)
def update_site(site_id: int, site: SiteUpdate, db: Session = Depends(get_db)):
    """Update a site."""
    db_site = db.query(Site).filter(Site.id == site_id).first()
    if not db_site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    update_data = site.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_site, field, value)
    
    db.commit()
    db.refresh(db_site)
    return db_site


@router.delete("/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db)):
    """Delete a site."""
    db_site = db.query(Site).filter(Site.id == site_id).first()
    if not db_site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    db.delete(db_site)
    db.commit()
    return {"message": "Site deleted successfully"}
