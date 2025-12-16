"""Data Quality Pydantic schemas."""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from enum import Enum


class QualityIssueType(str, Enum):
    """Types of data quality issues."""
    MISSING_DATA = "missing_data"
    SPIKE = "spike"
    FLATLINE = "flatline"
    NEGATIVE_VALUE = "negative_value"
    METER_ROLLBACK = "meter_rollback"
    OUT_OF_RANGE = "out_of_range"
    COMMUNICATION_FAILURE = "communication_failure"


class QualityIssueResponse(BaseModel):
    """Response schema for quality issues."""
    id: int
    meter_id: int
    issue_type: QualityIssueType
    severity: str
    timestamp_start: datetime
    timestamp_end: Optional[datetime] = None
    description: Optional[str] = None
    expected_value: Optional[float] = None
    actual_value: Optional[float] = None
    is_resolved: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QualityIssueUpdate(BaseModel):
    """Schema for updating a quality issue."""
    is_resolved: Optional[bool] = None
    resolution_notes: Optional[str] = None


class MeterQualitySummaryResponse(BaseModel):
    """Response schema for meter quality summaries."""
    id: int
    meter_id: int
    date: date
    expected_readings: int
    actual_readings: int
    coverage_percent: float
    quality_score: float
    issues_count: int
    gaps_minutes: int

    model_config = ConfigDict(from_attributes=True)


class DataQualityDashboard(BaseModel):
    """Dashboard summary for data quality."""
    total_meters: int
    meters_with_issues: int
    average_coverage: float
    average_quality_score: float
    open_issues_count: int
    critical_issues_count: int
    recent_issues: List[QualityIssueResponse]
