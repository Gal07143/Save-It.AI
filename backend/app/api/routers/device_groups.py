"""
Device Groups API Router for SAVE-IT.AI
Endpoints for device grouping and bulk operations.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.device_group_service import (
    DeviceGroupService,
    get_device_group_service,
)

router = APIRouter(prefix="/device-groups", tags=["device-groups"])


class GroupCreate(BaseModel):
    """Create device group request."""
    name: str
    description: Optional[str] = None
    site_id: Optional[int] = None
    is_dynamic: bool = False
    rules: Optional[List[dict]] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class GroupUpdate(BaseModel):
    """Update device group request."""
    name: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[List[dict]] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_dynamic: Optional[bool] = None


class GroupResponse(BaseModel):
    """Device group response."""
    id: int
    name: str
    description: Optional[str]
    is_dynamic: bool
    site_id: Optional[int]
    color: Optional[str]
    icon: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class GroupStatsResponse(BaseModel):
    """Group statistics response."""
    group_id: int
    total_devices: int
    online_devices: int
    offline_devices: int
    devices_with_alarms: int
    avg_uptime_percent: float


class DeviceMembership(BaseModel):
    """Device membership request."""
    device_ids: List[int]


class BulkUpdateRequest(BaseModel):
    """Bulk update request."""
    updates: dict


class BulkCommandRequest(BaseModel):
    """Bulk command request."""
    command: str
    params: Optional[dict] = None


class BulkOperationResponse(BaseModel):
    """Bulk operation response."""
    operation: str
    total_devices: int
    successful: int
    failed: int
    errors: List[dict]


@router.post("", response_model=GroupResponse)
def create_group(
    request: GroupCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1,  # Would come from auth
    user_id: int = 1
):
    """Create a new device group."""
    service = get_device_group_service(db)

    group = service.create_group(
        organization_id=organization_id,
        name=request.name,
        description=request.description,
        site_id=request.site_id,
        is_dynamic=request.is_dynamic,
        rules=request.rules,
        created_by=user_id,
        color=request.color,
        icon=request.icon
    )

    db.commit()

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_dynamic=group.is_dynamic == 1,
        site_id=group.site_id,
        color=group.color,
        icon=group.icon,
        created_at=group.created_at
    )


@router.get("", response_model=List[GroupResponse])
def list_groups(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List all device groups."""
    service = get_device_group_service(db)
    groups = service.get_groups(organization_id, site_id)

    return [
        GroupResponse(
            id=g.id,
            name=g.name,
            description=g.description,
            is_dynamic=g.is_dynamic == 1,
            site_id=g.site_id,
            color=g.color,
            icon=g.icon,
            created_at=g.created_at
        )
        for g in groups
    ]


@router.get("/{group_id}", response_model=GroupResponse)
def get_group(
    group_id: int,
    db: Session = Depends(get_db)
):
    """Get a device group by ID."""
    from app.services.device_group_service import DeviceGroup

    group = db.query(DeviceGroup).filter(DeviceGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_dynamic=group.is_dynamic == 1,
        site_id=group.site_id,
        color=group.color,
        icon=group.icon,
        created_at=group.created_at
    )


@router.patch("/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    request: GroupUpdate,
    db: Session = Depends(get_db)
):
    """Update a device group."""
    service = get_device_group_service(db)

    updates = request.model_dump(exclude_unset=True)
    group = service.update_group(group_id, **updates)

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.commit()

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_dynamic=group.is_dynamic == 1,
        site_id=group.site_id,
        color=group.color,
        icon=group.icon,
        created_at=group.created_at
    )


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db)
):
    """Delete a device group."""
    service = get_device_group_service(db)

    if not service.delete_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    db.commit()

    return {"message": "Group deleted"}


@router.get("/{group_id}/devices")
def get_group_devices(
    group_id: int,
    include_offline: bool = True,
    db: Session = Depends(get_db)
):
    """Get all devices in a group."""
    service = get_device_group_service(db)
    devices = service.get_devices(group_id, include_offline)

    return [
        {
            "id": d.id,
            "name": d.name,
            "device_type": d.device_type.value if d.device_type else None,
            "is_online": d.is_online == 1,
            "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None
        }
        for d in devices
    ]


@router.post("/{group_id}/devices")
def add_devices_to_group(
    group_id: int,
    request: DeviceMembership,
    db: Session = Depends(get_db)
):
    """Add devices to a group."""
    service = get_device_group_service(db)
    added = service.add_devices(group_id, request.device_ids)

    db.commit()

    return {"added": added}


@router.delete("/{group_id}/devices")
def remove_devices_from_group(
    group_id: int,
    request: DeviceMembership,
    db: Session = Depends(get_db)
):
    """Remove devices from a group."""
    service = get_device_group_service(db)
    removed = service.remove_devices(group_id, request.device_ids)

    db.commit()

    return {"removed": removed}


@router.get("/{group_id}/stats", response_model=GroupStatsResponse)
def get_group_stats(
    group_id: int,
    db: Session = Depends(get_db)
):
    """Get group statistics."""
    service = get_device_group_service(db)
    stats = service.get_statistics(group_id)

    if not stats:
        raise HTTPException(status_code=404, detail="Group not found")

    return GroupStatsResponse(
        group_id=stats.group_id,
        total_devices=stats.total_devices,
        online_devices=stats.online_devices,
        offline_devices=stats.offline_devices,
        devices_with_alarms=stats.devices_with_alarms,
        avg_uptime_percent=stats.avg_uptime_percent
    )


@router.post("/{group_id}/bulk-update", response_model=BulkOperationResponse)
def bulk_update_devices(
    group_id: int,
    request: BulkUpdateRequest,
    db: Session = Depends(get_db)
):
    """Perform bulk update on all devices in group."""
    service = get_device_group_service(db)
    result = service.bulk_update(group_id, request.updates)

    db.commit()

    return BulkOperationResponse(
        operation=result.operation,
        total_devices=result.total_devices,
        successful=result.successful,
        failed=result.failed,
        errors=result.errors
    )


@router.post("/{group_id}/bulk-command", response_model=BulkOperationResponse)
def bulk_command_devices(
    group_id: int,
    request: BulkCommandRequest,
    db: Session = Depends(get_db)
):
    """Send command to all devices in group."""
    service = get_device_group_service(db)
    result = service.bulk_command(group_id, request.command, request.params)

    db.commit()

    return BulkOperationResponse(
        operation=result.operation,
        total_devices=result.total_devices,
        successful=result.successful,
        failed=result.failed,
        errors=result.errors
    )
