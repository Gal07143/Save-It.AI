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

### Platform Foundation APIs (Phase 1)
- Organizations: `/organizations` - Multi-tenant organization management
- Users: `/users` - User CRUD with RBAC roles
- Audit Logs: `/audit-logs` - Activity tracking
- Period Locks: `/period-locks` - Billing period locking

### Data Quality APIs (Phase 2)
- Dashboard: `/data-quality/dashboard` - Quality metrics summary
- Issues: `/data-quality/issues` - Quality issue tracking
- Resolution: `/data-quality/issues/{id}/resolve` - Issue resolution

### Virtual Meter APIs (Phase 3)
- Virtual Meters: `/virtual-meters` - Calculated/allocated meter management
- PV Sizing: `/analysis/pv-sizing` - Solar system sizing calculator

### AI & Forecasting APIs (Phase 4)
- AI Chat: `/agents/chat` - Conversational AI for energy analysis
- Recommendations: `/recommendations` - AI-generated recommendations
- Forecasts: `/forecasts` - Load and PV production predictions
- Maintenance Alerts: `/maintenance/alerts` - Predictive maintenance
- Asset Conditions: `/maintenance/asset-conditions` - Asset health tracking
- Control Rules: `/control-rules` - Automation rule management
- Control Commands: `/control-commands` - Command execution tracking

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

### Platform Foundation Models (Phase 1)
- Organization -> Users (1:N)
- User -> AuditLogs (1:N)
- Organization -> FileAssets (1:N)
- Site -> PeriodLocks (1:N)

### Data Quality Models (Phase 2)
- Meter -> QualityIssues (1:N)
- Meter -> MeterQualitySummaries (1:N)

### Virtual Meter Models (Phase 3)
- Site -> VirtualMeters (1:N)
- VirtualMeter -> VirtualMeterComponents (1:N)

### AI & Control Models (Phase 4)
- Site -> AgentSessions (1:N)
- AgentSession -> AgentMessages (1:N)
- Site -> Recommendations (1:N)
- Site -> ForecastJobs (1:N)
- ForecastJob -> ForecastSeries (1:N)
- Asset -> MaintenanceAlerts (1:N)
- Asset -> AssetConditions (1:N)
- Site -> ControlRules (1:N)
- Asset -> ControlCommands (1:N)

## Running the Application

The application runs on port 5000 using uvicorn:
```bash
python main.py
```

Access API docs at `/docs` (Swagger UI).

## Recent Changes

- 2025-12-15: Page-by-Page Feature Enhancements
  - OCR Bill Scanning: Image upload with OpenAI Vision API for automatic bill data extraction
  - Dashboard: YTD savings summary, energy efficiency score, real-time load indicator, energy mix chart
  - Digital Twin Builder: Grid snap toggle, quick templates (Commercial, Solar+Battery, Industrial), Export to PNG
  - Bills page: OCR modal with drag-drop upload, preview, auto-fill form

- 2025-12-15: Phase 1-4 Backend & Frontend Implementation
  - Added Platform Foundation APIs (Organizations, Users, Audit Logs, Period Locks)
  - Added Data Quality Engine APIs (Dashboard, Issues, Resolution)
  - Added Virtual Meters APIs (CRUD with components)
  - Added Predictive Maintenance APIs (Alerts, Asset Conditions)
  - Added AI Agents APIs (Chat, Recommendations)
  - Added Forecasting APIs (Load/PV predictions)
  - Added Control Engine APIs (Rules, Commands)
  - Added PV Sizing Calculator API
  - Created 6 new frontend pages:
    - Data Quality: Coverage tracking, anomaly detection, quality rules
    - Virtual Meters: Expression engine for calculated/allocated meters
    - Maintenance: Predictive maintenance alerts and asset health
    - AI Agents: Chat interface with Energy Analyst, Detective, Recommender
    - Forecasting: Load and PV production predictions with charts
    - Admin: Organizations, Users, Audit Logs, Period Locks management

- 2025-12-15: Data Import/Export & Reporting Features
  - Added Excel export endpoints for Sites, Meters, Bills (openpyxl)
  - Added PDF report generation for Site Summary and Energy Analysis (reportlab)
  - Created Reports & Exports page with download functionality
  - Created Tariff Management page with TOU, Flat Rate, Tiered/Block, and Demand Charges support
  - Created Carbon Footprint & ESG Reporting page with Scope 1/2/3 emissions tracking
  - Created Settings page with organization, localization, notifications, and automation preferences
  - Fixed Bill model attribute names (period_start/period_end)

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
