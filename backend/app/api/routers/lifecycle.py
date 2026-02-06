"""
Device Lifecycle API Router for SAVE-IT.AI
Endpoints for device lifecycle management.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.lifecycle_service import (
    LifecycleService,
    LifecycleState,
    get_lifecycle_service,
)

router = APIRouter(prefix="/lifecycle", tags=["lifecycle"])


class ProvisionRequest(BaseModel):
    """Device provisioning request."""
    asset_tag: Optional[str] = None
    purchase_date: Optional[datetime] = None
    vendor: Optional[str] = None
    cost: Optional[int] = None
    expected_lifespan_years: Optional[int] = None


class CommissionRequest(BaseModel):
    """Device commissioning request."""
    site_id: int
    location_description: Optional[str] = None
    installation_notes: Optional[str] = None


class DecommissionRequest(BaseModel):
    """Device decommissioning request."""
    reason: str
    work_order_id: Optional[int] = None


class ReplaceRequest(BaseModel):
    """Device replacement request."""
    new_device_id: int
    reason: str
    transfer_config: bool = True


class MaintenanceModeRequest(BaseModel):
    """Maintenance mode request."""
    enabled: bool
    reason: Optional[str] = None
    work_order_id: Optional[int] = None


class WarrantyCreate(BaseModel):
    """Add warranty request."""
    warranty_type: str
    start_date: datetime
    end_date: datetime
    provider: Optional[str] = None
    contract_number: Optional[str] = None
    coverage_details: Optional[dict] = None


class ProvisioningResponse(BaseModel):
    """Provisioning result response."""
    device_id: int
    success: bool
    state: str
    credentials: Optional[dict] = None
    error: Optional[str] = None


class LifecycleInfoResponse(BaseModel):
    """Device lifecycle info response."""
    device_id: int
    lifecycle_state: str
    purchase_date: Optional[datetime]
    provisioned_date: Optional[datetime]
    commissioned_date: Optional[datetime]
    decommissioned_date: Optional[datetime]
    asset_tag: Optional[str]
    end_of_life_date: Optional[datetime]


class WarrantyStatusResponse(BaseModel):
    """Warranty status response."""
    device_id: int
    has_active_warranty: bool
    active_warranties: List[dict]
    expired_count: int


class LifecycleReportResponse(BaseModel):
    """Lifecycle report response."""
    device_id: int
    device_name: str
    current_state: str
    age_days: int
    warranty_status: str
    end_of_life_days: Optional[int]
    total_transitions: int
    maintenance_count: int


class TransitionResponse(BaseModel):
    """Lifecycle transition response."""
    id: int
    device_id: int
    from_state: Optional[str]
    to_state: str
    reason: Optional[str]
    performed_by: Optional[int]
    performed_at: datetime

    class Config:
        from_attributes = True


@router.post("/devices/{device_id}/provision", response_model=ProvisioningResponse)
def provision_device(
    device_id: int,
    request: ProvisionRequest,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Provision a device for deployment."""
    service = get_lifecycle_service(db)

    result = service.provision_device(
        device_id=device_id,
        asset_tag=request.asset_tag,
        performed_by=user_id,
        purchase_date=request.purchase_date,
        vendor=request.vendor,
        cost=request.cost,
        expected_lifespan_years=request.expected_lifespan_years
    )

    db.commit()

    return ProvisioningResponse(
        device_id=result.device_id,
        success=result.success,
        state=result.state,
        credentials=result.credentials,
        error=result.error
    )


