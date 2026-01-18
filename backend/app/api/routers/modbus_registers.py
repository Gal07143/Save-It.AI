"""Modbus Register configuration API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.integrations import ModbusRegister, RegisterType, DataType, ByteOrder
from backend.app.models import DataSource
from backend.app.schemas.integrations import (
    ModbusRegisterCreate,
    ModbusRegisterUpdate,
    ModbusRegisterResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    RegisterReadRequest,
    RegisterReadResponse,
)

router = APIRouter(prefix="/api/v1/modbus-registers", tags=["modbus-registers"])


@router.post("", response_model=ModbusRegisterResponse)
def create_modbus_register(register: ModbusRegisterCreate, db: Session = Depends(get_db)):
    """Create a new Modbus register configuration."""
    data_source = db.query(DataSource).filter(DataSource.id == register.data_source_id).first()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    existing = db.query(ModbusRegister).filter(
        ModbusRegister.data_source_id == register.data_source_id,
        ModbusRegister.register_address == register.register_address
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Register at address {register.register_address} already exists for this data source")
    
    db_register = ModbusRegister(
        data_source_id=register.data_source_id,
        meter_id=register.meter_id,
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
        is_active=1 if register.is_active else 0,
        poll_priority=register.poll_priority,
    )
    db.add(db_register)
    db.commit()
    db.refresh(db_register)
    return db_register


@router.get("", response_model=List[ModbusRegisterResponse])
def list_modbus_registers(
    data_source_id: Optional[int] = None,
    meter_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all Modbus registers, optionally filtered."""
    query = db.query(ModbusRegister)
    
    if data_source_id:
        query = query.filter(ModbusRegister.data_source_id == data_source_id)
    if meter_id:
        query = query.filter(ModbusRegister.meter_id == meter_id)
    if is_active is not None:
        query = query.filter(ModbusRegister.is_active == (1 if is_active else 0))
    
    return query.order_by(ModbusRegister.register_address).offset(skip).limit(limit).all()


