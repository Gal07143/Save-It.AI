"""
Maintenance Service for SAVE-IT.AI
Predictive and scheduled maintenance:
- Maintenance schedules
- Work orders
- Maintenance history
- Predictive alerts
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float

from app.core.database import Base

logger = logging.getLogger(__name__)


class MaintenanceType(Enum):
    """Types of maintenance."""
    PREVENTIVE = "preventive"  # Scheduled maintenance
    CORRECTIVE = "corrective"  # Repair after failure
    PREDICTIVE = "predictive"  # Based on condition monitoring
    EMERGENCY = "emergency"    # Urgent repair


class MaintenancePriority(Enum):
    """Maintenance priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MaintenanceStatus(Enum):
    """Work order status."""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class MaintenanceSchedule(Base):
    """Recurring maintenance schedule."""
    __tablename__ = "maintenance_schedules"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    maintenance_type = Column(String(20), default="preventive")

    # Schedule configuration
    frequency_days = Column(Integer, nullable=True)  # Days between maintenance
    frequency_hours = Column(Float, nullable=True)   # Operating hours between maintenance
    cron_expression = Column(String(100), nullable=True)  # For complex schedules

    # Task details
    tasks = Column(Text, nullable=True)  # JSON array of maintenance tasks
    estimated_duration_minutes = Column(Integer, default=60)
    required_parts = Column(Text, nullable=True)  # JSON array of parts

    # Notifications
    advance_notice_days = Column(Integer, default=7)
    notify_users = Column(Text, nullable=True)  # JSON array of user IDs

    is_active = Column(Integer, default=1)
    last_completed_at = Column(DateTime, nullable=True)
    next_due_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkOrder(Base):
    """Maintenance work order."""
    __tablename__ = "work_orders"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    schedule_id = Column(Integer, ForeignKey("maintenance_schedules.id"), nullable=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    maintenance_type = Column(String(20), nullable=False)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="scheduled", index=True)

    # Assignment
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=True)

    # Scheduling
    scheduled_start = Column(DateTime, nullable=True)
    scheduled_end = Column(DateTime, nullable=True)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)

    # Details
    tasks = Column(Text, nullable=True)  # JSON array
    parts_used = Column(Text, nullable=True)  # JSON array
    labor_hours = Column(Float, nullable=True)
    cost = Column(Float, nullable=True)

    # Notes and attachments
    technician_notes = Column(Text, nullable=True)
    resolution = Column(Text, nullable=True)
    attachments = Column(Text, nullable=True)  # JSON array of file paths

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MaintenanceHistory(Base):
    """Historical maintenance records."""
    __tablename__ = "maintenance_history"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True)

    maintenance_type = Column(String(20), nullable=False)
    description = Column(Text, nullable=True)

    performed_at = Column(DateTime, nullable=False)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    parts_replaced = Column(Text, nullable=True)  # JSON
    measurements = Column(Text, nullable=True)  # JSON of readings taken
    cost = Column(Float, nullable=True)
    duration_minutes = Column(Integer, nullable=True)

    next_maintenance_due = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


@dataclass
class MaintenancePrediction:
    """Predictive maintenance recommendation."""
    device_id: int
    device_name: str
    prediction_type: str
    confidence: float
    recommended_action: str
    recommended_date: datetime
    factors: List[Dict[str, Any]]


@dataclass
class MaintenanceSummary:
    """Maintenance summary statistics."""
    total_scheduled: int
    total_completed: int
    total_overdue: int
    avg_completion_time: float
    mtbf_hours: Optional[float]  # Mean time between failures
    mttr_hours: Optional[float]  # Mean time to repair


