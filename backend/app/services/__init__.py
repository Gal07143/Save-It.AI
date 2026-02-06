"""
Business logic services for SAVE-IT.AI IoT Platform.

This module exports all service classes for the comprehensive IoT platform:

Core Services (Week 1-2):
- TelemetryService: Time-series telemetry storage and retrieval
- AlarmEngine: Real-time alarm evaluation with all condition types
- AggregationService: Hourly/daily/monthly data rollups
- KPIEngine: KPI calculation with formulas

Device Management (Week 3-4):
- ConfigSyncService: Push configuration to edge devices
- CertificateService: X.509 certificate management
- EventService: Device event logging and correlation
- FirmwareService: OTA firmware updates
- RealtimeService: WebSocket real-time broadcasts
- DiscoveryService: Network device discovery

Enterprise Features (Week 5-6):
- TenantService: Multi-tenant organization management
- AuditService: Comprehensive audit logging
- WorkflowEngine: Automation rules engine
- ExportService: Data export (CSV/Excel/JSON)
- DeviceGroupService: Device grouping and bulk operations
- DashboardService: Custom dashboards and widgets

Advanced Features (Week 7):
- ReportService: Scheduled and on-demand reports
- GeofenceService: Location-based device management
- MaintenanceService: Predictive and scheduled maintenance
- LifecycleService: Device lifecycle management

Platform Features (Week 8):
- ValidationService: Data validation and quality control
- HealthMonitor: System health monitoring
- NotificationService: Multi-channel notifications
- CustomFieldService: Dynamic custom fields
"""

# Core Services
from app.services.telemetry_service import (
    TelemetryService,
    TelemetryRecord,
    TelemetryValue,
    get_telemetry_service,
)

from app.services.alarm_engine import (
    AlarmEngine,
    AlarmEvent,
    AlarmConditionEvaluator,
    get_alarm_engine,
)

from app.services.aggregation_service import (
    AggregationService,
    AggregationResult,
    get_aggregation_service,
)

from app.services.kpi_engine import (
    KPIEngine,
    KPIResult,
    TimeRange,
    get_kpi_engine,
)

# Device Management Services
from app.services.config_sync_service import (
    ConfigSyncService,
    SyncResult,
    get_config_sync_service,
)

from app.services.certificate_service import (
    CertificateService,
    CertificateBundle,
    ValidationResult,
    get_certificate_service,
)

from app.services.event_service import (
    EventService,
    EventFilter,
    EventTimeline,
    get_event_service,
)

from app.services.firmware_service import (
    FirmwareService,
    Firmware,
    FirmwareUpdate,
    FirmwareJob,
    get_firmware_service,
)

from app.services.realtime_service import (
    RealtimeService,
    ConnectionInfo,
    get_realtime_service,
    websocket_handler,
)

from app.services.discovery_service import (
    DiscoveryService,
    DiscoveredDevice,
    DeviceProbe,
    get_discovery_service,
)

# Enterprise Services
from app.services.tenant_service import (
    TenantService,
    TenantQuotas,
    TenantUsage,
    get_tenant_service,
)

from app.services.audit_service import (
    AuditService,
    AuditFilter,
    AuditMiddleware,
    get_audit_service,
)

from app.services.workflow_engine import (
    WorkflowEngine,
    WorkflowRule,
    WorkflowExecution,
    ExecutionResult,
    get_workflow_engine,
)

# Week 6 Services
from app.services.export_service import (
    ExportService,
    ExportConfig,
    ExportResult,
    ExportFormat,
    get_export_service,
)

from app.services.device_group_service import (
    DeviceGroupService,
    DeviceGroup,
    GroupStats,
    BulkOperationResult,
    get_device_group_service,
)

from app.services.dashboard_service import (
    DashboardService,
    Dashboard,
    DashboardWidget,
    WidgetConfig,
    WidgetData,
    get_dashboard_service,
)

# Week 7 Services
from app.services.report_service import (
    ReportService,
    ReportTemplate,
    ReportSchedule,
    ReportResult,
    get_report_service,
)

from app.services.geofence_service import (
    GeofenceService,
    Geofence,
    GeofenceEvent,
    LocationUpdate,
    GeofenceCheck,
    get_geofence_service,
)

from app.services.maintenance_service import (
    MaintenanceService,
    MaintenanceSchedule,
    WorkOrder,
    MaintenancePrediction,
    MaintenanceSummary,
    get_maintenance_service,
)

