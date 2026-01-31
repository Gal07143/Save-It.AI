"""
Device Lifecycle Service for SAVE-IT.AI
Complete device lifecycle management:
- Provisioning
- Commissioning
- Decommissioning
- Replacement
- End-of-life tracking
"""
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey

from backend.app.core.database import Base
from backend.app.models.devices import Device, DeviceType

logger = logging.getLogger(__name__)


class LifecycleState(Enum):
    """Device lifecycle states."""
    INVENTORY = "inventory"           # In storage, not deployed
    PROVISIONED = "provisioned"       # Configured, ready to deploy
    COMMISSIONED = "commissioned"     # Active and operational
    MAINTENANCE = "maintenance"       # Temporarily offline for service
    SUSPENDED = "suspended"           # Temporarily disabled
    DECOMMISSIONED = "decommissioned" # Removed from service
    RETIRED = "retired"               # End of life
    REPLACED = "replaced"             # Replaced by another device


class LifecycleTransition(Base):
    """Record of lifecycle state transitions."""
    __tablename__ = "lifecycle_transitions"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)

    from_state = Column(String(30), nullable=True)
    to_state = Column(String(30), nullable=False)

    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    performed_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Related records
    work_order_id = Column(Integer, ForeignKey("work_orders.id"), nullable=True)
    replacement_device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)


