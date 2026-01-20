"""
Device Models Router for SAVE-IT.AI
CRUD operations for device models (blueprints) with model-instance propagation.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.devices import DeviceModel, Datapoint, Command, AlarmRule, Device
from backend.app.schemas.devices import (
    DeviceModelCreate, DeviceModelUpdate, DeviceModelResponse,
    DatapointCreate, DatapointUpdate, DatapointResponse,
    CommandCreate, CommandUpdate, CommandResponse,
    AlarmRuleCreate, AlarmRuleUpdate, AlarmRuleResponse,
)
from backend.app.services.model_propagation import get_propagation_service

router = APIRouter(prefix="/api/v1/device-models", tags=["Device Models"])


@router.get("", response_model=List[DeviceModelResponse])
def list_device_models(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """List all device models."""
    query = db.query(DeviceModel)
    if is_active is not None:
        query = query.filter(DeviceModel.is_active == (1 if is_active else 0))
    
    models = query.offset(skip).limit(limit).all()
    
    result = []
    for model in models:
        model_dict = DeviceModelResponse.model_validate(model)
        model_dict.datapoint_count = len(model.datapoints)
        model_dict.command_count = len(model.commands)
        model_dict.device_count = db.query(Device).filter(Device.model_id == model.id, Device.is_active == 1).count()
        result.append(model_dict)
    
    return result


@router.post("", response_model=DeviceModelResponse, status_code=201)
def create_device_model(
    model_data: DeviceModelCreate,
    db: Session = Depends(get_db),
):
    """Create a new device model."""
    model = DeviceModel(
        name=model_data.name,
        description=model_data.description,
        version=model_data.version,
        is_system_model=1 if model_data.is_system_model else 0,
        auto_propagate=1 if model_data.auto_propagate else 0,
        icon=model_data.icon,
        color=model_data.color,
        is_active=1,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


@router.get("/{model_id}", response_model=DeviceModelResponse)
def get_device_model(
    model_id: int,
    db: Session = Depends(get_db),
):
    """Get a device model by ID."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    
    response = DeviceModelResponse.model_validate(model)
    response.datapoint_count = len(model.datapoints)
    response.command_count = len(model.commands)
    response.device_count = db.query(Device).filter(Device.model_id == model.id, Device.is_active == 1).count()
    return response


@router.patch("/{model_id}", response_model=DeviceModelResponse)
def update_device_model(
    model_id: int,
    model_data: DeviceModelUpdate,
    db: Session = Depends(get_db),
):
    """Update a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    
    update_data = model_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["is_active", "auto_propagate"]:
            value = 1 if value else 0
        setattr(model, field, value)
    
    db.commit()
    db.refresh(model)
    return model


@router.delete("/{model_id}", status_code=204)
def delete_device_model(
    model_id: int,
    db: Session = Depends(get_db),
):
    """Delete a device model (soft delete by deactivating)."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    
    device_count = db.query(Device).filter(Device.model_id == model_id, Device.is_active == 1).count()
    if device_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete model with {device_count} active devices")
    
    model.is_active = 0
    db.commit()
    return None


