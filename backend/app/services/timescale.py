"""TimescaleDB preparation for time-series meter data."""
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session


def check_timescaledb_available(db: Session) -> bool:
    """Check if TimescaleDB extension is available."""
    try:
        result = db.execute(text(
            "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')"
        ))
        return result.scalar() or False
    except Exception:
        return False


def enable_timescaledb(db: Session) -> bool:
    """Enable TimescaleDB extension if available."""
    try:
        db.execute(text("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE"))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Could not enable TimescaleDB: {e}")
        return False


def create_hypertable(
    db: Session,
    table_name: str,
    time_column: str = "timestamp",
    chunk_time_interval: str = "7 days",
    if_not_exists: bool = True,
) -> bool:
    """
    Convert a regular table to a TimescaleDB hypertable.
    
    Args:
        table_name: Name of the table to convert
        time_column: Column containing timestamps
        chunk_time_interval: Size of each chunk (e.g., '7 days', '1 month')
        if_not_exists: Skip if already a hypertable
    """
    try:
        result = db.execute(text(f"""
            SELECT EXISTS(
                SELECT 1 FROM timescaledb_information.hypertables 
                WHERE hypertable_name = :table_name
            )
        """), {"table_name": table_name})
        
        if result.scalar():
            if if_not_exists:
                return True
            return False
        
        db.execute(text(f"""
            SELECT create_hypertable(
                '{table_name}', 
                '{time_column}',
                chunk_time_interval => INTERVAL '{chunk_time_interval}',
                if_not_exists => TRUE
            )
        """))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Could not create hypertable: {e}")
        return False


def setup_retention_policy(
    db: Session,
    table_name: str,
    retention_period: str = "90 days",
) -> bool:
    """
    Set up automatic data retention policy for a hypertable.
    
    Args:
        table_name: Name of the hypertable
        retention_period: How long to keep data (e.g., '90 days', '1 year')
    """
    try:
        db.execute(text(f"""
            SELECT remove_retention_policy('{table_name}', if_exists => true)
        """))
        
        db.execute(text(f"""
            SELECT add_retention_policy(
                '{table_name}',
                INTERVAL '{retention_period}'
            )
        """))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Could not set retention policy: {e}")
        return False


def setup_compression_policy(
    db: Session,
    table_name: str,
    compress_after: str = "7 days",
    segment_by: Optional[str] = None,
    order_by: str = "timestamp",
) -> bool:
    """
    Set up automatic compression for a hypertable.
    
    Args:
        table_name: Name of the hypertable
        compress_after: Compress chunks older than this interval
        segment_by: Column to segment by (e.g., 'meter_id')
        order_by: Column to order by for compression
    """
    try:
        segment_clause = f", segmentby => '{segment_by}'" if segment_by else ""
        
        db.execute(text(f"""
            ALTER TABLE {table_name} SET (
                timescaledb.compress,
                timescaledb.compress_orderby = '{order_by}'
                {segment_clause}
            )
        """))
        
        db.execute(text(f"""
            SELECT add_compression_policy(
                '{table_name}',
                INTERVAL '{compress_after}'
            )
        """))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Could not set compression policy: {e}")
        return False


def get_hypertable_stats(db: Session, table_name: str) -> dict:
    """Get statistics for a hypertable."""
    try:
        size_result = db.execute(text(f"""
            SELECT 
                hypertable_size('{table_name}') as total_size,
                pg_size_pretty(hypertable_size('{table_name}')) as total_size_pretty
        """)).fetchone()
        
        chunk_result = db.execute(text(f"""
            SELECT COUNT(*) as chunk_count
            FROM timescaledb_information.chunks
            WHERE hypertable_name = :table_name
        """), {"table_name": table_name}).fetchone()
        
        return {
            "table_name": table_name,
            "total_size_bytes": size_result.total_size if size_result else 0,
            "total_size_pretty": size_result.total_size_pretty if size_result else "0 bytes",
            "chunk_count": chunk_result.chunk_count if chunk_result else 0,
        }
    except Exception as e:
        return {
            "table_name": table_name,
            "error": str(e),
        }


HYPERTABLE_CONFIGS = [
    {
        "table": "meter_readings",
        "time_column": "timestamp",
        "chunk_interval": "7 days",
        "retention": "365 days",
        "compress_after": "30 days",
        "segment_by": "meter_id",
    },
    {
        "table": "measurements",
        "time_column": "timestamp",
        "chunk_interval": "1 day",
        "retention": "90 days",
        "compress_after": "7 days",
        "segment_by": "data_source_id",
    },
    {
        "table": "communication_logs",
        "time_column": "created_at",
        "chunk_interval": "1 day",
        "retention": "30 days",
        "compress_after": "7 days",
        "segment_by": None,
    },
]


def initialize_timescaledb(db: Session) -> dict:
    """
    Initialize TimescaleDB for the application.
    
    Enables extension and creates hypertables for time-series data.
    """
    results = {
        "timescaledb_available": False,
        "hypertables_created": [],
        "errors": [],
    }
    
    if not check_timescaledb_available(db):
        if not enable_timescaledb(db):
            results["errors"].append("TimescaleDB extension not available")
            return results
    
    results["timescaledb_available"] = True
    
    for config in HYPERTABLE_CONFIGS:
        try:
            table_exists = db.execute(text(
                "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = :table)"
            ), {"table": config["table"]}).scalar()
            
            if not table_exists:
                continue
            
            if create_hypertable(
                db,
                config["table"],
                config["time_column"],
                config["chunk_interval"],
            ):
                results["hypertables_created"].append(config["table"])
                
                if config.get("retention"):
                    setup_retention_policy(db, config["table"], config["retention"])
                
                if config.get("compress_after"):
                    setup_compression_policy(
                        db,
                        config["table"],
                        config["compress_after"],
                        config.get("segment_by"),
                        config["time_column"],
                    )
        except Exception as e:
            results["errors"].append(f"{config['table']}: {str(e)}")
    
    return results
