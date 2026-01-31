"""
Notification Channels API Router for SAVE-IT.AI
Endpoints for multi-channel notification management and delivery.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.notification_service import (
    NotificationService,
    NotificationChannel,
    NotificationPriority,
    get_notification_service,
)

router = APIRouter(prefix="/notification-channels", tags=["notification-channels"])


class NotificationCreate(BaseModel):
    """Create notification request."""
    user_id: Optional[int] = None
    title: str
    message: str
    priority: str = "normal"
    channels: List[str] = ["in_app"]
    data: Optional[dict] = None
    action_url: Optional[str] = None
    expires_at: Optional[datetime] = None


class NotificationResponse(BaseModel):
    """Notification response."""
    id: int
    user_id: Optional[int]
    title: str
    message: str
    priority: str
    channels: List[str]
    is_read: bool
    read_at: Optional[datetime]
    action_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationPreferenceUpdate(BaseModel):
    """Update notification preferences."""
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    slack_enabled: Optional[bool] = None
    teams_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    min_priority_email: Optional[str] = None
    min_priority_sms: Optional[str] = None


class NotificationPreferenceResponse(BaseModel):
    """Notification preferences response."""
    user_id: int
    email_enabled: bool
    sms_enabled: bool
    push_enabled: bool
    in_app_enabled: bool
    slack_enabled: bool
    teams_enabled: bool
    quiet_hours_start: Optional[str]
    quiet_hours_end: Optional[str]
    min_priority_email: str
    min_priority_sms: str


class TemplateCreate(BaseModel):
    """Create notification template."""
    name: str
    channel: str
    subject_template: Optional[str] = None
    body_template: str
    variables: Optional[List[str]] = None


class TemplateResponse(BaseModel):
    """Notification template response."""
    id: int
    name: str
    channel: str
    subject_template: Optional[str]
    body_template: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryLogResponse(BaseModel):
    """Notification delivery log response."""
    id: int
    notification_id: int
    channel: str
    status: str
    recipient: str
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    error_message: Optional[str]
    retry_count: int

    class Config:
        from_attributes = True


@router.post("", response_model=NotificationResponse)
def send_notification(
    request: NotificationCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Send a multi-channel notification."""
    service = get_notification_service(db)

    try:
        priority = NotificationPriority(request.priority)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid priority: {request.priority}")

    channels = []
    for ch in request.channels:
        try:
            channels.append(NotificationChannel(ch))
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid channel: {ch}")

    notification = service.send_notification(
        organization_id=organization_id,
        user_id=request.user_id,
        title=request.title,
        message=request.message,
        priority=priority,
        channels=channels,
        data=request.data,
        action_url=request.action_url,
        expires_at=request.expires_at
    )

    db.commit()

    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        title=notification.title,
        message=notification.message,
        priority=notification.priority,
        channels=request.channels,
        is_read=notification.is_read == 1,
        read_at=notification.read_at,
        action_url=notification.action_url,
        created_at=notification.created_at
    )