@router.post("/{model_id}/clone", response_model=DeviceModelResponse)
def clone_device_model(
    model_id: int,
    new_name: str = Query(..., min_length=1),
    new_version: str = Query("1.0.0"),
    db: Session = Depends(get_db),
):
    """Clone a device model with all its datapoints, commands, and alarm rules."""
    propagation_service = get_propagation_service(db)
    try:
        new_model = propagation_service.clone_model(model_id, new_name, new_version)
        db.commit()
        return new_model
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{model_id}/sync", response_model=dict)
def sync_model_to_devices(
    model_id: int,
    db: Session = Depends(get_db),
):
    """Sync all datapoints from a model to all its devices."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    
    propagation_service = get_propagation_service(db)
    count = propagation_service.sync_all_devices_for_model(model_id)
    db.commit()
    
    return {"message": f"Synced model to devices", "datapoints_added": count}


@router.get("/{model_id}/datapoints", response_model=List[DatapointResponse])
def list_model_datapoints(
    model_id: int,
    db: Session = Depends(get_db),
):
    """List all datapoints for a device model."""
    datapoints = db.query(Datapoint).filter(
        Datapoint.model_id == model_id
    ).order_by(Datapoint.display_order).all()
    return datapoints


@router.post("/{model_id}/datapoints", response_model=DatapointResponse, status_code=201)
def create_datapoint(
    model_id: int,
    dp_data: DatapointCreate,
    db: Session = Depends(get_db),
):
    """Create a new datapoint for a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    
    existing = db.query(Datapoint).filter(
        Datapoint.model_id == model_id,
        Datapoint.name == dp_data.name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Datapoint '{dp_data.name}' already exists")
    
    datapoint = Datapoint(
        model_id=model_id,
        **dp_data.model_dump(exclude={"model_id"})
    )
    db.add(datapoint)
    db.flush()
    
    propagation_service = get_propagation_service(db)
    propagation_service.propagate_datapoint_add(datapoint)
    
    db.commit()
    db.refresh(datapoint)
    return datapoint


@router.patch("/datapoints/{datapoint_id}", response_model=DatapointResponse)
def update_datapoint(
    datapoint_id: int,
    dp_data: DatapointUpdate,
    db: Session = Depends(get_db),
):
    """Update a datapoint."""
    datapoint = db.query(Datapoint).filter(Datapoint.id == datapoint_id).first()
    if not datapoint:
        raise HTTPException(status_code=404, detail="Datapoint not found")
    
    update_data = dp_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["is_readable", "is_writable", "is_required"]:
            value = 1 if value else 0
        setattr(datapoint, field, value)
    
    db.commit()
    db.refresh(datapoint)
    return datapoint


@router.delete("/datapoints/{datapoint_id}", status_code=204)
def delete_datapoint(
    datapoint_id: int,
    db: Session = Depends(get_db),
):
    """Delete a datapoint and remove from all device instances."""
    datapoint = db.query(Datapoint).filter(Datapoint.id == datapoint_id).first()
    if not datapoint:
        raise HTTPException(status_code=404, detail="Datapoint not found")
    
    propagation_service = get_propagation_service(db)
    propagation_service.propagate_datapoint_delete(datapoint_id)
    
    db.delete(datapoint)
    db.commit()
    return None


@router.get("/{model_id}/commands", response_model=List[CommandResponse])
def list_model_commands(
    model_id: int,
    db: Session = Depends(get_db),
):
    """List all commands for a device model."""
    commands = db.query(Command).filter(
        Command.model_id == model_id
    ).order_by(Command.display_order).all()
    return commands


@router.post("/{model_id}/commands", response_model=CommandResponse, status_code=201)
def create_command(
    model_id: int,
    cmd_data: CommandCreate,
    db: Session = Depends(get_db),
):
    """Create a new command for a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    
    command = Command(
        model_id=model_id,
        **cmd_data.model_dump(exclude={"model_id"})
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    return command


@router.get("/{model_id}/alarm-rules", response_model=List[AlarmRuleResponse])
def list_model_alarm_rules(
    model_id: int,
    db: Session = Depends(get_db),
):
    """List all alarm rules for a device model."""
    rules = db.query(AlarmRule).filter(
        AlarmRule.model_id == model_id
    ).all()
    return rules


@router.post("/{model_id}/alarm-rules", response_model=AlarmRuleResponse, status_code=201)
def create_alarm_rule(
    model_id: int,
    rule_data: AlarmRuleCreate,
    db: Session = Depends(get_db),
):
    """Create a new alarm rule for a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    
    rule = AlarmRule(
        model_id=model_id,
        **rule_data.model_dump(exclude={"model_id"})
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule
