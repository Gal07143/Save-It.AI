"""Integration models: Gateway, DeviceTemplate, ModbusRegister, CommunicationLog."""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text, Boolean
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class GatewayStatus(PyEnum):
    """Status of a data collection gateway."""
    ONLINE = "online"
    OFFLINE = "offline"
    ERROR = "error"
    CONFIGURING = "configuring"


class RegisterType(PyEnum):
    """Modbus register types."""
    HOLDING = "holding"
    INPUT = "input"
    COIL = "coil"
    DISCRETE = "discrete"


class DataType(PyEnum):
    """Data types for register values."""
    INT16 = "int16"
    UINT16 = "uint16"
    INT32 = "int32"
    UINT32 = "uint32"
    FLOAT32 = "float32"
    FLOAT64 = "float64"
    STRING = "string"
    BOOLEAN = "boolean"


class ByteOrder(PyEnum):
    """Byte order for multi-register values."""
    BIG_ENDIAN = "big_endian"
    LITTLE_ENDIAN = "little_endian"
    BIG_ENDIAN_SWAP = "big_endian_swap"
    LITTLE_ENDIAN_SWAP = "little_endian_swap"


class Gateway(Base):
    """Gateway model for data collection devices that aggregate multiple meters."""
    __tablename__ = "gateways"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    serial_number = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(17), nullable=True)
    firmware_version = Column(String(50), nullable=True)
    model = Column(String(100), nullable=True)
    manufacturer = Column(String(100), nullable=True)
    status = Column(Enum(GatewayStatus), default=GatewayStatus.OFFLINE)
    last_seen_at = Column(DateTime, nullable=True)
    heartbeat_interval_seconds = Column(Integer, default=60)
    is_active = Column(Integer, default=1)
    config_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    communication_logs = relationship("CommunicationLog", back_populates="gateway", cascade="all, delete-orphan")


class DeviceTemplate(Base):
    """DeviceTemplate model for pre-configured register maps for common meters."""
    __tablename__ = "device_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    manufacturer = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    protocol = Column(String(50), default="modbus_tcp")
    default_port = Column(Integer, default=502)
    default_slave_id = Column(Integer, default=1)
    is_system_template = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    template_registers = relationship("TemplateRegister", back_populates="template", cascade="all, delete-orphan")


class TemplateRegister(Base):
    """TemplateRegister model for register definitions in device templates."""
    __tablename__ = "template_registers"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("device_templates.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    register_address = Column(Integer, nullable=False)
    register_type = Column(Enum(RegisterType), default=RegisterType.HOLDING)
    data_type = Column(Enum(DataType), default=DataType.UINT16)
    byte_order = Column(Enum(ByteOrder), default=ByteOrder.BIG_ENDIAN)
    register_count = Column(Integer, default=1)
    scale_factor = Column(Float, default=1.0)
    offset = Column(Float, default=0.0)
    unit = Column(String(50), nullable=True)
    is_writable = Column(Integer, default=0)
    display_order = Column(Integer, default=0)
    category = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("DeviceTemplate", back_populates="template_registers")


class ModbusRegister(Base):
    """ModbusRegister model for configured registers on a specific data source."""
    __tablename__ = "modbus_registers"

    id = Column(Integer, primary_key=True, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=False, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    register_address = Column(Integer, nullable=False)
    register_type = Column(Enum(RegisterType), default=RegisterType.HOLDING)
    data_type = Column(Enum(DataType), default=DataType.UINT16)
    byte_order = Column(Enum(ByteOrder), default=ByteOrder.BIG_ENDIAN)
    register_count = Column(Integer, default=1)
    scale_factor = Column(Float, default=1.0)
    offset = Column(Float, default=0.0)
    unit = Column(String(50), nullable=True)
    is_writable = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    last_value = Column(Float, nullable=True)
    last_read_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    poll_priority = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CommunicationLog(Base):
    """CommunicationLog model for tracking device communication health."""
    __tablename__ = "communication_logs"

    id = Column(Integer, primary_key=True, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id"), nullable=True, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    event_type = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    message = Column(Text, nullable=True)
    request_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    gateway = relationship("Gateway", back_populates="communication_logs")


class ValidationRuleType(PyEnum):
    """Types of data validation rules."""
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    RATE_OF_CHANGE = "rate_of_change"
    STALE_DATA = "stale_data"
    RANGE = "range"


class ValidationSeverity(PyEnum):
    """Severity levels for validation rule violations."""
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class DataValidationRule(Base):
    """DataValidationRule model for defining min/max/rate-of-change checks on incoming data."""
    __tablename__ = "data_validation_rules"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=True, index=True)
    register_id = Column(Integer, ForeignKey("modbus_registers.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(Enum(ValidationRuleType), nullable=False)
    severity = Column(Enum(ValidationSeverity), default=ValidationSeverity.WARNING)
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    rate_of_change_max = Column(Float, nullable=True)
    rate_of_change_period_seconds = Column(Integer, nullable=True)
    stale_threshold_seconds = Column(Integer, nullable=True)
    is_active = Column(Integer, default=1)
    action_on_violation = Column(String(50), default="log")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ValidationViolation(Base):
    """ValidationViolation model for tracking validation rule violations."""
    __tablename__ = "validation_violations"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("data_validation_rules.id"), nullable=False, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=True, index=True)
    register_id = Column(Integer, ForeignKey("modbus_registers.id"), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    actual_value = Column(Float, nullable=True)
    expected_min = Column(Float, nullable=True)
    expected_max = Column(Float, nullable=True)
    previous_value = Column(Float, nullable=True)
    violation_message = Column(Text, nullable=True)
    is_acknowledged = Column(Integer, default=0)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceGroup(Base):
    """DeviceGroup model for organizing devices into logical groups/zones."""
    __tablename__ = "device_groups"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    group_type = Column(String(50), default="zone")
    parent_group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=True)
    color = Column(String(7), nullable=True)
    icon = Column(String(50), nullable=True)
    display_order = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DeviceGroupMember(Base):
    """DeviceGroupMember model for linking data sources to groups."""
    __tablename__ = "device_group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("device_groups.id"), nullable=False, index=True)
    data_source_id = Column(Integer, ForeignKey("data_sources.id"), nullable=False, index=True)
    added_at = Column(DateTime, default=datetime.utcnow)
