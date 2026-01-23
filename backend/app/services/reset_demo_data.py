"""
Reset Demo Data Service

Clears all instance data (sites, meters, gateways, devices, readings, etc.)
while preserving system templates, models, policies, and catalogs.
"""
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text, MetaData, Table
from sqlalchemy.exc import NoSuchTableError

logger = logging.getLogger(__name__)

TABLES_TO_DELETE = [
    "device_telemetry",
    "command_executions",
    "device_events",
    "device_datapoints",
    "device_certificates",
    "devices",
    "measurements",
    "communication_logs",
    "forecast_series",
    "forecast_jobs",
    "recommendations",
    "agent_messages",
    "agent_sessions",
    "meter_readings",
    "bill_line_items",
    "bills",
    "meters",
    "data_sources",
    "gateways",
    "tariff_rates",
    "tariffs",
    "invoices",
    "lease_contracts",
    "tenants",
    "maintenance_alerts",
    "asset_conditions",
    "assets",
    "virtual_meter_components",
    "allocation_rules",
    "virtual_meters",
    "quality_issues",
    "meter_quality_summaries",
    "pv_design_scenarios",
    "pv_surfaces",
    "placement_zones",
    "site_maps",
    "pv_assessments",
    "bess_simulation_results",
    "bess_data_readings",
    "bess_datasets",
    "control_commands",
    "control_rules",
    "safety_gates",
    "notification_deliveries",
    "notifications",
    "file_assets",
    "period_locks",
    "user_site_permissions",
    "org_sites",
    "sites",
]


def reset_demo_data(db: Session) -> dict:
    """
    Reset all demo/instance data while preserving system templates.
    
    Preserves:
    - Device models (system blueprints)
    - Device products (manufacturer catalog)
    - Device policies (system policies)
    - Device templates (integration templates)
    - PV module catalog
    - BESS vendor/model catalog
    - Notification templates
    - Data quality rules
    
    Clears:
    - Sites and related data
    - Meters and readings
    - Gateways and data sources
    - Devices and telemetry
    - Bills and invoices
    - Tenants and contracts
    - Assets and conditions
    - User sessions and messages
    - Forecasts and recommendations
    """
    deleted_counts = {}
    
    try:
        # Reflect tables using the engine bound to the Session. Reflecting treats names as identifiers
        # rather than string-concatenated SQL, which avoids SQL injection risks reported by Bandit.
        engine = db.get_bind()
        metadata = MetaData()

        for table_name in TABLES_TO_DELETE:
            try:
                # Reflect the table from the database; this treats the name as an identifier, not raw SQL text.
                tbl = Table(table_name, metadata, autoload_with=engine)
                result = db.execute(tbl.delete())
                # result.rowcount may be None for some DBAPIs; normalize to int.
                deleted_counts[table_name] = int(result.rowcount or 0)
            except NoSuchTableError:
                logger.warning(f"Table not found, skipping: {table_name}")
                deleted_counts[table_name] = 0
            except Exception as table_error:
                logger.warning(f"Could not delete from {table_name}: {table_error}")
                deleted_counts[table_name] = 0

        db.commit()

        total_deleted = sum(deleted_counts.values())
        logger.info(f"Reset demo data complete. Deleted {total_deleted} records across {len(deleted_counts)} tables.")

        return {
            "success": True,
            "message": f"Successfully reset demo data. Deleted {total_deleted} records.",
            "deleted_counts": {k: v for k, v in deleted_counts.items() if v > 0},
            "preserved": [
                "device_models (system blueprints)",
                "device_products (manufacturer catalog)",
                "device_policies (system policies)",
                "device_templates (integration templates)",
                "pv_module_catalog (solar panels)",
                "bess_vendors (storage vendors)",
                "bess_models (storage models)",
                "notification_templates",
                "data_quality_rules",
                "organizations",
                "users",
            ]
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to reset demo data: {e}")
        return {
            "success": False,
            "message": f"Failed to reset demo data: {str(e)}",
            "deleted_counts": deleted_counts,
        }