from app.services.lifecycle_service import (
    LifecycleService,
    LifecycleState,
    LifecycleTransition,
    DeviceWarranty,
    ProvisioningResult,
    LifecycleReport,
    get_lifecycle_service,
)

# Week 8 Services
from app.services.validation_service import (
    ValidationService,
    ValidationRule,
    ValidationResult as DataValidationResult,
    ValidationReport,
    DataQualityMetrics,
    get_validation_service,
)

from app.services.health_monitor import (
    HealthMonitor,
    HealthStatus,
    ComponentHealth,
    SystemHealth,
    ResourceUsage,
    get_health_monitor,
)

from app.services.notification_service import (
    NotificationService,
    NotificationChannel,
    NotificationPriority,
    DeliveryTemplate,
    DeliveryMessage,
    NotificationResult,
    DeliveryPreference,
    get_notification_service,
)

from app.services.custom_field_service import (
    CustomFieldService,
    CustomFieldDefinition,
    CustomFieldValue,
    FieldType,
    CustomFieldData,
    get_custom_field_service,
)

# Data Ingestion (existing)
from app.services.data_ingestion import (
    DataIngestionService,
    get_ingestion_service,
)

__all__ = [
    # Core
    "TelemetryService",
    "TelemetryRecord",
    "TelemetryValue",
    "get_telemetry_service",
    "AlarmEngine",
    "AlarmEvent",
    "AlarmConditionEvaluator",
    "get_alarm_engine",
    "AggregationService",
    "AggregationResult",
    "get_aggregation_service",
    "KPIEngine",
    "KPIResult",
    "TimeRange",
    "get_kpi_engine",
    # Device Management
    "ConfigSyncService",
    "SyncResult",
    "get_config_sync_service",
    "CertificateService",
    "CertificateBundle",
    "ValidationResult",
    "get_certificate_service",
    "EventService",
    "EventFilter",
    "EventTimeline",
    "get_event_service",
    "FirmwareService",
    "Firmware",
    "FirmwareUpdate",
    "FirmwareJob",
    "get_firmware_service",
    "RealtimeService",
    "ConnectionInfo",
    "get_realtime_service",
    "websocket_handler",
    "DiscoveryService",
    "DiscoveredDevice",
    "DeviceProbe",
    "get_discovery_service",
    # Enterprise (Week 5)
    "TenantService",
    "TenantQuotas",
    "TenantUsage",
    "get_tenant_service",
    "AuditService",
    "AuditFilter",
    "AuditMiddleware",
    "get_audit_service",
    "WorkflowEngine",
    "WorkflowRule",
    "WorkflowExecution",
    "ExecutionResult",
    "get_workflow_engine",
    # Week 6
    "ExportService",
    "ExportConfig",
    "ExportResult",
    "ExportFormat",
    "get_export_service",
    "DeviceGroupService",
    "DeviceGroup",
    "GroupStats",
    "BulkOperationResult",
    "get_device_group_service",
    "DashboardService",
    "Dashboard",
    "DashboardWidget",
    "WidgetConfig",
    "WidgetData",
    "get_dashboard_service",
    # Week 7
    "ReportService",
    "ReportTemplate",
    "ReportSchedule",
    "ReportResult",
    "get_report_service",
    "GeofenceService",
    "Geofence",
    "GeofenceEvent",
    "LocationUpdate",
    "GeofenceCheck",
    "get_geofence_service",
    "MaintenanceService",
    "MaintenanceSchedule",
    "WorkOrder",
    "MaintenancePrediction",
    "MaintenanceSummary",
    "get_maintenance_service",
    "LifecycleService",
    "LifecycleState",
    "LifecycleTransition",
    "DeviceWarranty",
    "ProvisioningResult",
    "LifecycleReport",
    "get_lifecycle_service",
    # Week 8
    "ValidationService",
    "ValidationRule",
    "DataValidationResult",
    "ValidationReport",
    "DataQualityMetrics",
    "get_validation_service",
    "HealthMonitor",
    "HealthStatus",
    "ComponentHealth",
    "SystemHealth",
    "ResourceUsage",
    "get_health_monitor",
    "NotificationService",
    "NotificationChannel",
    "NotificationPriority",
    "DeliveryTemplate",
    "DeliveryMessage",
    "NotificationResult",
    "DeliveryPreference",
    "get_notification_service",
    "CustomFieldService",
    "CustomFieldDefinition",
    "CustomFieldValue",
    "FieldType",
    "CustomFieldData",
    "get_custom_field_service",
    # Data Ingestion
    "DataIngestionService",
    "get_ingestion_service",
]
