# SAVE-IT.AI - Compressed Project Overview

## Overview
SAVE-IT.AI is an AI-driven enterprise energy management platform aimed at optimizing energy usage for B2B clients. It integrates financial analysis with electrical engineering principles, including SLD (Single Line Diagram) and Digital Twin technology, to deliver comprehensive energy management solutions. The platform supports Battery Energy Storage System (BESS) analysis, tenant billing, and Building Management System (BMS) integrations. Its core purpose is to reduce energy costs, enhance efficiency, and provide advanced insights into energy consumption and generation. The project envisions becoming a leading solution for intelligent energy management, offering significant financial and operational benefits to commercial and industrial sectors.

## User Preferences
- Clean Architecture principles
- Type hints on all Python code
- Docstrings for complex logic
- Modular code structure (Routers, Services, Schemas, Models)

## System Architecture
The SAVE-IT.AI platform utilizes a modern tech stack, featuring a FastAPI backend and a React frontend.

**UI/UX Decisions:**
The frontend features 27 application pages with reusable components, a dark theme, and card-based layouts for an improved user experience. It includes dynamic power flow visualizations and detailed dashboards for sites, PV systems, and storage units. A new 4-step site setup wizard streamlines the onboarding process. Consolidated navigation and dedicated pages for energy assets, carbon/ESG reporting, and digital twin management enhance usability.

**Tabbed Interface Enhancement (Phase 8):**
All 21 content pages now use a consistent 6-tab layout via the reusable TabPanel component (3 variants: default, pills, underline). The navigation is organized into 7 groups:
1. **Overview** - Dashboard, Sites
2. **Assets & Metering** - Digital Twin, Meters, Virtual Meters
3. **Financial** - Bills, Tariffs, Tenants
4. **Energy Systems** - Energy Assets, PV Design, BESS Simulator
5. **Devices** - Devices (new), Device Config (new), Device Health (new)
6. **Reports & ESG** - Reports, Carbon & ESG, Data Quality, AI Agents
7. **Administration** - Admin, Settings

Deprecated routes (/integrations, /data-ingestion) redirect to /devices.

**Technical Implementations:**
- **Backend**: Python 3.11, FastAPI for API services.
- **Database**: PostgreSQL, architected for future TimescaleDB integration for time-series data.
- **ORM**: SQLAlchemy 2.0 for database interactions.
- **Data Validation**: Pydantic v2 for schema definition and validation.
- **AI**: LangChain integrated with OpenAI (via Replit AI Integrations) for AI agents and analytics.
- **Financials**: `numpy-financial` for advanced calculations (NPV, IRR).
- **BMS Integration**: `pymodbus` for Modbus TCP/RTU communication.

**Feature Specifications:**
- **Digital Twin Engine**: Manages a hierarchical asset tree (SLD), uses AI for panel diagram import and automatic asset extraction, and identifies unmetered electrical nodes through gap analysis.
- **Financial Engine**: Handles bill parsing, storage, and validation against meter readings, including OCR via OpenAI Vision API.
- **Optimization**: Provides solar ROI calculations and AI-generated notifications for energy-saving opportunities.
- **BESS Financial Analyzer**: Conducts Time-of-Use arbitrage and peak shaving simulations with 8760-hour annual simulations, including NPV/IRR calculations using vendor/model catalogs.
- **Tenant Billing Engine**: Supports multi-tenant sub-billing, lease contract management, and automated invoice generation with configurable charges.
- **Integration Layer**: Features an abstract driver architecture for various data sources (e.g., ModbusTCP, CSV) with data normalization and gateway management for meter data collection. Includes device templates, template export/import, and connection testing.
- **PV Design & Assessment**: Offers a catalog of PV modules, site assessments, surface management, and design scenarios with ROI projections (NPV, IRR, LCOE).
- **Platform Foundation**: Supports multi-tenant organization management, user management with Role-Based Access Control (RBAC), audit logging, and period locking for billing cycles.
- **Data Quality**: Provides a dashboard for quality metrics, issue tracking, and resolution.
- **Virtual Meters**: Manages calculated and allocated meters using an expression engine.
- **AI & Forecasting**: Includes conversational AI for energy analysis, AI-generated recommendations, load and PV production forecasting, predictive maintenance alerts, and asset condition tracking.
- **Control Engine**: Manages automation rules and tracks command execution.
- **Backend Hardening**: Implements rate limiting, API key authentication, audit logging, response caching, background job queues, health checks, TimescaleDB preparation, GDPR data export/deletion, XSS/SQL injection protection, standardized error handling, request logging, CORS, and API versioning.
- **Database Architecture**: Incorporates soft deletes, multi-tenancy enforcement, database indexes, foreign key constraints, unique constraints, check constraints, reporting views, materialized views, and connection pooling.

