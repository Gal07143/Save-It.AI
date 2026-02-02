"""Enterprise edition Pydantic schemas for DataSource, Measurement, Tenant, Lease, Invoice."""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class GatewaySummary(BaseModel):
    """Summary of gateway for embedding in data source responses."""
    id: int
    name: str
    status: str
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    last_seen_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class DataSourceType(str, Enum):
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


class InvoiceStatus(str, Enum):
    """Status of tenant invoices."""
    DRAFT = "draft"
    PENDING = "pending"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class DataSourceCreate(BaseModel):
    """Schema for creating a data source."""
    site_id: int
    gateway_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    source_type: DataSourceType
    host: Optional[str] = None
    port: Optional[int] = None
    slave_id: Optional[int] = None
    polling_interval_seconds: int = 60
    config_json: Optional[str] = None
    mqtt_broker_url: Optional[str] = None
    mqtt_topic: Optional[str] = None
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None
    mqtt_port: Optional[int] = None
    mqtt_use_tls: Optional[int] = 0
    webhook_url: Optional[str] = None
    webhook_api_key: Optional[str] = None
    webhook_auth_type: Optional[str] = None


class DataSourceUpdate(BaseModel):
    """Schema for updating a data source."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    gateway_id: Optional[int] = None
    host: Optional[str] = None
    port: Optional[int] = None
    slave_id: Optional[int] = None
    polling_interval_seconds: Optional[int] = None
    is_active: Optional[int] = None
    mqtt_broker_url: Optional[str] = None
    mqtt_topic: Optional[str] = None
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None
    mqtt_port: Optional[int] = None
    mqtt_use_tls: Optional[int] = None
    webhook_url: Optional[str] = None
    webhook_api_key: Optional[str] = None
    webhook_auth_type: Optional[str] = None


class DataSourceResponse(BaseModel):
    """Response schema for data source."""
    id: int
    site_id: int
    gateway_id: Optional[int] = None
    gateway: Optional[GatewaySummary] = None
    name: str
    source_type: DataSourceType
    host: Optional[str] = None
    port: Optional[int] = None
    slave_id: Optional[int] = None
    polling_interval_seconds: int
    is_active: bool
    last_poll_at: Optional[datetime] = None
    last_error: Optional[str] = None
    mqtt_broker_url: Optional[str] = None
    mqtt_topic: Optional[str] = None
    mqtt_port: Optional[int] = None
    mqtt_use_tls: Optional[int] = None
    webhook_url: Optional[str] = None
    webhook_auth_type: Optional[str] = None
    max_retries: Optional[int] = 5
    retry_delay_seconds: Optional[int] = 30
    backoff_multiplier: Optional[float] = 2.0
    current_retry_count: Optional[int] = 0
    next_retry_at: Optional[datetime] = None
    connection_status: Optional[str] = "unknown"
    last_successful_poll_at: Optional[datetime] = None
    firmware_version: Optional[str] = None
    firmware_updated_at: Optional[datetime] = None
    hardware_version: Optional[str] = None
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MeasurementCreate(BaseModel):
    """Schema for normalized measurement data."""
    data_source_id: int
    meter_id: Optional[int] = None
    timestamp: datetime
    value: float
    unit: str
    quality: str = "good"
    raw_value: Optional[float] = None


class MeasurementResponse(BaseModel):
    """Response schema for measurement data."""
    id: int
    data_source_id: int
    meter_id: Optional[int] = None
    timestamp: datetime
    value: float
    unit: str
    quality: str
    raw_value: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TenantCreate(BaseModel):
    """Schema for creating a tenant."""
    site_id: int
    name: str = Field(..., min_length=1, max_length=255)
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    billing_address: Optional[str] = None
    tax_id: Optional[str] = None


class TenantUpdate(BaseModel):
    """Schema for updating a tenant."""
    site_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    billing_address: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: Optional[bool] = None


class TenantResponse(BaseModel):
    """Response schema for tenant."""
    id: int
    site_id: int
    name: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    billing_address: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaseContractCreate(BaseModel):
    """Schema for creating a lease contract."""
    tenant_id: int
    meter_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    start_date: date
    end_date: Optional[date] = None
    rate_per_kwh: float
    fixed_monthly_fee: float = 0.0
    loss_factor_percent: float = 0.0
    demand_charge_per_kw: float = 0.0
    min_monthly_charge: float = 0.0
    billing_day: int = 1


class LeaseContractResponse(BaseModel):
    """Response schema for lease contract."""
    id: int
    tenant_id: int
    meter_id: Optional[int] = None
    name: str
    start_date: date
    end_date: Optional[date] = None
    rate_per_kwh: float
    fixed_monthly_fee: float
    loss_factor_percent: float
    demand_charge_per_kw: float
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceResponse(BaseModel):
    """Response schema for invoice."""
    id: int
    tenant_id: int
    invoice_number: str
    billing_period_start: date
    billing_period_end: date
    consumption_kwh: float
    peak_demand_kw: Optional[float] = None
    energy_charge: float
    demand_charge: float
    fixed_fee: float
    loss_charge: float
    subtotal: float
    tax_amount: float
    total_amount: float
    status: InvoiceStatus
    due_date: Optional[date] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
