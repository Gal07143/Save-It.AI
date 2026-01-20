"""
Pydantic Schemas for Device Management
Implements request/response models for Zoho IoT-style device architecture.
"""
from datetime import datetime
from typing import Optional, List, Any, Dict
from enum import Enum
from pydantic import BaseModel, Field, ConfigDict


class DeviceTypeEnum(str, Enum):
    GATEWAY = "gateway"
    PERIPHERAL = "peripheral"
    SMART_SENSOR = "smart_sensor"
    API_ENDPOINT = "api_endpoint"


class AuthTypeEnum(str, Enum):
    TOKEN = "token"
    TOKEN_TLS = "token_tls"
    CERTIFICATE = "certificate"
    API_KEY = "api_key"


class ConfigSyncStatusEnum(str, Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    FAILED = "failed"


class DatapointTypeEnum(str, Enum):
    INT = "int"
    FLOAT = "float"
    BOOLEAN = "boolean"
    STRING = "string"
    ENUM = "enum"


class DatapointAggregationEnum(str, Enum):
    NONE = "none"
    SUM = "sum"
    AVG = "avg"
    MIN = "min"
    MAX = "max"
    COUNT = "count"
    LAST = "last"


class CommandInputTypeEnum(str, Enum):
    TOGGLE = "toggle"
    SLIDER = "slider"
    BUTTON = "button"
    NUMERIC = "numeric"
    SELECT = "select"
    TEXT = "text"


class AlarmSeverityEnum(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlarmConditionEnum(str, Enum):
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


class DeviceModelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    version: str = "1.0.0"
    is_system_model: bool = False
    auto_propagate: bool = True
    icon: Optional[str] = None
    color: Optional[str] = None


class DeviceModelCreate(DeviceModelBase):
    pass


class DeviceModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    version: Optional[str] = None
    auto_propagate: Optional[bool] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class DeviceModelResponse(DeviceModelBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    datapoint_count: Optional[int] = None
    command_count: Optional[int] = None
    device_count: Optional[int] = None


class DeviceProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    manufacturer: str = Field(..., min_length=1, max_length=100)
    model_number: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    device_type: DeviceTypeEnum = DeviceTypeEnum.PERIPHERAL
    protocol: str = "modbus_tcp"
    default_port: Optional[int] = None
    default_slave_id: int = 1
    firmware_version: Optional[str] = None
    hardware_version: Optional[str] = None
    message_formatter: Optional[str] = None
    config_schema: Optional[str] = None
    image_url: Optional[str] = None
    datasheet_url: Optional[str] = None


class DeviceProductCreate(DeviceProductBase):
    model_id: Optional[int] = None


class DeviceProductUpdate(BaseModel):
    name: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None
    device_type: Optional[DeviceTypeEnum] = None
    protocol: Optional[str] = None
    default_port: Optional[int] = None
    default_slave_id: Optional[int] = None
    firmware_version: Optional[str] = None
    message_formatter: Optional[str] = None
    image_url: Optional[str] = None
    model_id: Optional[int] = None
    is_active: Optional[bool] = None


class DeviceProductResponse(DeviceProductBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    model_id: Optional[int] = None
    is_verified: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class DatapointBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = None
    description: Optional[str] = None
    data_type: DatapointTypeEnum = DatapointTypeEnum.FLOAT
    unit: Optional[str] = None
    aggregation: DatapointAggregationEnum = DatapointAggregationEnum.LAST
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    precision: int = 2
    scale_factor: float = 1.0
    offset: float = 0.0
    is_readable: bool = True
    is_writable: bool = False
    is_required: bool = False
    enum_values: Optional[str] = None
    default_value: Optional[str] = None
    category: Optional[str] = None
    display_order: int = 0
    icon: Optional[str] = None


class DatapointCreate(DatapointBase):
    model_id: int


class DatapointUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    data_type: Optional[DatapointTypeEnum] = None
    unit: Optional[str] = None
    aggregation: Optional[DatapointAggregationEnum] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    precision: Optional[int] = None
    scale_factor: Optional[float] = None
    offset: Optional[float] = None
    is_readable: Optional[bool] = None
    is_writable: Optional[bool] = None
    category: Optional[str] = None
    display_order: Optional[int] = None


class DatapointResponse(DatapointBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    model_id: int
    created_at: datetime
    updated_at: datetime


class CommandBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_name: Optional[str] = None
    description: Optional[str] = None
    input_type: CommandInputTypeEnum = CommandInputTypeEnum.BUTTON
    parameters_schema: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    step: Optional[float] = None
    enum_options: Optional[str] = None
    timeout_seconds: int = 30
    requires_confirmation: bool = False
    is_dangerous: bool = False
    category: Optional[str] = None
    display_order: int = 0
    icon: Optional[str] = None


class CommandCreate(CommandBase):
    model_id: int


class CommandUpdate(BaseModel):
    name: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    input_type: Optional[CommandInputTypeEnum] = None
    parameters_schema: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    timeout_seconds: Optional[int] = None
    requires_confirmation: Optional[bool] = None
    is_dangerous: Optional[bool] = None
    category: Optional[str] = None
    display_order: Optional[int] = None


class CommandResponse(CommandBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    model_id: int
    created_at: datetime
    updated_at: datetime


class AlarmRuleBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    condition: AlarmConditionEnum
    threshold_value: Optional[float] = None
    threshold_value_2: Optional[float] = None
    duration_seconds: int = 0
    severity: AlarmSeverityEnum = AlarmSeverityEnum.WARNING
    is_active: bool = True
    auto_clear: bool = True
    notification_channels: Optional[str] = None
    action_on_trigger: Optional[str] = None
    action_on_clear: Optional[str] = None


class AlarmRuleCreate(AlarmRuleBase):
    model_id: int
    datapoint_id: Optional[int] = None


class AlarmRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[AlarmConditionEnum] = None
    threshold_value: Optional[float] = None
    threshold_value_2: Optional[float] = None
    duration_seconds: Optional[int] = None
    severity: Optional[AlarmSeverityEnum] = None
    is_active: Optional[bool] = None
    auto_clear: Optional[bool] = None
    notification_channels: Optional[str] = None


class AlarmRuleResponse(AlarmRuleBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    model_id: int
    datapoint_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class DevicePolicyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    allow_telemetry: bool = True
    allow_events: bool = True
    allow_commands: bool = False
    allow_config: bool = False
    allow_firmware: bool = False
    max_message_size_kb: int = 256
    max_messages_per_minute: int = 60


class DevicePolicyCreate(DevicePolicyBase):
    pass


class DevicePolicyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    allow_telemetry: Optional[bool] = None
    allow_events: Optional[bool] = None
    allow_commands: Optional[bool] = None
    allow_config: Optional[bool] = None
    allow_firmware: Optional[bool] = None
    max_message_size_kb: Optional[int] = None
    max_messages_per_minute: Optional[int] = None
    is_active: Optional[bool] = None


class DevicePolicyResponse(DevicePolicyBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    is_system_policy: bool = False
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class DeviceCertificateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class DeviceCertificateCreate(DeviceCertificateBase):
    policy_id: Optional[int] = None
    validity_days: int = 3650


class DeviceCertificateResponse(DeviceCertificateBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    policy_id: Optional[int] = None
    serial_number: str
    thumbprint: str
    issued_at: datetime
    expires_at: datetime
    issuer: Optional[str] = None
    subject: Optional[str] = None
    is_revoked: bool = False
    revoked_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime


class DeviceCertificateDownload(BaseModel):
    certificate_pem: str
    private_key_pem: str
    ca_certificate_pem: str
    serial_number: str


class DeviceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    device_type: DeviceTypeEnum
    serial_number: Optional[str] = None
    edge_key: Optional[str] = None
    auth_type: AuthTypeEnum = AuthTypeEnum.TOKEN
    ip_address: Optional[str] = None
    port: Optional[int] = None
    slave_id: Optional[int] = None
    firmware_version: Optional[str] = None
    hardware_version: Optional[str] = None
    config_json: Optional[str] = None


class DeviceCreate(DeviceBase):
    site_id: int
    model_id: Optional[int] = None
    product_id: Optional[int] = None
    gateway_id: Optional[int] = None
    asset_id: Optional[int] = None
    policy_id: Optional[int] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    serial_number: Optional[str] = None
    edge_key: Optional[str] = None
    auth_type: Optional[AuthTypeEnum] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    slave_id: Optional[int] = None
    firmware_version: Optional[str] = None
    config_json: Optional[str] = None
    model_id: Optional[int] = None
    product_id: Optional[int] = None
    gateway_id: Optional[int] = None
    asset_id: Optional[int] = None
    policy_id: Optional[int] = None
    is_active: Optional[bool] = None


class DeviceCredentials(BaseModel):
    device_id: int
    device_type: DeviceTypeEnum
    auth_type: AuthTypeEnum
    mqtt_broker_url: Optional[str] = None
    mqtt_client_id: Optional[str] = None
    mqtt_username: Optional[str] = None
    mqtt_password: Optional[str] = None
    mqtt_topics: Optional[Dict[str, str]] = None
    webhook_url: Optional[str] = None
    webhook_api_key: Optional[str] = None
    webhook_secret_key: Optional[str] = None
    api_token: Optional[str] = None


class DeviceResponse(DeviceBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    site_id: int
    model_id: Optional[int] = None
    product_id: Optional[int] = None
    gateway_id: Optional[int] = None
    asset_id: Optional[int] = None
    policy_id: Optional[int] = None
    certificate_id: Optional[int] = None
    config_sync_status: ConfigSyncStatusEnum = ConfigSyncStatusEnum.PENDING
    config_last_synced_at: Optional[datetime] = None
    is_active: bool = True
    is_online: bool = False
    last_seen_at: Optional[datetime] = None
    last_telemetry_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    model_name: Optional[str] = None
    product_name: Optional[str] = None
    gateway_name: Optional[str] = None
    asset_name: Optional[str] = None


class DeviceOnboardingRequest(BaseModel):
    site_id: int
    name: str = Field(..., min_length=1, max_length=255)
    device_type: DeviceTypeEnum
    product_id: Optional[int] = None
    model_id: Optional[int] = None
    gateway_id: Optional[int] = None
    edge_key: Optional[str] = None
    asset_id: Optional[int] = None
    auth_type: AuthTypeEnum = AuthTypeEnum.TOKEN
    policy_id: Optional[int] = None
    ip_address: Optional[str] = None
    port: Optional[int] = None
    slave_id: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None


class DeviceOnboardingResponse(BaseModel):
    device: DeviceResponse
    credentials: DeviceCredentials
    model: Optional[DeviceModelResponse] = None
    product: Optional[DeviceProductResponse] = None


class CommandExecutionRequest(BaseModel):
    command_id: int
    parameters: Optional[Dict[str, Any]] = None


class CommandExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    device_id: int
    command_id: int
    correlation_id: str
    parameters: Optional[str] = None
    status: str = "pending"
    sent_at: datetime
    acked_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    result: Optional[str] = None
    error_message: Optional[str] = None


class DeviceTelemetryData(BaseModel):
    datapoint: str
    value: Any
    timestamp: Optional[datetime] = None
    quality: str = "good"


class DeviceTelemetryBatch(BaseModel):
    device_id: Optional[int] = None
    edge_key: Optional[str] = None
    timestamp: Optional[datetime] = None
    data: List[DeviceTelemetryData]


class DeviceEventData(BaseModel):
    event_type: str
    severity: AlarmSeverityEnum = AlarmSeverityEnum.INFO
    title: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class ProductRegisterMappingBase(BaseModel):
    datapoint_name: str = Field(..., min_length=1, max_length=100)
    register_address: int
    register_type: str = "holding"
    data_type: str = "uint16"
    byte_order: str = "big_endian"
    register_count: int = 1
    scale_factor: float = 1.0
    offset: float = 0.0
    function_code_read: int = 3
    function_code_write: Optional[int] = None


class ProductRegisterMappingCreate(ProductRegisterMappingBase):
    product_id: int


class ProductRegisterMappingResponse(ProductRegisterMappingBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    product_id: int
    created_at: datetime


class RemoteModbusConfigBase(BaseModel):
    slave_id: int
    protocol: str = "modbus_tcp"
    host: Optional[str] = None
    port: int = 502
    serial_port: Optional[str] = None
    baudrate: int = 9600
    parity: str = "N"
    stopbits: int = 1
    polling_interval_ms: int = 1000
    timeout_ms: int = 5000
    retries: int = 3
    register_config: Optional[str] = None


class RemoteModbusConfigCreate(RemoteModbusConfigBase):
    device_id: int
    gateway_id: int


class RemoteModbusConfigUpdate(BaseModel):
    slave_id: Optional[int] = None
    protocol: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    polling_interval_ms: Optional[int] = None
    timeout_ms: Optional[int] = None
    retries: Optional[int] = None
    register_config: Optional[str] = None
    is_active: Optional[bool] = None


class RemoteModbusConfigResponse(RemoteModbusConfigBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    device_id: int
    gateway_id: int
    sync_status: ConfigSyncStatusEnum = ConfigSyncStatusEnum.PENDING
    last_synced_at: Optional[datetime] = None
    sync_error: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
