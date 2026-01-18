"""Seed device templates with common meter profiles."""
from sqlalchemy.orm import Session
from backend.app.models.integrations import DeviceTemplate, TemplateRegister, RegisterType, DataType, ByteOrder


def seed_device_templates(db: Session):
    """Seed database with common device templates."""
    
    existing = db.query(DeviceTemplate).filter(DeviceTemplate.is_system_template == 1).count()
    if existing > 0:
        return {"message": "Templates already seeded", "count": existing}
    
    templates_data = [
        {
            "name": "Schneider PM5560",
            "manufacturer": "Schneider Electric",
            "model": "PM5560",
            "description": "PowerLogic PM5560 Power Meter - Advanced power quality meter with 1000+ parameters",
            "protocol": "modbus_tcp",
            "default_port": 502,
            "default_slave_id": 1,
            "registers": [
                {"name": "Total Active Energy Import", "address": 2699, "type": "holding", "data_type": "float32", "unit": "kWh", "scale": 1.0, "category": "Energy"},
                {"name": "Total Active Energy Export", "address": 2701, "type": "holding", "data_type": "float32", "unit": "kWh", "scale": 1.0, "category": "Energy"},
                {"name": "Total Reactive Energy Import", "address": 2703, "type": "holding", "data_type": "float32", "unit": "kVARh", "scale": 1.0, "category": "Energy"},
                {"name": "Total Reactive Energy Export", "address": 2705, "type": "holding", "data_type": "float32", "unit": "kVARh", "scale": 1.0, "category": "Energy"},
                {"name": "Voltage L1-N", "address": 3027, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L2-N", "address": 3029, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L3-N", "address": 3031, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Current L1", "address": 2999, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L2", "address": 3001, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L3", "address": 3003, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Total Active Power", "address": 3059, "type": "holding", "data_type": "float32", "unit": "kW", "scale": 1.0, "category": "Power"},
                {"name": "Total Reactive Power", "address": 3067, "type": "holding", "data_type": "float32", "unit": "kVAR", "scale": 1.0, "category": "Power"},
                {"name": "Total Apparent Power", "address": 3075, "type": "holding", "data_type": "float32", "unit": "kVA", "scale": 1.0, "category": "Power"},
                {"name": "Power Factor", "address": 3083, "type": "holding", "data_type": "float32", "unit": "", "scale": 1.0, "category": "Power Quality"},
                {"name": "Frequency", "address": 3109, "type": "holding", "data_type": "float32", "unit": "Hz", "scale": 1.0, "category": "Power Quality"},
            ]
        },
        {
            "name": "ABB B24",
            "manufacturer": "ABB",
            "model": "B24",
            "description": "ABB B24 Three-phase energy meter with Modbus interface",
            "protocol": "modbus_tcp",
            "default_port": 502,
            "default_slave_id": 1,
            "registers": [
                {"name": "Total Active Energy Import", "address": 0x5000, "type": "holding", "data_type": "uint32", "unit": "Wh", "scale": 0.001, "category": "Energy"},
                {"name": "Total Active Energy Export", "address": 0x5002, "type": "holding", "data_type": "uint32", "unit": "Wh", "scale": 0.001, "category": "Energy"},
                {"name": "Voltage L1", "address": 0x5B00, "type": "holding", "data_type": "uint32", "unit": "V", "scale": 0.1, "category": "Voltage"},
                {"name": "Voltage L2", "address": 0x5B02, "type": "holding", "data_type": "uint32", "unit": "V", "scale": 0.1, "category": "Voltage"},
                {"name": "Voltage L3", "address": 0x5B04, "type": "holding", "data_type": "uint32", "unit": "V", "scale": 0.1, "category": "Voltage"},
                {"name": "Current L1", "address": 0x5B0C, "type": "holding", "data_type": "uint32", "unit": "A", "scale": 0.001, "category": "Current"},
                {"name": "Current L2", "address": 0x5B0E, "type": "holding", "data_type": "uint32", "unit": "A", "scale": 0.001, "category": "Current"},
                {"name": "Current L3", "address": 0x5B10, "type": "holding", "data_type": "uint32", "unit": "A", "scale": 0.001, "category": "Current"},
                {"name": "Total Active Power", "address": 0x5B14, "type": "holding", "data_type": "int32", "unit": "W", "scale": 0.001, "category": "Power"},
                {"name": "Power Factor", "address": 0x5B3A, "type": "holding", "data_type": "int16", "unit": "", "scale": 0.001, "category": "Power Quality"},
                {"name": "Frequency", "address": 0x5B2C, "type": "holding", "data_type": "uint16", "unit": "Hz", "scale": 0.01, "category": "Power Quality"},
            ]
        },
        {
            "name": "Eastron SDM630",
            "manufacturer": "Eastron",
            "model": "SDM630",
            "description": "Eastron SDM630 Modbus V2 - Popular 3-phase energy meter",
            "protocol": "modbus_rtu",
            "default_port": 502,
            "default_slave_id": 1,
            "registers": [
                {"name": "Voltage L1", "address": 0, "type": "input", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L2", "address": 2, "type": "input", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L3", "address": 4, "type": "input", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Current L1", "address": 6, "type": "input", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L2", "address": 8, "type": "input", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L3", "address": 10, "type": "input", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Active Power L1", "address": 12, "type": "input", "data_type": "float32", "unit": "W", "scale": 1.0, "category": "Power"},
                {"name": "Active Power L2", "address": 14, "type": "input", "data_type": "float32", "unit": "W", "scale": 1.0, "category": "Power"},
                {"name": "Active Power L3", "address": 16, "type": "input", "data_type": "float32", "unit": "W", "scale": 1.0, "category": "Power"},
                {"name": "Total Active Power", "address": 52, "type": "input", "data_type": "float32", "unit": "W", "scale": 1.0, "category": "Power"},
                {"name": "Total Active Energy Import", "address": 72, "type": "input", "data_type": "float32", "unit": "kWh", "scale": 1.0, "category": "Energy"},
                {"name": "Total Active Energy Export", "address": 74, "type": "input", "data_type": "float32", "unit": "kWh", "scale": 1.0, "category": "Energy"},
                {"name": "Frequency", "address": 70, "type": "input", "data_type": "float32", "unit": "Hz", "scale": 1.0, "category": "Power Quality"},
            ]
        },
        {
            "name": "Siemens PAC3200",
            "manufacturer": "Siemens",
            "model": "PAC3200",
            "description": "SENTRON PAC3200 Power Monitoring Device",
            "protocol": "modbus_tcp",
            "default_port": 502,
            "default_slave_id": 1,
            "registers": [
                {"name": "Voltage L1-N", "address": 1, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L2-N", "address": 3, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L3-N", "address": 5, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Current L1", "address": 13, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L2", "address": 15, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L3", "address": 17, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Total Active Power", "address": 65, "type": "holding", "data_type": "float32", "unit": "W", "scale": 1.0, "category": "Power"},
                {"name": "Total Reactive Power", "address": 67, "type": "holding", "data_type": "float32", "unit": "VAR", "scale": 1.0, "category": "Power"},
                {"name": "Total Apparent Power", "address": 69, "type": "holding", "data_type": "float32", "unit": "VA", "scale": 1.0, "category": "Power"},
                {"name": "Power Factor", "address": 71, "type": "holding", "data_type": "float32", "unit": "", "scale": 1.0, "category": "Power Quality"},
                {"name": "Frequency", "address": 55, "type": "holding", "data_type": "float32", "unit": "Hz", "scale": 1.0, "category": "Power Quality"},
                {"name": "Total Active Energy Import", "address": 801, "type": "holding", "data_type": "float64", "unit": "Wh", "scale": 0.001, "category": "Energy"},
                {"name": "Total Active Energy Export", "address": 809, "type": "holding", "data_type": "float64", "unit": "Wh", "scale": 0.001, "category": "Energy"},
            ]
        },
        {
            "name": "Janitza UMG 604",
            "manufacturer": "Janitza",
            "model": "UMG 604",
            "description": "Janitza UMG 604 Universal Measuring Device - Power Quality Analyzer",
            "protocol": "modbus_tcp",
            "default_port": 502,
            "default_slave_id": 1,
            "registers": [
                {"name": "Voltage L1-N", "address": 100, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L2-N", "address": 102, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Voltage L3-N", "address": 104, "type": "holding", "data_type": "float32", "unit": "V", "scale": 1.0, "category": "Voltage"},
                {"name": "Current L1", "address": 200, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L2", "address": 202, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Current L3", "address": 204, "type": "holding", "data_type": "float32", "unit": "A", "scale": 1.0, "category": "Current"},
                {"name": "Total Active Power", "address": 320, "type": "holding", "data_type": "float32", "unit": "W", "scale": 1.0, "category": "Power"},
                {"name": "Total Reactive Power", "address": 324, "type": "holding", "data_type": "float32", "unit": "VAR", "scale": 1.0, "category": "Power"},
                {"name": "Total Apparent Power", "address": 328, "type": "holding", "data_type": "float32", "unit": "VA", "scale": 1.0, "category": "Power"},
                {"name": "Power Factor", "address": 332, "type": "holding", "data_type": "float32", "unit": "", "scale": 1.0, "category": "Power Quality"},
                {"name": "Frequency", "address": 350, "type": "holding", "data_type": "float32", "unit": "Hz", "scale": 1.0, "category": "Power Quality"},
                {"name": "Total Active Energy Import", "address": 500, "type": "holding", "data_type": "float64", "unit": "Wh", "scale": 0.001, "category": "Energy"},
            ]
        },
        {
            "name": "Carlo Gavazzi EM340",
            "manufacturer": "Carlo Gavazzi",
            "model": "EM340",
            "description": "Carlo Gavazzi EM340 Energy Analyzer - 3-phase with 4 quadrant",
            "protocol": "modbus_rtu",
            "default_port": 502,
            "default_slave_id": 1,
            "registers": [
                {"name": "Voltage L1-N", "address": 0, "type": "input", "data_type": "int32", "unit": "V", "scale": 0.1, "category": "Voltage"},
                {"name": "Voltage L2-N", "address": 2, "type": "input", "data_type": "int32", "unit": "V", "scale": 0.1, "category": "Voltage"},
                {"name": "Voltage L3-N", "address": 4, "type": "input", "data_type": "int32", "unit": "V", "scale": 0.1, "category": "Voltage"},
                {"name": "Current L1", "address": 12, "type": "input", "data_type": "int32", "unit": "A", "scale": 0.001, "category": "Current"},
                {"name": "Current L2", "address": 14, "type": "input", "data_type": "int32", "unit": "A", "scale": 0.001, "category": "Current"},
                {"name": "Current L3", "address": 16, "type": "input", "data_type": "int32", "unit": "A", "scale": 0.001, "category": "Current"},
                {"name": "Total Active Power", "address": 40, "type": "input", "data_type": "int32", "unit": "W", "scale": 0.1, "category": "Power"},
                {"name": "Power Factor", "address": 48, "type": "input", "data_type": "int16", "unit": "", "scale": 0.001, "category": "Power Quality"},
                {"name": "Frequency", "address": 55, "type": "input", "data_type": "uint16", "unit": "Hz", "scale": 0.1, "category": "Power Quality"},
                {"name": "Total Active Energy Import", "address": 64, "type": "input", "data_type": "int32", "unit": "Wh", "scale": 0.1, "category": "Energy"},
            ]
        },
    ]
    
    created_count = 0
    register_count = 0
    
    data_type_map = {
        "int16": DataType.INT16,
        "uint16": DataType.UINT16,
        "int32": DataType.INT32,
        "uint32": DataType.UINT32,
        "float32": DataType.FLOAT32,
        "float64": DataType.FLOAT64,
    }
    
    register_type_map = {
        "holding": RegisterType.HOLDING,
        "input": RegisterType.INPUT,
        "coil": RegisterType.COIL,
        "discrete": RegisterType.DISCRETE,
    }
    
    for td in templates_data:
        template = DeviceTemplate(
            name=td["name"],
            manufacturer=td["manufacturer"],
            model=td["model"],
            description=td["description"],
            protocol=td["protocol"],
            default_port=td["default_port"],
            default_slave_id=td["default_slave_id"],
            is_system_template=1,
            is_active=1,
        )
        db.add(template)
        db.flush()
        created_count += 1
        
        for i, reg in enumerate(td["registers"]):
            template_register = TemplateRegister(
                template_id=template.id,
                name=reg["name"],
                register_address=reg["address"],
                register_type=register_type_map.get(reg["type"], RegisterType.HOLDING),
                data_type=data_type_map.get(reg["data_type"], DataType.UINT16),
                byte_order=ByteOrder.BIG_ENDIAN,
                register_count=2 if reg["data_type"] in ["float32", "int32", "uint32"] else (4 if reg["data_type"] == "float64" else 1),
                scale_factor=reg["scale"],
                offset=0.0,
                unit=reg["unit"],
                is_writable=0,
                display_order=i,
                category=reg["category"],
            )
            db.add(template_register)
            register_count += 1
    
    db.commit()
    
    return {
        "message": "Device templates seeded successfully",
        "templates_created": created_count,
        "registers_created": register_count
    }
