"""
Seed data for Device Management System
Creates initial device models, products, and policies.
"""
import logging
from sqlalchemy.orm import Session

from backend.app.models.devices import (
    DeviceModel, DeviceProduct, DevicePolicy, Datapoint, Command,
    DeviceType, DatapointType, DatapointAggregation, CommandInputType
)

logger = logging.getLogger(__name__)


def seed_device_policies(db: Session) -> None:
    """Seed default device policies."""
    policies = [
        {
            "name": "Telemetry Only",
            "description": "Device can only send telemetry data (read-only)",
            "allow_telemetry": 1,
            "allow_events": 1,
            "allow_commands": 0,
            "allow_config": 0,
            "allow_firmware": 0,
            "is_system_policy": 1,
        },
        {
            "name": "Full Access",
            "description": "Device has full bidirectional communication",
            "allow_telemetry": 1,
            "allow_events": 1,
            "allow_commands": 1,
            "allow_config": 1,
            "allow_firmware": 1,
            "is_system_policy": 1,
        },
        {
            "name": "Controlled Device",
            "description": "Device can send telemetry and receive commands",
            "allow_telemetry": 1,
            "allow_events": 1,
            "allow_commands": 1,
            "allow_config": 0,
            "allow_firmware": 0,
            "is_system_policy": 1,
        },
    ]
    
    for policy_data in policies:
        existing = db.query(DevicePolicy).filter(
            DevicePolicy.name == policy_data["name"]
        ).first()
        if not existing:
            policy = DevicePolicy(**policy_data, is_active=1)
            db.add(policy)
            logger.info(f"Created policy: {policy_data['name']}")


