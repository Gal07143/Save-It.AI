# Devices & Gateways API

Devices and gateways handle IoT data collection. Gateways are edge devices that connect to the platform via MQTT, while devices (data sources) are individual sensors or meters connected to gateways.

## Gateways API

Base URL: `/api/v1/gateways`

### List Gateways

Get all gateways for a site.

```
GET /api/v1/gateways?site_id={site_id}
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `site_id` | integer | Yes | Site to list gateways for |

**Response:**
```json
[
  {
    "id": 1,
    "site_id": 1,
    "name": "Gateway-001",
    "serial_number": "GW-2024-001",
    "model": "SaveIt Edge Pro",
    "firmware_version": "2.1.0",
    "status": "online",
    "last_seen_at": "2024-01-24T10:30:00Z",
    "ip_address": "192.168.1.100",
    "is_active": true,
    "mqtt_username": "gw_abc123",
    "created_at": "2024-01-20T08:00:00Z"
  }
]
```

### Get Gateway

Get a specific gateway.

```
GET /api/v1/gateways/{gateway_id}
```

**Response:**
```json
{
  "id": 1,
  "site_id": 1,
  "name": "Gateway-001",
  "serial_number": "GW-2024-001",
  "model": "SaveIt Edge Pro",
  "firmware_version": "2.1.0",
  "status": "online",
  "last_seen_at": "2024-01-24T10:30:00Z",
  "ip_address": "192.168.1.100",
  "config": {
    "poll_interval_seconds": 60,
    "mqtt_keepalive": 30
  },
  "is_active": true,
  "created_at": "2024-01-20T08:00:00Z"
}
```

### Create Gateway

Register a new gateway.

```
POST /api/v1/gateways
```

**Request Body:**
```json
{
  "site_id": 1,
  "name": "Gateway-001",
  "serial_number": "GW-2024-001",
  "model": "SaveIt Edge Pro",
  "firmware_version": "2.1.0"
}
```

**Response:**
```json
{
  "id": 1,
  "site_id": 1,
  "name": "Gateway-001",
  "serial_number": "GW-2024-001",
  "mqtt_username": "gw_abc123",
  "mqtt_password": "generated_secure_password",
  "mqtt_topic_prefix": "saveit/gw/1/",
  "created_at": "2024-01-24T10:30:00Z"
}
```

Note: `mqtt_password` is only returned on creation.

### Update Gateway

Update gateway configuration.

```
PUT /api/v1/gateways/{gateway_id}
```

**Request Body:**
```json
{
  "name": "Gateway-001-Updated",
  "firmware_version": "2.2.0",
  "config": {
    "poll_interval_seconds": 30
  }
}
```

### Delete Gateway

Remove a gateway and all associated devices.

```
DELETE /api/v1/gateways/{gateway_id}
```

### Regenerate MQTT Credentials

Generate new MQTT credentials for a gateway.

```
POST /api/v1/gateways/{gateway_id}/regenerate-credentials
```

**Response:**
```json
{
  "mqtt_username": "gw_def456",
  "mqtt_password": "new_secure_password",
  "mqtt_topic_prefix": "saveit/gw/1/"
}
```

## Devices (Data Sources) API

Base URL: `/api/v1/devices`

### List Devices

Get all devices for a gateway.

```
GET /api/v1/devices?gateway_id={gateway_id}
```

**Response:**
```json
[
  {
    "id": 1,
    "gateway_id": 1,
    "meter_id": 1,
    "name": "Power Meter 1",
    "device_type": "modbus",
    "address": "1",
    "protocol": "modbus_tcp",
    "status": "active",
    "last_reading_at": "2024-01-24T10:29:00Z",
    "config": {
      "slave_id": 1,
      "baud_rate": 9600
    },
    "is_active": true,
    "created_at": "2024-01-20T08:00:00Z"
  }
]
```

### Get Device

Get a specific device.

```
GET /api/v1/devices/{device_id}
```

### Create Device

Add a new device to a gateway.

```
POST /api/v1/devices
```

**Request Body:**
```json
{
  "gateway_id": 1,
  "meter_id": 1,
  "name": "Power Meter 1",
  "device_type": "modbus",
  "address": "1",
  "protocol": "modbus_tcp",
  "config": {
    "slave_id": 1,
    "baud_rate": 9600
  }
}
```

### Update Device

Update device configuration.

```
PUT /api/v1/devices/{device_id}
```

### Delete Device

Remove a device.

```
DELETE /api/v1/devices/{device_id}
```

### Get Device Health

Get device health and connectivity status.

```
GET /api/v1/devices/{device_id}/health
```

**Response:**
```json
{
  "device_id": 1,
  "status": "healthy",
  "last_reading_at": "2024-01-24T10:29:00Z",
  "readings_last_hour": 60,
  "error_rate": 0.02,
  "latency_ms": 45,
  "uptime_percent": 99.8
}
```

## Device Types

| Type | Description |
|------|-------------|
| `modbus` | Modbus RTU/TCP devices |
| `mqtt` | Native MQTT sensors |
| `api` | REST API integrations |
| `snmp` | SNMP-enabled devices |
| `bacnet` | BACnet devices |

## Protocols

| Protocol | Description |
|----------|-------------|
| `modbus_tcp` | Modbus over TCP/IP |
| `modbus_rtu` | Modbus RTU (serial) |
| `mqtt` | MQTT protocol |
| `http` | HTTP/REST API |

## Device Status

| Status | Description |
|--------|-------------|
| `active` | Device is online and reporting |
| `inactive` | Device is configured but not reporting |
| `error` | Device has communication errors |
| `maintenance` | Device is under maintenance |

## MQTT Integration

### Topics

Gateways publish data to:
```
saveit/gw/{gateway_id}/data
saveit/gw/{gateway_id}/status
```

Gateways subscribe to:
```
saveit/gw/{gateway_id}/config
saveit/gw/{gateway_id}/command
```

### Data Format

```json
{
  "device_id": "device_1",
  "timestamp": "2024-01-24T10:30:00Z",
  "readings": {
    "active_power": 125.5,
    "reactive_power": 45.2,
    "voltage": 230.1,
    "current": 5.4
  }
}
```

### Status Format

```json
{
  "gateway_id": 1,
  "status": "online",
  "uptime_seconds": 86400,
  "device_count": 5,
  "devices": {
    "device_1": "active",
    "device_2": "error"
  }
}
```

## Onboarding Flow

1. **Create Gateway** - Register gateway and receive MQTT credentials
2. **Configure Gateway** - Apply credentials to physical gateway
3. **Gateway Connects** - Gateway establishes MQTT connection
4. **Add Devices** - Configure devices connected to gateway
5. **Link to Meters** - Associate devices with meter entities
6. **Data Flows** - Device readings are ingested and stored

## Error Handling

```json
{
  "detail": "Gateway not found"
}
```

Common errors:
- `404` - Gateway/Device not found
- `400` - Invalid configuration
- `409` - Serial number already exists
