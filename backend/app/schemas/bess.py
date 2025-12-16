"""BESS (Battery Energy Storage System) Pydantic schemas."""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class BESSVendorResponse(BaseModel):
    """Response schema for BESS vendor."""
    id: int
    name: str
    country: Optional[str] = None
    website: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BESSModelResponse(BaseModel):
    """Response schema for BESS model."""
    id: int
    vendor_id: int
    model_name: str
    model_number: Optional[str] = None
    chemistry: str
    capacity_kwh: float
    power_rating_kw: float
    voltage_nominal: Optional[float] = None
    round_trip_efficiency: float
    depth_of_discharge: float
    cycle_life: int
    warranty_years: int
    dimensions_cm: Optional[str] = None
    weight_kg: Optional[float] = None
    price_usd: Optional[float] = None
    price_per_kwh: Optional[float] = None
    is_active: bool
    created_at: datetime
    vendor: Optional[BESSVendorResponse] = None

    model_config = ConfigDict(from_attributes=True)


class BESSDatasetCreate(BaseModel):
    """Schema for creating a BESS dataset."""
    site_id: int
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    interval_minutes: int = 30


class BESSDatasetResponse(BaseModel):
    """Response schema for BESS dataset."""
    id: int
    site_id: int
    name: str
    description: Optional[str] = None
    interval_minutes: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    total_records: int
    total_consumption_kwh: float
    peak_demand_kw: Optional[float] = None
    avg_demand_kw: Optional[float] = None
    file_name: Optional[str] = None
    upload_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BESSDataUploadRequest(BaseModel):
    """Request for uploading interval data."""
    dataset_id: int
    timestamp_column: str = "timestamp"
    demand_column: str = "demand_kw"
    energy_column: Optional[str] = None
    date_format: str = "%Y-%m-%d %H:%M:%S"


class BESSRecommendationRequest(BaseModel):
    """Request for getting BESS recommendations."""
    site_id: int
    dataset_id: Optional[int] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    target_peak_reduction_percent: Optional[float] = 20
    preferred_chemistry: Optional[str] = None


class BESSRecommendation(BaseModel):
    """A single BESS recommendation."""
    model_id: int
    vendor_name: str
    model_name: str
    capacity_kwh: float
    power_rating_kw: float
    estimated_price: Optional[float] = None
    estimated_annual_savings: float
    estimated_payback_years: float
    fit_score: float
    reasoning: str


class BESSSimulationInput(BaseModel):
    """Input parameters for BESS financial simulation."""
    load_profile_kwh: List[float] = Field(..., description="8760 hourly load values (kWh) for a year")
    tariff_rates: List[float] = Field(..., description="8760 hourly electricity rates ($/kWh)")
    demand_charges: Optional[List[float]] = Field(None, description="12 monthly demand charges ($/kW)")
    battery_capacity_kwh: float = Field(..., gt=0)
    battery_power_kw: float = Field(..., gt=0)
    round_trip_efficiency: float = Field(default=0.90, ge=0.5, le=1.0)
    depth_of_discharge: float = Field(default=0.90, ge=0.5, le=1.0)
    capex: float = Field(..., gt=0)
    opex_annual: float = Field(default=0.0, ge=0)
    analysis_years: int = Field(default=15, ge=1, le=30)
    discount_rate: float = Field(default=0.08, ge=0, le=0.3)
    degradation_rate: float = Field(default=0.02, ge=0, le=0.1)


class BESSSimulationResult(BaseModel):
    """Result of BESS financial simulation."""
    arbitrage_savings_year1: float
    peak_shaving_savings_year1: float
    total_savings_year1: float
    simple_payback_years: float
    net_present_value: float
    internal_rate_of_return: Optional[float]
    lifetime_savings: float
    annual_projections: List[Dict[str, Any]]
    monthly_peak_reduction: List[float]
