"""Add production-ready indexes

Revision ID: 003
Revises: 002
Create Date: 2026-01-24

Adds additional indexes for production performance:
- devices(gateway_id, is_active) - Gateway device queries
- data_sources(gateway_id, is_active) - Data source queries
- device_datapoints(device_id, timestamp) - Time-series queries
- gateway(site_id, status) - Gateway status queries
- forecast_jobs(site_id, status, created_at) - Forecast queries
- quality_issues(meter_id, resolved_at) - Quality issue queries
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Data sources indexes for gateway queries
    op.create_index(
        'ix_data_sources_gateway_id',
        'data_sources',
        ['gateway_id'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_data_sources_gateway_active',
        'data_sources',
        ['gateway_id', 'is_active'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_data_sources_site_active',
        'data_sources',
        ['site_id', 'is_active'],
        unique=False,
        if_not_exists=True
    )

    # Devices indexes for device management
    op.create_index(
        'ix_devices_gateway_active',
        'devices',
        ['gateway_id', 'is_active'],
        unique=False,
        if_not_exists=True
    )

    # Gateway indexes for status queries
    op.create_index(
        'ix_gateways_site_id',
        'gateways',
        ['site_id'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_gateways_site_status',
        'gateways',
        ['site_id', 'status'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_gateways_last_seen',
        'gateways',
        ['last_seen_at'],
        unique=False,
        if_not_exists=True
    )

    # Device datapoints for time-series queries
    op.create_index(
        'ix_device_datapoints_device_timestamp',
        'device_datapoints',
        ['device_id', 'timestamp'],
        unique=False,
        if_not_exists=True
    )

    # Forecast jobs for job management
    op.create_index(
        'ix_forecast_jobs_site_status',
        'forecast_jobs',
        ['site_id', 'status'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_forecast_jobs_created_at',
        'forecast_jobs',
        ['created_at'],
        unique=False,
        if_not_exists=True
    )

    # Quality issues for data quality dashboard
    op.create_index(
        'ix_quality_issues_meter_resolved',
        'quality_issues',
        ['meter_id', 'resolved_at'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_quality_issues_severity',
        'quality_issues',
        ['severity', 'resolved_at'],
        unique=False,
        if_not_exists=True
    )

    # Virtual meters for site queries
    op.create_index(
        'ix_virtual_meters_site_id',
        'virtual_meters',
        ['site_id'],
        unique=False,
        if_not_exists=True
    )

    # Maintenance alerts for dashboard queries
    op.create_index(
        'ix_maintenance_alerts_asset_ack',
        'maintenance_alerts',
        ['asset_id', 'acknowledged_at'],
        unique=False,
        if_not_exists=True
    )

    # Users for organization queries
    op.create_index(
        'ix_users_org_active',
        'users',
        ['organization_id', 'is_active'],
        unique=False,
        if_not_exists=True
    )


def downgrade() -> None:
    # Drop indexes in reverse order
    op.drop_index('ix_users_org_active', table_name='users', if_exists=True)
    op.drop_index('ix_maintenance_alerts_asset_ack', table_name='maintenance_alerts', if_exists=True)
    op.drop_index('ix_virtual_meters_site_id', table_name='virtual_meters', if_exists=True)
    op.drop_index('ix_quality_issues_severity', table_name='quality_issues', if_exists=True)
    op.drop_index('ix_quality_issues_meter_resolved', table_name='quality_issues', if_exists=True)
    op.drop_index('ix_forecast_jobs_created_at', table_name='forecast_jobs', if_exists=True)
    op.drop_index('ix_forecast_jobs_site_status', table_name='forecast_jobs', if_exists=True)
    op.drop_index('ix_device_datapoints_device_timestamp', table_name='device_datapoints', if_exists=True)
    op.drop_index('ix_gateways_last_seen', table_name='gateways', if_exists=True)
    op.drop_index('ix_gateways_site_status', table_name='gateways', if_exists=True)
    op.drop_index('ix_gateways_site_id', table_name='gateways', if_exists=True)
    op.drop_index('ix_devices_gateway_active', table_name='devices', if_exists=True)
    op.drop_index('ix_data_sources_site_active', table_name='data_sources', if_exists=True)
    op.drop_index('ix_data_sources_gateway_active', table_name='data_sources', if_exists=True)
    op.drop_index('ix_data_sources_gateway_id', table_name='data_sources', if_exists=True)
