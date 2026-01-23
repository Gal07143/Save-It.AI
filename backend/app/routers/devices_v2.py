"""
Devices Router v2 for SAVE-IT.AI
Full device management with onboarding, credentials, telemetry, and commands.
Implements Zoho IoT-style device operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session, joinedload

from backend.app.core.database import get_db
from backend.app.models.devices import (
    Device, DeviceModel, DeviceProduct, DeviceDatapoint, DeviceTelemetry,
    DeviceEvent, DeviceType, AuthType, ConfigSyncStatus, Datapoint
)
from backend.app.models.integrations import Gateway
from backend.app.schemas.devices import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceCredentials,
    DeviceOnboardingRequest, DeviceOnboardingResponse,
    CommandExecutionRequest, CommandExecutionResponse,
    DeviceTelemetryBatch, DeviceEventData,
)
from backend.app.services.device_onboarding import get_onboarding_service, get_edge_key_resolver
from backend.app.services.command_service import get_command_service
from backend.app.services.data_ingestion import get_ingestion_service

router = APIRouter(prefix="/api/v1/devices-v2", tags=["Devices"])


@router.get("", response_model=List[DeviceResponse])
def list_devices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    site_id: Optional[int] = None,
    gateway_id: Optional[int] = None,
    device_type: Optional[str] = None,
    model_id: Optional[int] = None,
    is_online: Optional[bool] = None,
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db),
):
    """List all devices with optional filtering."""
    # Use eager loading to avoid N+1 queries
    query = db.query(Device).options(
        joinedload(Device.model),
        joinedload(Device.product),
        joinedload(Device.gateway),
    )

    if site_id:
        query = query.filter(Device.site_id == site_id)
    if gateway_id:
        query = query.filter(Device.gateway_id == gateway_id)
    if device_type:
        try:
            dt = DeviceType(device_type)
            query = query.filter(Device.device_type == dt)
        except ValueError:
            pass
    if model_id:
        query = query.filter(Device.model_id == model_id)
    if is_online is not None:
        query = query.filter(Device.is_online == (1 if is_online else 0))
    if is_active is not None:
        query = query.filter(Device.is_active == (1 if is_active else 0))

    devices = query.order_by(Device.name).offset(skip).limit(limit).all()

    result = []
    for device in devices:
        resp = DeviceResponse.model_validate(device)
        # Access eagerly loaded relationships (no additional queries)
        if device.model:
            resp.model_name = device.model.name
        if device.product:
            resp.product_name = f"{device.product.manufacturer} {device.product.name}"
        if device.gateway:
            resp.gateway_name = device.gateway.name
        result.append(resp)

    return result


@router.post("/onboard", response_model=DeviceOnboardingResponse, status_code=201)
def onboard_device(
    request: DeviceOnboardingRequest,
    db: Session = Depends(get_db),
):
    """
    Onboard a new device with automatic credential generation.
    Returns device info and connection credentials.
    """
    onboarding_service = get_onboarding_service(db)
    
    try:
        result = onboarding_service.register_device(
            site_id=request.site_id,
            name=request.name,
            device_type=DeviceType(request.device_type.value),
            model_id=request.model_id,
            product_id=request.product_id,
            gateway_id=request.gateway_id,
            edge_key=request.edge_key,
            asset_id=request.asset_id,
            auth_type=AuthType(request.auth_type.value),
            policy_id=request.policy_id,
            ip_address=request.ip_address,
            port=request.port,
            slave_id=request.slave_id,
            serial_number=request.serial_number,
            description=request.description,
        )
        db.commit()
        
        device = result["device"]
        credentials = result["credentials"]
        
        model_response = None
        if device.model_id:
            model = db.query(DeviceModel).filter(DeviceModel.id == device.model_id).first()
            if model:
                from backend.app.schemas.devices import DeviceModelResponse
                model_response = DeviceModelResponse.model_validate(model)
        
        product_response = None
        if device.product_id:
            product = db.query(DeviceProduct).filter(DeviceProduct.id == device.product_id).first()
            if product:
                from backend.app.schemas.devices import DeviceProductResponse
                product_response = DeviceProductResponse.model_validate(product)
        
        return DeviceOnboardingResponse(
            device=DeviceResponse.model_validate(device),
            credentials=DeviceCredentials(**credentials),
            model=model_response,
            product=product_response,
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
):
    """Get a device by ID."""
    # Use eager loading to avoid N+1 queries
    device = db.query(Device).options(
        joinedload(Device.model),
        joinedload(Device.product),
        joinedload(Device.gateway),
    ).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    resp = DeviceResponse.model_validate(device)
    if device.model:
        resp.model_name = device.model.name
    if device.product:
        resp.product_name = f"{device.product.manufacturer} {device.product.name}"
    if device.gateway:
        resp.gateway_name = device.gateway.name

    return resp


@router.patch("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: int,
    device_data: DeviceUpdate,
    db: Session = Depends(get_db),
):
    """Update a device."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    update_data = device_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "is_active":
            value = 1 if value else 0
        setattr(device, field, value)
    
    db.commit()
    db.refresh(device)
    return device


