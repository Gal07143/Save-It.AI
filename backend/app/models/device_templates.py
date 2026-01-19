"""
Device Templates and Register Mappings for SAVE-IT.AI
Pre-configured templates for common energy devices (meters, inverters, BESS, etc.)
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, ForeignKey, Enum as SQLEnum, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum

from .base import Base


class DeviceCategory(str, PyEnum):
    """Categories of devices."""
    ENERGY_METER = "energy_meter"
    POWER_METER = "power_meter"
    INVERTER = "inverter"
    BESS = "bess"
    BMS = "bms"
    EV_CHARGER = "ev_charger"
    HVAC = "hvac"
    SENSOR = "sensor"
    PLC = "plc"
    GATEWAY = "gateway"


class ProtocolType(str, PyEnum):
    """Communication protocol types."""
    MODBUS_TCP = "modbus_tcp"
    MODBUS_RTU = "modbus_rtu"
    MQTT = "mqtt"
    BACNET = "bacnet"
    OPCUA = "opcua"
    HTTPS = "https"


class RegisterDataType(str, PyEnum):
    """Modbus register data types."""
    INT16 = "int16"
    UINT16 = "uint16"
    INT32 = "int32"
    UINT32 = "uint32"
    INT64 = "int64"
    UINT64 = "uint64"
    FLOAT32 = "float32"
    FLOAT64 = "float64"
    STRING = "string"
    BOOLEAN = "boolean"


class RegisterEndianness(str, PyEnum):
    """Register byte order."""
    BIG = "big"
    LITTLE = "little"
    BIG_SWAP = "big_swap"
    LITTLE_SWAP = "little_swap"


class DeviceManufacturer(Base):
    """Device manufacturer information."""
    __tablename__ = "device_manufacturers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    country = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    support_email = Column(String(255), nullable=True)
    support_phone = Column(String(50), nullable=True)
    logo_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    templates = relationship("DeviceTemplate", back_populates="manufacturer")


class DeviceTemplate(Base):
    """Device template with register mappings."""
    __tablename__ = "device_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    manufacturer_id = Column(Integer, ForeignKey("device_manufacturers.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    model_number = Column(String(100), nullable=True)
    category = Column(SQLEnum(DeviceCategory), nullable=False, index=True)
    protocol = Column(SQLEnum(ProtocolType), nullable=False, index=True)
    description = Column(Text, nullable=True)
    firmware_version = Column(String(50), nullable=True)
    
    default_port = Column(Integer, nullable=True)
    default_slave_id = Column(Integer, default=1)
    default_polling_interval = Column(Integer, default=60)
    default_timeout = Column(Float, default=5.0)
    
    default_endianness = Column(SQLEnum(RegisterEndianness), default=RegisterEndianness.BIG)
    
    mqtt_topic_template = Column(String(500), nullable=True)
    
    datasheet_url = Column(String(500), nullable=True)
    manual_url = Column(String(500), nullable=True)
    
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(Integer, nullable=True)
    
    manufacturer = relationship("DeviceManufacturer", back_populates="templates")
    register_mappings = relationship("RegisterMapping", back_populates="template", cascade="all, delete-orphan")


class RegisterMapping(Base):
    """Individual register mapping for a device template."""
    __tablename__ = "register_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("device_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    
    register_address = Column(Integer, nullable=False)
    register_count = Column(Integer, default=1)
    function_code = Column(Integer, default=3)
    data_type = Column(SQLEnum(RegisterDataType), nullable=False)
    endianness = Column(SQLEnum(RegisterEndianness), nullable=True)
    
    scale_factor = Column(Float, default=1.0)
    offset = Column(Float, default=0.0)
    
    unit = Column(String(50), nullable=True)
    
    min_value = Column(Float, nullable=True)
    max_value = Column(Float, nullable=True)
    
    is_writable = Column(Boolean, default=False)
    is_required = Column(Boolean, default=True)
    
    category = Column(String(50), nullable=True)
    display_order = Column(Integer, default=0)
    
    value_map = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    template = relationship("DeviceTemplate", back_populates="register_mappings")


class GatewayCredentials(Base):
    """Gateway authentication credentials for all protocols."""
    __tablename__ = "gateway_credentials"
    
    id = Column(Integer, primary_key=True, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id", ondelete="CASCADE"), nullable=False, index=True)
    
    mqtt_username = Column(String(255), nullable=True)
    mqtt_password_hash = Column(String(255), nullable=True)
    mqtt_client_id = Column(String(255), nullable=True)
    mqtt_topics = Column(JSON, nullable=True)
    
    webhook_api_key = Column(String(255), nullable=True, unique=True)
    webhook_secret_key = Column(String(255), nullable=True)
    
    api_token = Column(String(500), nullable=True, unique=True)
    api_token_expires_at = Column(DateTime, nullable=True)
    
    last_rotated = Column(DateTime, nullable=True)
    rotation_interval_days = Column(Integer, default=90)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GatewayHeartbeat(Base):
    """Gateway heartbeat and connection status tracking."""
    __tablename__ = "gateway_heartbeats"
    
    id = Column(Integer, primary_key=True, index=True)
    gateway_id = Column(Integer, ForeignKey("gateways.id", ondelete="CASCADE"), nullable=False, index=True)
    
    protocol = Column(SQLEnum(ProtocolType), nullable=False)
    status = Column(String(20), default="unknown")
    
    last_seen = Column(DateTime, nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    
    ip_address = Column(String(45), nullable=True)
    client_version = Column(String(50), nullable=True)
    
    messages_received = Column(Integer, default=0)
    messages_failed = Column(Integer, default=0)
    
    error_message = Column(Text, nullable=True)
    error_count = Column(Integer, default=0)
    consecutive_failures = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
