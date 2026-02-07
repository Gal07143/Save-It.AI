"""Virtual Meter API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import VirtualMeter, VirtualMeterComponent
from app.schemas import VirtualMeterCreate, VirtualMeterUpdate, VirtualMeterResponse

router = APIRouter(prefix="/api/v1/virtual-meters", tags=["virtual-meters"])


@router.get("", response_model=List[VirtualMeterResponse])
def list_virtual_meters(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List virtual meters."""
    query = db.query(VirtualMeter)
    if site_id:
        query = query.filter(VirtualMeter.site_id == site_id)
    return query.all()


@router.post("", response_model=VirtualMeterResponse)
def create_virtual_meter(vm: VirtualMeterCreate, db: Session = Depends(get_db)):
    """Create a virtual meter with components."""
    db_vm = VirtualMeter(
        site_id=vm.site_id,
        name=vm.name,
        description=vm.description,
        meter_type=vm.meter_type,
        expression=vm.expression,
        unit=vm.unit
    )
    db.add(db_vm)
    db.commit()
    
    for comp in vm.components:
        db_comp = VirtualMeterComponent(
            virtual_meter_id=db_vm.id,
            meter_id=comp.meter_id,
            weight=comp.weight,
            operator=comp.operator,
            allocation_percent=comp.allocation_percent
        )
        db.add(db_comp)
    
    db.commit()
    db.refresh(db_vm)
    return db_vm


@router.get("/{vm_id}", response_model=VirtualMeterResponse)
def get_virtual_meter(vm_id: int, db: Session = Depends(get_db)):
    """Get virtual meter by ID."""
    vm = db.query(VirtualMeter).filter(VirtualMeter.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="Virtual meter not found")
    return vm


@router.put("/{vm_id}", response_model=VirtualMeterResponse)
def update_virtual_meter(vm_id: int, update: VirtualMeterUpdate, db: Session = Depends(get_db)):
    """Update a virtual meter."""
    vm = db.query(VirtualMeter).filter(VirtualMeter.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="Virtual meter not found")

    update_data = update.model_dump(exclude_unset=True)
    components_data = update_data.pop("components", None)

    for key, value in update_data.items():
        setattr(vm, key, value)

    if components_data is not None:
        db.query(VirtualMeterComponent).filter(
            VirtualMeterComponent.virtual_meter_id == vm_id
        ).delete()
        for comp in components_data:
            db_comp = VirtualMeterComponent(
                virtual_meter_id=vm_id,
                meter_id=comp.get("meter_id"),
                weight=comp.get("weight", 1.0),
                operator=comp.get("operator", "+"),
                allocation_percent=comp.get("allocation_percent"),
            )
            db.add(db_comp)

    db.commit()
    db.refresh(vm)
    return vm


@router.delete("/{vm_id}")
def delete_virtual_meter(vm_id: int, db: Session = Depends(get_db)):
    """Delete a virtual meter and its components."""
    vm = db.query(VirtualMeter).filter(VirtualMeter.id == vm_id).first()
    if not vm:
        raise HTTPException(status_code=404, detail="Virtual meter not found")

    db.query(VirtualMeterComponent).filter(
        VirtualMeterComponent.virtual_meter_id == vm_id
    ).delete()
    db.delete(vm)
    db.commit()
    return {"message": "Virtual meter deleted"}
