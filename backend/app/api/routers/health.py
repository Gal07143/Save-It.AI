"""
Health Monitoring API Router for SAVE-IT.AI
Endpoints for system health monitoring and diagnostics.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

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
    response_time_ms: Optional[float] = None
    message: Optional[str] = None
    last_check: Optional[datetime] = None


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
    memory_total_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_total_gb: float
    open_files: int
    connections: int
    timestamp: datetime


@router.get("", response_model=SystemHealthResponse)
def get_system_health(
    deep: bool = False,
    db: Session = Depends(get_db)
):
    """Get overall system health status."""
    monitor = get_health_monitor(db)
    health = monitor.get_health(deep=deep)

    return SystemHealthResponse(
        status=health.status.value,
        components=[
            ComponentHealthResponse(
                component=c.name,
                status=c.status.value,
                response_time_ms=c.response_time_ms,
                message=c.message,
                last_check=c.last_checked
            )
            for c in health.components
        ],
        uptime_seconds=health.uptime_seconds,
        version=health.version,
        checked_at=health.timestamp
    )


@router.get("/ready")
def readiness_check(
    db: Session = Depends(get_db)
):
    """Kubernetes readiness probe endpoint."""
    try:
        # Simple DB check
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service not ready: {e}")


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
        memory_total_mb=usage.memory_total_mb,
        disk_percent=usage.disk_percent,
        disk_used_gb=usage.disk_used_gb,
        disk_total_gb=usage.disk_total_gb,
        open_files=usage.open_files,
        connections=usage.connections,
        timestamp=datetime.utcnow()
    )


@router.get("/deep")
def get_deep_health(
    db: Session = Depends(get_db)
):
    """Run all health checks and return detailed status."""
    monitor = get_health_monitor(db)
    health = monitor.get_health(deep=True)

    return {
        "status": health.status.value,
        "timestamp": health.timestamp.isoformat(),
        "uptime_seconds": health.uptime_seconds,
        "version": health.version,
        "summary": health.summary,
        "components": [
            {
                "name": c.name,
                "status": c.status.value,
                "message": c.message,
                "response_time_ms": c.response_time_ms,
                "last_checked": c.last_checked.isoformat() if c.last_checked else None,
                "details": c.details
            }
            for c in health.components
        ]
    }


@router.get("/database")
def get_database_health(
    db: Session = Depends(get_db)
):
    """Get database health information."""
    try:
        # Test database connection
        start = datetime.utcnow()
        db.execute(text("SELECT 1"))
        response_time = (datetime.utcnow() - start).total_seconds() * 1000

        return {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
            "message": "Database connection OK"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "response_time_ms": None,
            "message": str(e)
        }
