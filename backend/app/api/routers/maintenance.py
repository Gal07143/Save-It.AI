"""Predictive Maintenance API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import MaintenanceAlert, AssetCondition, Asset
from app.schemas import MaintenanceAlertResponse, AssetConditionResponse

router = APIRouter(prefix="/api/v1/maintenance", tags=["maintenance"])


@router.get("/alerts", response_model=List[MaintenanceAlertResponse])
def list_maintenance_alerts(
    asset_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List predictive maintenance alerts."""
    query = db.query(MaintenanceAlert)
    if asset_id:
        query = query.filter(MaintenanceAlert.asset_id == asset_id)
    if status:
        query = query.filter(MaintenanceAlert.status == status)
    return query.order_by(MaintenanceAlert.created_at.desc()).all()


@router.get("/asset-conditions", response_model=List[AssetConditionResponse])
def list_asset_conditions(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List asset conditions for a site."""
    query = db.query(AssetCondition)
    if site_id:
        query = query.join(Asset).filter(Asset.site_id == site_id)
    return query.all()


@router.post("/alerts/{alert_id}/acknowledge", response_model=MaintenanceAlertResponse)
def acknowledge_maintenance_alert(alert_id: int, db: Session = Depends(get_db)):
    """Acknowledge a maintenance alert."""
    alert = db.query(MaintenanceAlert).filter(MaintenanceAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)
    return alert
