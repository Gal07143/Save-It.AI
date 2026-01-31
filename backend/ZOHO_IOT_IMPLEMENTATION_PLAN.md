# Save-It.AI - Zoho IoT Feature Parity Implementation Plan

## Executive Summary

This plan transforms Save-It.AI's backend to achieve 100% feature parity with Zoho IoT's core capabilities while preserving the existing frontend/UI. The system already has solid foundations; this plan fills the remaining gaps.

---

## Current State Analysis

### Already Implemented (Solid Foundation)

| Feature | Status | Location |
|---------|--------|----------|
| Device Models (blueprints) | Complete | `models/devices.py` |
| Device Types (Gateway, Peripheral, Smart Sensor, API) | Complete | `DeviceType` enum |
| Datapoints with aggregation | Complete | `Datapoint` model |
| Commands with 6 input types | Complete | `Command` model |
| Command Execution & Ack | Complete | `services/command_service.py` |
| Alarm Rules (model) | Complete | `AlarmRule` model |
| Device Policies | Complete | `DevicePolicy` model |
| Device Certificates (model) | Complete | `DeviceCertificate` model |
| MQTT Broker | Complete | `services/mqtt_broker.py` |
| MQTT Subscriber | Complete | `services/mqtt_subscriber.py` |
| Polling Service | Complete | `services/polling_service.py` |
| Webhook Service | Complete | `services/webhook_service.py` |
| Scheduler Service | Complete | `services/scheduler_service.py` |
| Device Onboarding | Complete | `services/device_onboarding.py` |
| Edge Key Resolution | Complete | `EdgeKeyResolver` class |
| RemoteModbusConfig (model) | Complete | `models/devices.py` |
| Device Status Monitor | Complete | `services/device_status_monitor.py` |
| Modbus Register CRUD | Complete | `routers/modbus_registers.py` |
| Gateway Management | Complete | `routers/gateways.py` |

### Gaps to Fill (This Plan)

| Feature | Priority | Effort |
|---------|----------|--------|
| Alarm Evaluation Engine | P0 | Medium |
| Telemetry Storage & Query | P0 | High |
| KPI Calculation Engine | P1 | Medium |
| Configuration Sync to Edge | P1 | Medium |
| Certificate Generation | P1 | Low |
| Data Aggregation Service | P1 | Medium |
| Device Event Processing | P2 | Medium |
| Firmware OTA Service | P2 | High |
| Device Discovery | P3 | Medium |
| Real-time WebSocket Updates | P2 | Low |

---

## Phase 1: Core Data Pipeline (P0)

### 1.1 Telemetry Storage Service
**File:** `/backend/app/services/telemetry_service.py`

```python
"""
Telemetry Storage Service
- Stores device telemetry in time-series format
- Supports raw data + aggregated rollups
- Provides efficient time-range queries
"""

class TelemetryService:
    """
    Handles storage and retrieval of device telemetry data.
    Works with TimescaleDB hypertables for efficient time-series storage.
    """

    def store_telemetry(self, device_id: int, datapoints: Dict[str, Any], timestamp: datetime = None)
    def store_batch(self, telemetry_batch: List[TelemetryRecord])
    def query_telemetry(self, device_id: int, datapoint_names: List[str],
                        start_time: datetime, end_time: datetime,
                        aggregation: str = None, interval: str = None)
    def get_latest_values(self, device_id: int) -> Dict[str, TelemetryValue]
    def get_datapoint_history(self, device_id: int, datapoint_name: str,
                              limit: int = 1000) -> List[TelemetryValue]
```

