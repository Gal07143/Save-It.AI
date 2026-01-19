"""Data Source Integration API endpoints."""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
import csv
import io
import socket

from backend.app.core.database import get_db
from backend.app.models import DataSource, Gateway, DeviceTemplate, ModbusRegister, CommunicationLog
from backend.app.models.integrations import MaintenanceSchedule, DeviceAlert
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


# ===================== Data Validation Rules =====================

from backend.app.models.integrations import DataValidationRule, ValidationViolation, DeviceGroup, DeviceGroupMember
from backend.app.schemas.integrations import (
    DataValidationRuleCreate, DataValidationRuleUpdate, DataValidationRuleResponse,
    ValidationViolationResponse, DeviceGroupCreate, DeviceGroupUpdate,
    DeviceGroupResponse, DeviceGroupMemberCreate, DeviceGroupMemberResponse
)


@router.post("/validation-rules", response_model=DataValidationRuleResponse)
def create_validation_rule(
    rule: DataValidationRuleCreate,
    db: Session = Depends(get_db)
) -> DataValidationRuleResponse:
    """Create a new data validation rule."""
    db_rule = DataValidationRule(
        site_id=rule.site_id,
        data_source_id=rule.data_source_id,
        register_id=rule.register_id,
        name=rule.name,
        description=rule.description,
        rule_type=rule.rule_type.value,
        severity=rule.severity.value,
        min_value=rule.min_value,
        max_value=rule.max_value,
        rate_of_change_max=rule.rate_of_change_max,
        rate_of_change_period_seconds=rule.rate_of_change_period_seconds,
        stale_threshold_seconds=rule.stale_threshold_seconds,
        is_active=1 if rule.is_active else 0,
        action_on_violation=rule.action_on_violation
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return DataValidationRuleResponse.model_validate(db_rule)


@router.get("/validation-rules", response_model=List[DataValidationRuleResponse])
def list_validation_rules(
    site_id: Optional[int] = None,
    data_source_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> List[DataValidationRuleResponse]:
    """List all validation rules, optionally filtered by site or data source."""
    query = db.query(DataValidationRule)
    if site_id:
        query = query.filter(DataValidationRule.site_id == site_id)
    if data_source_id:
        query = query.filter(DataValidationRule.data_source_id == data_source_id)
    rules = query.order_by(DataValidationRule.name).all()
    return [DataValidationRuleResponse.model_validate(r) for r in rules]


@router.get("/validation-rules/{rule_id}", response_model=DataValidationRuleResponse)
def get_validation_rule(
    rule_id: int,
    db: Session = Depends(get_db)
) -> DataValidationRuleResponse:
    """Get a specific validation rule."""
    rule = db.query(DataValidationRule).filter(DataValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found")
    return DataValidationRuleResponse.model_validate(rule)


@router.put("/validation-rules/{rule_id}", response_model=DataValidationRuleResponse)
def update_validation_rule(
    rule_id: int,
    update: DataValidationRuleUpdate,
    db: Session = Depends(get_db)
) -> DataValidationRuleResponse:
    """Update a validation rule."""
    rule = db.query(DataValidationRule).filter(DataValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found")
    
    update_data = update.model_dump(exclude_unset=True)
    if 'severity' in update_data and update_data['severity']:
        update_data['severity'] = update_data['severity'].value
    if 'is_active' in update_data:
        update_data['is_active'] = 1 if update_data['is_active'] else 0
    
    for key, value in update_data.items():
        setattr(rule, key, value)
    
    db.commit()
    db.refresh(rule)
    return DataValidationRuleResponse.model_validate(rule)


@router.delete("/validation-rules/{rule_id}")
def delete_validation_rule(
    rule_id: int,
    db: Session = Depends(get_db)
) -> dict:
    """Delete a validation rule."""
    rule = db.query(DataValidationRule).filter(DataValidationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Validation rule not found")
    db.delete(rule)
    db.commit()
    return {"success": True, "message": "Validation rule deleted"}


@router.get("/validation-violations", response_model=List[ValidationViolationResponse])
def list_validation_violations(
    site_id: Optional[int] = None,
    rule_id: Optional[int] = None,
    is_acknowledged: Optional[bool] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
) -> List[ValidationViolationResponse]:
    """List validation violations."""
    query = db.query(ValidationViolation)
    if rule_id:
        query = query.filter(ValidationViolation.rule_id == rule_id)
    if is_acknowledged is not None:
        query = query.filter(ValidationViolation.is_acknowledged == (1 if is_acknowledged else 0))
    if site_id:
        rule_ids = [r.id for r in db.query(DataValidationRule.id).filter(DataValidationRule.site_id == site_id).all()]
        query = query.filter(ValidationViolation.rule_id.in_(rule_ids))
    
    violations = query.order_by(ValidationViolation.timestamp.desc()).limit(limit).all()
    return [ValidationViolationResponse.model_validate(v) for v in violations]


@router.post("/validation-violations/{violation_id}/acknowledge")
def acknowledge_violation(
    violation_id: int,
    user_id: int = 1,
    db: Session = Depends(get_db)
) -> dict:
    """Acknowledge a validation violation."""
    violation = db.query(ValidationViolation).filter(ValidationViolation.id == violation_id).first()
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")
    
    violation.is_acknowledged = 1
    violation.acknowledged_by = user_id
    violation.acknowledged_at = datetime.utcnow()
    db.commit()
    return {"success": True, "message": "Violation acknowledged"}


# ===================== Device Groups =====================

@router.post("/device-groups", response_model=DeviceGroupResponse)
def create_device_group(
    group: DeviceGroupCreate,
    db: Session = Depends(get_db)
) -> DeviceGroupResponse:
    """Create a new device group."""
    db_group = DeviceGroup(
        site_id=group.site_id,
        name=group.name,
        description=group.description,
        group_type=group.group_type,
        parent_group_id=group.parent_group_id,
        color=group.color,
        icon=group.icon,
        display_order=group.display_order,
        is_active=1 if group.is_active else 0
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    
    response = DeviceGroupResponse.model_validate(db_group)
    response.device_count = 0
    return response


@router.get("/device-groups", response_model=List[DeviceGroupResponse])
def list_device_groups(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> List[DeviceGroupResponse]:
    """List all device groups."""
    query = db.query(DeviceGroup).filter(DeviceGroup.is_active == 1)
    if site_id:
        query = query.filter(DeviceGroup.site_id == site_id)
    groups = query.order_by(DeviceGroup.display_order, DeviceGroup.name).all()
    
    result = []
    for g in groups:
        member_count = db.query(DeviceGroupMember).filter(DeviceGroupMember.group_id == g.id).count()
        resp = DeviceGroupResponse.model_validate(g)
        resp.device_count = member_count
        result.append(resp)
    return result


@router.get("/device-groups/{group_id}", response_model=DeviceGroupResponse)
def get_device_group(
    group_id: int,
    db: Session = Depends(get_db)
) -> DeviceGroupResponse:
    """Get a specific device group."""
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Device group not found")
    
    member_count = db.query(DeviceGroupMember).filter(DeviceGroupMember.group_id == group_id).count()
    resp = DeviceGroupResponse.model_validate(group)
    resp.device_count = member_count
    return resp


@router.put("/device-groups/{group_id}", response_model=DeviceGroupResponse)
def update_device_group(
    group_id: int,
    update: DeviceGroupUpdate,
    db: Session = Depends(get_db)
) -> DeviceGroupResponse:
    """Update a device group."""
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Device group not found")
    
    update_data = update.model_dump(exclude_unset=True)
    if 'is_active' in update_data:
        update_data['is_active'] = 1 if update_data['is_active'] else 0
    
    for key, value in update_data.items():
        setattr(group, key, value)
    
    db.commit()
    db.refresh(group)
    
    member_count = db.query(DeviceGroupMember).filter(DeviceGroupMember.group_id == group_id).count()
    resp = DeviceGroupResponse.model_validate(group)
    resp.device_count = member_count
    return resp


@router.delete("/device-groups/{group_id}")
def delete_device_group(
    group_id: int,
    db: Session = Depends(get_db)
) -> dict:
    """Delete a device group."""
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Device group not found")
    
    db.query(DeviceGroupMember).filter(DeviceGroupMember.group_id == group_id).delete()
    db.delete(group)
    db.commit()
    return {"success": True, "message": "Device group deleted"}


@router.post("/device-groups/{group_id}/members", response_model=DeviceGroupMemberResponse)
def add_device_to_group(
    group_id: int,
    data_source_id: int,
    db: Session = Depends(get_db)
) -> DeviceGroupMemberResponse:
    """Add a device to a group."""
    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Device group not found")
    
    existing = db.query(DeviceGroupMember).filter(
        DeviceGroupMember.group_id == group_id,
        DeviceGroupMember.data_source_id == data_source_id
    ).first()
    if existing:
        return DeviceGroupMemberResponse.model_validate(existing)
    
    member = DeviceGroupMember(group_id=group_id, data_source_id=data_source_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return DeviceGroupMemberResponse.model_validate(member)


@router.get("/device-groups/{group_id}/members", response_model=List[DeviceGroupMemberResponse])
def list_group_members(
    group_id: int,
    db: Session = Depends(get_db)
) -> List[DeviceGroupMemberResponse]:
    """List all devices in a group."""
    members = db.query(DeviceGroupMember).filter(DeviceGroupMember.group_id == group_id).all()
    return [DeviceGroupMemberResponse.model_validate(m) for m in members]


@router.delete("/device-groups/{group_id}/members/{data_source_id}")
def remove_device_from_group(
    group_id: int,
    data_source_id: int,
    db: Session = Depends(get_db)
) -> dict:
    """Remove a device from a group."""
    member = db.query(DeviceGroupMember).filter(
        DeviceGroupMember.group_id == group_id,
        DeviceGroupMember.data_source_id == data_source_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Device not found in group")
    
    db.delete(member)
    db.commit()
    return {"success": True, "message": "Device removed from group"}


# ============ RETRY LOGIC ENDPOINTS ============

from backend.app.schemas.integrations import (
    RetryConfigUpdate, RetryStatusResponse, ConnectionAttemptResult, RetryQueueItem
)


@router.get("/retry-queue", response_model=List[RetryQueueItem])
def get_retry_queue(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all data sources that are pending retry."""
    query = db.query(DataSource).filter(
        DataSource.connection_status.in_(["retrying", "error", "offline"])
    )
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    
    sources = query.order_by(DataSource.next_retry_at.asc().nullsfirst()).all()
    
    return [
        RetryQueueItem(
            data_source_id=s.id,
            name=s.name,
            connection_status=s.connection_status or "unknown",
            next_retry_at=s.next_retry_at,
            current_retry_count=s.current_retry_count or 0,
            max_retries=s.max_retries or 5,
            last_error=s.last_error
        )
        for s in sources
    ]


@router.get("/{source_id}/retry-status", response_model=RetryStatusResponse)
def get_retry_status(source_id: int, db: Session = Depends(get_db)):
    """Get retry status for a specific data source."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    return RetryStatusResponse(
        data_source_id=source.id,
        name=source.name,
        connection_status=source.connection_status or "unknown",
        current_retry_count=source.current_retry_count or 0,
        max_retries=source.max_retries or 5,
        retry_delay_seconds=source.retry_delay_seconds or 30,
        backoff_multiplier=source.backoff_multiplier or 2.0,
        next_retry_at=source.next_retry_at,
        last_error=source.last_error,
        last_poll_at=source.last_poll_at,
        last_successful_poll_at=source.last_successful_poll_at
    )


@router.put("/{source_id}/retry-config")
def update_retry_config(
    source_id: int,
    config: RetryConfigUpdate,
    db: Session = Depends(get_db)
):
    """Update retry configuration for a data source."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    if config.max_retries is not None:
        source.max_retries = config.max_retries
    if config.retry_delay_seconds is not None:
        source.retry_delay_seconds = config.retry_delay_seconds
    if config.backoff_multiplier is not None:
        source.backoff_multiplier = config.backoff_multiplier
    
    db.commit()
    db.refresh(source)
    
    return {"success": True, "message": "Retry configuration updated"}


@router.post("/{source_id}/simulate-failure", response_model=ConnectionAttemptResult)
def simulate_connection_failure(
    source_id: int,
    error_message: str = "Simulated connection failure",
    db: Session = Depends(get_db)
):
    """Simulate a connection failure to trigger retry logic (for testing)."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    current_retry = (source.current_retry_count or 0) + 1
    max_retries = source.max_retries or 5
    delay = source.retry_delay_seconds or 30
    multiplier = source.backoff_multiplier or 2.0
    
    backoff_delay = delay * (multiplier ** (current_retry - 1))
    next_retry = datetime.utcnow() + timedelta(seconds=backoff_delay)
    
    if current_retry > max_retries:
        source.connection_status = "error"
        source.next_retry_at = None
    else:
        source.connection_status = "retrying"
        source.next_retry_at = next_retry
    
    source.current_retry_count = current_retry
    source.last_error = error_message
    source.last_poll_at = datetime.utcnow()
    
    db.commit()
    db.refresh(source)
    
    return ConnectionAttemptResult(
        success=False,
        error_message=error_message,
        next_retry_at=source.next_retry_at,
        current_retry_count=source.current_retry_count
    )


@router.post("/{source_id}/simulate-success", response_model=ConnectionAttemptResult)
def simulate_connection_success(
    source_id: int,
    db: Session = Depends(get_db)
):
    """Simulate a successful connection to reset retry state."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    now = datetime.utcnow()
    source.connection_status = "online"
    source.current_retry_count = 0
    source.next_retry_at = None
    source.last_error = None
    source.last_poll_at = now
    source.last_successful_poll_at = now
    
    db.commit()
    db.refresh(source)
    
    return ConnectionAttemptResult(
        success=True,
        error_message=None,
        next_retry_at=None,
        current_retry_count=0
    )


@router.post("/{source_id}/reset-retry")
def reset_retry_state(
    source_id: int,
    db: Session = Depends(get_db)
):
    """Reset retry state for a data source."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    source.connection_status = "unknown"
    source.current_retry_count = 0
    source.next_retry_at = None
    source.last_error = None
    
    db.commit()
    
    return {"success": True, "message": "Retry state reset"}


@router.post("/{source_id}/force-retry", response_model=ConnectionAttemptResult)
def force_retry_now(
    source_id: int,
    db: Session = Depends(get_db)
):
    """Force an immediate retry attempt for a data source."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    from pymodbus.client import ModbusTcpClient
    
    success = False
    error_message = None
    
    if source.source_type.value in ["modbus_tcp", "MODBUS_TCP"]:
        if source.host and source.port:
            try:
                client = ModbusTcpClient(host=source.host, port=source.port, timeout=5)
                if client.connect():
                    success = True
                    client.close()
                else:
                    error_message = "Failed to establish Modbus TCP connection"
            except Exception as e:
                error_message = str(e)
        else:
            error_message = "Missing host or port configuration"
    else:
        success = True
    
    now = datetime.utcnow()
    
    if success:
        source.connection_status = "online"
        source.current_retry_count = 0
        source.next_retry_at = None
        source.last_error = None
        source.last_poll_at = now
        source.last_successful_poll_at = now
    else:
        current_retry = (source.current_retry_count or 0) + 1
        max_retries = source.max_retries or 5
        delay = source.retry_delay_seconds or 30
        multiplier = source.backoff_multiplier or 2.0
        
        backoff_delay = delay * (multiplier ** (current_retry - 1))
        next_retry = now + timedelta(seconds=backoff_delay)
        
        if current_retry > max_retries:
            source.connection_status = "error"
            source.next_retry_at = None
        else:
            source.connection_status = "retrying"
            source.next_retry_at = next_retry
        
        source.current_retry_count = current_retry
        source.last_error = error_message
        source.last_poll_at = now
    
    db.commit()
    db.refresh(source)
    
    return ConnectionAttemptResult(
        success=success,
        error_message=error_message,
        next_retry_at=source.next_retry_at,
        current_retry_count=source.current_retry_count or 0
    )


# ============ FIRMWARE TRACKING ENDPOINTS ============

from backend.app.schemas.integrations import FirmwareUpdate, FirmwareInfo, FirmwareSummary


@router.get("/firmware", response_model=List[FirmwareInfo])
def list_firmware_info(
    site_id: Optional[int] = None,
    has_firmware: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """List firmware information for all data sources."""
    query = db.query(DataSource)
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    if has_firmware is True:
        query = query.filter(DataSource.firmware_version.isnot(None))
    elif has_firmware is False:
        query = query.filter(DataSource.firmware_version.is_(None))
    
    sources = query.order_by(DataSource.name).all()
    
    return [
        FirmwareInfo(
            data_source_id=s.id,
            name=s.name,
            firmware_version=s.firmware_version,
            firmware_updated_at=s.firmware_updated_at,
            hardware_version=s.hardware_version,
            serial_number=s.serial_number,
            manufacturer=s.manufacturer,
            model=s.model,
            source_type=s.source_type.value if s.source_type else "unknown"
        )
        for s in sources
    ]


@router.get("/firmware/summary", response_model=FirmwareSummary)
def get_firmware_summary(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get firmware version summary across all devices."""
    query = db.query(DataSource)
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    
    sources = query.all()
    total_devices = len(sources)
    devices_with_firmware = sum(1 for s in sources if s.firmware_version)
    
    firmware_counts = {}
    for s in sources:
        version = s.firmware_version or "Unknown"
        if version not in firmware_counts:
            firmware_counts[version] = {"version": version, "count": 0, "devices": []}
        firmware_counts[version]["count"] += 1
        firmware_counts[version]["devices"].append(s.name)
    
    firmware_breakdown = sorted(firmware_counts.values(), key=lambda x: x["count"], reverse=True)
    
    return FirmwareSummary(
        total_devices=total_devices,
        devices_with_firmware=devices_with_firmware,
        unique_firmware_versions=len([v for v in firmware_counts if v != "Unknown"]),
        firmware_breakdown=firmware_breakdown
    )


@router.get("/{source_id}/firmware", response_model=FirmwareInfo)
def get_source_firmware(source_id: int, db: Session = Depends(get_db)):
    """Get firmware information for a specific data source."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    return FirmwareInfo(
        data_source_id=source.id,
        name=source.name,
        firmware_version=source.firmware_version,
        firmware_updated_at=source.firmware_updated_at,
        hardware_version=source.hardware_version,
        serial_number=source.serial_number,
        manufacturer=source.manufacturer,
        model=source.model,
        source_type=source.source_type.value if source.source_type else "unknown"
    )


@router.put("/{source_id}/firmware")
def update_source_firmware(
    source_id: int,
    firmware: FirmwareUpdate,
    db: Session = Depends(get_db)
):
    """Update firmware information for a data source."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    if firmware.firmware_version is not None:
        if firmware.firmware_version != source.firmware_version:
            source.firmware_updated_at = datetime.utcnow()
        source.firmware_version = firmware.firmware_version
    if firmware.hardware_version is not None:
        source.hardware_version = firmware.hardware_version
    if firmware.serial_number is not None:
        source.serial_number = firmware.serial_number
    if firmware.manufacturer is not None:
        source.manufacturer = firmware.manufacturer
    if firmware.model is not None:
        source.model = firmware.model
    
    db.commit()
    db.refresh(source)
    
    return {"success": True, "message": "Firmware information updated"}


# ============ QR CODE ENDPOINTS ============

import json
import base64


@router.get("/{source_id}/qr-data")
def get_qr_code_data(source_id: int, db: Session = Depends(get_db)):
    """Get QR code data for a data source (for device identification)."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    qr_data = {
        "type": "saveit_device",
        "id": source.id,
        "name": source.name,
        "site_id": source.site_id,
        "source_type": source.source_type.value if source.source_type else None,
        "serial_number": source.serial_number,
        "firmware_version": source.firmware_version
    }
    
    qr_string = json.dumps(qr_data, separators=(',', ':'))
    qr_base64 = base64.b64encode(qr_string.encode()).decode()
    
    return {
        "data_source_id": source.id,
        "qr_string": qr_string,
        "qr_base64": qr_base64,
        "device_info": qr_data
    }


@router.get("/qr-batch")
def get_batch_qr_codes(
    site_id: Optional[int] = None,
    source_ids: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get QR code data for multiple data sources."""
    query = db.query(DataSource)
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    if source_ids:
        ids = [int(id.strip()) for id in source_ids.split(',') if id.strip().isdigit()]
        if ids:
            query = query.filter(DataSource.id.in_(ids))
    
    sources = query.order_by(DataSource.name).all()
    
    results = []
    for source in sources:
        qr_data = {
            "type": "saveit_device",
            "id": source.id,
            "name": source.name,
            "site_id": source.site_id,
            "source_type": source.source_type.value if source.source_type else None,
            "serial_number": source.serial_number,
            "firmware_version": source.firmware_version
        }
        qr_string = json.dumps(qr_data, separators=(',', ':'))
        results.append({
            "data_source_id": source.id,
            "name": source.name,
            "qr_string": qr_string,
            "qr_base64": base64.b64encode(qr_string.encode()).decode()
        })
    
    return results


# ============ DEVICE CLONING ENDPOINTS ============


@router.post("/{source_id}/clone")
def clone_data_source(
    source_id: int,
    new_name: str,
    new_host: Optional[str] = None,
    new_slave_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Clone a data source configuration to create a new device."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    new_source = DataSource(
        site_id=source.site_id,
        gateway_id=source.gateway_id,
        name=new_name,
        source_type=source.source_type,
        connection_string=source.connection_string,
        host=new_host if new_host else source.host,
        port=source.port,
        slave_id=new_slave_id if new_slave_id else (source.slave_id + 1 if source.slave_id else None),
        polling_interval_seconds=source.polling_interval_seconds,
        is_active=source.is_active,
        config_json=source.config_json,
        mqtt_broker_url=source.mqtt_broker_url,
        mqtt_topic=source.mqtt_topic,
        mqtt_username=source.mqtt_username,
        mqtt_password=source.mqtt_password,
        mqtt_port=source.mqtt_port,
        mqtt_use_tls=source.mqtt_use_tls,
        webhook_url=source.webhook_url,
        webhook_api_key=source.webhook_api_key,
        webhook_auth_type=source.webhook_auth_type,
        max_retries=source.max_retries,
        retry_delay_seconds=source.retry_delay_seconds,
        backoff_multiplier=source.backoff_multiplier,
        manufacturer=source.manufacturer,
        model=source.model
    )
    
    db.add(new_source)
    db.commit()
    db.refresh(new_source)
    
    from backend.app.models.integrations import ModbusRegister
    
    original_registers = db.query(ModbusRegister).filter(
        ModbusRegister.data_source_id == source_id
    ).all()
    
    for reg in original_registers:
        new_reg = ModbusRegister(
            data_source_id=new_source.id,
            name=reg.name,
            register_address=reg.register_address,
            register_type=reg.register_type,
            data_type=reg.data_type,
            byte_order=reg.byte_order,
            scale_factor=reg.scale_factor,
            offset=reg.offset,
            unit=reg.unit,
            description=reg.description,
            is_writable=reg.is_writable,
            min_value=reg.min_value,
            max_value=reg.max_value
        )
        db.add(new_reg)
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Data source cloned successfully",
        "new_source_id": new_source.id,
        "registers_cloned": len(original_registers)
    }


@router.post("/discover")
def discover_devices(
    start_ip: str,
    end_ip: str,
    port: int = 502,
    timeout: float = 0.5,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Scan IP range for Modbus TCP devices.
    
    This performs a simple port scan to find devices listening on the specified port.
    For production, implement proper Modbus device identification.
    """
    discovered = []
    scanned = 0
    
    try:
        start_parts = [int(x) for x in start_ip.split('.')]
        end_parts = [int(x) for x in end_ip.split('.')]
        
        if len(start_parts) != 4 or len(end_parts) != 4:
            raise ValueError("Invalid IP format")
        
        start_num = (start_parts[0] << 24) + (start_parts[1] << 16) + (start_parts[2] << 8) + start_parts[3]
        end_num = (end_parts[0] << 24) + (end_parts[1] << 16) + (end_parts[2] << 8) + end_parts[3]
        
        if end_num - start_num > 255:
            raise HTTPException(status_code=400, detail="IP range too large (max 256 addresses)")
        
        for ip_num in range(start_num, end_num + 1):
            ip = f"{(ip_num >> 24) & 0xFF}.{(ip_num >> 16) & 0xFF}.{(ip_num >> 8) & 0xFF}.{ip_num & 0xFF}"
            scanned += 1
            
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                result = sock.connect_ex((ip, port))
                sock.close()
                
                if result == 0:
                    discovered.append({
                        "ip": ip,
                        "port": port,
                        "protocol": "modbus_tcp",
                        "status": "reachable"
                    })
            except Exception:
                pass
        
        return {
            "success": True,
            "scanned": scanned,
            "discovered": discovered,
            "message": f"Found {len(discovered)} device(s) out of {scanned} scanned"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{source_id}/commissioning")
def get_commissioning_status(source_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get device commissioning checklist status."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    registers = db.query(ModbusRegister).filter(ModbusRegister.data_source_id == source_id).all()
    
    recent_log = db.query(CommunicationLog).filter(
        CommunicationLog.data_source_id == source_id,
        CommunicationLog.success == True
    ).order_by(CommunicationLog.timestamp.desc()).first()
    
    checklist = [
        {
            "step": "basic_info",
            "name": "Basic Information",
            "description": "Device name and location configured",
            "completed": bool(source.name and len(source.name) > 2),
            "required": True
        },
        {
            "step": "connection",
            "name": "Connection Details",
            "description": "Host/IP and protocol configured",
            "completed": bool(source.host and source.protocol),
            "required": True
        },
        {
            "step": "registers",
            "name": "Register Configuration",
            "description": "At least one register configured",
            "completed": len(registers) > 0,
            "required": True
        },
        {
            "step": "communication_test",
            "name": "Communication Test",
            "description": "Successful data read from device",
            "completed": recent_log is not None,
            "required": True
        },
        {
            "step": "firmware_info",
            "name": "Firmware Information",
            "description": "Firmware version and serial number recorded",
            "completed": bool(source.firmware_version or source.serial_number),
            "required": False
        },
        {
            "step": "validation_rules",
            "name": "Validation Rules",
            "description": "Data validation rules configured",
            "completed": False,
            "required": False
        }
    ]
    
    required_complete = sum(1 for c in checklist if c["required"] and c["completed"])
    required_total = sum(1 for c in checklist if c["required"])
    optional_complete = sum(1 for c in checklist if not c["required"] and c["completed"])
    
    return {
        "device_id": source_id,
        "device_name": source.name,
        "checklist": checklist,
        "required_complete": required_complete,
        "required_total": required_total,
        "optional_complete": optional_complete,
        "is_commissioned": required_complete == required_total,
        "progress_percent": round((required_complete / required_total) * 100) if required_total > 0 else 0
    }


@router.post("/{source_id}/commission")
def mark_commissioned(source_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Mark device as commissioned if all required steps are complete."""
    status = get_commissioning_status(source_id, db)
    
    if not status["is_commissioned"]:
        incomplete = [c["name"] for c in status["checklist"] if c["required"] and not c["completed"]]
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot commission device. Incomplete steps: {', '.join(incomplete)}"
        )
    
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    source.is_active = True
    db.commit()
    
    return {
        "success": True,
        "message": "Device commissioned successfully",
        "device_id": source_id
    }


@router.get("/maintenance")
def list_maintenance_schedules(
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """List maintenance schedules with optional filters."""
    query = db.query(MaintenanceSchedule, DataSource.name.label("device_name")).join(
        DataSource, MaintenanceSchedule.data_source_id == DataSource.id
    )
    
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    if status:
        query = query.filter(MaintenanceSchedule.status == status)
    
    results = query.order_by(MaintenanceSchedule.scheduled_date).all()
    
    return [{
        "id": m.id,
        "data_source_id": m.data_source_id,
        "device_name": device_name,
        "title": m.title,
        "description": m.description,
        "maintenance_type": m.maintenance_type,
        "priority": m.priority,
        "scheduled_date": m.scheduled_date.isoformat() if m.scheduled_date else None,
        "completed_date": m.completed_date.isoformat() if m.completed_date else None,
        "status": m.status,
        "assigned_to": m.assigned_to,
        "notes": m.notes
    } for m, device_name in results]


@router.post("/maintenance")
def create_maintenance_schedule(
    data_source_id: int,
    title: str,
    scheduled_date: str,
    description: Optional[str] = None,
    maintenance_type: str = "routine",
    priority: str = "medium",
    assigned_to: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new maintenance schedule."""
    source = db.query(DataSource).filter(DataSource.id == data_source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    schedule = MaintenanceSchedule(
        data_source_id=data_source_id,
        title=title,
        description=description,
        maintenance_type=maintenance_type,
        priority=priority,
        scheduled_date=datetime.fromisoformat(scheduled_date.replace('Z', '+00:00')),
        assigned_to=assigned_to,
        status="scheduled"
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    
    return {
        "success": True,
        "id": schedule.id,
        "message": "Maintenance schedule created"
    }


@router.put("/maintenance/{schedule_id}")
def update_maintenance_schedule(
    schedule_id: int,
    status: Optional[str] = None,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update a maintenance schedule."""
    schedule = db.query(MaintenanceSchedule).filter(MaintenanceSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")
    
    if status:
        schedule.status = status
        if status == "completed":
            schedule.completed_date = datetime.utcnow()
    if notes:
        schedule.notes = notes
    
    db.commit()
    
    return {"success": True, "message": "Maintenance schedule updated"}


@router.delete("/maintenance/{schedule_id}")
def delete_maintenance_schedule(schedule_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Delete a maintenance schedule."""
    schedule = db.query(MaintenanceSchedule).filter(MaintenanceSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Maintenance schedule not found")
    
    db.delete(schedule)
    db.commit()
    
    return {"success": True, "message": "Maintenance schedule deleted"}


@router.get("/alerts")
def list_device_alerts(
    site_id: Optional[int] = None,
    data_source_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """List device alerts with optional filters."""
    query = db.query(DeviceAlert, DataSource.name.label("device_name")).join(
        DataSource, DeviceAlert.data_source_id == DataSource.id
    )
    
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    if data_source_id:
        query = query.filter(DeviceAlert.data_source_id == data_source_id)
    
    results = query.all()
    
    return [{
        "id": a.id,
        "data_source_id": a.data_source_id,
        "device_name": device_name,
        "name": a.name,
        "alert_type": a.alert_type,
        "condition": a.condition,
        "threshold_value": a.threshold_value,
        "threshold_duration_seconds": a.threshold_duration_seconds,
        "severity": a.severity,
        "is_active": a.is_active,
        "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
        "trigger_count": a.trigger_count,
        "notification_channels": a.notification_channels
    } for a, device_name in results]


@router.post("/alerts")
def create_device_alert(
    data_source_id: int,
    name: str,
    alert_type: str,
    condition: str,
    threshold_value: Optional[float] = None,
    threshold_duration_seconds: int = 0,
    severity: str = "warning",
    notification_channels: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new device alert."""
    source = db.query(DataSource).filter(DataSource.id == data_source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    alert = DeviceAlert(
        data_source_id=data_source_id,
        name=name,
        alert_type=alert_type,
        condition=condition,
        threshold_value=threshold_value,
        threshold_duration_seconds=threshold_duration_seconds,
        severity=severity,
        notification_channels=notification_channels
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    
    return {
        "success": True,
        "id": alert.id,
        "message": "Device alert created"
    }


@router.put("/alerts/{alert_id}")
def update_device_alert(
    alert_id: int,
    is_active: Optional[int] = None,
    threshold_value: Optional[float] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Update a device alert."""
    alert = db.query(DeviceAlert).filter(DeviceAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Device alert not found")
    
    if is_active is not None:
        alert.is_active = is_active
    if threshold_value is not None:
        alert.threshold_value = threshold_value
    if severity:
        alert.severity = severity
    
    db.commit()
    
    return {"success": True, "message": "Device alert updated"}


@router.delete("/alerts/{alert_id}")
def delete_device_alert(alert_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Delete a device alert."""
    alert = db.query(DeviceAlert).filter(DeviceAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Device alert not found")
    
    db.delete(alert)
    db.commit()
    
    return {"success": True, "message": "Device alert deleted"}


@router.get("/{source_id}", response_model=DataSourceResponse)
def get_data_source(source_id: int, db: Session = Depends(get_db)):
    """Get data source by ID. NOTE: This route must be last to avoid matching paths like /validation-rules."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    return source
