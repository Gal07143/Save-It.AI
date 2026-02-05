"""
SAVE-IT.AI - FastAPI Main Application

An AI-driven energy management platform that combines financial analysis
with electrical engineering (SLD/Digital Twin) to optimize energy usage
for B2B clients.
"""
import os
import sys
import logging

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from backend.app.core.database import Base, engine, SessionLocal
from backend.app.api.routers import all_routers
from backend.app.routers.infrastructure import router as infrastructure_router
from backend.app.middleware import (
    RateLimitMiddleware,
    AuditLogMiddleware,
    RequestLogMiddleware,
    error_handler_middleware,
    CacheMiddleware,
    RequestValidationMiddleware,
    SecurityHeadersMiddleware,
    CSRFMiddleware,
)
from backend.app.middleware.multi_tenant import MultiTenantMiddleware
from backend.app.core.config import validate_startup_config


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
    from backend.app.models.devices import (
        DeviceModel, DeviceProduct, Device, Datapoint, Command, AlarmRule,
        DevicePolicy, DeviceCertificate, DeviceDatapoint, CommandExecution,
        DeviceTelemetry, ProductRegisterMapping, RemoteModbusConfig, DeviceEvent
    )
    from backend.app.services.seed_templates import seed_device_templates
    from backend.app.services.seed_device_data import seed_all_device_data
    from backend.app.services.job_queue import job_queue
    from backend.app.core.database import SessionLocal
    
    # Database tables: SQLAlchemy's create_all() is idempotent - it only creates
    # tables that don't exist, so it's safe to run in all environments.
    # This ensures the database schema is always up-to-date on startup.
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise

    db = SessionLocal()
    try:
        seed_device_templates(db)
        seed_all_device_data(db)
    except Exception as e:
        logger.warning(f"Could not seed templates: {e}")
    finally:
        db.close()
    
    await job_queue.start()
    logger.info("Background job queue started")
    
    from backend.app.services.polling_service import polling_service
    from backend.app.services.scheduler_service import scheduler_service, register_default_tasks
    from backend.app.services.event_bus import event_bus, register_default_handlers
    from backend.app.services.health_service import health_service
    from backend.app.services.service_discovery import service_registry, register_local_services
    from backend.app.services.graceful_shutdown import shutdown_service
    
    await polling_service.start()
    logger.info("Polling service started")
    
    register_default_tasks()
    await scheduler_service.start()
    logger.info("Scheduler service started")
    
    await register_default_handlers()
    logger.info("Event handlers registered")
    
    await health_service.start()
    logger.info("Health service started")
    
    register_local_services()
    await service_registry.start()
    logger.info("Service registry started")
    
    shutdown_service.register_handler("polling", polling_service.stop, priority=100)
    shutdown_service.register_handler("scheduler", scheduler_service.stop, priority=90)
    shutdown_service.register_handler("health", health_service.stop, priority=80)
    shutdown_service.register_handler("service_registry", service_registry.stop, priority=70)
    shutdown_service.register_handler("job_queue", job_queue.stop, priority=60)
    logger.info("Graceful shutdown handlers registered")

    # Start MQTT Subscriber for IoT device communication
    # Note: Uses external Mosquitto broker (not Python amqtt) for better reliability.
    # Mosquitto should be running on localhost:1883
    from backend.app.services.mqtt_subscriber import mqtt_subscriber, DataIngestionHandler
    from backend.app.services.mqtt_credentials import mqtt_credential_manager
    import asyncio

    try:
        # Initialize credential manager for syncing gateway creds to Mosquitto
        await mqtt_credential_manager.initialize()
        logger.info("MQTT credential manager initialized")

        # Setup data ingestion handler for MQTT messages
        ingestion_handler = DataIngestionHandler(SessionLocal)
        mqtt_subscriber.add_handler("data", ingestion_handler.handle_data_message)
        mqtt_subscriber.add_handler("telemetry", ingestion_handler.handle_data_message)
        mqtt_subscriber.add_handler("heartbeat", ingestion_handler.handle_heartbeat)
        mqtt_subscriber.add_handler("status", ingestion_handler.handle_status)

        # Subscribe to all gateway and device topics
        await mqtt_subscriber.subscribe("saveit/#")
        await mqtt_subscriber.subscribe("device/#")

        # Get internal credentials for connecting to Mosquitto
        mqtt_user, mqtt_pass = mqtt_credential_manager.get_internal_credentials()

        # Start subscriber in background task with credentials
        asyncio.create_task(mqtt_subscriber.start(username=mqtt_user, password=mqtt_pass))
        logger.info("MQTT Subscriber connected to Mosquitto broker")

        # Register shutdown handlers
        shutdown_service.register_handler("mqtt_subscriber", mqtt_subscriber.stop, priority=95)
        shutdown_service.register_handler("mqtt_credentials", mqtt_credential_manager.stop, priority=50)
    except Exception as e:
        logger.warning(f"Could not start MQTT services: {e}. Ensure Mosquitto is running.")

    yield
    
    await shutdown_service.shutdown()
    logger.info("Background services stopped")


