"""
Alarms API Router for SAVE-IT.AI
Endpoints for alarm management and monitoring.
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.alarm_engine import AlarmEngine
from app.models.telemetry import DeviceAlarm, AlarmStatus

router = APIRouter(prefix="/alarms", tags=["Alarms"])


def get_alarm_engine(request: Request, db: Session = Depends(get_db)) -> AlarmEngine:
    """Get AlarmEngine singleton from app state, or create per-request instance."""
    if hasattr(request.app.state, "alarm_engine"):
        return request.app.state.alarm_engine
    return AlarmEngine(db)


# Request/Response Models
class AlarmResponse(BaseModel):
    """Alarm record response."""
    id: int
    device_id: int
    alarm_rule_id: int
    datapoint_id: Optional[int]
    status: str
    severity: str
    title: str
    message: Optional[str]
    trigger_value: Optional[float]
    threshold_value: Optional[float]
    condition: Optional[str]
    triggered_at: str
    acknowledged_at: Optional[str]
    cleared_at: Optional[str]
    acknowledged_by: Optional[int]
    cleared_by: Optional[int]
    notes: Optional[str]
    duration_seconds: int

    class Config:
        from_attributes = True


class AcknowledgeRequest(BaseModel):
    """Acknowledge alarm request."""
    notes: Optional[str] = None


class BulkAcknowledgeRequest(BaseModel):
    """Bulk acknowledge request."""
    alarm_ids: List[int]
    notes: Optional[str] = None


class AlarmStatisticsResponse(BaseModel):
    """Alarm statistics response."""
    total: int
    active: int
    acknowledged: int
    cleared: int
    auto_cleared: int
    by_severity: dict


class ClearRequest(BaseModel):
    """Clear alarm request."""
    pass


def alarm_to_response(alarm: DeviceAlarm) -> AlarmResponse:
    """Convert DeviceAlarm to response model."""
    return AlarmResponse(
        id=alarm.id,
        device_id=alarm.device_id,
        alarm_rule_id=alarm.alarm_rule_id,
        datapoint_id=alarm.datapoint_id,
        status=alarm.status.value if alarm.status else "unknown",
        severity=alarm.severity or "unknown",
        title=alarm.title,
        message=alarm.message,
        trigger_value=alarm.trigger_value,
        threshold_value=alarm.threshold_value,
        condition=alarm.condition,
        triggered_at=alarm.triggered_at.isoformat() if alarm.triggered_at else "",
        acknowledged_at=alarm.acknowledged_at.isoformat() if alarm.acknowledged_at else None,
        cleared_at=alarm.cleared_at.isoformat() if alarm.cleared_at else None,
        acknowledged_by=alarm.acknowledged_by,
        cleared_by=alarm.cleared_by,
        notes=alarm.notes,
        duration_seconds=alarm.duration_seconds or 0
    )


# Endpoints
@router.get("", response_model=List[AlarmResponse])
@router.get("/", response_model=List[AlarmResponse], include_in_schema=False)
def list_alarms(
    device_id: Optional[int] = None,
    site_id: Optional[int] = None,
    status: Optional[str] = Query(None, description="Filter by status: triggered, acknowledged, cleared, auto_cleared"),
    severity: Optional[str] = Query(None, description="Filter by severity: info, warning, error, critical"),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """
    List alarms with optional filters.

    Returns alarms sorted by triggered_at descending.
    """
    query = db.query(DeviceAlarm)

    if device_id:
        query = query.filter(DeviceAlarm.device_id == device_id)

    if status:
        try:
            status_enum = AlarmStatus(status)
            query = query.filter(DeviceAlarm.status == status_enum)
        except ValueError:
            pass

    if severity:
        query = query.filter(DeviceAlarm.severity == severity)

    if start:
        query = query.filter(DeviceAlarm.triggered_at >= start)
    if end:
        query = query.filter(DeviceAlarm.triggered_at <= end)

    alarms = query.order_by(DeviceAlarm.triggered_at.desc()).limit(limit).all()

    return [alarm_to_response(a) for a in alarms]


@router.get("/active", response_model=List[AlarmResponse])
def get_active_alarms(
    device_id: Optional[int] = None,
    site_id: Optional[int] = None,
    severity: Optional[str] = None,
    limit: int = Query(100, le=1000),
    engine: AlarmEngine = Depends(get_alarm_engine)
):
    """
    Get currently active (triggered or acknowledged) alarms.
    """
    alarms = engine.get_active(
        device_id=device_id,
        site_id=site_id,
        severity=severity,
        limit=limit
    )

    return [alarm_to_response(a) for a in alarms]


@router.get("/history", response_model=List[AlarmResponse])
def get_alarm_history(
    device_id: Optional[int] = None,
    site_id: Optional[int] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    include_active: bool = True,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get alarm history with optional filters.
    """
    query = db.query(DeviceAlarm)

    if device_id:
        query = query.filter(DeviceAlarm.device_id == device_id)

    if not include_active:
        query = query.filter(
            DeviceAlarm.status.in_([AlarmStatus.CLEARED, AlarmStatus.AUTO_CLEARED])
        )

    if start:
        query = query.filter(DeviceAlarm.triggered_at >= start)
    if end:
        query = query.filter(DeviceAlarm.triggered_at <= end)

    alarms = query.order_by(DeviceAlarm.triggered_at.desc()).limit(limit).all()

    return [alarm_to_response(a) for a in alarms]


