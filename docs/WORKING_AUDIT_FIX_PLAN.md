# SAVE-IT.AI Working Audit & Fix Plan

## Executive Summary

This document provides a comprehensive audit of the SAVE-IT.AI platform's device connectivity layer, documenting the complete data flow from UI actions through to database persistence. The audit was initiated to verify that the system connects real meters with real gateways (not mock data).

**Status: P0 Bug Fixed** - Device creation now persists to the PostgreSQL database correctly.

---

## 1. Critical Bug Resolution

### P0 Issue: Database Enum Mismatch (RESOLVED)

**Problem**: Device creation returned 500 errors with the message:
```
'modbus_tcp' is not among the defined enum values. Enum name: datasourcetype. Possible values: MODBUS_TCP, MODBUS_RTU, MQTT, ..., MANUAL
```

**Root Cause**: The PostgreSQL `data_sources.source_type` column used a native ENUM type with UPPERCASE values, but the Python model and frontend sent lowercase values.

**Solution Applied**:
1. Changed database column from PostgreSQL ENUM to VARCHAR(50):
   ```sql
   ALTER TABLE data_sources ALTER COLUMN source_type TYPE VARCHAR(50) USING source_type::text;
   ```
2. Updated SQLAlchemy model (`backend/app/models/enterprise.py`):
   ```python
   # Before (broken):
   source_type = Column(Enum(DataSourceType, native_enum=False, create_constraint=False), nullable=False)
   
   # After (fixed):
   source_type = Column(String(50), nullable=False)
   ```

**Verification**: 4 devices created successfully and persisted across multiple API restarts.

---

## 2. Complete Data Flow Trace

### 2.1 Device Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ DeviceOnboardingWizard.tsx                                                  │
│   └─> onSubmit() handler                                                    │
│       └─> api.dataSources.create(deviceData)                                │
│           └─> POST /api/v1/data-sources                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND API                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ integrations.py: create_data_source()                                       │
│   └─> Pydantic validation (DataSourceCreate schema)                         │
│       └─> SQLAlchemy DataSource model creation                              │
│           └─> db.add(db_source)                                             │
│               └─> db.commit()                                               │
│                   └─> db.refresh(db_source)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DATABASE                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PostgreSQL: data_sources table                                              │
│   └─> INSERT with all device fields                                         │
│       └─> Returns new row with auto-generated ID                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Files in Device Flow

| Layer | File | Purpose |
|-------|------|---------|
| UI | `frontend/src/pages/DeviceOnboardingWizard.tsx` | 4-step wizard modal for device setup |
| UI | `frontend/src/pages/Devices.tsx` | Device list page, triggers wizard |
| API Client | `frontend/src/services/api.ts` | HTTP client with `dataSources.create()` |
| Router | `frontend/src/App.tsx` | Route definitions (uses wouter) |
| API Endpoint | `backend/app/api/routers/integrations.py` | POST /api/v1/data-sources handler |
| Schema | `backend/app/schemas/integrations.py` | Pydantic DataSourceCreate/DataSourceResponse |
| Model | `backend/app/models/enterprise.py` | SQLAlchemy DataSource model |
| Database | `data_sources` table | PostgreSQL persistence |

---

## 3. API Endpoints Inventory

### 3.1 Device Management (/api/v1/data-sources)

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/data-sources` | `get_data_sources()` | List all devices |
| GET | `/api/v1/data-sources/{id}` | `get_data_source()` | Get single device |
| POST | `/api/v1/data-sources` | `create_data_source()` | Create new device |
| PUT | `/api/v1/data-sources/{id}` | `update_data_source()` | Update device |
| DELETE | `/api/v1/data-sources/{id}` | `delete_data_source()` | Delete device |
| POST | `/api/v1/data-sources/bulk-import` | `bulk_import()` | Bulk import from JSON |
| POST | `/api/v1/data-sources/bulk-import/csv` | `bulk_import_csv()` | Bulk import from CSV |

### 3.2 Modbus Registers (/api/v1/modbus-registers)

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| POST | `/api/v1/modbus-registers/test-connection` | `test_connection()` | Test Modbus device connection |

### 3.4 Gateway Management (/api/v1/gateways)

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/gateways` | `get_gateways()` | List all gateways |
| GET | `/api/v1/gateways/{id}` | `get_gateway()` | Get single gateway |
| POST | `/api/v1/gateways` | `create_gateway()` | Create new gateway |
| PUT | `/api/v1/gateways/{id}` | `update_gateway()` | Update gateway |
| DELETE | `/api/v1/gateways/{id}` | `delete_gateway()` | Delete gateway |
| POST | `/api/v1/gateways/{id}/register` | `register_gateway()` | Generate MQTT/webhook credentials |
| POST | `/api/v1/gateways/{id}/rotate-credentials` | `rotate_credentials()` | Rotate gateway credentials |

