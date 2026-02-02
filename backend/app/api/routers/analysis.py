"""Analysis and Optimization API endpoints."""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
import numpy_financial as npf

from backend.app.core.database import get_db
from backend.app.models import Site, Meter, Bill, Asset, Tariff
from backend.app.schemas import (
    GapAnalysisResult,
    BESSSimulationInput,
    BESSSimulationResult,
    PVSizingRequest,
    PVSizingResponse,
)
from backend.app.services.digital_twin.gap_analysis import GapAnalysisService
from backend.app.services.optimization.solar_roi import SolarROICalculator, SolarROIInput, SolarROIResult

router = APIRouter(prefix="/api/v1/analysis", tags=["analysis"])


# Site Comparison Models
class SiteComparisonData(BaseModel):
    """Data for a single site in comparison."""
    site_id: int
    site_name: str
    consumption: float
    cost: float
    efficiency: float
    power_factor: float
    co2_emissions: float
    peak_demand: float


class SiteComparisonResponse(BaseModel):
    """Response for site comparison endpoint."""
    start_date: str
    end_date: str
    metric: str
    aggregation: str
    sites: List[SiteComparisonData]
    summary: dict


@router.get("/gap-analysis/{site_id}", response_model=GapAnalysisResult)
def run_gap_analysis(site_id: int, db: Session = Depends(get_db)):
    """Run gap analysis for a site."""
    service = GapAnalysisService(db)
    try:
        result = service.perform_gap_analysis(site_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/solar-roi", response_model=SolarROIResult)
def calculate_solar_roi(inputs: SolarROIInput):
    """Calculate solar PV system ROI."""
    calculator = SolarROICalculator()
    result = calculator.calculate_roi(inputs)
    return result


@router.post("/bess-simulation", response_model=BESSSimulationResult)
def run_bess_simulation(request: BESSSimulationInput, db: Session = Depends(get_db)):
    """Run BESS financial simulation."""
    cycles_per_day = request.cycles_per_day or 1.5
    annual_savings = (
        request.capacity_kwh * cycles_per_day * 365 *
        (request.peak_rate - request.off_peak_rate) *
        request.round_trip_efficiency
    )

    maintenance = request.annual_maintenance_cost or (request.total_investment * 0.01)
    net_annual = annual_savings - maintenance

    cash_flows = [-request.total_investment]
    for year in range(1, request.project_life_years + 1):
        degraded_capacity = request.capacity_kwh * (1 - (request.degradation_rate_per_year * year))
        year_savings = (
            degraded_capacity * cycles_per_day * 365 *
            (request.peak_rate - request.off_peak_rate) *
            request.round_trip_efficiency
        ) - maintenance
        cash_flows.append(year_savings)

    npv = npf.npv(request.discount_rate, cash_flows)
    try:
        irr = npf.irr(cash_flows)
        irr = float(irr) if irr and not (irr != irr) else None
    except (ValueError, FloatingPointError):
        irr = None

    payback = request.total_investment / net_annual if net_annual > 0 else 99
    lcoe = request.total_investment / (request.capacity_kwh * cycles_per_day * 365 * request.project_life_years)

    return BESSSimulationResult(
        npv=round(npv, 2),
        irr=round(irr * 100, 2) if irr else None,
        payback_years=round(payback, 2),
        lcoe=round(lcoe, 4),
        annual_savings=round(annual_savings, 2),
        total_savings=round(annual_savings * request.project_life_years, 2),
        co2_offset_kg=round(request.capacity_kwh * cycles_per_day * 365 * 0.4, 0),
        monthly_projections=[{
            "month": i + 1,
            "savings": round(annual_savings / 12 * (1 - request.degradation_rate_per_year * (i // 12)), 2),
            "cumulative": round((annual_savings / 12) * (i + 1), 2)
        } for i in range(12)]
    )


@router.get("/panel-diagram/{site_id}")
def get_panel_diagram(site_id: int, db: Session = Depends(get_db)):
    """Get SLD panel diagram data for a site."""
    site = db.query(Site).filter(Site.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    assets = db.query(Asset).filter(Asset.site_id == site_id).all()
    meters = db.query(Meter).filter(Meter.site_id == site_id).all()
    
    def build_tree(parent_id: Optional[int] = None):
        children = [a for a in assets if a.parent_id == parent_id]
        return [{
            "id": f"asset-{a.id}",
            "name": a.name,
            "type": str(a.asset_type.value) if hasattr(a.asset_type, 'value') else str(a.asset_type),
            "rated_capacity_kw": a.rated_capacity_kw,
            "rated_voltage": a.rated_voltage,
            "is_critical": bool(a.is_critical),
            "has_meter": any(m.asset_id == a.id for m in meters),
            "meter_id": next((m.meter_id for m in meters if m.asset_id == a.id), None),
            "children": build_tree(a.id)
        } for a in children]
    
    return {
        "site_id": site_id,
        "site_name": site.name,
        "diagram_type": "single_line",
        "nodes": build_tree(None),
        "total_assets": len(assets),
        "metered_assets": len([a for a in assets if any(m.asset_id == a.id for m in meters)])
    }


@router.get("/compare-sites", response_model=SiteComparisonResponse)
def compare_sites(
    site_ids: str = Query(..., description="Comma-separated site IDs (max 5)"),
    metric: str = Query("consumption", description="Metric to compare: consumption, cost, efficiency, power_factor, co2"),
    start: Optional[datetime] = Query(None, description="Start date for comparison"),
    end: Optional[datetime] = Query(None, description="End date for comparison"),
    aggregation: str = Query("daily", description="Aggregation period: hourly, daily, monthly"),
    db: Session = Depends(get_db)
):
    """
    Compare metrics across multiple sites.

    Returns aggregated data for each site allowing side-by-side comparison
    of energy consumption, costs, efficiency, and other metrics.
    """
    # Parse site IDs
    try:
        site_id_list = [int(sid.strip()) for sid in site_ids.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid site_ids format. Use comma-separated integers.")

    if len(site_id_list) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 sites can be compared at once.")

    if len(site_id_list) == 0:
        raise HTTPException(status_code=400, detail="At least one site_id is required.")

    # Default date range: last 30 days
    if not end:
        end = datetime.utcnow()
    if not start:
        from datetime import timedelta
        start = end - timedelta(days=30)

    # Validate metric
    valid_metrics = ["consumption", "cost", "efficiency", "power_factor", "co2"]
    if metric not in valid_metrics:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Must be one of: {', '.join(valid_metrics)}")

    # Fetch sites
    sites = db.query(Site).filter(Site.id.in_(site_id_list)).all()
    found_ids = {s.id for s in sites}
    missing_ids = set(site_id_list) - found_ids
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"Sites not found: {list(missing_ids)}")

    # Calculate metrics for each site
    comparison_data = []

    for site in sites:
        # Get meters for site
        meters = db.query(Meter).filter(
            Meter.site_id == site.id,
            Meter.is_active == True
        ).all()

        # Calculate consumption from bills or estimates
        bills = db.query(Bill).filter(
            Bill.site_id == site.id,
            Bill.billing_start >= start,
            Bill.billing_end <= end
        ).all()

        total_consumption = sum(b.total_kwh or 0 for b in bills) if bills else 0
        total_cost = sum(b.total_amount or 0 for b in bills) if bills else 0

        # If no bill data, estimate from meter count
        if total_consumption == 0 and meters:
            # Estimate: 1000 kWh per meter per month
            days = (end - start).days
            total_consumption = len(meters) * 1000 * (days / 30)
            total_cost = total_consumption * 0.12  # $0.12/kWh estimate

        # Calculate derived metrics
        efficiency_score = 85  # Base score, would calculate from actual data
        if total_consumption > 0:
            # Adjust efficiency based on consumption per meter
            consumption_per_meter = total_consumption / max(1, len(meters))
            if consumption_per_meter < 800:
                efficiency_score = 90
            elif consumption_per_meter > 1500:
                efficiency_score = 70

        power_factor = 0.94  # Would calculate from telemetry
        co2_emissions = total_consumption * 0.4  # kg CO2 per kWh
        peak_demand = total_consumption / max(1, (end - start).days) * 24 * 0.7  # Estimate

        comparison_data.append(SiteComparisonData(
            site_id=site.id,
            site_name=site.name,
            consumption=round(total_consumption, 2),
            cost=round(total_cost, 2),
            efficiency=round(efficiency_score, 1),
            power_factor=round(power_factor, 2),
            co2_emissions=round(co2_emissions, 2),
            peak_demand=round(peak_demand, 2)
        ))

    # Calculate summary statistics
    if comparison_data:
        metric_values = [getattr(d, metric if metric != "co2" else "co2_emissions") for d in comparison_data]
        summary = {
            "total": round(sum(metric_values), 2),
            "average": round(sum(metric_values) / len(metric_values), 2),
            "min": round(min(metric_values), 2),
            "max": round(max(metric_values), 2),
            "min_site": next((d.site_name for d in comparison_data if getattr(d, metric if metric != "co2" else "co2_emissions") == min(metric_values)), None),
            "max_site": next((d.site_name for d in comparison_data if getattr(d, metric if metric != "co2" else "co2_emissions") == max(metric_values)), None),
        }
    else:
        summary = {}

    return SiteComparisonResponse(
        start_date=start.isoformat(),
        end_date=end.isoformat(),
        metric=metric,
        aggregation=aggregation,
        sites=comparison_data,
        summary=summary
    )


@router.post("/pv-sizing", response_model=PVSizingResponse)
def calculate_pv_sizing(request: PVSizingRequest, db: Session = Depends(get_db)):
    """Calculate optimal PV system sizing for a site."""
    panel_area_per_kwp = 5.0
    max_capacity_kwp = request.roof_area_sqm / panel_area_per_kwp
    
    peak_sun_hours = 4.5
    annual_production_per_kwp = peak_sun_hours * 365 * request.panel_efficiency * (1 - request.system_losses)
    
    annual_consumption = request.average_monthly_consumption_kwh * 12
    recommended_capacity = min(
        annual_consumption / annual_production_per_kwp * 0.8,
        max_capacity_kwp
    )
    
    estimated_production = recommended_capacity * annual_production_per_kwp
    estimated_savings = estimated_production * request.electricity_rate
    installation_cost = recommended_capacity * request.installation_cost_per_kwp
    
    payback_years = installation_cost / estimated_savings if estimated_savings > 0 else 999
    
    co2_factor = 0.5
    co2_offset = estimated_production * co2_factor / 1000
    
    monthly_factors = [0.7, 0.75, 0.85, 0.95, 1.05, 1.15, 1.2, 1.15, 1.0, 0.85, 0.75, 0.65]
    monthly_production = [estimated_production / 12 * f for f in monthly_factors]
    
    return PVSizingResponse(
        recommended_capacity_kwp=round(recommended_capacity, 2),
        estimated_annual_production_kwh=round(estimated_production, 0),
        estimated_annual_savings=round(estimated_savings, 2),
        estimated_installation_cost=round(installation_cost, 2),
        simple_payback_years=round(payback_years, 1),
        co2_offset_tonnes_per_year=round(co2_offset, 2),
        roof_utilization_percent=round(recommended_capacity / max_capacity_kwp * 100, 1),
        monthly_production=[round(p, 0) for p in monthly_production]
    )
