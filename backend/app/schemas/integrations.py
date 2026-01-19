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


class BulkDeviceImportRow(BaseModel):
    """Single device row for bulk import."""
    name: str
    protocol: str = "modbus_tcp"
    host: Optional[str] = None
    port: int = 502
    slave_id: int = 1
    location: Optional[str] = None
    template_name: Optional[str] = None
    gateway_name: Optional[str] = None
    description: Optional[str] = None


class BulkDeviceImportRequest(BaseModel):
    """Bulk device import request."""
    site_id: int
    devices: List[BulkDeviceImportRow]


class BulkImportResultRow(BaseModel):
    """Result for a single device import."""
    row_number: int
    name: str
    success: bool
    data_source_id: Optional[int] = None
    error: Optional[str] = None


class BulkDeviceImportResponse(BaseModel):
    """Bulk device import response."""
    total: int
    successful: int
    failed: int
    results: List[BulkImportResultRow]


class DeviceGroupBase(BaseModel):
    """Device group for organizing devices."""
    name: str
    description: Optional[str] = None
    group_type: str = "zone"
    color: str = "#3b82f6"
    icon: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class DeviceGroupCreate(DeviceGroupBase):
    site_id: int
    parent_group_id: Optional[int] = None


class DeviceGroupResponse(DeviceGroupBase):
    id: int
    site_id: int
    parent_group_id: Optional[int] = None
    device_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeviceHealthSummary(BaseModel):
    """Health summary for a single device."""
    data_source_id: int
    name: str
    protocol: str
    status: str  # online, offline, error, unknown
    last_communication: Optional[datetime] = None
    success_rate_24h: float = 0.0
    avg_response_time_ms: Optional[float] = None
    error_count_24h: int = 0
    last_error: Optional[str] = None
    firmware_version: Optional[str] = None


class DeviceHealthDashboard(BaseModel):
    """Overall device health dashboard."""
    total_devices: int
    online_count: int
    offline_count: int
    error_count: int
    unknown_count: int
    overall_success_rate: float
    devices: List[DeviceHealthSummary]


class ValidationRuleTypeEnum(str, Enum):
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    RATE_OF_CHANGE = "rate_of_change"
    STALE_DATA = "stale_data"
    RANGE = "range"


class ValidationSeverityEnum(str, Enum):
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class DataValidationRuleBase(BaseModel):
    """Base schema for data validation rules."""
    name: str
    description: Optional[str] = None
    rule_type: ValidationRuleTypeEnum
    severity: ValidationSeverityEnum = ValidationSeverityEnum.WARNING
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    rate_of_change_max: Optional[float] = None
    rate_of_change_period_seconds: Optional[int] = None
    stale_threshold_seconds: Optional[int] = None
    is_active: bool = True
    action_on_violation: str = "log"


class DataValidationRuleCreate(DataValidationRuleBase):
    site_id: int
    data_source_id: Optional[int] = None
    register_id: Optional[int] = None


class DataValidationRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[ValidationSeverityEnum] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    rate_of_change_max: Optional[float] = None
    rate_of_change_period_seconds: Optional[int] = None
    stale_threshold_seconds: Optional[int] = None
    is_active: Optional[bool] = None
    action_on_violation: Optional[str] = None


class DataValidationRuleResponse(DataValidationRuleBase):
    id: int
    site_id: int
    data_source_id: Optional[int] = None
    register_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ValidationViolationResponse(BaseModel):
    """Response schema for validation violations."""
    id: int
    rule_id: int
    data_source_id: Optional[int] = None
    register_id: Optional[int] = None
    timestamp: datetime
    actual_value: Optional[float] = None
    expected_min: Optional[float] = None
    expected_max: Optional[float] = None
    previous_value: Optional[float] = None
    violation_message: Optional[str] = None
    is_acknowledged: bool = False
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    group_type: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class DeviceGroupMemberCreate(BaseModel):
    group_id: int
    data_source_id: int


class DeviceGroupMemberResponse(BaseModel):
    id: int
    group_id: int
    data_source_id: int
    added_at: datetime

    class Config:
        from_attributes = True


class RetryConfigUpdate(BaseModel):
    """Schema for updating retry configuration."""
    max_retries: Optional[int] = None
    retry_delay_seconds: Optional[int] = None
    backoff_multiplier: Optional[float] = None


class RetryStatusResponse(BaseModel):
    """Response schema for retry status."""
    data_source_id: int
    name: str
    connection_status: str
    current_retry_count: int
    max_retries: int
    retry_delay_seconds: int
    backoff_multiplier: float
    next_retry_at: Optional[datetime] = None
    last_error: Optional[str] = None
    last_poll_at: Optional[datetime] = None
    last_successful_poll_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConnectionAttemptResult(BaseModel):
    """Result of a connection attempt."""
    success: bool
    error_message: Optional[str] = None
    next_retry_at: Optional[datetime] = None
    current_retry_count: int = 0


class RetryQueueItem(BaseModel):
    """Item in the retry queue."""
    data_source_id: int
    name: str
    connection_status: str
    next_retry_at: Optional[datetime] = None
    current_retry_count: int
    max_retries: int
    last_error: Optional[str] = None