@router.delete("/{device_id}", status_code=204)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
):
    """Delete a device (soft delete by deactivating)."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device.is_active = 0
    db.commit()
    return None


@router.post("/{device_id}/credentials/regenerate", response_model=DeviceCredentials)
def regenerate_device_credentials(
    device_id: int,
    db: Session = Depends(get_db),
):
    """Regenerate credentials for a device."""
    onboarding_service = get_onboarding_service(db)
    
    try:
        credentials = onboarding_service.regenerate_credentials(device_id)
        db.commit()
        return DeviceCredentials(**credentials)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{device_id}/telemetry")
def receive_device_telemetry(
    device_id: int,
    batch: DeviceTelemetryBatch,
    db: Session = Depends(get_db),
):
    """
    Receive telemetry data from a device.
    Endpoint: device/{device_id}/telemetry
    """
    ingestion_service = get_ingestion_service(db)
    
    datapoints = {dp.datapoint: dp.value for dp in batch.data}
    
    result = ingestion_service.ingest_telemetry(
        device_id=device_id,
        datapoints=datapoints,
        timestamp=batch.timestamp,
        source="api",
    )
    
    db.commit()
    return result


@router.post("/{device_id}/events")
def receive_device_event(
    device_id: int,
    event: DeviceEventData,
    db: Session = Depends(get_db),
):
    """
    Receive an event from a device.
    Endpoint: device/{device_id}/events
    """
    ingestion_service = get_ingestion_service(db)
    
    device_event = ingestion_service.ingest_event(
        device_id=device_id,
        event_type=event.event_type,
        severity=event.severity.value,
        title=event.title,
        message=event.message,
        data=event.data,
    )
    
    db.commit()
    
    return {"status": "received", "event_id": device_event.id}


@router.post("/{device_id}/commands", response_model=CommandExecutionResponse)
def send_device_command(
    device_id: int,
    request: CommandExecutionRequest,
    db: Session = Depends(get_db),
):
    """
    Send a command to a device.
    """
    command_service = get_command_service(db)
    
    try:
        execution = command_service.send_command(
            device_id=device_id,
            command_id=request.command_id,
            parameters=request.parameters,
        )
        db.commit()
        return execution
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{device_id}/commands/ack")
def acknowledge_command(
    device_id: int,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Receive command acknowledgment from a device.
    Endpoint: device/{device_id}/commands/ack
    """
    correlation_id = payload.get("correlation_id")
    if not correlation_id:
        raise HTTPException(status_code=400, detail="Missing correlation_id")
    
    command_service = get_command_service(db)
    
    execution = command_service.acknowledge_command(
        correlation_id=correlation_id,
        status=payload.get("status", "completed"),
        result=payload.get("result"),
        error_message=payload.get("error"),
    )
    
    if not execution:
        raise HTTPException(status_code=404, detail="Command not found")
    
    db.commit()
    return {"status": "acknowledged", "execution_id": execution.id}


@router.get("/{device_id}/commands/history", response_model=List[CommandExecutionResponse])
def get_command_history(
    device_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Get command execution history for a device."""
    command_service = get_command_service(db)
    history = command_service.get_command_history(device_id, limit, offset)
    return history


@router.get("/{device_id}/datapoints")
def get_device_datapoints(
    device_id: int,
    db: Session = Depends(get_db),
):
    """Get current datapoint values for a device."""
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Use eager loading to avoid N+1 queries
    device_dps = db.query(DeviceDatapoint).options(
        joinedload(DeviceDatapoint.datapoint)
    ).filter(
        DeviceDatapoint.device_id == device_id
    ).all()

    result = []
    for ddp in device_dps:
        if ddp.datapoint:
            result.append({
                "name": ddp.datapoint.name,
                "display_name": ddp.datapoint.display_name,
                "unit": ddp.datapoint.unit,
                "current_value": ddp.current_value,
                "previous_value": ddp.previous_value,
                "last_updated_at": ddp.last_updated_at.isoformat() if ddp.last_updated_at else None,
                "quality": ddp.quality,
            })

    return result


@router.get("/{device_id}/telemetry")
def get_device_telemetry_history(
    device_id: int,
    datapoint: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    """Get telemetry history for a device."""
    ingestion_service = get_ingestion_service(db)
    
    telemetry = ingestion_service.get_device_telemetry(
        device_id=device_id,
        datapoint_name=datapoint,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
    )
    
    return [
        {
            "timestamp": t.timestamp.isoformat(),
            "value": t.value,
            "string_value": t.string_value,
            "quality": t.quality,
            "raw_value": t.raw_value,
        }
        for t in telemetry
    ]


@router.get("/{device_id}/events")
def get_device_events(
    device_id: int,
    event_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Get events for a device."""
    ingestion_service = get_ingestion_service(db)
    
    events = ingestion_service.get_device_events(
        device_id=device_id,
        event_type=event_type,
        is_active=is_active,
        limit=limit,
    )
    
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "severity": e.severity.value if e.severity else "info",
            "title": e.title,
            "message": e.message,
            "triggered_at": e.triggered_at.isoformat() if e.triggered_at else None,
            "cleared_at": e.cleared_at.isoformat() if e.cleared_at else None,
            "is_active": bool(e.is_active),
        }
        for e in events
    ]
