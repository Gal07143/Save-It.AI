"""Health check service for comprehensive system health monitoring."""
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import logging

logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class HealthCheck:
    """Configuration for a health check."""
    name: str
    check_func: Callable
    critical: bool = True
    timeout_seconds: int = 5
    interval_seconds: int = 30
    last_check: Optional[datetime] = None
    last_status: HealthStatus = HealthStatus.UNKNOWN
    last_error: Optional[str] = None
    consecutive_failures: int = 0


@dataclass
class HealthReport:
    """Complete health report."""
    status: HealthStatus
    timestamp: datetime
    components: Dict[str, dict]
    uptime_seconds: float
    version: str


class HealthService:
    """Comprehensive health monitoring service."""
    
    def __init__(self):
        self.checks: Dict[str, HealthCheck] = {}
        self._started_at = datetime.utcnow()
        self._version = "1.0.0"
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._register_default_checks()
    
    def _register_default_checks(self):
        """Register default health checks."""
        self.register_check(
            "database",
            self._check_database,
            critical=True,
            timeout_seconds=5,
        )
        
        self.register_check(
            "polling_service",
            self._check_polling_service,
            critical=False,
            timeout_seconds=2,
        )
        
        self.register_check(
            "scheduler_service",
            self._check_scheduler_service,
            critical=False,
            timeout_seconds=2,
        )
        
        self.register_check(
            "memory",
            self._check_memory,
            critical=False,
            timeout_seconds=2,
        )
    
    def register_check(
        self,
        name: str,
        check_func: Callable,
        critical: bool = True,
        timeout_seconds: int = 5,
        interval_seconds: int = 30,
    ):
        """Register a health check."""
        self.checks[name] = HealthCheck(
            name=name,
            check_func=check_func,
            critical=critical,
            timeout_seconds=timeout_seconds,
            interval_seconds=interval_seconds,
        )
        logger.debug(f"Registered health check: {name}")
    
    def unregister_check(self, name: str):
        """Unregister a health check."""
        if name in self.checks:
            del self.checks[name]
    
    async def start(self):
        """Start background health checking."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Health service started")
    
    async def stop(self):
        """Stop background health checking."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Health service stopped")
    
    async def _run_loop(self):
        """Background loop for periodic health checks."""
        while self._running:
            try:
                now = datetime.utcnow()
                
                for check in self.checks.values():
                    if check.last_check:
                        elapsed = (now - check.last_check).total_seconds()
                        if elapsed < check.interval_seconds:
                            continue
                    
                    asyncio.create_task(self._run_check(check))
                
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(10)
    
    async def _run_check(self, check: HealthCheck):
        """Run a single health check."""
        check.last_check = datetime.utcnow()
        
        try:
            if asyncio.iscoroutinefunction(check.check_func):
                result = await asyncio.wait_for(
                    check.check_func(),
                    timeout=check.timeout_seconds,
                )
            else:
                result = check.check_func()
            
            if result:
                check.last_status = HealthStatus.HEALTHY
                check.last_error = None
                check.consecutive_failures = 0
            else:
                check.last_status = HealthStatus.UNHEALTHY
                check.consecutive_failures += 1
        
        except asyncio.TimeoutError:
            check.last_status = HealthStatus.UNHEALTHY
            check.last_error = "Timeout"
            check.consecutive_failures += 1
        except Exception as e:
            check.last_status = HealthStatus.UNHEALTHY
            check.last_error = str(e)
            check.consecutive_failures += 1
    
    async def get_health(self, include_details: bool = True) -> HealthReport:
        """Get comprehensive health report."""
        components = {}
        critical_healthy = True
        any_unhealthy = False
        
        for name, check in self.checks.items():
            if check.last_check is None:
                await self._run_check(check)
            
            component_status = {
                "status": check.last_status.value,
                "critical": check.critical,
            }
            
            if include_details:
                component_status.update({
                    "last_check": check.last_check.isoformat() if check.last_check else None,
                    "consecutive_failures": check.consecutive_failures,
                    "error": check.last_error,
                })
            
            components[name] = component_status
            
            if check.last_status == HealthStatus.UNHEALTHY:
                any_unhealthy = True
                if check.critical:
                    critical_healthy = False
        
        if not critical_healthy:
            overall_status = HealthStatus.UNHEALTHY
        elif any_unhealthy:
            overall_status = HealthStatus.DEGRADED
        else:
            overall_status = HealthStatus.HEALTHY
        
        return HealthReport(
            status=overall_status,
            timestamp=datetime.utcnow(),
            components=components,
            uptime_seconds=(datetime.utcnow() - self._started_at).total_seconds(),
            version=self._version,
        )
    
    async def _check_database(self) -> bool:
        """Check database connectivity."""
        try:
            from app.core.database import SessionLocal
            from sqlalchemy import text
            
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            return True
        except Exception:
            return False
    
    async def _check_polling_service(self) -> bool:
        """Check polling service status."""
        try:
            from app.services.polling_service import polling_service
            return polling_service.running
        except Exception:
            return False
    
    async def _check_scheduler_service(self) -> bool:
        """Check scheduler service status."""
        try:
            from app.services.scheduler_service import scheduler_service
            return scheduler_service.running
        except Exception:
            return False
    
    async def _check_memory(self) -> bool:
        """Check memory usage."""
        try:
            import psutil
            memory = psutil.virtual_memory()
            usage_percent = memory.percent
            logger.debug(f"Memory usage: {usage_percent:.1f}%")
            return usage_percent < 90
        except ImportError:
            logger.warning("psutil not available, memory check skipped")
            return True
        except Exception as e:
            logger.error(f"Memory check failed: {e}")
            return False


health_service = HealthService()
