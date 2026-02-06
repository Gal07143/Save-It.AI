"""
Tenant Service for SAVE-IT.AI
Multi-tenant organization management:
- Organization hierarchy (Org -> Sites -> Assets)
- Tenant isolation
- Cross-tenant admin
- White-labeling support
- Resource quotas
"""
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from sqlalchemy.orm import Session, Query
from sqlalchemy import and_, func

from app.models.platform import Organization, User, OrgSite
from app.models.core import Site
from app.models.devices import Device

logger = logging.getLogger(__name__)


@dataclass
class TenantQuotas:
    """Resource quotas for a tenant."""
    max_devices: int = 100
    max_users: int = 10
    max_sites: int = 5
    max_gateways: int = 10
    data_retention_days: int = 90
    max_api_requests_per_minute: int = 1000
    max_telemetry_points_per_day: int = 1000000


@dataclass
class TenantUsage:
    """Current resource usage for a tenant."""
    devices: int = 0
    users: int = 0
    sites: int = 0
    gateways: int = 0
    telemetry_points_today: int = 0
    api_requests_today: int = 0
    storage_used_mb: float = 0.0


@dataclass
class OrganizationNode:
    """Node in organization hierarchy tree."""
    id: int
    name: str
    slug: str
    tier: str
    parent_id: Optional[int]
    children: List['OrganizationNode']
    site_count: int
    user_count: int


