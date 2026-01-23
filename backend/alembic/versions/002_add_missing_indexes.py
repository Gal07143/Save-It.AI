"""Add missing indexes for performance

Revision ID: 002
Revises: 001
Create Date: 2025-01-21

This migration adds indexes to improve query performance for common operations:
- meter_readings: timestamp and meter_id for range queries
- bills: billing period start/end for date range queries
- assets: site_id and parent_id for hierarchy queries
- notifications: user_id and created_at for user notification queries
- audit_logs: created_at and user_id for audit log queries
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Meter readings indexes for time-series queries
    op.create_index(
        'ix_meter_readings_timestamp',
        'meter_readings',
        ['timestamp'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_meter_readings_meter_timestamp',
        'meter_readings',
        ['meter_id', 'timestamp'],
        unique=False,
        if_not_exists=True
    )

    # Bills indexes for billing period queries
    op.create_index(
        'ix_bills_billing_period_start',
        'bills',
        ['billing_period_start'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_bills_billing_period_end',
        'bills',
        ['billing_period_end'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_bills_site_period',
        'bills',
        ['site_id', 'billing_period_start', 'billing_period_end'],
        unique=False,
        if_not_exists=True
    )

    # Assets indexes for hierarchy queries
    op.create_index(
        'ix_assets_site_id',
        'assets',
        ['site_id'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_assets_parent_id',
        'assets',
        ['parent_id'],
        unique=False,
        if_not_exists=True
    )

    # Notifications indexes for user notification queries
    op.create_index(
        'ix_notifications_user_id',
        'notifications',
        ['user_id'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_notifications_created_at',
        'notifications',
        ['created_at'],
        unique=False,
        if_not_exists=True
    )
    op.create_index(
        'ix_notifications_user_created',
        'notifications',
        ['user_id', 'created_at'],
        unique=False,
        if_not_exists=True
    )

    # Audit logs indexes (some may already exist)
    op.create_index(
        'ix_audit_logs_user_created',
        'audit_logs',
        ['user_id', 'created_at'],
        unique=False,
        if_not_exists=True
    )

    # Organization status page token index (new field)
    op.create_index(
        'ix_organizations_status_page_token_hash',
        'organizations',
        ['status_page_token_hash'],
        unique=True,
        if_not_exists=True
    )


def downgrade() -> None:
    # Drop indexes in reverse order
    op.drop_index('ix_organizations_status_page_token_hash', table_name='organizations', if_exists=True)
    op.drop_index('ix_audit_logs_user_created', table_name='audit_logs', if_exists=True)
    op.drop_index('ix_notifications_user_created', table_name='notifications', if_exists=True)
    op.drop_index('ix_notifications_created_at', table_name='notifications', if_exists=True)
    op.drop_index('ix_notifications_user_id', table_name='notifications', if_exists=True)
    op.drop_index('ix_assets_parent_id', table_name='assets', if_exists=True)
    op.drop_index('ix_assets_site_id', table_name='assets', if_exists=True)
    op.drop_index('ix_bills_site_period', table_name='bills', if_exists=True)
    op.drop_index('ix_bills_billing_period_end', table_name='bills', if_exists=True)
    op.drop_index('ix_bills_billing_period_start', table_name='bills', if_exists=True)
    op.drop_index('ix_meter_readings_meter_timestamp', table_name='meter_readings', if_exists=True)
    op.drop_index('ix_meter_readings_timestamp', table_name='meter_readings', if_exists=True)