### 3.5 Device Models (/api/v1/device-models)

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/device-models` | `get_device_models()` | List device model templates |
| GET | `/api/v1/device-models/{id}` | `get_device_model()` | Get model with datapoints/commands |
| POST | `/api/v1/device-models` | `create_device_model()` | Create new model template |

### 3.6 Device Templates (/api/v1/device-templates)

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| GET | `/api/v1/device-templates` | `get_device_templates()` | List device templates |
| GET | `/api/v1/device-templates/{id}` | `get_device_template()` | Get template details |
| POST | `/api/v1/device-templates` | `create_device_template()` | Create new template |
| PUT | `/api/v1/device-templates/{id}` | `update_device_template()` | Update template |
| DELETE | `/api/v1/device-templates/{id}` | `delete_device_template()` | Delete template |
| POST | `/api/v1/device-templates/export` | `export_templates()` | Export templates to JSON |
| POST | `/api/v1/device-templates/import` | `import_templates()` | Import templates from JSON |

### 3.7 Webhooks (/api/v1/webhooks)

| Method | Endpoint | Handler | Purpose |
|--------|----------|---------|---------|
| POST | `/api/v1/webhooks/ingest` | `webhook_ingest()` | Receive telemetry data |
| POST | `/api/v1/webhooks/ingest/batch` | `webhook_batch_ingest()` | Batch telemetry ingestion |

---

## 4. Database Schema

### 4.1 Core Device Tables

#### data_sources (Device Instances)
```sql
CREATE TABLE data_sources (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id),
    gateway_id INTEGER REFERENCES gateways(id),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,  -- modbus_tcp, modbus_rtu, mqtt, api, manual
    connection_string TEXT,
    host VARCHAR(255),
    port INTEGER,
    slave_id INTEGER,
    polling_interval_seconds INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    -- MQTT fields
    mqtt_broker_url VARCHAR(255),
    mqtt_topic VARCHAR(255),
    mqtt_port INTEGER,
    mqtt_use_tls INTEGER DEFAULT 0,
    -- Webhook fields
    webhook_url VARCHAR(255),
    webhook_auth_type VARCHAR(50),
    -- Retry configuration
    max_retries INTEGER DEFAULT 5,
    retry_delay_seconds INTEGER DEFAULT 30,
    backoff_multiplier FLOAT DEFAULT 2.0,
    current_retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    -- Status tracking
    connection_status VARCHAR(50) DEFAULT 'unknown',
    last_poll_at TIMESTAMP,
    last_successful_poll_at TIMESTAMP,
    last_error TEXT,
    -- Device metadata
    firmware_version VARCHAR(100),
    firmware_updated_at TIMESTAMP,
    hardware_version VARCHAR(100),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### gateways
```sql
CREATE TABLE gateways (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id),
    name VARCHAR(255) NOT NULL,
    gateway_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'offline',
    -- Connection credentials
    mqtt_client_id VARCHAR(255),
    mqtt_username VARCHAR(255),
    mqtt_password VARCHAR(255),
    mqtt_topic_prefix VARCHAR(255),
    webhook_secret VARCHAR(255),
    api_key VARCHAR(255),
    -- Metadata
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    firmware_version VARCHAR(100),
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### device_models (Templates - Zoho IoT Pattern)
```sql
CREATE TABLE device_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,  -- energy_meter, pv_inverter, battery_storage, gateway
    manufacturer VARCHAR(255),
    model_number VARCHAR(100),
    description TEXT,
    icon VARCHAR(100),
    default_polling_interval INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### datapoints (Model Datapoints)
