"""
Export Service for SAVE-IT.AI
Data export functionality:
- CSV/Excel/PDF exports
- Scheduled report generation
- Large dataset streaming
- Custom export templates
"""
import csv
import io
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Generator
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

from backend.app.core.database import Base
from backend.app.models.devices import Device, DeviceTelemetry

logger = logging.getLogger(__name__)


class ExportFormat(Enum):
    """Supported export formats."""
    CSV = "csv"
    JSON = "json"
    EXCEL = "excel"
    PDF = "pdf"


class ExportStatus(Enum):
    """Export job status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class ExportJob(Base):
    """Export job tracking."""
    __tablename__ = "export_jobs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    export_type = Column(String(50), nullable=False)  # telemetry, alarms, devices, audit
    format = Column(String(20), nullable=False)  # csv, json, excel, pdf
    status = Column(String(20), default="pending", index=True)

    filters = Column(Text, nullable=True)  # JSON filter configuration
    columns = Column(Text, nullable=True)  # JSON column selection

    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    row_count = Column(Integer, nullable=True)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


@dataclass
class ExportConfig:
    """Export configuration."""
    export_type: str
    format: ExportFormat
    filters: Dict[str, Any]
    columns: Optional[List[str]] = None
    include_headers: bool = True
    date_format: str = "%Y-%m-%d %H:%M:%S"
    timezone: str = "UTC"


@dataclass
class ExportResult:
    """Result of export operation."""
    job_id: int
    status: str
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    row_count: Optional[int] = None
    download_url: Optional[str] = None
    error: Optional[str] = None


class ExportService:
    """
    Data export service.
    Handles various export formats and large dataset streaming.
    """

    # Export type handlers
    EXPORT_TYPES = ["telemetry", "alarms", "devices", "audit", "events"]

    # Default columns per export type
    DEFAULT_COLUMNS = {
        "telemetry": ["timestamp", "device_id", "device_name", "datapoint", "value", "unit"],
        "alarms": ["timestamp", "device_id", "device_name", "severity", "message", "status"],
        "devices": ["id", "name", "device_type", "ip_address", "is_online", "last_seen_at"],
        "audit": ["timestamp", "user_id", "action", "resource_type", "resource_id", "ip_address"],
        "events": ["timestamp", "device_id", "event_type", "severity", "message"]
    }

    def __init__(self, db: Session, storage_path: str = "/tmp/exports"):
        self.db = db
        self.storage_path = storage_path

    def create_export_job(
        self,
        user_id: int,
        config: ExportConfig,
        organization_id: Optional[int] = None
    ) -> ExportJob:
        """
        Create a new export job.

        Args:
            user_id: User requesting export
            config: Export configuration
            organization_id: Organization context

        Returns:
            Created ExportJob
        """
        job = ExportJob(
            user_id=user_id,
            organization_id=organization_id,
            export_type=config.export_type,
            format=config.format.value,
            filters=json.dumps(config.filters),
            columns=json.dumps(config.columns) if config.columns else None,
            status=ExportStatus.PENDING.value,
            expires_at=datetime.utcnow() + timedelta(hours=24)
        )

        self.db.add(job)
        self.db.flush()

        logger.info(f"Created export job {job.id}: {config.export_type} as {config.format.value}")

        return job

    def process_export(self, job_id: int) -> ExportResult:
        """
        Process an export job.

        Args:
            job_id: Export job ID

        Returns:
            ExportResult
        """
        job = self.db.query(ExportJob).filter(ExportJob.id == job_id).first()
        if not job:
            return ExportResult(job_id=job_id, status="failed", error="Job not found")

        job.status = ExportStatus.PROCESSING.value
        job.started_at = datetime.utcnow()
        self.db.flush()

        try:
            # Parse configuration
            filters = json.loads(job.filters) if job.filters else {}
            columns = json.loads(job.columns) if job.columns else None

            # Get data based on export type
            data = self._fetch_data(job.export_type, filters, job.organization_id)

            # Generate export file
            file_path, file_size, row_count = self._generate_file(
                data=data,
                format=ExportFormat(job.format),
                export_type=job.export_type,
                columns=columns,
                job_id=job_id
            )

            # Update job
            job.status = ExportStatus.COMPLETED.value
            job.completed_at = datetime.utcnow()
            job.file_path = file_path
            job.file_size = file_size
            job.row_count = row_count

            logger.info(f"Export job {job_id} completed: {row_count} rows, {file_size} bytes")

            return ExportResult(
                job_id=job_id,
                status=ExportStatus.COMPLETED.value,
                file_path=file_path,
                file_size=file_size,
                row_count=row_count,
                download_url=f"/api/v1/exports/{job_id}/download"
            )

        except Exception as e:
            job.status = ExportStatus.FAILED.value
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()

            logger.error(f"Export job {job_id} failed: {e}")

            return ExportResult(
                job_id=job_id,
                status=ExportStatus.FAILED.value,
                error=str(e)
            )

    def _fetch_data(
        self,
        export_type: str,
        filters: Dict[str, Any],
        organization_id: Optional[int] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """Fetch data for export based on type."""
        if export_type == "telemetry":
            yield from self._fetch_telemetry(filters, organization_id)
        elif export_type == "devices":
            yield from self._fetch_devices(filters, organization_id)
        elif export_type == "alarms":
            yield from self._fetch_alarms(filters, organization_id)
        elif export_type == "audit":
            yield from self._fetch_audit(filters, organization_id)
        else:
            raise ValueError(f"Unknown export type: {export_type}")

    def _fetch_telemetry(
        self,
        filters: Dict[str, Any],
        organization_id: Optional[int] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """Fetch telemetry data."""
        query = self.db.query(DeviceTelemetry)

        if filters.get("device_id"):
            query = query.filter(DeviceTelemetry.device_id == filters["device_id"])

        if filters.get("start_time"):
            start = datetime.fromisoformat(filters["start_time"])
            query = query.filter(DeviceTelemetry.timestamp >= start)

        if filters.get("end_time"):
            end = datetime.fromisoformat(filters["end_time"])
            query = query.filter(DeviceTelemetry.timestamp <= end)

        query = query.order_by(DeviceTelemetry.timestamp.desc())

        # Stream in batches
        batch_size = 1000
        offset = 0

        while True:
            batch = query.offset(offset).limit(batch_size).all()
            if not batch:
                break

            for record in batch:
                yield {
                    "timestamp": record.timestamp.isoformat() if record.timestamp else None,
                    "device_id": record.device_id,
                    "datapoint": record.datapoint_name,
                    "value": record.value,
                    "unit": getattr(record, 'unit', None)
                }

            offset += batch_size

    def _fetch_devices(
        self,
        filters: Dict[str, Any],
        organization_id: Optional[int] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """Fetch device data."""
        query = self.db.query(Device)

        if filters.get("site_id"):
            query = query.filter(Device.site_id == filters["site_id"])

        if filters.get("is_online") is not None:
            query = query.filter(Device.is_online == (1 if filters["is_online"] else 0))

        for device in query.all():
            yield {
                "id": device.id,
                "name": device.name,
                "device_type": device.device_type.value if device.device_type else None,
                "ip_address": device.ip_address,
                "is_online": device.is_online == 1,
                "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
                "serial_number": device.serial_number,
                "firmware_version": device.firmware_version
            }

    def _fetch_alarms(
        self,
        filters: Dict[str, Any],
        organization_id: Optional[int] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """Fetch alarm data."""
        from backend.app.models.telemetry import DeviceAlarm

        query = self.db.query(DeviceAlarm)

        if filters.get("device_id"):
            query = query.filter(DeviceAlarm.device_id == filters["device_id"])

        if filters.get("severity"):
            query = query.filter(DeviceAlarm.severity == filters["severity"])

        if filters.get("status"):
            query = query.filter(DeviceAlarm.status == filters["status"])

        query = query.order_by(DeviceAlarm.triggered_at.desc())

        for alarm in query.all():
            yield {
                "id": alarm.id,
                "timestamp": alarm.triggered_at.isoformat() if alarm.triggered_at else None,
                "device_id": alarm.device_id,
                "severity": alarm.severity,
                "message": alarm.message,
                "status": alarm.status.value if alarm.status else None,
                "datapoint": alarm.datapoint_name,
                "trigger_value": alarm.trigger_value
            }

    def _fetch_audit(
        self,
        filters: Dict[str, Any],
        organization_id: Optional[int] = None
    ) -> Generator[Dict[str, Any], None, None]:
        """Fetch audit log data."""
        from backend.app.models.platform import AuditLog

        query = self.db.query(AuditLog)

        if organization_id:
            query = query.filter(AuditLog.organization_id == organization_id)

        if filters.get("user_id"):
            query = query.filter(AuditLog.user_id == filters["user_id"])

        if filters.get("action"):
            query = query.filter(AuditLog.action == filters["action"])

        query = query.order_by(AuditLog.created_at.desc())

        for log in query.all():
            yield {
                "id": log.id,
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "user_id": log.user_id,
                "action": log.action.value if log.action else None,
                "resource_type": log.entity_type,
                "resource_id": log.entity_id,
                "ip_address": log.ip_address
            }

    def _generate_file(
        self,
        data: Generator[Dict[str, Any], None, None],
        format: ExportFormat,
        export_type: str,
        columns: Optional[List[str]],
        job_id: int
    ) -> tuple:
        """Generate export file."""
        import os

        # Ensure storage path exists
        os.makedirs(self.storage_path, exist_ok=True)

        filename = f"export_{job_id}_{export_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

        if format == ExportFormat.CSV:
            return self._generate_csv(data, columns or self.DEFAULT_COLUMNS.get(export_type, []), filename)
        elif format == ExportFormat.JSON:
            return self._generate_json(data, filename)
        elif format == ExportFormat.EXCEL:
            return self._generate_excel(data, columns or self.DEFAULT_COLUMNS.get(export_type, []), filename)
        else:
            raise ValueError(f"Unsupported export format: {format}")

    def _generate_csv(
        self,
        data: Generator[Dict[str, Any], None, None],
        columns: List[str],
        filename: str
    ) -> tuple:
        """Generate CSV file."""
        import os

        file_path = os.path.join(self.storage_path, f"{filename}.csv")
        row_count = 0

        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=columns, extrasaction='ignore')
            writer.writeheader()

            for row in data:
                writer.writerow(row)
                row_count += 1

        file_size = os.path.getsize(file_path)
        return file_path, file_size, row_count

    def _generate_json(
        self,
        data: Generator[Dict[str, Any], None, None],
        filename: str
    ) -> tuple:
        """Generate JSON file."""
        import os

        file_path = os.path.join(self.storage_path, f"{filename}.json")
        rows = list(data)
        row_count = len(rows)

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(rows, f, indent=2, default=str)

        file_size = os.path.getsize(file_path)
        return file_path, file_size, row_count

    def _generate_excel(
        self,
        data: Generator[Dict[str, Any], None, None],
        columns: List[str],
        filename: str
    ) -> tuple:
        """Generate Excel file."""
        import os

        try:
            import openpyxl
            from openpyxl import Workbook

            file_path = os.path.join(self.storage_path, f"{filename}.xlsx")

            wb = Workbook()
            ws = wb.active
            ws.title = "Export"

            # Write header
            ws.append(columns)

            # Write data
            row_count = 0
            for row in data:
                ws.append([row.get(col) for col in columns])
                row_count += 1

            wb.save(file_path)

            file_size = os.path.getsize(file_path)
            return file_path, file_size, row_count

        except ImportError:
            # Fallback to CSV if openpyxl not available
            logger.warning("openpyxl not available, falling back to CSV")
            return self._generate_csv(data, columns, filename)

    def get_job_status(self, job_id: int) -> Optional[ExportResult]:
        """Get export job status."""
        job = self.db.query(ExportJob).filter(ExportJob.id == job_id).first()
        if not job:
            return None

        return ExportResult(
            job_id=job.id,
            status=job.status,
            file_path=job.file_path,
            file_size=job.file_size,
            row_count=job.row_count,
            download_url=f"/api/v1/exports/{job.id}/download" if job.status == "completed" else None,
            error=job.error_message
        )

    def cleanup_expired(self) -> int:
        """Delete expired export files and jobs."""
        import os

        expired = self.db.query(ExportJob).filter(
            ExportJob.expires_at < datetime.utcnow(),
            ExportJob.status == ExportStatus.COMPLETED.value
        ).all()

        count = 0
        for job in expired:
            if job.file_path and os.path.exists(job.file_path):
                try:
                    os.remove(job.file_path)
                except Exception as e:
                    logger.error(f"Failed to delete export file {job.file_path}: {e}")

            job.status = ExportStatus.EXPIRED.value
            count += 1

        logger.info(f"Cleaned up {count} expired exports")
        return count


def get_export_service(db: Session) -> ExportService:
    """Get ExportService instance."""
    return ExportService(db)
