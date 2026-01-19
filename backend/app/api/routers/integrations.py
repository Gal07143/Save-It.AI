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
