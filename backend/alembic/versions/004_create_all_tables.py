"""Create all tables - Comprehensive schema migration

Revision ID: 004
Revises: 003
Create Date: 2026-02-05

This migration ensures all tables exist. It's designed to be idempotent -
safe to run even if tables already exist.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision: str = '004'
down_revision: Union[str, None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    """Create all tables that don't exist."""

    # =========================================================================
    # CORE TABLES (sites, assets, meters)
    # =========================================================================

    if not table_exists('sites'):
        op.create_table('sites',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('address', sa.Text(), nullable=True),
            sa.Column('city', sa.String(100), nullable=True),
            sa.Column('country', sa.String(100), nullable=True),
            sa.Column('latitude', sa.Float(), nullable=True),
            sa.Column('longitude', sa.Float(), nullable=True),
            sa.Column('timezone', sa.String(50), nullable=True),
            sa.Column('is_active', sa.Integer(), default=1),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_sites_organization', 'sites', ['organization_id'])

    # =========================================================================
    # DEVICE TABLES (IoT devices, gateways, telemetry)
    # =========================================================================

    if not table_exists('gateways'):
        op.create_table('gateways',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('site_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('gateway_type', sa.String(50), nullable=False),
            sa.Column('status', sa.String(50), default='offline'),
            sa.Column('ip_address', sa.String(45), nullable=True),
            sa.Column('mac_address', sa.String(17), nullable=True),
            sa.Column('firmware_version', sa.String(100), nullable=True),
            sa.Column('mqtt_client_id', sa.String(255), nullable=True),
            sa.Column('mqtt_username', sa.String(255), nullable=True),
            sa.Column('mqtt_password_hash', sa.String(255), nullable=True),
            sa.Column('mqtt_topic_prefix', sa.String(255), nullable=True),
            sa.Column('webhook_api_key', sa.String(255), nullable=True),
            sa.Column('webhook_secret', sa.String(255), nullable=True),
            sa.Column('last_seen_at', sa.DateTime(), nullable=True),
            sa.Column('registered_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE')
        )
        op.create_index('ix_gateways_site', 'gateways', ['site_id'])
        op.create_index('ix_gateways_status', 'gateways', ['status'])

    if not table_exists('device_models'):
        op.create_table('device_models',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('category', sa.String(100), nullable=False),
            sa.Column('manufacturer', sa.String(255), nullable=True),
            sa.Column('model_number', sa.String(100), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('icon', sa.String(100), nullable=True),
            sa.Column('default_polling_interval', sa.Integer(), default=60),
            sa.Column('is_active', sa.Integer(), default=1),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )

    if not table_exists('device_products'):
        op.create_table('device_products',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('model_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('sku', sa.String(100), nullable=True),
            sa.Column('firmware_version', sa.String(100), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['model_id'], ['device_models.id'], ondelete='CASCADE')
        )

    if not table_exists('devices'):
        op.create_table('devices',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('gateway_id', sa.Integer(), nullable=True),
            sa.Column('model_id', sa.Integer(), nullable=True),
            sa.Column('product_id', sa.Integer(), nullable=True),
            sa.Column('site_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('device_type', sa.String(50), nullable=False),
            sa.Column('edge_key', sa.String(100), nullable=True),
            sa.Column('serial_number', sa.String(100), nullable=True),
            sa.Column('firmware_version', sa.String(100), nullable=True),
            sa.Column('is_online', sa.Integer(), default=0),
            sa.Column('last_seen_at', sa.DateTime(), nullable=True),
            sa.Column('last_telemetry_at', sa.DateTime(), nullable=True),
            sa.Column('connection_type', sa.String(50), nullable=True),
            sa.Column('host', sa.String(255), nullable=True),
            sa.Column('port', sa.Integer(), nullable=True),
            sa.Column('slave_id', sa.Integer(), nullable=True),
            sa.Column('polling_interval_seconds', sa.Integer(), default=60),
            sa.Column('is_active', sa.Integer(), default=1),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['gateway_id'], ['gateways.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['model_id'], ['device_models.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['product_id'], ['device_products.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='SET NULL')
        )
        op.create_index('ix_devices_gateway', 'devices', ['gateway_id'])
        op.create_index('ix_devices_edge_key', 'devices', ['edge_key'])
        op.create_index('ix_devices_site', 'devices', ['site_id'])

    if not table_exists('datapoints'):
        op.create_table('datapoints',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('model_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('display_name', sa.String(255), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('data_type', sa.String(50), nullable=False),
            sa.Column('unit', sa.String(50), nullable=True),
            sa.Column('aggregation', sa.String(20), nullable=True),
            sa.Column('min_value', sa.Float(), nullable=True),
            sa.Column('max_value', sa.Float(), nullable=True),
            sa.Column('is_writable', sa.Integer(), default=0),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['model_id'], ['device_models.id'], ondelete='CASCADE')
        )
        op.create_index('ix_datapoints_model', 'datapoints', ['model_id'])

    if not table_exists('device_telemetry'):
        op.create_table('device_telemetry',
            sa.Column('id', sa.BigInteger(), nullable=False),
            sa.Column('device_id', sa.Integer(), nullable=False),
            sa.Column('datapoint_id', sa.Integer(), nullable=True),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('value', sa.Float(), nullable=True),
            sa.Column('string_value', sa.String(500), nullable=True),
            sa.Column('raw_value', sa.Float(), nullable=True),
            sa.Column('quality', sa.String(20), default='good'),
            sa.Column('edge_key', sa.String(100), nullable=True),
            sa.Column('source', sa.String(50), default='api'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['datapoint_id'], ['datapoints.id'], ondelete='SET NULL')
        )
        op.create_index('ix_telemetry_device_time', 'device_telemetry', ['device_id', 'timestamp'])
        op.create_index('ix_telemetry_datapoint_time', 'device_telemetry', ['datapoint_id', 'timestamp'])

    # =========================================================================
    # ALARM TABLES
    # =========================================================================

    if not table_exists('alarm_rules'):
        op.create_table('alarm_rules',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('model_id', sa.Integer(), nullable=True),
            sa.Column('device_id', sa.Integer(), nullable=True),
            sa.Column('datapoint_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('severity', sa.String(20), nullable=False),
            sa.Column('condition', sa.String(20), nullable=False),
            sa.Column('threshold', sa.Float(), nullable=True),
            sa.Column('threshold_max', sa.Float(), nullable=True),
            sa.Column('duration_seconds', sa.Integer(), default=0),
            sa.Column('auto_clear', sa.Integer(), default=1),
            sa.Column('notification_enabled', sa.Integer(), default=1),
            sa.Column('is_active', sa.Integer(), default=1),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['model_id'], ['device_models.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['datapoint_id'], ['datapoints.id'], ondelete='CASCADE')
        )

    if not table_exists('device_alarms'):
        op.create_table('device_alarms',
            sa.Column('id', sa.BigInteger(), nullable=False),
            sa.Column('device_id', sa.Integer(), nullable=False),
            sa.Column('alarm_rule_id', sa.Integer(), nullable=False),
            sa.Column('datapoint_id', sa.Integer(), nullable=True),
            sa.Column('status', sa.String(20), default='triggered'),
            sa.Column('severity', sa.String(20), nullable=False),
            sa.Column('title', sa.String(255), nullable=False),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('trigger_value', sa.Float(), nullable=True),
            sa.Column('threshold_value', sa.Float(), nullable=True),
            sa.Column('condition', sa.String(20), nullable=True),
            sa.Column('triggered_at', sa.DateTime(), nullable=False),
            sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
            sa.Column('cleared_at', sa.DateTime(), nullable=True),
            sa.Column('duration_start_at', sa.DateTime(), nullable=True),
            sa.Column('duration_seconds', sa.Integer(), default=0),
            sa.Column('acknowledged_by', sa.Integer(), nullable=True),
            sa.Column('cleared_by', sa.Integer(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('notification_sent', sa.Integer(), default=0),
            sa.Column('notification_sent_at', sa.DateTime(), nullable=True),
            sa.Column('data_json', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['alarm_rule_id'], ['alarm_rules.id']),
            sa.ForeignKeyConstraint(['datapoint_id'], ['datapoints.id'], ondelete='SET NULL')
        )
        op.create_index('ix_device_alarm_device_status', 'device_alarms', ['device_id', 'status'])
        op.create_index('ix_device_alarm_triggered', 'device_alarms', ['triggered_at'])
        op.create_index('ix_device_alarm_severity_status', 'device_alarms', ['severity', 'status'])

    # =========================================================================
    # AGGREGATION & KPI TABLES
    # =========================================================================

    if not table_exists('telemetry_aggregations'):
        op.create_table('telemetry_aggregations',
            sa.Column('id', sa.BigInteger(), nullable=False),
            sa.Column('device_id', sa.Integer(), nullable=False),
            sa.Column('datapoint_id', sa.Integer(), nullable=False),
            sa.Column('period', sa.String(20), nullable=False),
            sa.Column('period_start', sa.DateTime(), nullable=False),
            sa.Column('period_end', sa.DateTime(), nullable=False),
            sa.Column('value_min', sa.Float(), nullable=True),
            sa.Column('value_max', sa.Float(), nullable=True),
            sa.Column('value_avg', sa.Float(), nullable=True),
            sa.Column('value_sum', sa.Float(), nullable=True),
            sa.Column('value_count', sa.Integer(), default=0),
            sa.Column('value_first', sa.Float(), nullable=True),
            sa.Column('value_last', sa.Float(), nullable=True),
            sa.Column('quality_good_count', sa.Integer(), default=0),
            sa.Column('quality_bad_count', sa.Integer(), default=0),
            sa.Column('gap_count', sa.Integer(), default=0),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['datapoint_id'], ['datapoints.id'], ondelete='CASCADE')
        )
        op.create_index('ix_agg_device_datapoint_period', 'telemetry_aggregations',
                       ['device_id', 'datapoint_id', 'period', 'period_start'])
        op.create_index('ix_agg_period_start', 'telemetry_aggregations', ['period', 'period_start'])

    if not table_exists('kpi_definitions'):
        op.create_table('kpi_definitions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=True),
            sa.Column('site_id', sa.Integer(), nullable=True),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('display_name', sa.String(255), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('kpi_type', sa.String(20), nullable=False),
            sa.Column('source_device_id', sa.Integer(), nullable=True),
            sa.Column('source_datapoint_id', sa.Integer(), nullable=True),
            sa.Column('formula', sa.Text(), nullable=True),
            sa.Column('formula_variables', sa.Text(), nullable=True),
            sa.Column('unit', sa.String(50), nullable=True),
            sa.Column('precision', sa.Integer(), default=2),
            sa.Column('icon', sa.String(100), nullable=True),
            sa.Column('color', sa.String(7), nullable=True),
            sa.Column('warning_min', sa.Float(), nullable=True),
            sa.Column('warning_max', sa.Float(), nullable=True),
            sa.Column('critical_min', sa.Float(), nullable=True),
            sa.Column('critical_max', sa.Float(), nullable=True),
            sa.Column('calculation_interval', sa.String(20), default='hourly'),
            sa.Column('last_calculated_at', sa.DateTime(), nullable=True),
            sa.Column('is_active', sa.Integer(), default=1),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )

    if not table_exists('kpi_values'):
        op.create_table('kpi_values',
            sa.Column('id', sa.BigInteger(), nullable=False),
            sa.Column('kpi_id', sa.Integer(), nullable=False),
            sa.Column('period_start', sa.DateTime(), nullable=False),
            sa.Column('period_end', sa.DateTime(), nullable=False),
            sa.Column('value', sa.Float(), nullable=True),
            sa.Column('status', sa.String(20), default='normal'),
            sa.Column('data_points_used', sa.Integer(), default=0),
            sa.Column('calculation_time_ms', sa.Integer(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['kpi_id'], ['kpi_definitions.id'], ondelete='CASCADE')
        )
        op.create_index('ix_kpi_value_kpi_period', 'kpi_values', ['kpi_id', 'period_start'])

    if not table_exists('no_data_trackers'):
        op.create_table('no_data_trackers',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('device_id', sa.Integer(), nullable=False),
            sa.Column('datapoint_id', sa.Integer(), nullable=True),
            sa.Column('last_data_at', sa.DateTime(), nullable=False),
            sa.Column('expected_interval_seconds', sa.Integer(), default=300),
            sa.Column('alarm_rule_id', sa.Integer(), nullable=True),
            sa.Column('alarm_triggered', sa.Integer(), default=0),
            sa.Column('alarm_triggered_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['datapoint_id'], ['datapoints.id'], ondelete='CASCADE')
        )
        op.create_index('ix_no_data_device_datapoint', 'no_data_trackers', ['device_id', 'datapoint_id'])

    # =========================================================================
    # DEVICE EVENTS & COMMANDS
    # =========================================================================

    if not table_exists('device_events'):
        op.create_table('device_events',
            sa.Column('id', sa.BigInteger(), nullable=False),
            sa.Column('device_id', sa.Integer(), nullable=False),
            sa.Column('event_type', sa.String(50), nullable=False),
            sa.Column('severity', sa.String(20), default='info'),
            sa.Column('title', sa.String(255), nullable=False),
            sa.Column('message', sa.Text(), nullable=True),
            sa.Column('data_json', sa.Text(), nullable=True),
            sa.Column('correlation_id', sa.String(100), nullable=True),
            sa.Column('source', sa.String(50), default='device'),
            sa.Column('timestamp', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE')
        )
        op.create_index('ix_events_device', 'device_events', ['device_id'])
        op.create_index('ix_events_type', 'device_events', ['event_type'])
        op.create_index('ix_events_timestamp', 'device_events', ['timestamp'])

    if not table_exists('commands'):
        op.create_table('commands',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('model_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(100), nullable=False),
            sa.Column('display_name', sa.String(255), nullable=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('input_type', sa.String(50), nullable=False),
            sa.Column('input_config', sa.Text(), nullable=True),
            sa.Column('requires_confirmation', sa.Integer(), default=0),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['model_id'], ['device_models.id'], ondelete='CASCADE')
        )

    if not table_exists('command_executions'):
        op.create_table('command_executions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('device_id', sa.Integer(), nullable=False),
            sa.Column('command_id', sa.Integer(), nullable=False),
            sa.Column('correlation_id', sa.String(100), nullable=False),
            sa.Column('status', sa.String(20), default='pending'),
            sa.Column('input_value', sa.Text(), nullable=True),
            sa.Column('result', sa.Text(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('sent_at', sa.DateTime(), nullable=True),
            sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.ForeignKeyConstraint(['device_id'], ['devices.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['command_id'], ['commands.id'])
        )
        op.create_index('ix_cmd_exec_device', 'command_executions', ['device_id'])
        op.create_index('ix_cmd_exec_correlation', 'command_executions', ['correlation_id'])

    print("Migration 004: All tables verified/created successfully")


def downgrade() -> None:
    """Drop tables in reverse order (respecting foreign keys)."""
    tables_to_drop = [
        'command_executions',
        'commands',
        'device_events',
        'no_data_trackers',
        'kpi_values',
        'kpi_definitions',
        'telemetry_aggregations',
        'device_alarms',
        'alarm_rules',
        'device_telemetry',
        'datapoints',
        'devices',
        'device_products',
        'device_models',
        'gateways',
    ]

    for table in tables_to_drop:
        if table_exists(table):
            op.drop_table(table)