**New Model:** `DeviceTelemetry` (enhanced)
```python
class DeviceTelemetry(Base):
    __tablename__ = "device_telemetry"

    id = Column(BigInteger, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    datapoint_id = Column(Integer, ForeignKey("datapoints.id"), nullable=True)
    datapoint_name = Column(String(100), nullable=False, index=True)
    value_numeric = Column(Float, nullable=True)
    value_string = Column(String(500), nullable=True)
    value_boolean = Column(Integer, nullable=True)
    quality = Column(String(20), default="good")  # good, bad, stale, unknown
    timestamp = Column(DateTime, nullable=False, index=True)
    received_at = Column(DateTime, default=datetime.utcnow)
    source = Column(String(50), default="mqtt")  # mqtt, api, polling, manual

    __table_args__ = (
        Index('ix_telemetry_device_time', 'device_id', 'timestamp'),
        Index('ix_telemetry_datapoint_time', 'datapoint_name', 'timestamp'),
    )
```

### 1.2 Alarm Evaluation Engine
**File:** `/backend/app/services/alarm_engine.py`

```python
"""
Alarm Evaluation Engine
- Evaluates alarm rules against incoming telemetry
- Supports all Zoho IoT condition types
- Handles duration-based alarms
- Triggers notifications and actions
"""

class AlarmEngine:
    """
    Real-time alarm evaluation engine.
    Processes telemetry and evaluates against configured alarm rules.
    """

    def __init__(self, db: Session, notification_service, webhook_service):
        self.db = db
        self.notification_service = notification_service
        self.webhook_service = webhook_service
        self._active_alarms: Dict[str, ActiveAlarm] = {}
        self._duration_trackers: Dict[str, DurationTracker] = {}

    def evaluate_telemetry(self, device_id: int, datapoint_name: str, value: Any):
        """Evaluate all applicable alarm rules for a datapoint value."""

    def _evaluate_condition(self, rule: AlarmRule, value: Any) -> bool:
        """Evaluate a single alarm condition."""
        # Supports: gt, lt, eq, neq, gte, lte, between, outside, change, no_data

    def _handle_alarm_triggered(self, device_id: int, rule: AlarmRule, value: Any):
        """Handle alarm trigger - create alarm record, send notifications."""

    def _handle_alarm_cleared(self, alarm: ActiveAlarm):
        """Handle alarm clear - update record, send clear notification."""

    def check_no_data_alarms(self):
        """Scheduled task to check for no-data alarm conditions."""

    def get_active_alarms(self, device_id: int = None, site_id: int = None) -> List[ActiveAlarm]
    def acknowledge_alarm(self, alarm_id: int, user_id: int, notes: str = None)
    def clear_alarm(self, alarm_id: int, user_id: int = None, auto: bool = False)
```

**New Model:** `DeviceAlarm`
```python
class DeviceAlarm(Base):
    __tablename__ = "device_alarms"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    rule_id = Column(Integer, ForeignKey("alarm_rules.id"), nullable=False)
    datapoint_name = Column(String(100), nullable=True)

    severity = Column(String(20), nullable=False)  # info, warning, error, critical
    status = Column(String(20), default="active")  # active, acknowledged, cleared

    trigger_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    message = Column(Text, nullable=True)

    triggered_at = Column(DateTime, default=datetime.utcnow, index=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    cleared_at = Column(DateTime, nullable=True)
    cleared_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    auto_cleared = Column(Integer, default=0)

    notes = Column(Text, nullable=True)
```

### 1.3 Data Ingestion Enhancement
**File:** `/backend/app/services/data_ingestion.py` (enhance existing)

Add alarm evaluation integration:
```python
class DataIngestionService:
    def __init__(self, db: Session):
        self.db = db
        self.telemetry_service = TelemetryService(db)
        self.alarm_engine = AlarmEngine(db, notification_service, webhook_service)

    def ingest_telemetry(self, device_id: int, datapoints: Dict[str, Any], ...):
        # 1. Store telemetry
        self.telemetry_service.store_telemetry(device_id, datapoints, timestamp)

        # 2. Update device status
        self._update_device_status(device_id)

        # 3. Evaluate alarms
        for name, value in datapoints.items():
            self.alarm_engine.evaluate_telemetry(device_id, name, value)

        # 4. Broadcast via WebSocket
        self._broadcast_update(device_id, datapoints)
```

---

## Phase 2: Advanced Features (P1)

### 2.1 KPI Calculation Engine
**File:** `/backend/app/services/kpi_engine.py`

