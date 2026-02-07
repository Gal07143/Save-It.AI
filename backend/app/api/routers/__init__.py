"""API Routers - Export all domain-specific API routers."""
from app.api.routers.sites import router as sites_router
from app.api.routers.assets import router as assets_router
from app.api.routers.meters import router as meters_router
from app.api.routers.bills import router as bills_router
from app.api.routers.notifications import router as notifications_router
from app.api.routers.analysis import router as analysis_router
from app.api.routers.tariffs import router as tariffs_router
from app.api.routers.bess import router as bess_router
from app.api.routers.pv import router as pv_router
from app.api.routers.tenants import router as tenants_router
from app.api.routers.integrations import router as integrations_router
from app.api.routers.admin import router as admin_router
from app.api.routers.data_quality import router as data_quality_router
from app.api.routers.virtual_meters import router as virtual_meters_router
from app.api.routers.maintenance import router as maintenance_router
from app.api.routers.ai_agents import router as ai_agents_router
from app.api.routers.forecasting import router as forecasting_router
from app.api.routers.control import router as control_router
from app.api.routers.auth import router as auth_router
from app.api.routers.reports import router as reports_router
from app.api.routers.ingestion import router as ingestion_router
from app.api.routers.gateways import router as gateways_router
from app.api.routers.device_templates import router as device_templates_router
from app.api.routers.modbus_registers import router as modbus_registers_router
from app.api.routers.public import router as public_router
from app.api.routers.system import router as system_router
from app.api.routers.webhooks import router as webhooks_router
from app.api.routers.telemetry import router as telemetry_router
from app.api.routers.alarms import router as alarms_router
from app.api.routers.kpis import router as kpis_router
from app.routers.device_models import router as device_models_router
from app.routers.device_products import router as device_products_router
from app.routers.devices_v2 import router as devices_v2_router
from app.routers.policies import router as policies_router
from app.routers.certificates import router as certificates_router

# Week 6-8 Service Routers
from app.api.routers.exports import router as exports_router
from app.api.routers.device_groups import router as device_groups_router
from app.api.routers.dashboards import router as dashboards_router
from app.api.routers.scheduled_reports import router as scheduled_reports_router
from app.api.routers.geofences import router as geofences_router
from app.api.routers.work_orders import router as work_orders_router
from app.api.routers.lifecycle import router as lifecycle_router
from app.api.routers.health import router as health_router
from app.api.routers.custom_fields import router as custom_fields_router
from app.api.routers.notification_channels import router as notification_channels_router

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
    "telemetry_router",
    "alarms_router",
    "kpis_router",
    # Week 6-8 Service Routers
    "exports_router",
    "device_groups_router",
    "dashboards_router",
    "scheduled_reports_router",
    "geofences_router",
    "work_orders_router",
    "lifecycle_router",
    "health_router",
    "custom_fields_router",
    "notification_channels_router",
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
    telemetry_router,
    alarms_router,
    kpis_router,
    # Week 6-8 Service Routers
    exports_router,
    device_groups_router,
    dashboards_router,
    scheduled_reports_router,
    geofences_router,
    work_orders_router,
    lifecycle_router,
    health_router,
    custom_fields_router,
    notification_channels_router,
]
