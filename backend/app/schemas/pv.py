"""PV (Photovoltaic) Design Pydantic schemas."""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class PVModuleResponse(BaseModel):
    """Response schema for PV module catalog."""
    id: int
    manufacturer: str
    model_name: str
    power_rating_w: float
    efficiency_percent: float
    width_mm: float
    height_mm: float
    weight_kg: Optional[float] = None
    cell_type: str
    warranty_years: int
    price_usd: Optional[float] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PVSurfaceCreate(BaseModel):
    """Schema for creating a PV surface."""
    name: str = Field(..., min_length=1, max_length=255)
    surface_type: str = "rooftop"
    area_sqm: float = Field(..., gt=0)
    usable_area_sqm: Optional[float] = None
    tilt_degrees: float = 15
    azimuth_degrees: float = 180
    shading_percent: float = 0
    notes: Optional[str] = None


class PVSurfaceResponse(BaseModel):
    """Response schema for PV surface."""
    id: int
    assessment_id: int
    name: str
    surface_type: str
    area_sqm: float
    usable_area_sqm: Optional[float] = None
    tilt_degrees: float
    azimuth_degrees: float
    shading_percent: float
    max_capacity_kw: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PVAssessmentCreate(BaseModel):
    """Schema for creating a PV assessment."""
    site_id: int
    name: str = Field(..., min_length=1, max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    surfaces: Optional[List[PVSurfaceCreate]] = None


class PVAssessmentResponse(BaseModel):
    """Response schema for PV assessment."""
    id: int
    site_id: int
    name: str
    assessment_date: date
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    annual_irradiance_kwh_m2: Optional[float] = None
    avg_peak_sun_hours: Optional[float] = None
    shading_factor: float
    status: str
    surfaces: List[PVSurfaceResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PVDesignRequest(BaseModel):
    """Request for PV system design calculation."""
    assessment_id: int
    module_id: Optional[int] = None
    target_capacity_kw: Optional[float] = None
    max_panels: Optional[int] = None
    electricity_rate: float = 0.12
    export_rate: float = 0.05
    self_consumption_percent: float = 80
    capex_per_kw: float = 1000
    analysis_years: int = 25
    discount_rate: float = 0.06


class PVDesignScenarioResponse(BaseModel):
    """Response schema for PV design scenario."""
    id: int
    assessment_id: int
    module_id: Optional[int] = None
    name: str
    system_capacity_kw: float
    num_panels: int
    annual_production_kwh: Optional[float] = None
    capacity_factor: Optional[float] = None
    self_consumption_percent: float
    export_percent: float
    total_capex: Optional[float] = None
    annual_savings: Optional[float] = None
    npv: Optional[float] = None
    irr: Optional[float] = None
    payback_years: Optional[float] = None
    lcoe: Optional[float] = None
    co2_avoided_tons: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SiteMapCreate(BaseModel):
    """Schema for creating a site map."""
    site_id: int
    name: str = Field(..., min_length=1, max_length=255)
    notes: Optional[str] = None


class SiteMapResponse(BaseModel):
    """Response schema for site map."""
    id: int
    site_id: int
    name: str
    file_name: str
    file_path: str
    file_type: str
    width_px: Optional[int] = None
    height_px: Optional[int] = None
    scale_m_per_px: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PVSizingRequest(BaseModel):
    """Request for PV system sizing calculation."""
    site_id: int
    roof_area_sqm: float = Field(..., gt=0)
    location_latitude: float
    location_longitude: float
    panel_efficiency: float = Field(default=0.20, ge=0.1, le=0.25)
    system_losses: float = Field(default=0.14, ge=0, le=0.3)
    average_monthly_consumption_kwh: float = Field(..., gt=0)
    electricity_rate: float = Field(..., gt=0)
    installation_cost_per_kwp: float = Field(default=1200, gt=0)
    annual_degradation: float = Field(default=0.005, ge=0, le=0.02)
    analysis_years: int = Field(default=25, ge=1, le=30)


class PVSizingResponse(BaseModel):
    """Response for PV sizing calculation."""
    recommended_capacity_kwp: float
    estimated_annual_production_kwh: float
    estimated_annual_savings: float
    estimated_installation_cost: float
    simple_payback_years: float
    co2_offset_tonnes_per_year: float
    roof_utilization_percent: float
    monthly_production: List[float]
