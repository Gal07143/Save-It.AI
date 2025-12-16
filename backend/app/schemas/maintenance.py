"""Predictive Maintenance Pydantic schemas."""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, ConfigDict
from enum import Enum


class MaintenanceRuleType(str, Enum):
    """Types of maintenance rules."""
    THRESHOLD = "threshold"
    ANOMALY = "anomaly"
    SCHEDULE = "schedule"
    RUNTIME = "runtime"
    EFFICIENCY = "efficiency"


class MaintenanceCondition(str, Enum):
    """Asset condition states."""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"


class MaintenanceAlertResponse(BaseModel):
    """Response schema for maintenance alerts."""
    id: int
    asset_id: int
    alert_type: MaintenanceRuleType
    severity: str
    title: str
    description: Optional[str] = None
    triggered_value: Optional[float] = None
    threshold_value: Optional[float] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssetConditionResponse(BaseModel):
    """Response schema for asset condition."""
    id: int
    asset_id: int
    condition: MaintenanceCondition
    health_score: float
    last_inspection_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None
    estimated_remaining_life_years: Optional[float] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MaintenanceScheduleCreate(BaseModel):
    """Schema for creating a maintenance schedule."""
    asset_id: int
    name: str
    frequency_days: int
    last_performed_date: Optional[date] = None
    next_due_date: Optional[date] = None
    notes: Optional[str] = None


class MaintenanceScheduleResponse(BaseModel):
    """Response schema for maintenance schedule."""
    id: int
    asset_id: int
    name: str
    frequency_days: int
    last_performed_date: Optional[date] = None
    next_due_date: Optional[date] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
