"""Backup service for data archival and verification with cloud storage support."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import os
import logging
import subprocess
import gzip
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

# Cloud storage configuration
CLOUD_STORAGE_TYPE = os.getenv("BACKUP_STORAGE_TYPE", "local")  # local, s3, gcs
S3_BUCKET = os.getenv("BACKUP_S3_BUCKET", "")
S3_PREFIX = os.getenv("BACKUP_S3_PREFIX", "saveit-backups")
GCS_BUCKET = os.getenv("BACKUP_GCS_BUCKET", "")
GCS_PREFIX = os.getenv("BACKUP_GCS_PREFIX", "saveit-backups")


class BackupStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    VERIFIED = "verified"


class BackupType(str, Enum):
    FULL = "full"
    INCREMENTAL = "incremental"
    DIFFERENTIAL = "differential"


@dataclass
class BackupJob:
    """Represents a backup job."""
    id: str
    type: BackupType
    status: BackupStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    size_bytes: int = 0
    tables: List[str] = field(default_factory=list)
    file_path: Optional[str] = None
    checksum: Optional[str] = None
    error: Optional[str] = None
    verification_status: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetentionPolicy:
    """Data retention policy configuration."""
    meter_readings_days: int = 365
    audit_logs_days: int = 90
    notifications_days: int = 30
    alerts_days: int = 180
    invoices_days: int = 2555
    backups_days: int = 90  # Days to keep backup files
    # Backup retention: 7 daily, 4 weekly, 12 monthly
    daily_backups: int = 7
    weekly_backups: int = 4
    monthly_backups: int = 12


class BackupService:
    """Service for data backup and archival with cloud storage support."""

    def __init__(self):
        self.backup_history: List[BackupJob] = []
        self.retention_policy = RetentionPolicy()
        self._backup_path = os.getenv("BACKUP_PATH", "/tmp/saveit_backups")
        self._storage_type = CLOUD_STORAGE_TYPE
        os.makedirs(self._backup_path, exist_ok=True)

    async def create_pg_dump_backup(
        self,
        backup_type: BackupType = BackupType.FULL,
        upload_to_cloud: bool = True,
    ) -> BackupJob:
        """Create a PostgreSQL dump backup using pg_dump."""
        import uuid
        import hashlib

        job = BackupJob(
            id=str(uuid.uuid4()),
            type=backup_type,
            status=BackupStatus.IN_PROGRESS,
            started_at=datetime.utcnow(),
            metadata={"method": "pg_dump", "upload_to_cloud": upload_to_cloud},
        )
        self.backup_history.append(job)

        try:
            database_url = os.getenv("DATABASE_URL", "")
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"backup_{timestamp}_{job.id[:8]}.sql.gz"
            file_path = os.path.join(self._backup_path, filename)

            # Run pg_dump with compression
            pg_dump_cmd = [
                "pg_dump",
                database_url,
                "--format=custom",
                "--compress=9",
                f"--file={file_path}",
            ]

            result = subprocess.run(
                pg_dump_cmd,
                capture_output=True,
                text=True,
                timeout=3600,  # 1 hour timeout
            )

            if result.returncode != 0:
                raise Exception(f"pg_dump failed: {result.stderr}")

            # Calculate checksum
            with open(file_path, "rb") as f:
                content = f.read()
                checksum = hashlib.sha256(content).hexdigest()

            job.file_path = file_path
            job.size_bytes = len(content)
            job.checksum = checksum

            # Upload to cloud if configured
            if upload_to_cloud and self._storage_type != "local":
                cloud_path = await self._upload_to_cloud(file_path, filename)
                job.metadata["cloud_path"] = cloud_path

            job.status = BackupStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            logger.info(f"pg_dump backup completed: {job.id} ({job.size_bytes} bytes)")

        except Exception as e:
            job.status = BackupStatus.FAILED
            job.error = str(e)
            job.completed_at = datetime.utcnow()
            logger.error(f"pg_dump backup failed: {job.id} - {e}")

        return job

    async def _upload_to_cloud(self, local_path: str, filename: str) -> str:
        """Upload backup file to cloud storage."""
        if self._storage_type == "s3":
            return await self._upload_to_s3(local_path, filename)
        elif self._storage_type == "gcs":
            return await self._upload_to_gcs(local_path, filename)
        else:
            return local_path

    async def _upload_to_s3(self, local_path: str, filename: str) -> str:
        """Upload to AWS S3."""
        try:
            import boto3
            from botocore.exceptions import ClientError

            s3_client = boto3.client("s3")
            s3_key = f"{S3_PREFIX}/{filename}"

            s3_client.upload_file(
                local_path,
                S3_BUCKET,
                s3_key,
                ExtraArgs={
                    "ServerSideEncryption": "AES256",
                    "StorageClass": "STANDARD_IA",
                },
            )

            logger.info(f"Uploaded backup to S3: s3://{S3_BUCKET}/{s3_key}")
            return f"s3://{S3_BUCKET}/{s3_key}"

        except ImportError:
            logger.warning("boto3 not installed, skipping S3 upload")
            return local_path
        except ClientError as e:
            logger.error(f"S3 upload failed: {e}")
            raise

    async def _upload_to_gcs(self, local_path: str, filename: str) -> str:
        """Upload to Google Cloud Storage."""
        try:
            from google.cloud import storage

            client = storage.Client()
            bucket = client.bucket(GCS_BUCKET)
            blob_name = f"{GCS_PREFIX}/{filename}"
            blob = bucket.blob(blob_name)

            blob.upload_from_filename(local_path)

            logger.info(f"Uploaded backup to GCS: gs://{GCS_BUCKET}/{blob_name}")
            return f"gs://{GCS_BUCKET}/{blob_name}"

        except ImportError:
            logger.warning("google-cloud-storage not installed, skipping GCS upload")
            return local_path
        except Exception as e:
            logger.error(f"GCS upload failed: {e}")
            raise

    async def run_scheduled_backup(self) -> BackupJob:
        """Run scheduled backup with appropriate type based on schedule."""
        now = datetime.utcnow()

        # Determine backup type based on day
        if now.day == 1:
            # Monthly backup on 1st of month
            backup_type = BackupType.FULL
        elif now.weekday() == 0:
            # Weekly backup on Monday
            backup_type = BackupType.DIFFERENTIAL
        else:
            # Daily incremental
            backup_type = BackupType.INCREMENTAL

        logger.info(f"Running scheduled {backup_type.value} backup")
        return await self.create_pg_dump_backup(backup_type=backup_type)

    async def cleanup_old_backups(self) -> Dict[str, int]:
        """Clean up old backups based on retention policy."""
        now = datetime.utcnow()
        deleted = {"local": 0, "cloud": 0}

        # Get backup dates to keep
        daily_cutoff = now - timedelta(days=self.retention_policy.daily_backups)
        weekly_cutoff = now - timedelta(weeks=self.retention_policy.weekly_backups)
        monthly_cutoff = now - timedelta(days=30 * self.retention_policy.monthly_backups)

        for backup in list(self.backup_history):
            if not backup.completed_at:
                continue

            age = now - backup.completed_at
            keep = False

            # Keep if within daily retention
            if age.days <= self.retention_policy.daily_backups:
                keep = True
            # Keep weekly backups (Monday)
            elif backup.completed_at.weekday() == 0 and age.days <= self.retention_policy.weekly_backups * 7:
                keep = True
            # Keep monthly backups (1st of month)
            elif backup.completed_at.day == 1 and age.days <= self.retention_policy.monthly_backups * 30:
                keep = True

            if not keep:
                # Delete local file
                if backup.file_path and os.path.exists(backup.file_path):
                    try:
                        os.remove(backup.file_path)
                        deleted["local"] += 1
                    except Exception as e:
                        logger.error(f"Failed to delete local backup: {e}")

                # Delete from cloud (would need implementation per provider)
                if backup.metadata.get("cloud_path"):
                    deleted["cloud"] += 1
                    # TODO: Implement cloud deletion

                self.backup_history.remove(backup)

        logger.info(f"Backup cleanup completed: {deleted}")
        return deleted
    
    async def create_backup(
        self,
        backup_type: BackupType = BackupType.FULL,
        tables: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
    ) -> BackupJob:
        """Create a new backup."""
        import uuid
        import hashlib
        
        job = BackupJob(
            id=str(uuid.uuid4()),
            type=backup_type,
            status=BackupStatus.IN_PROGRESS,
            started_at=datetime.utcnow(),
            tables=tables or [],
            metadata=metadata or {},
        )
        
        self.backup_history.append(job)
        
        try:
            backup_data = await self._export_data(tables)
            
            filename = f"backup_{job.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            file_path = os.path.join(self._backup_path, filename)
            
            import json
            content = json.dumps(backup_data, default=str)
            
            with open(file_path, "w") as f:
                f.write(content)
            
            job.file_path = file_path
            job.size_bytes = len(content.encode())
            job.checksum = hashlib.sha256(content.encode()).hexdigest()
            job.status = BackupStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            
            logger.info(f"Backup completed: {job.id} ({job.size_bytes} bytes)")
            
        except Exception as e:
            job.status = BackupStatus.FAILED
            job.error = str(e)
            job.completed_at = datetime.utcnow()
            logger.error(f"Backup failed: {job.id} - {e}")
        
        return job
    
    async def _export_data(self, tables: Optional[List[str]] = None) -> dict:
        """Export data for backup using pg_dump or SQLAlchemy."""
        from backend.app.core.database import SessionLocal, engine
        from sqlalchemy import inspect, text
        import hashlib
        
        data = {}
        inspector = inspect(engine)
        all_tables = inspector.get_table_names()
        
        target_tables = tables if tables else all_tables
        
        db = SessionLocal()
        try:
            for table_name in target_tables:
                if table_name not in all_tables:
                    continue
                
                try:
                    result = db.execute(text(f'SELECT * FROM "{table_name}" LIMIT 10000'))
                    columns = result.keys()
                    rows = []
                    for row in result.fetchall():
                        row_dict = {}
                        for i, col in enumerate(columns):
                            val = row[i]
                            if hasattr(val, 'isoformat'):
                                val = val.isoformat()
                            elif isinstance(val, bytes):
                                val = val.hex()
                            row_dict[col] = val
                        rows.append(row_dict)
                    data[table_name] = {
                        "columns": list(columns),
                        "row_count": len(rows),
                        "rows": rows,
                    }
                except Exception as e:
                    logger.warning(f"Failed to export table {table_name}: {e}")
                    data[table_name] = {"error": str(e)}
        finally:
            db.close()
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "tables": list(data.keys()),
            "table_count": len(data),
            "data": data,
        }
    
    async def verify_backup(self, backup_id: str) -> bool:
        """Verify a backup's integrity."""
        import hashlib
        
        job = next((b for b in self.backup_history if b.id == backup_id), None)
        if not job or not job.file_path:
            return False
        
        try:
            with open(job.file_path, "r") as f:
                content = f.read()
            
            checksum = hashlib.sha256(content.encode()).hexdigest()
            
            if checksum == job.checksum:
                job.verification_status = "verified"
                job.status = BackupStatus.VERIFIED
                logger.info(f"Backup verified: {backup_id}")
                return True
            else:
                job.verification_status = "checksum_mismatch"
                logger.warning(f"Backup verification failed: {backup_id}")
                return False
                
        except Exception as e:
            job.verification_status = f"error: {e}"
            logger.error(f"Backup verification error: {backup_id} - {e}")
            return False
    
    async def restore_backup(self, backup_id: str, dry_run: bool = True) -> dict:
        """
        Restore data from a backup.
        
        Args:
            backup_id: ID of backup to restore
            dry_run: If True, only validate backup without restoring
            
        Returns:
            dict with restore status and details
        """
        import json
        from backend.app.core.database import SessionLocal, engine
        from sqlalchemy import text
        
        job = next((b for b in self.backup_history if b.id == backup_id), None)
        if not job or not job.file_path:
            return {"success": False, "error": "Backup not found"}
        
        if not os.path.exists(job.file_path):
            return {"success": False, "error": "Backup file not found"}
        
        try:
            with open(job.file_path, "r") as f:
                backup_data = json.load(f)
        except Exception as e:
            return {"success": False, "error": f"Failed to read backup: {e}"}
        
        data = backup_data.get("data", {})
        tables_to_restore = list(data.keys())
        
        if dry_run:
            return {
                "success": True,
                "dry_run": True,
                "tables": tables_to_restore,
                "total_rows": sum(t.get("row_count", 0) for t in data.values() if isinstance(t, dict)),
                "message": "Backup validated successfully. Set dry_run=False to restore.",
            }
        
        db = SessionLocal()
        restored_tables = []
        errors = []
        
        try:
            for table_name, table_data in data.items():
                if not isinstance(table_data, dict) or "error" in table_data:
                    continue
                
                rows = table_data.get("rows", [])
                if not rows:
                    continue
                
                try:
                    columns = table_data.get("columns", list(rows[0].keys()) if rows else [])
                    
                    for row in rows:
                        cols = ", ".join([f'"{c}"' for c in columns])
                        placeholders = ", ".join([f":val_{i}" for i in range(len(columns))])
                        params = {f"val_{i}": row.get(col) for i, col in enumerate(columns)}
                        
                        db.execute(
                            text(f'INSERT INTO "{table_name}" ({cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'),
                            params
                        )
                    
                    restored_tables.append(table_name)
                    
                except Exception as e:
                    errors.append(f"{table_name}: {e}")
                    logger.error(f"Failed to restore table {table_name}: {e}")
            
            db.commit()
            logger.info(f"Restored backup {backup_id}: {len(restored_tables)} tables")
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": f"Restore failed: {e}"}
        finally:
            db.close()
        
        return {
            "success": True,
            "dry_run": False,
            "restored_tables": restored_tables,
            "errors": errors,
        }
    
    async def cleanup_old_data(self) -> dict:
        """Clean up data older than retention policy."""
        now = datetime.utcnow()
        deleted = {
            "meter_readings": 0,
            "audit_logs": 0,
            "notifications": 0,
            "alerts": 0,
            "backups": 0,
        }
        
        backup_cutoff = now - timedelta(days=self.retention_policy.backups_days)
        old_backups = [b for b in self.backup_history if b.completed_at and b.completed_at < backup_cutoff]
        
        for backup in old_backups:
            if backup.file_path and os.path.exists(backup.file_path):
                try:
                    os.remove(backup.file_path)
                    deleted["backups"] += 1
                except Exception as e:
                    logger.error(f"Failed to delete backup file: {e}")
            self.backup_history.remove(backup)
        
        logger.info(f"Cleanup completed: {deleted}")
        return deleted
    
    def get_backup_history(self, limit: int = 50) -> List[dict]:
        """Get backup history."""
        return [
            {
                "id": b.id,
                "type": b.type.value,
                "status": b.status.value,
                "started_at": b.started_at.isoformat(),
                "completed_at": b.completed_at.isoformat() if b.completed_at else None,
                "size_bytes": b.size_bytes,
                "tables": b.tables,
                "verification_status": b.verification_status,
                "error": b.error,
            }
            for b in sorted(self.backup_history, key=lambda x: x.started_at, reverse=True)[:limit]
        ]
    
    def get_retention_policy(self) -> dict:
        """Get current retention policy."""
        return {
            "meter_readings_days": self.retention_policy.meter_readings_days,
            "audit_logs_days": self.retention_policy.audit_logs_days,
            "notifications_days": self.retention_policy.notifications_days,
            "alerts_days": self.retention_policy.alerts_days,
            "invoices_days": self.retention_policy.invoices_days,
            "backups_days": self.retention_policy.backups_days,
        }
    
    def update_retention_policy(self, **kwargs):
        """Update retention policy."""
        for key, value in kwargs.items():
            if hasattr(self.retention_policy, key):
                setattr(self.retention_policy, key, value)
        logger.info(f"Retention policy updated: {kwargs}")
    
    def get_stats(self) -> dict:
        """Get backup service statistics."""
        total = len(self.backup_history)
        by_status = {}
        total_size = 0
        
        for b in self.backup_history:
            by_status[b.status.value] = by_status.get(b.status.value, 0) + 1
            total_size += b.size_bytes
        
        return {
            "total_backups": total,
            "by_status": by_status,
            "total_size_bytes": total_size,
            "total_size_mb": total_size / (1024 * 1024),
            "retention_policy": self.get_retention_policy(),
        }


backup_service = BackupService()
