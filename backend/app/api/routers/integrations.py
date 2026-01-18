"""Data Source Integration API endpoints."""
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
import csv
import io

from backend.app.core.database import get_db
from backend.app.models import DataSource, Gateway, DeviceTemplate, ModbusRegister, CommunicationLog
from backend.app.schemas import DataSourceCreate, DataSourceResponse
from backend.app.schemas.integrations import (
    BulkDeviceImportRequest, BulkDeviceImportResponse, BulkImportResultRow,
    DeviceHealthDashboard, DeviceHealthSummary
)

router = APIRouter(prefix="/api/v1/data-sources", tags=["integrations"])


@router.post("", response_model=DataSourceResponse)
def create_data_source(source: DataSourceCreate, db: Session = Depends(get_db)):
    """Create a new data source for meter integration."""
    db_source = DataSource(**source.model_dump())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


@router.get("", response_model=List[DataSourceResponse])
def list_data_sources(
    site_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all data sources, optionally filtered by site."""
    query = db.query(DataSource)
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{source_id}", response_model=DataSourceResponse)
def get_data_source(source_id: int, db: Session = Depends(get_db)):
    """Get data source by ID."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    return source


@router.post("/bulk-import", response_model=BulkDeviceImportResponse)
def bulk_import_devices(request: BulkDeviceImportRequest, db: Session = Depends(get_db)):
    """Bulk import multiple devices from a list."""
    results: List[BulkImportResultRow] = []
    successful = 0
    failed = 0
    
    gateways = {g.name: g.id for g in db.query(Gateway).filter(Gateway.site_id == request.site_id).all()}
    templates = {t.name: t for t in db.query(DeviceTemplate).filter(DeviceTemplate.is_active == True).all()}
    
    for idx, device in enumerate(request.devices, start=1):
        try:
            if not device.name or not device.name.strip():
                raise ValueError("Device name is required")
            
            if device.protocol in ('modbus_tcp', 'modbus_rtu') and not device.host:
                raise ValueError(f"Host is required for {device.protocol} protocol")
            
            gateway_id = None
            if device.gateway_name and device.gateway_name in gateways:
                gateway_id = gateways[device.gateway_name]
            
            db_source = DataSource(
                name=device.name,
                site_id=request.site_id,
                protocol=device.protocol,
                host=device.host,
                port=device.port,
                slave_id=device.slave_id,
                location=device.location,
                description=device.description,
                gateway_id=gateway_id,
                is_active=True
            )
            db.add(db_source)
            db.flush()
            
            if device.template_name and device.template_name in templates:
                template = templates[device.template_name]
                for tr in template.template_registers:
                    register = ModbusRegister(
                        data_source_id=db_source.id,
                        name=tr.name,
                        description=tr.description,
                        register_address=tr.register_address,
                        register_type=tr.register_type,
                        data_type=tr.data_type,
                        byte_order=tr.byte_order,
                        register_count=tr.register_count,
                        scale_factor=tr.scale_factor,
                        offset=tr.offset,
                        unit=tr.unit,
                        is_writable=tr.is_writable,
                        is_active=True
                    )
                    db.add(register)
            
            results.append(BulkImportResultRow(
                row_number=idx,
                name=device.name,
                success=True,
                data_source_id=int(db_source.id)  # type: ignore
            ))
            successful += 1
            
        except Exception as e:
            results.append(BulkImportResultRow(
                row_number=idx,
                name=device.name,
                success=False,
                error=str(e)
            ))
            failed += 1
    
    db.commit()
    
    return BulkDeviceImportResponse(
        total=len(request.devices),
        successful=successful,
        failed=failed,
        results=results
    )


@router.post("/bulk-import/csv")
async def bulk_import_devices_csv(
    site_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Bulk import devices from CSV file."""
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV format")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    devices = []
    for row in reader:
        devices.append({
            "name": row.get("name", ""),
            "protocol": row.get("protocol", "modbus_tcp"),
            "host": row.get("host"),
            "port": int(row.get("port", 502)),
            "slave_id": int(row.get("slave_id", 1)),
            "location": row.get("location"),
            "template_name": row.get("template_name"),
            "gateway_name": row.get("gateway_name"),
            "description": row.get("description")
        })
    
    request = BulkDeviceImportRequest(site_id=site_id, devices=devices)
    return bulk_import_devices(request, db)


@router.get("/health/dashboard", response_model=DeviceHealthDashboard)
def get_device_health_dashboard(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get device health dashboard with status overview."""
    query = db.query(DataSource)
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    
    data_sources = query.all()
    
    now = datetime.utcnow()
    cutoff_24h = now - timedelta(hours=24)
    
    devices: List[DeviceHealthSummary] = []
    online_count = 0
    offline_count = 0
    error_count = 0
    unknown_count = 0
    total_success_rate = 0.0
    
    for ds in data_sources:
        ds_id = int(ds.id)  # type: ignore
        logs = db.query(CommunicationLog).filter(
            CommunicationLog.data_source_id == ds_id,
            CommunicationLog.timestamp >= cutoff_24h
        ).all()
        
        total_requests = sum(int(log.request_count) for log in logs)  # type: ignore
        total_success = sum(int(log.success_count) for log in logs)  # type: ignore
        total_errors = sum(int(log.error_count) for log in logs)  # type: ignore
        
        success_rate = float(total_success / total_requests * 100) if total_requests > 0 else 0.0
        avg_response: Optional[float] = None
        if logs:
            response_times = [float(l.avg_response_time_ms) for l in logs if l.avg_response_time_ms is not None]  # type: ignore
            if response_times:
                avg_response = sum(response_times) / len(response_times)
        
        last_log = db.query(CommunicationLog).filter(
            CommunicationLog.data_source_id == ds_id
        ).order_by(CommunicationLog.timestamp.desc()).first()
        
        last_error_log = db.query(CommunicationLog).filter(
            CommunicationLog.data_source_id == ds_id,
            CommunicationLog.status == "error"
        ).order_by(CommunicationLog.timestamp.desc()).first()
        
        last_communication = None
        if last_log:
            last_communication = last_log.timestamp  # type: ignore
            if (now - last_log.timestamp).total_seconds() > 300:  # type: ignore
                status = "offline"
            elif str(last_log.status) == "error":
                status = "error"
            else:
                status = "online"
        elif ds.last_poll_at:
            last_communication = ds.last_poll_at
            poll_age = (now - ds.last_poll_at).total_seconds() if ds.last_poll_at else 999999  # type: ignore
            if ds.last_error:
                status = "error"
            elif poll_age < 300:
                status = "online"
            elif poll_age < 3600:
                status = "offline"
            else:
                status = "unknown"
        elif ds.is_active:
            status = "unknown"
        else:
            status = "offline"
        
        if status == "online":
            online_count += 1
        elif status == "offline":
            offline_count += 1
        elif status == "error":
            error_count += 1
        else:
            unknown_count += 1
        
        total_success_rate += success_rate
        
        devices.append(DeviceHealthSummary(
            data_source_id=ds_id,
            name=str(ds.name),
            protocol=str(ds.protocol) if ds.protocol else "unknown",
            status=status,
            last_communication=last_communication,  # type: ignore
            success_rate_24h=round(success_rate, 2),
            avg_response_time_ms=round(avg_response, 2) if avg_response is not None else None,
            error_count_24h=total_errors,
            last_error=str(last_error_log.message) if last_error_log is not None and last_error_log.message is not None else None,
            firmware_version=None
        ))
    
    total_devices = len(data_sources)
    overall_success = (total_success_rate / total_devices) if total_devices > 0 else 0.0
    
    return DeviceHealthDashboard(
        total_devices=total_devices,
        online_count=online_count,
        offline_count=offline_count,
        error_count=error_count,
        unknown_count=unknown_count,
        overall_success_rate=round(overall_success, 2),
        devices=devices
    )
