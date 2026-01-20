"""Email service for transactional email sending."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging
import os

logger = logging.getLogger(__name__)


class EmailStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"


@dataclass
class EmailMessage:
    """Represents an email message."""
    id: str
    to: List[str]
    subject: str
    body_html: str
    body_text: Optional[str] = None
    from_address: Optional[str] = None
    cc: List[str] = field(default_factory=list)
    bcc: List[str] = field(default_factory=list)
    reply_to: Optional[str] = None
    attachments: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    status: EmailStatus = EmailStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    error: Optional[str] = None


class EmailTemplate:
    """Email template with variable substitution."""
    
    def __init__(self, name: str, subject: str, html: str, text: Optional[str] = None):
        self.name = name
        self.subject = subject
        self.html = html
        self.text = text
    
    def render(self, variables: Dict[str, Any]) -> tuple:
        """Render the template with variables."""
        subject = self.subject
        html = self.html
        text = self.text or ""
        
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"
            subject = subject.replace(placeholder, str(value))
            html = html.replace(placeholder, str(value))
            text = text.replace(placeholder, str(value))
        
        return subject, html, text


class EmailService:
    """Service for sending transactional emails."""
    
    def __init__(self):
        self.templates: Dict[str, EmailTemplate] = {}
        self.sent_emails: List[EmailMessage] = []
        self._max_history = 1000
        self._enabled = os.getenv("EMAIL_ENABLED", "false").lower() == "true"
        self._from_address = os.getenv("EMAIL_FROM", "noreply@saveit.ai")
        self._register_default_templates()
    
    def _register_default_templates(self):
        """Register default email templates."""
        self.register_template(EmailTemplate(
            name="welcome",
            subject="Welcome to SAVE-IT.AI",
            html="""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h1>Welcome to SAVE-IT.AI, {{user_name}}!</h1>
                <p>Your account has been created successfully.</p>
                <p>Organization: {{organization_name}}</p>
                <p>Get started by logging in to your dashboard.</p>
            </body>
            </html>
            """,
            text="Welcome to SAVE-IT.AI, {{user_name}}! Your account is ready.",
        ))
        
        self.register_template(EmailTemplate(
            name="password_reset",
            subject="Reset Your Password - SAVE-IT.AI",
            html="""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password:</p>
                <a href="{{reset_link}}">Reset Password</a>
                <p>This link expires in 24 hours.</p>
            </body>
            </html>
            """,
        ))
        
        self.register_template(EmailTemplate(
            name="alert_notification",
            subject="[ALERT] {{alert_title}} - SAVE-IT.AI",
            html="""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #dc2626;">Alert: {{alert_title}}</h2>
                <p><strong>Site:</strong> {{site_name}}</p>
                <p><strong>Severity:</strong> {{severity}}</p>
                <p><strong>Message:</strong> {{message}}</p>
                <p><strong>Time:</strong> {{timestamp}}</p>
            </body>
            </html>
            """,
        ))
        
        self.register_template(EmailTemplate(
            name="invoice_generated",
            subject="Invoice #{{invoice_number}} Generated - SAVE-IT.AI",
            html="""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Invoice Generated</h2>
                <p>Invoice #{{invoice_number}} has been generated for {{tenant_name}}.</p>
                <p><strong>Amount:</strong> ${{amount}}</p>
                <p><strong>Period:</strong> {{period}}</p>
                <p><strong>Due Date:</strong> {{due_date}}</p>
            </body>
            </html>
            """,
        ))
        
        self.register_template(EmailTemplate(
            name="report_ready",
            subject="Report Ready: {{report_name}} - SAVE-IT.AI",
            html="""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Your Report is Ready</h2>
                <p>The report "{{report_name}}" has been generated.</p>
                <p><a href="{{download_link}}">Download Report</a></p>
            </body>
            </html>
            """,
        ))
        
        self.register_template(EmailTemplate(
            name="billing_reminder",
            subject="Billing Reminder: Payment Due Soon",
            html="""
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2>Payment Reminder</h2>
                <p>This is a reminder that payment of ${{amount}} is due on {{due_date}}.</p>
                <p>Please ensure timely payment to avoid any service interruptions.</p>
            </body>
            </html>
            """,
        ))
    
    def register_template(self, template: EmailTemplate):
        """Register an email template."""
        self.templates[template.name] = template
        logger.debug(f"Registered email template: {template.name}")
    
    async def send(
        self,
        to: List[str],
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_address: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        reply_to: Optional[str] = None,
        attachments: Optional[List[Dict]] = None,
        metadata: Optional[Dict] = None,
    ) -> EmailMessage:
        """Send an email."""
        import uuid
        
        message = EmailMessage(
            id=str(uuid.uuid4()),
            to=to,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            from_address=from_address or self._from_address,
            cc=cc or [],
            bcc=bcc or [],
            reply_to=reply_to,
            attachments=attachments or [],
            metadata=metadata or {},
        )
        
        if not self._enabled:
            logger.info(f"Email sending disabled. Would send to: {to}")
            message.status = EmailStatus.SENT
            message.sent_at = datetime.utcnow()
        else:
            try:
                await self._send_via_provider(message)
                message.status = EmailStatus.SENT
                message.sent_at = datetime.utcnow()
                logger.info(f"Email sent: {message.id} to {to}")
            except Exception as e:
                message.status = EmailStatus.FAILED
                message.error = str(e)
                logger.error(f"Email failed: {message.id} - {e}")
        
        self.sent_emails.append(message)
        if len(self.sent_emails) > self._max_history:
            self.sent_emails = self.sent_emails[-self._max_history:]
        
        return message
    
    async def send_template(
        self,
        template_name: str,
        to: List[str],
        variables: Dict[str, Any],
        **kwargs,
    ) -> EmailMessage:
        """Send an email using a template."""
        template = self.templates.get(template_name)
        if not template:
            raise ValueError(f"Template not found: {template_name}")
        
        subject, html, text = template.render(variables)
        return await self.send(
            to=to,
            subject=subject,
            body_html=html,
            body_text=text,
            metadata={"template": template_name, **kwargs.get("metadata", {})},
            **{k: v for k, v in kwargs.items() if k != "metadata"},
        )
    
    async def _send_via_provider(self, message: EmailMessage):
        """Send email via configured provider (SMTP or SendGrid)."""
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        provider = os.getenv("EMAIL_PROVIDER", "smtp").lower()
        
        if provider == "sendgrid":
            await self._send_via_sendgrid(message)
        else:
            await self._send_via_smtp(message)
    
    async def _send_via_smtp(self, message: EmailMessage):
        """Send email via SMTP."""
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        smtp_host = os.getenv("SMTP_HOST", "")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER", "")
        smtp_password = os.getenv("SMTP_PASSWORD", "")
        
        if not smtp_host:
            raise ValueError("SMTP_HOST not configured")
        
        msg = MIMEMultipart("alternative")
        msg["Subject"] = message.subject
        msg["From"] = message.from_address or self._from_address
        msg["To"] = ", ".join(message.to)
        
        if message.cc:
            msg["Cc"] = ", ".join(message.cc)
        if message.reply_to:
            msg["Reply-To"] = message.reply_to
        
        if message.body_text:
            msg.attach(MIMEText(message.body_text, "plain"))
        msg.attach(MIMEText(message.body_html, "html"))
        
        recipients = message.to + message.cc + message.bcc
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(msg["From"], recipients, msg.as_string())
        
        logger.info(f"Email sent via SMTP: {message.id}")
    
    async def _send_via_sendgrid(self, message: EmailMessage):
        """Send email via SendGrid API."""
        import httpx
        
        api_key = os.getenv("SENDGRID_API_KEY", "")
        if not api_key:
            raise ValueError("SENDGRID_API_KEY not configured")
        
        payload = {
            "personalizations": [{
                "to": [{"email": email} for email in message.to],
                "cc": [{"email": email} for email in message.cc] if message.cc else None,
                "bcc": [{"email": email} for email in message.bcc] if message.bcc else None,
            }],
            "from": {"email": message.from_address or self._from_address},
            "subject": message.subject,
            "content": [
                {"type": "text/plain", "value": message.body_text or ""},
                {"type": "text/html", "value": message.body_html},
            ],
        }
        
        if message.reply_to:
            payload["reply_to"] = {"email": message.reply_to}
        
        payload["personalizations"][0] = {k: v for k, v in payload["personalizations"][0].items() if v}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
        
        logger.info(f"Email sent via SendGrid: {message.id}")
    
    def get_history(
        self,
        status: Optional[EmailStatus] = None,
        limit: int = 100,
    ) -> List[dict]:
        """Get email send history."""
        emails = self.sent_emails
        if status:
            emails = [e for e in emails if e.status == status]
        
        return [
            {
                "id": e.id,
                "to": e.to,
                "subject": e.subject,
                "status": e.status.value,
                "created_at": e.created_at.isoformat(),
                "sent_at": e.sent_at.isoformat() if e.sent_at else None,
                "error": e.error,
            }
            for e in emails[-limit:]
        ]
    
    def get_stats(self) -> dict:
        """Get email service statistics."""
        total = len(self.sent_emails)
        by_status = {}
        for e in self.sent_emails:
            by_status[e.status.value] = by_status.get(e.status.value, 0) + 1
        
        return {
            "enabled": self._enabled,
            "total_sent": total,
            "by_status": by_status,
            "templates": list(self.templates.keys()),
        }


email_service = EmailService()
