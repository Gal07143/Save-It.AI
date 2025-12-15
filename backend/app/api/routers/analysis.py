"""Analysis and Optimization API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.schemas.gap_analysis import GapAnalysisResult
from backend.app.services.digital_twin.gap_analysis import GapAnalysisService
from backend.app.services.optimization.solar_roi import SolarROICalculator, SolarROIInput, SolarROIResult

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/gap-analysis/{site_id}", response_model=GapAnalysisResult)
def run_gap_analysis(site_id: int, db: Session = Depends(get_db)):
    """
    Run gap analysis for a site.
    
    Compares the SLD asset tree with connected meters to identify
    unmetered nodes that require monitoring.
    """
    service = GapAnalysisService(db)
    try:
        result = service.perform_gap_analysis(site_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/solar-roi", response_model=SolarROIResult)
def calculate_solar_roi(inputs: SolarROIInput):
    """
    Calculate solar PV system ROI.
    
    Returns detailed financial projections including:
    - Simple payback period
    - Net Present Value (NPV)
    - Internal Rate of Return (IRR)
    - Annual savings projections
    """
    calculator = SolarROICalculator()
    result = calculator.calculate_roi(inputs)
    return result
