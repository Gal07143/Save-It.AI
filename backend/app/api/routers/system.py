"""System administration router for API keys, GDPR, and backups."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.platform import APIKey, Organization, User, AuditLog, UserRole
from backend.app.middleware.api_key_auth import generate_api_key, hash_api_key
from backend.app.api.routers.auth import get_current_user

router = APIRouter(prefix="/api/v1/system", tags=["System"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for endpoint access."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.get("/api-keys")
def list_api_keys(
    organization_id: int = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all API keys for an organization (without revealing key values)."""
    keys = db.query(APIKey).filter(APIKey.organization_id == organization_id).all()
    return [{
        "id": k.id,
        "name": k.name,
        "key_prefix": k.key_prefix,
        "permissions": k.permissions.split(",") if k.permissions else [],
        "rate_limit": k.rate_limit,
        "is_active": k.is_active,
        "expires_at": k.expires_at.isoformat() if k.expires_at else None,
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        "created_at": k.created_at.isoformat() if k.created_at else None,
    } for k in keys]


@router.post("/api-keys")
def create_api_key(
    organization_id: int = Query(...),
    name: str = Query(...),
    permissions: Optional[str] = Query(None),
    rate_limit: int = Query(1000),
    expires_in_days: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Create a new API key for an organization.
    
    Returns the plain key ONCE - it cannot be retrieved again.
    """
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    plain_key, hashed_key = generate_api_key()
    
    expires_at = None
    if expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
    
    api_key = APIKey(
        organization_id=organization_id,
        name=name,
        key_hash=hashed_key,
        key_prefix=plain_key[:12],
        permissions=permissions,
        rate_limit=rate_limit,
        expires_at=expires_at,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    return {
        "id": api_key.id,
        "name": api_key.name,
        "key": plain_key,
        "key_prefix": api_key.key_prefix,
        "message": "Store this key securely - it will not be shown again",
    }


@router.put("/api-keys/{key_id}")
def update_api_key(
    key_id: int,
    name: Optional[str] = Query(None),
    permissions: Optional[str] = Query(None),
    rate_limit: Optional[int] = Query(None),
    is_active: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Update an API key's settings."""
    key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    if name is not None:
        key.name = name
    if permissions is not None:
        key.permissions = permissions
    if rate_limit is not None:
        key.rate_limit = rate_limit
    if is_active is not None:
        key.is_active = is_active
    
    db.commit()
    return {"success": True}


@router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Revoke and delete an API key."""
    key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    db.delete(key)
    db.commit()
    return {"success": True}


@router.post("/api-keys/{key_id}/rotate")
def rotate_api_key(key_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Rotate an API key - generates new key while preserving settings."""
    old_key = db.query(APIKey).filter(APIKey.id == key_id).first()
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    plain_key, hashed_key = generate_api_key()
    
    old_key.key_hash = hashed_key
    old_key.key_prefix = plain_key[:12]
    old_key.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "id": old_key.id,
        "name": old_key.name,
        "key": plain_key,
        "key_prefix": old_key.key_prefix,
        "message": "Key rotated successfully - store this new key securely",
    }


