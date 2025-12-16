"""Reports and Carbon Emission Pydantic schemas."""
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class OCRBillResult(BaseModel):
    """Result of OCR bill extraction."""
    success: bool
    provider_name: Optional[str] = None
    bill_number: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    total_kwh: Optional[float] = None
    total_amount: Optional[float] = None
    currency: Optional[str] = None
    confidence_score: Optional[float] = None
    raw_text: Optional[str] = None
    extracted_fields: Dict[str, Any] = {}
    errors: List[str] = []


class PanelDiagramResult(BaseModel):
    """Result of panel diagram analysis."""
    success: bool
    detected_assets: List[Dict[str, Any]] = []
    connections: List[Dict[str, Any]] = []
    warnings: List[str] = []
    image_annotations: Optional[str] = None


class CarbonEmissionCreate(BaseModel):
    """Schema for creating a carbon emission record."""
    site_id: int
    period_start: date
    period_end: date
    scope: int = Field(..., ge=1, le=3)
    category: str
    source: str
    consumption_value: float
    consumption_unit: str
    emission_factor: float
    emission_factor_unit: str
    total_emissions_kg_co2e: float
    notes: Optional[str] = None


class CarbonEmissionResponse(BaseModel):
    """Response schema for carbon emission."""
    id: int
    site_id: int
    period_start: date
    period_end: date
    scope: int
    category: str
    source: str
    consumption_value: float
    consumption_unit: str
    emission_factor: float
    emission_factor_unit: str
    total_emissions_kg_co2e: float
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CarbonSummaryResponse(BaseModel):
    """Summary of carbon emissions."""
    site_id: int
    period_start: date
    period_end: date
    total_scope1_kg: float
    total_scope2_kg: float
    total_scope3_kg: float
    total_emissions_kg: float
    total_emissions_tonnes: float
    breakdown_by_source: Dict[str, float] = {}
    year_over_year_change_percent: Optional[float] = None


class ReportRequest(BaseModel):
    """Request for generating a report."""
    site_id: int
    report_type: str
    period_start: date
    period_end: date
    format: str = "pdf"
    include_charts: bool = True
    include_recommendations: bool = True


class ReportResponse(BaseModel):
    """Response for generated report."""
    id: int
    site_id: int
    report_type: str
    period_start: date
    period_end: date
    file_name: str
    file_path: str
    file_size_bytes: Optional[int] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ESGMetricsResponse(BaseModel):
    """ESG metrics response."""
    site_id: int
    period: str
    environmental_score: float
    social_score: float
    governance_score: float
    overall_score: float
    carbon_intensity_kg_per_kwh: float
    renewable_energy_percent: float
    energy_efficiency_index: float
    benchmarks: Dict[str, Any] = {}
