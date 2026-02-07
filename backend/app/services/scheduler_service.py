"""Scheduled task service for cron-like job scheduling."""
from typing import Dict, List, Optional, Callable, Any, TYPE_CHECKING
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import logging

if TYPE_CHECKING:
    from app.services.alarm_engine import AlarmEngine

logger = logging.getLogger(__name__)


class ScheduleType(str, Enum):
    INTERVAL = "interval"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CRON = "cron"


@dataclass
class ScheduledTask:
    """Represents a scheduled task."""
    id: str
    name: str
    callback: Callable
    schedule_type: ScheduleType
    interval_minutes: Optional[int] = None
    run_at_hour: Optional[int] = None
    run_at_minute: int = 0
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    enabled: bool = True
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    run_count: int = 0
    error_count: int = 0
    last_error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class SchedulerService:
    """Cron-like scheduler for background tasks."""
    
    def __init__(self):
        self.tasks: Dict[str, ScheduledTask] = {}
        self.running = False
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
    
    async def start(self):
        """Start the scheduler service."""
        if self.running:
            return
        
        self.running = True
        self._calculate_next_runs()
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Scheduler service started")
    
    async def stop(self):
        """Stop the scheduler service."""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Scheduler service stopped")
    
    def add_task(
        self,
        task_id: str,
        name: str,
        callback: Callable,
        schedule_type: ScheduleType,
        interval_minutes: Optional[int] = None,
        run_at_hour: Optional[int] = None,
        run_at_minute: int = 0,
        day_of_week: Optional[int] = None,
        day_of_month: Optional[int] = None,
        metadata: Optional[Dict] = None,
    ):
        """Add a new scheduled task."""
        task = ScheduledTask(
            id=task_id,
            name=name,
            callback=callback,
            schedule_type=schedule_type,
            interval_minutes=interval_minutes,
            run_at_hour=run_at_hour,
            run_at_minute=run_at_minute,
            day_of_week=day_of_week,
            day_of_month=day_of_month,
            metadata=metadata or {},
        )
        
        self.tasks[task_id] = task
        self._calculate_next_run(task)
        logger.info(f"Added scheduled task: {task_id} ({schedule_type.value})")
    
    def remove_task(self, task_id: str):
        """Remove a scheduled task."""
        if task_id in self.tasks:
            del self.tasks[task_id]
            logger.info(f"Removed scheduled task: {task_id}")
    
    def enable_task(self, task_id: str):
        """Enable a scheduled task."""
        if task_id in self.tasks:
            self.tasks[task_id].enabled = True
            self._calculate_next_run(self.tasks[task_id])
    
    def disable_task(self, task_id: str):
        """Disable a scheduled task."""
        if task_id in self.tasks:
            self.tasks[task_id].enabled = False
    
    def _calculate_next_runs(self):
        """Calculate next run times for all tasks."""
        for task in self.tasks.values():
            self._calculate_next_run(task)
    
    def _calculate_next_run(self, task: ScheduledTask):
        """Calculate the next run time for a task."""
        now = datetime.utcnow()
        
        if task.schedule_type == ScheduleType.INTERVAL:
            if task.interval_minutes:
                task.next_run = now + timedelta(minutes=task.interval_minutes)
        
        elif task.schedule_type == ScheduleType.DAILY:
            next_run = now.replace(
                hour=task.run_at_hour or 0,
                minute=task.run_at_minute,
                second=0,
                microsecond=0,
            )
            if next_run <= now:
                next_run += timedelta(days=1)
            task.next_run = next_run
        
        elif task.schedule_type == ScheduleType.WEEKLY:
            days_ahead = (task.day_of_week or 0) - now.weekday()
            if days_ahead < 0:
                days_ahead += 7
            next_run = now.replace(
                hour=task.run_at_hour or 0,
                minute=task.run_at_minute,
                second=0,
                microsecond=0,
            ) + timedelta(days=days_ahead)
            if next_run <= now:
                next_run += timedelta(weeks=1)
            task.next_run = next_run
        
        elif task.schedule_type == ScheduleType.MONTHLY:
            next_run = now.replace(
                day=task.day_of_month or 1,
                hour=task.run_at_hour or 0,
                minute=task.run_at_minute,
                second=0,
                microsecond=0,
            )
            if next_run <= now:
                if now.month == 12:
                    next_run = next_run.replace(year=now.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=now.month + 1)
            task.next_run = next_run
    
    async def _run_loop(self):
        """Main scheduler loop."""
        while self.running:
            try:
                now = datetime.utcnow()
                tasks_to_run = []
                
                for task in self.tasks.values():
                    if not task.enabled:
                        continue
                    if task.next_run and task.next_run <= now:
                        tasks_to_run.append(task)
                
                for task in tasks_to_run:
                    asyncio.create_task(self._execute_task(task))
                
                await asyncio.sleep(30)
            
            except Exception as e:
                logger.error(f"Scheduler loop error: {e}")
                await asyncio.sleep(60)
    
    async def _execute_task(self, task: ScheduledTask):
        """Execute a scheduled task."""
        task.last_run = datetime.utcnow()
        
        try:
            logger.info(f"Running scheduled task: {task.id}")
            await task.callback(task.metadata)
            task.run_count += 1
            task.last_error = None
            
        except Exception as e:
            task.error_count += 1
            task.last_error = str(e)
            logger.error(f"Scheduled task error {task.id}: {e}")
        
        finally:
            self._calculate_next_run(task)
    
    def get_status(self) -> dict:
        """Get scheduler status."""
        return {
            "running": self.running,
            "task_count": len(self.tasks),
            "tasks": [
                {
                    "id": t.id,
                    "name": t.name,
                    "schedule_type": t.schedule_type.value,
                    "enabled": t.enabled,
                    "run_count": t.run_count,
                    "error_count": t.error_count,
                    "last_run": t.last_run.isoformat() if t.last_run else None,
                    "next_run": t.next_run.isoformat() if t.next_run else None,
                    "last_error": t.last_error,
                }
                for t in self.tasks.values()
            ],
        }


