# Webhooks API

Webhooks allow external systems to receive real-time notifications about events in Save-It.AI.

Base URL: `/api/v1/webhooks`

## Endpoints

### List Webhooks

Get all webhooks for the organization.

```
GET /api/v1/webhooks
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Alert Notifications",
    "url": "https://example.com/webhooks/saveit",
    "events": ["alert.created", "alert.resolved"],
    "is_active": true,
    "secret_hash": "sha256:abc...",
    "last_triggered_at": "2024-01-24T10:30:00Z",
    "failure_count": 0,
    "created_at": "2024-01-20T08:00:00Z"
  }
]
```

### Get Webhook

Get a specific webhook.

```
GET /api/v1/webhooks/{webhook_id}
```

### Create Webhook

Register a new webhook endpoint.

```
POST /api/v1/webhooks
```

**Request Body:**
```json
{
  "name": "Alert Notifications",
  "url": "https://example.com/webhooks/saveit",
  "events": ["alert.created", "alert.resolved"],
  "secret": "my-webhook-secret",
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Alert Notifications",
  "url": "https://example.com/webhooks/saveit",
  "events": ["alert.created", "alert.resolved"],
  "is_active": true,
  "secret_set": true,
  "created_at": "2024-01-24T10:30:00Z"
}
```

### Update Webhook

Update webhook configuration.

```
PUT /api/v1/webhooks/{webhook_id}
```

**Request Body:**
```json
{
  "name": "Updated Webhook Name",
  "events": ["alert.created", "alert.resolved", "device.offline"],
  "is_active": true
}
```

### Delete Webhook

Remove a webhook.

```
DELETE /api/v1/webhooks/{webhook_id}
```

### Test Webhook

Send a test event to verify webhook configuration.

```
POST /api/v1/webhooks/{webhook_id}/test
```

**Response:**
```json
{
  "success": true,
  "response_status": 200,
  "response_time_ms": 245
}
```

### Get Webhook Deliveries

View recent delivery attempts.

```
GET /api/v1/webhooks/{webhook_id}/deliveries
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `success`, `failed`, `pending` |
| `limit` | integer | Max results (default: 50) |

**Response:**
```json
[
  {
    "id": "del_abc123",
    "event_type": "alert.created",
    "status": "success",
    "response_status": 200,
    "response_time_ms": 125,
    "attempt": 1,
    "created_at": "2024-01-24T10:30:00Z"
  },
  {
    "id": "del_def456",
    "event_type": "device.offline",
    "status": "failed",
    "response_status": 500,
    "response_time_ms": 1500,
    "attempt": 3,
    "next_retry_at": "2024-01-24T11:30:00Z",
    "created_at": "2024-01-24T10:00:00Z"
  }
]
```

### Retry Failed Delivery

Manually retry a failed delivery.

```
POST /api/v1/webhooks/{webhook_id}/deliveries/{delivery_id}/retry
```

## Event Types

### Alert Events

| Event | Description |
|-------|-------------|
| `alert.created` | New alert triggered |
| `alert.resolved` | Alert condition cleared |
| `alert.acknowledged` | Alert acknowledged by user |

### Device Events

| Event | Description |
|-------|-------------|
| `device.online` | Device connected |
| `device.offline` | Device disconnected |
| `device.error` | Device error occurred |

### Meter Events

| Event | Description |
|-------|-------------|
| `meter.reading` | New meter reading received |
| `meter.anomaly` | Anomalous reading detected |
| `meter.gap` | Data gap detected |

### Bill Events

| Event | Description |
|-------|-------------|
| `bill.uploaded` | New bill uploaded |
| `bill.processed` | Bill OCR completed |
| `bill.validated` | Bill validation completed |
| `bill.discrepancy` | Bill discrepancy found |

### Report Events

| Event | Description |
|-------|-------------|
| `report.generated` | Report generation completed |
| `report.scheduled` | Scheduled report triggered |

## Webhook Payload

All webhooks receive a JSON payload:

```json
{
  "id": "evt_abc123",
  "type": "alert.created",
  "created_at": "2024-01-24T10:30:00Z",
  "organization_id": 1,
  "data": {
    "alert_id": 5,
    "site_id": 1,
    "severity": "high",
    "message": "Power consumption exceeded threshold",
    "value": 450.5,
    "threshold": 400.0
  }
}
```

## Signature Verification

Webhooks are signed with HMAC-SHA256 for security.

### Headers

| Header | Description |
|--------|-------------|
| `X-SaveIt-Signature` | HMAC-SHA256 signature |
| `X-SaveIt-Timestamp` | Unix timestamp |
| `X-SaveIt-Delivery-ID` | Unique delivery ID |

### Verification (Python)

```python
import hmac
import hashlib
import time

def verify_webhook(payload: bytes, signature: str, timestamp: str, secret: str) -> bool:
    # Check timestamp is recent (within 5 minutes)
    if abs(time.time() - int(timestamp)) > 300:
        return False

    # Compute expected signature
    signed_payload = f"{timestamp}.{payload.decode()}"
    expected = hmac.new(
        secret.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()

    # Compare signatures
    return hmac.compare_digest(f"sha256={expected}", signature)
```

### Verification (Node.js)

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, timestamp, secret) {
  // Check timestamp is recent
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expected}`),
    Buffer.from(signature)
  );
}
```

## Retry Policy

Failed deliveries are retried with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failed attempts, the webhook is marked as failing and notifications are paused.

## Best Practices

1. **Respond Quickly** - Return 2xx within 30 seconds
2. **Verify Signatures** - Always verify webhook signatures
3. **Idempotency** - Handle duplicate deliveries gracefully
4. **Acknowledge Fast** - Return 200 immediately, process async
5. **Monitor Failures** - Track webhook delivery failures

## Rate Limits

| Limit | Value |
|-------|-------|
| Webhooks per org | 25 |
| Events per minute | 1000 |
| Payload size | 256 KB |
| Response timeout | 30 seconds |
