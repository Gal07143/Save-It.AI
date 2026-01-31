# Save-It.AI - Complete Enterprise IoT Platform Implementation Plan

## Vision
Transform Save-It.AI into a 100% production-ready enterprise IoT platform with full Zoho IoT feature parity PLUS 15 additional enterprise features for a complete solution.

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current State](#current-state)
3. [Core IoT Features (Zoho Parity)](#core-iot-features)
4. [15 Additional Enterprise Features](#15-additional-enterprise-features)
5. [Complete Implementation Roadmap](#implementation-roadmap)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Total Features: 45
- **Already Implemented:** 18 features (40%)
- **Core IoT (Zoho Parity):** 12 features to add
- **Enterprise Additions:** 15 features to add
- **Total New Features:** 27

### Timeline: 8 Weeks
- Weeks 1-2: Core Data Pipeline
- Weeks 3-4: Device Management & Control
- Weeks 5-6: Enterprise Features Part 1
- Weeks 7-8: Enterprise Features Part 2 + Polish

---

## Current State

### Implemented Features (18)

| # | Feature | File Location |
|---|---------|---------------|
| 1 | Device Models (blueprints) | `models/devices.py` |
| 2 | Device Types (4 types) | `DeviceType` enum |
| 3 | Device Products (catalog) | `DeviceProduct` model |
| 4 | Datapoints with aggregation | `Datapoint` model |
| 5 | Commands (6 input types) | `Command` model |
| 6 | Command Execution & Ack | `services/command_service.py` |
| 7 | Alarm Rules (model) | `AlarmRule` model |
| 8 | Device Policies | `DevicePolicy` model |
| 9 | Device Certificates (model) | `DeviceCertificate` model |
| 10 | MQTT Broker | `services/mqtt_broker.py` |
| 11 | MQTT Subscriber | `services/mqtt_subscriber.py` |
| 12 | Polling Service | `services/polling_service.py` |
| 13 | Webhook Service | `services/webhook_service.py` |
| 14 | Scheduler Service | `services/scheduler_service.py` |
| 15 | Device Onboarding | `services/device_onboarding.py` |
| 16 | Edge Key Resolution | `EdgeKeyResolver` class |
| 17 | Modbus Register CRUD | `routers/modbus_registers.py` |
| 18 | Gateway Management | `routers/gateways.py` |

---

## Core IoT Features (12 New - Zoho Parity)

### Feature 1: Telemetry Storage Service
**Priority:** P0 | **Effort:** High | **Week:** 1

```python
# File: /backend/app/services/telemetry_service.py

class TelemetryService:
    """
    Time-series telemetry storage and retrieval.
    Optimized for high-volume ingestion and efficient queries.
    """

    def store_telemetry(self, device_id: int, datapoints: Dict[str, Any],
                        timestamp: datetime = None, source: str = "mqtt") -> int:
        """Store telemetry data points. Returns count stored."""

    def store_batch(self, records: List[TelemetryRecord]) -> int:
        """Batch insert for high-throughput scenarios."""

    def query(self, device_id: int, datapoint_names: List[str],
              start: datetime, end: datetime,
              aggregation: str = None, interval: str = None) -> DataFrame:
        """Query telemetry with optional aggregation."""

    def get_latest(self, device_id: int) -> Dict[str, TelemetryValue]:
        """Get latest value for all datapoints."""

    def get_history(self, device_id: int, datapoint: str,
                    limit: int = 1000, offset: int = 0) -> List[TelemetryValue]:
        """Get historical values for a single datapoint."""

    def delete_old_data(self, retention_days: int) -> int:
        """Delete data older than retention period."""
```

### Feature 2: Alarm Evaluation Engine
**Priority:** P0 | **Effort:** High | **Week:** 1

```python
# File: /backend/app/services/alarm_engine.py

class AlarmConditionEvaluator:
    """Evaluates all Zoho IoT alarm condition types."""

    CONDITION_MAP = {
        "gt": lambda v, t: v > t,
        "lt": lambda v, t: v < t,
        "eq": lambda v, t: v == t,
        "neq": lambda v, t: v != t,
        "gte": lambda v, t: v >= t,
        "lte": lambda v, t: v <= t,
        "between": lambda v, t1, t2: t1 <= v <= t2,
        "outside": lambda v, t1, t2: v < t1 or v > t2,
        "change": lambda v, prev: v != prev,
        "no_data": lambda last_time, threshold: (now() - last_time).seconds > threshold,
    }

class AlarmEngine:
    """
    Real-time alarm evaluation with:
    - Threshold conditions
    - Duration-based alarms (must exceed for X seconds)
    - No-data detection
    - Auto-clear capability
    - Notification triggers
    """

    def __init__(self, db: Session):
        self.db = db
        self.evaluator = AlarmConditionEvaluator()
        self._active_alarms: Dict[str, ActiveAlarm] = {}
        self._duration_trackers: Dict[str, DurationTracker] = {}
        self._last_values: Dict[str, Any] = {}

    def evaluate(self, device_id: int, datapoint: str, value: Any) -> List[AlarmEvent]:
        """Evaluate all rules for a datapoint. Returns triggered/cleared alarms."""

    def check_no_data_conditions(self) -> List[AlarmEvent]:
        """Scheduled: Check for devices that stopped sending data."""

    def acknowledge(self, alarm_id: int, user_id: int, notes: str = None) -> DeviceAlarm
    def clear(self, alarm_id: int, user_id: int = None, auto: bool = False) -> DeviceAlarm
    def get_active(self, filters: AlarmFilter) -> List[DeviceAlarm]
    def get_history(self, device_id: int, limit: int = 100) -> List[DeviceAlarm]
```

### Feature 3: Data Aggregation Service
**Priority:** P1 | **Effort:** Medium | **Week:** 2

```python
# File: /backend/app/services/aggregation_service.py

class AggregationService:
    """
    Creates time-based rollups for efficient querying:
    - Hourly: From raw data
    - Daily: From hourly
    - Monthly: From daily
    """

    async def aggregate_hourly(self) -> AggregationResult:
        """Run hourly aggregation for all devices."""

    async def aggregate_daily(self) -> AggregationResult:
        """Run daily aggregation."""

    async def aggregate_monthly(self) -> AggregationResult:
        """Run monthly aggregation."""

    def get_aggregated(self, device_id: int, datapoint: str,
                       period: str, start: datetime, end: datetime) -> List[Aggregation]

    async def rebuild_aggregations(self, device_id: int, start: datetime, end: datetime):
        """Rebuild aggregations for a time range (e.g., after data correction)."""
```

### Feature 4: KPI Calculation Engine
**Priority:** P1 | **Effort:** Medium | **Week:** 2

```python
# File: /backend/app/services/kpi_engine.py

class KPIEngine:
    """
    Calculates Key Performance Indicators:
    - Simple aggregations (sum, avg, min, max)
    - Formulas with multiple variables
    - Cross-device calculations
    - Scheduled and on-demand
    """

    def calculate(self, kpi_id: int, time_range: TimeRange) -> KPIResult:
        """Calculate a single KPI."""

    def calculate_formula(self, formula: str, variables: Dict[str, float]) -> float:
        """Evaluate a formula expression."""
        # Supports: +, -, *, /, ^, sqrt, abs, min, max, avg

    def calculate_device_kpis(self, device_id: int, time_range: TimeRange) -> Dict[str, KPIResult]:
        """Calculate all KPIs for a device."""

    def schedule_calculation(self, kpi_id: int, cron: str):
        """Schedule recurring KPI calculation."""
```

### Feature 5: Configuration Sync Service
**Priority:** P1 | **Effort:** Medium | **Week:** 3

```python
# File: /backend/app/services/config_sync_service.py

class ConfigSyncService:
    """
    Pushes configuration to edge devices:
    - Device settings
    - Modbus register maps
    - Alarm rules for edge evaluation
    - Polling intervals
    """

    def push_full_config(self, device_id: int) -> SyncResult:
        """Push complete configuration to device."""

    def push_partial_config(self, device_id: int, config_keys: List[str]) -> SyncResult:
        """Push specific configuration items."""

    def push_modbus_config(self, gateway_id: int, device_id: int) -> SyncResult:
        """Push Modbus register configuration to gateway."""

    def handle_ack(self, device_id: int, correlation_id: str, success: bool, error: str = None):
        """Handle configuration acknowledgment from device."""

    async def retry_failed(self) -> int:
        """Retry all failed configuration syncs."""

    def get_sync_status(self, device_id: int) -> ConfigSyncStatus
```

### Feature 6: Certificate Management Service
**Priority:** P1 | **Effort:** Low | **Week:** 3

```python
# File: /backend/app/services/certificate_service.py

class CertificateService:
    """
    X.509 certificate management for device authentication:
    - Generate device certificates
    - Sign with CA
    - Revocation
    - Rotation
    """

    def generate_certificate(self, device_id: int, validity_days: int = 365) -> CertificateBundle:
        """Generate new certificate for device."""

    def revoke(self, certificate_id: int, reason: str) -> bool:
        """Revoke a certificate."""

    def validate(self, cert_pem: str) -> ValidationResult:
        """Validate a certificate against CA."""

    def rotate(self, device_id: int) -> CertificateBundle:
        """Rotate device certificate (generate new, revoke old)."""

    def get_ca_cert(self) -> str:
        """Get CA certificate for client distribution."""

    def check_expiring(self, days_threshold: int = 30) -> List[DeviceCertificate]:
        """Find certificates expiring soon."""
```

### Feature 7: Device Event Service
**Priority:** P2 | **Effort:** Medium | **Week:** 3

```python
# File: /backend/app/services/event_service.py

class EventService:
    """
    Handles discrete device events (vs continuous telemetry):
    - State changes
    - System events
    - User actions
    - Maintenance events
    """

    def log_event(self, device_id: int, event_type: str, severity: str,
                  title: str, message: str = None, data: Dict = None) -> DeviceEvent:
        """Log a new device event."""

    def get_events(self, filters: EventFilter, limit: int = 100) -> List[DeviceEvent]:
        """Query events with filters."""

    def correlate(self, device_id: int, time_window_seconds: int = 60) -> List[CorrelatedEventGroup]:
        """Group related events that occurred close together."""

    def get_timeline(self, device_id: int, start: datetime, end: datetime) -> EventTimeline:
        """Get event timeline for visualization."""
```

### Feature 8: Firmware OTA Service
**Priority:** P2 | **Effort:** High | **Week:** 4

```python
# File: /backend/app/services/firmware_service.py

class FirmwareService:
    """
    Over-the-air firmware updates:
    - Version management
    - Staged rollout
    - Progress tracking
    - Rollback capability
    """

    def upload(self, product_id: int, version: str, file: UploadFile,
               release_notes: str = None) -> Firmware:
        """Upload new firmware version."""

    def schedule_update(self, device_ids: List[int], firmware_id: int,
                        scheduled_at: datetime = None) -> FirmwareJob:
        """Schedule firmware update for devices."""

    def push_update(self, device_id: int, firmware_id: int) -> FirmwareUpdate:
        """Immediately push update to device."""

    def handle_progress(self, device_id: int, status: str, progress: int, error: str = None):
        """Handle update progress report from device."""

    def rollback(self, device_id: int) -> FirmwareUpdate:
        """Rollback to previous firmware version."""

    def get_update_history(self, device_id: int) -> List[FirmwareUpdate]
```

### Feature 9: Real-time WebSocket Service
**Priority:** P2 | **Effort:** Medium | **Week:** 4

```python
# File: /backend/app/services/realtime_service.py

class RealtimeService:
    """
    WebSocket-based real-time updates:
    - Telemetry broadcasts
    - Alarm notifications
    - Status changes
    - Room-based subscriptions
    """

    async def connect(self, websocket: WebSocket, client_id: str, user_id: int):
        """Handle new WebSocket connection."""

    async def disconnect(self, client_id: str):
        """Handle disconnection."""

    async def subscribe(self, client_id: str, topics: List[str]):
        """Subscribe to topics (device:123, site:456, alarm:*)"""

    async def broadcast_telemetry(self, device_id: int, data: Dict):
        """Broadcast telemetry to subscribers."""

    async def broadcast_alarm(self, alarm: DeviceAlarm):
        """Broadcast alarm event."""

    async def broadcast_status(self, device_id: int, online: bool):
        """Broadcast device status change."""

    def get_connections(self) -> List[ConnectionInfo]
```

### Feature 10: Device Discovery Service
**Priority:** P3 | **Effort:** Medium | **Week:** 4

```python
# File: /backend/app/services/discovery_service.py

class DiscoveryService:
    """
    Auto-discover devices on the network:
    - Network scanning
    - Modbus device probing
    - Device identification
    - Template matching
    """

    async def scan_network(self, ip_range: str, ports: List[int] = [502]) -> List[DiscoveredDevice]:
        """Scan IP range for Modbus devices."""

    async def probe_device(self, host: str, port: int, slave_ids: List[int]) -> DeviceProbe:
        """Probe a specific device."""

    async def identify(self, host: str, port: int, slave_id: int) -> DeviceIdentification:
        """Try to identify device type by reading specific registers."""

    def match_template(self, device_info: DeviceIdentification) -> Optional[DeviceTemplate]:
        """Match discovered device to a template."""

    async def auto_provision(self, discovered: DiscoveredDevice, site_id: int,
                             gateway_id: int = None) -> Device:
        """Automatically provision a discovered device."""
```

### Feature 11: Workflow Rules Engine
**Priority:** P3 | **Effort:** High | **Week:** 5

```python
# File: /backend/app/services/workflow_engine.py

class WorkflowEngine:
    """
    Automation rules engine:
    - Trigger-based execution
    - Condition evaluation
    - Action execution
    - Rule chaining
    """

    def register_rule(self, rule: WorkflowRule):
        """Register a new workflow rule."""

    def evaluate_trigger(self, trigger_type: str, context: Dict):
        """Evaluate rules for a trigger event."""

    def execute_rule(self, rule: WorkflowRule, context: Dict) -> ExecutionResult:
        """Execute a single rule."""

    def execute_actions(self, actions: List[WorkflowAction], context: Dict):
        """Execute rule actions."""

    # Trigger types: telemetry_received, alarm_triggered, alarm_cleared,
    #                device_online, device_offline, schedule, manual
```

### Feature 12: Edge Scripting Service
**Priority:** P3 | **Effort:** High | **Week:** 5

```python
# File: /backend/app/services/edge_script_service.py

class EdgeScriptService:
    """
    Deploy custom logic to edge devices:
    - Script management
    - Deployment
    - Execution monitoring
    """

    def create_script(self, name: str, code: str, language: str = "lua") -> EdgeScript:
        """Create a new edge script."""

    def deploy(self, script_id: int, device_ids: List[int]) -> DeploymentResult:
        """Deploy script to devices."""

    def undeploy(self, script_id: int, device_ids: List[int]) -> DeploymentResult:
        """Remove script from devices."""

    def get_execution_logs(self, device_id: int, script_id: int) -> List[ExecutionLog]:
        """Get script execution logs from device."""
```

---

## 15 Additional Enterprise Features

### Feature 13: Multi-Tenant Organization Hierarchy
**Priority:** P0 | **Effort:** High | **Week:** 5

```python
# File: /backend/app/services/tenant_service.py

class TenantService:
    """
    Multi-tenant organization management:
    - Organization hierarchy (Org -> Sites -> Assets)
    - Tenant isolation
    - Cross-tenant admin
    - White-labeling support
    """

    def create_organization(self, name: str, parent_id: int = None) -> Organization:
        """Create organization with optional parent."""

    def get_hierarchy(self, org_id: int) -> OrganizationTree:
        """Get full organization hierarchy."""

    def set_quotas(self, org_id: int, quotas: TenantQuotas):
        """Set resource quotas for tenant."""

    def get_usage(self, org_id: int) -> TenantUsage:
        """Get current resource usage."""

    def isolate_query(self, query: Query, org_id: int) -> Query:
        """Apply tenant isolation to database query."""
```

**Model:**
```python
class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True)
    parent_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True)
    tier = Column(String(50), default="standard")  # free, standard, enterprise

    # Quotas
    max_devices = Column(Integer, default=100)
    max_users = Column(Integer, default=10)
    max_sites = Column(Integer, default=5)
    data_retention_days = Column(Integer, default=90)

    # White-labeling
    logo_url = Column(String(500), nullable=True)
    primary_color = Column(String(7), nullable=True)
    custom_domain = Column(String(255), nullable=True)

    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### Feature 14: Comprehensive Audit Logging
**Priority:** P0 | **Effort:** Medium | **Week:** 5

```python
# File: /backend/app/services/audit_service.py

class AuditService:
    """
    Complete audit trail for compliance:
    - All CRUD operations
    - Authentication events
    - Configuration changes
    - Data access
    """

    def log(self, action: str, resource_type: str, resource_id: int,
            user_id: int, old_value: Dict = None, new_value: Dict = None,
            ip_address: str = None, user_agent: str = None) -> AuditLog:
        """Log an audit event."""

    def query(self, filters: AuditFilter, limit: int = 100) -> List[AuditLog]:
        """Query audit logs."""

    def export(self, filters: AuditFilter, format: str = "csv") -> bytes:
        """Export audit logs."""

    def get_user_activity(self, user_id: int, days: int = 30) -> List[AuditLog]:
        """Get user's activity history."""

    def get_resource_history(self, resource_type: str, resource_id: int) -> List[AuditLog]:
        """Get change history for a resource."""
```

**Model:**
```python
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    action = Column(String(50), nullable=False)  # create, update, delete, read, login, logout
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(Integer, nullable=True)

    old_value = Column(Text, nullable=True)  # JSON
    new_value = Column(Text, nullable=True)  # JSON

    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    session_id = Column(String(100), nullable=True)

    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('ix_audit_org_time', 'organization_id', 'timestamp'),
        Index('ix_audit_user_time', 'user_id', 'timestamp'),
        Index('ix_audit_resource', 'resource_type', 'resource_id'),
    )
```

### Feature 15: Data Export Service
**Priority:** P1 | **Effort:** Medium | **Week:** 6

```python
# File: /backend/app/services/export_service.py

class ExportService:
    """
    Data export in multiple formats:
    - CSV, Excel, PDF
    - Scheduled exports
    - Large file handling
    - Email delivery
    """

    def export_telemetry(self, device_id: int, start: datetime, end: datetime,
                         format: str = "csv", columns: List[str] = None) -> ExportResult:
        """Export telemetry data."""

    def export_report(self, report_type: str, params: Dict,
                      format: str = "pdf") -> ExportResult:
        """Generate and export a report."""

    def schedule_export(self, export_config: ExportConfig, schedule: str,
                        recipients: List[str]) -> ScheduledExport:
        """Schedule recurring export with email delivery."""

    async def process_large_export(self, export_id: int):
        """Background job for large exports."""

    def get_export_status(self, export_id: int) -> ExportStatus
    def download(self, export_id: int) -> FileResponse
```

### Feature 16: API Rate Limiting
**Priority:** P0 | **Effort:** Medium | **Week:** 6

```python
# File: /backend/app/services/rate_limiter.py

class RateLimiter:
    """
    API rate limiting per tenant/device:
    - Request limits
    - Bandwidth limits
    - Burst handling
    - Grace periods
    """

    def __init__(self, redis_client):
        self.redis = redis_client

    def check_limit(self, key: str, limit: int, window_seconds: int) -> RateLimitResult:
        """Check if request is within rate limit."""

    def get_tenant_limits(self, org_id: int) -> TenantLimits:
        """Get rate limits for a tenant based on tier."""

    def get_device_limits(self, device_id: int) -> DeviceLimits:
        """Get telemetry ingestion limits for device."""

    def record_request(self, key: str):
        """Record a request for rate limiting."""

    def get_usage(self, key: str, window_seconds: int) -> UsageStats:
        """Get current usage statistics."""

# Middleware
class RateLimitMiddleware:
    async def __call__(self, request: Request, call_next):
        # Check API rate limit
        # Check telemetry rate limit for device endpoints
        # Return 429 if exceeded
```

### Feature 17: Device Grouping & Bulk Operations
**Priority:** P1 | **Effort:** Medium | **Week:** 6

```python
# File: /backend/app/services/device_group_service.py

class DeviceGroupService:
    """
    Group devices for bulk operations:
    - Static groups
    - Dynamic groups (rule-based)
    - Bulk commands
    - Bulk configuration
    """

    def create_group(self, name: str, org_id: int, group_type: str = "static") -> DeviceGroup:
        """Create a device group."""

    def add_devices(self, group_id: int, device_ids: List[int]):
        """Add devices to static group."""

    def set_dynamic_rule(self, group_id: int, rule: GroupRule):
        """Set rule for dynamic group membership."""

    def get_members(self, group_id: int) -> List[Device]:
        """Get devices in group."""

    def bulk_command(self, group_id: int, command_id: int, params: Dict) -> BulkCommandResult:
        """Send command to all devices in group."""

    def bulk_config(self, group_id: int, config: Dict) -> BulkConfigResult:
        """Apply configuration to all devices in group."""

    def bulk_update(self, group_id: int, updates: Dict) -> BulkUpdateResult:
        """Update properties of all devices in group."""
```

### Feature 18: Dashboard & Widget Library
**Priority:** P2 | **Effort:** High | **Week:** 6

```python
# File: /backend/app/services/dashboard_service.py

class DashboardService:
    """
    Custom dashboard management:
    - Dashboard CRUD
    - Widget library
    - Layout management
    - Sharing
    """

    def create_dashboard(self, name: str, user_id: int, layout: Dict) -> Dashboard:
        """Create a new dashboard."""

    def add_widget(self, dashboard_id: int, widget_type: str,
                   config: WidgetConfig, position: Position) -> Widget:
        """Add widget to dashboard."""

    def get_widget_types(self) -> List[WidgetType]:
        """Get available widget types."""

    def get_widget_data(self, widget_id: int, time_range: TimeRange) -> WidgetData:
        """Get data for a widget."""

    def share_dashboard(self, dashboard_id: int, user_ids: List[int], permission: str):
        """Share dashboard with users."""

    def clone_dashboard(self, dashboard_id: int, new_name: str) -> Dashboard:
        """Clone a dashboard."""
```

**Widget Types:**
- `gauge` - Single value with ranges
- `line_chart` - Time series
- `bar_chart` - Comparisons
- `pie_chart` - Distribution
- `table` - Tabular data
- `map` - Geographic view
- `status_grid` - Device status overview
- `alarm_list` - Active alarms
- `kpi_card` - KPI display
- `heatmap` - Value distribution

### Feature 19: Report Scheduling & Delivery
**Priority:** P1 | **Effort:** Medium | **Week:** 7

```python
# File: /backend/app/services/report_service.py

class ReportService:
    """
    Automated report generation and delivery:
    - Report templates
    - Scheduled generation
    - Multi-format output
    - Email/webhook delivery
    """

    def create_template(self, name: str, report_type: str, config: ReportConfig) -> ReportTemplate:
        """Create a report template."""

    def generate(self, template_id: int, params: Dict = None) -> Report:
        """Generate a report from template."""

    def schedule(self, template_id: int, cron: str, recipients: List[str],
                 format: str = "pdf") -> ScheduledReport:
        """Schedule recurring report generation."""

    async def process_scheduled(self):
        """Process due scheduled reports."""

    def get_history(self, template_id: int) -> List[Report]:
        """Get generation history for a template."""
```

### Feature 20: Geofencing & Location Tracking
**Priority:** P2 | **Effort:** Medium | **Week:** 7

```python
# File: /backend/app/services/geofence_service.py

class GeofenceService:
    """
    Location-based features:
    - Geofence definition
    - Entry/exit detection
    - Location tracking
    - Distance calculations
    """

    def create_geofence(self, name: str, polygon: List[Coordinate],
                        org_id: int) -> Geofence:
        """Create a geofence polygon."""

    def check_location(self, device_id: int, lat: float, lon: float) -> GeofenceCheckResult:
        """Check device location against all geofences."""

    def update_device_location(self, device_id: int, lat: float, lon: float):
        """Update device location and check geofences."""

    def get_devices_in_geofence(self, geofence_id: int) -> List[Device]:
        """Get all devices currently in a geofence."""

    def get_location_history(self, device_id: int, start: datetime,
                             end: datetime) -> List[LocationRecord]:
        """Get device location history."""
```

### Feature 21: Maintenance Scheduling
**Priority:** P1 | **Effort:** Medium | **Week:** 7

```python
# File: /backend/app/services/maintenance_service.py

class MaintenanceService:
    """
    Preventive maintenance management:
    - Maintenance schedules
    - Work orders
    - Technician assignment
    - Parts tracking
    """

    def create_schedule(self, device_id: int, maintenance_type: str,
                        interval_days: int) -> MaintenanceSchedule:
        """Create maintenance schedule for device."""

    def create_work_order(self, device_id: int, maintenance_type: str,
                          description: str, priority: str) -> WorkOrder:
        """Create a work order."""

    def assign_technician(self, work_order_id: int, user_id: int):
        """Assign technician to work order."""

    def complete_work_order(self, work_order_id: int, notes: str,
                            parts_used: List[Part]) -> WorkOrder:
        """Mark work order as complete."""

    def get_due_maintenance(self, days_ahead: int = 7) -> List[MaintenanceSchedule]:
        """Get maintenance due in the next X days."""

    def get_device_maintenance_history(self, device_id: int) -> List[WorkOrder]:
        """Get maintenance history for device."""
```

### Feature 22: Asset Lifecycle Management
**Priority:** P2 | **Effort:** Medium | **Week:** 7

```python
# File: /backend/app/services/lifecycle_service.py

class LifecycleService:
    """
    Track asset lifecycle from procurement to disposal:
    - Procurement tracking
    - Installation
    - Operational phase
    - Depreciation
    - Disposal
    """

    def register_procurement(self, asset_id: int, purchase_date: date,
                             cost: float, vendor: str, warranty_end: date) -> AssetProcurement:
        """Register asset procurement."""

    def record_installation(self, asset_id: int, installed_at: datetime,
                            installed_by: int, location: str) -> AssetInstallation:
        """Record asset installation."""

    def calculate_depreciation(self, asset_id: int, method: str = "straight_line") -> DepreciationResult:
        """Calculate current depreciation value."""

    def schedule_disposal(self, asset_id: int, disposal_date: date,
                          reason: str) -> AssetDisposal:
        """Schedule asset for disposal."""

    def get_lifecycle_report(self, org_id: int) -> LifecycleReport:
        """Get lifecycle report for all assets."""
```

### Feature 23: Data Validation Rules Engine
**Priority:** P1 | **Effort:** Medium | **Week:** 8

```python
# File: /backend/app/services/validation_service.py

class ValidationService:
    """
    Validate incoming telemetry data:
    - Range validation
    - Rate of change limits
    - Data type validation
    - Custom rules
    """

    def validate_telemetry(self, device_id: int, datapoint: str,
                           value: Any) -> ValidationResult:
        """Validate a single telemetry value."""

    def create_rule(self, device_id: int, datapoint: str,
                    rule_type: str, params: Dict) -> ValidationRule:
        """Create a validation rule."""

    def get_violations(self, device_id: int, start: datetime,
                       end: datetime) -> List[ValidationViolation]:
        """Get validation violations."""

    def auto_correct(self, violation_id: int, method: str) -> CorrectedValue:
        """Auto-correct a validation violation."""

# Rule types:
# - range: min/max bounds
# - rate_of_change: max change per time unit
# - data_type: expected type
# - required: must have value
# - pattern: regex for strings
# - custom: custom Python expression
```

### Feature 24: Backup & Restore Service
**Priority:** P1 | **Effort:** High | **Week:** 8

```python
# File: /backend/app/services/backup_service.py

class BackupService:
    """
    System backup and restore:
    - Configuration backup
    - Data backup
    - Scheduled backups
    - Point-in-time restore
    """

    def create_backup(self, backup_type: str = "full",
                      include_data: bool = False) -> Backup:
        """Create a backup."""

    def schedule_backup(self, cron: str, backup_type: str,
                        retention_count: int) -> ScheduledBackup:
        """Schedule recurring backups."""

    def restore(self, backup_id: int, options: RestoreOptions) -> RestoreResult:
        """Restore from a backup."""

    def export_config(self, org_id: int = None) -> ConfigExport:
        """Export system configuration as JSON."""

    def import_config(self, config: ConfigExport, org_id: int = None) -> ImportResult:
        """Import configuration from JSON."""

    def get_backups(self, limit: int = 50) -> List[Backup]:
        """List available backups."""
```

### Feature 25: System Health Monitoring
**Priority:** P0 | **Effort:** Medium | **Week:** 8

```python
# File: /backend/app/services/health_monitor.py

class HealthMonitor:
    """
    Monitor system health and performance:
    - Service health checks
    - Performance metrics
    - Resource usage
    - Alerting
    """

    def check_all_services(self) -> HealthReport:
        """Run health checks on all services."""

    def check_database(self) -> ServiceHealth:
        """Check database connectivity and performance."""

    def check_mqtt(self) -> ServiceHealth:
        """Check MQTT broker status."""

    def check_redis(self) -> ServiceHealth:
        """Check Redis connectivity."""

    def get_metrics(self) -> SystemMetrics:
        """Get current system metrics."""

    def get_performance_history(self, hours: int = 24) -> PerformanceHistory:
        """Get historical performance data."""

    def register_alert(self, metric: str, threshold: float, action: str):
        """Register health alert."""
```

### Feature 26: Notification Channels
**Priority:** P1 | **Effort:** Medium | **Week:** 8

```python
# File: /backend/app/services/notification_service.py

class NotificationService:
    """
    Multi-channel notifications:
    - Email
    - SMS
    - Push notifications
    - Slack
    - Microsoft Teams
    - Webhooks
    """

    def send(self, channel: str, recipient: str, template: str,
             context: Dict) -> NotificationResult:
        """Send notification via specified channel."""

    def send_email(self, to: List[str], subject: str, body: str,
                   attachments: List[Attachment] = None) -> NotificationResult

    def send_sms(self, phone: str, message: str) -> NotificationResult

    def send_slack(self, webhook_url: str, message: SlackMessage) -> NotificationResult

    def send_teams(self, webhook_url: str, message: TeamsMessage) -> NotificationResult

    def create_channel(self, org_id: int, channel_type: str,
                       config: Dict) -> NotificationChannel:
        """Configure a notification channel for organization."""

    def get_delivery_status(self, notification_id: int) -> DeliveryStatus
```

### Feature 27: Custom Fields
**Priority:** P2 | **Effort:** Low | **Week:** 8

```python
# File: /backend/app/services/custom_field_service.py

class CustomFieldService:
    """
    User-defined custom fields for entities:
    - Field definition
    - Validation
    - Search indexing
    """

    def create_field(self, entity_type: str, field_name: str,
                     field_type: str, options: Dict = None) -> CustomField:
        """Create a custom field definition."""

    def set_value(self, entity_type: str, entity_id: int,
                  field_name: str, value: Any):
        """Set custom field value."""

    def get_values(self, entity_type: str, entity_id: int) -> Dict[str, Any]:
        """Get all custom field values for an entity."""

    def search_by_field(self, entity_type: str, field_name: str,
                        value: Any) -> List[int]:
        """Search entities by custom field value."""
```

---

## Implementation Roadmap

### Week 1: Core Data Pipeline (P0)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Telemetry model & migration | `models/telemetry.py` |
| 2-3 | TelemetryService implementation | `services/telemetry_service.py` |
| 3-4 | Alarm model & migration | `models/alarms.py` |
| 4-5 | AlarmEngine implementation | `services/alarm_engine.py` |
| 5 | Integration with data ingestion | `services/data_ingestion.py` |

**Deliverables:**
- [ ] DeviceTelemetry model
- [ ] TelemetryService with store/query
- [ ] DeviceAlarm model
- [ ] AlarmEngine with all condition types
- [ ] Alarm evaluation in data pipeline

### Week 2: Data Management (P1)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Aggregation models & service | `services/aggregation_service.py` |
| 2-3 | KPI models & engine | `services/kpi_engine.py` |
| 3-4 | Scheduled tasks registration | `services/scheduler_service.py` |
| 4-5 | Telemetry & Alarm API endpoints | `routers/telemetry.py`, `routers/alarms.py` |

**Deliverables:**
- [ ] TelemetryAggregation model
- [ ] Hourly/daily/monthly aggregation
- [ ] KPIDefinition model
- [ ] KPI calculation engine
- [ ] All scheduled tasks registered

### Week 3: Device Management (P1)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Config sync service | `services/config_sync_service.py` |
| 2-3 | Certificate service | `services/certificate_service.py` |
| 3-4 | Event service | `services/event_service.py` |
| 4-5 | API endpoints | `routers/config.py`, `routers/events.py` |

**Deliverables:**
- [ ] ConfigSyncService with retry
- [ ] CertificateService with generation
- [ ] DeviceEvent model & service
- [ ] Config and Events API

### Week 4: Advanced Device Features (P2)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Firmware models & service | `services/firmware_service.py` |
| 2-3 | WebSocket realtime service | `services/realtime_service.py` |
| 3-4 | Device discovery | `services/discovery_service.py` |
| 4-5 | API endpoints & WebSocket handler | `routers/firmware.py`, `websocket.py` |

**Deliverables:**
- [ ] Firmware & FirmwareUpdate models
- [ ] OTA update flow
- [ ] WebSocket broadcasting
- [ ] Network device discovery

### Week 5: Enterprise Foundation (P0-P1)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Multi-tenant organization | `services/tenant_service.py` |
| 2-3 | Audit logging | `services/audit_service.py` |
| 3-4 | Workflow rules engine | `services/workflow_engine.py` |
| 4-5 | API rate limiting | `services/rate_limiter.py` |

**Deliverables:**
- [ ] Organization hierarchy
- [ ] Tenant isolation
- [ ] Comprehensive audit trail
- [ ] Workflow automation
- [ ] Rate limiting middleware

### Week 6: Data & Operations (P1-P2)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Export service | `services/export_service.py` |
| 2-3 | Device groups & bulk ops | `services/device_group_service.py` |
| 3-4 | Dashboard & widgets | `services/dashboard_service.py` |
| 4-5 | API endpoints | Multiple routers |

**Deliverables:**
- [ ] CSV/Excel/PDF exports
- [ ] Scheduled exports
- [ ] Device groups
- [ ] Bulk operations
- [ ] Dashboard templates

### Week 7: Business Features (P1-P2)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Report scheduling | `services/report_service.py` |
| 2-3 | Geofencing | `services/geofence_service.py` |
| 3-4 | Maintenance scheduling | `services/maintenance_service.py` |
| 4-5 | Asset lifecycle | `services/lifecycle_service.py` |

**Deliverables:**
- [ ] Scheduled reports with delivery
- [ ] Geofence entry/exit detection
- [ ] Work order management
- [ ] Asset lifecycle tracking

### Week 8: System & Polish (P0-P2)

| Day | Task | Files |
|-----|------|-------|
| 1-2 | Data validation rules | `services/validation_service.py` |
| 2-3 | Backup & restore | `services/backup_service.py` |
| 3-4 | Health monitoring | `services/health_monitor.py` |
| 4 | Notification channels | `services/notification_service.py` |
| 5 | Custom fields | `services/custom_field_service.py` |

**Deliverables:**
- [ ] Telemetry validation
- [ ] Configuration backup/restore
- [ ] System health dashboard
- [ ] Multi-channel notifications
- [ ] Custom field support

---

## Database Schema

### New Tables Summary

```sql
-- Week 1
device_telemetry          -- Time-series telemetry storage
device_alarms             -- Active and historical alarms

-- Week 2
telemetry_aggregations    -- Hourly/daily/monthly rollups
kpi_definitions           -- KPI configuration
kpi_values                -- Calculated KPI values

-- Week 3
device_events             -- Discrete device events
config_sync_history       -- Configuration sync tracking

-- Week 4
firmwares                 -- Firmware versions
firmware_updates          -- Update tracking
discovered_devices        -- Network discovery results

-- Week 5
organizations             -- Multi-tenant hierarchy
organization_quotas       -- Tenant resource limits
audit_logs                -- Audit trail
workflow_rules            -- Automation rules
workflow_executions       -- Rule execution history
rate_limit_configs        -- Rate limit settings

-- Week 6
export_jobs               -- Export tracking
device_groups             -- Device grouping
device_group_members      -- Group membership
dashboards                -- Dashboard definitions
dashboard_widgets         -- Widget configurations

-- Week 7
report_templates          -- Report definitions
scheduled_reports         -- Report schedules
report_history            -- Generated reports
geofences                 -- Geofence polygons
device_locations          -- Location history
maintenance_schedules     -- Preventive maintenance
work_orders               -- Work order tracking
asset_procurements        -- Procurement records
asset_installations       -- Installation records

-- Week 8
validation_rules          -- Data validation
validation_violations     -- Violation records
backups                   -- Backup metadata
system_health_metrics     -- Health snapshots
notification_channels     -- Channel configs
notification_logs         -- Delivery tracking
custom_fields             -- Field definitions
custom_field_values       -- Field values
```

---

## API Endpoints Summary

### Total New Endpoints: 85+

```
# Telemetry (8)
POST   /api/v1/devices/{id}/telemetry
GET    /api/v1/devices/{id}/telemetry
GET    /api/v1/devices/{id}/telemetry/latest
GET    /api/v1/devices/{id}/telemetry/history
GET    /api/v1/devices/{id}/telemetry/aggregated
POST   /api/v1/telemetry/batch
DELETE /api/v1/telemetry/cleanup
GET    /api/v1/telemetry/stats

# Alarms (10)
GET    /api/v1/alarms
GET    /api/v1/alarms/{id}
POST   /api/v1/alarms/{id}/acknowledge
POST   /api/v1/alarms/{id}/clear
GET    /api/v1/devices/{id}/alarms
GET    /api/v1/sites/{id}/alarms
GET    /api/v1/alarms/active
GET    /api/v1/alarms/history
GET    /api/v1/alarms/statistics
POST   /api/v1/alarms/bulk-acknowledge

# Events (5)
GET    /api/v1/events
POST   /api/v1/devices/{id}/events
GET    /api/v1/devices/{id}/events
GET    /api/v1/events/timeline
GET    /api/v1/events/correlated

# KPIs (6)
GET    /api/v1/kpis
POST   /api/v1/kpis
GET    /api/v1/kpis/{id}
PUT    /api/v1/kpis/{id}
DELETE /api/v1/kpis/{id}
GET    /api/v1/kpis/{id}/calculate

# Config Sync (5)
POST   /api/v1/devices/{id}/config/push
GET    /api/v1/devices/{id}/config/status
POST   /api/v1/gateways/{id}/config/push
POST   /api/v1/config/retry-failed
GET    /api/v1/config/sync-history

# Firmware (8)
GET    /api/v1/firmwares
POST   /api/v1/firmwares
GET    /api/v1/firmwares/{id}
DELETE /api/v1/firmwares/{id}
POST   /api/v1/devices/{id}/firmware/update
GET    /api/v1/devices/{id}/firmware/status
POST   /api/v1/devices/{id}/firmware/rollback
GET    /api/v1/devices/{id}/firmware/history

# Organizations (8)
GET    /api/v1/organizations
POST   /api/v1/organizations
GET    /api/v1/organizations/{id}
PUT    /api/v1/organizations/{id}
DELETE /api/v1/organizations/{id}
GET    /api/v1/organizations/{id}/hierarchy
GET    /api/v1/organizations/{id}/usage
PUT    /api/v1/organizations/{id}/quotas

# Audit (5)
GET    /api/v1/audit
GET    /api/v1/audit/user/{id}
GET    /api/v1/audit/resource/{type}/{id}
GET    /api/v1/audit/export
GET    /api/v1/audit/statistics

# Exports (6)
POST   /api/v1/exports
GET    /api/v1/exports
GET    /api/v1/exports/{id}
GET    /api/v1/exports/{id}/download
POST   /api/v1/exports/schedule
GET    /api/v1/exports/scheduled

# Device Groups (8)
GET    /api/v1/device-groups
POST   /api/v1/device-groups
GET    /api/v1/device-groups/{id}
PUT    /api/v1/device-groups/{id}
DELETE /api/v1/device-groups/{id}
POST   /api/v1/device-groups/{id}/command
POST   /api/v1/device-groups/{id}/config
GET    /api/v1/device-groups/{id}/members

# Dashboards (8)
GET    /api/v1/dashboards
POST   /api/v1/dashboards
GET    /api/v1/dashboards/{id}
PUT    /api/v1/dashboards/{id}
DELETE /api/v1/dashboards/{id}
POST   /api/v1/dashboards/{id}/widgets
GET    /api/v1/dashboards/{id}/widgets/{wid}/data
GET    /api/v1/widget-types

# Reports (6)
GET    /api/v1/report-templates
POST   /api/v1/report-templates
POST   /api/v1/reports/generate
GET    /api/v1/reports/{id}
POST   /api/v1/reports/schedule
GET    /api/v1/reports/history

# Health (4)
GET    /api/v1/health
GET    /api/v1/health/services
GET    /api/v1/health/metrics
GET    /api/v1/health/history
```

---

## Testing Strategy

### Unit Tests (Per Service)
- [ ] TelemetryService: store, query, latest, history
- [ ] AlarmEngine: all condition types, duration, auto-clear
- [ ] AggregationService: hourly, daily, monthly
- [ ] KPIEngine: aggregations, formulas
- [ ] ConfigSyncService: push, ack, retry
- [ ] All other services...

### Integration Tests
- [ ] Full telemetry pipeline: MQTT -> Storage -> Alarm -> WebSocket
- [ ] Command flow: Send -> Device -> Ack -> Status
- [ ] Firmware update: Upload -> Schedule -> Push -> Progress -> Complete
- [ ] Multi-tenant isolation
- [ ] Rate limiting enforcement

### Load Tests
- [ ] Telemetry ingestion: 10,000 msg/sec
- [ ] Concurrent WebSocket connections: 1,000
- [ ] Alarm evaluation latency: < 100ms
- [ ] Query performance with 1M+ records

### End-to-End Tests
- [ ] Device onboarding to data visualization
- [ ] Alarm trigger to notification delivery
- [ ] Scheduled report generation and email delivery
- [ ] Backup and restore workflow

---

## Success Metrics

### Functional Completeness
- [ ] 100% Zoho IoT feature parity
- [ ] All 15 enterprise features operational
- [ ] All 85+ API endpoints functional

### Performance
- [ ] Telemetry ingestion: < 50ms latency
- [ ] Alarm evaluation: < 100ms from data receipt
- [ ] Query response: < 200ms for 30-day range
- [ ] WebSocket broadcast: < 20ms latency

### Reliability
- [ ] 99.9% API availability
- [ ] Zero data loss on service restart
- [ ] Automatic recovery from failures

### Security
- [ ] Complete audit trail
- [ ] Tenant data isolation
- [ ] Certificate-based device auth
- [ ] API rate limiting

---

## Dependencies to Add

```txt
# requirements.txt additions

# Time-series
timescaledb-toolkit>=0.1.0  # If using TimescaleDB

# Certificates
cryptography>=41.0.0
pyOpenSSL>=23.0.0

# Geofencing
shapely>=2.0.0

# Export
openpyxl>=3.1.0  # Excel
reportlab>=4.0.0  # PDF
weasyprint>=60.0  # PDF from HTML

# Notifications
twilio>=8.0.0  # SMS
slack-sdk>=3.0.0
pymsteams>=0.2.0  # Teams

# Rate limiting
redis>=5.0.0
```

---

## Conclusion

This plan transforms Save-It.AI into a complete enterprise IoT platform with:

- **45 total features** (18 existing + 27 new)
- **85+ API endpoints**
- **Full Zoho IoT parity** plus enterprise extras
- **8-week implementation timeline**
- **Comprehensive testing strategy**

The result will be a production-ready platform capable of handling enterprise IoT deployments with full device management, real-time monitoring, automation, and business intelligence capabilities.
