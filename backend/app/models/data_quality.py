"""Data Quality Engine models: DataQualityRule, QualityIssue, MeterQualitySummary."""
from datetime import datetime, date
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text, Date
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class QualityIssueType(PyEnum):
    """Types of data quality issues."""
    MISSING_DATA = "missing_data"
    DUPLICATE = "duplicate"
    METER_RESET = "meter_reset"
    SPIKE = "spike"
    OUTLIER = "outlier"
    NEGATIVE_VALUE = "negative_value"
    STALE_DATA = "stale_data"
    CONNECTIVITY_GAP = "connectivity_gap"


class DataQualityRule(Base):
    """Rules for data quality validation."""
    __tablename__ = "data_quality_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    issue_type = Column(Enum(QualityIssueType), nullable=False)
    rule_expression = Column(Text, nullable=False)
    severity = Column(String(20), default="warning")
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class QualityIssue(Base):
    """Detected data quality issues."""
    __tablename__ = "quality_issues"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=False, index=True)
    rule_id = Column(Integer, ForeignKey("data_quality_rules.id"), nullable=True, index=True)
    issue_type = Column(Enum(QualityIssueType), nullable=False, index=True)
    severity = Column(String(20), default="warning")
    timestamp_start = Column(DateTime, nullable=False, index=True)
    timestamp_end = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)
    expected_value = Column(Float, nullable=True)
    actual_value = Column(Float, nullable=True)
    is_resolved = Column(Integer, default=0)
    resolved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MeterQualitySummary(Base):
    """Daily quality summary per meter."""
    __tablename__ = "meter_quality_summaries"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    expected_readings = Column(Integer, default=0)
    actual_readings = Column(Integer, default=0)
    coverage_percent = Column(Float, default=0.0)
    quality_score = Column(Float, default=100.0)
    issues_count = Column(Integer, default=0)
    gaps_minutes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
