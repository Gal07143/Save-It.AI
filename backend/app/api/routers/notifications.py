"""Notification API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import Notification
from backend.app.schemas import NotificationResponse
from backend.app.services.optimization.notification_service import NotificationService

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


class ConnectionErrorRequest(BaseModel):
    site_id: int
    data_source_id: int
    data_source_name: str
    error_message: str
    consecutive_failures: int = 1


class ConnectionRestoredRequest(BaseModel):
    site_id: int
    data_source_id: int
    data_source_name: str
    downtime_minutes: int = 0


@router.get("", response_model=List[NotificationResponse])
def list_notifications(
    site_id: Optional[int] = None,
    unread_only: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Get all notifications, optionally filtered by site."""
    query = db.query(Notification)
    if site_id:
        query = query.filter(Notification.site_id == site_id)
    if unread_only:
        query = query.filter(Notification.is_read == 0)
    
    notifications = (
        query.order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return notifications


@router.get("/{notification_id}", response_model=NotificationResponse)
def get_notification(notification_id: int, db: Session = Depends(get_db)):
    """Get a specific notification by ID."""
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """Mark a notification as read."""
    service = NotificationService(db)
    notification = service.mark_as_read(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.post("/{notification_id}/resolve", response_model=NotificationResponse)
def mark_notification_resolved(notification_id: int, db: Session = Depends(get_db)):
    """Mark a notification as resolved."""
    service = NotificationService(db)
    notification = service.mark_as_resolved(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.post("/connection-error", response_model=NotificationResponse)
def create_connection_error_notification(
    request: ConnectionErrorRequest,
    db: Session = Depends(get_db)
):
    """Create a notification for a data source connection error."""
    service = NotificationService(db)
    notification = service.create_connection_error_alert(
        site_id=request.site_id,
        data_source_id=request.data_source_id,
        data_source_name=request.data_source_name,
        error_message=request.error_message,
        consecutive_failures=request.consecutive_failures
    )
    return notification


@router.post("/connection-restored", response_model=NotificationResponse)
def create_connection_restored_notification(
    request: ConnectionRestoredRequest,
    db: Session = Depends(get_db)
):
    """Create a notification when a data source connection is restored."""
    service = NotificationService(db)
    notification = service.create_connection_restored_alert(
        site_id=request.site_id,
        data_source_id=request.data_source_id,
        data_source_name=request.data_source_name,
        downtime_minutes=request.downtime_minutes
    )
    return notification
