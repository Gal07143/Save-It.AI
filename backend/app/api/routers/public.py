"""Public API endpoints - no authentication required."""
import secrets
import hashlib
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db
from app.models import DataSource, Site, Organization, User, UserRole
from app.api.routers.auth import get_current_user


router = APIRouter(prefix="/api/v1/public", tags=["public"])


def generate_status_page_token() -> tuple[str, str]:
    """Generate a cryptographically secure status page token.

    Returns:
        Tuple of (plain_token, token_hash)
    """
    plain_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(plain_token.encode()).hexdigest()
    return plain_token, token_hash


def hash_token(token: str) -> str:
    """Hash a token for comparison."""
    return hashlib.sha256(token.encode()).hexdigest()


class DeviceStatusPublic(BaseModel):
    name: str
    status: str
    device_type: Optional[str] = None
    last_seen: Optional[datetime] = None


class SiteStatusPublic(BaseModel):
    name: str
    location: Optional[str] = None
    total_devices: int
    online_devices: int
    offline_devices: int
    error_devices: int
    overall_status: str
    devices: List[DeviceStatusPublic]


class PublicStatusPage(BaseModel):
    organization_name: str
    generated_at: datetime
    sites: List[SiteStatusPublic]
    total_devices: int
    total_online: int
    total_offline: int
    overall_health_percent: float


@router.get("/status/{token}", response_model=PublicStatusPage)
def get_public_status(token: str, db: Session = Depends(get_db)):
    """Get public status page by cryptographically secure share token.

    The token must match a valid, enabled status page for an organization.
    """
    # Hash the provided token and look up the organization
    token_hash = hash_token(token)
    org = db.query(Organization).filter(
        Organization.status_page_token_hash == token_hash,
        Organization.status_page_enabled == 1,
        Organization.is_active == 1
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Status page not found")

    sites = db.query(Site).filter(Site.organization_id == org.id).all()
    if not sites:
        raise HTTPException(status_code=404, detail="Status page not found")

    site_statuses: List[SiteStatusPublic] = []
    total_devices = 0
    total_online = 0
    total_offline = 0

    cutoff = datetime.utcnow() - timedelta(minutes=15)

    for site in sites:
        devices = db.query(DataSource).filter(DataSource.site_id == site.id).all()

        online = 0
        offline = 0
        error = 0
        device_list: List[DeviceStatusPublic] = []

        for device in devices:
            status = device.connection_status or "unknown"
            if device.last_reading_at and device.last_reading_at > cutoff:
                if status not in ("error", "offline"):
                    status = "online"
                    online += 1
                elif status == "error":
                    error += 1
                else:
                    offline += 1
            else:
                if status == "online":
                    status = "offline"
                offline += 1

            device_list.append(DeviceStatusPublic(
                name=device.name,
                status=status,
                device_type=device.source_type,
                last_seen=device.last_reading_at
            ))

        site_status = "operational" if offline == 0 and error == 0 else "degraded" if online > 0 else "down"

        site_statuses.append(SiteStatusPublic(
            name=site.name,
            location=site.address,
            total_devices=len(devices),
            online_devices=online,
            offline_devices=offline,
            error_devices=error,
            overall_status=site_status,
            devices=device_list
        ))

        total_devices += len(devices)
        total_online += online
        total_offline += offline

    health_percent = (total_online / total_devices * 100) if total_devices > 0 else 100.0

    return PublicStatusPage(
        organization_name=org.name,
        generated_at=datetime.utcnow(),
        sites=site_statuses,
        total_devices=total_devices,
        total_online=total_online,
        total_offline=total_offline,
        overall_health_percent=round(health_percent, 1)
    )


@router.get("/status-check")
def status_check():
    """Simple health check endpoint."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# Status page management endpoints (require authentication)

def require_org_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require org admin or super admin role."""
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


class StatusPageTokenResponse(BaseModel):
    """Response containing a status page token."""
    token: str
    enabled: bool
    message: str


class StatusPageSettingsResponse(BaseModel):
    """Response containing status page settings."""
    enabled: bool
    has_token: bool


@router.post("/status-page/generate-token", response_model=StatusPageTokenResponse)
def generate_status_page_token_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Generate a new status page token for the user's organization.

    The token is only shown once - store it securely.
    """
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Generate new token
    plain_token, token_hash = generate_status_page_token()
    org.status_page_token_hash = token_hash
    org.status_page_enabled = 1
    db.commit()

    return StatusPageTokenResponse(
        token=plain_token,
        enabled=True,
        message="Token generated. Store it securely - it will not be shown again."
    )


@router.post("/status-page/rotate-token", response_model=StatusPageTokenResponse)
def rotate_status_page_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Rotate the status page token (invalidates the old one)."""
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not org.status_page_token_hash:
        raise HTTPException(status_code=400, detail="No existing token to rotate")

    # Generate new token
    plain_token, token_hash = generate_status_page_token()
    org.status_page_token_hash = token_hash
    db.commit()

    return StatusPageTokenResponse(
        token=plain_token,
        enabled=bool(org.status_page_enabled),
        message="Token rotated. Old token is now invalid. Store the new token securely."
    )


@router.put("/status-page/enable")
def enable_status_page(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Enable the public status page."""
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if not org.status_page_token_hash:
        raise HTTPException(
            status_code=400,
            detail="Generate a token first using /status-page/generate-token"
        )

    org.status_page_enabled = 1
    db.commit()

    return {"success": True, "message": "Status page enabled"}


@router.put("/status-page/disable")
def disable_status_page(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Disable the public status page (token remains valid for re-enabling)."""
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.status_page_enabled = 0
    db.commit()

    return {"success": True, "message": "Status page disabled"}


@router.get("/status-page/settings", response_model=StatusPageSettingsResponse)
def get_status_page_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin)
):
    """Get the current status page settings."""
    org = db.query(Organization).filter(
        Organization.id == current_user.organization_id
    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return StatusPageSettingsResponse(
        enabled=bool(org.status_page_enabled),
        has_token=bool(org.status_page_token_hash)
    )
