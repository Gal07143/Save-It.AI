"""Pydantic schemas for request/response validation."""

from backend.app.schemas.base import (
    BaseModel,
    Field,
    ConfigDict,
    datetime,
    date,
    time,
    Optional,
    List,
    Dict,
    Any,
)

from backend.app.schemas.core import (
    AssetType,
    NotificationType,
    SiteCreate,
    SiteUpdate,
    SiteResponse,
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetTreeNode,
    MeterCreate,
    MeterUpdate,
    MeterResponse,
    MeterReadingCreate,
    MeterReadingResponse,
    BillLineItemCreate,
    BillLineItemResponse,
    BillCreate,
    BillUpdate,
    BillResponse,
    BillValidationResult,
    UnmeteredAsset,
    GapAnalysisResult,
    NotificationCreate,
    NotificationResponse,
    TariffRateCreate,
    TariffRateResponse,
    TariffCreate,
    TariffUpdate,
    TariffResponse,
    SolarROIInput,
    SolarROIResult,
)

from backend.app.schemas.enterprise import (
    DataSourceType,
    InvoiceStatus,
    DataSourceCreate,
    DataSourceResponse,
    MeasurementCreate,
    MeasurementResponse,
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    LeaseContractCreate,
    LeaseContractResponse,
    InvoiceResponse,
)

from backend.app.schemas.bess import (
    BESSVendorResponse,
    BESSModelResponse,
    BESSDatasetCreate,
    BESSDatasetResponse,
    BESSDataUploadRequest,
    BESSRecommendationRequest,
    BESSRecommendation,
    BESSSimulationInput,
    BESSSimulationResult,
)

from backend.app.schemas.pv import (
    PVModuleResponse,
    PVSurfaceCreate,
    PVSurfaceResponse,
    PVAssessmentCreate,
    PVAssessmentResponse,
    PVDesignRequest,
    PVDesignScenarioResponse,
    SiteMapCreate,
    SiteMapResponse,
    PVSizingRequest,
    PVSizingResponse,
)

from backend.app.schemas.platform import (
    UserRole,
    AuditAction,
    FileStatus,
    PeriodStatus,
    OrganizationCreate,
    OrganizationResponse,
    UserCreate,
    UserResponse,
    AuditLogResponse,
    FileAssetCreate,
    FileAssetResponse,
    PeriodLockCreate,
    PeriodLockResponse,
)

from backend.app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    AuthUserResponse,
    PasswordResetRequest,
    PasswordResetConfirm,
    UserProfileUpdate,
    ChangePasswordRequest,
)

from backend.app.schemas.data_quality import (
    QualityIssueType,
    QualityIssueResponse,
    QualityIssueUpdate,
    MeterQualitySummaryResponse,
    DataQualityDashboard,
)

from backend.app.schemas.virtual_meters import (
    VirtualMeterType,
    VirtualMeterComponentCreate,
    VirtualMeterCreate,
    VirtualMeterComponentResponse,
    VirtualMeterResponse,
)

from backend.app.schemas.maintenance import (
    MaintenanceRuleType,
    MaintenanceCondition,
    MaintenanceAlertResponse,
    AssetConditionResponse,
    MaintenanceScheduleCreate,
    MaintenanceScheduleResponse,
)

from backend.app.schemas.ai_forecasting import (
    AgentType,
    AgentChatRequest,
    AgentChatResponse,
    RecommendationResponse,
    ForecastRequest,
    ForecastPointResponse,
    ForecastResponse,
    ForecastJobCreate,
    ForecastJobResponse,
    ForecastSeriesResponse,
)

from backend.app.schemas.control import (
    ControlRuleType,
    SafetyGateStatus,
    ControlRuleCreate,
    ControlRuleResponse,
    ControlCommandCreate,
    ControlCommandResponse,
    SafetyGateCreate,
    SafetyGateResponse,
)

from backend.app.schemas.reports import (
    OCRBillResult,
    PanelDiagramResult,
    CarbonEmissionCreate,
    CarbonEmissionResponse,
    CarbonSummaryResponse,
    ReportRequest,
    ReportResponse,
    ESGMetricsResponse,
)

from backend.app.schemas.integrations import (
    GatewayStatusEnum,
    RegisterTypeEnum,
    DataTypeEnum,
    ByteOrderEnum,
    GatewayCreate,
    GatewayUpdate,
    GatewayResponse,
    TemplateRegisterCreate,
    TemplateRegisterResponse,
    DeviceTemplateCreate,
    DeviceTemplateUpdate,
    DeviceTemplateResponse,
    DeviceTemplateListResponse,
    ModbusRegisterCreate,
    ModbusRegisterUpdate,
    ModbusRegisterResponse,
    CommunicationLogCreate,
    CommunicationLogResponse,
    ConnectionTestRequest,
    ConnectionTestResponse,
    RegisterReadRequest,
    RegisterReadResponse,
    CommunicationHealthSummary,
    ApplyTemplateRequest,
)

from backend.app.schemas.response import (
    APIResponse,
    PaginatedResponse,
    ErrorResponse,
    ErrorDetail,
    PaginationMeta,
    success_response,
    error_response,
    paginated_response,
)