class TenantService:
    """
    Multi-tenant organization management.
    Handles organization hierarchy, isolation, and quotas.
    """

    # Tier limits
    TIER_QUOTAS = {
        "free": TenantQuotas(
            max_devices=10,
            max_users=3,
            max_sites=1,
            max_gateways=2,
            data_retention_days=30,
            max_api_requests_per_minute=100,
            max_telemetry_points_per_day=100000
        ),
        "standard": TenantQuotas(
            max_devices=100,
            max_users=10,
            max_sites=5,
            max_gateways=10,
            data_retention_days=90,
            max_api_requests_per_minute=1000,
            max_telemetry_points_per_day=1000000
        ),
        "enterprise": TenantQuotas(
            max_devices=10000,
            max_users=100,
            max_sites=100,
            max_gateways=100,
            data_retention_days=365,
            max_api_requests_per_minute=10000,
            max_telemetry_points_per_day=100000000
        )
    }

    def __init__(self, db: Session):
        self.db = db

    def create_organization(
        self,
        name: str,
        slug: str,
        tier: str = "standard",
        parent_id: Optional[int] = None,
        **kwargs
    ) -> Organization:
        """
        Create organization with optional parent.

        Args:
            name: Organization name
            slug: URL-safe slug
            tier: Subscription tier (free, standard, enterprise)
            parent_id: Parent organization ID (for hierarchy)
            **kwargs: Additional organization fields

        Returns:
            Created Organization
        """
        # Check slug uniqueness
        existing = self.db.query(Organization).filter(
            Organization.slug == slug
        ).first()
        if existing:
            raise ValueError(f"Organization with slug '{slug}' already exists")

        # Validate parent exists if specified
        if parent_id:
            parent = self.db.query(Organization).filter(
                Organization.id == parent_id
            ).first()
            if not parent:
                raise ValueError(f"Parent organization {parent_id} not found")

        # Get default quotas for tier
        quotas = self.TIER_QUOTAS.get(tier, self.TIER_QUOTAS["standard"])

        org = Organization(
            name=name,
            slug=slug,
            subscription_plan=tier,
            is_active=1,
            **kwargs
        )

        # Set quota fields if they exist on model
        if hasattr(org, 'max_devices'):
            org.max_devices = quotas.max_devices
        if hasattr(org, 'max_users'):
            org.max_users = quotas.max_users
        if hasattr(org, 'max_sites'):
            org.max_sites = quotas.max_sites

        self.db.add(org)
        self.db.flush()

        logger.info(f"Created organization: {name} ({slug}), tier: {tier}")

        return org

    def get_hierarchy(self, org_id: int) -> OrganizationNode:
        """
        Get full organization hierarchy starting from given org.

        Args:
            org_id: Root organization ID

        Returns:
            OrganizationNode tree
        """
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization {org_id} not found")

        return self._build_hierarchy_node(org)

    def _build_hierarchy_node(self, org: Organization) -> OrganizationNode:
        """Build hierarchy node recursively."""
        # Count sites and users
        site_count = self.db.query(OrgSite).filter(
            OrgSite.organization_id == org.id
        ).count()

        user_count = self.db.query(User).filter(
            User.organization_id == org.id,
            User.is_active == 1
        ).count()

        # Get children (assuming parent_id field exists)
        children = []
        if hasattr(Organization, 'parent_id'):
            child_orgs = self.db.query(Organization).filter(
                Organization.parent_id == org.id
            ).all()
            children = [self._build_hierarchy_node(c) for c in child_orgs]

        return OrganizationNode(
            id=org.id,
            name=org.name,
            slug=org.slug,
            tier=org.subscription_plan or "standard",
            parent_id=getattr(org, 'parent_id', None),
            children=children,
            site_count=site_count,
            user_count=user_count
        )

    def get_quotas(self, org_id: int) -> TenantQuotas:
        """
        Get resource quotas for tenant.

        Args:
            org_id: Organization ID

        Returns:
            TenantQuotas
        """
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization {org_id} not found")

        tier = org.subscription_plan or "standard"
        base_quotas = self.TIER_QUOTAS.get(tier, self.TIER_QUOTAS["standard"])

        # Override with org-specific limits if set
        return TenantQuotas(
            max_devices=getattr(org, 'max_devices', None) or base_quotas.max_devices,
            max_users=getattr(org, 'max_users', None) or base_quotas.max_users,
            max_sites=getattr(org, 'max_sites', None) or base_quotas.max_sites,
            max_gateways=base_quotas.max_gateways,
            data_retention_days=getattr(org, 'data_retention_days', None) or base_quotas.data_retention_days,
            max_api_requests_per_minute=base_quotas.max_api_requests_per_minute,
            max_telemetry_points_per_day=base_quotas.max_telemetry_points_per_day
        )

    def set_quotas(self, org_id: int, quotas: TenantQuotas):
        """
        Set custom resource quotas for tenant.

        Args:
            org_id: Organization ID
            quotas: Custom quotas to set
        """
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization {org_id} not found")

        # Set quota fields if they exist on model
        if hasattr(org, 'max_devices'):
            org.max_devices = quotas.max_devices
        if hasattr(org, 'max_users'):
            org.max_users = quotas.max_users
        if hasattr(org, 'max_sites'):
            org.max_sites = quotas.max_sites
        if hasattr(org, 'data_retention_days'):
            org.data_retention_days = quotas.data_retention_days

        logger.info(f"Updated quotas for organization {org_id}")

    def get_usage(self, org_id: int) -> TenantUsage:
        """
        Get current resource usage for tenant.

        Args:
            org_id: Organization ID

        Returns:
            TenantUsage with current counts
        """
        # Get site IDs for this org
        site_ids = [
            os.site_id for os in
            self.db.query(OrgSite).filter(OrgSite.organization_id == org_id).all()
        ]

        # Count users
        user_count = self.db.query(User).filter(
            User.organization_id == org_id,
            User.is_active == 1
        ).count()

        # Count sites
        site_count = len(site_ids)

        # Count devices
        device_count = 0
        if site_ids:
            device_count = self.db.query(Device).filter(
                Device.site_id.in_(site_ids),
                Device.is_active == 1
            ).count()

        # Count gateways
        from app.models.integrations import Gateway
        gateway_count = 0
        if site_ids:
            gateway_count = self.db.query(Gateway).filter(
                Gateway.site_id.in_(site_ids)
            ).count()

        return TenantUsage(
            devices=device_count,
            users=user_count,
            sites=site_count,
            gateways=gateway_count,
            telemetry_points_today=0,  # Would need telemetry counting
            api_requests_today=0,  # Would need request counting
            storage_used_mb=0.0  # Would need storage calculation
        )

    def check_quota(self, org_id: int, resource: str, increment: int = 1) -> bool:
        """
        Check if adding resources would exceed quota.

        Args:
            org_id: Organization ID
            resource: Resource type (devices, users, sites, gateways)
            increment: Number to add

        Returns:
            True if within quota
        """
        quotas = self.get_quotas(org_id)
        usage = self.get_usage(org_id)

        quota_map = {
            "devices": (usage.devices, quotas.max_devices),
            "users": (usage.users, quotas.max_users),
            "sites": (usage.sites, quotas.max_sites),
            "gateways": (usage.gateways, quotas.max_gateways)
        }

        if resource not in quota_map:
            return True

        current, limit = quota_map[resource]
        return current + increment <= limit

    def isolate_query(self, query: Query, org_id: int, model_class) -> Query:
        """
        Apply tenant isolation to database query.

        Args:
            query: SQLAlchemy query
            org_id: Organization ID to filter by
            model_class: Model class being queried

        Returns:
            Filtered query
        """
        # Get site IDs for this org
        site_ids = [
            os.site_id for os in
            self.db.query(OrgSite).filter(OrgSite.organization_id == org_id).all()
        ]

        # Apply filter based on model type
        if hasattr(model_class, 'organization_id'):
            return query.filter(model_class.organization_id == org_id)
        elif hasattr(model_class, 'site_id'):
            return query.filter(model_class.site_id.in_(site_ids))
        else:
            logger.warning(f"Cannot apply tenant isolation to {model_class.__name__}")
            return query

    def get_organizations(
        self,
        tier: Optional[str] = None,
        is_active: bool = True,
        limit: int = 100
    ) -> List[Organization]:
        """
        Get list of organizations.

        Args:
            tier: Filter by tier
            is_active: Filter by active status
            limit: Max results

        Returns:
            List of Organizations
        """
        query = self.db.query(Organization)

        if tier:
            query = query.filter(Organization.subscription_plan == tier)

        if is_active:
            query = query.filter(Organization.is_active == 1)

        return query.limit(limit).all()

    def update_organization(
        self,
        org_id: int,
        **updates
    ) -> Organization:
        """
        Update organization details.

        Args:
            org_id: Organization ID
            **updates: Fields to update

        Returns:
            Updated Organization
        """
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization {org_id} not found")

        for key, value in updates.items():
            if hasattr(org, key) and key not in ['id', 'created_at']:
                setattr(org, key, value)

        logger.info(f"Updated organization {org_id}")

        return org

    def deactivate_organization(self, org_id: int):
        """
        Deactivate an organization and all its resources.

        Args:
            org_id: Organization ID
        """
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization {org_id} not found")

        org.is_active = 0

        # Deactivate all users
        self.db.query(User).filter(
            User.organization_id == org_id
        ).update({"is_active": 0})

        logger.warning(f"Deactivated organization {org_id}")


def get_tenant_service(db: Session) -> TenantService:
    """Get TenantService instance."""
    return TenantService(db)
