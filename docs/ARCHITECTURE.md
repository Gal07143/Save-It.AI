# Architecture Overview

Save-It.AI is an AI-driven energy management platform for B2B clients. This document describes the system architecture and key design decisions.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                     (nginx / Cloud LB)                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Frontend    │    │   Backend     │    │  MQTT Broker  │
│   (React)     │    │   (FastAPI)   │    │   (Built-in)  │
└───────────────┘    └───────┬───────┘    └───────┬───────┘
                             │                     │
                    ┌────────┼────────┐           │
                    │        │        │           │
                    ▼        ▼        ▼           │
             ┌──────────┐ ┌─────┐ ┌──────┐       │
             │PostgreSQL│ │Redis│ │OpenAI│       │
             └──────────┘ └─────┘ └──────┘       │
                                                  │
                              ┌───────────────────┘
                              ▼
                    ┌─────────────────┐
                    │    IoT Devices  │
                    │    (Gateways)   │
                    └─────────────────┘
```

## Components

### Frontend (React + TypeScript)

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: React Query for server state
- **UI Components**: Custom components with Tailwind CSS
- **Charts**: Recharts for data visualization

Key pages:
- Dashboard: Real-time site overview
- Digital Twin: SLD/asset hierarchy visualization
- Devices: IoT device management
- Bills: Utility bill tracking and validation
- Reports: PDF report generation

### Backend (FastAPI + Python)

- **Framework**: FastAPI (async Python)
- **ORM**: SQLAlchemy 2.0 with async support
- **Database**: PostgreSQL 15
- **Authentication**: JWT tokens with HTTP-only cookies
- **API Documentation**: OpenAPI/Swagger auto-generated

Key services:
- Authentication & Authorization
- Multi-tenant data isolation
- Device management & MQTT
- Bill validation & analysis
- AI-powered recommendations

### Database (PostgreSQL)

Key tables:
- `organizations`, `users`: Multi-tenancy
- `sites`, `assets`, `meters`: Energy hierarchy
- `data_sources`, `gateways`: IoT devices
- `bills`, `meter_readings`: Energy data
- `audit_logs`, `notifications`: Operations

### MQTT Broker (Embedded)

- Built-in MQTT broker for IoT communication
- Topics: `saveit/#`, `device/#`
- Supports TLS encryption
- Per-gateway authentication

## Design Patterns

### Multi-Tenancy

Data isolation is enforced at multiple levels:
1. **Middleware**: Extracts tenant from JWT token
2. **Query Filters**: Automatically applied to all queries
3. **API Validation**: Cross-tenant access prevented

### API Versioning

- All endpoints under `/api/v1/`
- Breaking changes require new version
- Deprecation notices in headers

### Authentication Flow

```
┌────────┐        ┌────────┐        ┌────────┐
│ Client │        │ Backend│        │Database│
└───┬────┘        └───┬────┘        └───┬────┘
    │   POST /login   │                 │
    │────────────────►│                 │
    │                 │   Verify creds  │
    │                 │────────────────►│
    │                 │◄────────────────│
    │   JWT + Cookie  │                 │
    │◄────────────────│                 │
    │                 │                 │
    │  GET /api/...   │                 │
    │  (with cookie)  │                 │
    │────────────────►│                 │
    │                 │  Query with     │
    │                 │  tenant filter  │
    │                 │────────────────►│
    │     Data        │◄────────────────│
    │◄────────────────│                 │
```

### Event-Driven Architecture

Internal event bus for service decoupling:
- Device status changes
- Meter reading ingestion
- Alert notifications
- Scheduled jobs

## Data Flow

### Meter Reading Ingestion

```
IoT Device → MQTT → Subscriber → Validation → Database → WebSocket → UI
```

1. Device publishes to MQTT topic
2. Subscriber processes message
3. Validation rules applied
4. Stored in time-series format
5. Real-time push to connected clients

### Bill Processing

```
Upload → OCR (OpenAI) → Extraction → Validation → Database
```

1. User uploads bill PDF/image
2. AI extracts structured data
3. Cross-validate with meter readings
4. Flag discrepancies for review

## Security

### Defense in Depth

1. **Network**: TLS 1.2+, HSTS
2. **Application**: CSRF protection, security headers
3. **Authentication**: JWT with short expiry, secure cookies
4. **Authorization**: Role-based access control
5. **Data**: Tenant isolation, encryption at rest

### Security Headers

All responses include:
- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`

## Scalability

### Horizontal Scaling

- Stateless backend (session in JWT)
- Redis for shared rate limiting
- Database connection pooling
- Kubernetes HPA for auto-scaling

### Performance Optimizations

- Response caching (configurable TTL)
- Database query optimization (indexes)
- Lazy loading in frontend
- Image/asset compression

## Monitoring

### Metrics (Prometheus)

- `http_requests_total`
- `http_request_duration_seconds`
- `database_connections`
- `mqtt_messages_received_total`

### Logging (JSON)

Structured logs with:
- Request ID for correlation
- Tenant ID for filtering
- Timing information
- Error details

### Tracing (OpenTelemetry)

- Distributed request tracing
- Database query spans
- External API call tracking

## Deployment

### Environments

1. **Development**: Local Docker Compose
2. **Staging**: Kubernetes (preview deployments)
3. **Production**: Kubernetes with HA

### CI/CD Pipeline

```
Push → Tests → Security Scan → Build → Deploy Staging → Deploy Prod
```

See `docs/deployment/` for detailed deployment guides.