def seed_device_models(db: Session) -> None:
    """Seed default device models with datapoints and commands."""
    models = [
        {
            "name": "Energy Meter",
            "description": "Standard energy meter with power and energy readings",
            "version": "1.0.0",
            "is_system_model": 1,
            "icon": "zap",
            "color": "#3B82F6",
            "datapoints": [
                {"name": "voltage_l1", "display_name": "Voltage L1", "unit": "V", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "voltage_l2", "display_name": "Voltage L2", "unit": "V", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "voltage_l3", "display_name": "Voltage L3", "unit": "V", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "current_l1", "display_name": "Current L1", "unit": "A", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "current_l2", "display_name": "Current L2", "unit": "A", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "current_l3", "display_name": "Current L3", "unit": "A", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "active_power", "display_name": "Active Power", "unit": "kW", "data_type": DatapointType.FLOAT, "category": "power"},
                {"name": "reactive_power", "display_name": "Reactive Power", "unit": "kVAR", "data_type": DatapointType.FLOAT, "category": "power"},
                {"name": "apparent_power", "display_name": "Apparent Power", "unit": "kVA", "data_type": DatapointType.FLOAT, "category": "power"},
                {"name": "power_factor", "display_name": "Power Factor", "unit": "", "data_type": DatapointType.FLOAT, "category": "power"},
                {"name": "frequency", "display_name": "Frequency", "unit": "Hz", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "total_energy", "display_name": "Total Energy", "unit": "kWh", "data_type": DatapointType.FLOAT, "aggregation": DatapointAggregation.LAST, "category": "energy"},
                {"name": "import_energy", "display_name": "Import Energy", "unit": "kWh", "data_type": DatapointType.FLOAT, "category": "energy"},
                {"name": "export_energy", "display_name": "Export Energy", "unit": "kWh", "data_type": DatapointType.FLOAT, "category": "energy"},
            ],
            "commands": [],
        },
        {
            "name": "PV Inverter",
            "description": "Solar PV inverter with DC/AC monitoring",
            "version": "1.0.0",
            "is_system_model": 1,
            "icon": "sun",
            "color": "#F59E0B",
            "datapoints": [
                {"name": "dc_power", "display_name": "DC Power", "unit": "kW", "data_type": DatapointType.FLOAT, "category": "dc"},
                {"name": "dc_voltage", "display_name": "DC Voltage", "unit": "V", "data_type": DatapointType.FLOAT, "category": "dc"},
                {"name": "dc_current", "display_name": "DC Current", "unit": "A", "data_type": DatapointType.FLOAT, "category": "dc"},
                {"name": "ac_power", "display_name": "AC Power", "unit": "kW", "data_type": DatapointType.FLOAT, "category": "ac"},
                {"name": "ac_voltage", "display_name": "AC Voltage", "unit": "V", "data_type": DatapointType.FLOAT, "category": "ac"},
                {"name": "ac_current", "display_name": "AC Current", "unit": "A", "data_type": DatapointType.FLOAT, "category": "ac"},
                {"name": "efficiency", "display_name": "Efficiency", "unit": "%", "data_type": DatapointType.FLOAT, "category": "performance"},
                {"name": "daily_energy", "display_name": "Daily Energy", "unit": "kWh", "data_type": DatapointType.FLOAT, "category": "energy"},
                {"name": "total_energy", "display_name": "Total Energy", "unit": "kWh", "data_type": DatapointType.FLOAT, "category": "energy"},
                {"name": "temperature", "display_name": "Temperature", "unit": "°C", "data_type": DatapointType.FLOAT, "category": "status"},
                {"name": "status", "display_name": "Status", "unit": "", "data_type": DatapointType.STRING, "category": "status"},
            ],
            "commands": [
                {"name": "start", "display_name": "Start Inverter", "input_type": CommandInputType.BUTTON, "is_dangerous": 0},
                {"name": "stop", "display_name": "Stop Inverter", "input_type": CommandInputType.BUTTON, "is_dangerous": 1, "requires_confirmation": 1},
                {"name": "set_power_limit", "display_name": "Set Power Limit", "input_type": CommandInputType.SLIDER, "min_value": 0, "max_value": 100, "step": 5},
            ],
        },
        {
            "name": "Battery Storage",
            "description": "Battery Energy Storage System (BESS)",
            "version": "1.0.0",
            "is_system_model": 1,
            "icon": "battery",
            "color": "#10B981",
            "datapoints": [
                {"name": "soc", "display_name": "State of Charge", "unit": "%", "data_type": DatapointType.FLOAT, "category": "battery"},
                {"name": "soh", "display_name": "State of Health", "unit": "%", "data_type": DatapointType.FLOAT, "category": "battery"},
                {"name": "power", "display_name": "Power", "unit": "kW", "data_type": DatapointType.FLOAT, "category": "power"},
                {"name": "voltage", "display_name": "Voltage", "unit": "V", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "current", "display_name": "Current", "unit": "A", "data_type": DatapointType.FLOAT, "category": "electrical"},
                {"name": "temperature", "display_name": "Temperature", "unit": "°C", "data_type": DatapointType.FLOAT, "category": "status"},
                {"name": "cycles", "display_name": "Cycle Count", "unit": "", "data_type": DatapointType.INT, "category": "battery"},
                {"name": "charged_energy", "display_name": "Charged Energy", "unit": "kWh", "data_type": DatapointType.FLOAT, "category": "energy"},
                {"name": "discharged_energy", "display_name": "Discharged Energy", "unit": "kWh", "data_type": DatapointType.FLOAT, "category": "energy"},
                {"name": "mode", "display_name": "Operating Mode", "unit": "", "data_type": DatapointType.STRING, "category": "status"},
            ],
            "commands": [
                {"name": "charge", "display_name": "Start Charging", "input_type": CommandInputType.BUTTON},
                {"name": "discharge", "display_name": "Start Discharging", "input_type": CommandInputType.BUTTON},
                {"name": "standby", "display_name": "Set Standby", "input_type": CommandInputType.BUTTON},
                {"name": "set_power", "display_name": "Set Power", "input_type": CommandInputType.NUMERIC, "min_value": -100, "max_value": 100},
                {"name": "set_soc_limits", "display_name": "Set SOC Limits", "input_type": CommandInputType.SLIDER, "min_value": 0, "max_value": 100},
            ],
        },
        {
            "name": "Gateway",
            "description": "Data collection gateway device",
            "version": "1.0.0",
            "is_system_model": 1,
            "icon": "router",
            "color": "#8B5CF6",
            "datapoints": [
                {"name": "uptime", "display_name": "Uptime", "unit": "s", "data_type": DatapointType.INT, "category": "status"},
                {"name": "cpu_usage", "display_name": "CPU Usage", "unit": "%", "data_type": DatapointType.FLOAT, "category": "status"},
                {"name": "memory_usage", "display_name": "Memory Usage", "unit": "%", "data_type": DatapointType.FLOAT, "category": "status"},
                {"name": "disk_usage", "display_name": "Disk Usage", "unit": "%", "data_type": DatapointType.FLOAT, "category": "status"},
                {"name": "temperature", "display_name": "Temperature", "unit": "°C", "data_type": DatapointType.FLOAT, "category": "status"},
                {"name": "connected_devices", "display_name": "Connected Devices", "unit": "", "data_type": DatapointType.INT, "category": "connectivity"},
                {"name": "signal_strength", "display_name": "Signal Strength", "unit": "dBm", "data_type": DatapointType.INT, "category": "connectivity"},
            ],
            "commands": [
                {"name": "reboot", "display_name": "Reboot Gateway", "input_type": CommandInputType.BUTTON, "is_dangerous": 1, "requires_confirmation": 1},
                {"name": "sync_config", "display_name": "Sync Configuration", "input_type": CommandInputType.BUTTON},
            ],
        },
    ]
    
    for model_data in models:
        existing = db.query(DeviceModel).filter(
            DeviceModel.name == model_data["name"]
        ).first()
        
        if existing:
            continue
        
        datapoints = model_data.pop("datapoints", [])
        commands = model_data.pop("commands", [])
        
        model = DeviceModel(**model_data, is_active=1, auto_propagate=1)
        db.add(model)
        db.flush()
        
        for i, dp_data in enumerate(datapoints):
            dp = Datapoint(
                model_id=model.id,
                name=dp_data["name"],
                display_name=dp_data.get("display_name"),
                unit=dp_data.get("unit"),
                data_type=dp_data.get("data_type", DatapointType.FLOAT),
                aggregation=dp_data.get("aggregation", DatapointAggregation.LAST),
                category=dp_data.get("category"),
                display_order=i,
                is_readable=1,
                is_writable=0,
            )
            db.add(dp)
        
        for i, cmd_data in enumerate(commands):
            cmd = Command(
                model_id=model.id,
                name=cmd_data["name"],
                display_name=cmd_data.get("display_name"),
                input_type=cmd_data.get("input_type", CommandInputType.BUTTON),
                min_value=cmd_data.get("min_value"),
                max_value=cmd_data.get("max_value"),
                step=cmd_data.get("step"),
                is_dangerous=cmd_data.get("is_dangerous", 0),
                requires_confirmation=cmd_data.get("requires_confirmation", 0),
                display_order=i,
            )
            db.add(cmd)
        
        logger.info(f"Created device model: {model_data['name']}")


