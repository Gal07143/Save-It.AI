# SAVE-IT.AI - Project Overview

## Overview
SAVE-IT.AI is an AI-driven enterprise energy management platform designed to optimize energy usage for B2B clients. It integrates financial analysis with electrical engineering concepts (SLD/Digital Twin) to provide comprehensive energy management solutions. The platform supports BESS analysis, tenant billing, and Building Management System (BMS) integrations, aiming to reduce energy costs and improve efficiency.

## User Preferences
- Clean Architecture principles
- Type hints on all Python code
- Docstrings for complex logic
- Modular code structure (Routers, Services, Schemas, Models)

## System Architecture
The SAVE-IT.AI platform is built on a modern tech stack, featuring a FastAPI backend and a React frontend.

**Key Technical Implementations:**
-   **Backend**: Python 3.11, FastAPI for high-performance API services.
-   **Database**: PostgreSQL with an architecture ready for TimescaleDB integration for time-series data.
-   **ORM**: SQLAlchemy 2.0 for robust database interactions.
-   **Data Validation**: Pydantic v2 for data schema definition and validation.
-   **AI**: LangChain integrated with OpenAI (via Replit AI Integrations) for AI agents and advanced analytics.
-   **Financials**: `numpy-financial` for advanced financial calculations like NPV and IRR.
-   **BMS Integration**: `pymodbus` for Modbus TCP/RTU communication with BMS.

**Core Features:**
-   **Digital Twin Engine**: Hierarchical asset tree representation (SLD), including AI-driven panel diagram import for automatic asset extraction and multi-level layout generation. Gap analysis identifies unmetered electrical nodes.
-   **Financial Engine**: Bill parsing, storage, and validation against meter readings. Includes OCR bill scanning using OpenAI Vision API.
-   **Optimization**: Solar ROI calculator and AI-generated notifications for energy saving opportunities.
-   **BESS Financial Analyzer**: Time-of-Use arbitrage and peak shaving simulations, 8760-hour annual simulation with NPV/IRR calculations. Includes vendor/model catalogs and dataset management for simulations.
-   **Tenant Billing Engine**: Multi-tenant sub-billing, lease contract management, and automated invoice generation with configurable charges.
-   **Integration Layer**: Abstract driver architecture for data sources (e.g., ModbusTCP, CSV import) with data normalization. Includes gateway management for meter data collection.
-   **PV Design & Assessment**: Catalog of PV modules, site PV assessments, surface management, and design scenarios with ROI projections (NPV, IRR, LCOE).
-   **Platform Foundation**: Multi-tenant organization management, user management with RBAC, audit logging, and period locking for billing cycles.
-   **Data Quality**: Dashboard for quality metrics, issue tracking, and resolution.
-   **Virtual Meters**: Management of calculated and allocated meters using an expression engine.
-   **AI & Forecasting**: Conversational AI for energy analysis, AI-generated recommendations, load and PV production forecasting, predictive maintenance alerts, and asset condition tracking.
-   **Control Engine**: Management of automation rules and command execution tracking.
-   **UI/UX**: React frontend with 27 application pages and reusable components, designed with a dark theme, card layouts, and improved user experience. Includes dynamic power flow visualizations and detailed dashboards for sites, PV systems, and storage units.

## Recent Changes

### Device & Integration Layer (Jan 18, 2026)
- **Gateway Management**: Data collection devices that aggregate multiple meters with status tracking
- **Device Templates**: Pre-configured register maps for 16 devices (6 meters, 5 solar inverters, 4 BESS, 1 additional meter)
- **Template Export/Import**: Export templates to JSON files and import custom templates from JSON
- **Meter Linking**: Optional meter linking in Apply Template workflow for data collection
- **Modbus Register Configuration**: Full register management with address, data type, byte order, scaling
- **Connection Testing**: Test Modbus TCP connections before deployment
- **Live Data Preview**: Read current register values with quality indicators
- **Communication Health**: Track connection status, errors, and response times
- **Apply Template Workflow**: One-click register setup from device templates

### UI/UX Improvements (Jan 18, 2026)
- **Carbon/ESG Page**: Added to navigation under "Data & Reports" with Leaf icon
- **Energy Assets**: New consolidated page combining PV Systems + Storage Units with tabbed interface
- **Digital Twin**: Merged view + builder into single page with View/Build toggle
- **Site Setup Wizard**: New 4-step onboarding wizard (Create Site → Add Assets → Add Meters → Upload Bill)
- **Navigation Consolidation**: Reduced menu items by combining related pages
- **Legacy Route Redirects**: Old routes (/assets, /twin-builder, /pv-systems, /storage-units) redirect to new consolidated pages
- **Integrations Page**: Enhanced with 4-tab interface (Gateways, Data Sources, Device Templates, Registers)

### Backend Restructuring (Dec 16, 2025)
- Refactored monolithic 5,913-line main.py into clean modular architecture
- Created 11 model files in `backend/app/models/` (60+ SQLAlchemy models)
- Created 13 schema files in `backend/app/schemas/` (100+ Pydantic schemas)
- Created 21 router files in `backend/app/api/routers/` (domain-specific endpoints)
- Updated services to use new import structure
- Workflow now runs from `backend/app/main.py`

### Frontend Code Cleanup (Dec 16, 2025)
- Fixed all TypeScript build errors (0 diagnostics)
- Added missing navigation links (AI Agents, Notifications)
- Cleaned up 13 unused imports across 9 files
- All 27 pages accessible and functional

## Project Structure
```
backend/app/
├── main.py              # FastAPI entry point
├── api/routers/         # 21 domain routers
├── core/                # Config, database
├── models/              # 11 model files (60+ models)
├── schemas/             # 13 schema files (100+ schemas)
├── services/            # Business logic
└── agents/              # AI agents

frontend/src/
├── pages/               # 27 application pages
├── components/          # Reusable UI components
└── services/api.ts      # API client
```

