"""
Report Service for SAVE-IT.AI
Scheduled and on-demand reporting:
- Report templates
- Scheduled generation
- PDF/Excel output
- Email delivery
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

from backend.app.core.database import Base

logger = logging.getLogger(__name__)


class ReportType(Enum):
    """Available report types."""
    TELEMETRY_SUMMARY = "telemetry_summary"
    ALARM_SUMMARY = "alarm_summary"
    DEVICE_STATUS = "device_status"
    UPTIME_REPORT = "uptime_report"
    KPI_REPORT = "kpi_report"
    AUDIT_REPORT = "audit_report"
    CUSTOM = "custom"


class ReportFormat(Enum):
    """Report output formats."""
    PDF = "pdf"
    EXCEL = "excel"
    HTML = "html"
    CSV = "csv"


class ScheduleFrequency(Enum):
    """Report schedule frequency."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class ReportTemplate(Base):
    """Report template definition."""
    __tablename__ = "report_templates"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    report_type = Column(String(50), nullable=False)

    # Template configuration
    config = Column(Text, nullable=True)  # JSON config
    filters = Column(Text, nullable=True)  # JSON filters
    sections = Column(Text, nullable=True)  # JSON sections to include

    # Output options
    default_format = Column(String(20), default="pdf")
    include_charts = Column(Integer, default=1)
    include_raw_data = Column(Integer, default=0)

    is_active = Column(Integer, default=1)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReportSchedule(Base):
    """Scheduled report configuration."""
    __tablename__ = "report_schedules"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("report_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    frequency = Column(String(20), nullable=False)  # daily, weekly, monthly
    schedule_config = Column(Text, nullable=True)  # JSON: day_of_week, day_of_month, hour

    # Recipients
    recipients = Column(Text, nullable=True)  # JSON array of email addresses

    # Output
    output_format = Column(String(20), default="pdf")

    is_active = Column(Integer, default=1)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GeneratedReport(Base):
    """Generated report record."""
    __tablename__ = "generated_reports"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("report_templates.id"), nullable=True, index=True)
    schedule_id = Column(Integer, ForeignKey("report_schedules.id"), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    report_type = Column(String(50), nullable=False)
    format = Column(String(20), nullable=False)

    # Time range
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    # Output
    file_path = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)

    # Status
    status = Column(String(20), default="pending")  # pending, generating, completed, failed
    error_message = Column(Text, nullable=True)

    generated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


@dataclass
class ReportData:
    """Data structure for report content."""
    title: str
    period: Dict[str, datetime]
    sections: List[Dict[str, Any]]
    metadata: Dict[str, Any]
    generated_at: datetime


@dataclass
class ReportResult:
    """Result of report generation."""
    report_id: int
    status: str
    file_path: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None


