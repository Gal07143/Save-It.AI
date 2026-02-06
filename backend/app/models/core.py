"""Core models: Site, Asset, Meter, MeterReading, Bill, BillLineItem, Tariff, TariffRate, Notification."""
from datetime import datetime, date, time

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text, Date, Time
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.models.base import AssetType, NotificationType, SoftDeleteMixin, BooleanInt


class Site(SoftDeleteMixin, Base):
    """Site model representing a physical facility or location."""
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    timezone = Column(String(50), default="UTC")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assets = relationship("Asset", back_populates="site", cascade="all, delete-orphan")
    meters = relationship("Meter", back_populates="site", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="site", cascade="all, delete-orphan")
    tariffs = relationship("Tariff", back_populates="site", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="site", cascade="all, delete-orphan")


class Asset(SoftDeleteMixin, Base):
    """Asset model representing electrical components in the SLD hierarchy."""
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("assets.id"), nullable=True, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    asset_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    rated_capacity_kw = Column(Float, nullable=True)
    rated_voltage = Column(Float, nullable=True)
    rated_current = Column(Float, nullable=True)
    is_critical = Column(Integer, default=0)
    requires_metering = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="assets")
    parent = relationship("Asset", remote_side=[id], back_populates="children")
    children = relationship("Asset", back_populates="parent", cascade="all, delete-orphan")
    meter = relationship("Meter", back_populates="asset", uselist=False)
    data_source = relationship("DataSource")


class Meter(SoftDeleteMixin, Base):
    """Meter model representing a physical energy meter device."""
    __tablename__ = "meters"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=True, index=True)
    meter_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    manufacturer = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    is_active = Column(BooleanInt, default=True)
    is_bidirectional = Column(BooleanInt, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="meters")
    asset = relationship("Asset", back_populates="meter")
    data_source = relationship("DataSource")
    readings = relationship("MeterReading", back_populates="meter", cascade="all, delete-orphan")


class MeterReading(Base):
    """MeterReading model for time-series energy data."""
    __tablename__ = "meter_readings"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    energy_kwh = Column(Float, nullable=False)
    power_kw = Column(Float, nullable=True)
    voltage = Column(Float, nullable=True)
    current = Column(Float, nullable=True)
    power_factor = Column(Float, nullable=True)
    reactive_power_kvar = Column(Float, nullable=True)
    apparent_power_kva = Column(Float, nullable=True)
    reading_type = Column(String(50), default="interval")
    created_at = Column(DateTime, default=datetime.utcnow)

    meter = relationship("Meter", back_populates="readings")


class Bill(Base):
    """Bill model representing a utility bill for a site."""
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=True, index=True)
    bill_number = Column(String(100), nullable=True, index=True)
    provider_name = Column(String(255), nullable=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    issue_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    total_kwh = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(10), default="USD")
    peak_kwh = Column(Float, nullable=True)
    off_peak_kwh = Column(Float, nullable=True)
    demand_kw = Column(Float, nullable=True)
    power_factor_penalty = Column(Float, nullable=True)
    taxes = Column(Float, nullable=True)
    other_charges = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    is_validated = Column(Integer, default=0)
    validation_variance_pct = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="bills")
    tariff = relationship("Tariff", back_populates="bills")
    line_items = relationship("BillLineItem", back_populates="bill", cascade="all, delete-orphan")


class BillLineItem(Base):
    """BillLineItem model for detailed bill breakdown."""
    __tablename__ = "bill_line_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    quantity = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    unit_price = Column(Float, nullable=True)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="line_items")


class Tariff(Base):
    """Tariff model representing a utility pricing structure."""
    __tablename__ = "tariffs"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    provider_name = Column(String(255), nullable=True)
    supplier = Column(String(255), nullable=True)
    tariff_type = Column(String(50), default="flat")
    effective_from = Column(DateTime, nullable=True)
    effective_to = Column(DateTime, nullable=True)
    currency = Column(String(10), default="USD")
    fixed_charge = Column(Float, default=0.0)
    base_rate = Column(Float, nullable=True)
    peak_rate = Column(Float, nullable=True)
    off_peak_rate = Column(Float, nullable=True)
    demand_charge = Column(Float, nullable=True)
    demand_charge_per_kw = Column(Float, nullable=True)
    export_rate = Column(Float, nullable=True)
    power_factor_threshold = Column(Float, nullable=True)
    power_factor_penalty_rate = Column(Float, nullable=True)
    is_active = Column(BooleanInt, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="tariffs")
    rates = relationship("TariffRate", back_populates="tariff", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="tariff")


class TariffRate(Base):
    """TariffRate model for time-of-use pricing periods."""
    __tablename__ = "tariff_rates"

    id = Column(Integer, primary_key=True, index=True)
    tariff_id = Column(Integer, ForeignKey("tariffs.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    rate_per_kwh = Column(Float, nullable=False)
    time_start = Column(Time, nullable=True)
    time_end = Column(Time, nullable=True)
    days_of_week = Column(String(50), nullable=True)
    season = Column(String(50), nullable=True)
    tier_min_kwh = Column(Float, nullable=True)
    tier_max_kwh = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tariff = relationship("Tariff", back_populates="rates")


class Notification(Base):
    """Notification model for AI-generated alerts."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True, index=True)
    notification_type = Column(Enum(NotificationType), nullable=False)
    severity = Column(String(20), default="info")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Integer, default=0)
    is_resolved = Column(Integer, default=0)
    agent_name = Column(String(100), nullable=True)
    extra_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    site = relationship("Site", back_populates="notifications")
