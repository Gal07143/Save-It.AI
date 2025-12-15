# SAVE-IT.AI - Project Overview

## Overview

SAVE-IT.AI is an AI-driven enterprise energy management platform that combines financial analysis with electrical engineering (SLD/Digital Twin) to optimize energy usage for B2B clients. The platform is built on FastAPI with PostgreSQL and includes advanced features for BESS analysis, tenant billing, and BMS integrations.

## Project Structure

```
/
├── main.py                   # Main FastAPI application (consolidated)
├── README.md                 # Detailed documentation
├── backend/
│   ├── app/
│   │   ├── api/routers/      # Modular API routers (alternative structure)
│   │   ├── core/             # Config, database connection
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic services
│   │   │   ├── digital_twin/ # Gap analysis
│   │   │   ├── financial/    # Bill validation
│   │   │   └── optimization/ # Solar ROI, notifications
│   │   └── agents/           # LangChain AI agents
│   └── pyproject.toml        # Dependencies
└── attached_assets/          # User attachments
```

## Key Technologies

- **Backend**: Python 3.11, FastAPI
- **Database**: PostgreSQL (Replit's built-in, ready for TimescaleDB)
- **ORM**: SQLAlchemy 2.0
- **Validation**: Pydantic v2
- **AI Framework**: LangChain + OpenAI (via Replit AI Integrations)
- **Financial Analysis**: numpy-financial (NPV, IRR calculations)
- **BMS Integration**: pymodbus (Modbus TCP/RTU)

## Core Features

### MVP Features
1. **Digital Twin Engine**
   - Hierarchical asset tree (SLD representation)
   - Gap Analysis: Find unmetered electrical nodes

2. **Financial Engine**
   - Bill parsing and storage
   - Bill validation vs meter readings

3. **Optimization**
   - Solar ROI calculator
   - AI-generated notifications

### Enterprise Features (New)
4. **BESS Financial Analyzer**
   - Time-of-Use arbitrage simulation
   - Peak shaving savings calculation
   - NPV/IRR financial metrics
   - 8760-hour annual simulation

5. **Tenant Billing Engine**
   - Multi-tenant sub-billing
   - Lease contract management
   - Automated invoice generation
   - Energy, demand, fixed fee, and loss charges

6. **Integration Layer**
   - Abstract DataSource driver architecture
   - ModbusTCP driver for BMS connectivity
   - CSV import driver for legacy systems
   - Data normalization service

## API Reference

Base URL: `/api/v1`

### Core APIs
- Sites: `/sites` - CRUD operations
- Assets: `/assets`, `/assets/tree/{site_id}` - SLD hierarchy
- Meters: `/meters`, `/meters/{id}/readings`
- Bills: `/bills`, `/bills/{id}/validate`
- Analysis: `/analysis/gap-analysis/{site_id}`, `/analysis/solar-roi`
- Notifications: `/notifications`

### Enterprise APIs
- BESS Analysis: `/analysis/bess-simulation` - Battery storage ROI
- Tenants: `/tenants` - Tenant CRUD
- Lease Contracts: `/lease-contracts`, `/tenants/{id}/contracts`
- Billing: `/tenants/{id}/generate-invoice`, `/invoices`
- Integrations: `/data-sources` - Data source management

## Database Models

### Core Models
- Site -> Assets (1:N, hierarchical)
- Site -> Meters (1:N)
- Asset -> Meter (1:1 optional)
- Meter -> MeterReadings (1:N)
- Site -> Bills (1:N)
- Site -> Tariffs (1:N)
- Site -> Notifications (1:N)

### Enterprise Models
- Site -> Tenants (1:N)
- Tenant -> LeaseContracts (1:N)
- Tenant -> Invoices (1:N)
- Site -> DataSources (1:N)
- DataSource -> Measurements (1:N)
- Site -> BatterySpecs (1:N)

## Running the Application

The application runs on port 5000 using uvicorn:
```bash
python main.py
```

Access API docs at `/docs` (Swagger UI).

## Recent Changes

- 2025-12-15: Enterprise Edition Features
  - Added BESS Financial Analyzer with TOU arbitrage simulation
  - Added Tenant Billing Engine with invoice generation
  - Added Integration Layer with Modbus/CSV drivers
  - Added DataSource, Measurement, Tenant, LeaseContract, Invoice, BatterySpecs models
  - Added numpy-financial for NPV/IRR calculations
  - Added pymodbus for BMS connectivity

- 2025-12-15: Initial MVP implementation
  - Created database schema with all core models
  - Implemented Gap Analysis service
  - Implemented Bill Validation service
  - Implemented Solar ROI calculator
  - Set up FastAPI with all CRUD endpoints

## User Preferences

- Clean Architecture principles
- Type hints on all Python code
- Docstrings for complex logic
- Modular code structure (Routers, Services, Schemas, Models)
