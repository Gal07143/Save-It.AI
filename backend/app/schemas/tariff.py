"""Pydantic schemas for Tariff model."""
from datetime import datetime, time
from typing import Optional, List
from pydantic import BaseModel, Field


class TariffRateBase(BaseModel):
    """Base schema for TariffRate."""
    name: str
    rate_per_kwh: float
    time_start: Optional[time] = None
    time_end: Optional[time] = None
    days_of_week: Optional[str] = None
    season: Optional[str] = None
    tier_min_kwh: Optional[float] = None
    tier_max_kwh: Optional[float] = None


class TariffRateCreate(TariffRateBase):
    """Schema for creating a TariffRate."""
    pass


class TariffRateResponse(TariffRateBase):
    """Schema for TariffRate response."""
    id: int
    tariff_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TariffBase(BaseModel):
    """Base schema for Tariff."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    provider_name: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    currency: str = "USD"
    fixed_charge: float = 0.0
    demand_charge_per_kw: Optional[float] = None
    power_factor_threshold: Optional[float] = None
    power_factor_penalty_rate: Optional[float] = None
    is_active: bool = True


class TariffCreate(TariffBase):
    """Schema for creating a new Tariff."""
    site_id: int
    rates: List[TariffRateCreate] = []


class TariffUpdate(BaseModel):
    """Schema for updating a Tariff."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    provider_name: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    currency: Optional[str] = None
    fixed_charge: Optional[float] = None
    demand_charge_per_kw: Optional[float] = None
    is_active: Optional[bool] = None


class TariffResponse(TariffBase):
    """Schema for Tariff response."""
    id: int
    site_id: int
    created_at: datetime
    updated_at: datetime
    rates: List[TariffRateResponse] = []

    class Config:
        from_attributes = True