```python
"""
KPI Calculation Engine
- Computes aggregated metrics from telemetry
- Supports scheduled and real-time KPIs
- Handles formulas and derived values
"""

class KPIEngine:
    """
    Calculates Key Performance Indicators from device telemetry.
    """

    def calculate_kpi(self, kpi_config: KPIConfig, device_ids: List[int],
                      time_range: TimeRange) -> KPIResult

    def calculate_aggregation(self, device_id: int, datapoint_name: str,
                              aggregation: str, time_range: TimeRange) -> float

    def calculate_formula(self, formula: str, variables: Dict[str, float]) -> float

    def schedule_kpi_calculation(self, kpi_id: int, schedule: str)
```

**New Model:** `KPIDefinition`
```python
class KPIDefinition(Base):
    __tablename__ = "kpi_definitions"

    id = Column(Integer, primary_key=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True)
    model_id = Column(Integer, ForeignKey("device_models.id"), nullable=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    formula = Column(Text, nullable=True)  # e.g., "SUM(energy_consumed) / COUNT(devices)"
    aggregation = Column(String(20), nullable=True)  # sum, avg, min, max
    datapoint_name = Column(String(100), nullable=True)

    calculation_interval = Column(String(20), default="hourly")  # realtime, hourly, daily
    retention_days = Column(Integer, default=365)

    unit = Column(String(50), nullable=True)
    precision = Column(Integer, default=2)

    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### 2.2 Configuration Sync Service
**File:** `/backend/app/services/config_sync_service.py`

```python
"""
Configuration Sync Service
- Pushes configuration changes to edge devices
- Tracks sync status per device
- Handles retry and rollback
"""

class ConfigSyncService:
    """
    Synchronizes configuration from cloud to edge devices/gateways.
    """

    def push_config(self, device_id: int, config_type: str = "full"):
        """Push configuration to a device."""

    def push_modbus_config(self, config: RemoteModbusConfig):
        """Push Modbus register configuration to gateway."""

    def push_alarm_rules(self, device_id: int):
        """Push alarm rules for edge evaluation."""

    def get_sync_status(self, device_id: int) -> ConfigSyncStatus

    def handle_sync_ack(self, device_id: int, correlation_id: str, success: bool, error: str = None)

    def retry_failed_syncs(self):
        """Scheduled task to retry failed configuration syncs."""
```

### 2.3 Certificate Management Service
**File:** `/backend/app/services/certificate_service.py`

```python
"""
Certificate Management Service
- Generates device certificates
- Validates certificate chains
- Handles revocation
"""

class CertificateService:
    """
    Manages X.509 certificates for device authentication.
    """

    def generate_device_certificate(self, device_id: int, validity_days: int = 365) -> CertificateBundle
    def revoke_certificate(self, certificate_id: int, reason: str)
    def validate_certificate(self, certificate_pem: str) -> ValidationResult
    def get_ca_certificate(self) -> str
    def rotate_certificate(self, device_id: int) -> CertificateBundle
```

### 2.4 Data Aggregation Service
**File:** `/backend/app/services/aggregation_service.py`

```python
"""
Data Aggregation Service
- Creates hourly/daily/monthly rollups
- Optimizes query performance
- Manages data retention
"""

class AggregationService:
    """
    Creates time-based aggregations of telemetry data.
    """

    async def aggregate_hourly(self):
        """Create hourly aggregations from raw telemetry."""

    async def aggregate_daily(self):
        """Create daily aggregations from hourly data."""

    async def aggregate_monthly(self):
        """Create monthly aggregations from daily data."""

    async def cleanup_old_data(self, retention_policy: RetentionPolicy):
        """Remove data older than retention period."""