class DeviceWarranty(Base):
    """Device warranty information."""
    __tablename__ = "device_warranties"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)

    warranty_type = Column(String(50), nullable=False)  # manufacturer, extended, service
    provider = Column(String(255), nullable=True)
    contract_number = Column(String(100), nullable=True)

    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False, index=True)

    coverage_details = Column(Text, nullable=True)  # JSON
    contact_info = Column(Text, nullable=True)  # JSON

    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceLifecycleInfo(Base):
    """Extended device lifecycle information."""
    __tablename__ = "device_lifecycle_info"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, unique=True)

    lifecycle_state = Column(String(30), default="inventory", index=True)

    # Dates
    purchase_date = Column(DateTime, nullable=True)
    received_date = Column(DateTime, nullable=True)
    provisioned_date = Column(DateTime, nullable=True)
    commissioned_date = Column(DateTime, nullable=True)
    decommissioned_date = Column(DateTime, nullable=True)

    # Expected lifespan
    expected_lifespan_years = Column(Integer, nullable=True)
    end_of_life_date = Column(DateTime, nullable=True, index=True)
    end_of_support_date = Column(DateTime, nullable=True)

    # Asset info
    asset_tag = Column(String(100), nullable=True, index=True)
    purchase_order = Column(String(100), nullable=True)
    cost = Column(Integer, nullable=True)  # In cents
    vendor = Column(String(255), nullable=True)

    # Location
    location_description = Column(Text, nullable=True)
    installation_notes = Column(Text, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


@dataclass
class ProvisioningResult:
    """Result of device provisioning."""
    device_id: int
    success: bool
    state: str
    credentials: Optional[Dict[str, str]] = None
    error: Optional[str] = None


@dataclass
class LifecycleReport:
    """Device lifecycle summary report."""
    device_id: int
    device_name: str
    current_state: str
    age_days: int
    warranty_status: str
    end_of_life_days: Optional[int]
    total_transitions: int
    maintenance_count: int


class LifecycleService:
    """
    Device lifecycle management service.
    Handles complete device lifecycle from inventory to retirement.
    """

    # Valid state transitions
    VALID_TRANSITIONS = {
        LifecycleState.INVENTORY: [LifecycleState.PROVISIONED, LifecycleState.RETIRED],
        LifecycleState.PROVISIONED: [LifecycleState.COMMISSIONED, LifecycleState.INVENTORY, LifecycleState.RETIRED],
        LifecycleState.COMMISSIONED: [LifecycleState.MAINTENANCE, LifecycleState.SUSPENDED, LifecycleState.DECOMMISSIONED],
        LifecycleState.MAINTENANCE: [LifecycleState.COMMISSIONED, LifecycleState.DECOMMISSIONED],
        LifecycleState.SUSPENDED: [LifecycleState.COMMISSIONED, LifecycleState.DECOMMISSIONED],
        LifecycleState.DECOMMISSIONED: [LifecycleState.COMMISSIONED, LifecycleState.RETIRED, LifecycleState.REPLACED],
        LifecycleState.RETIRED: [],
        LifecycleState.REPLACED: [],
    }

    def __init__(self, db: Session):
        self.db = db

    def provision_device(
        self,
        device_id: int,
        asset_tag: Optional[str] = None,
        performed_by: Optional[int] = None,
        **kwargs
    ) -> ProvisioningResult:
        """
        Provision a device for deployment.

        Args:
            device_id: Device ID
            asset_tag: Asset tag to assign
            performed_by: User performing provisioning

        Returns:
            ProvisioningResult
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return ProvisioningResult(
                device_id=device_id,
                success=False,
                state="unknown",
                error="Device not found"
            )

        # Get or create lifecycle info
        lifecycle_info = self._get_or_create_lifecycle_info(device_id)

        # Check valid transition
        current_state = LifecycleState(lifecycle_info.lifecycle_state)
        if LifecycleState.PROVISIONED not in self.VALID_TRANSITIONS.get(current_state, []):
            return ProvisioningResult(
                device_id=device_id,
                success=False,
                state=current_state.value,
                error=f"Cannot provision device in state: {current_state.value}"
            )

        # Update lifecycle info
        lifecycle_info.lifecycle_state = LifecycleState.PROVISIONED.value
        lifecycle_info.provisioned_date = datetime.utcnow()

        if asset_tag:
            lifecycle_info.asset_tag = asset_tag

        for key, value in kwargs.items():
            if hasattr(lifecycle_info, key):
                setattr(lifecycle_info, key, value)

        # Record transition
        self._record_transition(
            device_id=device_id,
            from_state=current_state.value,
            to_state=LifecycleState.PROVISIONED.value,
            reason="Device provisioned",
            performed_by=performed_by
        )

        # Generate device credentials if needed
        credentials = self._generate_credentials(device)

        logger.info(f"Provisioned device {device_id}")

        return ProvisioningResult(
            device_id=device_id,
            success=True,
            state=LifecycleState.PROVISIONED.value,
            credentials=credentials
        )

    def commission_device(
        self,
        device_id: int,
        site_id: int,
        location_description: Optional[str] = None,
        installation_notes: Optional[str] = None,
        performed_by: Optional[int] = None
    ) -> bool:
        """
        Commission a device (put into active service).

        Args:
            device_id: Device ID
            site_id: Site to deploy to
            location_description: Installation location
            installation_notes: Installation notes
            performed_by: User performing commissioning

        Returns:
            True if successful
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return False

        lifecycle_info = self._get_or_create_lifecycle_info(device_id)

        current_state = LifecycleState(lifecycle_info.lifecycle_state)
        if LifecycleState.COMMISSIONED not in self.VALID_TRANSITIONS.get(current_state, []):
            raise ValueError(f"Cannot commission device in state: {current_state.value}")

        # Update device
        device.site_id = site_id
        device.is_active = 1
        device.is_online = 1

        # Update lifecycle info
        lifecycle_info.lifecycle_state = LifecycleState.COMMISSIONED.value
        lifecycle_info.commissioned_date = datetime.utcnow()
        lifecycle_info.location_description = location_description
        lifecycle_info.installation_notes = installation_notes

        # Record transition
        self._record_transition(
            device_id=device_id,
            from_state=current_state.value,
            to_state=LifecycleState.COMMISSIONED.value,
            reason="Device commissioned",
            performed_by=performed_by
        )

        logger.info(f"Commissioned device {device_id} at site {site_id}")

        return True

    def decommission_device(
        self,
        device_id: int,
        reason: str,
        performed_by: Optional[int] = None,
        work_order_id: Optional[int] = None
    ) -> bool:
        """
        Decommission a device (remove from active service).

        Args:
            device_id: Device ID
            reason: Reason for decommissioning
            performed_by: User performing action
            work_order_id: Related work order

        Returns:
            True if successful
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return False

        lifecycle_info = self._get_or_create_lifecycle_info(device_id)

        current_state = LifecycleState(lifecycle_info.lifecycle_state)
        if LifecycleState.DECOMMISSIONED not in self.VALID_TRANSITIONS.get(current_state, []):
            raise ValueError(f"Cannot decommission device in state: {current_state.value}")

        # Update device
        device.is_active = 0
        device.is_online = 0

        # Update lifecycle info
        lifecycle_info.lifecycle_state = LifecycleState.DECOMMISSIONED.value
        lifecycle_info.decommissioned_date = datetime.utcnow()

        # Record transition
        self._record_transition(
            device_id=device_id,
            from_state=current_state.value,
            to_state=LifecycleState.DECOMMISSIONED.value,
            reason=reason,
            performed_by=performed_by,
            work_order_id=work_order_id
        )

        logger.info(f"Decommissioned device {device_id}: {reason}")

        return True

    def replace_device(
        self,
        old_device_id: int,
        new_device_id: int,
        reason: str,
        transfer_config: bool = True,
        performed_by: Optional[int] = None
    ) -> bool:
        """
        Replace a device with another.

        Args:
            old_device_id: Device being replaced
            new_device_id: Replacement device
            reason: Reason for replacement
            transfer_config: Transfer configuration to new device
            performed_by: User performing replacement

        Returns:
            True if successful
        """
        old_device = self.db.query(Device).filter(Device.id == old_device_id).first()
        new_device = self.db.query(Device).filter(Device.id == new_device_id).first()

        if not old_device or not new_device:
            return False

        old_lifecycle = self._get_or_create_lifecycle_info(old_device_id)
        new_lifecycle = self._get_or_create_lifecycle_info(new_device_id)

        # Transfer configuration
        if transfer_config:
            new_device.site_id = old_device.site_id
            new_device.gateway_id = old_device.gateway_id
            new_device.name = old_device.name
            # Could transfer more settings here

            new_lifecycle.location_description = old_lifecycle.location_description
            new_lifecycle.installation_notes = old_lifecycle.installation_notes

        # Decommission old device
        old_device.is_active = 0
        old_device.is_online = 0
        old_lifecycle.lifecycle_state = LifecycleState.REPLACED.value

        # Commission new device
        new_device.is_active = 1
        new_lifecycle.lifecycle_state = LifecycleState.COMMISSIONED.value
        new_lifecycle.commissioned_date = datetime.utcnow()

        # Record transitions
        self._record_transition(
            device_id=old_device_id,
            from_state=old_lifecycle.lifecycle_state,
            to_state=LifecycleState.REPLACED.value,
            reason=reason,
            performed_by=performed_by,
            replacement_device_id=new_device_id
        )

        self._record_transition(
            device_id=new_device_id,
            from_state=new_lifecycle.lifecycle_state,
            to_state=LifecycleState.COMMISSIONED.value,
            reason=f"Replaced device {old_device_id}",
            performed_by=performed_by
        )

        logger.info(f"Replaced device {old_device_id} with {new_device_id}")

        return True

    def set_maintenance_mode(
        self,
        device_id: int,
        enabled: bool,
        reason: Optional[str] = None,
        performed_by: Optional[int] = None,
        work_order_id: Optional[int] = None
    ) -> bool:
        """
        Put device into or out of maintenance mode.

        Args:
            device_id: Device ID
            enabled: True to enable maintenance mode
            reason: Reason for maintenance
            performed_by: User performing action
            work_order_id: Related work order

        Returns:
            True if successful
        """
        lifecycle_info = self._get_or_create_lifecycle_info(device_id)

        if enabled:
            target_state = LifecycleState.MAINTENANCE
        else:
            target_state = LifecycleState.COMMISSIONED

        current_state = LifecycleState(lifecycle_info.lifecycle_state)

        if target_state not in self.VALID_TRANSITIONS.get(current_state, []):
            raise ValueError(f"Invalid transition from {current_state.value} to {target_state.value}")

        lifecycle_info.lifecycle_state = target_state.value

        self._record_transition(
            device_id=device_id,
            from_state=current_state.value,
            to_state=target_state.value,
            reason=reason or ("Maintenance started" if enabled else "Maintenance completed"),
            performed_by=performed_by,
            work_order_id=work_order_id
        )

        return True

    def add_warranty(
        self,
        device_id: int,
        warranty_type: str,
        start_date: datetime,
        end_date: datetime,
        provider: Optional[str] = None,
        contract_number: Optional[str] = None,
        coverage_details: Optional[Dict] = None
    ) -> DeviceWarranty:
        """Add warranty information for a device."""
        warranty = DeviceWarranty(
            device_id=device_id,
            warranty_type=warranty_type,
            start_date=start_date,
            end_date=end_date,
            provider=provider,
            contract_number=contract_number,
            coverage_details=json.dumps(coverage_details) if coverage_details else None
        )

        self.db.add(warranty)
        self.db.flush()

        return warranty

    def get_warranty_status(self, device_id: int) -> Dict[str, Any]:
        """Get warranty status for a device."""
        warranties = self.db.query(DeviceWarranty).filter(
            DeviceWarranty.device_id == device_id
        ).all()

        now = datetime.utcnow()
        active_warranties = [w for w in warranties if w.end_date > now]
        expired_warranties = [w for w in warranties if w.end_date <= now]

        return {
            "device_id": device_id,
            "has_active_warranty": len(active_warranties) > 0,
            "active_warranties": [
                {
                    "id": w.id,
                    "type": w.warranty_type,
                    "provider": w.provider,
                    "end_date": w.end_date.isoformat(),
                    "days_remaining": (w.end_date - now).days
                }
                for w in active_warranties
            ],
            "expired_count": len(expired_warranties)
        }

    def get_lifecycle_report(self, device_id: int) -> Optional[LifecycleReport]:
        """Get lifecycle report for a device."""
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return None

        lifecycle_info = self._get_or_create_lifecycle_info(device_id)

        # Calculate age
        if lifecycle_info.purchase_date:
            age_days = (datetime.utcnow() - lifecycle_info.purchase_date).days
        elif device.created_at:
            age_days = (datetime.utcnow() - device.created_at).days
        else:
            age_days = 0

        # Get warranty status
        warranty_info = self.get_warranty_status(device_id)
        warranty_status = "active" if warranty_info["has_active_warranty"] else "expired"

        # Calculate end of life
        eol_days = None
        if lifecycle_info.end_of_life_date:
            eol_days = (lifecycle_info.end_of_life_date - datetime.utcnow()).days

        # Count transitions
        transition_count = self.db.query(LifecycleTransition).filter(
            LifecycleTransition.device_id == device_id
        ).count()

        # Count maintenance events
        maintenance_count = self.db.query(LifecycleTransition).filter(
            LifecycleTransition.device_id == device_id,
            LifecycleTransition.to_state == LifecycleState.MAINTENANCE.value
        ).count()

        return LifecycleReport(
            device_id=device_id,
            device_name=device.name,
            current_state=lifecycle_info.lifecycle_state,
            age_days=age_days,
            warranty_status=warranty_status,
            end_of_life_days=eol_days,
            total_transitions=transition_count,
            maintenance_count=maintenance_count
        )

    def get_devices_approaching_eol(
        self,
        organization_id: int,
        days_ahead: int = 90
    ) -> List[Device]:
        """Get devices approaching end of life."""
        cutoff = datetime.utcnow() + timedelta(days=days_ahead)

        # Get devices with EOL dates
        lifecycle_infos = self.db.query(DeviceLifecycleInfo).filter(
            DeviceLifecycleInfo.end_of_life_date <= cutoff,
            DeviceLifecycleInfo.lifecycle_state.notin_([
                LifecycleState.RETIRED.value,
                LifecycleState.REPLACED.value
            ])
        ).all()

        device_ids = [li.device_id for li in lifecycle_infos]

        if not device_ids:
            return []

        return self.db.query(Device).filter(
            Device.id.in_(device_ids),
            Device.is_active == 1
        ).all()

    def get_devices_with_expiring_warranty(
        self,
        organization_id: int,
        days_ahead: int = 30
    ) -> List[Dict[str, Any]]:
        """Get devices with warranties expiring soon."""
        cutoff = datetime.utcnow() + timedelta(days=days_ahead)

        warranties = self.db.query(DeviceWarranty).filter(
            DeviceWarranty.end_date <= cutoff,
            DeviceWarranty.end_date > datetime.utcnow()
        ).all()

        results = []
        for warranty in warranties:
            device = self.db.query(Device).filter(Device.id == warranty.device_id).first()
            if device and device.is_active:
                results.append({
                    "device_id": device.id,
                    "device_name": device.name,
                    "warranty_type": warranty.warranty_type,
                    "provider": warranty.provider,
                    "expires_at": warranty.end_date,
                    "days_remaining": (warranty.end_date - datetime.utcnow()).days
                })

        return results

    def get_transition_history(
        self,
        device_id: int,
        limit: int = 50
    ) -> List[LifecycleTransition]:
        """Get transition history for a device."""
        return self.db.query(LifecycleTransition).filter(
            LifecycleTransition.device_id == device_id
        ).order_by(LifecycleTransition.performed_at.desc()).limit(limit).all()

    def _get_or_create_lifecycle_info(self, device_id: int) -> DeviceLifecycleInfo:
        """Get or create lifecycle info for a device."""
        lifecycle_info = self.db.query(DeviceLifecycleInfo).filter(
            DeviceLifecycleInfo.device_id == device_id
        ).first()

        if not lifecycle_info:
            lifecycle_info = DeviceLifecycleInfo(
                device_id=device_id,
                lifecycle_state=LifecycleState.INVENTORY.value
            )
            self.db.add(lifecycle_info)
            self.db.flush()

        return lifecycle_info

    def _record_transition(
        self,
        device_id: int,
        from_state: str,
        to_state: str,
        reason: Optional[str] = None,
        performed_by: Optional[int] = None,
        work_order_id: Optional[int] = None,
        replacement_device_id: Optional[int] = None
    ):
        """Record a lifecycle transition."""
        transition = LifecycleTransition(
            device_id=device_id,
            from_state=from_state,
            to_state=to_state,
            reason=reason,
            performed_by=performed_by,
            work_order_id=work_order_id,
            replacement_device_id=replacement_device_id
        )

        self.db.add(transition)

    def _generate_credentials(self, device: Device) -> Optional[Dict[str, str]]:
        """Generate device credentials for provisioning."""
        import secrets

        # Generate API key for device
        api_key = secrets.token_urlsafe(32)

        # In production, would also generate:
        # - MQTT credentials
        # - Certificate if using mTLS

        return {
            "api_key": api_key,
            "device_id": str(device.id)
        }


def get_lifecycle_service(db: Session) -> LifecycleService:
    """Get LifecycleService instance."""
    return LifecycleService(db)