@router.post("/devices/{device_id}/commission")
def commission_device(
    device_id: int,
    request: CommissionRequest,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Commission a device (put into active service)."""
    service = get_lifecycle_service(db)

    try:
        success = service.commission_device(
            device_id=device_id,
            site_id=request.site_id,
            location_description=request.location_description,
            installation_notes=request.installation_notes,
            performed_by=user_id
        )

        db.commit()

        return {"success": success, "state": LifecycleState.COMMISSIONED.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/devices/{device_id}/decommission")
def decommission_device(
    device_id: int,
    request: DecommissionRequest,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Decommission a device (remove from service)."""
    service = get_lifecycle_service(db)

    try:
        success = service.decommission_device(
            device_id=device_id,
            reason=request.reason,
            performed_by=user_id,
            work_order_id=request.work_order_id
        )

        db.commit()

        return {"success": success, "state": LifecycleState.DECOMMISSIONED.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/devices/{device_id}/replace")
def replace_device(
    device_id: int,
    request: ReplaceRequest,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Replace a device with another."""
    service = get_lifecycle_service(db)

    success = service.replace_device(
        old_device_id=device_id,
        new_device_id=request.new_device_id,
        reason=request.reason,
        transfer_config=request.transfer_config,
        performed_by=user_id
    )

    if not success:
        raise HTTPException(status_code=400, detail="Device replacement failed")

    db.commit()

    return {
        "success": True,
        "old_device_state": LifecycleState.REPLACED.value,
        "new_device_state": LifecycleState.COMMISSIONED.value
    }


@router.post("/devices/{device_id}/maintenance-mode")
def set_maintenance_mode(
    device_id: int,
    request: MaintenanceModeRequest,
    db: Session = Depends(get_db),
    user_id: int = 1
):
    """Put device into or out of maintenance mode."""
    service = get_lifecycle_service(db)

    try:
        success = service.set_maintenance_mode(
            device_id=device_id,
            enabled=request.enabled,
            reason=request.reason,
            performed_by=user_id,
            work_order_id=request.work_order_id
        )

        db.commit()

        new_state = LifecycleState.MAINTENANCE if request.enabled else LifecycleState.COMMISSIONED
        return {"success": success, "state": new_state.value}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/devices/{device_id}", response_model=LifecycleInfoResponse)
def get_lifecycle_info(
    device_id: int,
    db: Session = Depends(get_db)
):
    """Get device lifecycle information."""
    from app.services.lifecycle_service import DeviceLifecycleInfo

    info = db.query(DeviceLifecycleInfo).filter(
        DeviceLifecycleInfo.device_id == device_id
    ).first()

    if not info:
        # Return default for devices without lifecycle info
        return LifecycleInfoResponse(
            device_id=device_id,
            lifecycle_state=LifecycleState.INVENTORY.value,
            purchase_date=None,
            provisioned_date=None,
            commissioned_date=None,
            decommissioned_date=None,
            asset_tag=None,
            end_of_life_date=None
        )

    return LifecycleInfoResponse(
        device_id=info.device_id,
        lifecycle_state=info.lifecycle_state,
        purchase_date=info.purchase_date,
        provisioned_date=info.provisioned_date,
        commissioned_date=info.commissioned_date,
        decommissioned_date=info.decommissioned_date,
        asset_tag=info.asset_tag,
        end_of_life_date=info.end_of_life_date
    )


@router.get("/devices/{device_id}/report", response_model=LifecycleReportResponse)
def get_lifecycle_report(
    device_id: int,
    db: Session = Depends(get_db)
):
    """Get comprehensive lifecycle report for a device."""
    service = get_lifecycle_service(db)
    report = service.get_lifecycle_report(device_id)

    if not report:
        raise HTTPException(status_code=404, detail="Device not found")

    return LifecycleReportResponse(
        device_id=report.device_id,
        device_name=report.device_name,
        current_state=report.current_state,
        age_days=report.age_days,
        warranty_status=report.warranty_status,
        end_of_life_days=report.end_of_life_days,
        total_transitions=report.total_transitions,
        maintenance_count=report.maintenance_count
    )


@router.get("/devices/{device_id}/transitions", response_model=List[TransitionResponse])
def get_transition_history(
    device_id: int,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get device lifecycle transition history."""
    service = get_lifecycle_service(db)
    transitions = service.get_transition_history(device_id, limit)

    return [
        TransitionResponse(
            id=t.id,
            device_id=t.device_id,
            from_state=t.from_state,
            to_state=t.to_state,
            reason=t.reason,
            performed_by=t.performed_by,
            performed_at=t.performed_at
        )
        for t in transitions
    ]


# Warranty endpoints
@router.post("/devices/{device_id}/warranties")
def add_warranty(
    device_id: int,
    request: WarrantyCreate,
    db: Session = Depends(get_db)
):
    """Add warranty information for a device."""
    service = get_lifecycle_service(db)

    warranty = service.add_warranty(
        device_id=device_id,
        warranty_type=request.warranty_type,
        start_date=request.start_date,
        end_date=request.end_date,
        provider=request.provider,
        contract_number=request.contract_number,
        coverage_details=request.coverage_details
    )

    db.commit()

    return {
        "id": warranty.id,
        "device_id": warranty.device_id,
        "warranty_type": warranty.warranty_type,
        "end_date": warranty.end_date.isoformat()
    }


@router.get("/devices/{device_id}/warranty", response_model=WarrantyStatusResponse)
def get_warranty_status(
    device_id: int,
    db: Session = Depends(get_db)
):
    """Get warranty status for a device."""
    service = get_lifecycle_service(db)
    status = service.get_warranty_status(device_id)

    return WarrantyStatusResponse(
        device_id=status["device_id"],
        has_active_warranty=status["has_active_warranty"],
        active_warranties=status["active_warranties"],
        expired_count=status["expired_count"]
    )


# EOL and warranty alerts
@router.get("/alerts/eol")
def get_devices_approaching_eol(
    days_ahead: int = 90,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Get devices approaching end of life."""
    service = get_lifecycle_service(db)
    devices = service.get_devices_approaching_eol(organization_id, days_ahead)

    return [
        {
            "device_id": d.id,
            "name": d.name,
            "device_type": d.device_type.value if d.device_type else None
        }
        for d in devices
    ]


@router.get("/alerts/warranty")
def get_devices_with_expiring_warranty(
    days_ahead: int = 30,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Get devices with warranties expiring soon."""
    service = get_lifecycle_service(db)
    devices = service.get_devices_with_expiring_warranty(organization_id, days_ahead)

    return devices