def seed_device_products(db: Session) -> None:
    """Seed device products from common manufacturers."""
    products = [
        {"name": "PM5320", "manufacturer": "Schneider Electric", "model_number": "PM5320", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "PM5350", "manufacturer": "Schneider Electric", "model_number": "PM5350", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "iEM3255", "manufacturer": "Schneider Electric", "model_number": "iEM3255", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "M4M 30", "manufacturer": "ABB", "model_number": "M4M30", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "B23/B24", "manufacturer": "ABB", "model_number": "B23", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_rtu"},
        {"name": "PAC4200", "manufacturer": "Siemens", "model_number": "PAC4200", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "Sunny Tripower", "manufacturer": "SMA", "model_number": "STP25000", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "Primo", "manufacturer": "Fronius", "model_number": "PRIMO", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "SUN2000", "manufacturer": "Huawei", "model_number": "SUN2000", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "Powerwall", "manufacturer": "Tesla", "model_number": "POWERWALL", "device_type": DeviceType.SMART_SENSOR, "protocol": "https_api"},
        {"name": "Battery-Box Premium", "manufacturer": "BYD", "model_number": "HVS", "device_type": DeviceType.PERIPHERAL, "protocol": "modbus_tcp", "default_port": 502},
        {"name": "RUT200", "manufacturer": "Teltonika", "model_number": "RUT200", "device_type": DeviceType.GATEWAY, "protocol": "mqtt"},
        {"name": "RUT240", "manufacturer": "Teltonika", "model_number": "RUT240", "device_type": DeviceType.GATEWAY, "protocol": "mqtt"},
        {"name": "TRB140", "manufacturer": "Teltonika", "model_number": "TRB140", "device_type": DeviceType.GATEWAY, "protocol": "mqtt"},
        {"name": "Shelly Pro 3EM", "manufacturer": "Shelly", "model_number": "PRO3EM", "device_type": DeviceType.SMART_SENSOR, "protocol": "mqtt"},
    ]
    
    for product_data in products:
        existing = db.query(DeviceProduct).filter(
            DeviceProduct.manufacturer == product_data["manufacturer"],
            DeviceProduct.model_number == product_data["model_number"]
        ).first()
        
        if not existing:
            product = DeviceProduct(**product_data, is_active=1, is_verified=1)
            db.add(product)
            logger.info(f"Created device product: {product_data['manufacturer']} {product_data['name']}")


def seed_all_device_data(db: Session) -> None:
    """Seed all device management data."""
    logger.info("Seeding device management data...")
    
    seed_device_policies(db)
    seed_device_models(db)
    seed_device_products(db)
    
    db.commit()
    logger.info("Device management data seeding complete")
