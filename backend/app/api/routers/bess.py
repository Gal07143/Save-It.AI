"""BESS (Battery Energy Storage System) API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import pandas as pd
import io

from app.core.database import get_db
from app.models import BESSVendor, BESSModel, BESSDataset, BESSDataReading
from app.schemas import (
    BESSVendorResponse,
    BESSModelResponse,
    BESSDatasetCreate,
    BESSDatasetResponse,
    BESSRecommendationRequest,
    BESSRecommendation,
)

router = APIRouter(prefix="/api/v1/bess", tags=["bess-catalog"])


@router.get("/vendors", response_model=List[BESSVendorResponse])
def list_bess_vendors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all BESS vendors in the catalog."""
    return db.query(BESSVendor).filter(BESSVendor.is_active == 1).offset(skip).limit(limit).all()


@router.get("/vendors/{vendor_id}", response_model=BESSVendorResponse)
def get_bess_vendor(vendor_id: int, db: Session = Depends(get_db)):
    """Get a specific BESS vendor by ID."""
    vendor = db.query(BESSVendor).filter(BESSVendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor


@router.get("/models", response_model=List[BESSModelResponse])
def list_bess_models(
    vendor_id: Optional[int] = None,
    chemistry: Optional[str] = None,
    min_capacity_kwh: Optional[float] = None,
    max_capacity_kwh: Optional[float] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all BESS models with optional filters."""
    query = db.query(BESSModel).filter(BESSModel.is_active == 1)
    if vendor_id:
        query = query.filter(BESSModel.vendor_id == vendor_id)
    if chemistry:
        query = query.filter(BESSModel.chemistry == chemistry)
    if min_capacity_kwh:
        query = query.filter(BESSModel.capacity_kwh >= min_capacity_kwh)
    if max_capacity_kwh:
        query = query.filter(BESSModel.capacity_kwh <= max_capacity_kwh)
    return query.offset(skip).limit(limit).all()


@router.get("/models/{model_id}", response_model=BESSModelResponse)
def get_bess_model(model_id: int, db: Session = Depends(get_db)):
    """Get a specific BESS model by ID."""
    model = db.query(BESSModel).filter(BESSModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.post("/datasets", response_model=BESSDatasetResponse)
def create_bess_dataset(dataset: BESSDatasetCreate, db: Session = Depends(get_db)):
    """Create a new BESS dataset for interval data upload."""
    db_dataset = BESSDataset(**dataset.model_dump())
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    return db_dataset


@router.get("/datasets", response_model=List[BESSDatasetResponse])
def list_bess_datasets(
    site_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all BESS datasets for a site."""
    query = db.query(BESSDataset)
    if site_id:
        query = query.filter(BESSDataset.site_id == site_id)
    return query.order_by(BESSDataset.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/datasets/{dataset_id}", response_model=BESSDatasetResponse)
def get_bess_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Get a specific BESS dataset by ID."""
    dataset = db.query(BESSDataset).filter(BESSDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.post("/datasets/{dataset_id}/upload-csv")
async def upload_bess_csv(
    dataset_id: int,
    file: UploadFile = File(...),
    timestamp_column: str = Form("timestamp"),
    demand_column: str = Form("demand_kw"),
    date_format: str = Form("%Y-%m-%d %H:%M:%S"),
    db: Session = Depends(get_db)
):
    """Upload CSV file with interval meter readings for BESS simulation."""
    dataset = db.query(BESSDataset).filter(BESSDataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        if timestamp_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{timestamp_column}' not found in CSV")
        if demand_column not in df.columns:
            raise HTTPException(status_code=400, detail=f"Column '{demand_column}' not found in CSV")
        
        df[timestamp_column] = pd.to_datetime(df[timestamp_column], format=date_format, errors='coerce')
        df = df.dropna(subset=[timestamp_column, demand_column])
        
        db.query(BESSDataReading).filter(BESSDataReading.dataset_id == dataset_id).delete()
        
        readings = []
        for _, row in df.iterrows():
            reading = BESSDataReading(
                dataset_id=dataset_id,
                timestamp=row[timestamp_column],
                demand_kw=float(row[demand_column]),
            )
            readings.append(reading)
        
        db.bulk_save_objects(readings)
        
        dataset.total_records = len(readings)
        dataset.file_name = file.filename
        dataset.upload_status = "completed"
        
        if readings:
            demands = [r.demand_kw for r in readings]
            dataset.peak_demand_kw = max(demands)
            dataset.avg_demand_kw = sum(demands) / len(demands)
            dataset.total_consumption_kwh = sum(demands) * (dataset.interval_minutes / 60)
            
            timestamps = [r.timestamp for r in readings]
            dataset.start_date = min(timestamps).date()
            dataset.end_date = max(timestamps).date()
        
        db.commit()
        db.refresh(dataset)
        
        return {
            "message": "Upload successful",
            "records_imported": len(readings),
            "dataset_id": dataset_id,
            "peak_demand_kw": dataset.peak_demand_kw,
            "avg_demand_kw": dataset.avg_demand_kw,
        }
        
    except Exception as e:
        dataset.upload_status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail=f"Failed to process CSV: {str(e)}")


@router.post("/recommendations", response_model=List[BESSRecommendation])
def get_bess_recommendations(request: BESSRecommendationRequest, db: Session = Depends(get_db)):
    """Get BESS model recommendations based on site requirements."""
    query = db.query(BESSModel).filter(BESSModel.is_active == 1)
    
    if request.preferred_chemistry:
        query = query.filter(BESSModel.chemistry == request.preferred_chemistry)
    
    if request.budget_max:
        query = query.filter(BESSModel.price_usd <= request.budget_max)
    
    models = query.all()
    recommendations = []
    
    base_savings_per_kwh = 150
    
    for model in models[:5]:
        vendor = db.query(BESSVendor).filter(BESSVendor.id == model.vendor_id).first()
        
        annual_savings = model.capacity_kwh * base_savings_per_kwh * model.round_trip_efficiency
        price = model.price_usd or (model.capacity_kwh * 400)
        payback = price / annual_savings if annual_savings > 0 else 99
        
        fit_score = min(100, max(0, 100 - (payback * 5)))
        
        recommendations.append(BESSRecommendation(
            model_id=model.id,
            vendor_name=vendor.name if vendor else "Unknown",
            model_name=model.model_name,
            capacity_kwh=model.capacity_kwh,
            power_rating_kw=model.power_rating_kw,
            estimated_price=price,
            estimated_annual_savings=annual_savings,
            estimated_payback_years=payback,
            fit_score=fit_score,
            reasoning=f"Based on {model.chemistry} chemistry with {model.cycle_life} cycle life and {model.warranty_years}-year warranty."
        ))
    
    return sorted(recommendations, key=lambda x: x.fit_score, reverse=True)