```

**New Model:** `TelemetryAggregation`
```python
class TelemetryAggregation(Base):
    __tablename__ = "telemetry_aggregations"

    id = Column(BigInteger, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    datapoint_name = Column(String(100), nullable=False)

    period_type = Column(String(20), nullable=False)  # hourly, daily, monthly
    period_start = Column(DateTime, nullable=False)
    period_end = Column(DateTime, nullable=False)

    value_min = Column(Float, nullable=True)
    value_max = Column(Float, nullable=True)
    value_avg = Column(Float, nullable=True)
    value_sum = Column(Float, nullable=True)
    value_count = Column(Integer, default=0)
    value_first = Column(Float, nullable=True)
    value_last = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('device_id', 'datapoint_name', 'period_type', 'period_start'),
        Index('ix_agg_device_period', 'device_id', 'period_type', 'period_start'),
    )
```

---

## Phase 3: Extended Features (P2)

### 3.1 Device Event Service
**File:** `/backend/app/services/event_service.py`

```python
"""
Device Event Service
- Handles discrete device events (vs continuous telemetry)
- Event types: state_change, alarm, maintenance, audit
- Supports event correlation and grouping
"""

class EventService:
    """
    Manages device events distinct from telemetry.
    """

    def log_event(self, device_id: int, event_type: str, severity: str,
                  title: str, message: str = None, data: Dict = None)

    def get_events(self, device_id: int = None, event_type: str = None,
                   severity: str = None, start_time: datetime = None,
                   end_time: datetime = None, limit: int = 100) -> List[DeviceEvent]

    def correlate_events(self, device_id: int, time_window_seconds: int = 60) -> List[EventGroup]
```

**New Model:** `DeviceEvent`
```python
class DeviceEvent(Base):
    __tablename__ = "device_events"

    id = Column(BigInteger, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)

    event_type = Column(String(50), nullable=False, index=True)  # state_change, alarm, maintenance, audit
    severity = Column(String(20), default="info")  # info, warning, error, critical

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    data_json = Column(Text, nullable=True)  # Additional structured data

    correlation_id = Column(String(100), nullable=True, index=True)
    source = Column(String(50), default="device")  # device, system, user

    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
```

### 3.2 Firmware OTA Service
**File:** `/backend/app/services/firmware_service.py`

```python
"""
Firmware Over-The-Air Update Service
- Manages firmware versions
- Schedules and tracks updates
- Handles rollback
"""

class FirmwareService:
    """
    Manages firmware updates for devices.
    """

    def upload_firmware(self, product_id: int, version: str, file: bytes,
                        release_notes: str = None) -> Firmware

    def schedule_update(self, device_ids: List[int], firmware_id: int,
                        scheduled_at: datetime = None) -> FirmwareUpdateJob

    def push_update(self, device_id: int, firmware_id: int)

    def handle_update_status(self, device_id: int, status: str, progress: int = None,
                             error: str = None)

    def rollback(self, device_id: int)

    def get_update_history(self, device_id: int) -> List[FirmwareUpdateRecord]
```

**New Models:**
```python
class Firmware(Base):
    __tablename__ = "firmwares"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("device_products.id"), nullable=False)
    version = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    checksum = Column(String(64), nullable=False)  # SHA256
    release_notes = Column(Text, nullable=True)
    is_stable = Column(Integer, default=0)
    is_active = Column(Integer, default=1)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)

class FirmwareUpdate(Base):
    __tablename__ = "firmware_updates"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    firmware_id = Column(Integer, ForeignKey("firmwares.id"), nullable=False)

    status = Column(String(20), default="pending")  # pending, downloading, installing, completed, failed, rolled_back
    progress = Column(Integer, default=0)  # 0-100

    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    previous_version = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)
```

### 3.3 WebSocket Real-time Updates
**File:** `/backend/app/services/realtime_service.py`

```python
"""
Real-time Update Service
- Broadcasts telemetry updates via WebSocket
- Supports room-based subscriptions (device, site, asset)
- Handles reconnection and message buffering
"""

