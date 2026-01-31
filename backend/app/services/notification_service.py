"""
Notification Service for SAVE-IT.AI
Multi-channel notification delivery:
- Email notifications
- SMS notifications
- Push notifications
- In-app notifications
- Webhook callbacks
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

from backend.app.core.database import Base

logger = logging.getLogger(__name__)


class NotificationChannel(Enum):
    """Notification delivery channels."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"
    WEBHOOK = "webhook"
    SLACK = "slack"
    TEAMS = "teams"


class NotificationPriority(Enum):
    """Notification priority levels."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationStatus(Enum):
    """Notification delivery status."""
    PENDING = "pending"
    QUEUED = "queued"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class NotificationTemplate(Base):
    """Notification template definition."""
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    # Template content (supports variables like {{device_name}})
    subject_template = Column(String(500), nullable=True)
    body_template = Column(Text, nullable=False)
    html_template = Column(Text, nullable=True)

    # Supported channels
    channels = Column(Text, nullable=True)  # JSON array

    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    """Notification record."""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    template_id = Column(Integer, ForeignKey("notification_templates.id"), nullable=True)
    channel = Column(String(20), nullable=False, index=True)
    priority = Column(String(20), default="normal")

    # Content
    subject = Column(String(500), nullable=True)
    body = Column(Text, nullable=False)
    html_body = Column(Text, nullable=True)

    # Delivery details
    recipient = Column(String(500), nullable=False)  # Email, phone, user_id, webhook_url
    status = Column(String(20), default="pending", index=True)

    # Tracking
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Retry handling
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    next_retry_at = Column(DateTime, nullable=True)

    # Reference
    reference_type = Column(String(50), nullable=True)  # alarm, device, report
    reference_id = Column(Integer, nullable=True)

    metadata_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class NotificationPreference(Base):
    """User notification preferences."""
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Channel preferences
    email_enabled = Column(Integer, default=1)
    sms_enabled = Column(Integer, default=0)
    push_enabled = Column(Integer, default=1)
    in_app_enabled = Column(Integer, default=1)

    # Contact info
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    push_token = Column(Text, nullable=True)

    # Quiet hours
    quiet_hours_start = Column(String(5), nullable=True)  # HH:MM
    quiet_hours_end = Column(String(5), nullable=True)
    timezone = Column(String(50), default="UTC")

    # Category preferences
    category_preferences = Column(Text, nullable=True)  # JSON

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


@dataclass
class NotificationRequest:
    """Request to send a notification."""
    recipient: str
    channel: NotificationChannel
    body: str
    subject: Optional[str] = None
    html_body: Optional[str] = None
    priority: NotificationPriority = NotificationPriority.NORMAL
    template_id: Optional[int] = None
    template_vars: Optional[Dict[str, Any]] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class NotificationResult:
    """Result of notification send attempt."""
    notification_id: int
    status: NotificationStatus
    channel: NotificationChannel
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


class NotificationService:
    """
    Multi-channel notification service.
    Handles sending and tracking notifications across various channels.
    """

    def __init__(self, db: Session):
        self.db = db
        self._channel_handlers: Dict[NotificationChannel, callable] = {}

        # Register default handlers
        self._register_default_handlers()

    def _register_default_handlers(self):
        """Register default channel handlers."""
        self._channel_handlers[NotificationChannel.EMAIL] = self._send_email
        self._channel_handlers[NotificationChannel.SMS] = self._send_sms
        self._channel_handlers[NotificationChannel.PUSH] = self._send_push
        self._channel_handlers[NotificationChannel.IN_APP] = self._send_in_app
        self._channel_handlers[NotificationChannel.WEBHOOK] = self._send_webhook
        self._channel_handlers[NotificationChannel.SLACK] = self._send_slack
        self._channel_handlers[NotificationChannel.TEAMS] = self._send_teams

    def register_channel_handler(
        self,
        channel: NotificationChannel,
        handler: callable
    ):
        """Register a custom channel handler."""
        self._channel_handlers[channel] = handler

    def create_template(
        self,
        name: str,
        body_template: str,
        subject_template: Optional[str] = None,
        html_template: Optional[str] = None,
        channels: Optional[List[NotificationChannel]] = None,
        organization_id: Optional[int] = None
    ) -> NotificationTemplate:
        """Create a notification template."""
        template = NotificationTemplate(
            name=name,
            body_template=body_template,
            subject_template=subject_template,
            html_template=html_template,
            channels=json.dumps([c.value for c in channels]) if channels else None,
            organization_id=organization_id
        )

        self.db.add(template)
        self.db.flush()

        return template

    def send(
        self,
        request: NotificationRequest,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None
    ) -> NotificationResult:
        """
        Send a notification.

        Args:
            request: NotificationRequest with details
            user_id: User to notify (for tracking)
            organization_id: Organization context

        Returns:
            NotificationResult
        """
        # Apply template if specified
        body = request.body
        subject = request.subject
        html_body = request.html_body

        if request.template_id:
            template = self.db.query(NotificationTemplate).filter(
                NotificationTemplate.id == request.template_id
            ).first()

            if template:
                vars_dict = request.template_vars or {}
                body = self._render_template(template.body_template, vars_dict)
                if template.subject_template:
                    subject = self._render_template(template.subject_template, vars_dict)
                if template.html_template:
                    html_body = self._render_template(template.html_template, vars_dict)

        # Create notification record
        notification = Notification(
            organization_id=organization_id,
            user_id=user_id,
            template_id=request.template_id,
            channel=request.channel.value,
            priority=request.priority.value,
            subject=subject,
            body=body,
            html_body=html_body,
            recipient=request.recipient,
            status=NotificationStatus.PENDING.value,
            reference_type=request.reference_type,
            reference_id=request.reference_id,
            metadata_json=json.dumps(request.metadata) if request.metadata else None
        )

        self.db.add(notification)
        self.db.flush()

        # Send notification
        result = self._deliver(notification)

        return result

    def send_to_user(
        self,
        user_id: int,
        body: str,
        subject: Optional[str] = None,
        channels: Optional[List[NotificationChannel]] = None,
        priority: NotificationPriority = NotificationPriority.NORMAL,
        **kwargs
    ) -> List[NotificationResult]:
        """
        Send notification to user via their preferred channels.

        Args:
            user_id: User ID
            body: Notification body
            subject: Optional subject
            channels: Specific channels (or use preferences)
            priority: Priority level

        Returns:
            List of NotificationResults
        """
        # Get user preferences
        prefs = self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id
        ).first()

        results = []

        if not channels:
            # Use user preferences
            channels = []
            if prefs:
                if prefs.email_enabled and prefs.email:
                    channels.append((NotificationChannel.EMAIL, prefs.email))
                if prefs.sms_enabled and prefs.phone:
                    channels.append((NotificationChannel.SMS, prefs.phone))
                if prefs.push_enabled and prefs.push_token:
                    channels.append((NotificationChannel.PUSH, prefs.push_token))
                if prefs.in_app_enabled:
                    channels.append((NotificationChannel.IN_APP, str(user_id)))
            else:
                # Default to in-app
                channels.append((NotificationChannel.IN_APP, str(user_id)))
        else:
            # Use specified channels with preferences for recipient
            channel_recipients = []
            for channel in channels:
                if channel == NotificationChannel.EMAIL and prefs and prefs.email:
                    channel_recipients.append((channel, prefs.email))
                elif channel == NotificationChannel.SMS and prefs and prefs.phone:
                    channel_recipients.append((channel, prefs.phone))
                elif channel == NotificationChannel.IN_APP:
                    channel_recipients.append((channel, str(user_id)))
            channels = channel_recipients

        for channel, recipient in channels:
            request = NotificationRequest(
                recipient=recipient,
                channel=channel,
                body=body,
                subject=subject,
                priority=priority,
                **kwargs
            )

            result = self.send(request, user_id=user_id)
            results.append(result)

        return results

    def send_bulk(
        self,
        user_ids: List[int],
        body: str,
        subject: Optional[str] = None,
        channels: Optional[List[NotificationChannel]] = None,
        priority: NotificationPriority = NotificationPriority.NORMAL
    ) -> Dict[int, List[NotificationResult]]:
        """Send notification to multiple users."""
        results = {}

        for user_id in user_ids:
            results[user_id] = self.send_to_user(
                user_id=user_id,
                body=body,
                subject=subject,
                channels=channels,
                priority=priority
            )

        return results

    def _deliver(self, notification: Notification) -> NotificationResult:
        """Deliver a notification."""
        channel = NotificationChannel(notification.channel)
        handler = self._channel_handlers.get(channel)

        if not handler:
            notification.status = NotificationStatus.FAILED.value
            notification.error_message = f"No handler for channel: {channel.value}"
            notification.failed_at = datetime.utcnow()

            return NotificationResult(
                notification_id=notification.id,
                status=NotificationStatus.FAILED,
                channel=channel,
                error=notification.error_message
            )

        try:
            success = handler(notification)

            if success:
                notification.status = NotificationStatus.SENT.value
                notification.sent_at = datetime.utcnow()

                return NotificationResult(
                    notification_id=notification.id,
                    status=NotificationStatus.SENT,
                    channel=channel,
                    sent_at=notification.sent_at
                )
            else:
                raise Exception("Handler returned failure")

        except Exception as e:
            notification.retry_count += 1

            if notification.retry_count >= notification.max_retries:
                notification.status = NotificationStatus.FAILED.value
                notification.failed_at = datetime.utcnow()
            else:
                notification.status = NotificationStatus.QUEUED.value
                notification.next_retry_at = datetime.utcnow() + timedelta(
                    minutes=5 * notification.retry_count
                )

            notification.error_message = str(e)

            return NotificationResult(
                notification_id=notification.id,
                status=NotificationStatus(notification.status),
                channel=channel,
                error=str(e)
            )

    def _render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """Render a template with variables."""
        result = template
        for key, value in variables.items():
            result = result.replace(f"{{{{{key}}}}}", str(value))
        return result

    def _send_email(self, notification: Notification) -> bool:
        """Send email notification."""
        # In production, would use SMTP or email service like SendGrid
        logger.info(f"Email to {notification.recipient}: {notification.subject}")
        return True

    def _send_sms(self, notification: Notification) -> bool:
        """Send SMS notification."""
        # In production, would use Twilio or similar
        logger.info(f"SMS to {notification.recipient}: {notification.body[:50]}")
        return True

    def _send_push(self, notification: Notification) -> bool:
        """Send push notification."""
        # In production, would use FCM, APNs, etc.
        logger.info(f"Push to {notification.recipient}: {notification.body[:50]}")
        return True

    def _send_in_app(self, notification: Notification) -> bool:
        """Store in-app notification."""
        # Already stored in database, just mark as delivered
        notification.delivered_at = datetime.utcnow()
        return True

    def _send_webhook(self, notification: Notification) -> bool:
        """Send webhook notification."""
        import requests

        try:
            payload = {
                "subject": notification.subject,
                "body": notification.body,
                "priority": notification.priority,
                "timestamp": datetime.utcnow().isoformat()
            }

            response = requests.post(
                notification.recipient,
                json=payload,
                timeout=10
            )

            return response.status_code < 400
        except Exception as e:
            logger.error(f"Webhook failed: {e}")
            return False

    def _send_slack(self, notification: Notification) -> bool:
        """Send Slack notification."""
        import requests

        try:
            payload = {
                "text": f"*{notification.subject}*\n{notification.body}" if notification.subject else notification.body
            }

            response = requests.post(
                notification.recipient,  # Slack webhook URL
                json=payload,
                timeout=10
            )

            return response.status_code == 200
        except Exception as e:
            logger.error(f"Slack notification failed: {e}")
            return False

    def _send_teams(self, notification: Notification) -> bool:
        """Send Microsoft Teams notification."""
        import requests

        try:
            payload = {
                "@type": "MessageCard",
                "summary": notification.subject or "Notification",
                "sections": [{
                    "activityTitle": notification.subject,
                    "text": notification.body
                }]
            }

            response = requests.post(
                notification.recipient,  # Teams webhook URL
                json=payload,
                timeout=10
            )

            return response.status_code == 200
        except Exception as e:
            logger.error(f"Teams notification failed: {e}")
            return False

    def get_user_notifications(
        self,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50
    ) -> List[Notification]:
        """Get notifications for a user."""
        query = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.channel == NotificationChannel.IN_APP.value
        )

        if unread_only:
            query = query.filter(Notification.read_at.is_(None))

        return query.order_by(Notification.created_at.desc()).limit(limit).all()

    def mark_as_read(
        self,
        notification_ids: List[int],
        user_id: int
    ) -> int:
        """Mark notifications as read."""
        count = self.db.query(Notification).filter(
            Notification.id.in_(notification_ids),
            Notification.user_id == user_id,
            Notification.read_at.is_(None)
        ).update({"read_at": datetime.utcnow()}, synchronize_session=False)

        return count

    def process_retry_queue(self) -> int:
        """Process notifications in retry queue."""
        now = datetime.utcnow()

        notifications = self.db.query(Notification).filter(
            Notification.status == NotificationStatus.QUEUED.value,
            Notification.next_retry_at <= now
        ).all()

        processed = 0

        for notification in notifications:
            self._deliver(notification)
            processed += 1

        return processed

    def get_delivery_stats(
        self,
        organization_id: Optional[int] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """Get notification delivery statistics."""
        cutoff = datetime.utcnow() - timedelta(days=days)

        query = self.db.query(Notification).filter(
            Notification.created_at >= cutoff
        )

        if organization_id:
            query = query.filter(Notification.organization_id == organization_id)

        notifications = query.all()

        by_status = {}
        by_channel = {}

        for n in notifications:
            by_status[n.status] = by_status.get(n.status, 0) + 1
            by_channel[n.channel] = by_channel.get(n.channel, 0) + 1

        total = len(notifications)
        sent = sum(1 for n in notifications if n.status in [
            NotificationStatus.SENT.value,
            NotificationStatus.DELIVERED.value,
            NotificationStatus.READ.value
        ])

        return {
            "total": total,
            "sent": sent,
            "delivery_rate": round(sent / total * 100, 2) if total > 0 else 0,
            "by_status": by_status,
            "by_channel": by_channel,
            "period_days": days
        }


def get_notification_service(db: Session) -> NotificationService:
    """Get NotificationService instance."""
    return NotificationService(db)
