"""Pydantic schemas for Asset model."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models.asset import AssetType


class AssetBase(BaseModel):
    """Base schema for Asset."""
    name: str = Field(..., min_length=1, max_length=255)
    asset_type: AssetType
    description: Optional[str] = None
    rated_capacity_kw: Optional[float] = None
    rated_voltage: Optional[float] = None
    rated_current: Optional[float] = None
    is_critical: bool = False
    requires_metering: bool = True


class AssetCreate(AssetBase):
    """Schema for creating a new Asset."""
    site_id: int
    parent_id: Optional[int] = None
    data_source_id: Optional[int] = None


class AssetUpdate(BaseModel):
    """Schema for updating an Asset."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    asset_type: Optional[AssetType] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    data_source_id: Optional[int] = None
    rated_capacity_kw: Optional[float] = None
    rated_voltage: Optional[float] = None
    rated_current: Optional[float] = None
    is_critical: Optional[bool] = None
    requires_metering: Optional[bool] = None


class AssetResponse(AssetBase):
    """Schema for Asset response."""
    id: int
    site_id: int
    parent_id: Optional[int] = None
    data_source_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssetTreeNode(BaseModel):
    """Schema for Asset tree node (hierarchical view)."""
    id: int
    name: str
    asset_type: AssetType
    has_meter: bool = False
    meter_id: Optional[str] = None
    children: List["AssetTreeNode"] = []

    class Config:
        from_attributes = True


AssetTreeNode.model_rebuild()
