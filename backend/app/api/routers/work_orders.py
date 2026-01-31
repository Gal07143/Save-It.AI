"""
Work Orders API Router for SAVE-IT.AI
Endpoints for maintenance work order management.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.maintenance_service import (
    MaintenanceService,
    MaintenanceType,
    MaintenancePriority,
    get_maintenance_service,
)

router = APIRouter(prefix="/work-orders", tags=["work-orders"])


class ScheduleCreate(BaseModel):
    """Create maintenance schedule request."""
    name: str
    description: Optional[str] = None
    device_id: Optional[int] = None
    site_id: Optional[int] = None
    frequency_days: Optional[int] = None
    frequency_hours: Optional[float] = None
    tasks: Optional[List[str]] = None
    estimated_duration_minutes: int = 60
    advance_notice_days: int = 7


class ScheduleResponse(BaseModel):
    """Maintenance schedule response."""
    id: int
    name: str
    description: Optional[str]
    device_id: Optional[int]
    site_id: Optional[int]
    frequency_days: Optional[int]
    is_active: bool
    last_completed_at: Optional[datetime]
    next_due_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class WorkOrderCreate(BaseModel):
    """Create work order request."""
    title: str
    description: Optional[str] = None
    maintenance_type: str = "preventive"
    priority: str = "medium"
    device_id: Optional[int] = None
    site_id: Optional[int] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    assigned_to: Optional[int] = None
    tasks: Optional[List[str]] = None


class WorkOrderComplete(BaseModel):
    """Complete work order request."""
    resolution: str
    parts_used: Optional[List[dict]] = None
    labor_hours: Optional[float] = None
    cost: Optional[float] = None
    technician_notes: Optional[str] = None


class WorkOrderResponse(BaseModel):
    """Work order response."""
    id: int
    title: str
    description: Optional[str]
    maintenance_type: str
    priority: str
    status: str
    device_id: Optional[int]
    site_id: Optional[int]
    assigned_to: Optional[int]
    scheduled_start: Optional[datetime]
    scheduled_end: Optional[datetime]
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PredictionResponse(BaseModel):
    """Maintenance prediction response."""
    device_id: int
    device_name: str
    prediction_type: str
    confidence: float
    recommended_action: str
    recommended_date: datetime
    factors: List[dict]


class SummaryResponse(BaseModel):
    """Maintenance summary response."""
    total_scheduled: int
    total_completed: int
    total_overdue: int
    avg_completion_time: float
    mtbf_hours: Optional[float]
    mttr_hours: Optional[float]


# Schedule endpoints
@router.post("/schedules", response_model=ScheduleResponse)
def create_schedule(
    request: ScheduleCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Create a maintenance schedule."""
    service = get_maintenance_service(db)

    schedule = service.create_schedule(
        organization_id=organization_id,
        name=request.name,
        description=request.description,
        device_id=request.device_id,
        site_id=request.site_id,
        frequency_days=request.frequency_days,
        frequency_hours=request.frequency_hours,
        tasks=request.tasks,
        estimated_duration_minutes=request.estimated_duration_minutes,
        advance_notice_days=request.advance_notice_days
    )

    db.commit()

    return ScheduleResponse(
        id=schedule.id,
        name=schedule.name,
        description=schedule.description,
        device_id=schedule.device_id,
        site_id=schedule.site_id,
        frequency_days=schedule.frequency_days,
        is_active=schedule.is_active == 1,
        last_completed_at=schedule.last_completed_at,
        next_due_at=schedule.next_due_at,
        created_at=schedule.created_at
    )


@router.get("/schedules", response_model=List[ScheduleResponse])
def list_schedules(
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List maintenance schedules."""
    from backend.app.services.maintenance_service import MaintenanceSchedule

    schedules = db.query(MaintenanceSchedule).filter(
        MaintenanceSchedule.organization_id == organization_id,
        MaintenanceSchedule.is_active == 1
    ).all()

    return [
        ScheduleResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            device_id=s.device_id,
            site_id=s.site_id,
            frequency_days=s.frequency_days,
            is_active=s.is_active == 1,
            last_completed_at=s.last_completed_at,
            next_due_at=s.next_due_at,
            created_at=s.created_at
        )
        for s in schedules
    ]


@router.get("/schedules/due", response_model=List[ScheduleResponse])
def get_due_maintenance(
    days_ahead: int = 7,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Get maintenance schedules due within specified days."""
    service = get_maintenance_service(db)
    schedules = service.get_due_maintenance(organization_id, days_ahead)

    return [
        ScheduleResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            device_id=s.device_id,
            site_id=s.site_id,
            frequency_days=s.frequency_days,
            is_active=s.is_active == 1,
            last_completed_at=s.last_completed_at,
            next_due_at=s.next_due_at,
            created_at=s.created_at
        )
        for s in schedules
    ]


