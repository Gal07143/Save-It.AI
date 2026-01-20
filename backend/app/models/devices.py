"""
Device Management Models for SAVE-IT.AI
Implements Zoho IoT-style device architecture with:
- Device Types (Gateway, Peripheral, Smart Sensor, API Endpoint)
- Device Models (blueprints) with propagation to instances
- Device Products (manufacturer catalog)
- Datapoints, Commands, Alarm Rules
- Policies and Certificates for authentication
"""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Float, 
    Enum, Text, Boolean, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class DeviceType(PyEnum):
    """Device type categories following Zoho IoT pattern."""
    GATEWAY = "gateway"
    PERIPHERAL = "peripheral"
    SMART_SENSOR = "smart_sensor"
    API_ENDPOINT = "api_endpoint"


class AuthType(PyEnum):
    """Authentication types for device connections."""
    TOKEN = "token"
    TOKEN_TLS = "token_tls"
    CERTIFICATE = "certificate"
    API_KEY = "api_key"


class ConfigSyncStatus(PyEnum):
    """Status of remote configuration sync to devices."""
    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"


class DatapointType(PyEnum):
    """Data types for datapoints."""
    INT = "int"
    FLOAT = "float"
    BOOLEAN = "boolean"
    STRING = "string"
    ENUM = "enum"


class DatapointAggregation(PyEnum):
    """Aggregation methods for datapoints."""
    NONE = "none"
    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    COUNT = "count"
    LAST = "last"


class CommandInputType(PyEnum):
    """Input types for device commands."""
    TOGGLE = "toggle"
    SLIDER = "slider"
    BUTTON = "button"
    NUMERIC = "numeric"
    SELECT = "select"
    TEXT = "text"