__all__ = [
    # Base
    "BaseModel",
    "Field",
    "ConfigDict",
    "datetime",
    "date",
    "time",
    "Optional",
    "List",
    "Dict",
    "Any",
    # Core - Enums
    "AssetType",
    "NotificationType",
    # Core - Site
    "SiteCreate",
    "SiteUpdate",
    "SiteResponse",
    # Core - Asset
    "AssetCreate",
    "AssetUpdate",
    "AssetResponse",
    "AssetTreeNode",
    # Core - Meter
    "MeterCreate",
    "MeterUpdate",
    "MeterResponse",
    "MeterReadingCreate",
    "MeterReadingResponse",
    # Core - Bill
    "BillLineItemCreate",
    "BillLineItemResponse",
    "BillCreate",
    "BillUpdate",
    "BillResponse",
    "BillValidationResult",
    # Core - Gap Analysis
    "UnmeteredAsset",
    "GapAnalysisResult",
    # Core - Notification
    "NotificationCreate",
    "NotificationResponse",
    # Core - Tariff
    "TariffRateCreate",
    "TariffRateResponse",
    "TariffCreate",
    "TariffUpdate",
    "TariffResponse",
    # Core - Solar ROI
    "SolarROIInput",
    "SolarROIResult",
    # Enterprise - Enums
    "DataSourceType",
    "InvoiceStatus",
    # Enterprise - DataSource
    "DataSourceCreate",
    "DataSourceResponse",
    # Enterprise - Measurement
    "MeasurementCreate",
    "MeasurementResponse",
    # Enterprise - Tenant
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    # Enterprise - LeaseContract
    "LeaseContractCreate",
    "LeaseContractResponse",
    # Enterprise - Invoice
    "InvoiceResponse",
    # BESS
    "BESSVendorResponse",
    "BESSModelResponse",
    "BESSDatasetCreate",
    "BESSDatasetResponse",
    "BESSDataUploadRequest",
    "BESSRecommendationRequest",
    "BESSRecommendation",
    "BESSSimulationInput",
    "BESSSimulationResult",
    # PV
    "PVModuleResponse",
    "PVSurfaceCreate",
    "PVSurfaceResponse",
    "PVAssessmentCreate",
    "PVAssessmentResponse",
    "PVDesignRequest",
    "PVDesignScenarioResponse",
    "SiteMapCreate",
    "SiteMapResponse",
    "PVSizingRequest",
    "PVSizingResponse",
    # Platform - Enums
    "UserRole",
    "AuditAction",
    "FileStatus",
    "PeriodStatus",
    # Platform - Organization
    "OrganizationCreate",
    "OrganizationResponse",
    # Platform - User
    "UserCreate",
    "UserResponse",
    # Platform - AuditLog
    "AuditLogResponse",
    # Platform - FileAsset
    "FileAssetCreate",
    "FileAssetResponse",
    # Platform - PeriodLock
    "PeriodLockCreate",
    "PeriodLockResponse",
    # Auth
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "AuthUserResponse",
    "PasswordResetRequest",
    "PasswordResetConfirm",
    "UserProfileUpdate",
    "ChangePasswordRequest",
    # Data Quality - Enums
    "QualityIssueType",
    # Data Quality
    "QualityIssueResponse",
    "QualityIssueUpdate",
    "MeterQualitySummaryResponse",
    "DataQualityDashboard",
    # Virtual Meters - Enums
    "VirtualMeterType",
    # Virtual Meters
    "VirtualMeterComponentCreate",
    "VirtualMeterCreate",
    "VirtualMeterComponentResponse",
    "VirtualMeterResponse",
    # Maintenance - Enums
    "MaintenanceRuleType",
    "MaintenanceCondition",
    # Maintenance
    "MaintenanceAlertResponse",
    "AssetConditionResponse",
    "MaintenanceScheduleCreate",
    "MaintenanceScheduleResponse",
    # AI Forecasting - Enums
    "AgentType",
    # AI Forecasting
    "AgentChatRequest",
    "AgentChatResponse",
    "RecommendationResponse",
    "ForecastRequest",
    "ForecastPointResponse",
    "ForecastResponse",
    "ForecastJobCreate",
    "ForecastJobResponse",
    "ForecastSeriesResponse",
    # Control - Enums
    "ControlRuleType",
    "SafetyGateStatus",
    # Control
    "ControlRuleCreate",
    "ControlRuleResponse",
    "ControlCommandCreate",
    "ControlCommandResponse",
    "SafetyGateCreate",
    "SafetyGateResponse",
    # Reports
    "OCRBillResult",
    "PanelDiagramResult",
    "CarbonEmissionCreate",
    "CarbonEmissionResponse",
    "CarbonSummaryResponse",
    "ReportRequest",
    "ReportResponse",
    "ESGMetricsResponse",
    # Integrations - Enums
    "GatewayStatusEnum",
    "RegisterTypeEnum",
    "DataTypeEnum",
    "ByteOrderEnum",
    # Integrations - Gateway
    "GatewayCreate",
    "GatewayUpdate",
    "GatewayResponse",
    # Integrations - DeviceTemplate
    "TemplateRegisterCreate",
    "TemplateRegisterResponse",
    "DeviceTemplateCreate",
    "DeviceTemplateUpdate",
    "DeviceTemplateResponse",
    "DeviceTemplateListResponse",
    # Integrations - ModbusRegister
    "ModbusRegisterCreate",
    "ModbusRegisterUpdate",
    "ModbusRegisterResponse",
    # Integrations - CommunicationLog
    "CommunicationLogCreate",
    "CommunicationLogResponse",
    # Integrations - Connection Test
    "ConnectionTestRequest",
    "ConnectionTestResponse",
    "RegisterReadRequest",
    "RegisterReadResponse",
    "CommunicationHealthSummary",
    "ApplyTemplateRequest",
]