@router.get("/gdpr/export")
def export_user_data(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export all data associated with a user for GDPR compliance.

    Users can export their own data, or admins can export data for users
    in their organization. Super admins can export any user's data.
    """
    # Authorization check: user must be the subject or an admin
    if current_user.id != user_id:
        if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
            raise HTTPException(status_code=403, detail="Can only export your own data")

        # Org admins can only export data for users in their organization
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

        if current_user.role == UserRole.ORG_ADMIN and target_user.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Cannot export data for users outside your organization")
    else:
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

    audit_logs = db.query(AuditLog).filter(AuditLog.user_id == user_id).all()

    export_data = {
        "export_date": datetime.utcnow().isoformat(),
        "user": {
            "id": target_user.id,
            "email": target_user.email,
            "name": target_user.name,
            "role": target_user.role.value if hasattr(target_user.role, 'value') else str(target_user.role),
            "created_at": target_user.created_at.isoformat() if target_user.created_at else None,
            "last_login_at": target_user.last_login_at.isoformat() if hasattr(target_user, 'last_login_at') and target_user.last_login_at else None,
        },
        "audit_logs": [{
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        } for log in audit_logs],
        "data_categories": [
            "profile_information",
            "activity_logs",
            "preferences",
        ],
    }

    return export_data


@router.delete("/gdpr/delete")
def delete_user_data(
    user_id: int = Query(...),
    confirmation: str = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Delete all data associated with a user for GDPR right to be forgotten.
    
    Requires confirmation="DELETE_ALL_DATA" to proceed.
    """
    if confirmation != "DELETE_ALL_DATA":
        raise HTTPException(
            status_code=400,
            detail="Must provide confirmation='DELETE_ALL_DATA' to proceed"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.query(AuditLog).filter(AuditLog.user_id == user_id).update(
        {"user_id": None, "changes": None},
        synchronize_session=False
    )
    
    user.email = f"deleted_{user.id}@deleted.local"
    user.name = "Deleted User"
    user.password_hash = ""
    user.is_active = 0
    
    db.commit()
    
    return {
        "success": True,
        "message": "User data anonymized and deleted",
        "deletion_date": datetime.utcnow().isoformat(),
    }


@router.get("/gdpr/consent")
def get_consent_status(
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get user's data processing consent status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user.id,
        "consents": {
            "essential_processing": True,
            "analytics": True,
            "marketing": False,
        },
        "last_updated": datetime.utcnow().isoformat(),
    }


@router.get("/backups")
def list_backups():
    """List available database backups (placeholder for production implementation)."""
    return {
        "backups": [],
        "message": "Backup management handled by Replit infrastructure",
        "next_scheduled": None,
    }


@router.post("/backups/trigger")
def trigger_backup(admin: User = Depends(require_admin)):
    """Trigger a database backup (placeholder for production implementation)."""
    return {
        "success": True,
        "message": "Backup triggered - managed by Replit infrastructure",
        "backup_id": None,
    }


@router.get("/jobs")
def list_jobs(status: Optional[str] = Query(None)):
    """List background jobs and their status."""
    from backend.app.services.job_queue import job_queue
    
    jobs = []
    for job_id, job in job_queue._jobs.items():
        if status and job.status.value != status:
            continue
        jobs.append(job_queue.get_status(job_id))
    
    return {
        "jobs": jobs,
        "stats": job_queue.stats(),
    }


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    """Get status of a specific background job."""
    from backend.app.services.job_queue import job_queue
    
    status = job_queue.get_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return status


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    """Cancel a pending background job."""
    from backend.app.services.job_queue import job_queue
    
    if job_queue.cancel(job_id):
        return {"success": True, "message": "Job cancelled"}
    
    raise HTTPException(status_code=400, detail="Job cannot be cancelled (not pending or not found)")


@router.get("/cache/stats")
def get_cache_stats():
    """Get cache statistics."""
    from backend.app.middleware.cache import cache
    
    return cache.stats()


@router.post("/cache/clear")
def clear_cache(pattern: Optional[str] = Query(None), admin: User = Depends(require_admin)):
    """Clear cache entries, optionally filtered by pattern."""
    from backend.app.middleware.cache import cache
    
    if pattern:
        count = cache.clear_pattern(pattern)
        return {"success": True, "cleared_count": count}
    else:
        cache.clear()
        return {"success": True, "message": "Cache cleared"}


@router.get("/timescale/status")
def get_timescale_status(db: Session = Depends(get_db)):
    """Check TimescaleDB status and hypertable information."""
    from backend.app.services.timescale import check_timescaledb_available, HYPERTABLE_CONFIGS, get_hypertable_stats
    
    available = check_timescaledb_available(db)
    
    hypertables = []
    if available:
        for config in HYPERTABLE_CONFIGS:
            stats = get_hypertable_stats(db, config["table"])
            hypertables.append(stats)
    
    return {
        "timescaledb_available": available,
        "hypertables": hypertables,
    }


@router.post("/timescale/initialize")
def initialize_timescale(db: Session = Depends(get_db)):
    """Initialize TimescaleDB hypertables for time-series data."""
    from backend.app.services.timescale import initialize_timescaledb
    
    result = initialize_timescaledb(db)
    return result


@router.get("/version")
def get_api_version():
    """Get API version information."""
    from backend.app.core.versioning import version_info
    return version_info()


@router.get("/database/pool")
def get_database_pool_status():
    """Get database connection pool status."""
    from backend.app.core.database import get_pool_status
    return get_pool_status()


@router.post("/views/refresh")
def refresh_materialized_views(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Refresh all materialized views for reporting."""
    refreshed = []
    
    views = [
        "mv_daily_energy_consumption",
        "mv_monthly_billing_summary",
    ]
    
    for view in views:
        try:
            db.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
            refreshed.append({"view": view, "status": "refreshed"})
        except Exception as e:
            try:
                db.execute(f"REFRESH MATERIALIZED VIEW {view}")
                refreshed.append({"view": view, "status": "refreshed_non_concurrent"})
            except Exception as e2:
                refreshed.append({"view": view, "status": "error", "error": str(e2)})
    
    db.commit()
    
    return {"views": refreshed}
