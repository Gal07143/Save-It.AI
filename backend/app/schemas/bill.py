"""Pydantic schemas for Bill model."""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class BillLineItemBase(BaseModel):
    """Base schema for BillLineItem."""
    description: str
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    amount: float


class BillLineItemCreate(BillLineItemBase):
    """Schema for creating a BillLineItem."""
    pass


class BillLineItemResponse(BillLineItemBase):
    """Schema for BillLineItem response."""
    id: int
    bill_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class BillBase(BaseModel):
    """Base schema for Bill."""
    bill_number: Optional[str] = None
    provider_name: Optional[str] = None
    period_start: date
    period_end: date
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    total_kwh: float
    total_amount: float
    currency: str = "USD"
    peak_kwh: Optional[float] = None
    off_peak_kwh: Optional[float] = None
    demand_kw: Optional[float] = None
    power_factor_penalty: Optional[float] = None
    taxes: Optional[float] = None
    other_charges: Optional[float] = None
    notes: Optional[str] = None


class BillCreate(BillBase):
    """Schema for creating a new Bill."""
    site_id: int
    tariff_id: Optional[int] = None
    line_items: List[BillLineItemCreate] = []


class BillUpdate(BaseModel):
    """Schema for updating a Bill."""
    bill_number: Optional[str] = None
    provider_name: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    total_kwh: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    tariff_id: Optional[int] = None
    notes: Optional[str] = None


class BillResponse(BillBase):
    """Schema for Bill response."""
    id: int
    site_id: int
    tariff_id: Optional[int] = None
    is_validated: bool
    validation_variance_pct: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    line_items: List[BillLineItemResponse] = []

    class Config:
        from_attributes = True


class BillValidationResult(BaseModel):
    """Schema for bill validation result."""
    bill_id: int
    is_valid: bool
    bill_total_kwh: float
    meter_total_kwh: float
    variance_kwh: float
    variance_percentage: float
    message: str
