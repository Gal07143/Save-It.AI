"""
Health Monitoring API Router for SAVE-IT.AI
Endpoints for system health monitoring and diagnostics.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.health_monitor import (
    HealthMonitor,
    HealthStatus,
    get_health_monitor,
)

router = APIRouter(prefix="/health", tags=["health"])


class ComponentHealthResponse(BaseModel):
    """Component health response."""
    component: str
    status: str
    response_time_ms: Optional[float]
    message: Optional[str]
    last_check: datetime


class SystemHealthResponse(BaseModel):
    """System health response."""
    status: str
    components: List[ComponentHealthResponse]
    uptime_seconds: float
    version: str
    checked_at: datetime


class ResourceUsageResponse(BaseModel):
    """Resource usage response."""
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_available_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_free_gb: float
    open_connections: int
    active_threads: int
    timestamp: datetime


class PerformanceMetricsResponse(BaseModel):
    """Performance metrics response."""
    avg_response_time_ms: float
    p95_response_time_ms: float
    p99_response_time_ms: float
    requests_per_second: float
    error_rate: float
    slow_queries_count: int
    period_seconds: int


class AlertResponse(BaseModel):
    """Health alert response."""
    id: int
    component: str
    severity: str
    message: str
    details: Optional[dict]
    acknowledged: bool
    acknowledged_by: Optional[int]
    acknowledged_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=SystemHealthResponse)
def get_system_health(
    db: Session = Depends(get_db)
):
    """Get overall system health status."""
    monitor = get_health_monitor(db)
    health = monitor.check_system_health()

    return SystemHealthResponse(
        status=health.status,
        components=[
            ComponentHealthResponse(
                component=c.component,
                status=c.status,
                response_time_ms=c.response_time_ms,
                message=c.message,
                last_check=c.last_check
            )
            for c in health.components
        ],
        uptime_seconds=health.uptime_seconds,
        version=health.version,
        checked_at=health.checked_at
    )


@router.get("/ready")
def readiness_check(
    db: Session = Depends(get_db)
):
    """Kubernetes readiness probe endpoint."""
    monitor = get_health_monitor(db)
    is_ready = monitor.is_ready()

    if not is_ready:
        raise HTTPException(status_code=503, detail="Service not ready")

    return {"status": "ready"}


@router.get("/live")
def liveness_check():
    """Kubernetes liveness probe endpoint."""
    return {"status": "alive", "timestamp": datetime.utcnow().isoformat()}


@router.get("/resources", response_model=ResourceUsageResponse)
def get_resource_usage(
    db: Session = Depends(get_db)
):
    """Get current resource usage."""
    monitor = get_health_monitor(db)
    usage = monitor.get_resource_usage()

    return ResourceUsageResponse(
        cpu_percent=usage.cpu_percent,
        memory_percent=usage.memory_percent,
        memory_used_mb=usage.memory_used_mb,
        memory_available_mb=usage.memory_available_mb,
        disk_percent=usage.disk_percent,
        disk_used_gb=usage.disk_used_gb,
        disk_free_gb=usage.disk_free_gb,
        open_connections=usage.open_connections,
        active_threads=usage.active_threads,
        timestamp=usage.timestamp
    )


@router.get("/performance", response_model=PerformanceMetricsResponse)
def get_performance_metrics(
    period_seconds: int = 300,
    db: Session = Depends(get_db)
):
    """Get performance metrics for a time period."""
    monitor = get_health_monitor(db)
    metrics = monitor.get_performance_metrics(period_seconds)

    return PerformanceMetricsResponse(
        avg_response_time_ms=metrics.avg_response_time_ms,
        p95_response_time_ms=metrics.p95_response_time_ms,
        p99_response_time_ms=metrics.p99_response_time_ms,
        requests_per_second=metrics.requests_per_second,
        error_rate=metrics.error_rate,
        slow_queries_count=metrics.slow_queries_count,
        period_seconds=period_seconds
    )


@router.get("/components/{component}")
def get_component_health(
    component: str,
    db: Session = Depends(get_db)
):
    """Get health status for a specific component."""
    monitor = get_health_monitor(db)
    health = monitor.check_component(component)

    if not health:
        raise HTTPException(status_code=404, detail=f"Component not found: {component}")

    return ComponentHealthResponse(
        component=health.component,
        status=health.status,
        response_time_ms=health.response_time_ms,
        message=health.message,
        last_check=health.last_check
    )


@router.get("/alerts", response_model=List[AlertResponse])
def list_health_alerts(
    severity: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """List health alerts."""
    monitor = get_health_monitor(db)
    alerts = monitor.get_alerts(severity, acknowledged, limit)

    return [
        AlertResponse(
            id=a.id,
            component=a.component,
            severity=a.severity,
            message=a.message,
            details=a.details,
            acknowledged=a.acknowledged == 1,
            acknowledged_by=a.acknowledged_by,
            acknowledged_at=a.acknowledged_at,
            created_at=a.created_at
        )
        for a in alerts
    ]


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Acknowledge a health alert."""
    monitor = get_health_monitor(db)

    if not monitor.acknowledge_alert(alert_id, user_id):
        raise HTTPException(status_code=404, detail="Alert not found")

    db.commit()

    return {"message": "Alert acknowledged"}


@router.get("/database")
def get_database_health(
    db: Session = Depends(get_db)
):
    """Get detailed database health information."""
    monitor = get_health_monitor(db)
    db_health = monitor.check_database_health()

    return {
        "status": db_health.status,
        "connection_pool": {
            "size": db_health.pool_size,
            "checked_out": db_health.checked_out,
            "overflow": db_health.overflow
        },
        "slow_queries": db_health.slow_queries,
        "table_sizes": db_health.table_sizes,
        "response_time_ms": db_health.response_time_ms
    }


@router.get("/queues")
def get_queue_health(
    db: Session = Depends(get_db)
):
    """Get message queue health information."""
    monitor = get_health_monitor(db)
    queue_health = monitor.check_queue_health()

    return {
        "status": queue_health.status,
        "pending_messages": queue_health.pending_messages,
        "processing_rate": queue_health.processing_rate,
        "dead_letter_count": queue_health.dead_letter_count,
        "lag_seconds": queue_health.lag_seconds
    }
