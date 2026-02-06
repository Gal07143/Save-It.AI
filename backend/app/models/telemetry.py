"""
Telemetry & Alarm models for time-series data management.
Includes aggregation tables, device alarms, and KPI definitions.
"""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Float,
    Enum, Text, Index, BigInteger
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class AlarmStatus(PyEnum):
    """Status of device alarms."""
    TRIGGERED = "triggered"
    ACKNOWLEDGED = "acknowledged"
    CLEARED = "cleared"
    AUTO_CLEARED = "auto_cleared"


class AggregationPeriod(PyEnum):
    """Time periods for data aggregation."""
    HOURLY = "hourly"
    DAILY = "daily"
    MONTHLY = "monthly"


class KPIType(PyEnum):
    """Types of KPI calculations."""
    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    COUNT = "count"
    FORMULA = "formula"


class DeviceAlarm(Base):
    """
    Device Alarm - Active and historical alarms.
    Separate from DeviceEvent for dedicated alarm tracking with status management.
    """
    __tablename__ = "device_alarms"

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    alarm_rule_id = Column(Integer, ForeignKey("alarm_rules.id"), nullable=False, index=True)
    datapoint_id = Column(Integer, ForeignKey("datapoints.id"), nullable=True, index=True)

    status = Column(Enum(AlarmStatus), default=AlarmStatus.TRIGGERED, index=True)
    severity = Column(String(20), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)

    # Trigger information
    trigger_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    condition = Column(String(20), nullable=True)

    # Timing
    triggered_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    cleared_at = Column(DateTime, nullable=True)

    # Duration tracking (for duration-based alarms)
    duration_start_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)

    # User actions
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    cleared_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)

    # Notification tracking
    notification_sent = Column(Integer, default=0)
    notification_sent_at = Column(DateTime, nullable=True)

    # Metadata
    data_json = Column(Text, nullable=True)  # Additional alarm context

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_device_alarm_device_status", "device_id", "status"),
        Index("ix_device_alarm_triggered", "triggered_at"),
        Index("ix_device_alarm_severity_status", "severity", "status"),
    )


class TelemetryAggregation(Base):
    """
    Telemetry Aggregation - Pre-computed rollups for efficient querying.
    Stores hourly, daily, and monthly aggregated values.
    """
    __tablename__ = "telemetry_aggregations"

    id = Column(BigInteger, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    datapoint_id = Column(Integer, ForeignKey("datapoints.id", ondelete="CASCADE"), nullable=False, index=True)

    period = Column(Enum(AggregationPeriod), nullable=False, index=True)
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)

    # Aggregated values
    value_min = Column(Float, nullable=True)
    value_max = Column(Float, nullable=True)
    value_avg = Column(Float, nullable=True)
    value_sum = Column(Float, nullable=True)
    value_count = Column(Integer, default=0)
    value_first = Column(Float, nullable=True)
    value_last = Column(Float, nullable=True)

    # Quality metrics
    quality_good_count = Column(Integer, default=0)
    quality_bad_count = Column(Integer, default=0)
    gap_count = Column(Integer, default=0)  # Number of missing expected readings

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_agg_device_datapoint_period", "device_id", "datapoint_id", "period", "period_start"),
        Index("ix_agg_period_start", "period", "period_start"),
    )


class KPIDefinition(Base):
    """
    KPI Definition - Configurable key performance indicators.
    Can use simple aggregations or formula expressions.
    """
    __tablename__ = "kpi_definitions"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)

    name = Column(String(100), nullable=False)
    display_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    kpi_type = Column(Enum(KPIType), nullable=False)

    # For simple aggregations
    source_device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    source_datapoint_id = Column(Integer, ForeignKey("datapoints.id"), nullable=True)

    # For formula-based KPIs
    formula = Column(Text, nullable=True)  # e.g., "var1 + var2 * 0.95"
    formula_variables = Column(Text, nullable=True)  # JSON mapping variable names to device/datapoint

    # Display settings
    unit = Column(String(50), nullable=True)
    precision = Column(Integer, default=2)
    icon = Column(String(100), nullable=True)
    color = Column(String(7), nullable=True)

    # Thresholds for visual indicators
    warning_min = Column(Float, nullable=True)
    warning_max = Column(Float, nullable=True)
    critical_min = Column(Float, nullable=True)
    critical_max = Column(Float, nullable=True)

    # Scheduling
    calculation_interval = Column(String(20), default="hourly")  # hourly, daily, on_demand
    last_calculated_at = Column(DateTime, nullable=True)

    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class KPIValue(Base):
    """
    KPI Value - Stored calculated KPI values over time.
    """
    __tablename__ = "kpi_values"

    id = Column(BigInteger, primary_key=True, index=True)
    kpi_id = Column(Integer, ForeignKey("kpi_definitions.id", ondelete="CASCADE"), nullable=False, index=True)

    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)

    value = Column(Float, nullable=True)
    status = Column(String(20), default="normal")  # normal, warning, critical

    # Calculation metadata
    data_points_used = Column(Integer, default=0)
    calculation_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_kpi_value_kpi_period", "kpi_id", "period_start"),
    )


class NoDataTracker(Base):
    """
    No Data Tracker - Tracks last data receipt time for no_data alarm detection.
    Lightweight table for efficient no-data checks.
    """
    __tablename__ = "no_data_trackers"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    datapoint_id = Column(Integer, ForeignKey("datapoints.id", ondelete="CASCADE"), nullable=True, index=True)

    last_data_at = Column(DateTime, nullable=False, index=True)
    expected_interval_seconds = Column(Integer, default=300)  # Expected data frequency

    # For no_data alarm rules
    alarm_rule_id = Column(Integer, ForeignKey("alarm_rules.id"), nullable=True)
    alarm_triggered = Column(Integer, default=0)
    alarm_triggered_at = Column(DateTime, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_no_data_device_datapoint", "device_id", "datapoint_id"),
    )
