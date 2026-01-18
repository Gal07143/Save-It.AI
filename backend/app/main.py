"""
SAVE-IT.AI - FastAPI Main Application

An AI-driven energy management platform that combines financial analysis
with electrical engineering (SLD/Digital Twin) to optimize energy usage
for B2B clients.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.core.database import Base, engine
from backend.app.api.routers import all_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events - create all database tables and seed data."""
    from backend.app.models import (
        Site, Asset, Meter, MeterReading, Bill, BillLineItem, Tariff, TariffRate, Notification,
        DataSource, Measurement, Tenant, LeaseContract, Invoice, BatterySpecs,
        BESSVendor, BESSModel, BESSDataset, BESSDataReading, BESSSimulationResult,
        PVModuleCatalog, PVAssessment, PVSurface, PVDesignScenario, SiteMap, PlacementZone,
        Organization, User, OrgSite, UserSitePermission, AuditLog, FileAsset, PeriodLock,
        NotificationTemplate, NotificationPreference, NotificationDelivery,
        DataQualityRule, QualityIssue, MeterQualitySummary,
        VirtualMeter, VirtualMeterComponent, AllocationRule,
        MaintenanceRule, AssetCondition, MaintenanceAlert,
        AgentSession, AgentMessage, Recommendation, ForecastJob, ForecastSeries,
        ControlRule, SafetyGate, ControlCommand
    )
    from backend.app.models.integrations import DeviceTemplate, TemplateRegister, Gateway, ModbusRegister, CommunicationLog
    from backend.app.services.seed_templates import seed_device_templates
    from backend.app.core.database import SessionLocal
    
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_device_templates(db)
    except Exception as e:
        print(f"Warning: Could not seed templates: {e}")
    finally:
        db.close()
    
    yield


app = FastAPI(
    title="SAVE-IT.AI",
    description="AI-driven energy management platform for B2B clients",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in all_routers:
    app.include_router(router)


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "name": "SAVE-IT.AI",
        "version": "1.0.0",
        "description": "AI-driven energy management platform",
        "docs_url": "/docs",
        "api_prefix": "/api/v1"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
