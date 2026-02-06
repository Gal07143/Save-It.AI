"""
Health Monitor Service for SAVE-IT.AI
System health monitoring and diagnostics:
- Service health checks
- Performance metrics
- Resource monitoring
- Alerting
"""
import json
import logging
import psutil
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, Float

from app.core.database import Base

logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Health status levels."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class HealthCheckResult(Base):
    """Health check result history."""
    __tablename__ = "health_check_results"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)

    check_name = Column(String(100), nullable=False, index=True)
    component = Column(String(50), nullable=False, index=True)

    status = Column(String(20), nullable=False, index=True)
    message = Column(Text, nullable=True)

    response_time_ms = Column(Float, nullable=True)
    details = Column(Text, nullable=True)  # JSON

    checked_at = Column(DateTime, default=datetime.utcnow, index=True)


class PerformanceMetric(Base):
    """Performance metric history."""
    __tablename__ = "performance_metrics"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)

    metric_name = Column(String(100), nullable=False, index=True)
    component = Column(String(50), nullable=False, index=True)

    value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=True)

    tags = Column(Text, nullable=True)  # JSON

    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)


@dataclass
class ComponentHealth:
    """Health status of a component."""
    name: str
    status: HealthStatus
    message: str
    response_time_ms: Optional[float] = None
    last_checked: Optional[datetime] = None
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SystemHealth:
    """Overall system health."""
    status: HealthStatus
    timestamp: datetime
    components: List[ComponentHealth]
    summary: Dict[str, int]
    uptime_seconds: float
    version: str


@dataclass
class ResourceUsage:
    """System resource usage."""
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float
    disk_used_gb: float
    disk_total_gb: float
    open_files: int
    connections: int


