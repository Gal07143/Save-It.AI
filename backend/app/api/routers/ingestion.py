"""Data Ingestion API endpoints."""
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import pandas as pd
import io

from backend.app.core.database import get_db
from backend.app.models import Meter, MeterReading

router = APIRouter(prefix="/api/v1/ingestion", tags=["ingestion"])


@router.post("/meter-readings/csv")
async def upload_meter_readings_csv(
    file: UploadFile = File(...),
    meter_id: int = Form(...),
    timestamp_column: str = Form("timestamp"),
    energy_column: str = Form("energy_kwh"),
    power_column: Optional[str] = Form(None),
    date_format: str = Form("%Y-%m-%d %H:%M:%S"),
    db: Session = Depends(get_db)
):
    """Upload CSV file with meter readings."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        if timestamp_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{timestamp_column}' not found in CSV")
        if energy_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{energy_column}' not found in CSV")
        
        df[timestamp_column] = pd.to_datetime(df[timestamp_column], format=date_format, errors='coerce')
        df = df.dropna(subset=[timestamp_column, energy_column])
        
        readings = []
        for _, row in df.iterrows():
            reading = MeterReading(
                meter_id=meter_id,
                timestamp=row[timestamp_column],
                energy_kwh=float(row[energy_column]),
                power_kw=float(row[power_column]) if power_column and power_column in df.columns else None,
            )
            readings.append(reading)
        
        db.bulk_save_objects(readings)
        db.commit()
        
        return {
            "message": "Upload successful",
            "records_imported": len(readings),
            "meter_id": meter_id,
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")


@router.post("/meter-readings/json")
def upload_meter_readings_json(
    readings_data: List[Dict[str, Any]],
    meter_id: int,
    db: Session = Depends(get_db)
):
    """Upload meter readings as JSON."""
    meter = db.query(Meter).filter(Meter.id == meter_id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    readings = []
    for data in readings_data:
        reading = MeterReading(
            meter_id=meter_id,
            timestamp=datetime.fromisoformat(data["timestamp"]) if isinstance(data["timestamp"], str) else data["timestamp"],
            energy_kwh=float(data["energy_kwh"]),
            power_kw=float(data.get("power_kw")) if data.get("power_kw") else None,
            voltage=float(data.get("voltage")) if data.get("voltage") else None,
            current=float(data.get("current")) if data.get("current") else None,
            power_factor=float(data.get("power_factor")) if data.get("power_factor") else None,
        )
        readings.append(reading)
    
    db.bulk_save_objects(readings)
    db.commit()
    
    return {
        "message": "Upload successful",
        "records_imported": len(readings),
        "meter_id": meter_id,
    }