## Development Roadmap (105 Tasks)

### Phase 1: Core Fixes (12 tasks) - COMPLETE ✅
1. ✅ Auto-seed device templates on startup
2. ✅ Meter delete button with confirmation dialog
3. ✅ Add gateway_id + MQTT/HTTPS to DataSource model & schemas
4. ✅ Protocol-specific Data Source form with gateway selector
5. ✅ Solar inverter templates (SMA, SolarEdge, Huawei, Fronius, Sungrow)
6. ✅ BESS templates (Tesla, BYD, LG RESU, Pylontech)
7. ✅ Meter linking in Apply Template
8. ✅ Export/import template buttons (JSON file download/upload)
9. ✅ data_source_id on PV/BESS assets
10. ✅ Site Configuration section (with placeholder energy settings)
11. ✅ Connection health notifications (API endpoints for CONNECTION_ERROR/CONNECTION_RESTORED)
12. ✅ formatNumber utility (3 decimals)

### Phase 2: Device Onboarding Wizard (4 tasks) - COMPLETE ✅
13. ✅ Step 1: Prerequisites - Device type selection, gateway selector, protocol choice, site selector
14. ✅ Step 2: Connect - Connection details form (host/port/slave ID), test connection with status
15. ✅ Step 3: Configure - Device name, location, template selection with filter by device type
16. ✅ Step 4: Datapoints - Review registers/summary, confirm and create data source with template apply

**Device Onboarding Wizard Features:**
- Zoho IoT-style 4-step guided flow with progress indicator
- 6 protocol support: Modbus TCP/RTU, MQTT, HTTPS Webhook, Direct Inverter, Direct BESS
- Site selector when no current site is selected
- Gateway selector for aggregated device connections
- Connection testing for Modbus protocols with visual feedback
- Template auto-filtering by device category (meter/inverter/BESS/gateway)
- Optional meter linking for data collection
- Creates DataSource and applies template registers on completion
- Accessed via emerald "Device Wizard" button on Integrations page

### Phase 3: Advanced Device Features (14 tasks) - COMPLETE ✅
17. ✅ Bulk device import - CSV upload with validation, template auto-apply, per-row error reporting
18. ✅ Device health dashboard - Status aggregation (online/offline/error/unknown), 24h success rates, response times
19. ✅ Data validation rules - CRUD configuration for min/max/rate-of-change/stale-data rules with violation tracking
20. ✅ Connection retry logic - Configuration infrastructure with exponential backoff settings and testing endpoints
21. ✅ Device grouping - Hierarchical device organization into logical groups/zones with color coding
22. ✅ Firmware version tracking - FirmwareTracker component with summary stats, version distribution, and editable table
23. ✅ Device QR codes - QR button in data source table, modal with rendered QR image, device info display
24. ✅ Device configuration cloning - Clone modal with name/host/slave ID inputs, registers duplication
25. ✅ Public status page - External-facing page showing device/system status without login (org_{id} token)
26. ✅ Device auto-discovery - Network scanning for Modbus TCP devices on IP range with onboarding integration
27. ✅ Device commissioning workflow - 6-step guided checklist with progress tracking and mandatory step enforcement
28. ✅ Maintenance scheduling - CRUD for routine/preventive/corrective/emergency maintenance with priorities
29. ✅ Device alerts configuration - 5 alert types, 3 severities, enable/disable toggle with trigger tracking
30. Note: Alert triggering/validation enforcement requires Phase 7 polling service

**Retry Logic Features:**
- Retry configuration per data source: max_retries, retry_delay_seconds, backoff_multiplier
- Connection status tracking: online, offline, retrying, error, unknown
- Retry queue view showing devices pending reconnection
- Force retry, reset, simulate failure/success for testing
- Frontend "Retry" tab on Integrations page
- Note: Automatic background scheduling requires polling service (Phase 7)

**Validation Rules Features:**
- 5 rule types: min_value, max_value, range, rate_of_change, stale_data
- Rule configuration per data source with severity levels (info/warning/critical)
- Validation violations table for tracking rule breaches
- Acknowledge workflow for violations
- Frontend "Validation" tab on Integrations page
- Note: Actual enforcement during ingestion requires polling service (Phase 7)

**Device Groups Features:**
- Hierarchical group organization with parent_group_id support
- Group types: zone, building, floor, department, custom
- Color coding for visual organization
- Device membership management with add/remove functionality
- Frontend "Groups" tab on Integrations page

### Phase 4: Backend (15 tasks)
31-45: Rate limiting, API auth, audit logging, caching, job queue, health checks, backups, TimescaleDB, GDPR

### Phase 5: Database (10 tasks)
46-55: Soft deletes, multi-tenancy, partitioning, indexes, constraints, reporting tables

### Phase 6: UX Improvements (25 tasks)
56-80: Search, shortcuts, dark mode, dashboards, inline editing, toasts, tooltips, guided tours, AI chat

### Phase 7: Infrastructure (25 tasks)
81-105: MQTT broker, WebSockets, polling service, Celery, Prometheus, Sentry, SSL, migrations

## External Dependencies
-   **OpenAI**: Utilized via Replit AI Integrations for AI agents, vision API for OCR bill scanning, and panel diagram analysis.
-   **PostgreSQL**: Primary database.
-   **LangChain**: AI framework for building intelligent agents.
-   **numpy-financial**: Python library for financial functions (NPV, IRR).
-   **pymodbus**: Python library for Modbus TCP/RTU communication for BMS integration.
-   **uvicorn**: ASGI server for running FastAPI.
-   **openpyxl**: For Excel export functionalities.
-   **reportlab**: For PDF report generation.