"""Pydantic schemas for integration layer: Gateway, DeviceTemplate, ModbusRegister."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class GatewayStatusEnum(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    ERROR = "error"
    CONFIGURING = "configuring"


class RegisterTypeEnum(str, Enum):
    HOLDING = "holding"
    INPUT = "input"
    COIL = "coil"
    DISCRETE = "discrete"


class DataTypeEnum(str, Enum):
    INT16 = "int16"
    UINT16 = "uint16"
    INT32 = "int32"
    UINT32 = "uint32"
    FLOAT32 = "float32"
    FLOAT64 = "float64"
    STRING = "string"
    BOOLEAN = "boolean"


class ByteOrderEnum(str, Enum):
    BIG_ENDIAN = "big_endian"
    LITTLE_ENDIAN = "little_endian"
    BIG_ENDIAN_SWAP = "big_endian_swap"
    LITTLE_ENDIAN_SWAP = "little_endian_swap"


class GatewayBase(BaseModel):
    name: str
    description: Optional[str] = None
    serial_number: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    firmware_version: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    heartbeat_interval_seconds: int = 60
    is_active: bool = True
    config_json: Optional[str] = None


class GatewayCreate(GatewayBase):
    site_id: int


class GatewayUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ip_address: Optional[str] = None
    firmware_version: Optional[str] = None
    heartbeat_interval_seconds: Optional[int] = None
    is_active: Optional[bool] = None
    config_json: Optional[str] = None


class GatewayResponse(GatewayBase):
    id: int
    site_id: int
    status: GatewayStatusEnum = GatewayStatusEnum.OFFLINE
    last_seen_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateRegisterBase(BaseModel):
    name: str
    description: Optional[str] = None
    register_address: int
    register_type: RegisterTypeEnum = RegisterTypeEnum.HOLDING
    data_type: DataTypeEnum = DataTypeEnum.UINT16
    byte_order: ByteOrderEnum = ByteOrderEnum.BIG_ENDIAN
    register_count: int = 1
    scale_factor: float = 1.0
    offset: float = 0.0
    unit: Optional[str] = None
    is_writable: bool = False
    display_order: int = 0
    category: Optional[str] = None


class TemplateRegisterCreate(TemplateRegisterBase):
    template_id: int


class TemplateRegisterResponse(TemplateRegisterBase):
    id: int
    template_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceTemplateBase(BaseModel):
    name: str
    manufacturer: str
    model: str
    description: Optional[str] = None
    protocol: str = "modbus_tcp"
    default_port: int = 502
    default_slave_id: int = 1
    is_system_template: bool = False
    is_active: bool = True


class DeviceTemplateCreate(DeviceTemplateBase):
    pass


class DeviceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_port: Optional[int] = None
    default_slave_id: Optional[int] = None
    is_active: Optional[bool] = None


class DeviceTemplateResponse(DeviceTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    template_registers: List[TemplateRegisterResponse] = []

    class Config:
        from_attributes = True


class DeviceTemplateListResponse(DeviceTemplateBase):
    id: int
    created_at: datetime
    register_count: int = 0

    class Config:
        from_attributes = True


class ModbusRegisterBase(BaseModel):
    name: str
    description: Optional[str] = None
    register_address: int
    register_type: RegisterTypeEnum = RegisterTypeEnum.HOLDING
    data_type: DataTypeEnum = DataTypeEnum.UINT16
    byte_order: ByteOrderEnum = ByteOrderEnum.BIG_ENDIAN
    register_count: int = 1
    scale_factor: float = 1.0
    offset: float = 0.0
    unit: Optional[str] = None
    is_writable: bool = False
    is_active: bool = True
    poll_priority: int = 1


class ModbusRegisterCreate(ModbusRegisterBase):
    data_source_id: int
    meter_id: Optional[int] = None


class ModbusRegisterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    register_address: Optional[int] = None
    register_type: Optional[RegisterTypeEnum] = None
    data_type: Optional[DataTypeEnum] = None
    byte_order: Optional[ByteOrderEnum] = None
    register_count: Optional[int] = None
    scale_factor: Optional[float] = None
    offset: Optional[float] = None
    unit: Optional[str] = None
    is_writable: Optional[bool] = None
    is_active: Optional[bool] = None
    poll_priority: Optional[int] = None


class ModbusRegisterResponse(ModbusRegisterBase):
    id: int
    data_source_id: int
    meter_id: Optional[int] = None
    last_value: Optional[float] = None
    last_read_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CommunicationLogBase(BaseModel):
    event_type: str
    status: str
    message: Optional[str] = None
    request_count: int = 0
    success_count: int = 0
    error_count: int = 0
    avg_response_time_ms: Optional[float] = None


class CommunicationLogCreate(CommunicationLogBase):
    gateway_id: Optional[int] = None
    data_source_id: Optional[int] = None


class CommunicationLogResponse(CommunicationLogBase):
    id: int
    gateway_id: Optional[int] = None
    data_source_id: Optional[int] = None
    timestamp: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ConnectionTestRequest(BaseModel):
    host: str
    port: int = 502
    slave_id: int = 1
    timeout_seconds: float = 5.0


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    response_time_ms: Optional[float] = None
    device_info: Optional[dict] = None


class RegisterReadRequest(BaseModel):
    data_source_id: int
    register_ids: Optional[List[int]] = None


class RegisterReadResponse(BaseModel):
    register_id: int
    name: str
    address: int
    raw_value: Optional[float] = None
    scaled_value: Optional[float] = None
    unit: Optional[str] = None
    quality: str = "good"
    read_at: datetime
    error: Optional[str] = None


class CommunicationHealthSummary(BaseModel):
    gateway_id: Optional[int] = None
    data_source_id: Optional[int] = None
    name: str
    status: str
    last_seen: Optional[datetime] = None
    total_requests_24h: int = 0
    success_rate_24h: float = 0.0
    avg_response_time_ms: Optional[float] = None
    error_count_24h: int = 0
    last_error: Optional[str] = None


class ApplyTemplateRequest(BaseModel):
    data_source_id: int
    template_id: int
    meter_id: Optional[int] = None