class RealtimeService:
    """
    Manages real-time data broadcasting via WebSocket.
    """

    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._subscriptions: Dict[str, Set[str]] = {}  # connection_id -> set of topics

    async def connect(self, websocket: WebSocket, client_id: str)
    async def disconnect(self, client_id: str)

    async def subscribe(self, client_id: str, topics: List[str])
    async def unsubscribe(self, client_id: str, topics: List[str])

    async def broadcast_telemetry(self, device_id: int, datapoints: Dict[str, Any])
    async def broadcast_alarm(self, alarm: DeviceAlarm)
    async def broadcast_event(self, event: DeviceEvent)
    async def broadcast_status(self, device_id: int, is_online: bool)
```

---

## Phase 4: Optional Enhancements (P3)

### 4.1 Device Discovery Service
**File:** `/backend/app/services/discovery_service.py`

```python
"""
Device Discovery Service
- Scans network for Modbus devices
- Auto-detects device types
- Suggests configurations
"""

class DiscoveryService:
    """
    Auto-discovers devices on the network.
    """

    async def scan_network(self, ip_range: str, port: int = 502) -> List[DiscoveredDevice]
    async def probe_modbus_device(self, host: str, port: int, slave_ids: List[int]) -> DeviceProbe
    async def identify_device(self, host: str, port: int, slave_id: int) -> DeviceIdentification
    async def suggest_template(self, device_info: DeviceIdentification) -> Optional[DeviceTemplate]
```

### 4.2 Workflow Rules Engine
**File:** `/backend/app/services/workflow_engine.py`

```python
"""
Workflow Rules Engine
- Triggers actions based on conditions
- Supports complex rule chains
- Integrates with external systems
"""

class WorkflowEngine:
    """
    Executes workflow rules based on triggers.
    """

    def register_rule(self, rule: WorkflowRule)
    def evaluate_trigger(self, trigger_type: str, context: Dict[str, Any])
    def execute_actions(self, rule: WorkflowRule, context: Dict[str, Any])
```

---

## API Endpoints to Add

### Telemetry API
```
POST /api/v1/devices/{device_id}/telemetry    # Ingest telemetry (webhook)
GET  /api/v1/devices/{device_id}/telemetry    # Query telemetry
GET  /api/v1/devices/{device_id}/telemetry/latest  # Latest values
GET  /api/v1/devices/{device_id}/telemetry/history # Time-series history
```

### Alarms API
```
GET  /api/v1/alarms                           # List active alarms
GET  /api/v1/alarms/{alarm_id}                # Get alarm details
POST /api/v1/alarms/{alarm_id}/acknowledge    # Acknowledge alarm
POST /api/v1/alarms/{alarm_id}/clear          # Clear alarm
GET  /api/v1/devices/{device_id}/alarms       # Device alarms
GET  /api/v1/sites/{site_id}/alarms           # Site alarms
```

### Events API
```
GET  /api/v1/events                           # List events
POST /api/v1/devices/{device_id}/events       # Log device event
GET  /api/v1/devices/{device_id}/events       # Device events
```

### KPIs API
```
GET  /api/v1/kpis                             # List KPI definitions
POST /api/v1/kpis                             # Create KPI
GET  /api/v1/kpis/{kpi_id}/calculate          # Calculate KPI value
GET  /api/v1/devices/{device_id}/kpis         # Device KPI values
```

### Firmware API
```
GET  /api/v1/firmwares                        # List firmware versions
POST /api/v1/firmwares                        # Upload firmware
POST /api/v1/devices/{device_id}/firmware/update  # Schedule update
GET  /api/v1/devices/{device_id}/firmware/status  # Update status
```

### Config Sync API
```
POST /api/v1/devices/{device_id}/config/push  # Push config to device
GET  /api/v1/devices/{device_id}/config/status # Sync status
POST /api/v1/gateways/{gateway_id}/config/push # Push to gateway
```

---

## Database Migrations

### Migration 1: Telemetry Tables
```sql
-- Raw telemetry (consider TimescaleDB hypertable)
CREATE TABLE device_telemetry (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id),
    datapoint_id INTEGER REFERENCES datapoints(id),
    datapoint_name VARCHAR(100) NOT NULL,
    value_numeric DOUBLE PRECISION,
    value_string VARCHAR(500),
    value_boolean INTEGER,
    quality VARCHAR(20) DEFAULT 'good',
    timestamp TIMESTAMP NOT NULL,
    received_at TIMESTAMP DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'mqtt'
);

