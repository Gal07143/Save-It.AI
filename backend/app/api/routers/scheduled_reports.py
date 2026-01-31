"""
Scheduled Reports API Router for SAVE-IT.AI
Endpoints for advanced report templates, scheduling, and generation.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.report_service import (
    ReportService,
    ReportType,
    ReportFormat,
    ScheduleFrequency,
    get_report_service,
)

router = APIRouter(prefix="/scheduled-reports", tags=["scheduled-reports"])


class TemplateCreate(BaseModel):
    """Create report template request."""
    name: str
    description: Optional[str] = None
    report_type: str
    config: Optional[dict] = None
    filters: Optional[dict] = None
    default_format: str = "pdf"
    include_charts: bool = True
    include_raw_data: bool = False


class TemplateResponse(BaseModel):
    """Report template response."""
    id: int
    name: str
    description: Optional[str]
    report_type: str
    default_format: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    """Create report schedule request."""
    template_id: int
    name: str
    frequency: str  # daily, weekly, monthly
    schedule_config: Optional[dict] = None
    recipients: List[str]
    output_format: str = "pdf"


class ScheduleResponse(BaseModel):
    """Report schedule response."""
    id: int
    template_id: int
    name: str
    frequency: str
    output_format: str
    is_active: bool
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateRequest(BaseModel):
    """Generate report request."""
    template_id: int
    period_start: datetime
    period_end: datetime
    output_format: str = "pdf"


class GeneratedReportResponse(BaseModel):
    """Generated report response."""
    id: int
    name: str
    report_type: str
    format: str
    status: str
    period_start: datetime
    period_end: datetime
    file_size: Optional[int]
    download_url: Optional[str]
    error: Optional[str]
    generated_at: datetime

    class Config:
        from_attributes = True


# Template endpoints
@router.post("/templates", response_model=TemplateResponse)
def create_template(
    request: TemplateCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1,
    user_id: int = 1
):
    """Create a report template."""
    service = get_report_service(db)

    try:
        report_type = ReportType(request.report_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid report type: {request.report_type}")

    template = service.create_template(
        organization_id=organization_id,
        name=request.name,
        report_type=report_type,
        description=request.description,
        config=request.config,
        filters=request.filters,
        default_format=request.default_format,
        include_charts=1 if request.include_charts else 0,
        include_raw_data=1 if request.include_raw_data else 0,
        created_by=user_id
    )

    db.commit()

    return TemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        report_type=template.report_type,
        default_format=template.default_format,
        is_active=template.is_active == 1,
        created_at=template.created_at
    )


@router.get("/templates", response_model=List[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List report templates."""
    from backend.app.services.report_service import ReportTemplate

    templates = db.query(ReportTemplate).filter(
        ReportTemplate.organization_id == organization_id,
        ReportTemplate.is_active == 1
    ).all()

    return [
        TemplateResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            report_type=t.report_type,
            default_format=t.default_format,
            is_active=t.is_active == 1,
            created_at=t.created_at
        )
        for t in templates
    ]


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """Delete a report template."""
    from backend.app.services.report_service import ReportTemplate

    template = db.query(ReportTemplate).filter(ReportTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    template.is_active = 0
    db.commit()

    return {"message": "Template deleted"}


# Schedule endpoints
@router.post("/schedules", response_model=ScheduleResponse)
def create_schedule(
    request: ScheduleCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Create a report schedule."""
    service = get_report_service(db)

    try:
        frequency = ScheduleFrequency(request.frequency)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid frequency: {request.frequency}")

    try:
        output_format = ReportFormat(request.output_format)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid format: {request.output_format}")

    schedule = service.create_schedule(
        template_id=request.template_id,
        organization_id=organization_id,
        name=request.name,
        frequency=frequency,
        recipients=request.recipients,
        schedule_config=request.schedule_config,
        output_format=output_format
    )

    db.commit()

    return ScheduleResponse(
        id=schedule.id,
        template_id=schedule.template_id,
        name=schedule.name,
        frequency=schedule.frequency,
        output_format=schedule.output_format,
        is_active=schedule.is_active == 1,
        last_run_at=schedule.last_run_at,
        next_run_at=schedule.next_run_at,
        created_at=schedule.created_at
    )


@router.get("/schedules", response_model=List[ScheduleResponse])
def list_schedules(
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List report schedules."""
    from backend.app.services.report_service import ReportSchedule

    schedules = db.query(ReportSchedule).filter(
        ReportSchedule.organization_id == organization_id,
        ReportSchedule.is_active == 1
    ).all()

    return [
        ScheduleResponse(
            id=s.id,
            template_id=s.template_id,
            name=s.name,
            frequency=s.frequency,
            output_format=s.output_format,
            is_active=s.is_active == 1,
            last_run_at=s.last_run_at,
            next_run_at=s.next_run_at,
            created_at=s.created_at
        )
        for s in schedules
    ]


@router.patch("/schedules/{schedule_id}/toggle")
def toggle_schedule(
    schedule_id: int,
    db: Session = Depends(get_db)
):
    """Toggle schedule active status."""
    from backend.app.services.report_service import ReportSchedule

    schedule = db.query(ReportSchedule).filter(ReportSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    schedule.is_active = 0 if schedule.is_active == 1 else 1
    db.commit()

    return {"is_active": schedule.is_active == 1}


@router.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db)
):
    """Delete a report schedule."""
    from backend.app.services.report_service import ReportSchedule

    schedule = db.query(ReportSchedule).filter(ReportSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    schedule.is_active = 0
    db.commit()

    return {"message": "Schedule deleted"}


# Report generation endpoints
@router.post("/generate", response_model=GeneratedReportResponse)
def generate_report(
    request: GenerateRequest,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Generate a report on-demand."""
    service = get_report_service(db)

    try:
        output_format = ReportFormat(request.output_format)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid format: {request.output_format}")

    result = service.generate_report(
        template_id=request.template_id,
        period_start=request.period_start,
        period_end=request.period_end,
        output_format=output_format,
        generated_by=user_id
    )

    db.commit()

    return GeneratedReportResponse(
        id=result.report_id,
        name="Generated Report",
        report_type="",
        format=request.output_format,
        status=result.status,
        period_start=request.period_start,
        period_end=request.period_end,
        file_size=None,
        download_url=result.download_url,
        error=result.error,
        generated_at=datetime.utcnow()
    )


@router.get("/generated", response_model=List[GeneratedReportResponse])
def list_generated_reports(
    limit: int = 50,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List generated reports."""
    from backend.app.services.report_service import GeneratedReport

    reports = db.query(GeneratedReport).filter(
        GeneratedReport.organization_id == organization_id
    ).order_by(GeneratedReport.generated_at.desc()).limit(limit).all()

    return [
        GeneratedReportResponse(
            id=r.id,
            name=r.name,
            report_type=r.report_type,
            format=r.format,
            status=r.status,
            period_start=r.period_start,
            period_end=r.period_end,
            file_size=r.file_size,
            download_url=f"/api/v1/scheduled-reports/{r.id}/download" if r.status == "completed" else None,
            error=r.error_message,
            generated_at=r.generated_at
        )
        for r in reports
    ]


@router.get("/{report_id}/download")
def download_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    """Download a generated report."""
    from backend.app.services.report_service import GeneratedReport
    import os

    report = db.query(GeneratedReport).filter(GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.status != "completed":
        raise HTTPException(status_code=400, detail=f"Report not ready: {report.status}")

    if not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found")

    filename = os.path.basename(report.file_path)
    return FileResponse(
        path=report.file_path,
        filename=filename,
        media_type="application/octet-stream"
    )
