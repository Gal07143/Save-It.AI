"""Pydantic schemas for Notification model."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.models.notification import NotificationType


class NotificationBase(BaseModel):
    """Base schema for Notification."""
    notification_type: NotificationType
    severity: str = "info"
    title: str = Field(..., min_length=1, max_length=255)
    message: str
    agent_name: Optional[str] = None
    metadata: Optional[str] = None


class NotificationCreate(NotificationBase):
    """Schema for creating a new Notification."""
    site_id: int
    asset_id: Optional[int] = None


class NotificationResponse(NotificationBase):
    """Schema for Notification response."""
    id: int
    site_id: int
    asset_id: Optional[int] = None
    is_read: bool
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True