class ReportService:
    """
    Report generation and scheduling service.
    """

    def __init__(self, db: Session, storage_path: str = "/tmp/reports"):
        self.db = db
        self.storage_path = storage_path

    def create_template(
        self,
        organization_id: int,
        name: str,
        report_type: ReportType,
        config: Optional[Dict] = None,
        filters: Optional[Dict] = None,
        created_by: Optional[int] = None,
        **kwargs
    ) -> ReportTemplate:
        """
        Create a report template.

        Args:
            organization_id: Organization ID
            name: Template name
            report_type: Type of report
            config: Template configuration
            filters: Default filters
            created_by: User creating template

        Returns:
            Created ReportTemplate
        """
        template = ReportTemplate(
            organization_id=organization_id,
            name=name,
            report_type=report_type.value,
            config=json.dumps(config) if config else None,
            filters=json.dumps(filters) if filters else None,
            created_by=created_by,
            **kwargs
        )

        self.db.add(template)
        self.db.flush()

        logger.info(f"Created report template: {name} (ID: {template.id})")

        return template

    def create_schedule(
        self,
        template_id: int,
        organization_id: int,
        name: str,
        frequency: ScheduleFrequency,
        recipients: List[str],
        schedule_config: Optional[Dict] = None,
        output_format: ReportFormat = ReportFormat.PDF
    ) -> ReportSchedule:
        """
        Create a report schedule.

        Args:
            template_id: Template to use
            organization_id: Organization ID
            name: Schedule name
            frequency: How often to generate
            recipients: Email recipients
            schedule_config: Specific schedule configuration
            output_format: Output format

        Returns:
            Created ReportSchedule
        """
        schedule = ReportSchedule(
            template_id=template_id,
            organization_id=organization_id,
            name=name,
            frequency=frequency.value,
            schedule_config=json.dumps(schedule_config) if schedule_config else None,
            recipients=json.dumps(recipients),
            output_format=output_format.value,
            next_run_at=self._calculate_next_run(frequency, schedule_config)
        )

        self.db.add(schedule)
        self.db.flush()

        logger.info(f"Created report schedule: {name} (ID: {schedule.id})")

        return schedule

    def generate_report(
        self,
        template_id: int,
        period_start: datetime,
        period_end: datetime,
        output_format: ReportFormat = ReportFormat.PDF,
        generated_by: Optional[int] = None
    ) -> ReportResult:
        """
        Generate a report from template.

        Args:
            template_id: Template ID
            period_start: Report period start
            period_end: Report period end
            output_format: Output format
            generated_by: User generating report

        Returns:
            ReportResult
        """
        template = self.db.query(ReportTemplate).filter(
            ReportTemplate.id == template_id
        ).first()

        if not template:
            return ReportResult(
                report_id=0,
                status="failed",
                error="Template not found"
            )

        # Create report record
        report = GeneratedReport(
            template_id=template_id,
            organization_id=template.organization_id,
            name=f"{template.name} - {period_start.strftime('%Y-%m-%d')} to {period_end.strftime('%Y-%m-%d')}",
            report_type=template.report_type,
            format=output_format.value,
            period_start=period_start,
            period_end=period_end,
            status="generating",
            generated_by=generated_by,
            expires_at=datetime.utcnow() + timedelta(days=30)
        )

        self.db.add(report)
        self.db.flush()

        try:
            # Generate report content
            data = self._gather_report_data(
                template=template,
                period_start=period_start,
                period_end=period_end
            )

            # Generate file
            file_path, file_size = self._generate_file(
                data=data,
                format=output_format,
                report_id=report.id
            )

            report.status = "completed"
            report.file_path = file_path
            report.file_size = file_size

            logger.info(f"Generated report {report.id}: {file_path}")

            return ReportResult(
                report_id=report.id,
                status="completed",
                file_path=file_path,
                download_url=f"/api/v1/reports/{report.id}/download"
            )

        except Exception as e:
            report.status = "failed"
            report.error_message = str(e)

            logger.error(f"Report generation failed: {e}")

            return ReportResult(
                report_id=report.id,
                status="failed",
                error=str(e)
            )

    def _gather_report_data(
        self,
        template: ReportTemplate,
        period_start: datetime,
        period_end: datetime
    ) -> ReportData:
        """Gather data for report based on type."""
        report_type = template.report_type
        config = json.loads(template.config) if template.config else {}
        filters = json.loads(template.filters) if template.filters else {}

        sections = []

        if report_type == ReportType.TELEMETRY_SUMMARY.value:
            sections = self._gather_telemetry_summary(period_start, period_end, filters)
        elif report_type == ReportType.ALARM_SUMMARY.value:
            sections = self._gather_alarm_summary(period_start, period_end, filters)
        elif report_type == ReportType.DEVICE_STATUS.value:
            sections = self._gather_device_status(period_start, period_end, filters)
        elif report_type == ReportType.UPTIME_REPORT.value:
            sections = self._gather_uptime_report(period_start, period_end, filters)
        elif report_type == ReportType.KPI_REPORT.value:
            sections = self._gather_kpi_report(period_start, period_end, filters)

        return ReportData(
            title=template.name,
            period={"start": period_start, "end": period_end},
            sections=sections,
            metadata={
                "template_id": template.id,
                "organization_id": template.organization_id,
                "generated_at": datetime.utcnow().isoformat()
            },
            generated_at=datetime.utcnow()
        )

    def _gather_telemetry_summary(
        self,
        period_start: datetime,
        period_end: datetime,
        filters: Dict
    ) -> List[Dict]:
        """Gather telemetry summary data."""
        from backend.app.models.devices import DeviceTelemetry
        from sqlalchemy import func

        query = self.db.query(
            DeviceTelemetry.device_id,
            DeviceTelemetry.datapoint_name,
            func.count(DeviceTelemetry.id).label('count'),
            func.avg(DeviceTelemetry.value).label('avg'),
            func.min(DeviceTelemetry.value).label('min'),
            func.max(DeviceTelemetry.value).label('max')
        ).filter(
            DeviceTelemetry.timestamp >= period_start,
            DeviceTelemetry.timestamp <= period_end
        )

        if filters.get("device_ids"):
            query = query.filter(DeviceTelemetry.device_id.in_(filters["device_ids"]))

        results = query.group_by(
            DeviceTelemetry.device_id,
            DeviceTelemetry.datapoint_name
        ).all()

        return [{
            "type": "telemetry_summary",
            "data": [
                {
                    "device_id": r.device_id,
                    "datapoint": r.datapoint_name,
                    "count": r.count,
                    "avg": round(float(r.avg), 2) if r.avg else None,
                    "min": r.min,
                    "max": r.max
                }
                for r in results
            ]
        }]

    def _gather_alarm_summary(
        self,
        period_start: datetime,
        period_end: datetime,
        filters: Dict
    ) -> List[Dict]:
        """Gather alarm summary data."""
        from backend.app.models.telemetry import DeviceAlarm
        from sqlalchemy import func

        query = self.db.query(
            DeviceAlarm.severity,
            func.count(DeviceAlarm.id).label('count')
        ).filter(
            DeviceAlarm.triggered_at >= period_start,
            DeviceAlarm.triggered_at <= period_end
        )

        results = query.group_by(DeviceAlarm.severity).all()

        return [{
            "type": "alarm_summary",
            "data": {
                "by_severity": {r.severity: r.count for r in results},
                "total": sum(r.count for r in results)
            }
        }]

    def _gather_device_status(
        self,
        period_start: datetime,
        period_end: datetime,
        filters: Dict
    ) -> List[Dict]:
        """Gather device status data."""
        from backend.app.models.devices import Device

        devices = self.db.query(Device).filter(Device.is_active == 1).all()

        return [{
            "type": "device_status",
            "data": {
                "total": len(devices),
                "online": sum(1 for d in devices if d.is_online == 1),
                "offline": sum(1 for d in devices if d.is_online != 1),
                "devices": [
                    {
                        "id": d.id,
                        "name": d.name,
                        "is_online": d.is_online == 1,
                        "last_seen": d.last_seen_at.isoformat() if d.last_seen_at else None
                    }
                    for d in devices
                ]
            }
        }]

    def _gather_uptime_report(
        self,
        period_start: datetime,
        period_end: datetime,
        filters: Dict
    ) -> List[Dict]:
        """Gather uptime report data."""
        # Simplified uptime calculation
        from backend.app.models.devices import DeviceEvent, Device

        devices = self.db.query(Device).filter(Device.is_active == 1).all()

        uptime_data = []
        for device in devices:
            # Calculate uptime based on online/offline events
            events = self.db.query(DeviceEvent).filter(
                DeviceEvent.device_id == device.id,
                DeviceEvent.event_type.in_(['device_online', 'device_offline']),
                DeviceEvent.timestamp >= period_start,
                DeviceEvent.timestamp <= period_end
            ).order_by(DeviceEvent.timestamp.asc()).all()

            # Simplified: assume 100% if currently online, 0% if offline
            uptime_percent = 100 if device.is_online == 1 else 0

            uptime_data.append({
                "device_id": device.id,
                "device_name": device.name,
                "uptime_percent": uptime_percent,
                "events_count": len(events)
            })

        return [{
            "type": "uptime_report",
            "data": uptime_data
        }]

    def _gather_kpi_report(
        self,
        period_start: datetime,
        period_end: datetime,
        filters: Dict
    ) -> List[Dict]:
        """Gather KPI report data."""
        from backend.app.models.telemetry import KPIDefinition, KPIValue

        kpis = self.db.query(KPIDefinition).filter(
            KPIDefinition.is_active == 1
        ).all()

        kpi_data = []
        for kpi in kpis:
            values = self.db.query(KPIValue).filter(
                KPIValue.kpi_id == kpi.id,
                KPIValue.period_start >= period_start,
                KPIValue.period_end <= period_end
            ).all()

            kpi_data.append({
                "kpi_id": kpi.id,
                "name": kpi.name,
                "values": [
                    {
                        "period_start": v.period_start.isoformat(),
                        "period_end": v.period_end.isoformat(),
                        "value": v.value
                    }
                    for v in values
                ]
            })

        return [{
            "type": "kpi_report",
            "data": kpi_data
        }]

    def _generate_file(
        self,
        data: ReportData,
        format: ReportFormat,
        report_id: int
    ) -> tuple:
        """Generate report file."""
        import os

        os.makedirs(self.storage_path, exist_ok=True)

        filename = f"report_{report_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

        if format == ReportFormat.PDF:
            return self._generate_pdf(data, filename)
        elif format == ReportFormat.EXCEL:
            return self._generate_excel(data, filename)
        elif format == ReportFormat.HTML:
            return self._generate_html(data, filename)
        else:
            return self._generate_csv(data, filename)

    def _generate_pdf(self, data: ReportData, filename: str) -> tuple:
        """Generate PDF report."""
        import os

        # Simplified: generate HTML and note that in production would use wkhtmltopdf or similar
        file_path = os.path.join(self.storage_path, f"{filename}.html")

        html_content = f"""
        <html>
        <head><title>{data.title}</title></head>
        <body>
            <h1>{data.title}</h1>
            <p>Period: {data.period['start']} to {data.period['end']}</p>
            <p>Generated: {data.generated_at}</p>
            <pre>{json.dumps(data.sections, indent=2, default=str)}</pre>
        </body>
        </html>
        """

        with open(file_path, 'w') as f:
            f.write(html_content)

        file_size = os.path.getsize(file_path)
        return file_path, file_size

    def _generate_excel(self, data: ReportData, filename: str) -> tuple:
        """Generate Excel report."""
        import os

        try:
            import openpyxl
            from openpyxl import Workbook

            file_path = os.path.join(self.storage_path, f"{filename}.xlsx")

            wb = Workbook()
            ws = wb.active
            ws.title = "Report"

            # Write header
            ws.append([data.title])
            ws.append([f"Period: {data.period['start']} to {data.period['end']}"])
            ws.append([])

            # Write sections
            for section in data.sections:
                ws.append([section.get('type', 'Section')])
                section_data = section.get('data', [])
                if isinstance(section_data, list):
                    for item in section_data:
                        ws.append(list(item.values()) if isinstance(item, dict) else [item])
                elif isinstance(section_data, dict):
                    for key, value in section_data.items():
                        ws.append([key, str(value)])
                ws.append([])

            wb.save(file_path)

            file_size = os.path.getsize(file_path)
            return file_path, file_size

        except ImportError:
            return self._generate_csv(data, filename)

    def _generate_html(self, data: ReportData, filename: str) -> tuple:
        """Generate HTML report."""
        import os

        file_path = os.path.join(self.storage_path, f"{filename}.html")

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{data.title}</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                h1 {{ color: #333; }}
                .section {{ margin: 20px 0; padding: 10px; background: #f5f5f5; }}
                table {{ border-collapse: collapse; width: 100%; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background: #4CAF50; color: white; }}
            </style>
        </head>
        <body>
            <h1>{data.title}</h1>
            <p><strong>Period:</strong> {data.period['start']} to {data.period['end']}</p>
            <p><strong>Generated:</strong> {data.generated_at}</p>
        """

        for section in data.sections:
            html_content += f"<div class='section'><h2>{section.get('type', 'Section')}</h2>"
            html_content += f"<pre>{json.dumps(section.get('data', {}), indent=2, default=str)}</pre>"
            html_content += "</div>"

        html_content += "</body></html>"

        with open(file_path, 'w') as f:
            f.write(html_content)

        file_size = os.path.getsize(file_path)
        return file_path, file_size

    def _generate_csv(self, data: ReportData, filename: str) -> tuple:
        """Generate CSV report."""
        import os
        import csv

        file_path = os.path.join(self.storage_path, f"{filename}.csv")

        with open(file_path, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([data.title])
            writer.writerow([f"Period: {data.period['start']} to {data.period['end']}"])
            writer.writerow([])

            for section in data.sections:
                writer.writerow([section.get('type', 'Section')])
                section_data = section.get('data', [])
                if isinstance(section_data, list):
                    for item in section_data:
                        if isinstance(item, dict):
                            writer.writerow(list(item.values()))
                writer.writerow([])

        file_size = os.path.getsize(file_path)
        return file_path, file_size

    def _calculate_next_run(
        self,
        frequency: ScheduleFrequency,
        config: Optional[Dict]
    ) -> datetime:
        """Calculate next scheduled run time."""
        now = datetime.utcnow()
        config = config or {}

        hour = config.get('hour', 6)  # Default 6 AM

        if frequency == ScheduleFrequency.DAILY:
            next_run = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            if next_run <= now:
                next_run += timedelta(days=1)

        elif frequency == ScheduleFrequency.WEEKLY:
            day_of_week = config.get('day_of_week', 0)  # Monday
            next_run = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            days_ahead = day_of_week - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            next_run += timedelta(days=days_ahead)

        elif frequency == ScheduleFrequency.MONTHLY:
            day_of_month = config.get('day_of_month', 1)
            next_run = now.replace(day=day_of_month, hour=hour, minute=0, second=0, microsecond=0)
            if next_run <= now:
                if now.month == 12:
                    next_run = next_run.replace(year=now.year + 1, month=1)
                else:
                    next_run = next_run.replace(month=now.month + 1)

        else:
            next_run = now + timedelta(days=1)

        return next_run

    def process_scheduled_reports(self) -> int:
        """Process all due scheduled reports."""
        now = datetime.utcnow()

        due_schedules = self.db.query(ReportSchedule).filter(
            ReportSchedule.is_active == 1,
            ReportSchedule.next_run_at <= now
        ).all()

        processed = 0

        for schedule in due_schedules:
            try:
                # Calculate period based on frequency
                if schedule.frequency == ScheduleFrequency.DAILY.value:
                    period_start = now - timedelta(days=1)
                elif schedule.frequency == ScheduleFrequency.WEEKLY.value:
                    period_start = now - timedelta(days=7)
                elif schedule.frequency == ScheduleFrequency.MONTHLY.value:
                    period_start = now - timedelta(days=30)
                else:
                    period_start = now - timedelta(days=1)

                # Generate report
                result = self.generate_report(
                    template_id=schedule.template_id,
                    period_start=period_start,
                    period_end=now,
                    output_format=ReportFormat(schedule.output_format)
                )

                # Update schedule
                schedule.last_run_at = now
                config = json.loads(schedule.schedule_config) if schedule.schedule_config else {}
                schedule.next_run_at = self._calculate_next_run(
                    ScheduleFrequency(schedule.frequency),
                    config
                )

                # Send emails to recipients
                if result.status == "completed" and schedule.recipients:
                    recipients = json.loads(schedule.recipients)
                    self._send_report_emails(recipients, result)

                processed += 1

            except Exception as e:
                logger.error(f"Failed to process schedule {schedule.id}: {e}")

        return processed

    def _send_report_emails(
        self,
        recipients: List[str],
        result: ReportResult
    ):
        """Send report to email recipients."""
        # In production, would integrate with email service
        logger.info(f"Would send report {result.report_id} to {recipients}")


def get_report_service(db: Session) -> ReportService:
    """Get ReportService instance."""
    return ReportService(db)
