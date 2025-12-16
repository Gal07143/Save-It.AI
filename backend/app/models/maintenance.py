"""Predictive Maintenance models: MaintenanceRule, AssetCondition, MaintenanceAlert."""
from datetime import datetime, date
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text, Date
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class MaintenanceRuleType(PyEnum):
    """Types of predictive maintenance rules."""
    OVERLOAD = "overload"
    PF_DEGRADATION = "pf_degradation"
    TEMPERATURE = "temperature"
    POWER_QUALITY = "power_quality"
    USAGE_PATTERN = "usage_pattern"
    LIFECYCLE = "lifecycle"


class MaintenanceCondition(PyEnum):
    """Asset condition states."""
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"


class MaintenanceRule(Base):
    """Rules for predictive maintenance alerts."""
    __tablename__ = "maintenance_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(Enum(MaintenanceRuleType), nullable=False)
    condition_expression = Column(Text, nullable=False)
    threshold_value = Column(Float, nullable=True)
    severity = Column(String(20), default="warning")
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)


class AssetCondition(Base):
    """Tracks asset health/condition over time."""
    __tablename__ = "asset_conditions"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    condition = Column(Enum(MaintenanceCondition), default=MaintenanceCondition.GOOD)
    health_score = Column(Float, default=100.0)
    last_inspection_date = Column(Date, nullable=True)
    next_maintenance_date = Column(Date, nullable=True)
    estimated_remaining_life_years = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MaintenanceAlert(Base):
    """Predictive maintenance alerts."""
    __tablename__ = "maintenance_alerts"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    rule_id = Column(Integer, ForeignKey("maintenance_rules.id"), nullable=True, index=True)
    alert_type = Column(Enum(MaintenanceRuleType), nullable=False)
    severity = Column(String(20), default="warning")
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    triggered_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    status = Column(String(50), default="open")
    acknowledged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    evidence_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
