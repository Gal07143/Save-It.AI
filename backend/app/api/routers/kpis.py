"""
KPI API Router for SAVE-IT.AI
Endpoints for KPI definition, calculation, and querying.
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.kpi_engine import KPIEngine, TimeRange
from app.models.telemetry import KPIDefinition, KPIValue, KPIType

router = APIRouter(prefix="/kpis", tags=["KPIs"])


def get_kpi_engine(request: Request, db: Session = Depends(get_db)) -> KPIEngine:
    """Get KPIEngine from app state or create per-request."""
    if hasattr(request.app.state, "kpi_engine"):
        return request.app.state.kpi_engine
    return KPIEngine(db)


# Request/Response Models
class KPICreateRequest(BaseModel):
    """Create KPI definition."""
    name: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    kpi_type: str  # sum, avg, min, max, count, formula
    source_device_id: Optional[int] = None
    source_datapoint_id: Optional[int] = None
    formula: Optional[str] = None
    formula_variables: Optional[str] = None
    unit: Optional[str] = None
    precision: int = 2
    warning_min: Optional[float] = None
    warning_max: Optional[float] = None
    critical_min: Optional[float] = None
    critical_max: Optional[float] = None
    calculation_interval: str = "hourly"
    site_id: Optional[int] = None


class KPIResponse(BaseModel):
    """KPI definition response."""
    id: int
    name: str
    display_name: Optional[str]
    description: Optional[str]
    kpi_type: str
    source_device_id: Optional[int]
    source_datapoint_id: Optional[int]
    formula: Optional[str]
    unit: Optional[str]
    precision: int
    warning_min: Optional[float]
    warning_max: Optional[float]
    critical_min: Optional[float]
    critical_max: Optional[float]
    calculation_interval: str
    last_calculated_at: Optional[str]
    is_active: bool

    class Config:
        from_attributes = True


class KPIResultResponse(BaseModel):
    """KPI calculation result."""
    kpi_id: int
    kpi_name: str
    value: Optional[float]
    status: str
    period_start: str
    period_end: str
    data_points_used: int
    calculation_time_ms: int
    error_message: Optional[str] = None


class KPIValueResponse(BaseModel):
    """Historical KPI value."""
    period_start: str
    period_end: str
    value: Optional[float]
    status: str
    data_points_used: int


def _kpi_to_response(kpi: KPIDefinition) -> KPIResponse:
    """Convert KPIDefinition model to response."""
    return KPIResponse(
        id=kpi.id,
        name=kpi.name,
        display_name=kpi.display_name,
        description=kpi.description,
        kpi_type=kpi.kpi_type.value if kpi.kpi_type else "unknown",
        source_device_id=kpi.source_device_id,
        source_datapoint_id=kpi.source_datapoint_id,
        formula=kpi.formula,
        unit=kpi.unit,
        precision=kpi.precision or 2,
        warning_min=kpi.warning_min,
        warning_max=kpi.warning_max,
        critical_min=kpi.critical_min,
        critical_max=kpi.critical_max,
        calculation_interval=kpi.calculation_interval or "hourly",
        last_calculated_at=kpi.last_calculated_at.isoformat() if kpi.last_calculated_at else None,
        is_active=bool(kpi.is_active),
    )


# Endpoints
@router.get("", response_model=List[KPIResponse])
@router.get("/", response_model=List[KPIResponse], include_in_schema=False)
def list_kpis(
    site_id: Optional[int] = None,
    device_id: Optional[int] = None,
    active_only: bool = True,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """List KPI definitions with optional filters."""
    query = db.query(KPIDefinition)

    if site_id:
        query = query.filter(KPIDefinition.site_id == site_id)
    if device_id:
        query = query.filter(KPIDefinition.source_device_id == device_id)
    if active_only:
        query = query.filter(KPIDefinition.is_active == 1)

    kpis = query.limit(limit).all()
    return [_kpi_to_response(k) for k in kpis]


@router.post("", response_model=KPIResponse)
@router.post("/", response_model=KPIResponse, include_in_schema=False)
def create_kpi(
    data: KPICreateRequest,
    db: Session = Depends(get_db)
):
    """Create a new KPI definition."""
    try:
        kpi_type = KPIType(data.kpi_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid KPI type: {data.kpi_type}")

    kpi = KPIDefinition(
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        kpi_type=kpi_type,
        source_device_id=data.source_device_id,
        source_datapoint_id=data.source_datapoint_id,
        formula=data.formula,
        formula_variables=data.formula_variables,
        unit=data.unit,
        precision=data.precision,
        warning_min=data.warning_min,
        warning_max=data.warning_max,
        critical_min=data.critical_min,
        critical_max=data.critical_max,
        calculation_interval=data.calculation_interval,
        site_id=data.site_id,
        is_active=1,
    )
    db.add(kpi)
    db.commit()
    db.refresh(kpi)

    return _kpi_to_response(kpi)


@router.get("/{kpi_id}", response_model=KPIResponse)
def get_kpi(kpi_id: int, db: Session = Depends(get_db)):
    """Get a KPI definition by ID."""
    kpi = db.query(KPIDefinition).filter(KPIDefinition.id == kpi_id).first()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    return _kpi_to_response(kpi)


@router.delete("/{kpi_id}")
def delete_kpi(kpi_id: int, db: Session = Depends(get_db)):
    """Delete a KPI definition."""
    kpi = db.query(KPIDefinition).filter(KPIDefinition.id == kpi_id).first()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    db.delete(kpi)
    db.commit()
    return {"deleted": True, "kpi_id": kpi_id}


@router.post("/{kpi_id}/calculate", response_model=KPIResultResponse)
def calculate_kpi(
    kpi_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    engine: KPIEngine = Depends(get_kpi_engine)
):
    """
    Calculate a KPI on demand.

    Defaults to the last hour if no time range specified.
    """
    if not end:
        end = datetime.utcnow()
    if not start:
        start = end - timedelta(hours=1)

    time_range = TimeRange(start=start, end=end)
    result = engine.calculate(kpi_id, time_range)
    db.commit()

    return KPIResultResponse(
        kpi_id=result.kpi_id,
        kpi_name=result.kpi_name,
        value=result.value,
        status=result.status,
        period_start=result.period_start.isoformat(),
        period_end=result.period_end.isoformat(),
        data_points_used=result.data_points_used,
        calculation_time_ms=result.calculation_time_ms,
        error_message=result.error_message,
    )


@router.get("/{kpi_id}/history", response_model=List[KPIValueResponse])
def get_kpi_history(
    kpi_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    engine: KPIEngine = Depends(get_kpi_engine)
):
    """Get historical KPI values."""
    if not end:
        end = datetime.utcnow()
    if not start:
        start = end - timedelta(days=7)

    history = engine.get_kpi_history(kpi_id, start, end, limit)
    return [KPIValueResponse(**h) for h in history]


@router.post("/devices/{device_id}/calculate")
def calculate_device_kpis(
    device_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    engine: KPIEngine = Depends(get_kpi_engine)
):
    """Calculate all KPIs for a device."""
    if not end:
        end = datetime.utcnow()
    if not start:
        start = end - timedelta(hours=1)

    time_range = TimeRange(start=start, end=end)
    results = engine.calculate_device_kpis(device_id, time_range)
    db.commit()

    return {
        name: {
            "kpi_id": r.kpi_id,
            "value": r.value,
            "status": r.status,
            "data_points_used": r.data_points_used,
        }
        for name, r in results.items()
    }


@router.post("/sites/{site_id}/calculate")
def calculate_site_kpis(
    site_id: int,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db: Session = Depends(get_db),
    engine: KPIEngine = Depends(get_kpi_engine)
):
    """Calculate all KPIs for a site."""
    if not end:
        end = datetime.utcnow()
    if not start:
        start = end - timedelta(hours=1)

    time_range = TimeRange(start=start, end=end)
    results = engine.calculate_site_kpis(site_id, time_range)
    db.commit()

    return {
        name: {
            "kpi_id": r.kpi_id,
            "value": r.value,
            "status": r.status,
            "data_points_used": r.data_points_used,
        }
        for name, r in results.items()
    }
