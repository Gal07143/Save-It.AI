"""
Export API Router for SAVE-IT.AI
Endpoints for data export functionality.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.export_service import (
    ExportService,
    ExportConfig,
    ExportFormat,
    get_export_service,
)

router = APIRouter(prefix="/exports", tags=["exports"])


class ExportRequest(BaseModel):
    """Request to create an export."""
    export_type: str  # telemetry, alarms, devices, audit
    format: str = "csv"  # csv, json, excel
    filters: dict = {}
    columns: Optional[List[str]] = None


class ExportJobResponse(BaseModel):
    """Export job response."""
    job_id: int
    status: str
    export_type: str
    format: str
    created_at: datetime

    class Config:
        from_attributes = True


class ExportStatusResponse(BaseModel):
    """Export status response."""
    job_id: int
    status: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    row_count: Optional[int] = None
    download_url: Optional[str] = None
    error: Optional[str] = None


@router.post("", response_model=ExportJobResponse)
def create_export(
    request: ExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_id: int = 1,  # Would come from auth
    organization_id: Optional[int] = None
):
    """Create a new export job."""
    service = get_export_service(db)

    try:
        export_format = ExportFormat(request.format)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid format: {request.format}")

    config = ExportConfig(
        export_type=request.export_type,
        format=export_format,
        filters=request.filters,
        columns=request.columns
    )

    job = service.create_export_job(
        user_id=user_id,
        config=config,
        organization_id=organization_id
    )

    # Process export in background
    background_tasks.add_task(service.process_export, job.id)

    db.commit()

    return ExportJobResponse(
        job_id=job.id,
        status=job.status,
        export_type=job.export_type,
        format=job.format,
        created_at=job.created_at
    )


@router.get("/{job_id}", response_model=ExportStatusResponse)
def get_export_status(
    job_id: int,
    db: Session = Depends(get_db)
):
    """Get export job status."""
    service = get_export_service(db)
    result = service.get_job_status(job_id)

    if not result:
        raise HTTPException(status_code=404, detail="Export job not found")

    return ExportStatusResponse(
        job_id=result.job_id,
        status=result.status,
        file_path=result.file_path,
        file_size=result.file_size,
        row_count=result.row_count,
        download_url=result.download_url,
        error=result.error
    )


@router.get("/{job_id}/download")
def download_export(
    job_id: int,
    db: Session = Depends(get_db)
):
    """Download completed export file."""
    service = get_export_service(db)
    result = service.get_job_status(job_id)

    if not result:
        raise HTTPException(status_code=404, detail="Export job not found")

    if result.status != "completed":
        raise HTTPException(status_code=400, detail=f"Export not ready: {result.status}")

    if not result.file_path:
        raise HTTPException(status_code=404, detail="Export file not found")

    import os
    if not os.path.exists(result.file_path):
        raise HTTPException(status_code=404, detail="Export file not found on disk")

    filename = os.path.basename(result.file_path)
    return FileResponse(
        path=result.file_path,
        filename=filename,
        media_type="application/octet-stream"
    )


@router.delete("/{job_id}")
def delete_export(
    job_id: int,
    db: Session = Depends(get_db)
):
    """Delete an export job and its file."""
    from app.services.export_service import ExportJob
    import os

    job = db.query(ExportJob).filter(ExportJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")

    # Delete file if exists
    if job.file_path and os.path.exists(job.file_path):
        os.remove(job.file_path)

    db.delete(job)
    db.commit()

    return {"message": "Export deleted"}
