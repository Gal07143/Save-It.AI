"""Public API endpoints - no authentication required."""
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from backend.app.core.database import get_db
from backend.app.models import DataSource, Site, CommunicationLog


router = APIRouter(prefix="/api/v1/public", tags=["public"])


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
    """Get public status page by share token.
    
    Token format: org_{org_id} (simplified for MVP)
    In production, use cryptographically secure tokens stored in database.
    """
    if not token.startswith("org_"):
        raise HTTPException(status_code=404, detail="Invalid status page token")
    
    try:
        org_id = int(token.replace("org_", ""))
    except ValueError:
        raise HTTPException(status_code=404, detail="Invalid status page token")
    
    sites = db.query(Site).filter(Site.organization_id == org_id).all()
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
        organization_name="SAVE-IT.AI Customer",
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