# Work order endpoints
@router.post("", response_model=WorkOrderResponse)
def create_work_order(
    request: WorkOrderCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1,
    user_id: int = 1
):
    """Create a work order."""
    service = get_maintenance_service(db)

    try:
        maintenance_type = MaintenanceType(request.maintenance_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid maintenance type: {request.maintenance_type}")

    try:
        priority = MaintenancePriority(request.priority)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {request.priority}")

    work_order = service.create_work_order(
        organization_id=organization_id,
        title=request.title,
        maintenance_type=maintenance_type,
        priority=priority,
        description=request.description,
        device_id=request.device_id,
        site_id=request.site_id,
        scheduled_start=request.scheduled_start,
        assigned_to=request.assigned_to,
        tasks=request.tasks,
        created_by=user_id
    )

    db.commit()

    return WorkOrderResponse(
        id=work_order.id,
        title=work_order.title,
        description=work_order.description,
        maintenance_type=work_order.maintenance_type,
        priority=work_order.priority,
        status=work_order.status,
        device_id=work_order.device_id,
        site_id=work_order.site_id,
        assigned_to=work_order.assigned_to,
        scheduled_start=work_order.scheduled_start,
        scheduled_end=work_order.scheduled_end,
        actual_start=work_order.actual_start,
        actual_end=work_order.actual_end,
        created_at=work_order.created_at
    )


@router.get("", response_model=List[WorkOrderResponse])
def list_work_orders(
    status: Optional[str] = None,
    device_id: Optional[int] = None,
    site_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List work orders."""
    from backend.app.services.maintenance_service import WorkOrder

    query = db.query(WorkOrder).filter(WorkOrder.organization_id == organization_id)

    if status:
        query = query.filter(WorkOrder.status == status)
    if device_id:
        query = query.filter(WorkOrder.device_id == device_id)
    if site_id:
        query = query.filter(WorkOrder.site_id == site_id)

    work_orders = query.order_by(WorkOrder.created_at.desc()).limit(limit).all()

    return [
        WorkOrderResponse(
            id=wo.id,
            title=wo.title,
            description=wo.description,
            maintenance_type=wo.maintenance_type,
            priority=wo.priority,
            status=wo.status,
            device_id=wo.device_id,
            site_id=wo.site_id,
            assigned_to=wo.assigned_to,
            scheduled_start=wo.scheduled_start,
            scheduled_end=wo.scheduled_end,
            actual_start=wo.actual_start,
            actual_end=wo.actual_end,
            created_at=wo.created_at
        )
        for wo in work_orders
    ]


@router.get("/overdue", response_model=List[WorkOrderResponse])
def get_overdue_work_orders(
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Get overdue work orders."""
    service = get_maintenance_service(db)
    work_orders = service.get_overdue_work_orders(organization_id)

    return [
        WorkOrderResponse(
            id=wo.id,
            title=wo.title,
            description=wo.description,
            maintenance_type=wo.maintenance_type,
            priority=wo.priority,
            status=wo.status,
            device_id=wo.device_id,
            site_id=wo.site_id,
            assigned_to=wo.assigned_to,
            scheduled_start=wo.scheduled_start,
            scheduled_end=wo.scheduled_end,
            actual_start=wo.actual_start,
            actual_end=wo.actual_end,
            created_at=wo.created_at
        )
        for wo in work_orders
    ]


@router.post("/{work_order_id}/start", response_model=WorkOrderResponse)
def start_work_order(
    work_order_id: int,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Start a work order."""
    service = get_maintenance_service(db)
    work_order = service.start_work_order(work_order_id, user_id)

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    db.commit()

    return WorkOrderResponse(
        id=work_order.id,
        title=work_order.title,
        description=work_order.description,
        maintenance_type=work_order.maintenance_type,
        priority=work_order.priority,
        status=work_order.status,
        device_id=work_order.device_id,
        site_id=work_order.site_id,
        assigned_to=work_order.assigned_to,
        scheduled_start=work_order.scheduled_start,
        scheduled_end=work_order.scheduled_end,
        actual_start=work_order.actual_start,
        actual_end=work_order.actual_end,
        created_at=work_order.created_at
    )


@router.post("/{work_order_id}/complete", response_model=WorkOrderResponse)
def complete_work_order(
    work_order_id: int,
    request: WorkOrderComplete,
    db: Session = Depends(get_db)
):
    """Complete a work order."""
    service = get_maintenance_service(db)

    work_order = service.complete_work_order(
        work_order_id=work_order_id,
        resolution=request.resolution,
        parts_used=request.parts_used,
        labor_hours=request.labor_hours,
        cost=request.cost,
        technician_notes=request.technician_notes
    )

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    db.commit()

    return WorkOrderResponse(
        id=work_order.id,
        title=work_order.title,
        description=work_order.description,
        maintenance_type=work_order.maintenance_type,
        priority=work_order.priority,
        status=work_order.status,
        device_id=work_order.device_id,
        site_id=work_order.site_id,
        assigned_to=work_order.assigned_to,
        scheduled_start=work_order.scheduled_start,
        scheduled_end=work_order.scheduled_end,
        actual_start=work_order.actual_start,
        actual_end=work_order.actual_end,
        created_at=work_order.created_at
    )


# Predictive maintenance
@router.get("/predictions/{device_id}", response_model=Optional[PredictionResponse])
def get_maintenance_prediction(
    device_id: int,
    db: Session = Depends(get_db)
):
    """Get predictive maintenance recommendation for a device."""
    service = get_maintenance_service(db)
    prediction = service.predict_maintenance(device_id)

    if not prediction:
        return None

    return PredictionResponse(
        device_id=prediction.device_id,
        device_name=prediction.device_name,
        prediction_type=prediction.prediction_type,
        confidence=prediction.confidence,
        recommended_action=prediction.recommended_action,
        recommended_date=prediction.recommended_date,
        factors=prediction.factors
    )


# Summary
@router.get("/summary", response_model=SummaryResponse)
def get_maintenance_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Get maintenance summary statistics."""
    service = get_maintenance_service(db)
    summary = service.get_summary(organization_id, days)

    return SummaryResponse(
        total_scheduled=summary.total_scheduled,
        total_completed=summary.total_completed,
        total_overdue=summary.total_overdue,
        avg_completion_time=summary.avg_completion_time,
        mtbf_hours=summary.mtbf_hours,
        mttr_hours=summary.mttr_hours
    )