## Development Progress

**Total: 105/105 tasks complete (100%) ✅**

### All Phases Completed
- Phase 1: Core Fixes (12 tasks) ✅
- Phase 2: Device Onboarding Wizard (4 tasks) ✅
- Phase 3: Advanced Device Features (14 tasks) ✅
- Phase 4: Backend Hardening (15 tasks) ✅
- Phase 5: Database (10 tasks) ✅
- Phase 6: UX Improvements (25 tasks) ✅
- Phase 7: Infrastructure (25 tasks) ✅

### Phase 6: UX Components Created
- **ToastContext** - Global notification system (success/error/warning/info)
- **Tooltip** - Hover hints with position options
- **ConfirmDialog** - Consistent destructive action modals
- **DateRangePicker** - Date filter with quick presets
- **NotificationCenter** - Bell dropdown with unread notifications
- **DataExport** - CSV/JSON export for tables
- **CardHeader** - Reusable page section header with optional action button
- **useActionToast** - Hook for common toast patterns (saved, deleted, copied, comingSoon)
- **CopyButton** - One-click clipboard copy
- **BulkActions** - Multi-select with batch operations
- **InlineEdit** - Click-to-edit text and select fields
- **GuidedTour** - Interactive walkthrough for new users
- **Favorites** - Bookmarks with localStorage persistence
- **FilterPersistence** - Remember filters across sessions
- **UserPreferences** - Language, timezone, units, theme settings
- **RecentActivity** - Activity feed component
- **AccessibilityHelpers** - SkipLink, FocusTrap, LiveRegion, A11yAnnouncer
- **DashboardWidgets** - Configurable widget layout with drag-and-drop
- **InteractiveChart** - Zoom, pan, drill-down for charts

### Phase 7: Infrastructure Services Created
- **WebSocketService** - Real-time data push with channel subscriptions
- **PollingService** - Background device data collection with backoff
- **SchedulerService** - Cron-like scheduled tasks (reports, cleanup)
- **EventBus** - Internal pub/sub for decoupled components
- **MetricsService** - Prometheus-style metrics (counters, gauges, histograms)
- **TracingService** - Request tracing with correlation IDs and spans
- **ConfigService** - Environment-based configuration management
- **FeatureFlags** - Toggle features without deployment
- **WebhookService** - Outbound webhooks with retry and signing
- **EmailService** - Transactional email with templates
- **PDFService** - Report and invoice PDF generation
- **StorageService** - File storage with validation and checksums
- **BackupService** - Data archival, retention policies, verification
- **SecurityService** - Dependency scanning, input validation, password checks
- **CircuitBreaker** - External service resilience pattern
- **GracefulShutdown** - Clean connection handling on shutdown
- **HealthService** - Comprehensive health monitoring
- **APIVersioning** - Version negotiation with deprecation headers
- **ServiceDiscovery** - Dynamic endpoint resolution
- **LoadTesting** - Performance benchmarks utility
- **Alembic** - Database migration system setup

## External Dependencies
-   **OpenAI**: For AI agents, Vision API (OCR bill scanning, panel diagram analysis), and LangChain integration.
-   **PostgreSQL**: Primary relational database.
-   **LangChain**: AI framework for developing intelligent agents.
-   **numpy-financial**: Python library for financial calculations (Net Present Value, Internal Rate of Return).
-   **pymodbus**: Python library for Modbus TCP/RTU communication, used for BMS integration.
-   **uvicorn**: ASGI server used for deploying FastAPI applications.
-   **openpyxl**: Library for reading and writing Excel 2010 xlsx/xlsm/xltx/xltm files, used for export functionalities.
-   **reportlab**: Library for generating PDF documents, used for report generation.
-   **httpx**: Async HTTP client for webhooks and external API calls.