class AlarmSeverity(PyEnum):
    """Severity levels for alarm rules."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlarmCondition(PyEnum):
    """Condition types for alarm evaluation."""
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    EQUAL = "eq"
    NOT_EQUAL = "neq"
    GREATER_EQUAL = "gte"
    LESS_EQUAL = "lte"
    BETWEEN = "between"
    OUTSIDE = "outside"
    CHANGE = "change"
    NO_DATA = "no_data"


class PolicyAction(PyEnum):
    """Allowed actions in device-cloud communication policies."""
    TELEMETRY = "telemetry"
    EVENTS = "events"
    COMMANDS = "commands"
    CONFIG = "config"
    FIRMWARE = "firmware"


class DeviceModel(Base):
    """
    Device Model - Blueprint for device instances.
    Changes to a model propagate to all linked device instances.
    Similar to Zoho IoT's Model concept.
    """
    __tablename__ = "device_models"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    version = Column(String(50), default="1.0.0")
    is_system_model = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    auto_propagate = Column(Integer, default=1)
    icon = Column(String(100), nullable=True)
    color = Column(String(7), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    datapoints = relationship("Datapoint", back_populates="model", cascade="all, delete-orphan")
    commands = relationship("Command", back_populates="model", cascade="all, delete-orphan")
    alarm_rules = relationship("AlarmRule", back_populates="model", cascade="all, delete-orphan")
    devices = relationship("Device", back_populates="model")
    products = relationship("DeviceProduct", back_populates="model")


class DeviceProduct(Base):
    """
    Device Product - Manufacturer/model catalog entry.
    Contains protocol details, firmware info, and message formatters.
    Multiple products can share the same DeviceModel if they have common datapoints.
    """
    __tablename__ = "device_products"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("device_models.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    manufacturer = Column(String(100), nullable=False, index=True)
    model_number = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    device_type = Column(Enum(DeviceType), default=DeviceType.PERIPHERAL)
    protocol = Column(String(50), default="modbus_tcp")
    default_port = Column(Integer, nullable=True)
    default_slave_id = Column(Integer, default=1)
    firmware_version = Column(String(50), nullable=True)
    hardware_version = Column(String(50), nullable=True)
    message_formatter = Column(Text, nullable=True)
    config_schema = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    datasheet_url = Column(String(500), nullable=True)
    is_verified = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model = relationship("DeviceModel", back_populates="products")
    devices = relationship("Device", back_populates="product")
    register_mappings = relationship("ProductRegisterMapping", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("manufacturer", "model_number", name="uq_product_manufacturer_model"),
    )


class Device(Base):
    """
    Device Instance - Individual device registered in the system.
    Inherits datapoints/commands/alarms from its DeviceModel.
    Can be linked to a gateway (for peripherals) or operate independently (smart sensors).
    """
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("device_models.id"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("device_products.id"), nullable=True, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id"), nullable=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    device_type = Column(Enum(DeviceType), nullable=False, default=DeviceType.PERIPHERAL)
    serial_number = Column(String(100), nullable=True, index=True)
    edge_key = Column(String(100), nullable=True, index=True)
    
    auth_type = Column(Enum(AuthType), default=AuthType.TOKEN)
    mqtt_client_id = Column(String(255), nullable=True)
    mqtt_username = Column(String(255), nullable=True)
    mqtt_password_hash = Column(String(255), nullable=True)
    api_token = Column(String(500), nullable=True, unique=True)
    certificate_id = Column(Integer, ForeignKey("device_certificates.id"), nullable=True)
    policy_id = Column(Integer, ForeignKey("device_policies.id"), nullable=True)
    
    ip_address = Column(String(45), nullable=True)
    port = Column(Integer, nullable=True)
    slave_id = Column(Integer, nullable=True)
    
    firmware_version = Column(String(50), nullable=True)
    hardware_version = Column(String(50), nullable=True)
    config_json = Column(Text, nullable=True)
    config_sync_status = Column(Enum(ConfigSyncStatus), default=ConfigSyncStatus.PENDING)
    config_last_synced_at = Column(DateTime, nullable=True)
    
    is_active = Column(Integer, default=1)
    is_online = Column(Integer, default=0)
    last_seen_at = Column(DateTime, nullable=True)
    last_telemetry_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model = relationship("DeviceModel", back_populates="devices")
    product = relationship("DeviceProduct", back_populates="devices")
    gateway = relationship("Gateway", foreign_keys=[gateway_id])
    asset = relationship("Asset", foreign_keys=[asset_id])
    certificate = relationship("DeviceCertificate", foreign_keys=[certificate_id])
    policy = relationship("DevicePolicy", foreign_keys=[policy_id])
    device_datapoints = relationship("DeviceDatapoint", back_populates="device", cascade="all, delete-orphan")
    command_history = relationship("CommandExecution", back_populates="device", cascade="all, delete-orphan")
    telemetry = relationship("DeviceTelemetry", back_populates="device", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("gateway_id", "edge_key", name="uq_device_gateway_edge_key"),
        Index("ix_device_gateway_edge", "gateway_id", "edge_key"),
    )


class Datapoint(Base):
    """
    Datapoint Definition - Defines a measurement/metric on a DeviceModel.
    Propagates to all device instances of that model.
    """
    __tablename__ = "datapoints"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("device_models.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    display_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    data_type = Column(Enum(DatapointType), default=DatapointType.FLOAT)
    unit = Column(String(50), nullable=True)
    aggregation = Column(Enum(DatapointAggregation), default=DatapointAggregation.LAST)
    
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    precision = Column(Integer, default=2)
    scale_factor = Column(Float, default=1.0)
    offset = Column(Float, default=0.0)
    
    is_readable = Column(Integer, default=1)
    is_writable = Column(Integer, default=0)
    is_required = Column(Integer, default=0)
    
    enum_values = Column(Text, nullable=True)
    default_value = Column(String(255), nullable=True)
    
    category = Column(String(100), nullable=True)
    display_order = Column(Integer, default=0)
    icon = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model = relationship("DeviceModel", back_populates="datapoints")
    device_datapoints = relationship("DeviceDatapoint", back_populates="datapoint")
    alarm_rules = relationship("AlarmRule", back_populates="datapoint")

    __table_args__ = (
        UniqueConstraint("model_id", "name", name="uq_datapoint_model_name"),
    )


class Command(Base):
    """
    Command Definition - Defines a control action on a DeviceModel.
    Sent from cloud to device.
    """
    __tablename__ = "commands"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("device_models.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    display_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    input_type = Column(Enum(CommandInputType), default=CommandInputType.BUTTON)
    
    parameters_schema = Column(Text, nullable=True)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    step = Column(Float, nullable=True)
    enum_options = Column(Text, nullable=True)
    
    timeout_seconds = Column(Integer, default=30)
    requires_confirmation = Column(Integer, default=0)
    is_dangerous = Column(Integer, default=0)
    
    category = Column(String(100), nullable=True)
    display_order = Column(Integer, default=0)
    icon = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model = relationship("DeviceModel", back_populates="commands")
    executions = relationship("CommandExecution", back_populates="command")

    __table_args__ = (
        UniqueConstraint("model_id", "name", name="uq_command_model_name"),
    )


class AlarmRule(Base):
    """
    Alarm Rule Definition - Defines alert conditions on a DeviceModel.
    Evaluated against incoming telemetry data.
    """
    __tablename__ = "alarm_rules"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("device_models.id"), nullable=False, index=True)
    datapoint_id = Column(Integer, ForeignKey("datapoints.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    condition = Column(Enum(AlarmCondition), nullable=False)
    threshold_value = Column(Float, nullable=True)
    threshold_value_2 = Column(Float, nullable=True)
    duration_seconds = Column(Integer, default=0)
    
    severity = Column(Enum(AlarmSeverity), default=AlarmSeverity.WARNING)
    is_active = Column(Integer, default=1)
    auto_clear = Column(Integer, default=1)
    
    notification_channels = Column(Text, nullable=True)
    action_on_trigger = Column(Text, nullable=True)
    action_on_clear = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    model = relationship("DeviceModel", back_populates="alarm_rules")
    datapoint = relationship("Datapoint", back_populates="alarm_rules")


class DevicePolicy(Base):
    """
    Device Policy - Defines allowed device-cloud communication actions.
    Similar to Zoho IoT's policy concept.
    """
    __tablename__ = "device_policies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    
    allow_telemetry = Column(Integer, default=1)
    allow_events = Column(Integer, default=1)
    allow_commands = Column(Integer, default=0)
    allow_config = Column(Integer, default=0)
    allow_firmware = Column(Integer, default=0)
    
    max_message_size_kb = Column(Integer, default=256)
    max_messages_per_minute = Column(Integer, default=60)
    
    is_system_policy = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DeviceCertificate(Base):
    """
    Device Certificate - X.509 client certificate for TLS authentication.
    """
    __tablename__ = "device_certificates"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("device_policies.id"), nullable=True, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    serial_number = Column(String(100), unique=True, nullable=False)
    thumbprint = Column(String(64), unique=True, nullable=False)
    
    issued_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    
    issuer = Column(String(255), nullable=True)
    subject = Column(String(255), nullable=True)
    
    public_key_pem = Column(Text, nullable=True)
    
    is_revoked = Column(Integer, default=0)
    revoked_at = Column(DateTime, nullable=True)
    revocation_reason = Column(String(255), nullable=True)
    
    last_used_at = Column(DateTime, nullable=True)
    usage_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    policy = relationship("DevicePolicy", foreign_keys=[policy_id])


class DeviceDatapoint(Base):
    """
    Device Datapoint - Instance-level datapoint values.
    Links a device to its model's datapoints with current values.
    """
    __tablename__ = "device_datapoints"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    datapoint_id = Column(Integer, ForeignKey("datapoints.id", ondelete="CASCADE"), nullable=False, index=True)
    
    current_value = Column(String(255), nullable=True)
    previous_value = Column(String(255), nullable=True)
    last_updated_at = Column(DateTime, nullable=True)
    quality = Column(String(20), default="good")
    
    override_min = Column(Float, nullable=True)
    override_max = Column(Float, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="device_datapoints")
    datapoint = relationship("Datapoint", back_populates="device_datapoints")

    __table_args__ = (
        UniqueConstraint("device_id", "datapoint_id", name="uq_device_datapoint"),
    )


class CommandExecution(Base):
    """
    Command Execution - Tracks command sends and acknowledgments.
    """
    __tablename__ = "command_executions"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    command_id = Column(Integer, ForeignKey("commands.id"), nullable=False, index=True)
    
    correlation_id = Column(String(100), unique=True, nullable=False, index=True)
    parameters = Column(Text, nullable=True)
    
    status = Column(String(20), default="pending")
    sent_at = Column(DateTime, default=datetime.utcnow)
    acked_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    result = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    
    initiated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="command_history")
    command = relationship("Command", back_populates="executions")


class DeviceTelemetry(Base):
    """
    Device Telemetry - Time-series data from devices.
    High-frequency storage for device measurements.
    """
    __tablename__ = "device_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    datapoint_id = Column(Integer, ForeignKey("datapoints.id"), nullable=True, index=True)
    
    timestamp = Column(DateTime, nullable=False, index=True)
    value = Column(Float, nullable=True)
    string_value = Column(String(255), nullable=True)
    quality = Column(String(20), default="good")
    
    raw_value = Column(Float, nullable=True)
    edge_key = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="telemetry")

    __table_args__ = (
        Index("ix_telemetry_device_time", "device_id", "timestamp"),
    )


class ProductRegisterMapping(Base):
    """
    Product Register Mapping - Modbus register definitions for a product.
    Defines how to read/write data from the physical device.
    """
    __tablename__ = "product_register_mappings"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("device_products.id", ondelete="CASCADE"), nullable=False, index=True)
    datapoint_name = Column(String(100), nullable=False)
    
    register_address = Column(Integer, nullable=False)
    register_type = Column(String(20), default="holding")
    data_type = Column(String(20), default="uint16")
    byte_order = Column(String(20), default="big_endian")
    register_count = Column(Integer, default=1)
    
    scale_factor = Column(Float, default=1.0)
    offset = Column(Float, default=0.0)
    
    function_code_read = Column(Integer, default=3)
    function_code_write = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("DeviceProduct", back_populates="register_mappings")

    __table_args__ = (
        UniqueConstraint("product_id", "datapoint_name", name="uq_product_register_datapoint"),
    )


class RemoteModbusConfig(Base):
    """
    Remote Modbus Configuration - Peripheral device settings pushed to gateways.
    Enables remote configuration of Modbus devices through their gateway.
    """
    __tablename__ = "remote_modbus_configs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id"), nullable=False, index=True)
    
    slave_id = Column(Integer, nullable=False)
    protocol = Column(String(20), default="modbus_tcp")
    host = Column(String(255), nullable=True)
    port = Column(Integer, default=502)
    serial_port = Column(String(100), nullable=True)
    baudrate = Column(Integer, default=9600)
    parity = Column(String(1), default="N")
    stopbits = Column(Integer, default=1)
    
    polling_interval_ms = Column(Integer, default=1000)
    timeout_ms = Column(Integer, default=5000)
    retries = Column(Integer, default=3)
    
    register_config = Column(Text, nullable=True)
    
    sync_status = Column(Enum(ConfigSyncStatus), default=ConfigSyncStatus.PENDING)
    last_synced_at = Column(DateTime, nullable=True)
    sync_error = Column(Text, nullable=True)
    
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("gateway_id", "slave_id", name="uq_gateway_slave"),
    )


class DeviceEvent(Base):
    """
    Device Event - Events/alarms received from devices.
    """
    __tablename__ = "device_events"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    alarm_rule_id = Column(Integer, ForeignKey("alarm_rules.id"), nullable=True, index=True)
    
    event_type = Column(String(50), nullable=False)
    severity = Column(Enum(AlarmSeverity), default=AlarmSeverity.INFO)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    data = Column(Text, nullable=True)
    
    triggered_at = Column(DateTime, default=datetime.utcnow)
    cleared_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    is_active = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_device_event_time", "device_id", "triggered_at"),
    )
