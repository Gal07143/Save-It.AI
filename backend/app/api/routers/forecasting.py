"""Forecasting API endpoints."""
from typing import List
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ForecastJob, ForecastSeries
from app.schemas import (
    ForecastRequest,
    ForecastResponse,
    ForecastPointResponse,
)

router = APIRouter(prefix="/api/v1/forecasts", tags=["forecasting"])


@router.post("", response_model=ForecastResponse)
def create_forecast(request: ForecastRequest, db: Session = Depends(get_db)):
    """Create a new forecast job."""
    job = ForecastJob(
        site_id=request.site_id,
        meter_id=request.meter_id,
        forecast_type=request.forecast_type,
        horizon_hours=request.horizon_hours,
        status="completed"
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    
    forecast_data = []
    base_time = datetime.utcnow()
    for i in range(request.horizon_hours):
        predicted = 100 + 50 * (0.5 - abs(12 - (i % 24)) / 12)
        point = ForecastSeries(
            job_id=job.id,
            timestamp=base_time + timedelta(hours=i),
            predicted_value=predicted,
            lower_bound=predicted * 0.9,
            upper_bound=predicted * 1.1,
            confidence=0.85
        )
        db.add(point)
        forecast_data.append(ForecastPointResponse(
            timestamp=point.timestamp,
            predicted_value=point.predicted_value,
            lower_bound=point.lower_bound,
            upper_bound=point.upper_bound,
            confidence=point.confidence
        ))
    
    db.commit()
    
    return ForecastResponse(
        job_id=job.id,
        site_id=request.site_id,
        forecast_type=request.forecast_type,
        horizon_hours=request.horizon_hours,
        status="completed",
        data=forecast_data
    )


@router.get("/{job_id}", response_model=ForecastResponse)
def get_forecast(job_id: int, db: Session = Depends(get_db)):
    """Get forecast results by job ID."""
    job = db.query(ForecastJob).filter(ForecastJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Forecast job not found")
    
    series = db.query(ForecastSeries).filter(ForecastSeries.job_id == job_id).all()
    
    return ForecastResponse(
        job_id=job.id,
        site_id=job.site_id,
        forecast_type=job.forecast_type,
        horizon_hours=job.horizon_hours,
        status=job.status,
        data=[ForecastPointResponse(
            timestamp=s.timestamp,
            predicted_value=s.predicted_value,
            lower_bound=s.lower_bound,
            upper_bound=s.upper_bound,
            confidence=s.confidence
        ) for s in series]
    )
