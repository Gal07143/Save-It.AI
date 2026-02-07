"""Virtual Meters Pydantic schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class VirtualMeterType(str, Enum):
    """Types of virtual meters."""
    AGGREGATION = "aggregation"
    DIFFERENCE = "difference"
    ALLOCATION = "allocation"
    FORMULA = "formula"


class VirtualMeterComponentCreate(BaseModel):
    """Schema for virtual meter component."""
    meter_id: Optional[int] = None
    weight: float = 1.0
    operator: str = "+"
    allocation_percent: Optional[float] = None


class VirtualMeterCreate(BaseModel):
    """Schema for creating a virtual meter."""
    site_id: int
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    meter_type: VirtualMeterType
    expression: Optional[str] = None
    unit: str = "kWh"
    components: List[VirtualMeterComponentCreate] = []


class VirtualMeterUpdate(BaseModel):
    """Schema for updating a virtual meter."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    meter_type: Optional[VirtualMeterType] = None
    expression: Optional[str] = None
    unit: Optional[str] = None
    is_active: Optional[bool] = None
    components: Optional[List[VirtualMeterComponentCreate]] = None


class VirtualMeterComponentResponse(BaseModel):
    """Response schema for virtual meter component."""
    id: int
    virtual_meter_id: int
    meter_id: Optional[int] = None
    weight: float
    operator: str
    allocation_percent: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VirtualMeterResponse(BaseModel):
    """Response schema for virtual meters."""
    id: int
    site_id: int
    name: str
    description: Optional[str] = None
    meter_type: VirtualMeterType
    expression: Optional[str] = None
    unit: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
