"""
Audit Service for SAVE-IT.AI
Complete audit trail for compliance:
- All CRUD operations
- Authentication events
- Configuration changes
- Data access tracking
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from backend.app.models.platform import AuditLog, AuditAction

logger = logging.getLogger(__name__)


@dataclass
class AuditFilter:
    """Filter criteria for audit queries."""
    organization_id: Optional[int] = None
    user_id: Optional[int] = None
    site_id: Optional[int] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    ip_address: Optional[str] = None
    correlation_id: Optional[str] = None


class AuditService:
    """
    Complete audit trail service.
    Logs all significant actions for compliance and debugging.
    """

    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        site_id: Optional[int] = None,
        old_value: Optional[Dict] = None,
        new_value: Optional[Dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        correlation_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> AuditLog:
        """
        Log an audit event.

        Args:
            action: Action type (create, update, delete, login, etc.)
            resource_type: Type of resource affected
            resource_id: ID of affected resource
            user_id: User performing action
            organization_id: Organization context
            site_id: Site context
            old_value: Previous state (for updates)
            new_value: New state (for creates/updates)
            ip_address: Client IP
            user_agent: Client user agent
            correlation_id: Request correlation ID
            metadata: Additional metadata

        Returns:
            Created AuditLog
        """
        # Convert action string to enum
        try:
            action_enum = AuditAction(action)
        except ValueError:
            action_enum = AuditAction.UPDATE  # Default fallback

        audit_log = AuditLog(
            user_id=user_id,
            organization_id=organization_id,
            site_id=site_id,
            action=action_enum,
            entity_type=resource_type,
            entity_id=resource_id,
            before_state=json.dumps(old_value) if old_value else None,
            after_state=json.dumps(new_value) if new_value else None,
            ip_address=ip_address,
            user_agent=user_agent,
            correlation_id=correlation_id,
            metadata_json=json.dumps(metadata) if metadata else None
        )

        self.db.add(audit_log)
        # Don't flush here - let the calling code control transaction

        logger.debug(f"Audit: {action} {resource_type}/{resource_id} by user {user_id}")

        return audit_log

    def query(
        self,
        filters: AuditFilter,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditLog]:
        """
        Query audit logs with filters.

        Args:
            filters: AuditFilter with query criteria
            limit: Max results
            offset: Skip results

        Returns:
            List of AuditLog records
        """
        query = self.db.query(AuditLog)

        if filters.organization_id:
            query = query.filter(AuditLog.organization_id == filters.organization_id)

        if filters.user_id:
            query = query.filter(AuditLog.user_id == filters.user_id)

        if filters.site_id:
            query = query.filter(AuditLog.site_id == filters.site_id)

        if filters.action:
            try:
                action_enum = AuditAction(filters.action)
                query = query.filter(AuditLog.action == action_enum)
            except ValueError:
                pass

        if filters.resource_type:
            query = query.filter(AuditLog.entity_type == filters.resource_type)

        if filters.resource_id:
            query = query.filter(AuditLog.entity_id == filters.resource_id)

        if filters.start_time:
            query = query.filter(AuditLog.created_at >= filters.start_time)

        if filters.end_time:
            query = query.filter(AuditLog.created_at <= filters.end_time)

        if filters.ip_address:
            query = query.filter(AuditLog.ip_address == filters.ip_address)

        if filters.correlation_id:
            query = query.filter(AuditLog.correlation_id == filters.correlation_id)

        return query.order_by(
            AuditLog.created_at.desc()
        ).offset(offset).limit(limit).all()

    def export(
        self,
        filters: AuditFilter,
        format: str = "json"
    ) -> bytes:
        """
        Export audit logs.

        Args:
            filters: AuditFilter
            format: Export format (json, csv)

        Returns:
            Exported data as bytes
        """
        logs = self.query(filters, limit=10000)

        if format == "csv":
            return self._export_csv(logs)
        else:
            return self._export_json(logs)

    def _export_json(self, logs: List[AuditLog]) -> bytes:
        """Export logs as JSON."""
        data = []
        for log in logs:
            data.append({
                "id": log.id,
                "timestamp": log.created_at.isoformat() if log.created_at else None,
                "user_id": log.user_id,
                "organization_id": log.organization_id,
                "site_id": log.site_id,
                "action": log.action.value if log.action else None,
                "resource_type": log.entity_type,
                "resource_id": log.entity_id,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "correlation_id": log.correlation_id,
                "before_state": json.loads(log.before_state) if log.before_state else None,
                "after_state": json.loads(log.after_state) if log.after_state else None
            })

        return json.dumps(data, indent=2).encode()

    def _export_csv(self, logs: List[AuditLog]) -> bytes:
        """Export logs as CSV."""
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "ID", "Timestamp", "User ID", "Organization ID", "Site ID",
            "Action", "Resource Type", "Resource ID", "IP Address",
            "User Agent", "Correlation ID"
        ])

        # Data
        for log in logs:
            writer.writerow([
                log.id,
                log.created_at.isoformat() if log.created_at else "",
                log.user_id or "",
                log.organization_id or "",
                log.site_id or "",
                log.action.value if log.action else "",
                log.entity_type or "",
                log.entity_id or "",
                log.ip_address or "",
                log.user_agent or "",
                log.correlation_id or ""
            ])

        return output.getvalue().encode()

    def get_user_activity(
        self,
        user_id: int,
        days: int = 30,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get user's activity history.

        Args:
            user_id: User ID
            days: Look back period
            limit: Max results

        Returns:
            List of user's audit logs
        """
        cutoff = datetime.utcnow() - timedelta(days=days)

        return self.db.query(AuditLog).filter(
            AuditLog.user_id == user_id,
            AuditLog.created_at >= cutoff
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    def get_resource_history(
        self,
        resource_type: str,
        resource_id: int,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get change history for a resource.

        Args:
            resource_type: Type of resource
            resource_id: Resource ID
            limit: Max results

        Returns:
            List of audit logs for resource
        """
        return self.db.query(AuditLog).filter(
            AuditLog.entity_type == resource_type,
            AuditLog.entity_id == resource_id
        ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    def get_login_history(
        self,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        days: int = 30,
        limit: int = 100
    ) -> List[AuditLog]:
        """
        Get login/logout history.

        Args:
            user_id: Filter by user
            organization_id: Filter by organization
            days: Look back period
            limit: Max results

        Returns:
            List of login/logout audit logs
        """
        cutoff = datetime.utcnow() - timedelta(days=days)

        query = self.db.query(AuditLog).filter(
            AuditLog.action.in_([AuditAction.LOGIN, AuditAction.LOGOUT]),
            AuditLog.created_at >= cutoff
        )

        if user_id:
            query = query.filter(AuditLog.user_id == user_id)

        if organization_id:
            query = query.filter(AuditLog.organization_id == organization_id)

        return query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    def get_statistics(
        self,
        organization_id: Optional[int] = None,
        days: int = 30
    ) -> Dict[str, Any]:
        """
        Get audit statistics.

        Args:
            organization_id: Filter by organization
            days: Period to analyze

        Returns:
            Dict with audit statistics
        """
        cutoff = datetime.utcnow() - timedelta(days=days)

        query = self.db.query(AuditLog).filter(
            AuditLog.created_at >= cutoff
        )

        if organization_id:
            query = query.filter(AuditLog.organization_id == organization_id)

        logs = query.all()

        # Calculate statistics
        by_action = {}
        by_resource = {}
        by_user = {}
        by_day = {}

        for log in logs:
            # By action
            action = log.action.value if log.action else "unknown"
            by_action[action] = by_action.get(action, 0) + 1

            # By resource type
            resource = log.entity_type or "unknown"
            by_resource[resource] = by_resource.get(resource, 0) + 1

            # By user
            user = log.user_id or 0
            by_user[user] = by_user.get(user, 0) + 1

            # By day
            if log.created_at:
                day = log.created_at.strftime("%Y-%m-%d")
                by_day[day] = by_day.get(day, 0) + 1

        return {
            "total_events": len(logs),
            "period_days": days,
            "by_action": by_action,
            "by_resource_type": by_resource,
            "by_user": dict(sorted(by_user.items(), key=lambda x: x[1], reverse=True)[:10]),
            "by_day": dict(sorted(by_day.items())),
            "unique_users": len(by_user),
            "unique_resources": len(by_resource)
        }

    def cleanup_old_logs(
        self,
        retention_days: int,
        organization_id: Optional[int] = None
    ) -> int:
        """
        Delete audit logs older than retention period.

        Args:
            retention_days: Delete logs older than this
            organization_id: Only cleanup for specific org

        Returns:
            Count of deleted logs
        """
        cutoff = datetime.utcnow() - timedelta(days=retention_days)

        query = self.db.query(AuditLog).filter(
            AuditLog.created_at < cutoff
        )

        if organization_id:
            query = query.filter(AuditLog.organization_id == organization_id)

        count = query.delete(synchronize_session=False)

        logger.info(f"Cleaned up {count} audit logs older than {retention_days} days")

        return count


def get_audit_service(db: Session) -> AuditService:
    """Get AuditService instance."""
    return AuditService(db)


# Middleware helper for automatic audit logging
class AuditMiddleware:
    """
    Helper class for automatic audit logging in API endpoints.
    """

    def __init__(self, audit_service: AuditService):
        self.audit = audit_service

    def log_request(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[int] = None,
        user_id: Optional[int] = None,
        organization_id: Optional[int] = None,
        request=None,
        old_value: Optional[Dict] = None,
        new_value: Optional[Dict] = None
    ):
        """Log API request as audit event."""
        ip_address = None
        user_agent = None
        correlation_id = None

        if request:
            ip_address = request.client.host if hasattr(request, 'client') else None
            user_agent = request.headers.get("user-agent")
            correlation_id = request.headers.get("x-correlation-id")

        self.audit.log(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            organization_id=organization_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent,
            correlation_id=correlation_id
        )
