"""Meter API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Meter, MeterReading
from backend.app.schemas import (
    MeterCreate, MeterUpdate, MeterResponse,
    MeterReadingCreate, MeterReadingResponse
)

router = APIRouter(prefix="/api/v1/meters", tags=["meters"])


@router.get("/", response_model=List[MeterResponse])
def list_meters(
    site_id: Optional[int] = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all meters, optionally filtered by site."""
    query = db.query(Meter)
    if site_id:
        query = query.filter(Meter.site_id == site_id)
    if active_only:
        query = query.filter(Meter.is_active == 1)
    meters = query.offset(skip).limit(limit).all()
    return meters


@router.get("/{meter_id}", response_model=MeterResponse)
def get_meter(meter_id: int, db: Session = Depends(get_db)):
    """Get a specific meter by ID."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    return meter


@router.post("/", response_model=MeterResponse)
def create_meter(meter: MeterCreate, db: Session = Depends(get_db)):
    """Create a new meter."""
    existing = db.query(Meter).filter(Meter.meter_id == meter.meter_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Meter ID already exists")
    
    db_meter = Meter(
        site_id=meter.site_id,
        asset_id=meter.asset_id,
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
def update_meter(meter_id: int, meter: MeterUpdate, db: Session = Depends(get_db)):
    """Update a meter."""
    db_meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not db_meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    update_data = meter.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ['is_active', 'is_bidirectional'] and isinstance(value, bool):
            value = 1 if value else 0
        setattr(db_meter, field, value)
    
    db.commit()
    db.refresh(db_meter)
    return db_meter


@router.delete("/{meter_id}")
def delete_meter(meter_id: int, db: Session = Depends(get_db)):
    """Delete a meter."""
    db_meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not db_meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    db.delete(db_meter)
    db.commit()
    return {"message": "Meter deleted successfully"}


@router.get("/{meter_id}/readings", response_model=List[MeterReadingResponse])
def get_meter_readings(
    meter_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    limit: int = 1000,
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
