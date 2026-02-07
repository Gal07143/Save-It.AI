"""Add rich metadata fields to sites table

Revision ID: 005
Revises: 004
Create Date: 2026-02-07

Adds 12 nullable columns to sites for site type, grid info,
operating hours, utility details, and contact information.
All columns are nullable so existing rows are unaffected.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision: str = '005'
down_revision: Union[str, None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_COLUMNS = [
    ('site_type', sa.String(50)),
    ('industry', sa.String(100)),
    ('area_sqm', sa.Float),
    ('grid_capacity_kva', sa.Float),
    ('operating_hours', sa.String(20)),
    ('operating_hours_start', sa.String(5)),
    ('operating_hours_end', sa.String(5)),
    ('currency', sa.String(10)),
    ('electricity_rate', sa.Float),
    ('utility_provider', sa.String(255)),
    ('contact_name', sa.String(255)),
    ('contact_phone', sa.String(50)),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    if 'sites' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('sites')}

    for col_name, col_type in NEW_COLUMNS:
        if col_name not in existing_columns:
            op.add_column('sites', sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)

    if 'sites' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('sites')}

    for col_name, _ in reversed(NEW_COLUMNS):
        if col_name in existing_columns:
            op.drop_column('sites', col_name)