CREATE INDEX ix_telemetry_device_time ON device_telemetry(device_id, timestamp);
CREATE INDEX ix_telemetry_datapoint_time ON device_telemetry(datapoint_name, timestamp);

-- Aggregations
CREATE TABLE telemetry_aggregations (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id),
    datapoint_name VARCHAR(100) NOT NULL,
    period_type VARCHAR(20) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    value_min DOUBLE PRECISION,
    value_max DOUBLE PRECISION,
    value_avg DOUBLE PRECISION,
    value_sum DOUBLE PRECISION,
    value_count INTEGER DEFAULT 0,
    value_first DOUBLE PRECISION,
    value_last DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(device_id, datapoint_name, period_type, period_start)
);
```

### Migration 2: Alarm Tables
```sql
CREATE TABLE device_alarms (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id),
    rule_id INTEGER NOT NULL REFERENCES alarm_rules(id),
    datapoint_name VARCHAR(100),
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    trigger_value DOUBLE PRECISION,
    threshold_value DOUBLE PRECISION,
    message TEXT,
    triggered_at TIMESTAMP DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES users(id),
    cleared_at TIMESTAMP,
    cleared_by INTEGER REFERENCES users(id),
    auto_cleared INTEGER DEFAULT 0,
    notes TEXT
);

