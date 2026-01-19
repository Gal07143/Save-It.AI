"""Initial schema - existing tables

Revision ID: 001
Revises: 
Create Date: 2025-01-19

Note: This is a baseline migration representing the existing schema.
Tables are already created by SQLAlchemy's create_all().
This migration serves as documentation of the initial state.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
