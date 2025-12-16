"""Tariff API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Tariff
from backend.app.schemas import TariffCreate, TariffUpdate, TariffResponse

router = APIRouter(prefix="/api/v1/tariffs", tags=["tariffs"])


@router.get("/", response_model=List[TariffResponse])
def list_tariffs(
    site_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all tariffs, optionally filtered by site."""
    query = db.query(Tariff)
    if site_id:
        query = query.filter(Tariff.site_id == site_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{tariff_id}", response_model=TariffResponse)
def get_tariff(tariff_id: int, db: Session = Depends(get_db)):
    """Get tariff by ID."""
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    return tariff


@router.post("/", response_model=TariffResponse)
def create_tariff(tariff: TariffCreate, db: Session = Depends(get_db)):
    """Create a new tariff schedule."""
    tariff_data = tariff.model_dump()
    db_tariff = Tariff(**{k: v for k, v in tariff_data.items() if hasattr(Tariff, k)})
    db.add(db_tariff)
    db.commit()
    db.refresh(db_tariff)
    return db_tariff


@router.put("/{tariff_id}", response_model=TariffResponse)
def update_tariff(tariff_id: int, tariff_update: TariffCreate, db: Session = Depends(get_db)):
    """Update an existing tariff."""
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    for key, value in tariff_update.model_dump().items():
        setattr(tariff, key, value)
    
    db.commit()
    db.refresh(tariff)
    return tariff


@router.delete("/{tariff_id}")
def delete_tariff(tariff_id: int, db: Session = Depends(get_db)):
    """Delete a tariff."""
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    db.delete(tariff)
    db.commit()
    return {"message": "Tariff deleted successfully"}