@router.get("", response_model=List[NotificationResponse])
def list_channel_notifications(
    unread_only: bool = False,
    priority: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """List notifications for a user."""
    service = get_notification_service(db)

    priority_filter = None
    if priority:
        try:
            priority_filter = NotificationPriority(priority)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")

    notifications = service.get_notifications(user_id, unread_only, priority_filter, limit)

    return [
        NotificationResponse(
            id=n.id,
            user_id=n.user_id,
            title=n.title,
            message=n.message,
            priority=n.priority,
            channels=n.channels.split(",") if n.channels else ["in_app"],
            is_read=n.is_read == 1,
            read_at=n.read_at,
            action_url=n.action_url,
            created_at=n.created_at
        )
        for n in notifications
    ]


@router.get("/unread/count")
def get_unread_count(
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Get count of unread notifications."""
    service = get_notification_service(db)
    count = service.get_unread_count(user_id)

    return {"user_id": user_id, "unread_count": count}


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db)
):
    """Mark a notification as read."""
    service = get_notification_service(db)

    if not service.mark_as_read(notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")

    db.commit()

    return {"message": "Notification marked as read"}


@router.post("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Mark all notifications as read."""
    service = get_notification_service(db)
    count = service.mark_all_as_read(user_id)

    db.commit()

    return {"message": f"Marked {count} notifications as read", "count": count}


@router.delete("/{notification_id}")
def delete_channel_notification(
    notification_id: int,
    db: Session = Depends(get_db)
):
    """Delete a notification."""
    service = get_notification_service(db)

    if not service.delete_notification(notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")

    db.commit()

    return {"message": "Notification deleted"}


# Preferences endpoints
@router.get("/preferences", response_model=NotificationPreferenceResponse)
def get_notification_preferences(
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Get notification preferences."""
    service = get_notification_service(db)
    prefs = service.get_preferences(user_id)

    return NotificationPreferenceResponse(
        user_id=prefs.user_id,
        email_enabled=prefs.email_enabled == 1,
        sms_enabled=prefs.sms_enabled == 1,
        push_enabled=prefs.push_enabled == 1,
        in_app_enabled=prefs.in_app_enabled == 1,
        slack_enabled=prefs.slack_enabled == 1,
        teams_enabled=prefs.teams_enabled == 1,
        quiet_hours_start=prefs.quiet_hours_start,
        quiet_hours_end=prefs.quiet_hours_end,
        min_priority_email=prefs.min_priority_email or "normal",
        min_priority_sms=prefs.min_priority_sms or "high"
    )


@router.patch("/preferences", response_model=NotificationPreferenceResponse)
def update_notification_preferences(
    request: NotificationPreferenceUpdate,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Update notification preferences."""
    service = get_notification_service(db)

    updates = request.model_dump(exclude_unset=True)
    prefs = service.update_preferences(user_id, **updates)

    db.commit()

    return NotificationPreferenceResponse(
        user_id=prefs.user_id,
        email_enabled=prefs.email_enabled == 1,
        sms_enabled=prefs.sms_enabled == 1,
        push_enabled=prefs.push_enabled == 1,
        in_app_enabled=prefs.in_app_enabled == 1,
        slack_enabled=prefs.slack_enabled == 1,
        teams_enabled=prefs.teams_enabled == 1,
        quiet_hours_start=prefs.quiet_hours_start,
        quiet_hours_end=prefs.quiet_hours_end,
        min_priority_email=prefs.min_priority_email or "normal",
        min_priority_sms=prefs.min_priority_sms or "high"
    )


# Template endpoints
@router.post("/templates", response_model=TemplateResponse)
def create_notification_template(
    request: TemplateCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Create a notification template."""
    service = get_notification_service(db)

    try:
        channel = NotificationChannel(request.channel)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid channel: {request.channel}")

    template = service.create_template(
        organization_id=organization_id,
        name=request.name,
        channel=channel,
        subject_template=request.subject_template,
        body_template=request.body_template,
        variables=request.variables
    )

    db.commit()

    return TemplateResponse(
        id=template.id,
        name=template.name,
        channel=template.channel,
        subject_template=template.subject_template,
        body_template=template.body_template,
        is_active=template.is_active == 1,
        created_at=template.created_at
    )


@router.get("/templates", response_model=List[TemplateResponse])
def list_notification_templates(
    channel: Optional[str] = None,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List notification templates."""
    service = get_notification_service(db)

    channel_filter = None
    if channel:
        try:
            channel_filter = NotificationChannel(channel)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid channel: {channel}")

    templates = service.get_templates(organization_id, channel_filter)

    return [
        TemplateResponse(
            id=t.id,
            name=t.name,
            channel=t.channel,
            subject_template=t.subject_template,
            body_template=t.body_template,
            is_active=t.is_active == 1,
            created_at=t.created_at
        )
        for t in templates
    ]


@router.delete("/templates/{template_id}")
def delete_notification_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """Delete a notification template."""
    service = get_notification_service(db)

    if not service.delete_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")

    db.commit()

    return {"message": "Template deleted"}


# Delivery log endpoints
@router.get("/{notification_id}/delivery-logs", response_model=List[DeliveryLogResponse])
def get_notification_delivery_logs(
    notification_id: int,
    db: Session = Depends(get_db)
):
    """Get delivery logs for a notification."""
    service = get_notification_service(db)
    logs = service.get_delivery_logs(notification_id)

    return [
        DeliveryLogResponse(
            id=log.id,
            notification_id=log.notification_id,
            channel=log.channel,
            status=log.status,
            recipient=log.recipient,
            sent_at=log.sent_at,
            delivered_at=log.delivered_at,
            error_message=log.error_message,
            retry_count=log.retry_count
        )
        for log in logs
    ]


@router.post("/{notification_id}/retry")
def retry_notification_delivery(
    notification_id: int,
    db: Session = Depends(get_db)
):
    """Retry failed notification delivery."""
    service = get_notification_service(db)

    result = service.retry_failed(notification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found or no failed deliveries")

    db.commit()

    return {"message": "Retry initiated", "channels_retried": result}


# Webhook configuration endpoints
@router.post("/webhooks")
def create_webhook_config(
    url: str,
    events: List[str],
    secret: Optional[str] = None,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Create a webhook configuration for notifications."""
    service = get_notification_service(db)

    config = service.create_webhook_config(
        organization_id=organization_id,
        url=url,
        events=events,
        secret=secret
    )

    db.commit()

    return {
        "id": config.id,
        "url": config.url,
        "events": events,
        "is_active": config.is_active == 1
    }


@router.get("/webhooks")
def list_webhook_configs(
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List webhook configurations."""
    service = get_notification_service(db)
    configs = service.get_webhook_configs(organization_id)

    return [
        {
            "id": c.id,
            "url": c.url,
            "events": c.events.split(",") if c.events else [],
            "is_active": c.is_active == 1,
            "last_triggered_at": c.last_triggered_at
        }
        for c in configs
    ]


@router.delete("/webhooks/{webhook_id}")
def delete_webhook_config(
    webhook_id: int,
    db: Session = Depends(get_db)
):
    """Delete a webhook configuration."""
    service = get_notification_service(db)

    if not service.delete_webhook_config(webhook_id):
        raise HTTPException(status_code=404, detail="Webhook not found")

    db.commit()

    return {"message": "Webhook deleted"}
