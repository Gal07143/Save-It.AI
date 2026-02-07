"""Pydantic schemas for Site model."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class SiteBase(BaseModel):
    """Base schema for Site."""
    name: str = Field(..., min_length=1, max_length=255)
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str = "UTC"
    site_type: Optional[str] = None
    industry: Optional[str] = None
    area_sqm: Optional[float] = None
    grid_capacity_kva: Optional[float] = None
    operating_hours: Optional[str] = None
    operating_hours_start: Optional[str] = None
    operating_hours_end: Optional[str] = None
    currency: Optional[str] = None
    electricity_rate: Optional[float] = None
    utility_provider: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None


class SiteCreate(SiteBase):
    """Schema for creating a new Site."""
    pass


class SiteUpdate(BaseModel):
    """Schema for updating a Site."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    site_type: Optional[str] = None
    industry: Optional[str] = None
    area_sqm: Optional[float] = None
    grid_capacity_kva: Optional[float] = None
    operating_hours: Optional[str] = None
    operating_hours_start: Optional[str] = None
    operating_hours_end: Optional[str] = None
    currency: Optional[str] = None
    electricity_rate: Optional[float] = None
    utility_provider: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None


class SiteResponse(SiteBase):
    """Schema for Site response."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