app = FastAPI(
    title="SAVE-IT.AI",
    description="AI-driven energy management platform for B2B clients",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False
)

# Validate configuration at startup
try:
    validate_startup_config()
except RuntimeError as e:
    logger.error(f"Configuration validation failed: {e}")
    if not settings.DEBUG:
        raise

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-CSRF-Token",
        "X-API-Key",
    ],
    expose_headers=[
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],
)

# Security headers middleware (adds HSTS, CSP, X-Frame-Options, etc.)
app.add_middleware(SecurityHeadersMiddleware)

# CSRF protection (validates tokens on POST/PUT/DELETE/PATCH)
app.add_middleware(CSRFMiddleware)

app.add_middleware(RequestLogMiddleware)
app.add_middleware(CacheMiddleware)
app.add_middleware(RequestValidationMiddleware)
app.add_middleware(MultiTenantMiddleware)
app.add_middleware(AuditLogMiddleware, db_session_factory=SessionLocal)
app.add_middleware(
    RateLimitMiddleware,
    default_limit=100,
    default_window=60,
    burst_limit=20,
    redis_url=settings.REDIS_URL if hasattr(settings, 'REDIS_URL') else None,
)

app.middleware("http")(error_handler_middleware)

for router in all_routers:
    app.include_router(router)

app.include_router(infrastructure_router, prefix="/api/v1")


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
    """Simple health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/v1/health")
def api_health_check():
    """Detailed API health check with component status."""
    from sqlalchemy import text
    from backend.app.services.mqtt_broker import mqtt_broker

    components = {
        "api": {"status": "healthy"},
        "database": {"status": "unknown"},
        "mqtt_broker": {"status": "unknown"},
    }

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        components["database"] = {"status": "healthy"}
    except Exception as e:
        components["database"] = {"status": "unhealthy", "error": str(e)}

    # Check MQTT broker status
    mqtt_status = mqtt_broker.get_status()
    components["mqtt_broker"] = {
        "status": "healthy" if mqtt_status.get("running") else "stopped",
        "port": mqtt_status.get("port"),
        "connected_clients": mqtt_status.get("connected_clients", 0),
    }

    overall_status = "healthy" if all(
        c.get("status") in ["healthy", "stopped"] for c in components.values()
    ) else "degraded"

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "components": components,
    }


@app.get("/api/v1/health/live")
def liveness_probe():
    """Kubernetes liveness probe - is the application running?"""
    return {"status": "alive"}


@app.get("/api/v1/health/ready")
def readiness_probe():
    """Kubernetes readiness probe - is the application ready to serve requests?"""
    from sqlalchemy import text

    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "ready"}
    except Exception:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "not_ready"})


@app.get("/metrics")
def prometheus_metrics():
    """Prometheus metrics endpoint."""
    from fastapi.responses import PlainTextResponse
    from backend.app.services.metrics_service import metrics_registry, update_database_pool_metrics

    # Update dynamic metrics
    update_database_pool_metrics()

    # Return Prometheus format
    return PlainTextResponse(
        content=metrics_registry.to_prometheus(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
