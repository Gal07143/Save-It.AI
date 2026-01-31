# Sites API

Sites represent physical locations where energy monitoring is performed. Each site belongs to an organization and contains assets, meters, and devices.

Base URL: `/api/v1/sites`

## Endpoints

### List Sites

Get all sites for the current organization.

```
GET /api/v1/sites
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `skip` | integer | Number of records to skip (default: 0) |
| `limit` | integer | Maximum records to return (default: 100) |
| `search` | string | Search in name and address |

**Response:**
```json
[
  {
    "id": 1,
    "organization_id": 1,
    "name": "Main Factory",
    "site_type": "industrial",
    "address": "123 Industrial Ave",
    "city": "Chicago",
    "state": "IL",
    "country": "USA",
    "postal_code": "60601",
    "timezone": "America/Chicago",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "currency": "USD",
    "is_active": true,
    "created_at": "2024-01-20T08:00:00Z",
    "updated_at": "2024-01-24T10:30:00Z"
  }
]
```

### Get Site

Get a specific site by ID.

```
GET /api/v1/sites/{site_id}
```

**Response:**
```json
{
  "id": 1,
  "organization_id": 1,
  "name": "Main Factory",
  "site_type": "industrial",
  "address": "123 Industrial Ave",
  "city": "Chicago",
  "state": "IL",
  "country": "USA",
  "postal_code": "60601",
  "timezone": "America/Chicago",
  "latitude": 41.8781,
  "longitude": -87.6298,
  "currency": "USD",
  "is_active": true,
  "created_at": "2024-01-20T08:00:00Z",
  "updated_at": "2024-01-24T10:30:00Z"
}
```

**Status Codes:**
- `200` - Success
- `404` - Site not found

### Create Site

Create a new site.

```
POST /api/v1/sites
```

**Request Body:**
```json
{
  "name": "Main Factory",
  "site_type": "industrial",
  "address": "123 Industrial Ave",
  "city": "Chicago",
  "state": "IL",
  "country": "USA",
  "postal_code": "60601",
  "timezone": "America/Chicago",
  "latitude": 41.8781,
  "longitude": -87.6298,
  "currency": "USD"
}
```

**Required Fields:**
- `name` - Site name

**Optional Fields:**
- `site_type` - Type of site (industrial, commercial, residential)
- `address`, `city`, `state`, `country`, `postal_code` - Location details
- `timezone` - IANA timezone identifier
- `latitude`, `longitude` - Geographic coordinates
- `currency` - ISO 4217 currency code

**Response:**
```json
{
  "id": 1,
  "organization_id": 1,
  "name": "Main Factory",
  // ... all site fields
}
```

**Status Codes:**
- `201` - Created
- `400` - Validation error

### Update Site

Update an existing site.

```
PUT /api/v1/sites/{site_id}
```

**Request Body:**
```json
{
  "name": "Updated Factory Name",
  "timezone": "America/New_York"
}
```

All fields are optional. Only provided fields are updated.

**Response:**
```json
{
  "id": 1,
  "name": "Updated Factory Name",
  // ... all site fields
}
```

**Status Codes:**
- `200` - Success
- `404` - Site not found

### Delete Site

Delete a site. This will also delete all associated assets, meters, and data.

```
DELETE /api/v1/sites/{site_id}
```

**Response:**
```json
{
  "message": "Site deleted successfully"
}
```

**Status Codes:**
- `200` - Success
- `404` - Site not found

### Get Site Statistics

Get summary statistics for a site.

```
GET /api/v1/sites/{site_id}/stats
```

**Response:**
```json
{
  "total_assets": 25,
  "total_meters": 12,
  "total_devices": 8,
  "active_alerts": 3,
  "energy_consumption_today": 1250.5,
  "energy_consumption_month": 35420.8,
  "peak_demand": 450.2,
  "power_factor": 0.92
}
```

### Get Site Hierarchy

Get the asset hierarchy for a site (for Digital Twin visualization).

```
GET /api/v1/sites/{site_id}/hierarchy
```

**Response:**
```json
{
  "id": 1,
  "name": "Main Factory",
  "type": "site",
  "children": [
    {
      "id": 1,
      "name": "Building A",
      "type": "asset",
      "asset_type": "building",
      "children": [
        {
          "id": 2,
          "name": "HVAC System",
          "type": "asset",
          "asset_type": "hvac",
          "meters": [
            {
              "id": 1,
              "name": "Main Meter",
              "meter_type": "electricity"
            }
          ]
        }
      ]
    }
  ]
}
```

## Site Types

| Type | Description |
|------|-------------|
| `industrial` | Manufacturing facilities, warehouses |
| `commercial` | Offices, retail spaces |
| `residential` | Residential buildings |
| `mixed_use` | Mixed-use developments |

## Filtering and Searching

### Search by Name/Address
```
GET /api/v1/sites?search=factory
```

### Pagination
```
GET /api/v1/sites?skip=0&limit=20
```

## Multi-Tenancy

Sites are automatically filtered by the authenticated user's organization. Users can only access sites belonging to their organization.

## Related Endpoints

- `GET /api/v1/sites/{site_id}/assets` - List assets at a site
- `GET /api/v1/sites/{site_id}/meters` - List meters at a site
- `GET /api/v1/sites/{site_id}/gateways` - List gateways at a site
- `GET /api/v1/sites/{site_id}/bills` - List utility bills for a site