class MaintenanceService:
    """
    Maintenance management service.
    Handles scheduling, work orders, and predictive maintenance.
    """

    def __init__(self, db: Session):
        self.db = db

    def create_schedule(
        self,
        organization_id: int,
        name: str,
        frequency_days: Optional[int] = None,
        frequency_hours: Optional[float] = None,
        device_id: Optional[int] = None,
        site_id: Optional[int] = None,
        tasks: Optional[List[str]] = None,
        **kwargs
    ) -> MaintenanceSchedule:
        """
        Create a maintenance schedule.

        Args:
            organization_id: Organization ID
            name: Schedule name
            frequency_days: Days between maintenance
            frequency_hours: Operating hours between maintenance
            device_id: Specific device (optional)
            site_id: Site scope
            tasks: List of maintenance tasks

        Returns:
            Created MaintenanceSchedule
        """
        schedule = MaintenanceSchedule(
            organization_id=organization_id,
            name=name,
            device_id=device_id,
            site_id=site_id,
            frequency_days=frequency_days,
            frequency_hours=frequency_hours,
            tasks=json.dumps(tasks) if tasks else None,
            **kwargs
        )

        # Calculate next due date
        if frequency_days:
            schedule.next_due_at = datetime.utcnow() + timedelta(days=frequency_days)

        self.db.add(schedule)
        self.db.flush()

        logger.info(f"Created maintenance schedule: {name} (ID: {schedule.id})")

        return schedule

    def create_work_order(
        self,
        organization_id: int,
        title: str,
        maintenance_type: MaintenanceType,
        priority: MaintenancePriority = MaintenancePriority.MEDIUM,
        device_id: Optional[int] = None,
        site_id: Optional[int] = None,
        scheduled_start: Optional[datetime] = None,
        assigned_to: Optional[int] = None,
        tasks: Optional[List[str]] = None,
        created_by: Optional[int] = None,
        **kwargs
    ) -> WorkOrder:
        """
        Create a maintenance work order.

        Args:
            organization_id: Organization ID
            title: Work order title
            maintenance_type: Type of maintenance
            priority: Priority level
            device_id: Device to maintain
            site_id: Site location
            scheduled_start: Scheduled start time
            assigned_to: Assigned technician
            tasks: List of tasks
            created_by: User creating the order

        Returns:
            Created WorkOrder
        """
        work_order = WorkOrder(
            organization_id=organization_id,
            title=title,
            maintenance_type=maintenance_type.value,
            priority=priority.value,
            device_id=device_id,
            site_id=site_id,
            scheduled_start=scheduled_start or datetime.utcnow(),
            assigned_to=assigned_to,
            assigned_at=datetime.utcnow() if assigned_to else None,
            tasks=json.dumps(tasks) if tasks else None,
            created_by=created_by,
            status=MaintenanceStatus.SCHEDULED.value,
            **kwargs
        )

        self.db.add(work_order)
        self.db.flush()

        logger.info(f"Created work order: {title} (ID: {work_order.id})")

        return work_order

    def start_work_order(
        self,
        work_order_id: int,
        technician_id: Optional[int] = None
    ) -> Optional[WorkOrder]:
        """Start a work order."""
        work_order = self.db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id
        ).first()

        if not work_order:
            return None

        work_order.status = MaintenanceStatus.IN_PROGRESS.value
        work_order.actual_start = datetime.utcnow()

        if technician_id and not work_order.assigned_to:
            work_order.assigned_to = technician_id
            work_order.assigned_at = datetime.utcnow()

        return work_order

    def complete_work_order(
        self,
        work_order_id: int,
        resolution: str,
        parts_used: Optional[List[Dict]] = None,
        labor_hours: Optional[float] = None,
        cost: Optional[float] = None,
        technician_notes: Optional[str] = None
    ) -> Optional[WorkOrder]:
        """
        Complete a work order.

        Args:
            work_order_id: Work order ID
            resolution: Resolution description
            parts_used: Parts used
            labor_hours: Hours worked
            cost: Total cost
            technician_notes: Additional notes

        Returns:
            Updated WorkOrder
        """
        work_order = self.db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id
        ).first()

        if not work_order:
            return None

        work_order.status = MaintenanceStatus.COMPLETED.value
        work_order.actual_end = datetime.utcnow()
        work_order.resolution = resolution
        work_order.parts_used = json.dumps(parts_used) if parts_used else None
        work_order.labor_hours = labor_hours
        work_order.cost = cost
        work_order.technician_notes = technician_notes

        # Record in history
        if work_order.device_id:
            history = MaintenanceHistory(
                device_id=work_order.device_id,
                work_order_id=work_order.id,
                maintenance_type=work_order.maintenance_type,
                description=resolution,
                performed_at=datetime.utcnow(),
                performed_by=work_order.assigned_to,
                parts_replaced=work_order.parts_used,
                cost=cost,
                duration_minutes=int(labor_hours * 60) if labor_hours else None
            )
            self.db.add(history)

        # Update schedule if linked
        if work_order.schedule_id:
            schedule = self.db.query(MaintenanceSchedule).filter(
                MaintenanceSchedule.id == work_order.schedule_id
            ).first()
            if schedule:
                schedule.last_completed_at = datetime.utcnow()
                if schedule.frequency_days:
                    schedule.next_due_at = datetime.utcnow() + timedelta(days=schedule.frequency_days)

        logger.info(f"Completed work order {work_order_id}")

        return work_order

    def get_due_maintenance(
        self,
        organization_id: int,
        days_ahead: int = 7
    ) -> List[MaintenanceSchedule]:
        """Get maintenance schedules due within specified days."""
        cutoff = datetime.utcnow() + timedelta(days=days_ahead)

        return self.db.query(MaintenanceSchedule).filter(
            MaintenanceSchedule.organization_id == organization_id,
            MaintenanceSchedule.is_active == 1,
            MaintenanceSchedule.next_due_at <= cutoff
        ).order_by(MaintenanceSchedule.next_due_at.asc()).all()

    def get_overdue_work_orders(
        self,
        organization_id: int
    ) -> List[WorkOrder]:
        """Get overdue work orders."""
        now = datetime.utcnow()

        return self.db.query(WorkOrder).filter(
            WorkOrder.organization_id == organization_id,
            WorkOrder.status.in_([MaintenanceStatus.SCHEDULED.value, MaintenanceStatus.IN_PROGRESS.value]),
            WorkOrder.scheduled_end < now
        ).all()

    def predict_maintenance(
        self,
        device_id: int
    ) -> Optional[MaintenancePrediction]:
        """
        Generate predictive maintenance recommendation.

        Args:
            device_id: Device to analyze

        Returns:
            MaintenancePrediction or None
        """
        from app.models.devices import Device, DeviceTelemetry

        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return None

        factors = []
        confidence = 0.5

        # Check maintenance history
        history = self.db.query(MaintenanceHistory).filter(
            MaintenanceHistory.device_id == device_id
        ).order_by(MaintenanceHistory.performed_at.desc()).limit(5).all()

        if history:
            # Calculate average time between maintenance
            intervals = []
            for i in range(len(history) - 1):
                interval = (history[i].performed_at - history[i+1].performed_at).days
                intervals.append(interval)

            if intervals:
                avg_interval = sum(intervals) / len(intervals)
                days_since_last = (datetime.utcnow() - history[0].performed_at).days

                if days_since_last > avg_interval * 1.2:
                    factors.append({
                        "factor": "time_since_maintenance",
                        "value": days_since_last,
                        "threshold": avg_interval,
                        "impact": "high"
                    })
                    confidence += 0.2

        # Check recent telemetry for anomalies
        recent_telemetry = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.timestamp >= datetime.utcnow() - timedelta(days=7)
        ).all()

        # Simplified anomaly detection
        if len(recent_telemetry) > 10:
            values = [t.value for t in recent_telemetry if isinstance(t.value, (int, float))]
            if values:
                avg_val = sum(values) / len(values)
                # Check for significant deviations
                deviations = [abs(v - avg_val) / avg_val for v in values if avg_val != 0]
                if deviations and max(deviations) > 0.3:
                    factors.append({
                        "factor": "telemetry_anomaly",
                        "value": max(deviations),
                        "threshold": 0.3,
                        "impact": "medium"
                    })
                    confidence += 0.15

        # Check device age/operating hours
        if device.created_at:
            age_days = (datetime.utcnow() - device.created_at).days
            if age_days > 365:
                factors.append({
                    "factor": "device_age",
                    "value": age_days,
                    "threshold": 365,
                    "impact": "low"
                })
                confidence += 0.1

        if not factors:
            return None

        # Determine recommended action and date
        if confidence > 0.7:
            recommended_action = "Schedule immediate inspection"
            recommended_date = datetime.utcnow() + timedelta(days=3)
        elif confidence > 0.5:
            recommended_action = "Plan maintenance within 2 weeks"
            recommended_date = datetime.utcnow() + timedelta(days=14)
        else:
            recommended_action = "Monitor closely"
            recommended_date = datetime.utcnow() + timedelta(days=30)

        return MaintenancePrediction(
            device_id=device_id,
            device_name=device.name,
            prediction_type="predictive",
            confidence=min(confidence, 1.0),
            recommended_action=recommended_action,
            recommended_date=recommended_date,
            factors=factors
        )

    def get_summary(
        self,
        organization_id: int,
        days: int = 30
    ) -> MaintenanceSummary:
        """Get maintenance summary statistics."""
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Query work orders
        work_orders = self.db.query(WorkOrder).filter(
            WorkOrder.organization_id == organization_id,
            WorkOrder.created_at >= cutoff
        ).all()

        scheduled = sum(1 for wo in work_orders if wo.status == MaintenanceStatus.SCHEDULED.value)
        completed = sum(1 for wo in work_orders if wo.status == MaintenanceStatus.COMPLETED.value)
        overdue = sum(1 for wo in work_orders
                     if wo.status in [MaintenanceStatus.SCHEDULED.value, MaintenanceStatus.IN_PROGRESS.value]
                     and wo.scheduled_end and wo.scheduled_end < datetime.utcnow())

        # Calculate average completion time
        completion_times = []
        for wo in work_orders:
            if wo.status == MaintenanceStatus.COMPLETED.value and wo.actual_start and wo.actual_end:
                duration = (wo.actual_end - wo.actual_start).total_seconds() / 3600
                completion_times.append(duration)

        avg_completion = sum(completion_times) / len(completion_times) if completion_times else 0

        return MaintenanceSummary(
            total_scheduled=scheduled,
            total_completed=completed,
            total_overdue=overdue,
            avg_completion_time=round(avg_completion, 2),
            mtbf_hours=None,  # Would need failure tracking
            mttr_hours=round(avg_completion, 2) if completion_times else None
        )

    def generate_scheduled_work_orders(self) -> int:
        """Generate work orders from due schedules."""
        now = datetime.utcnow()

        due_schedules = self.db.query(MaintenanceSchedule).filter(
            MaintenanceSchedule.is_active == 1,
            MaintenanceSchedule.next_due_at <= now
        ).all()

        created = 0

        for schedule in due_schedules:
            # Check if work order already exists
            existing = self.db.query(WorkOrder).filter(
                WorkOrder.schedule_id == schedule.id,
                WorkOrder.status.in_([MaintenanceStatus.SCHEDULED.value, MaintenanceStatus.IN_PROGRESS.value])
            ).first()

            if not existing:
                work_order = WorkOrder(
                    organization_id=schedule.organization_id,
                    schedule_id=schedule.id,
                    device_id=schedule.device_id,
                    site_id=schedule.site_id,
                    title=f"Scheduled: {schedule.name}",
                    description=schedule.description,
                    maintenance_type=schedule.maintenance_type or MaintenanceType.PREVENTIVE.value,
                    priority=MaintenancePriority.MEDIUM.value,
                    status=MaintenanceStatus.SCHEDULED.value,
                    scheduled_start=now,
                    scheduled_end=now + timedelta(minutes=schedule.estimated_duration_minutes or 60),
                    tasks=schedule.tasks
                )

                self.db.add(work_order)
                created += 1

        logger.info(f"Generated {created} work orders from schedules")

        return created


def get_maintenance_service(db: Session) -> MaintenanceService:
    """Get MaintenanceService instance."""
    return MaintenanceService(db)