scheduler_service = SchedulerService()


async def generate_daily_reports(metadata: Dict):
    """Generate daily energy reports."""
    logger.info("Generating daily reports...")


async def refresh_materialized_views(metadata: Dict):
    """Refresh database materialized views."""
    logger.info("Refreshing materialized views...")


async def cleanup_old_data(metadata: Dict):
    """Clean up old data based on retention policy."""
    logger.info("Cleaning up old data...")


async def send_billing_reminders(metadata: Dict):
    """Send billing reminder notifications."""
    logger.info("Sending billing reminders...")


async def run_hourly_aggregation(metadata: Dict):
    """Run hourly telemetry aggregation."""
    from app.core.database import SessionLocal
    from app.services.aggregation_service import AggregationService
    db = SessionLocal()
    try:
        service = AggregationService(db)
        result = await service.aggregate_hourly()
        db.commit()
        logger.info(f"Hourly aggregation: {result.aggregations_created} created, {result.aggregations_updated} updated")
    except Exception as e:
        db.rollback()
        logger.error(f"Hourly aggregation failed: {e}")
    finally:
        db.close()


async def run_daily_aggregation(metadata: Dict):
    """Run daily telemetry aggregation."""
    from app.core.database import SessionLocal
    from app.services.aggregation_service import AggregationService
    db = SessionLocal()
    try:
        service = AggregationService(db)
        result = await service.aggregate_daily()
        db.commit()
        logger.info(f"Daily aggregation: {result.aggregations_created} created, {result.aggregations_updated} updated")
    except Exception as e:
        db.rollback()
        logger.error(f"Daily aggregation failed: {e}")
    finally:
        db.close()


async def run_monthly_aggregation(metadata: Dict):
    """Run monthly telemetry aggregation."""
    from app.core.database import SessionLocal
    from app.services.aggregation_service import AggregationService
    db = SessionLocal()
    try:
        service = AggregationService(db)
        result = await service.aggregate_monthly()
        db.commit()
        logger.info(f"Monthly aggregation: {result.aggregations_created} created, {result.aggregations_updated} updated")
    except Exception as e:
        db.rollback()
        logger.error(f"Monthly aggregation failed: {e}")
    finally:
        db.close()


async def run_no_data_check(metadata: Dict):
    """Check for devices that stopped sending data."""
    alarm_engine = metadata.get("alarm_engine")
    if not alarm_engine:
        logger.warning("No AlarmEngine available for no-data check")
        return
    try:
        events = alarm_engine.check_no_data_conditions()
        alarm_engine.db.commit()
        if events:
            logger.info(f"No-data check: {len(events)} alarm events")
    except Exception as e:
        alarm_engine.db.rollback()
        logger.error(f"No-data check failed: {e}")


def register_default_tasks(alarm_engine: Optional["AlarmEngine"] = None):
    """Register default scheduled tasks."""
    scheduler_service.add_task(
        "daily_reports",
        "Daily Reports Generation",
        generate_daily_reports,
        ScheduleType.DAILY,
        run_at_hour=6,
        run_at_minute=0,
    )

    scheduler_service.add_task(
        "refresh_views",
        "Refresh Materialized Views",
        refresh_materialized_views,
        ScheduleType.INTERVAL,
        interval_minutes=60,
    )

    scheduler_service.add_task(
        "cleanup",
        "Data Cleanup",
        cleanup_old_data,
        ScheduleType.WEEKLY,
        day_of_week=0,
        run_at_hour=3,
    )

    scheduler_service.add_task(
        "billing_reminders",
        "Billing Reminders",
        send_billing_reminders,
        ScheduleType.MONTHLY,
        day_of_month=25,
        run_at_hour=9,
    )

    # Telemetry aggregation jobs
    scheduler_service.add_task(
        "hourly_aggregation",
        "Hourly Telemetry Aggregation",
        run_hourly_aggregation,
        ScheduleType.INTERVAL,
        interval_minutes=60,
    )

    scheduler_service.add_task(
        "daily_aggregation",
        "Daily Telemetry Aggregation",
        run_daily_aggregation,
        ScheduleType.DAILY,
        run_at_hour=2,
        run_at_minute=0,
    )

    scheduler_service.add_task(
        "monthly_aggregation",
        "Monthly Telemetry Aggregation",
        run_monthly_aggregation,
        ScheduleType.MONTHLY,
        day_of_month=1,
        run_at_hour=3,
        run_at_minute=0,
    )

    # No-data alarm check
    if alarm_engine:
        scheduler_service.add_task(
            "no_data_check",
            "No-Data Alarm Check",
            run_no_data_check,
            ScheduleType.INTERVAL,
            interval_minutes=5,
            metadata={"alarm_engine": alarm_engine},
        )
