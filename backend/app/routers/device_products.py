"""
Device Products Router for SAVE-IT.AI
CRUD operations for device products (manufacturer catalog).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.devices import DeviceProduct, ProductRegisterMapping, DeviceType
from app.schemas.devices import (
    DeviceProductCreate, DeviceProductUpdate, DeviceProductResponse,
    ProductRegisterMappingCreate, ProductRegisterMappingResponse,
)

router = APIRouter(prefix="/api/v1/device-products", tags=["Device Products"])


@router.get("", response_model=List[DeviceProductResponse])
def list_device_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    manufacturer: Optional[str] = None,
    device_type: Optional[str] = None,
    protocol: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """List all device products with optional filtering."""
    query = db.query(DeviceProduct)
    
    if manufacturer:
        query = query.filter(DeviceProduct.manufacturer.ilike(f"%{manufacturer}%"))
    if device_type:
        try:
            dt = DeviceType(device_type)
            query = query.filter(DeviceProduct.device_type == dt)
        except ValueError:
            pass
    if protocol:
        query = query.filter(DeviceProduct.protocol == protocol)
    if is_active is not None:
        query = query.filter(DeviceProduct.is_active == (1 if is_active else 0))
    
    products = query.order_by(DeviceProduct.manufacturer, DeviceProduct.name).offset(skip).limit(limit).all()
    return products


@router.post("", response_model=DeviceProductResponse, status_code=201)
def create_device_product(
    product_data: DeviceProductCreate,
    db: Session = Depends(get_db),
):
    """Create a new device product."""
    existing = db.query(DeviceProduct).filter(
        DeviceProduct.manufacturer == product_data.manufacturer,
        DeviceProduct.model_number == product_data.model_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Product with this manufacturer/model already exists")
    
    product = DeviceProduct(
        **product_data.model_dump(),
        is_active=1,
        is_verified=0,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=DeviceProductResponse)
def get_device_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    """Get a device product by ID."""
    product = db.query(DeviceProduct).filter(DeviceProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Device product not found")
    return product


@router.patch("/{product_id}", response_model=DeviceProductResponse)
def update_device_product(
    product_id: int,
    product_data: DeviceProductUpdate,
    db: Session = Depends(get_db),
):
    """Update a device product."""
    product = db.query(DeviceProduct).filter(DeviceProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Device product not found")
    
    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "is_active":
            value = 1 if value else 0
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
def delete_device_product(
    product_id: int,
    db: Session = Depends(get_db),
):
    """Delete a device product (soft delete by deactivating)."""
    product = db.query(DeviceProduct).filter(DeviceProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Device product not found")
    
    product.is_active = 0
    db.commit()
    return None


@router.get("/{product_id}/register-mappings", response_model=List[ProductRegisterMappingResponse])
def list_product_register_mappings(
    product_id: int,
    db: Session = Depends(get_db),
):
    """List all register mappings for a device product."""
    mappings = db.query(ProductRegisterMapping).filter(
        ProductRegisterMapping.product_id == product_id
    ).order_by(ProductRegisterMapping.register_address).all()
    return mappings


@router.post("/{product_id}/register-mappings", response_model=ProductRegisterMappingResponse, status_code=201)
def create_register_mapping(
    product_id: int,
    mapping_data: ProductRegisterMappingCreate,
    db: Session = Depends(get_db),
):
    """Create a new register mapping for a device product."""
    product = db.query(DeviceProduct).filter(DeviceProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Device product not found")
    
    mapping = ProductRegisterMapping(
        product_id=product_id,
        **mapping_data.model_dump(exclude={"product_id"})
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@router.delete("/register-mappings/{mapping_id}", status_code=204)
def delete_register_mapping(
    mapping_id: int,
    db: Session = Depends(get_db),
):
    """Delete a register mapping."""
    mapping = db.query(ProductRegisterMapping).filter(ProductRegisterMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Register mapping not found")
    
    db.delete(mapping)
    db.commit()
    return None


@router.get("/manufacturers/list", response_model=List[str])
def list_manufacturers(
    db: Session = Depends(get_db),
):
    """List all unique manufacturers."""
    manufacturers = db.query(DeviceProduct.manufacturer).distinct().all()
    return [m[0] for m in manufacturers if m[0]]


@router.get("/protocols/list", response_model=List[str])
def list_protocols(
    db: Session = Depends(get_db),
):
    """List all unique protocols."""
    protocols = db.query(DeviceProduct.protocol).distinct().all()
    return [p[0] for p in protocols if p[0]]
