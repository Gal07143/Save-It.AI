"""Data Quality API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Meter, QualityIssue, QualityIssueType
from backend.app.schemas import (
    QualityIssueResponse,
    DataQualityDashboard,
)

router = APIRouter(prefix="/api/v1/data-quality", tags=["data-quality"])


@router.get("/dashboard", response_model=DataQualityDashboard)
def get_data_quality_dashboard(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get data quality dashboard summary."""
    query = db.query(Meter)
    if site_id:
        query = query.filter(Meter.site_id == site_id)
    total_meters = query.count()
    
    issues_query = db.query(QualityIssue).filter(QualityIssue.is_resolved == 0)
    open_issues = issues_query.all()
    critical_issues = [i for i in open_issues if i.severity == "critical"]
    meters_with_issues = len(set(i.meter_id for i in open_issues))
    
    return DataQualityDashboard(
        total_meters=total_meters,
        meters_with_issues=meters_with_issues,
        average_coverage=95.0,
        average_quality_score=92.5,
        open_issues_count=len(open_issues),
        critical_issues_count=len(critical_issues),
        recent_issues=[QualityIssueResponse.model_validate(i) for i in open_issues[:10]]
    )


@router.get("/issues", response_model=List[QualityIssueResponse])
def list_quality_issues(
    meter_id: Optional[int] = None,
    issue_type: Optional[QualityIssueType] = None,
    is_resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """List data quality issues with filters."""
    query = db.query(QualityIssue)
    if meter_id:
        query = query.filter(QualityIssue.meter_id == meter_id)
    if issue_type:
        query = query.filter(QualityIssue.issue_type == issue_type)
    if is_resolved is not None:
        query = query.filter(QualityIssue.is_resolved == (1 if is_resolved else 0))
    return query.order_by(QualityIssue.created_at.desc()).all()


@router.post("/issues/{issue_id}/resolve", response_model=QualityIssueResponse)
def resolve_quality_issue(
    issue_id: int,
    resolution_notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Resolve a data quality issue."""
    issue = db.query(QualityIssue).filter(QualityIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue.is_resolved = 1
    issue.resolved_at = datetime.utcnow()
    issue.resolution_notes = resolution_notes
    db.commit()
    db.refresh(issue)
    return issue