CREATE INDEX ix_alarms_device ON device_alarms(device_id);
CREATE INDEX ix_alarms_status ON device_alarms(status);
CREATE INDEX ix_alarms_triggered ON device_alarms(triggered_at);
```

### Migration 3: Events & KPIs
```sql
CREATE TABLE device_events (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    data_json TEXT,
    correlation_id VARCHAR(100),
    source VARCHAR(50) DEFAULT 'device',
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_events_device ON device_events(device_id);
CREATE INDEX ix_events_type ON device_events(event_type);
CREATE INDEX ix_events_timestamp ON device_events(timestamp);

CREATE TABLE kpi_definitions (
    id SERIAL PRIMARY KEY,
    site_id INTEGER REFERENCES sites(id),
    model_id INTEGER REFERENCES device_models(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    formula TEXT,
    aggregation VARCHAR(20),
    datapoint_name VARCHAR(100),
    calculation_interval VARCHAR(20) DEFAULT 'hourly',
    retention_days INTEGER DEFAULT 365,
    unit VARCHAR(50),
    precision INTEGER DEFAULT 2,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Migration 4: Firmware Tables
```sql
CREATE TABLE firmwares (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES device_products(id),
    version VARCHAR(50) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    release_notes TEXT,
    is_stable INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    uploaded_at TIMESTAMP DEFAULT NOW(),
    uploaded_by INTEGER REFERENCES users(id)
);

CREATE TABLE firmware_updates (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id),
    firmware_id INTEGER NOT NULL REFERENCES firmwares(id),
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    previous_version VARCHAR(50),
    error_message TEXT
);
```

---

## Scheduled Tasks to Register

```python
# In scheduler_service.py - register_default_tasks()

# Alarm evaluation for no-data conditions
scheduler_service.add_task(
    "check_no_data_alarms",
    "Check No-Data Alarms",
    alarm_engine.check_no_data_alarms,
    ScheduleType.INTERVAL,
    interval_minutes=5,
)

# Device offline detection
scheduler_service.add_task(
    "device_offline_check",
    "Device Offline Detection",
    device_status_monitor.check_device_offline_status,
    ScheduleType.INTERVAL,
    interval_minutes=1,
)

# Hourly aggregation
scheduler_service.add_task(
    "hourly_aggregation",
    "Hourly Data Aggregation",
    aggregation_service.aggregate_hourly,
    ScheduleType.INTERVAL,
    interval_minutes=60,
)

# Daily aggregation
scheduler_service.add_task(
    "daily_aggregation",
    "Daily Data Aggregation",
    aggregation_service.aggregate_daily,
    ScheduleType.DAILY,
    run_at_hour=1,
    run_at_minute=0,
)

# Monthly aggregation
scheduler_service.add_task(
    "monthly_aggregation",
    "Monthly Data Aggregation",
    aggregation_service.aggregate_monthly,
    ScheduleType.MONTHLY,
    day_of_month=1,
    run_at_hour=2,
)

# Config sync retry
scheduler_service.add_task(
    "config_sync_retry",
    "Retry Failed Config Syncs",
    config_sync_service.retry_failed_syncs,
    ScheduleType.INTERVAL,
    interval_minutes=15,
)

# Command timeout check
scheduler_service.add_task(
    "command_timeout",
    "Timeout Stale Commands",
    command_service.timeout_stale_commands,
    ScheduleType.INTERVAL,
    interval_minutes=1,
)
```

---

## Implementation Order

### Week 1: Core Pipeline
1. Create `DeviceTelemetry` model and migration
2. Implement `TelemetryService`
3. Create `DeviceAlarm` model and migration
4. Implement `AlarmEngine`
5. Integrate alarm evaluation into data ingestion
6. Add telemetry and alarm API endpoints

### Week 2: Advanced Data
1. Create aggregation models and migration
2. Implement `AggregationService`
3. Create KPI models
4. Implement `KPIEngine`
5. Register scheduled aggregation tasks
6. Add KPI API endpoints

### Week 3: Device Management
1. Implement `ConfigSyncService`
2. Implement `CertificateService`
3. Create event models
4. Implement `EventService`
5. Add config sync and events API endpoints

### Week 4: Extended Features
1. Create firmware models
2. Implement `FirmwareService`
3. Implement `RealtimeService` (WebSocket)
4. Add firmware and WebSocket endpoints
5. Integration testing

### Week 5: Polish & Testing
1. Device discovery service (optional)
2. Workflow engine (optional)
3. End-to-end testing
4. Performance optimization
5. Documentation

---

## Testing Checklist

### Telemetry Pipeline
- [ ] MQTT telemetry ingestion works
- [ ] Webhook telemetry ingestion works
- [ ] Telemetry stored correctly with timestamps
- [ ] Telemetry query with time ranges works
- [ ] Latest values endpoint returns correct data

### Alarm System
- [ ] Alarm triggers on threshold violation
- [ ] Duration-based alarms work correctly
- [ ] No-data alarms trigger after timeout
- [ ] Alarm auto-clear works
- [ ] Notifications sent on alarm trigger/clear
- [ ] Alarm acknowledgment works

### Aggregation
- [ ] Hourly aggregation creates correct rollups
- [ ] Daily aggregation works
- [ ] Monthly aggregation works
- [ ] Query with aggregation returns correct values

### Commands
- [ ] Command sent via MQTT
- [ ] Command acknowledgment processed
- [ ] Command timeout works
- [ ] Command history accurate

### Config Sync
- [ ] Config push to device works
- [ ] Sync status tracked correctly
- [ ] Failed sync retry works
- [ ] Modbus config push works

---

## Success Criteria

After implementation, Save-It.AI should support:

1. **100% Zoho IoT Data Model Parity**
   - Device Models with Datapoints, Commands, Alarm Rules
   - Device hierarchy (Gateway -> Peripheral)
   - Asset and Location linking

2. **Real-time Data Pipeline**
   - MQTT telemetry ingestion < 100ms latency
   - WebSocket broadcast < 50ms latency
   - Alarm evaluation < 200ms from data receipt

3. **Complete Command Flow**
   - Send command -> Device receives -> Execute -> Ack -> Cloud updates
   - Two-way acknowledgment like Zoho IoT

4. **Alarm System**
   - All Zoho IoT condition types supported
   - Duration-based alarms
   - Auto-clear capability
   - Notification integration

5. **Data Management**
   - Time-series storage with efficient queries
   - Hourly/Daily/Monthly aggregations
   - Data retention policies

6. **Edge Configuration**
   - Push config to gateways
   - Sync status tracking
   - Retry failed syncs
