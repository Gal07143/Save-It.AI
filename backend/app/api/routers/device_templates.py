"""Device Template management API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.integrations import DeviceTemplate, TemplateRegister, ModbusRegister
from backend.app.models import DataSource
from backend.app.schemas.integrations import (
    DeviceTemplateCreate,
    DeviceTemplateUpdate,
    DeviceTemplateResponse,
    DeviceTemplateListResponse,
    TemplateRegisterCreate,
    TemplateRegisterResponse,
    ApplyTemplateRequest,
)
from backend.app.services.seed_templates import seed_device_templates

router = APIRouter(prefix="/api/v1/device-templates", tags=["device-templates"])


@router.post("", response_model=DeviceTemplateResponse)
def create_device_template(template: DeviceTemplateCreate, db: Session = Depends(get_db)):
    """Create a new device template."""
    db_template = DeviceTemplate(
        name=template.name,
        manufacturer=template.manufacturer,
        model=template.model,
        description=template.description,
        protocol=template.protocol,
        default_port=template.default_port,
        default_slave_id=template.default_slave_id,
        is_system_template=1 if template.is_system_template else 0,
        is_active=1 if template.is_active else 0,
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.get("", response_model=List[DeviceTemplateListResponse])
def list_device_templates(
    manufacturer: Optional[str] = None,
    protocol: Optional[str] = None,
    include_system: bool = True,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all device templates."""
    query = db.query(DeviceTemplate).filter(DeviceTemplate.is_active == 1)
    
    if manufacturer:
        query = query.filter(DeviceTemplate.manufacturer.ilike(f"%{manufacturer}%"))
    if protocol:
        query = query.filter(DeviceTemplate.protocol == protocol)
    if not include_system:
        query = query.filter(DeviceTemplate.is_system_template == 0)
    
    templates = query.order_by(DeviceTemplate.manufacturer, DeviceTemplate.model).offset(skip).limit(limit).all()
    
    result = []
    for t in templates:
        register_count = db.query(TemplateRegister).filter(TemplateRegister.template_id == t.id).count()
        result.append(DeviceTemplateListResponse(
            id=t.id,
            name=t.name,
            manufacturer=t.manufacturer,
            model=t.model,
            description=t.description,
            protocol=t.protocol,
            default_port=t.default_port,
            default_slave_id=t.default_slave_id,
            is_system_template=bool(t.is_system_template),
            is_active=bool(t.is_active),
            created_at=t.created_at,
            register_count=register_count
        ))
    
    return result


@router.get("/{template_id}", response_model=DeviceTemplateResponse)
def get_device_template(template_id: int, db: Session = Depends(get_db)):
    """Get device template by ID with all registers."""
    template = db.query(DeviceTemplate).filter(DeviceTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Device template not found")
    return template


@router.put("/{template_id}", response_model=DeviceTemplateResponse)
def update_device_template(template_id: int, updates: DeviceTemplateUpdate, db: Session = Depends(get_db)):
    """Update device template."""
    template = db.query(DeviceTemplate).filter(DeviceTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Device template not found")
    
    if template.is_system_template:
        raise HTTPException(status_code=403, detail="Cannot modify system templates")
    
    update_data = updates.model_dump(exclude_unset=True)
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0
    
    for key, value in update_data.items():
        setattr(template, key, value)
    
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
def delete_device_template(template_id: int, db: Session = Depends(get_db)):
    """Delete a device template."""
    template = db.query(DeviceTemplate).filter(DeviceTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Device template not found")
    
    if template.is_system_template:
        raise HTTPException(status_code=403, detail="Cannot delete system templates")
    
    db.delete(template)
    db.commit()
    return {"message": "Device template deleted successfully"}


@router.post("/{template_id}/registers", response_model=TemplateRegisterResponse)
def add_template_register(template_id: int, register: TemplateRegisterCreate, db: Session = Depends(get_db)):
    """Add a register to a device template."""
    template = db.query(DeviceTemplate).filter(DeviceTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Device template not found")
    
    db_register = TemplateRegister(
        template_id=template_id,
        name=register.name,
        description=register.description,
        register_address=register.register_address,
        register_type=register.register_type.value,
        data_type=register.data_type.value,
        byte_order=register.byte_order.value,
        register_count=register.register_count,
        scale_factor=register.scale_factor,
        offset=register.offset,
        unit=register.unit,
        is_writable=1 if register.is_writable else 0,
        display_order=register.display_order,
        category=register.category,
    )
    db.add(db_register)
    db.commit()
    db.refresh(db_register)
    return db_register


@router.delete("/{template_id}/registers/{register_id}")
def delete_template_register(template_id: int, register_id: int, db: Session = Depends(get_db)):
    """Delete a register from a device template."""
    register = db.query(TemplateRegister).filter(
        TemplateRegister.id == register_id,
        TemplateRegister.template_id == template_id
    ).first()
    if not register:
        raise HTTPException(status_code=404, detail="Template register not found")
    
    db.delete(register)
    db.commit()
    return {"message": "Register deleted successfully"}


@router.post("/apply", response_model=dict)
def apply_template_to_data_source(request: ApplyTemplateRequest, db: Session = Depends(get_db)):
    """Apply a device template to a data source, creating Modbus registers."""
    template = db.query(DeviceTemplate).filter(DeviceTemplate.id == request.template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Device template not found")
    
    data_source = db.query(DataSource).filter(DataSource.id == request.data_source_id).first()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    template_registers = db.query(TemplateRegister).filter(
        TemplateRegister.template_id == request.template_id
    ).all()
    
    created_count = 0
    for tr in template_registers:
        existing = db.query(ModbusRegister).filter(
            ModbusRegister.data_source_id == request.data_source_id,
            ModbusRegister.register_address == tr.register_address
        ).first()
        
        if not existing:
            new_register = ModbusRegister(
                data_source_id=request.data_source_id,
                meter_id=request.meter_id,
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
                is_active=1,
                poll_priority=1,
            )
            db.add(new_register)
            created_count += 1
    
    db.commit()
    
    return {
        "message": f"Applied template '{template.name}' to data source",
        "registers_created": created_count,
        "registers_skipped": len(template_registers) - created_count
    }


@router.post("/seed", response_model=dict)
def seed_templates(db: Session = Depends(get_db)):
    """Seed database with common device templates (Schneider, ABB, Siemens, etc.)."""
    return seed_device_templates(db)