@router.get("/statistics", response_model=AlarmStatisticsResponse)
def get_alarm_statistics(
    device_id: Optional[int] = None,
    site_id: Optional[int] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    engine: AlarmEngine = Depends(get_alarm_engine)
):
    """
    Get alarm statistics with optional filters.
    """
    stats = engine.get_statistics(
        device_id=device_id,
        site_id=site_id,
        start=start,
        end=end
    )

    return AlarmStatisticsResponse(**stats)


@router.get("/{alarm_id}", response_model=AlarmResponse)
def get_alarm(
    alarm_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific alarm by ID.
    """
    alarm = db.query(DeviceAlarm).filter(DeviceAlarm.id == alarm_id).first()

    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    return alarm_to_response(alarm)


@router.post("/{alarm_id}/acknowledge", response_model=AlarmResponse)
def acknowledge_alarm(
    alarm_id: int,
    request: AcknowledgeRequest,
    user_id: int = Query(..., description="User ID performing acknowledgment"),
    db: Session = Depends(get_db),
    engine: AlarmEngine = Depends(get_alarm_engine)
):
    """
    Acknowledge an alarm.

    Changes status from 'triggered' to 'acknowledged'.
    """
    alarm = engine.acknowledge(
        alarm_id=alarm_id,
        user_id=user_id,
        notes=request.notes
    )

    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    db.commit()
    return alarm_to_response(alarm)


@router.post("/{alarm_id}/clear", response_model=AlarmResponse)
def clear_alarm(
    alarm_id: int,
    user_id: Optional[int] = Query(None, description="User ID clearing the alarm"),
    db: Session = Depends(get_db),
    engine: AlarmEngine = Depends(get_alarm_engine)
):
    """
    Clear an alarm manually.

    Changes status to 'cleared'.
    """
    alarm = engine.clear(
        alarm_id=alarm_id,
        user_id=user_id,
        auto=False
    )

    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    db.commit()
    return alarm_to_response(alarm)


@router.post("/bulk-acknowledge")
def bulk_acknowledge_alarms(
    request: BulkAcknowledgeRequest,
    user_id: int = Query(..., description="User ID performing acknowledgment"),
    db: Session = Depends(get_db),
    engine: AlarmEngine = Depends(get_alarm_engine)
):
    """
    Acknowledge multiple alarms at once.
    """
    count = engine.bulk_acknowledge(
        alarm_ids=request.alarm_ids,
        user_id=user_id,
        notes=request.notes
    )

    db.commit()

    return {
        "acknowledged_count": count,
        "alarm_ids": request.alarm_ids
    }


@router.get("/devices/{device_id}", response_model=List[AlarmResponse])
def get_device_alarms(
    device_id: int,
    include_cleared: bool = True,
    limit: int = Query(100, le=1000),
    engine: AlarmEngine = Depends(get_alarm_engine)
):
    """
    Get alarms for a specific device.
    """
    alarms = engine.get_history(
        device_id=device_id,
        limit=limit,
        include_active=True
    )

    if not include_cleared:
        alarms = [a for a in alarms if a.status in [AlarmStatus.TRIGGERED, AlarmStatus.ACKNOWLEDGED]]

    return [alarm_to_response(a) for a in alarms]


@router.get("/sites/{site_id}", response_model=List[AlarmResponse])
def get_site_alarms(
    site_id: int,
    active_only: bool = False,
    severity: Optional[str] = None,
    limit: int = Query(100, le=1000),
    db: Session = Depends(get_db)
):
    """
    Get alarms for all devices at a site.
    """
    from app.models.devices import Device

    query = db.query(DeviceAlarm).join(Device).filter(Device.site_id == site_id)

    if active_only:
        query = query.filter(
            DeviceAlarm.status.in_([AlarmStatus.TRIGGERED, AlarmStatus.ACKNOWLEDGED])
        )

    if severity:
        query = query.filter(DeviceAlarm.severity == severity)

    alarms = query.order_by(DeviceAlarm.triggered_at.desc()).limit(limit).all()

    return [alarm_to_response(a) for a in alarms]


@router.post("/check-no-data")
def check_no_data_alarms(
    db: Session = Depends(get_db),
    engine: AlarmEngine = Depends(get_alarm_engine)
):
    """
    Manually trigger no-data alarm check.

    Usually called by scheduler, but can be triggered manually.
    """
    events = engine.check_no_data_conditions()
    db.commit()

    return {
        "checked": True,
        "alarms_triggered": len([e for e in events if e.event_type == "triggered"]),
        "alarms_cleared": len([e for e in events if e.event_type == "cleared"]),
        "events": [
            {
                "alarm_id": e.alarm_id,
                "device_id": e.device_id,
                "event_type": e.event_type,
                "message": e.message
            }
            for e in events
        ]
    }
