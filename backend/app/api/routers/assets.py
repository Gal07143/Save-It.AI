"""Asset API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Asset
from backend.app.schemas import AssetCreate, AssetUpdate, AssetResponse, AssetTreeNode

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


@router.get("", response_model=List[AssetResponse])
def list_assets(
    site_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all assets, optionally filtered by site."""
    query = db.query(Asset)
    if site_id:
        query = query.filter(Asset.site_id == site_id)
    assets = query.offset(skip).limit(limit).all()
    return assets


@router.get("/tree/{site_id}", response_model=List[AssetTreeNode])
def get_asset_tree(site_id: int, db: Session = Depends(get_db)):
    """Get the asset hierarchy tree for a site (SLD view)."""
    assets = db.query(Asset).filter(Asset.site_id == site_id).all()
    
    def build_tree(parent_id: Optional[int] = None) -> List[AssetTreeNode]:
        children = [a for a in assets if a.parent_id == parent_id]
        return [
            AssetTreeNode(
                id=asset.id,
                name=asset.name,
                asset_type=asset.asset_type,
                has_meter=asset.meter is not None,
                meter_id=asset.meter.meter_id if asset.meter else None,
                children=build_tree(asset.id)
            )
            for asset in children
        ]
    
    return build_tree(None)


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    """Get a specific asset by ID."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("", response_model=AssetResponse)
def create_asset(asset: AssetCreate, db: Session = Depends(get_db)):
    """Create a new asset."""
    db_asset = Asset(
        site_id=asset.site_id,
        parent_id=asset.parent_id,
        name=asset.name,
        asset_type=asset.asset_type,
        description=asset.description,
        rated_capacity_kw=asset.rated_capacity_kw,
        rated_voltage=asset.rated_voltage,
        rated_current=asset.rated_current,
        is_critical=1 if asset.is_critical else 0,
        requires_metering=1 if asset.requires_metering else 0
    )
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: int, asset: AssetUpdate, db: Session = Depends(get_db)):
    """Update an asset."""
    db_asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    update_data = asset.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ['is_critical', 'requires_metering'] and isinstance(value, bool):
            value = 1 if value else 0
        setattr(db_asset, field, value)
    
    db.commit()
    db.refresh(db_asset)
    return db_asset


@router.delete("/{asset_id}")
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    """Delete an asset."""
    db_asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    db.delete(db_asset)
    db.commit()
    return {"message": "Asset deleted successfully"}
