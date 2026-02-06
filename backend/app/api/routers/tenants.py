"""Tenant and Billing API endpoints."""
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Tenant, LeaseContract, Invoice
from app.schemas import (
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    LeaseContractCreate,
    LeaseContractResponse,
    InvoiceResponse,
)

router = APIRouter(prefix="/api/v1", tags=["tenants"])


@router.post("/tenants", response_model=TenantResponse)
def create_tenant(tenant: TenantCreate, db: Session = Depends(get_db)):
    """Create a new tenant for sub-billing."""
    db_tenant = Tenant(**tenant.model_dump())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant


@router.get("/tenants", response_model=List[TenantResponse])
def list_tenants(
    site_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all tenants, optionally filtered by site."""
    query = db.query(Tenant)
    if site_id:
        query = query.filter(Tenant.site_id == site_id)
    return query.offset(skip).limit(limit).all()


@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: int, db: Session = Depends(get_db)):
    """Get tenant by ID."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.put("/tenants/{tenant_id}", response_model=TenantResponse)
def update_tenant(tenant_id: int, tenant_update: TenantUpdate, db: Session = Depends(get_db)):
    """Update a tenant."""
    db_tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = tenant_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_tenant, field, value)

    db.commit()
    db.refresh(db_tenant)
    return db_tenant


@router.delete("/tenants/{tenant_id}")
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    """Delete a tenant."""
    db_tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Check for active contracts
    active_contracts = db.query(LeaseContract).filter(
        LeaseContract.tenant_id == tenant_id,
        LeaseContract.is_active == 1
    ).count()

    if active_contracts > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete tenant with {active_contracts} active contract(s)"
        )

    db.delete(db_tenant)
    db.commit()
    return {"message": "Tenant deleted successfully"}


@router.post("/lease-contracts", response_model=LeaseContractResponse)
def create_lease_contract(contract: LeaseContractCreate, db: Session = Depends(get_db)):
    """Create a new lease contract for a tenant."""
    db_contract = LeaseContract(**contract.model_dump())
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract


@router.get("/tenants/{tenant_id}/contracts", response_model=List[LeaseContractResponse])
def list_tenant_contracts(tenant_id: int, db: Session = Depends(get_db)):
    """List all lease contracts for a tenant."""
    return db.query(LeaseContract).filter(LeaseContract.tenant_id == tenant_id).all()


@router.post("/tenants/{tenant_id}/generate-invoice", response_model=InvoiceResponse)
def generate_tenant_invoice(
    tenant_id: int,
    billing_start: date,
    billing_end: date,
    tax_rate: float = 0.0,
    db: Session = Depends(get_db)
):
    """Generate a monthly invoice for a tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    contracts = db.query(LeaseContract).filter(
        LeaseContract.tenant_id == tenant_id,
        LeaseContract.is_active == 1
    ).all()
    
    if not contracts:
        raise HTTPException(status_code=400, detail="No active contracts found for tenant")
    
    from datetime import datetime
    import secrets
    
    invoice_number = f"INV-{datetime.now().strftime('%Y%m')}-{secrets.token_hex(4).upper()}"
    
    total_energy_charge = 0.0
    total_fixed_fee = 0.0
    
    for contract in contracts:
        total_fixed_fee += contract.fixed_monthly_fee or 0
        total_energy_charge += 1000 * (contract.rate_per_kwh or 0.10)
    
    subtotal = total_energy_charge + total_fixed_fee
    tax_amount = subtotal * tax_rate
    total_amount = subtotal + tax_amount
    
    from app.models import InvoiceStatus
    
    invoice = Invoice(
        tenant_id=tenant_id,
        lease_contract_id=contracts[0].id if contracts else None,
        invoice_number=invoice_number,
        billing_period_start=billing_start,
        billing_period_end=billing_end,
        consumption_kwh=1000,
        energy_charge=total_energy_charge,
        fixed_fee=total_fixed_fee,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        status=InvoiceStatus.PENDING,
        due_date=billing_end
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    
    return invoice


@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    tenant_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all invoices, optionally filtered by tenant."""
    query = db.query(Invoice)
    if tenant_id:
        query = query.filter(Invoice.tenant_id == tenant_id)
    return query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Get invoice by ID."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice
