"""Bill API endpoints."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Bill, BillLineItem
from app.schemas import BillCreate, BillUpdate, BillResponse, BillValidationResult
from app.services.financial.bill_validation import BillValidationService

router = APIRouter(prefix="/api/v1/bills", tags=["bills"])


@router.get("", response_model=List[BillResponse])
def list_bills(
    site_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all bills, optionally filtered by site."""
    query = db.query(Bill)
    if site_id:
        query = query.filter(Bill.site_id == site_id)
    bills = query.order_by(Bill.period_start.desc()).offset(skip).limit(limit).all()
    return bills


@router.get("/{bill_id}", response_model=BillResponse)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    """Get a specific bill by ID."""
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


@router.post("", response_model=BillResponse)
def create_bill(bill: BillCreate, db: Session = Depends(get_db)):
    """Create a new bill."""
    bill_data = bill.model_dump(exclude={'line_items'})
    db_bill = Bill(**bill_data)
    db.add(db_bill)
    db.commit()
    db.refresh(db_bill)
    
    for item in bill.line_items:
        db_item = BillLineItem(bill_id=db_bill.id, **item.model_dump())
        db.add(db_item)
    
    db.commit()
    db.refresh(db_bill)
    return db_bill


@router.post("/parse", response_model=BillResponse)
def parse_bill_json(bill_data: Dict[str, Any], site_id: int, db: Session = Depends(get_db)):
    """Parse a bill from JSON input."""
    service = BillValidationService(db)
    bill = service.parse_bill_json(bill_data, site_id)
    return bill


@router.post("/{bill_id}/validate", response_model=BillValidationResult)
def validate_bill(bill_id: int, db: Session = Depends(get_db)):
    """Validate a bill against meter readings."""
    service = BillValidationService(db)
    try:
        result = service.validate_bill(bill_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{bill_id}", response_model=BillResponse)
def update_bill(bill_id: int, bill: BillUpdate, db: Session = Depends(get_db)):
    """Update a bill."""
    db_bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not db_bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    update_data = bill.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_bill, field, value)
    
    db.commit()
    db.refresh(db_bill)
    return db_bill


@router.delete("/{bill_id}")
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    """Delete a bill."""
    db_bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not db_bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    
    db.delete(db_bill)
    db.commit()
    return {"message": "Bill deleted successfully"}
