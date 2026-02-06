"""Pydantic schemas for Gap Analysis results."""
from typing import List, Optional
from pydantic import BaseModel
from app.models.asset import AssetType


class UnmeteredAsset(BaseModel):
    """Schema for an unmetered asset in the gap analysis."""
    asset_id: int
    asset_name: str
    asset_type: AssetType
    parent_id: Optional[int] = None
    parent_name: Optional[str] = None
    rated_capacity_kw: Optional[float] = None
    is_critical: bool = False
    hierarchy_path: List[str] = []


class GapAnalysisResult(BaseModel):
    """Schema for the complete gap analysis result."""
    site_id: int
    site_name: str
    total_assets: int
    metered_assets: int
    unmetered_assets: int
    coverage_percentage: float
    critical_unmetered_count: int
    unmetered_asset_list: List[UnmeteredAsset] = []
    recommendations: List[str] = []