class HealthMonitor:
    """
    System health monitoring service.
    Performs health checks and collects metrics.
    """

    # Start time for uptime calculation
    _start_time = datetime.utcnow()

    def __init__(self, db: Session, app_version: str = "1.0.0"):
        self.db = db
        self.app_version = app_version
        self._health_checks: Dict[str, callable] = {}

        # Register default health checks
        self._register_default_checks()

    def _register_default_checks(self):
        """Register default health checks."""
        self._health_checks["database"] = self._check_database
        self._health_checks["redis"] = self._check_redis
        self._health_checks["mqtt"] = self._check_mqtt
        self._health_checks["disk"] = self._check_disk
        self._health_checks["memory"] = self._check_memory

    def register_health_check(
        self,
        name: str,
        check_func: callable
    ):
        """Register a custom health check."""
        self._health_checks[name] = check_func

    def get_health(self, deep: bool = False) -> SystemHealth:
        """
        Get overall system health.

        Args:
            deep: If True, run all health checks. If False, return cached/quick status.

        Returns:
            SystemHealth status
        """
        components = []
        summary = {"healthy": 0, "degraded": 0, "unhealthy": 0, "unknown": 0}

        for name, check_func in self._health_checks.items():
            if deep:
                component = self._run_check(name, check_func)
            else:
                # Return last known status
                component = self._get_last_check(name)

            components.append(component)
            summary[component.status.value] += 1

        # Determine overall status
        if summary["unhealthy"] > 0:
            overall_status = HealthStatus.UNHEALTHY
        elif summary["degraded"] > 0:
            overall_status = HealthStatus.DEGRADED
        elif summary["unknown"] > 0 and summary["healthy"] == 0:
            overall_status = HealthStatus.UNKNOWN
        else:
            overall_status = HealthStatus.HEALTHY

        uptime = (datetime.utcnow() - self._start_time).total_seconds()

        return SystemHealth(
            status=overall_status,
            timestamp=datetime.utcnow(),
            components=components,
            summary=summary,
            uptime_seconds=uptime,
            version=self.app_version
        )

    def _run_check(
        self,
        name: str,
        check_func: callable
    ) -> ComponentHealth:
        """Run a single health check."""
        start_time = time.time()

        try:
            status, message, details = check_func()
            response_time = (time.time() - start_time) * 1000

            component = ComponentHealth(
                name=name,
                status=status,
                message=message,
                response_time_ms=round(response_time, 2),
                last_checked=datetime.utcnow(),
                details=details or {}
            )

            # Log result
            self._log_check_result(component)

            return component

        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            logger.error(f"Health check {name} failed: {e}")

            component = ComponentHealth(
                name=name,
                status=HealthStatus.UNHEALTHY,
                message=str(e),
                response_time_ms=round(response_time, 2),
                last_checked=datetime.utcnow()
            )

            self._log_check_result(component)

            return component

    def _get_last_check(self, name: str) -> ComponentHealth:
        """Get last known health check result."""
        result = self.db.query(HealthCheckResult).filter(
            HealthCheckResult.check_name == name
        ).order_by(HealthCheckResult.checked_at.desc()).first()

        if result:
            return ComponentHealth(
                name=name,
                status=HealthStatus(result.status),
                message=result.message or "",
                response_time_ms=result.response_time_ms,
                last_checked=result.checked_at,
                details=json.loads(result.details) if result.details else {}
            )

        return ComponentHealth(
            name=name,
            status=HealthStatus.UNKNOWN,
            message="No health check data available"
        )

    def _log_check_result(self, component: ComponentHealth):
        """Log health check result to database."""
        result = HealthCheckResult(
            check_name=component.name,
            component=component.name,
            status=component.status.value,
            message=component.message,
            response_time_ms=component.response_time_ms,
            details=json.dumps(component.details) if component.details else None
        )

        self.db.add(result)

    def _check_database(self) -> tuple:
        """Check database connectivity."""
        try:
            # Execute simple query
            self.db.execute("SELECT 1")
            return HealthStatus.HEALTHY, "Database connection OK", {"type": "postgresql"}
        except Exception as e:
            return HealthStatus.UNHEALTHY, f"Database error: {e}", None

    def _check_redis(self) -> tuple:
        """Check Redis connectivity."""
        try:
            import redis
            r = redis.Redis(host='localhost', port=6379, db=0, socket_timeout=2)
            r.ping()
            return HealthStatus.HEALTHY, "Redis connection OK", {"version": r.info().get("redis_version")}
        except ImportError:
            return HealthStatus.UNKNOWN, "Redis client not installed", None
        except Exception as e:
            # Redis might be optional
            return HealthStatus.DEGRADED, f"Redis unavailable: {e}", None

    def _check_mqtt(self) -> tuple:
        """Check MQTT broker connectivity."""
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex(('localhost', 1883))
            sock.close()

            if result == 0:
                return HealthStatus.HEALTHY, "MQTT broker reachable", {"port": 1883}
            else:
                return HealthStatus.DEGRADED, "MQTT broker not reachable", None
        except Exception as e:
            return HealthStatus.DEGRADED, f"MQTT check failed: {e}", None

    def _check_disk(self) -> tuple:
        """Check disk space."""
        try:
            disk = psutil.disk_usage('/')
            percent_used = disk.percent

            details = {
                "total_gb": round(disk.total / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "percent_used": percent_used
            }

            if percent_used > 90:
                return HealthStatus.UNHEALTHY, f"Disk space critical: {percent_used}% used", details
            elif percent_used > 80:
                return HealthStatus.DEGRADED, f"Disk space low: {percent_used}% used", details
            else:
                return HealthStatus.HEALTHY, f"Disk space OK: {percent_used}% used", details
        except Exception as e:
            return HealthStatus.UNKNOWN, f"Disk check failed: {e}", None

    def _check_memory(self) -> tuple:
        """Check memory usage."""
        try:
            memory = psutil.virtual_memory()
            percent_used = memory.percent

            details = {
                "total_mb": round(memory.total / (1024**2), 2),
                "used_mb": round(memory.used / (1024**2), 2),
                "available_mb": round(memory.available / (1024**2), 2),
                "percent_used": percent_used
            }

            if percent_used > 95:
                return HealthStatus.UNHEALTHY, f"Memory critical: {percent_used}% used", details
            elif percent_used > 85:
                return HealthStatus.DEGRADED, f"Memory high: {percent_used}% used", details
            else:
                return HealthStatus.HEALTHY, f"Memory OK: {percent_used}% used", details
        except Exception as e:
            return HealthStatus.UNKNOWN, f"Memory check failed: {e}", None

    def get_resource_usage(self) -> ResourceUsage:
        """Get current system resource usage."""
        try:
            cpu = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            process = psutil.Process()
            open_files = len(process.open_files())
            connections = len(process.connections())

            return ResourceUsage(
                cpu_percent=cpu,
                memory_percent=memory.percent,
                memory_used_mb=round(memory.used / (1024**2), 2),
                memory_total_mb=round(memory.total / (1024**2), 2),
                disk_percent=disk.percent,
                disk_used_gb=round(disk.used / (1024**3), 2),
                disk_total_gb=round(disk.total / (1024**3), 2),
                open_files=open_files,
                connections=connections
            )
        except Exception as e:
            logger.error(f"Failed to get resource usage: {e}")
            return ResourceUsage(
                cpu_percent=0, memory_percent=0, memory_used_mb=0, memory_total_mb=0,
                disk_percent=0, disk_used_gb=0, disk_total_gb=0, open_files=0, connections=0
            )

    def record_metric(
        self,
        metric_name: str,
        value: float,
        component: str = "app",
        unit: Optional[str] = None,
        tags: Optional[Dict[str, str]] = None
    ):
        """Record a performance metric."""
        metric = PerformanceMetric(
            metric_name=metric_name,
            component=component,
            value=value,
            unit=unit,
            tags=json.dumps(tags) if tags else None
        )

        self.db.add(metric)

    def get_metrics(
        self,
        metric_name: Optional[str] = None,
        component: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[PerformanceMetric]:
        """Get performance metrics."""
        query = self.db.query(PerformanceMetric)

        if metric_name:
            query = query.filter(PerformanceMetric.metric_name == metric_name)
        if component:
            query = query.filter(PerformanceMetric.component == component)
        if start_time:
            query = query.filter(PerformanceMetric.recorded_at >= start_time)
        if end_time:
            query = query.filter(PerformanceMetric.recorded_at <= end_time)

        return query.order_by(PerformanceMetric.recorded_at.desc()).limit(limit).all()

    def get_metric_summary(
        self,
        metric_name: str,
        component: Optional[str] = None,
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get summary statistics for a metric."""
        from sqlalchemy import func

        cutoff = datetime.utcnow() - timedelta(hours=hours)

        query = self.db.query(
            func.count(PerformanceMetric.id).label('count'),
            func.avg(PerformanceMetric.value).label('avg'),
            func.min(PerformanceMetric.value).label('min'),
            func.max(PerformanceMetric.value).label('max')
        ).filter(
            PerformanceMetric.metric_name == metric_name,
            PerformanceMetric.recorded_at >= cutoff
        )

        if component:
            query = query.filter(PerformanceMetric.component == component)

        result = query.first()

        return {
            "metric_name": metric_name,
            "period_hours": hours,
            "count": result.count or 0,
            "average": round(float(result.avg), 4) if result.avg else None,
            "minimum": result.min,
            "maximum": result.max
        }

    def cleanup_old_data(self, retention_days: int = 7) -> int:
        """Delete old health check and metric data."""
        cutoff = datetime.utcnow() - timedelta(days=retention_days)

        deleted_checks = self.db.query(HealthCheckResult).filter(
            HealthCheckResult.checked_at < cutoff
        ).delete()

        deleted_metrics = self.db.query(PerformanceMetric).filter(
            PerformanceMetric.recorded_at < cutoff
        ).delete()

        total_deleted = deleted_checks + deleted_metrics
        logger.info(f"Cleaned up {total_deleted} old health/metric records")

        return total_deleted

    def get_health_history(
        self,
        component: Optional[str] = None,
        hours: int = 24
    ) -> List[HealthCheckResult]:
        """Get health check history."""
        cutoff = datetime.utcnow() - timedelta(hours=hours)

        query = self.db.query(HealthCheckResult).filter(
            HealthCheckResult.checked_at >= cutoff
        )

        if component:
            query = query.filter(HealthCheckResult.component == component)

        return query.order_by(HealthCheckResult.checked_at.desc()).all()


def get_health_monitor(db: Session) -> HealthMonitor:
    """Get HealthMonitor instance."""
    return HealthMonitor(db)
