"""Enterprise models: DataSource, Measurement, Tenant, LeaseContract, Invoice, BatterySpecs."""
from datetime import datetime, date
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text, Date
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class DataSourceType(PyEnum):
    """Types of data sources for integration layer."""
    MODBUS_TCP = "modbus_tcp"
    MODBUS_RTU = "modbus_rtu"
    MQTT = "mqtt"
    HTTPS_WEBHOOK = "https_webhook"
    BACNET = "bacnet"
    CSV_IMPORT = "csv_import"
    EXTERNAL_API = "external_api"
    DIRECT_INVERTER = "direct_inverter"
    DIRECT_BESS = "direct_bess"
    MANUAL = "manual"


class InvoiceStatus(PyEnum):
    """Status of tenant invoices."""
    DRAFT = "draft"
    PENDING = "pending"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class DataSource(Base):
    """DataSource model for integration layer - connects to external systems."""
    __tablename__ = "data_sources"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    source_type = Column(Enum(DataSourceType), nullable=False)
    connection_string = Column(Text, nullable=True)
    host = Column(String(255), nullable=True)
    port = Column(Integer, nullable=True)
    slave_id = Column(Integer, nullable=True)
    polling_interval_seconds = Column(Integer, default=60)
    is_active = Column(Integer, default=1)
    last_poll_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    config_json = Column(Text, nullable=True)
    mqtt_broker_url = Column(String(500), nullable=True)
    mqtt_topic = Column(String(255), nullable=True)
    mqtt_username = Column(String(255), nullable=True)
    mqtt_password = Column(String(255), nullable=True)
    mqtt_port = Column(Integer, nullable=True)
    mqtt_use_tls = Column(Integer, default=0)
    webhook_url = Column(String(500), nullable=True)
    webhook_api_key = Column(String(255), nullable=True)
    webhook_auth_type = Column(String(50), nullable=True)
    max_retries = Column(Integer, default=5)
    retry_delay_seconds = Column(Integer, default=30)
    backoff_multiplier = Column(Float, default=2.0)
    current_retry_count = Column(Integer, default=0)
    next_retry_at = Column(DateTime, nullable=True)
    connection_status = Column(String(20), default="unknown")
    last_successful_poll_at = Column(DateTime, nullable=True)
    firmware_version = Column(String(50), nullable=True)
    firmware_updated_at = Column(DateTime, nullable=True)
    hardware_version = Column(String(50), nullable=True)
    serial_number = Column(String(100), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    measurements = relationship("Measurement", back_populates="data_source", cascade="all, delete-orphan")


class Measurement(Base):
    """Measurement model for normalized meter readings from all data sources.
    
    This table should be converted to a TimescaleDB hypertable for high-frequency data.
    """
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=False, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    value = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    quality = Column(String(20), default="good")
    raw_value = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    data_source = relationship("DataSource", back_populates="measurements")


class Tenant(Base):
    """Tenant model for sub-billing in multi-tenant facilities."""
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    billing_address = Column(Text, nullable=True)
    tax_id = Column(String(100), nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lease_contracts = relationship("LeaseContract", back_populates="tenant", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="tenant", cascade="all, delete-orphan")


class LeaseContract(Base):
    """LeaseContract model defining billing rules for a tenant."""
    __tablename__ = "lease_contracts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    rate_per_kwh = Column(Float, nullable=False)
    fixed_monthly_fee = Column(Float, default=0.0)
    loss_factor_percent = Column(Float, default=0.0)
    demand_charge_per_kw = Column(Float, default=0.0)
    min_monthly_charge = Column(Float, default=0.0)
    billing_day = Column(Integer, default=1)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="lease_contracts")


class Invoice(Base):
    """Invoice model for tenant billing."""
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    lease_contract_id = Column(Integer, ForeignKey("lease_contracts.id"), nullable=True, index=True)
    invoice_number = Column(String(100), unique=True, nullable=False, index=True)
    billing_period_start = Column(Date, nullable=False)
    billing_period_end = Column(Date, nullable=False)
    consumption_kwh = Column(Float, default=0.0)
    peak_demand_kw = Column(Float, nullable=True)
    energy_charge = Column(Float, default=0.0)
    demand_charge = Column(Float, default=0.0)
    fixed_fee = Column(Float, default=0.0)
    loss_charge = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT)
    due_date = Column(Date, nullable=True)
    paid_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="invoices")


class BatterySpecs(Base):
    """BatterySpecs model for BESS financial analysis."""
    __tablename__ = "battery_specs"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    capacity_kwh = Column(Float, nullable=False)
    power_rating_kw = Column(Float, nullable=False)
    round_trip_efficiency = Column(Float, default=0.90)
    depth_of_discharge = Column(Float, default=0.90)
    cycle_life = Column(Integer, default=6000)
    capex_total = Column(Float, nullable=False)
    opex_annual = Column(Float, default=0.0)
    warranty_years = Column(Integer, default=10)
    degradation_rate_annual = Column(Float, default=0.02)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
