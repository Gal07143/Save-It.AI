"""Virtual Meter API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import VirtualMeter, VirtualMeterComponent
from backend.app.schemas import VirtualMeterCreate, VirtualMeterResponse

router = APIRouter(prefix="/api/v1/virtual-meters", tags=["virtual-meters"])


@router.get("/", response_model=List[VirtualMeterResponse])
def list_virtual_meters(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List virtual meters."""
    query = db.query(VirtualMeter)
    if site_id:
        query = query.filter(VirtualMeter.site_id == site_id)
    return query.all()


@router.post("/", response_model=VirtualMeterResponse)
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
