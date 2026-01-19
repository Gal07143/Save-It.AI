"""Backup service for data archival and verification."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import os
import logging

logger = logging.getLogger(__name__)


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
    backups_days: int = 30


class BackupService:
    """Service for data backup and archival."""
    
    def __init__(self):
        self.backup_history: List[BackupJob] = []
        self.retention_policy = RetentionPolicy()
        self._backup_path = os.getenv("BACKUP_PATH", "/tmp/saveit_backups")
        os.makedirs(self._backup_path, exist_ok=True)
    
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
            job.checksum = hashlib.md5(content.encode()).hexdigest()
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
        """Export data for backup (placeholder implementation)."""
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "tables": tables or ["all"],
            "data": {},
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
            
            checksum = hashlib.md5(content.encode()).hexdigest()
            
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
    
    async def restore_backup(self, backup_id: str) -> bool:
        """Restore data from a backup (placeholder)."""
        job = next((b for b in self.backup_history if b.id == backup_id), None)
        if not job or not job.file_path:
            return False
        
        logger.info(f"Restore from backup: {backup_id}")
        return True
    
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
