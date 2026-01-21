"""Pydantic schemas for Meter and MeterReading models."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MeterBase(BaseModel):
    """Base schema for Meter."""
    meter_id: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    is_active: bool = True
    is_bidirectional: bool = False


class MeterCreate(MeterBase):
    """Schema for creating a new Meter."""
    site_id: int
    asset_id: Optional[int] = None
    data_source_id: Optional[int] = None


class MeterUpdate(BaseModel):
    """Schema for updating a Meter."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    asset_id: Optional[int] = None
    data_source_id: Optional[int] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    is_active: Optional[bool] = None
    is_bidirectional: Optional[bool] = None


class MeterResponse(MeterBase):
    """Schema for Meter response."""
    id: int
    site_id: int
    asset_id: Optional[int] = None
    data_source_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MeterReadingBase(BaseModel):
    """Base schema for MeterReading."""
    timestamp: datetime
    energy_kwh: float
    power_kw: Optional[float] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    power_factor: Optional[float] = None
    reactive_power_kvar: Optional[float] = None
    apparent_power_kva: Optional[float] = None
    reading_type: str = "interval"


class MeterReadingCreate(MeterReadingBase):
    """Schema for creating a new MeterReading."""
    meter_id: int


class MeterReadingResponse(MeterReadingBase):
    """Schema for MeterReading response."""
    id: int
    meter_id: int
    created_at: datetime

    class Config:
        from_attributes = True
