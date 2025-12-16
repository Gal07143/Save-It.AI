"""Enterprise edition Pydantic schemas for DataSource, Measurement, Tenant, Lease, Invoice."""
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class DataSourceType(str, Enum):
    """Types of data sources for integration layer."""
    MODBUS_TCP = "modbus_tcp"
    MODBUS_RTU = "modbus_rtu"
    BACNET = "bacnet"
    CSV_IMPORT = "csv_import"
    EXTERNAL_API = "external_api"
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
    name: str = Field(..., min_length=1, max_length=255)
    source_type: DataSourceType
    host: Optional[str] = None
    port: Optional[int] = None
    slave_id: Optional[int] = None
    polling_interval_seconds: int = 60
    config_json: Optional[str] = None


class DataSourceResponse(BaseModel):
    """Response schema for data source."""
    id: int
    site_id: int
    name: str
    source_type: DataSourceType
    host: Optional[str] = None
    port: Optional[int] = None
    polling_interval_seconds: int
    is_active: bool
    last_poll_at: Optional[datetime] = None
    last_error: Optional[str] = None
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
