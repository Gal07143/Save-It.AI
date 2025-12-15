# SAVE-IT.AI

AI-driven energy management platform that combines financial analysis (bills) with electrical engineering (SLD/Digital Twin) to optimize energy usage for B2B clients.

## Overview

SAVE-IT.AI is an MVP foundation for an EnergyTech SaaS platform designed to help B2B clients:
- Monitor and optimize energy consumption
- Validate utility bills against actual meter readings
- Identify unmetered electrical assets (Gap Analysis)
- Calculate ROI for solar installations
- Receive AI-generated alerts and recommendations

## Tech Stack

- **Backend**: Python (FastAPI)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Data Validation**: Pydantic
- **AI/Logic**: LangChain structure for Agents
- **Data Analysis**: Pandas, NumPy

## Core Modules

### 1. Digital Twin Engine
- Hierarchical asset model representing Single Line Diagram (SLD)
- Asset types: Main Breaker -> Sub Panel -> Distribution Board -> Consumer
- **Gap Analysis**: Compares SLD asset tree vs. connected meters to find unmetered nodes

### 2. Financial Engine
- Bill and Tariff data models
- Bill parsing from JSON input
- **Bill Validation**: Cross-references bill totals with meter readings

### 3. Optimization & AI Agents
- Notification system for AI-generated alerts
- Alert types: Peak Shaving, Missing Meter, Bill Variance, etc.
- **Solar ROI Calculator**: Financial projections for solar installations

## API Endpoints

### Sites
- `GET /api/v1/sites` - List all sites
- `POST /api/v1/sites` - Create a new site
- `GET /api/v1/sites/{id}` - Get site details
- `PUT /api/v1/sites/{id}` - Update site
- `DELETE /api/v1/sites/{id}` - Delete site

### Assets (SLD Hierarchy)
- `GET /api/v1/assets` - List all assets
- `GET /api/v1/assets/tree/{site_id}` - Get asset hierarchy tree
- `POST /api/v1/assets` - Create asset
- `DELETE /api/v1/assets/{id}` - Delete asset

### Meters
- `GET /api/v1/meters` - List all meters
- `POST /api/v1/meters` - Create meter
- `GET /api/v1/meters/{id}/readings` - Get meter readings
- `POST /api/v1/meters/readings` - Create reading

### Bills
- `GET /api/v1/bills` - List all bills
- `POST /api/v1/bills` - Create bill
- `POST /api/v1/bills/{id}/validate` - Validate bill against meters

### Analysis
- `GET /api/v1/analysis/gap-analysis/{site_id}` - Run gap analysis
- `POST /api/v1/analysis/solar-roi` - Calculate solar ROI

### Notifications
- `GET /api/v1/notifications` - List notifications
- `POST /api/v1/notifications/{id}/read` - Mark as read
- `POST /api/v1/notifications/{id}/resolve` - Mark as resolved

## Database Schema

### Core Entities
- **Site**: Physical facility/location
- **Asset**: Electrical components in SLD hierarchy (self-referential for parent-child)
- **Meter**: Physical meter device linked to assets
- **MeterReading**: Time-series energy data
- **Bill**: Utility bills with line items
- **Tariff**: Pricing structures with time-of-use rates
- **Notification**: AI-generated alerts

## Key Algorithms

### Gap Analysis
Compares the hierarchical Asset Tree with connected Meters to identify unmetered nodes:
1. Get all assets for a site that require metering
2. Get all active meters and their asset associations
3. Find assets without meters
4. Generate recommendations based on criticality and coverage

### Bill Validation
Cross-references bill totals with aggregated meter readings:
1. Parse bill period dates
2. Sum all meter readings within the period
3. Calculate variance percentage
4. Flag significant discrepancies (>2%)

### Solar ROI Calculation
Calculates financial projections for solar installations:
- Simple Payback Period
- Net Present Value (NPV)
- Internal Rate of Return (IRR)
- 25-year annual projections with degradation

## Setup Instructions

### Prerequisites
- Python 3.11+
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   or with pyproject.toml:
   ```bash
   pip install -e .
   ```

3. Set environment variables:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/saveit"
   ```

4. Run the application:
   ```bash
   python main.py
   ```
   or with uvicorn:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 5000 --reload
   ```

5. Access the API documentation at:
   - Swagger UI: http://localhost:5000/docs
   - ReDoc: http://localhost:5000/redoc

## Project Structure

```
.
├── main.py                    # FastAPI application entry point
├── README.md                  # This file
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routers/       # API endpoint routers
│   │   ├── core/              # Configuration and database
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/
│   │   │   ├── digital_twin/  # Gap analysis service
│   │   │   ├── financial/     # Bill validation service
│   │   │   └── optimization/  # Solar ROI, notifications
│   │   └── agents/            # LangChain AI agents
│   └── tests/                 # Test suite
└── pyproject.toml             # Project dependencies
```

## License

Proprietary - SAVE-IT.AI
