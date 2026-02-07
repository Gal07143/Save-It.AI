"""
SAVE-IT.AI - FastAPI Main Application

An AI-driven energy management platform that combines financial analysis
with electrical engineering (SLD/Digital Twin) to optimize energy usage
for B2B clients.
"""
import os
import sys
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from app.core.database import Base, engine, SessionLocal
from app.api.routers import all_routers
from app.routers.infrastructure import router as infrastructure_router
from app.middleware import (
    RateLimitMiddleware,
    AuditLogMiddleware,
    RequestLogMiddleware,
    error_handler_middleware,
    CacheMiddleware,
    RequestValidationMiddleware,
    SecurityHeadersMiddleware,
    CSRFMiddleware,
    UserContextMiddleware,
)
from app.middleware.multi_tenant import MultiTenantMiddleware
from app.core.config import validate_startup_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events - create all database tables and seed data."""
    from app.models import (
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
    from app.models.integrations import DeviceTemplate, TemplateRegister, Gateway, ModbusRegister, CommunicationLog
    from app.models.devices import (
        DeviceModel, DeviceProduct, Device, Datapoint, Command, AlarmRule,
        DevicePolicy, DeviceCertificate, DeviceDatapoint, CommandExecution,
        DeviceTelemetry, ProductRegisterMapping, RemoteModbusConfig, DeviceEvent
    )
    from app.services.seed_templates import seed_device_templates
    from app.services.seed_device_data import seed_all_device_data
    from app.services.job_queue import job_queue
    from app.core.database import SessionLocal
    
    # Database tables: SQLAlchemy's create_all() is idempotent - it only creates
    # tables that don't exist, so it's safe to run in all environments.
    # Skip in test mode - tests handle their own database setup.
    if os.getenv("TESTING") != "true":
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables verified/created")
        except Exception as e:
            logger.error(f"Failed to create database tables: {e}")
            raise

    db = SessionLocal()
    try:
        if os.getenv("TESTING") != "true":
            seed_device_templates(db)
            seed_all_device_data(db)
    except Exception as e:
        logger.warning(f"Could not seed templates: {e}")
    finally:
        db.close()
    
    # Skip background services in test mode - they can interfere with tests
    if os.getenv("TESTING") != "true":
        await job_queue.start()
        logger.info("Background job queue started")

        from app.services.polling_service import polling_service
        from app.services.scheduler_service import scheduler_service, register_default_tasks
        from app.services.event_bus import event_bus, register_default_handlers
        from app.services.health_service import health_service
        from app.services.service_discovery import service_registry, register_local_services
        from app.services.graceful_shutdown import shutdown_service

        # Initialize AlarmEngine singleton
        from app.services.alarm_engine import AlarmEngine
        alarm_db = SessionLocal()
        alarm_engine = AlarmEngine(alarm_db)
        alarm_engine.load_active_alarms()
        app.state.alarm_engine = alarm_engine
        app.state.alarm_engine_db = alarm_db  # Keep reference for cleanup
        logger.info("AlarmEngine initialized and active alarms loaded")

        # Initialize KPIEngine singleton
        from app.services.kpi_engine import KPIEngine
        kpi_db = SessionLocal()
        kpi_engine = KPIEngine(kpi_db)
        app.state.kpi_engine = kpi_engine
        app.state.kpi_engine_db = kpi_db
        logger.info("KPIEngine initialized")

        await polling_service.start()
        logger.info("Polling service started")

        register_default_tasks(alarm_engine=alarm_engine)
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

        async def cleanup_alarm_engine(metadata=None):
            """Close AlarmEngine DB session on shutdown."""
            if hasattr(app.state, 'alarm_engine_db'):
                app.state.alarm_engine_db.close()
                logger.info("AlarmEngine DB session closed")

        async def cleanup_kpi_engine(metadata=None):
            """Close KPIEngine DB session on shutdown."""
            if hasattr(app.state, 'kpi_engine_db'):
                app.state.kpi_engine_db.close()
                logger.info("KPIEngine DB session closed")

        shutdown_service.register_handler("alarm_engine", cleanup_alarm_engine, priority=55)
        shutdown_service.register_handler("kpi_engine", cleanup_kpi_engine, priority=54)
        logger.info("Graceful shutdown handlers registered")

        # Wire webhook data handler so incoming webhook data gets ingested
        from app.services.webhook_handler import webhook_handler
        from app.services.data_ingestion import get_ingestion_service

        async def _webhook_data_handler(gateway_id: int, payload: dict):
            """Ingest webhook payload into database via DataIngestionService."""
            db = SessionLocal()
            try:
                svc = get_ingestion_service(db, alarm_engine=alarm_engine)
                device_id = payload.get("device_id")
                edge_key = payload.get("edge_key") or payload.get("edgeKey")
                datapoints = payload.get("data", {})
                # Support flat payloads where data dict is the payload itself
                if not datapoints and isinstance(payload, dict):
                    datapoints = {k: v for k, v in payload.items()
                                  if k not in ("device_id", "edge_key", "edgeKey", "timestamp", "readings")}
                # Handle batch readings list
                readings = payload.get("readings")
                if readings and isinstance(readings, list):
                    for reading in readings:
                        r_device = reading.get("device_id")
                        r_edge = reading.get("edge_key") or reading.get("edgeKey")
                        r_data = reading.get("data", {})
                        if not r_data:
                            r_data = {k: v for k, v in reading.items()
                                      if k not in ("device_id", "edge_key", "edgeKey", "timestamp")}
                        svc.ingest_telemetry(
                            device_id=int(r_device) if r_device and str(r_device).isdigit() else None,
                            gateway_id=gateway_id,
                            edge_key=r_edge,
                            datapoints=r_data,
                            source="webhook",
                        )
                elif datapoints:
                    svc.ingest_telemetry(
                        device_id=int(device_id) if device_id and str(device_id).isdigit() else None,
                        gateway_id=gateway_id,
                        edge_key=edge_key,
                        datapoints=datapoints,
                        source="webhook",
                    )
                db.commit()
            except Exception as e:
                db.rollback()
                logger.error(f"Webhook ingestion error for gateway {gateway_id}: {e}")
            finally:
                db.close()

        webhook_handler.add_handler(_webhook_data_handler)
        logger.info("Webhook data handler registered")

        # Start MQTT Subscriber for IoT device communication
        # Note: Uses external Mosquitto broker (not Python amqtt) for better reliability.
        # Mosquitto should be running on localhost:1883
        from app.services.mqtt_subscriber import mqtt_subscriber, DataIngestionHandler
        from app.services.mqtt_credentials import mqtt_credential_manager
        import asyncio

        try:
            # Initialize credential manager for syncing gateway creds to Mosquitto
            await mqtt_credential_manager.initialize()
            logger.info("MQTT credential manager initialized")

            # Setup data ingestion handler for MQTT messages (with AlarmEngine)
            ingestion_handler = DataIngestionHandler(SessionLocal, alarm_engine=alarm_engine)
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

    if os.getenv("TESTING") != "true":
        from app.services.graceful_shutdown import shutdown_service
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

# CORS: Use explicit origins and methods in production, allow broader access in development
_cors_origins = settings.allowed_origins_list
if not settings.DEBUG and settings.ENVIRONMENT == "production":
    # Validate that origins are explicitly configured in production
    if _cors_origins == ["http://localhost:5000"]:
        logger.warning(
            "CORS: ALLOWED_ORIGINS is still default in production. "
            "Set ALLOWED_ORIGINS to your actual frontend domain(s)."
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
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
app.add_middleware(UserContextMiddleware, db_session_factory=SessionLocal)
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
    from app.services.mqtt_broker import mqtt_broker

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
    from app.services.metrics_service import metrics_registry, update_database_pool_metrics

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
