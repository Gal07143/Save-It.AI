"""Control Rules and Commands API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ControlRule, ControlCommand
from app.models.devices import Command, AlarmRule, RemoteModbusConfig, DeviceModel
from app.schemas import ControlRuleCreate, ControlRuleResponse, ControlCommandResponse
from app.schemas.devices import (
    CommandCreate, CommandUpdate, CommandResponse,
    AlarmRuleCreate, AlarmRuleUpdate, AlarmRuleResponse,
    RemoteModbusConfigCreate, RemoteModbusConfigUpdate, RemoteModbusConfigResponse,
)

router = APIRouter(prefix="/api/v1", tags=["control"])


# ============ CONTROL RULES (automation) ============

@router.get("/control-rules", response_model=List[ControlRuleResponse])
def list_control_rules(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List automation control rules."""
    query = db.query(ControlRule)
    if site_id:
        query = query.filter(ControlRule.site_id == site_id)
    return query.all()


@router.post("/control-rules", response_model=ControlRuleResponse)
def create_control_rule(rule: ControlRuleCreate, db: Session = Depends(get_db)):
    """Create a new control rule."""
    db_rule = ControlRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/control-commands", response_model=List[ControlCommandResponse])
def list_control_commands(
    asset_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List control commands."""
    query = db.query(ControlCommand)
    if asset_id:
        query = query.filter(ControlCommand.asset_id == asset_id)
    if status:
        query = query.filter(ControlCommand.status == status)
    return query.order_by(ControlCommand.created_at.desc()).all()


# ============ DEVICE MODEL COMMANDS ============

@router.get("/device-models/{model_id}/commands", response_model=List[CommandResponse])
def list_model_commands(model_id: int, db: Session = Depends(get_db)):
    """List all commands for a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    return db.query(Command).filter(Command.model_id == model_id).order_by(Command.display_order).all()


@router.post("/device-models/{model_id}/commands", response_model=CommandResponse)
def create_model_command(model_id: int, command: CommandCreate, db: Session = Depends(get_db)):
    """Create a command for a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")

    if command.model_id != model_id:
        raise HTTPException(status_code=400, detail="model_id in body must match path parameter")

    db_command = Command(
        model_id=model_id,
        name=command.name,
        display_name=command.display_name,
        description=command.description,
        input_type=command.input_type.value,
        parameters_schema=command.parameters_schema,
        min_value=command.min_value,
        max_value=command.max_value,
        step=command.step,
        enum_options=command.enum_options,
        timeout_seconds=command.timeout_seconds,
        requires_confirmation=1 if command.requires_confirmation else 0,
        is_dangerous=1 if command.is_dangerous else 0,
        category=command.category,
        display_order=command.display_order,
        icon=command.icon,
    )
    db.add(db_command)
    db.commit()
    db.refresh(db_command)
    return db_command


@router.patch("/commands/{command_id}", response_model=CommandResponse)
def update_command(command_id: int, updates: CommandUpdate, db: Session = Depends(get_db)):
    """Update a command."""
    command = db.query(Command).filter(Command.id == command_id).first()
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "input_type" in update_data and update_data["input_type"]:
        update_data["input_type"] = update_data["input_type"].value
    if "requires_confirmation" in update_data:
        update_data["requires_confirmation"] = 1 if update_data["requires_confirmation"] else 0
    if "is_dangerous" in update_data:
        update_data["is_dangerous"] = 1 if update_data["is_dangerous"] else 0

    for key, value in update_data.items():
        setattr(command, key, value)

    db.commit()
    db.refresh(command)
    return command


@router.delete("/commands/{command_id}")
def delete_command(command_id: int, db: Session = Depends(get_db)):
    """Delete a command."""
    command = db.query(Command).filter(Command.id == command_id).first()
    if not command:
        raise HTTPException(status_code=404, detail="Command not found")

    db.delete(command)
    db.commit()
    return {"success": True, "message": "Command deleted"}


# ============ DEVICE MODEL ALARM RULES ============

@router.get("/device-models/{model_id}/alarm-rules", response_model=List[AlarmRuleResponse])
def list_model_alarm_rules(model_id: int, db: Session = Depends(get_db)):
    """List all alarm rules for a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")
    return db.query(AlarmRule).filter(AlarmRule.model_id == model_id).all()


@router.post("/device-models/{model_id}/alarm-rules", response_model=AlarmRuleResponse)
def create_model_alarm_rule(model_id: int, rule: AlarmRuleCreate, db: Session = Depends(get_db)):
    """Create an alarm rule for a device model."""
    model = db.query(DeviceModel).filter(DeviceModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Device model not found")

    if rule.model_id != model_id:
        raise HTTPException(status_code=400, detail="model_id in body must match path parameter")

    db_rule = AlarmRule(
        model_id=model_id,
        datapoint_id=rule.datapoint_id,
        name=rule.name,
        description=rule.description,
        condition=rule.condition.value,
        threshold_value=rule.threshold_value,
        threshold_value_2=rule.threshold_value_2,
        duration_seconds=rule.duration_seconds,
        severity=rule.severity.value,
        is_active=1 if rule.is_active else 0,
        auto_clear=1 if rule.auto_clear else 0,
        notification_channels=rule.notification_channels,
        action_on_trigger=rule.action_on_trigger,
        action_on_clear=rule.action_on_clear,
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.patch("/alarm-rules/{rule_id}", response_model=AlarmRuleResponse)
def update_alarm_rule(rule_id: int, updates: AlarmRuleUpdate, db: Session = Depends(get_db)):
    """Update an alarm rule."""
    rule = db.query(AlarmRule).filter(AlarmRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alarm rule not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "condition" in update_data and update_data["condition"]:
        update_data["condition"] = update_data["condition"].value
    if "severity" in update_data and update_data["severity"]:
        update_data["severity"] = update_data["severity"].value
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0
    if "auto_clear" in update_data:
        update_data["auto_clear"] = 1 if update_data["auto_clear"] else 0

    for key, value in update_data.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/alarm-rules/{rule_id}")
def delete_alarm_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete an alarm rule."""
    rule = db.query(AlarmRule).filter(AlarmRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alarm rule not found")

    db.delete(rule)
    db.commit()
    return {"success": True, "message": "Alarm rule deleted"}


# ============ REMOTE MODBUS CONFIG ============

@router.get("/remote-modbus-configs", response_model=List[RemoteModbusConfigResponse])
def list_remote_modbus_configs(
    gateway_id: Optional[int] = None,
    device_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """List remote Modbus configurations."""
    query = db.query(RemoteModbusConfig)
    if gateway_id:
        query = query.filter(RemoteModbusConfig.gateway_id == gateway_id)
    if device_id:
        query = query.filter(RemoteModbusConfig.device_id == device_id)
    return query.all()


@router.post("/remote-modbus-configs", response_model=RemoteModbusConfigResponse)
def create_remote_modbus_config(config: RemoteModbusConfigCreate, db: Session = Depends(get_db)):
    """Create a remote Modbus configuration for a device."""
    db_config = RemoteModbusConfig(
        device_id=config.device_id,
        gateway_id=config.gateway_id,
        slave_id=config.slave_id,
        protocol=config.protocol,
        host=config.host,
        port=config.port,
        serial_port=config.serial_port,
        baudrate=config.baudrate,
        parity=config.parity,
        stopbits=config.stopbits,
        polling_interval_ms=config.polling_interval_ms,
        timeout_ms=config.timeout_ms,
        retries=config.retries,
        register_config=config.register_config,
        is_active=1,
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


@router.get("/remote-modbus-configs/{config_id}", response_model=RemoteModbusConfigResponse)
def get_remote_modbus_config(config_id: int, db: Session = Depends(get_db)):
    """Get a remote Modbus configuration by ID."""
    config = db.query(RemoteModbusConfig).filter(RemoteModbusConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Remote Modbus config not found")
    return config


@router.put("/remote-modbus-configs/{config_id}", response_model=RemoteModbusConfigResponse)
def update_remote_modbus_config(config_id: int, updates: RemoteModbusConfigUpdate, db: Session = Depends(get_db)):
    """Update a remote Modbus configuration."""
    config = db.query(RemoteModbusConfig).filter(RemoteModbusConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Remote Modbus config not found")

    update_data = updates.model_dump(exclude_unset=True)
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0

    for key, value in update_data.items():
        setattr(config, key, value)

    # Mark as pending sync when config changes
    from app.models.devices import ConfigSyncStatus
    config.sync_status = ConfigSyncStatus.PENDING

    db.commit()
    db.refresh(config)
    return config


@router.delete("/remote-modbus-configs/{config_id}")
def delete_remote_modbus_config(config_id: int, db: Session = Depends(get_db)):
    """Delete a remote Modbus configuration."""
    config = db.query(RemoteModbusConfig).filter(RemoteModbusConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Remote Modbus config not found")

    db.delete(config)
    db.commit()
    return {"success": True, "message": "Remote Modbus config deleted"}