@router.get("/{register_id}", response_model=ModbusRegisterResponse)
def get_modbus_register(register_id: int, db: Session = Depends(get_db)):
    """Get Modbus register by ID."""
    register = db.query(ModbusRegister).filter(ModbusRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Modbus register not found")
    return register


@router.put("/{register_id}", response_model=ModbusRegisterResponse)
def update_modbus_register(register_id: int, updates: ModbusRegisterUpdate, db: Session = Depends(get_db)):
    """Update Modbus register configuration."""
    register = db.query(ModbusRegister).filter(ModbusRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Modbus register not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    
    if "register_type" in update_data:
        update_data["register_type"] = update_data["register_type"].value
    if "data_type" in update_data:
        update_data["data_type"] = update_data["data_type"].value
    if "byte_order" in update_data:
        update_data["byte_order"] = update_data["byte_order"].value
    if "is_writable" in update_data:
        update_data["is_writable"] = 1 if update_data["is_writable"] else 0
    if "is_active" in update_data:
        update_data["is_active"] = 1 if update_data["is_active"] else 0
    
    for key, value in update_data.items():
        setattr(register, key, value)
    
    db.commit()
    db.refresh(register)
    return register


@router.delete("/{register_id}")
def delete_modbus_register(register_id: int, db: Session = Depends(get_db)):
    """Delete a Modbus register configuration."""
    register = db.query(ModbusRegister).filter(ModbusRegister.id == register_id).first()
    if not register:
        raise HTTPException(status_code=404, detail="Modbus register not found")
    
    db.delete(register)
    db.commit()
    return {"message": "Modbus register deleted successfully"}


@router.post("/test-connection", response_model=ConnectionTestResponse)
async def test_modbus_connection(request: ConnectionTestRequest):
    """Test Modbus TCP connection to a device."""
    import asyncio
    import time
    
    try:
        from pymodbus.client import ModbusTcpClient
        
        start_time = time.time()
        client = ModbusTcpClient(
            host=request.host,
            port=request.port,
            timeout=request.timeout_seconds
        )
        
        connected = client.connect()
        if not connected:
            return ConnectionTestResponse(
                success=False,
                message=f"Failed to connect to {request.host}:{request.port}",
                response_time_ms=None,
                device_info=None
            )
        
        try:
            result = client.read_holding_registers(0, 1, slave=request.slave_id)
            response_time = (time.time() - start_time) * 1000
            
            if result.isError():
                return ConnectionTestResponse(
                    success=False,
                    message=f"Connection successful but register read failed: {result}",
                    response_time_ms=response_time,
                    device_info=None
                )
            
            return ConnectionTestResponse(
                success=True,
                message=f"Successfully connected to {request.host}:{request.port} (slave {request.slave_id})",
                response_time_ms=round(response_time, 2),
                device_info={
                    "host": request.host,
                    "port": request.port,
                    "slave_id": request.slave_id,
                    "sample_register_0": result.registers[0] if result.registers else None
                }
            )
        finally:
            client.close()
            
    except ImportError:
        return ConnectionTestResponse(
            success=False,
            message="Modbus library not available",
            response_time_ms=None,
            device_info=None
        )
    except Exception as e:
        return ConnectionTestResponse(
            success=False,
            message=f"Connection error: {str(e)}",
            response_time_ms=None,
            device_info=None
        )


@router.post("/read", response_model=List[RegisterReadResponse])
async def read_registers(request: RegisterReadRequest, db: Session = Depends(get_db)):
    """Read current values from specified Modbus registers."""
    data_source = db.query(DataSource).filter(DataSource.id == request.data_source_id).first()
    if not data_source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    query = db.query(ModbusRegister).filter(
        ModbusRegister.data_source_id == request.data_source_id,
        ModbusRegister.is_active == 1
    )
    
    if request.register_ids:
        query = query.filter(ModbusRegister.id.in_(request.register_ids))
    
    registers = query.all()
    results = []
    
    try:
        from pymodbus.client import ModbusTcpClient
        
        client = ModbusTcpClient(
            host=data_source.host,
            port=data_source.port or 502,
            timeout=5
        )
        
        if not client.connect():
            for reg in registers:
                results.append(RegisterReadResponse(
                    register_id=reg.id,
                    name=reg.name,
                    address=reg.register_address,
                    raw_value=None,
                    scaled_value=None,
                    unit=reg.unit,
                    quality="bad",
                    read_at=datetime.utcnow(),
                    error="Failed to connect to device"
                ))
            return results
        
        try:
            slave_id = data_source.slave_id or 1
            
            for reg in registers:
                try:
                    if reg.register_type == RegisterType.HOLDING.value:
                        result = client.read_holding_registers(reg.register_address, reg.register_count, slave=slave_id)
                    elif reg.register_type == RegisterType.INPUT.value:
                        result = client.read_input_registers(reg.register_address, reg.register_count, slave=slave_id)
                    elif reg.register_type == RegisterType.COIL.value:
                        result = client.read_coils(reg.register_address, reg.register_count, slave=slave_id)
                    else:
                        result = client.read_discrete_inputs(reg.register_address, reg.register_count, slave=slave_id)
                    
                    if result.isError():
                        results.append(RegisterReadResponse(
                            register_id=reg.id,
                            name=reg.name,
                            address=reg.register_address,
                            raw_value=None,
                            scaled_value=None,
                            unit=reg.unit,
                            quality="bad",
                            read_at=datetime.utcnow(),
                            error=str(result)
                        ))
                    else:
                        raw_value = result.registers[0] if hasattr(result, 'registers') else (1 if result.bits[0] else 0)
                        scaled_value = (raw_value * reg.scale_factor) + reg.offset
                        
                        reg.last_value = scaled_value
                        reg.last_read_at = datetime.utcnow()
                        reg.last_error = None
                        
                        results.append(RegisterReadResponse(
                            register_id=reg.id,
                            name=reg.name,
                            address=reg.register_address,
                            raw_value=float(raw_value),
                            scaled_value=scaled_value,
                            unit=reg.unit,
                            quality="good",
                            read_at=datetime.utcnow(),
                            error=None
                        ))
                        
                except Exception as e:
                    reg.last_error = str(e)
                    results.append(RegisterReadResponse(
                        register_id=reg.id,
                        name=reg.name,
                        address=reg.register_address,
                        raw_value=None,
                        scaled_value=None,
                        unit=reg.unit,
                        quality="bad",
                        read_at=datetime.utcnow(),
                        error=str(e)
                    ))
            
            db.commit()
        finally:
            client.close()
            
    except ImportError:
        for reg in registers:
            results.append(RegisterReadResponse(
                register_id=reg.id,
                name=reg.name,
                address=reg.register_address,
                raw_value=reg.last_value,
                scaled_value=reg.last_value,
                unit=reg.unit,
                quality="stale",
                read_at=reg.last_read_at or datetime.utcnow(),
                error="Modbus library not available - showing cached values"
            ))
    
    return results
