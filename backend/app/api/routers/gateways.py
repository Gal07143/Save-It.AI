"""Gateway management API endpoints."""
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.core.database import get_db
from backend.app.models.integrations import Gateway, GatewayStatus, CommunicationLog
from backend.app.schemas.integrations import (
    GatewayCreate,
    GatewayUpdate,
    GatewayResponse,
    CommunicationLogResponse,
    CommunicationHealthSummary,
)

router = APIRouter(prefix="/api/v1/gateways", tags=["gateways"])


@router.post("", response_model=GatewayResponse)
def create_gateway(gateway: GatewayCreate, db: Session = Depends(get_db)):
    """Create a new data collection gateway."""
    db_gateway = Gateway(
        site_id=gateway.site_id,
        name=gateway.name,
        description=gateway.description,
        serial_number=gateway.serial_number,
        ip_address=gateway.ip_address,
        mac_address=gateway.mac_address,
        firmware_version=gateway.firmware_version,
        model=gateway.model,
        manufacturer=gateway.manufacturer,
        heartbeat_interval_seconds=gateway.heartbeat_interval_seconds,
        is_active=1 if gateway.is_active else 0,
        config_json=gateway.config_json,
        status=GatewayStatus.OFFLINE,
    )
    db.add(db_gateway)
    db.commit()
    db.refresh(db_gateway)
    return db_gateway


@router.get("", response_model=List[GatewayResponse])
def list_gateways(
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all gateways, optionally filtered by site or status."""
    query = db.query(Gateway)
    if site_id:
        query = query.filter(Gateway.site_id == site_id)
    if status:
        query = query.filter(Gateway.status == status)
    return query.order_by(Gateway.name).offset(skip).limit(limit).all()


@router.get("/{gateway_id}", response_model=GatewayResponse)
def get_gateway(gateway_id: int, db: Session = Depends(get_db)):
    """Get gateway by ID."""
    gateway = db.query(Gateway).filter(Gateway.id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")
    return gateway


@router.put("/{gateway_id}", response_model=GatewayResponse)
def update_gateway(gateway_id: int, updates: GatewayUpdate, db: Session = Depends(get_db)):
    """Update gateway configuration."""
    gateway = db.query(Gateway).filter(Gateway.id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0
    
    for key, value in update_data.items():
        setattr(gateway, key, value)
    
    db.commit()
    db.refresh(gateway)
    return gateway


@router.delete("/{gateway_id}")
def delete_gateway(gateway_id: int, db: Session = Depends(get_db)):
    """Delete a gateway."""
    gateway = db.query(Gateway).filter(Gateway.id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")
    
    db.delete(gateway)
    db.commit()
    return {"message": "Gateway deleted successfully"}


@router.post("/{gateway_id}/heartbeat", response_model=GatewayResponse)
def gateway_heartbeat(gateway_id: int, db: Session = Depends(get_db)):
    """Update gateway heartbeat - marks gateway as online."""
    gateway = db.query(Gateway).filter(Gateway.id == gateway_id).first()
    if not gateway:
        raise HTTPException(status_code=404, detail="Gateway not found")
    
    gateway.status = GatewayStatus.ONLINE
    gateway.last_seen_at = datetime.utcnow()
    db.commit()
    db.refresh(gateway)
    return gateway


@router.get("/{gateway_id}/logs", response_model=List[CommunicationLogResponse])
def get_gateway_logs(
    gateway_id: int,
    hours: int = 24,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get communication logs for a gateway."""
    since = datetime.utcnow() - timedelta(hours=hours)
    logs = db.query(CommunicationLog).filter(
        CommunicationLog.gateway_id == gateway_id,
        CommunicationLog.timestamp >= since
    ).order_by(CommunicationLog.timestamp.desc()).limit(limit).all()
    return logs


@router.get("/health/summary", response_model=List[CommunicationHealthSummary])
def get_communication_health(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get communication health summary for all gateways."""
    query = db.query(Gateway)
    if site_id:
        query = query.filter(Gateway.site_id == site_id)
    
    gateways = query.all()
    summaries = []
    
    since = datetime.utcnow() - timedelta(hours=24)
    
    for gw in gateways:
        logs = db.query(CommunicationLog).filter(
            CommunicationLog.gateway_id == gw.id,
            CommunicationLog.timestamp >= since
        ).all()
        
        total_requests = sum(log.request_count for log in logs)
        total_success = sum(log.success_count for log in logs)
        total_errors = sum(log.error_count for log in logs)
        avg_response = None
        if logs:
            valid_times = [log.avg_response_time_ms for log in logs if log.avg_response_time_ms]
            if valid_times:
                avg_response = sum(valid_times) / len(valid_times)
        
        success_rate = (total_success / total_requests * 100) if total_requests > 0 else 0.0
        
        summaries.append(CommunicationHealthSummary(
            gateway_id=gw.id,
            name=gw.name,
            status=gw.status.value if gw.status else "offline",
            last_seen=gw.last_seen_at,
            total_requests_24h=total_requests,
            success_rate_24h=success_rate,
            avg_response_time_ms=avg_response,
            error_count_24h=total_errors,
            last_error=logs[0].message if logs and logs[0].status == "error" else None
        ))
    
    return summaries