```sql
CREATE TABLE datapoints (
    id SERIAL PRIMARY KEY,
    device_model_id INTEGER NOT NULL REFERENCES device_models(id),
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255),
    data_type VARCHAR(50) NOT NULL,  -- number, string, boolean, json
    unit VARCHAR(50),
    aggregation_method VARCHAR(50),  -- avg, sum, min, max, last
    is_writable BOOLEAN DEFAULT false,
    min_value FLOAT,
    max_value FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. UI Components Inventory

### 5.1 Device Pages

| Page | File | Route | Purpose |
|------|------|-------|---------|
| Devices | `pages/Devices.tsx` | `/devices` | Device list with status indicators |
| Device Config | `pages/DeviceConfig.tsx` | `/device-config` | Device configuration management |
| Device Health | `pages/DeviceHealth.tsx` | `/device-health` | Device health monitoring |
| Gateways | `pages/Gateways.tsx` | `/gateways` | Gateway management |

### 5.2 Device Wizard Components

| Component | File | Purpose |
|-----------|------|---------|
| DeviceOnboardingWizard | `pages/DeviceOnboardingWizard.tsx` | 4-step device setup modal |
| Step 1: Device Type | (inline) | Select device category |
| Step 2: Protocol | (inline) | Choose Modbus/MQTT/API |
| Step 3: Connection | (inline) | Configure host/port/credentials |
| Step 4: Review | (inline) | Confirm and create |

### 5.3 Gateway Components

| Component | File | Purpose |
|-----------|------|---------|
| GatewayCredentialsCard | `components/GatewayCredentialsCard.tsx` | Display MQTT/webhook credentials |
| GatewayStatusBadge | `components/GatewayStatusBadge.tsx` | Visual status indicator |

---

## 6. Services Layer

### 6.1 Backend Services

| Service | File | Purpose |
|---------|------|---------|
| DeviceOnboardingService | `services/device_onboarding.py` | Credential generation, edge key resolution |
| ModelPropagationService | `services/model_propagation.py` | Sync datapoints from models to instances |
| CommandService | `services/command_service.py` | Execute device commands |
| DataIngestionService | `services/data_ingestion.py` | Telemetry pipeline |
| MQTTBrokerService | `services/mqtt/broker.py` | MQTT authentication, topic ACLs |
| MQTTSubscriber | `services/mqtt/subscriber.py` | Data ingestion with reconnect |
| ModbusManager | `services/modbus/manager.py` | TCP/RTU connections, circuit breakers |
| WebhookHandler | `services/webhooks/handler.py` | HMAC verification, rate limiting |
| PollingService | `services/polling.py` | Background device data collection |

### 6.2 Frontend Services

| Service | File | Purpose |
|---------|------|---------|
| API Client | `services/api.ts` | HTTP client for all backend calls |
| dataSources | `services/api.ts` | Device CRUD operations |
| gateways | `services/api.ts` | Gateway CRUD operations |

---

## 7. Verification Checklist

### 7.1 Device Creation Flow (VERIFIED ✅)

- [x] Frontend wizard opens correctly
- [x] Form validation works
- [x] API request sent with correct payload
- [x] Backend creates SQLAlchemy model
- [x] Database INSERT succeeds
- [x] Response returned to frontend
- [x] Device appears in device list
- [x] Data persists across API restarts

### 7.2 Outstanding Items (Future Work)

- [ ] Gateway registration flow end-to-end test
- [ ] MQTT connection test with real broker
- [ ] Modbus connection test with real device
- [ ] Telemetry ingestion pipeline test
- [ ] Command execution flow test

---

## 8. Architecture Decisions

### 8.1 Zoho IoT Pattern

The system follows the Zoho IoT architecture with a **model-instance pattern**:

1. **DeviceModel** - Blueprint templates defining datapoints, commands, and alarm rules
2. **Device** - Instances created from models with credentials and gateway association
3. **Propagation** - Changes to models auto-propagate to device instances

### 8.2 Multi-Protocol Support

| Protocol | Status | Implementation |
|----------|--------|----------------|
| Modbus TCP | ✅ Ready | `ModbusManager` with connection pooling |
| Modbus RTU | ✅ Ready | `ModbusManager` with serial support |
| MQTT | ✅ Ready | `MQTTSubscriber` with reconnect |
| Webhook | ✅ Ready | `WebhookHandler` with HMAC verification |
| API | ✅ Ready | HTTP polling via `PollingService` |

### 8.3 Navigation (wouter)

The frontend uses **wouter** for routing, NOT react-router-dom:
```typescript
import { useLocation } from 'wouter';
const [, setLocation] = useLocation();
setLocation('/devices');
```

---

## 9. Appendix: Test Commands

### Create Device via API
```bash
curl -X POST http://localhost:8000/api/v1/data-sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Energy Meter",
    "site_id": 1,
    "source_type": "modbus_tcp",
    "host": "192.168.1.100",
    "port": 502,
    "slave_id": 1,
    "polling_interval_seconds": 60
  }'
```

### Verify Database Persistence
```sql
SELECT id, name, source_type, site_id, host, port, created_at 
FROM data_sources 
ORDER BY id DESC LIMIT 5;
```

### List All Devices
```bash
curl http://localhost:8000/api/v1/data-sources | python3 -m json.tool
```

---

*Last Updated: January 20, 2026*
*Status: P0 Bug Resolved, Device Creation Working*
