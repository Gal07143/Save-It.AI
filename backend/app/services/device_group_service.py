"""
Device Group Service for SAVE-IT.AI
Device grouping and bulk operations:
- Logical device groups
- Dynamic grouping rules
- Bulk operations
- Group-level metrics
"""
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from sqlalchemy.orm import Session

from backend.app.models.devices import Device
from backend.app.models.integrations import DeviceGroup, DeviceGroupMember

logger = logging.getLogger(__name__)


@dataclass
class GroupRule:
    """Rule for dynamic group membership."""
    field: str  # device field to check
    operator: str  # eq, neq, contains, in, gt, lt
    value: Any  # value to compare


@dataclass
class GroupStats:
    """Statistics for a device group."""
    group_id: int
    total_devices: int
    online_devices: int
    offline_devices: int
    devices_with_alarms: int
    avg_uptime_percent: float


@dataclass
class BulkOperationResult:
    """Result of a bulk operation."""
    operation: str
    total_devices: int
    successful: int
    failed: int
    errors: List[Dict[str, Any]]


class DeviceGroupService:
    """
    Device grouping and bulk operations service.
    Supports static and dynamic grouping with rule-based membership.
    """

    OPERATORS = {
        "eq": lambda a, b: a == b,
        "neq": lambda a, b: a != b,
        "gt": lambda a, b: a > b if a is not None and b is not None else False,
        "lt": lambda a, b: a < b if a is not None and b is not None else False,
        "gte": lambda a, b: a >= b if a is not None and b is not None else False,
        "lte": lambda a, b: a <= b if a is not None and b is not None else False,
        "contains": lambda a, b: str(b).lower() in str(a).lower() if a else False,
        "in": lambda a, b: a in b if isinstance(b, list) else False,
        "startswith": lambda a, b: str(a).startswith(str(b)) if a else False,
    }

    def __init__(self, db: Session):
        self.db = db

    def create_group(
        self,
        organization_id: int,
        name: str,
        description: Optional[str] = None,
        site_id: Optional[int] = None,
        is_dynamic: bool = False,
        rules: Optional[List[Dict]] = None,
        created_by: Optional[int] = None,
        **kwargs
    ) -> DeviceGroup:
        """
        Create a new device group.

        Args:
            organization_id: Organization ID
            name: Group name
            description: Group description
            site_id: Optional site scope
            is_dynamic: If True, membership based on rules
            rules: Dynamic membership rules
            created_by: User creating the group

        Returns:
            Created DeviceGroup
        """
        group = DeviceGroup(
            organization_id=organization_id,
            site_id=site_id,
            name=name,
            description=description,
            is_dynamic=1 if is_dynamic else 0,
            rules=json.dumps(rules) if rules else None,
            created_by=created_by,
            **kwargs
        )

        self.db.add(group)
        self.db.flush()

        logger.info(f"Created device group: {name} (ID: {group.id})")

        return group

    def update_group(
        self,
        group_id: int,
        **updates
    ) -> Optional[DeviceGroup]:
        """Update a device group."""
        group = self.db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not group:
            return None

        for key, value in updates.items():
            if hasattr(group, key) and key not in ['id', 'created_at', 'organization_id']:
                if key == 'rules' and value is not None:
                    value = json.dumps(value)
                setattr(group, key, value)

        return group

    def delete_group(self, group_id: int) -> bool:
        """Delete a device group."""
        group = self.db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not group:
            return False

        self.db.delete(group)
        return True

    def add_devices(
        self,
        group_id: int,
        device_ids: List[int]
    ) -> int:
        """
        Add devices to a group.

        Args:
            group_id: Group ID
            device_ids: List of device IDs to add

        Returns:
            Number of devices added
        """
        group = self.db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not group or group.is_dynamic:
            return 0

        added = 0
        for device_id in device_ids:
            # Check if already a member
            existing = self.db.execute(
                device_group_members.select().where(
                    (device_group_members.c.group_id == group_id) &
                    (device_group_members.c.device_id == device_id)
                )
            ).first()

            if not existing:
                self.db.execute(
                    device_group_members.insert().values(
                        group_id=group_id,
                        device_id=device_id
                    )
                )
                added += 1

        logger.info(f"Added {added} devices to group {group_id}")
        return added

    def remove_devices(
        self,
        group_id: int,
        device_ids: List[int]
    ) -> int:
        """Remove devices from a group."""
        group = self.db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not group or group.is_dynamic:
            return 0

        result = self.db.execute(
            device_group_members.delete().where(
                (device_group_members.c.group_id == group_id) &
                (device_group_members.c.device_id.in_(device_ids))
            )
        )

        return result.rowcount

    def get_devices(
        self,
        group_id: int,
        include_offline: bool = True
    ) -> List[Device]:
        """
        Get devices in a group.

        Args:
            group_id: Group ID
            include_offline: Include offline devices

        Returns:
            List of Device objects
        """
        group = self.db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not group:
            return []

        if group.is_dynamic:
            return self._get_dynamic_members(group)
        else:
            return self._get_static_members(group_id, include_offline)

    def _get_static_members(
        self,
        group_id: int,
        include_offline: bool = True
    ) -> List[Device]:
        """Get statically assigned group members."""
        query = self.db.query(Device).join(
            device_group_members,
            Device.id == device_group_members.c.device_id
        ).filter(
            device_group_members.c.group_id == group_id
        )

        if not include_offline:
            query = query.filter(Device.is_online == 1)

        return query.all()

    def _get_dynamic_members(self, group: DeviceGroup) -> List[Device]:
        """Get devices matching dynamic rules."""
        if not group.rules:
            return []

        rules = json.loads(group.rules)
        if not rules:
            return []

        # Start with all devices in the organization
        query = self.db.query(Device).filter(
            Device.is_active == 1
        )

        # Get site IDs for this org if needed
        if group.site_id:
            query = query.filter(Device.site_id == group.site_id)

        all_devices = query.all()

        # Filter by rules
        matching = []
        for device in all_devices:
            if self._device_matches_rules(device, rules):
                matching.append(device)

        return matching

    def _device_matches_rules(
        self,
        device: Device,
        rules: List[Dict]
    ) -> bool:
        """Check if device matches all rules."""
        for rule in rules:
            field = rule.get("field")
            operator = rule.get("operator", "eq")
            value = rule.get("value")

            # Get device field value
            device_value = getattr(device, field, None)
            if device_value is None and hasattr(device, 'metadata'):
                # Try metadata
                metadata = getattr(device, 'metadata', {}) or {}
                device_value = metadata.get(field)

            # Get operator function
            op_func = self.OPERATORS.get(operator)
            if not op_func:
                continue

            if not op_func(device_value, value):
                return False

        return True

    def refresh_dynamic_group(self, group_id: int) -> int:
        """
        Refresh dynamic group membership.

        Args:
            group_id: Group ID to refresh

        Returns:
            Current member count
        """
        group = self.db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
        if not group or not group.is_dynamic:
            return 0

        members = self._get_dynamic_members(group)
        return len(members)

    def get_statistics(self, group_id: int) -> Optional[GroupStats]:
        """
        Get group statistics.

        Args:
            group_id: Group ID

        Returns:
            GroupStats or None
        """
        devices = self.get_devices(group_id)
        if not devices:
            return GroupStats(
                group_id=group_id,
                total_devices=0,
                online_devices=0,
                offline_devices=0,
                devices_with_alarms=0,
                avg_uptime_percent=0.0
            )

        online = sum(1 for d in devices if d.is_online == 1)
        offline = len(devices) - online

        # Count devices with active alarms
        from backend.app.models.telemetry import DeviceAlarm, AlarmStatus

        alarm_device_ids = set(
            a.device_id for a in
            self.db.query(DeviceAlarm.device_id).filter(
                DeviceAlarm.device_id.in_([d.id for d in devices]),
                DeviceAlarm.status == AlarmStatus.TRIGGERED
            ).distinct().all()
        )

        # Calculate average uptime (simplified - based on online status)
        uptime_percent = (online / len(devices) * 100) if devices else 0.0

        return GroupStats(
            group_id=group_id,
            total_devices=len(devices),
            online_devices=online,
            offline_devices=offline,
            devices_with_alarms=len(alarm_device_ids),
            avg_uptime_percent=round(uptime_percent, 2)
        )

    def bulk_update(
        self,
        group_id: int,
        updates: Dict[str, Any]
    ) -> BulkOperationResult:
        """
        Perform bulk update on all devices in a group.

        Args:
            group_id: Group ID
            updates: Fields to update

        Returns:
            BulkOperationResult
        """
        devices = self.get_devices(group_id)
        if not devices:
            return BulkOperationResult(
                operation="update",
                total_devices=0,
                successful=0,
                failed=0,
                errors=[]
            )

        successful = 0
        failed = 0
        errors = []

        for device in devices:
            try:
                for key, value in updates.items():
                    if hasattr(device, key) and key not in ['id', 'created_at']:
                        setattr(device, key, value)
                successful += 1
            except Exception as e:
                failed += 1
                errors.append({"device_id": device.id, "error": str(e)})

        return BulkOperationResult(
            operation="update",
            total_devices=len(devices),
            successful=successful,
            failed=failed,
            errors=errors
        )

    def bulk_command(
        self,
        group_id: int,
        command: str,
        params: Optional[Dict[str, Any]] = None
    ) -> BulkOperationResult:
        """
        Send command to all devices in a group.

        Args:
            group_id: Group ID
            command: Command to send
            params: Command parameters

        Returns:
            BulkOperationResult
        """
        devices = self.get_devices(group_id, include_offline=False)
        if not devices:
            return BulkOperationResult(
                operation="command",
                total_devices=0,
                successful=0,
                failed=0,
                errors=[]
            )

        successful = 0
        failed = 0
        errors = []

        from backend.app.services.config_sync_service import get_config_sync_service

        sync_service = get_config_sync_service(self.db)

        for device in devices:
            try:
                # Push command via config sync
                result = sync_service.push_command(device.id, command, params or {})
                if result.success:
                    successful += 1
                else:
                    failed += 1
                    errors.append({"device_id": device.id, "error": result.error})
            except Exception as e:
                failed += 1
                errors.append({"device_id": device.id, "error": str(e)})

        logger.info(f"Bulk command '{command}' to group {group_id}: {successful}/{len(devices)} successful")

        return BulkOperationResult(
            operation=f"command:{command}",
            total_devices=len(devices),
            successful=successful,
            failed=failed,
            errors=errors
        )

    def get_groups(
        self,
        organization_id: int,
        site_id: Optional[int] = None
    ) -> List[DeviceGroup]:
        """Get all groups for an organization."""
        query = self.db.query(DeviceGroup).filter(
            DeviceGroup.organization_id == organization_id
        )

        if site_id:
            query = query.filter(DeviceGroup.site_id == site_id)

        return query.all()

    def get_device_groups(self, device_id: int) -> List[DeviceGroup]:
        """Get all groups a device belongs to."""
        # Static membership
        static_groups = self.db.query(DeviceGroup).join(
            device_group_members,
            DeviceGroup.id == device_group_members.c.group_id
        ).filter(
            device_group_members.c.device_id == device_id,
            DeviceGroup.is_dynamic == 0
        ).all()

        # Dynamic membership (check all dynamic groups)
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return static_groups

        dynamic_groups = self.db.query(DeviceGroup).filter(
            DeviceGroup.is_dynamic == 1
        ).all()

        matching_dynamic = []
        for group in dynamic_groups:
            if group.rules:
                rules = json.loads(group.rules)
                if self._device_matches_rules(device, rules):
                    matching_dynamic.append(group)

        return static_groups + matching_dynamic


def get_device_group_service(db: Session) -> DeviceGroupService:
    """Get DeviceGroupService instance."""
    return DeviceGroupService(db)
