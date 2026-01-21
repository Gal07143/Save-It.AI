"""PV (Photovoltaic) Design API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import numpy_financial as npf

from backend.app.core.database import get_db
from backend.app.models import PVModuleCatalog, PVAssessment, PVSurface, PVDesignScenario
from backend.app.schemas import (
    PVModuleResponse,
    PVAssessmentCreate,
    PVAssessmentResponse,
    PVSurfaceCreate,
    PVSurfaceResponse,
    PVDesignRequest,
    PVDesignScenarioResponse,
)

router = APIRouter(prefix="/api/v1/pv", tags=["pv-design"])


@router.get("/modules", response_model=List[PVModuleResponse])
def list_pv_modules(
    manufacturer: Optional[str] = None,
    min_power_w: Optional[float] = None,
    max_power_w: Optional[float] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all PV modules in the catalog."""
    query = db.query(PVModuleCatalog).filter(PVModuleCatalog.is_active == 1)
    if manufacturer:
        query = query.filter(PVModuleCatalog.manufacturer.ilike(f"%{manufacturer}%"))
    if min_power_w:
        query = query.filter(PVModuleCatalog.power_rating_w >= min_power_w)
    if max_power_w:
        query = query.filter(PVModuleCatalog.power_rating_w <= max_power_w)
    return query.offset(skip).limit(limit).all()


@router.post("/assessments", response_model=PVAssessmentResponse)
def create_pv_assessment(assessment: PVAssessmentCreate, db: Session = Depends(get_db)):
    """Create a new PV assessment for a site."""
    assessment_data = assessment.model_dump(exclude={'surfaces'})
    db_assessment = PVAssessment(**assessment_data)
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)
    
    if assessment.surfaces:
        for surface_data in assessment.surfaces:
            db_surface = PVSurface(assessment_id=db_assessment.id, **surface_data.model_dump())
            usable = surface_data.usable_area_sqm or (surface_data.area_sqm * (1 - surface_data.shading_percent / 100))
            db_surface.usable_area_sqm = usable
            db_surface.max_capacity_kw = usable * 0.2
            db.add(db_surface)
        db.commit()
        db.refresh(db_assessment)
    
    return db_assessment


@router.get("/assessments", response_model=List[PVAssessmentResponse])
def list_pv_assessments(
    site_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all PV assessments for a site."""
    query = db.query(PVAssessment)
    if site_id:
        query = query.filter(PVAssessment.site_id == site_id)
    return query.order_by(PVAssessment.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/assessments/{assessment_id}", response_model=PVAssessmentResponse)
def get_pv_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Get a specific PV assessment by ID."""
    assessment = db.query(PVAssessment).filter(PVAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


@router.post("/assessments/{assessment_id}/surfaces", response_model=PVSurfaceResponse)
def add_pv_surface(assessment_id: int, surface: PVSurfaceCreate, db: Session = Depends(get_db)):
    """Add a surface to a PV assessment."""
    assessment = db.query(PVAssessment).filter(PVAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    db_surface = PVSurface(assessment_id=assessment_id, **surface.model_dump())
    usable = surface.usable_area_sqm or (surface.area_sqm * (1 - surface.shading_percent / 100))
    db_surface.usable_area_sqm = usable
    db_surface.max_capacity_kw = usable * 0.2
    db.add(db_surface)
    db.commit()
    db.refresh(db_surface)
    return db_surface


@router.post("/design", response_model=PVDesignScenarioResponse)
def calculate_pv_design(request: PVDesignRequest, db: Session = Depends(get_db)):
    """Calculate PV system design with ROI projections."""
    assessment = db.query(PVAssessment).filter(PVAssessment.id == request.assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    total_usable_area = sum(s.usable_area_sqm or s.area_sqm for s in assessment.surfaces)
    max_capacity = total_usable_area * 0.2
    
    module = None
    if request.module_id:
        module = db.query(PVModuleCatalog).filter(PVModuleCatalog.id == request.module_id).first()
    
    if not module:
        module = db.query(PVModuleCatalog).filter(PVModuleCatalog.is_active == 1).first()
    
    panel_area_m2 = (module.width_mm * module.height_mm / 1_000_000) if module else 2.0
    panel_power_kw = (module.power_rating_w / 1000) if module else 0.4
    
    if request.target_capacity_kw:
        system_capacity = min(request.target_capacity_kw, max_capacity)
    else:
        system_capacity = max_capacity
    
    num_panels = int(system_capacity / panel_power_kw)
    if request.max_panels:
        num_panels = min(num_panels, request.max_panels)
    
    actual_capacity = num_panels * panel_power_kw
    
    peak_sun_hours = assessment.avg_peak_sun_hours or 4.5
    pr = 0.80
    annual_production = actual_capacity * peak_sun_hours * 365 * pr
    capacity_factor = annual_production / (actual_capacity * 8760) if actual_capacity > 0 else 0
    
    self_consumed = annual_production * (request.self_consumption_percent / 100)
    exported = annual_production * ((100 - request.self_consumption_percent) / 100)
    
    annual_savings = (self_consumed * request.electricity_rate) + (exported * request.export_rate)
    
    total_capex = actual_capacity * request.capex_per_kw
    
    cash_flows = [-total_capex]
    for year in range(1, request.analysis_years + 1):
        degraded_production = annual_production * (0.995 ** year)
        year_savings = (degraded_production * request.self_consumption_percent / 100 * request.electricity_rate) + \
                      (degraded_production * (100 - request.self_consumption_percent) / 100 * request.export_rate)
        cash_flows.append(year_savings)
    
    npv = npf.npv(request.discount_rate, cash_flows)
    
    try:
        irr = npf.irr(cash_flows)
        irr = float(irr) if irr and not (irr != irr) else None
    except (ValueError, FloatingPointError):
        irr = None
    
    payback = total_capex / annual_savings if annual_savings > 0 else 99
    lcoe = total_capex / (annual_production * request.analysis_years) if annual_production > 0 else 0
    co2_avoided = annual_production * 0.0004
    
    scenario = PVDesignScenario(
        assessment_id=assessment.id,
        module_id=module.id if module else None,
        name=f"Design Option - {actual_capacity:.1f} kW",
        system_capacity_kw=actual_capacity,
        num_panels=num_panels,
        annual_production_kwh=annual_production,
        capacity_factor=capacity_factor,
        self_consumption_percent=request.self_consumption_percent,
        export_percent=100 - request.self_consumption_percent,
        total_capex=total_capex,
        annual_savings=annual_savings,
        npv=npv,
        irr=irr,
        payback_years=payback,
        lcoe=lcoe,
        co2_avoided_tons=co2_avoided,
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    
    return scenario


@router.get("/assessments/{assessment_id}/scenarios", response_model=List[PVDesignScenarioResponse])
def list_pv_scenarios(assessment_id: int, db: Session = Depends(get_db)):
    """List all design scenarios for a PV assessment."""
    return db.query(PVDesignScenario).filter(PVDesignScenario.assessment_id == assessment_id).all()
