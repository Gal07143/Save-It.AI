"""Meter API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Meter, MeterReading, User, UserRole, Site
from app.models.base import soft_delete_filter, include_deleted_filter
from app.schemas import (
    MeterCreate, MeterUpdate, MeterResponse,
    MeterReadingCreate, MeterReadingResponse
)
from app.middleware.multi_tenant import TenantContext, MultiTenantValidation
from app.api.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/meters", tags=["meters"])


@router.get("", response_model=List[MeterResponse])
def list_meters(
    site_id: Optional[int] = None,
    active_only: bool = True,
    include_deleted: bool = Query(False, description="Include soft-deleted meters"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all meters, optionally filtered by site (excludes soft-deleted by default)."""
    query = db.query(Meter)
    query = include_deleted_filter(query, Meter, include_deleted)
    
    if site_id:
        if not MultiTenantValidation.validate_site_access(db, site_id):
            raise HTTPException(status_code=403, detail="Access denied to this site")
        query = query.filter(Meter.site_id == site_id)
    else:
        accessible_sites = MultiTenantValidation.get_accessible_site_ids(db)
        if accessible_sites and not TenantContext.is_super_admin():
            query = query.filter(Meter.site_id.in_(accessible_sites))
    
    if active_only:
        query = query.filter(Meter.is_active == 1)
    
    meters = query.offset(skip).limit(limit).all()
    return meters


@router.get("/{meter_id}", response_model=MeterResponse)
def get_meter(meter_id: int, db: Session = Depends(get_db)):
    """Get a specific meter by ID."""
    query = db.query(Meter).filter(Meter.id == meter_id)
    query = soft_delete_filter(query, Meter)
    meter = query.first()
    
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    if not MultiTenantValidation.validate_meter_access(db, meter_id):
        raise HTTPException(status_code=403, detail="Access denied to this meter")
    
    return meter


@router.post("", response_model=MeterResponse)
def create_meter(
    meter: MeterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new meter. Users can only create meters for sites they have access to."""
    # Validate user has access to the parent site
    if not MultiTenantValidation.validate_site_access(db, meter.site_id):
        raise HTTPException(status_code=403, detail="Access denied to this site")

    existing = db.query(Meter).filter(Meter.meter_id == meter.meter_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Meter ID already exists")

    db_meter = Meter(
        site_id=meter.site_id,
        asset_id=meter.asset_id,
        data_source_id=meter.data_source_id,
        meter_id=meter.meter_id,
        name=meter.name,
        description=meter.description,
        manufacturer=meter.manufacturer,
        model=meter.model,
        serial_number=meter.serial_number,
        is_active=1 if meter.is_active else 0,
        is_bidirectional=1 if meter.is_bidirectional else 0
    )
    db.add(db_meter)
    db.commit()
    db.refresh(db_meter)
    return db_meter


@router.put("/{meter_id}", response_model=MeterResponse)
def update_meter(
    meter_id: int,
    meter: MeterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a meter. Users can only update meters they have access to."""
    db_meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not db_meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    # Validate user has access to this meter
    if not MultiTenantValidation.validate_meter_access(db, meter_id):
        raise HTTPException(status_code=403, detail="Access denied to this meter")

    # If changing site_id, validate access to the new site
    update_data = meter.model_dump(exclude_unset=True)
    if 'site_id' in update_data and update_data['site_id'] != db_meter.site_id:
        if not MultiTenantValidation.validate_site_access(db, update_data['site_id']):
            raise HTTPException(status_code=403, detail="Access denied to the target site")

    for field, value in update_data.items():
        if field in ['is_active', 'is_bidirectional'] and isinstance(value, bool):
            value = 1 if value else 0
        setattr(db_meter, field, value)

    db.commit()
    db.refresh(db_meter)
    return db_meter


@router.delete("/{meter_id}")
def delete_meter(
    meter_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a meter. Users can only delete meters they have access to."""
    db_meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not db_meter:
        raise HTTPException(status_code=404, detail="Meter not found")

    # Validate user has access to this meter
    if not MultiTenantValidation.validate_meter_access(db, meter_id):
        raise HTTPException(status_code=403, detail="Access denied to this meter")

    db.delete(db_meter)
    db.commit()
    return {"message": "Meter deleted successfully"}


@router.get("/{meter_id}/readings", response_model=List[MeterReadingResponse])
def get_meter_readings(
    meter_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db)
):
    """Get readings for a specific meter."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    query = db.query(MeterReading).filter(MeterReading.meter_id == meter_id)
    if start_time:
        query = query.filter(MeterReading.timestamp >= start_time)
    if end_time:
        query = query.filter(MeterReading.timestamp <= end_time)
    
    readings = query.order_by(MeterReading.timestamp.desc()).limit(limit).all()
    return readings


@router.post("/readings", response_model=MeterReadingResponse)
def create_meter_reading(reading: MeterReadingCreate, db: Session = Depends(get_db)):
    """Create a new meter reading."""
    meter = db.query(Meter).filter(Meter.id == reading.meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    db_reading = MeterReading(**reading.model_dump())
    db.add(db_reading)
    db.commit()
    db.refresh(db_reading)
    return db_reading


@router.post("/readings/batch", response_model=List[MeterReadingResponse])
def create_batch_readings(
    readings: List[MeterReadingCreate],
    db: Session = Depends(get_db)
):
    """Create multiple meter readings in batch."""
    db_readings = []
    for reading in readings:
        db_reading = MeterReading(**reading.model_dump())
        db.add(db_reading)
        db_readings.append(db_reading)
    
    db.commit()
    for r in db_readings:
        db.refresh(r)
    return db_readings
