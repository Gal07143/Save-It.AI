"""API Routers - Export all domain-specific API routers."""
from backend.app.api.routers.sites import router as sites_router
from backend.app.api.routers.assets import router as assets_router
from backend.app.api.routers.meters import router as meters_router
from backend.app.api.routers.bills import router as bills_router
from backend.app.api.routers.notifications import router as notifications_router
from backend.app.api.routers.analysis import router as analysis_router
from backend.app.api.routers.tariffs import router as tariffs_router
from backend.app.api.routers.bess import router as bess_router
from backend.app.api.routers.pv import router as pv_router
from backend.app.api.routers.tenants import router as tenants_router
from backend.app.api.routers.integrations import router as integrations_router
from backend.app.api.routers.admin import router as admin_router
from backend.app.api.routers.data_quality import router as data_quality_router
from backend.app.api.routers.virtual_meters import router as virtual_meters_router
from backend.app.api.routers.maintenance import router as maintenance_router
from backend.app.api.routers.ai_agents import router as ai_agents_router
from backend.app.api.routers.forecasting import router as forecasting_router
from backend.app.api.routers.control import router as control_router
from backend.app.api.routers.auth import router as auth_router
from backend.app.api.routers.reports import router as reports_router
from backend.app.api.routers.ingestion import router as ingestion_router
from backend.app.api.routers.gateways import router as gateways_router
from backend.app.api.routers.device_templates import router as device_templates_router
from backend.app.api.routers.modbus_registers import router as modbus_registers_router
from backend.app.api.routers.public import router as public_router
from backend.app.api.routers.system import router as system_router
from backend.app.api.routers.webhooks import router as webhooks_router
from backend.app.routers.device_models import router as device_models_router
from backend.app.routers.device_products import router as device_products_router
from backend.app.routers.devices_v2 import router as devices_v2_router
from backend.app.routers.policies import router as policies_router
from backend.app.routers.certificates import router as certificates_router

__all__ = [
    "sites_router",
    "assets_router",
    "meters_router",
    "bills_router",
    "notifications_router",
    "analysis_router",
    "tariffs_router",
    "bess_router",
    "pv_router",
    "tenants_router",
    "integrations_router",
    "admin_router",
    "data_quality_router",
    "virtual_meters_router",
    "maintenance_router",
    "ai_agents_router",
    "forecasting_router",
    "control_router",
    "auth_router",
    "reports_router",
    "ingestion_router",
    "gateways_router",
    "device_templates_router",
    "modbus_registers_router",
    "public_router",
    "system_router",
    "webhooks_router",
    "device_models_router",
    "device_products_router",
    "devices_v2_router",
    "policies_router",
    "certificates_router",
]

all_routers = [
    sites_router,
    assets_router,
    meters_router,
    bills_router,
    notifications_router,
    analysis_router,
    tariffs_router,
    bess_router,
    pv_router,
    tenants_router,
    integrations_router,
    admin_router,
    data_quality_router,
    virtual_meters_router,
    maintenance_router,
    ai_agents_router,
    forecasting_router,
    control_router,
    auth_router,
    reports_router,
    ingestion_router,
    gateways_router,
    device_templates_router,
    modbus_registers_router,
    public_router,
    system_router,
    webhooks_router,
    device_models_router,
    device_products_router,
    devices_v2_router,
    policies_router,
    certificates_router,
]
