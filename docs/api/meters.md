# Meters API

Meters represent physical or virtual energy measurement points. They store time-series data and are used for billing, analysis, and reporting.

Base URL: `/api/v1/meters`

## Endpoints

### List Meters

Get all meters for a site.

```
GET /api/v1/meters?site_id={site_id}
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `site_id` | integer | Yes | Site to list meters for |
| `meter_type` | string | No | Filter by meter type |
| `skip` | integer | No | Pagination offset |
| `limit` | integer | No | Page size (max 100) |

**Response:**
```json
[
  {
    "id": 1,
    "site_id": 1,
    "asset_id": 5,
    "name": "Main Electrical Meter",
    "meter_type": "electricity",
    "unit": "kWh",
    "meter_number": "EM-001",
    "is_main_meter": true,
    "is_virtual": false,
    "status": "active",
    "multiplier": 1.0,
    "last_reading_value": 125430.5,
    "last_reading_at": "2024-01-24T10:30:00Z",
    "created_at": "2024-01-20T08:00:00Z"
  }
]
```

### Get Meter

Get a specific meter with full details.

```
GET /api/v1/meters/{meter_id}
```

**Response:**
```json
{
  "id": 1,
  "site_id": 1,
  "asset_id": 5,
  "name": "Main Electrical Meter",
  "meter_type": "electricity",
  "unit": "kWh",
  "meter_number": "EM-001",
  "is_main_meter": true,
  "is_virtual": false,
  "status": "active",
  "multiplier": 1.0,
  "ct_ratio": 100,
  "pt_ratio": 1,
  "config": {
    "reading_interval": 900
  },
  "last_reading_value": 125430.5,
  "last_reading_at": "2024-01-24T10:30:00Z",
  "data_source": {
    "id": 1,
    "name": "Power Meter 1",
    "device_type": "modbus"
  },
  "created_at": "2024-01-20T08:00:00Z"
}
```

### Create Meter

Create a new meter.

```
POST /api/v1/meters
```

**Request Body:**
```json
{
  "site_id": 1,
  "asset_id": 5,
  "name": "Main Electrical Meter",
  "meter_type": "electricity",
  "unit": "kWh",
  "meter_number": "EM-001",
  "is_main_meter": true,
  "multiplier": 1.0,
  "ct_ratio": 100,
  "pt_ratio": 1
}
```

### Update Meter

Update meter configuration.

```
PUT /api/v1/meters/{meter_id}
```

**Request Body:**
```json
{
  "name": "Updated Meter Name",
  "multiplier": 1.5
}
```

### Delete Meter

Delete a meter and its readings.

```
DELETE /api/v1/meters/{meter_id}
```

### Get Meter Readings

Get time-series readings for a meter.

```
GET /api/v1/meters/{meter_id}/readings
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_time` | datetime | No | Start of time range (ISO 8601) |
| `end_time` | datetime | No | End of time range (ISO 8601) |
| `interval` | string | No | Aggregation: `raw`, `15min`, `hourly`, `daily` |
| `limit` | integer | No | Max readings to return |

**Response:**
```json
{
  "meter_id": 1,
  "readings": [
    {
      "timestamp": "2024-01-24T10:00:00Z",
      "value": 125430.5,
      "quality": "good"
    },
    {
      "timestamp": "2024-01-24T10:15:00Z",
      "value": 125445.2,
      "quality": "good"
    }
  ],
  "metadata": {
    "start_time": "2024-01-24T00:00:00Z",
    "end_time": "2024-01-24T23:59:59Z",
    "interval": "15min",
    "count": 96
  }
}
```

### Submit Meter Reading

Manually submit a meter reading.

```
POST /api/v1/meters/{meter_id}/readings
```

**Request Body:**
```json
{
  "timestamp": "2024-01-24T10:30:00Z",
  "value": 125450.0,
  "source": "manual"
}
```

### Get Meter Statistics

Get consumption statistics for a meter.

```
GET /api/v1/meters/{meter_id}/stats
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `day`, `week`, `month`, `year` |

**Response:**
```json
{
  "meter_id": 1,
  "period": "month",
  "consumption": 15420.5,
  "peak_demand": 450.2,
  "average_demand": 210.5,
  "power_factor": 0.92,
  "load_factor": 0.47,
  "cost_estimate": 1850.46
}
```

## Meter Types

| Type | Description | Common Units |
|------|-------------|--------------|
| `electricity` | Electrical energy | kWh, MWh |
| `gas` | Natural gas | m³, therms, CCF |
| `water` | Water consumption | m³, gallons |
| `steam` | Steam energy | kg, lbs, MMBtu |
| `chilled_water` | Chilled water | ton-hours |
| `solar` | Solar generation | kWh |
| `diesel` | Diesel fuel | liters, gallons |

## Virtual Meters

Virtual meters calculate values from other meters using formulas.

### Create Virtual Meter

```
POST /api/v1/meters
```

**Request Body:**
```json
{
  "site_id": 1,
  "name": "Building A Net Consumption",
  "meter_type": "electricity",
  "unit": "kWh",
  "is_virtual": true,
  "formula": {
    "operation": "subtract",
    "operands": [
      {"meter_id": 1},
      {"meter_id": 5}
    ]
  }
}
```

### Formula Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `sum` | Add values | A + B + C |
| `subtract` | Subtract values | A - B |
| `multiply` | Multiply by constant | A * 1.5 |
| `divide` | Divide values | A / B |
| `max` | Maximum value | max(A, B) |
| `min` | Minimum value | min(A, B) |

## Reading Quality

| Quality | Description |
|---------|-------------|
| `good` | Valid reading |
| `estimated` | Estimated/interpolated value |
| `manual` | Manually entered |
| `suspect` | Potentially invalid |
| `missing` | Data gap |

## Data Sources

Meters can receive data from:
1. **IoT Devices** - Automatic readings via gateway
2. **Manual Entry** - User-submitted readings
3. **Bill Import** - Extracted from utility bills
4. **API Integration** - External system integration
5. **Virtual Calculation** - Computed from other meters

## Billing Integration

Meters linked to utility bills:

```
GET /api/v1/meters/{meter_id}/bills
```

Returns bills associated with this meter for cross-validation.
