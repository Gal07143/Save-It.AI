"""
Policies Router for SAVE-IT.AI
CRUD operations for device communication policies.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.devices import DevicePolicy, Device
from backend.app.schemas.devices import (
    DevicePolicyCreate, DevicePolicyUpdate, DevicePolicyResponse,
)

router = APIRouter(prefix="/api/v1/policies", tags=["Policies"])


@router.get("", response_model=List[DevicePolicyResponse])
def list_policies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_active: Optional[bool] = True,
    db: Session = Depends(get_db),
):
    """List all device policies."""
    query = db.query(DevicePolicy)
    if is_active is not None:
        query = query.filter(DevicePolicy.is_active == (1 if is_active else 0))
    
    policies = query.order_by(DevicePolicy.name).offset(skip).limit(limit).all()
    return policies


@router.post("", response_model=DevicePolicyResponse, status_code=201)
def create_policy(
    policy_data: DevicePolicyCreate,
    db: Session = Depends(get_db),
):
    """Create a new device policy."""
    existing = db.query(DevicePolicy).filter(DevicePolicy.name == policy_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Policy with this name already exists")
    
    policy = DevicePolicy(
        name=policy_data.name,
        description=policy_data.description,
        allow_telemetry=1 if policy_data.allow_telemetry else 0,
        allow_events=1 if policy_data.allow_events else 0,
        allow_commands=1 if policy_data.allow_commands else 0,
        allow_config=1 if policy_data.allow_config else 0,
        allow_firmware=1 if policy_data.allow_firmware else 0,
        max_message_size_kb=policy_data.max_message_size_kb,
        max_messages_per_minute=policy_data.max_messages_per_minute,
        is_system_policy=0,
        is_active=1,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/{policy_id}", response_model=DevicePolicyResponse)
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
):
    """Get a policy by ID."""
    policy = db.query(DevicePolicy).filter(DevicePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.patch("/{policy_id}", response_model=DevicePolicyResponse)
def update_policy(
    policy_id: int,
    policy_data: DevicePolicyUpdate,
    db: Session = Depends(get_db),
):
    """Update a policy."""
    policy = db.query(DevicePolicy).filter(DevicePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if policy.is_system_policy:
        raise HTTPException(status_code=400, detail="Cannot modify system policy")
    
    update_data = policy_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field in ["is_active", "allow_telemetry", "allow_events", "allow_commands", "allow_config", "allow_firmware"]:
            value = 1 if value else 0
        setattr(policy, field, value)
    
    db.commit()
    db.refresh(policy)
    return policy


@router.delete("/{policy_id}", status_code=204)
def delete_policy(
    policy_id: int,
    db: Session = Depends(get_db),
):
    """Delete a policy (soft delete by deactivating)."""
    policy = db.query(DevicePolicy).filter(DevicePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    if policy.is_system_policy:
        raise HTTPException(status_code=400, detail="Cannot delete system policy")
    
    device_count = db.query(Device).filter(Device.policy_id == policy_id, Device.is_active == 1).count()
    if device_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete policy with {device_count} active devices")
    
    policy.is_active = 0
    db.commit()
    return None


@router.get("/{policy_id}/devices", response_model=List[dict])
def get_policy_devices(
    policy_id: int,
    db: Session = Depends(get_db),
):
    """Get devices using a policy."""
    policy = db.query(DevicePolicy).filter(DevicePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    devices = db.query(Device).filter(
        Device.policy_id == policy_id,
        Device.is_active == 1
    ).all()
    
    return [
        {
            "id": d.id,
            "name": d.name,
            "device_type": d.device_type.value if d.device_type else None,
            "is_online": bool(d.is_online),
        }
        for d in devices
    ]
