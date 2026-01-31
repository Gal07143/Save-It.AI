# Environment Variables Reference

Complete reference for all environment variables used by Save-It.AI.

## Required Variables

These variables must be set for the application to function.

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/saveit` |
| `SESSION_SECRET` | JWT signing key (min 32 chars) | Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"` |

## Application Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable debug mode (disable in production) | `false` |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) | `http://localhost:5000` |
| `API_BASE_URL` | Public URL for API | `http://localhost:8000/api/v1` |

## Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `DB_POOL_SIZE` | Connection pool size | `10` |
| `DB_MAX_OVERFLOW` | Max additional connections | `20` |
| `DB_POOL_PRE_PING` | Test connections before use | `true` |

### Connection String Format

```
postgresql://username:password@hostname:port/database
```

Examples:
```bash
# Local development
DATABASE_URL=postgresql://saveit:password@localhost:5432/saveit

# Docker Compose
DATABASE_URL=postgresql://saveit:saveit_password@postgres:5432/saveit

# AWS RDS
DATABASE_URL=postgresql://saveit:password@mydb.abc123.us-east-1.rds.amazonaws.com:5432/saveit

# With SSL
DATABASE_URL=postgresql://saveit:password@host:5432/saveit?sslmode=require
```

## Security Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SESSION_SECRET` | JWT signing key | Required |
| `SESSION_SECRET_FILE` | Path to secret file (K8s) | - |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime | `7` |

### Generating Secrets

```bash
# Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# OpenSSL
openssl rand -base64 32

# /dev/urandom
head -c 32 /dev/urandom | base64
```

### Kubernetes Secret File

Mount secret as file:
```yaml
volumes:
  - name: secrets
    secret:
      secretName: saveit-session-secret
volumeMounts:
  - name: secrets
    mountPath: /run/secrets
    readOnly: true
```

Set environment:
```bash
SESSION_SECRET_FILE=/run/secrets/session_secret
```

## Redis Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | - |
| `REDIS_PASSWORD` | Redis password (if not in URL) | - |
| `RATE_LIMIT_ENABLED` | Enable rate limiting | `true` |
| `RATE_LIMIT_DEFAULT_RATE` | Default requests per minute | `60` |

### Redis URL Format

```
redis://[:password@]hostname:port/database
```

Examples:
```bash
# Local
REDIS_URL=redis://localhost:6379/0

# With password
REDIS_URL=redis://:mypassword@localhost:6379/0

# AWS ElastiCache
REDIS_URL=redis://my-cluster.abc123.cache.amazonaws.com:6379/0

# TLS (rediss://)
REDIS_URL=rediss://:password@host:6379/0
```

## MQTT Broker Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `MQTT_BROKER_HOST` | Broker bind address | `0.0.0.0` |
| `MQTT_BROKER_PORT` | MQTT port | `1883` |
| `MQTT_BROKER_TLS_PORT` | MQTT TLS port | `8883` |
| `MQTT_PUBLIC_HOST` | Public hostname for clients | `localhost` |
| `MQTT_ENABLE_TLS` | Enable TLS | `false` |
| `MQTT_TLS_CERT_FILE` | TLS certificate path | - |
| `MQTT_TLS_KEY_FILE` | TLS key path | - |

## Email Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_PROVIDER` | Provider: `smtp` or `sendgrid` | `smtp` |
| `EMAIL_FROM_ADDRESS` | From address | `noreply@saveit.ai` |
| `EMAIL_FROM_NAME` | From name | `Save-It.AI` |

### SMTP Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | Required if SMTP |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASSWORD` | SMTP password | - |
| `SMTP_USE_TLS` | Use TLS | `true` |

### SendGrid Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `SENDGRID_API_KEY` | SendGrid API key | Required if SendGrid |

## External APIs

### OpenAI

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_BASE_URL` | API base URL | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Model to use | `gpt-4` |

## Webhook Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBHOOK_BASE_URL` | Base URL for webhooks | - |
| `WEBHOOK_MAX_RETRIES` | Max delivery attempts | `5` |
| `WEBHOOK_RETRY_DELAY_SECONDS` | Initial retry delay | `60` |

## Cache Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CACHE_VERSION` | Cache key prefix version | `v1` |
| `CACHE_DEFAULT_TTL` | Default TTL in seconds | `300` |

## Observability

### Logging

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Log level (DEBUG, INFO, WARNING, ERROR) | `INFO` |
| `LOG_FORMAT` | Format: `json` or `text` | `json` |
| `LOG_REQUEST_ID_HEADER` | Header for request ID | `X-Request-ID` |

### Metrics

| Variable | Description | Default |
|----------|-------------|---------|
| `METRICS_ENABLED` | Enable /metrics endpoint | `true` |
| `METRICS_PATH` | Metrics endpoint path | `/metrics` |

### Tracing

| Variable | Description | Default |
|----------|-------------|---------|
| `OTEL_ENABLED` | Enable OpenTelemetry | `false` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP exporter endpoint | - |
| `OTEL_SERVICE_NAME` | Service name for traces | `saveit-backend` |

### Error Tracking

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry DSN | - |
| `SENTRY_ENVIRONMENT` | Environment name | `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | Trace sample rate | `0.1` |

## Environment-Specific Examples

### Development

```bash
DEBUG=true
DATABASE_URL=postgresql://saveit:password@localhost:5432/saveit
SESSION_SECRET=dev-secret-change-in-production-32chars
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:3000
LOG_LEVEL=DEBUG
LOG_FORMAT=text
```

### Docker Compose

```bash
DEBUG=false
DATABASE_URL=postgresql://saveit:saveit_password@postgres:5432/saveit
SESSION_SECRET=your-secure-secret-here-minimum-32-characters
REDIS_URL=redis://redis:6379/0
ALLOWED_ORIGINS=http://localhost:5000
```

### Kubernetes Production

```bash
DEBUG=false
DATABASE_URL=postgresql://saveit:password@rds-endpoint:5432/saveit?sslmode=require
SESSION_SECRET_FILE=/run/secrets/session_secret
REDIS_URL=rediss://:password@elasticache-endpoint:6379/0
ALLOWED_ORIGINS=https://app.saveit.ai
LOG_LEVEL=INFO
LOG_FORMAT=json
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4317
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## Validation

The application validates required variables at startup:

- `SESSION_SECRET` must be at least 32 characters when `DEBUG=false`
- `DATABASE_URL` must be a valid PostgreSQL connection string
- Missing required variables will prevent startup with clear error messages
