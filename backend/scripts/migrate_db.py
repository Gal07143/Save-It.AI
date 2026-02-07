#!/usr/bin/env python3
"""
Database migration script for Raspberry Pi deployments.
Adds any missing columns to existing tables by comparing SQLAlchemy models
against the actual database schema. Safe to run multiple times.

Usage:
    cd ~/Save-It.AI/backend
    source venv/bin/activate
    python scripts/migrate_db.py
"""
import sys
import os

# Ensure the backend directory is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from app.core.database import engine, Base

# Import ALL models so they register with Base.metadata
from app.models import *
from app.models.integrations import *
from app.models.devices import *
from app.models.telemetry import *


def get_column_type_sql(col):
    """Convert SQLAlchemy column type to SQL type string."""
    try:
        return col.type.compile(engine.dialect)
    except Exception:
        type_name = type(col.type).__name__.upper()
        mapping = {
            'STRING': 'VARCHAR',
            'TEXT': 'TEXT',
            'INTEGER': 'INTEGER',
            'FLOAT': 'FLOAT',
            'BOOLEAN': 'BOOLEAN',
            'DATETIME': 'TIMESTAMP',
            'DATE': 'DATE',
            'JSON': 'TEXT',
            'BOOLEANINT': 'INTEGER',
        }
        return mapping.get(type_name, 'VARCHAR')


def migrate():
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    print("=" * 60)
    print("Save-It.AI Database Migration")
    print("=" * 60)

    # Step 1: Create any completely new tables
    print("\n[1/2] Creating new tables...")
    Base.metadata.create_all(bind=engine)
    new_tables = set(inspector.get_table_names()) - set(existing_tables)
    if new_tables:
        for t in sorted(new_tables):
            print(f"  + Created table: {t}")
    else:
        print("  No new tables needed.")

    # Step 2: Add missing columns to existing tables
    print("\n[2/2] Adding missing columns...")
    inspector = inspect(engine)  # Refresh
    columns_added = 0

    for table_name, table in Base.metadata.tables.items():
        if table_name not in inspector.get_table_names():
            continue

        existing_columns = {col['name'] for col in inspector.get_columns(table_name)}

        for column in table.columns:
            if column.name not in existing_columns:
                col_type = get_column_type_sql(column)
                nullable = "NULL" if column.nullable else "NOT NULL"

                # For NOT NULL columns, we need a default
                default = ""
                if not column.nullable:
                    if 'INT' in col_type.upper():
                        default = "DEFAULT 0"
                    elif 'FLOAT' in col_type.upper() or 'REAL' in col_type.upper():
                        default = "DEFAULT 0.0"
                    elif 'BOOL' in col_type.upper():
                        default = "DEFAULT 0"
                    else:
                        default = "DEFAULT ''"

                sql = f'ALTER TABLE {table_name} ADD COLUMN {column.name} {col_type} {nullable} {default}'

                try:
                    with engine.connect() as conn:
                        conn.execute(text(sql.strip()))
                        conn.commit()
                    print(f"  + {table_name}.{column.name} ({col_type})")
                    columns_added += 1
                except Exception as e:
                    err = str(e)
                    if 'already exists' in err.lower() or 'duplicate' in err.lower():
                        pass  # Column already exists
                    else:
                        print(f"  ! {table_name}.{column.name}: {err}")

    if columns_added == 0:
        print("  No missing columns found.")
    else:
        print(f"\n  Added {columns_added} columns total.")

    print("\n" + "=" * 60)
    print("Migration complete!")
    print("=" * 60)


if __name__ == "__main__":
    migrate()
