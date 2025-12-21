"""Data Source Integration API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import DataSource
from backend.app.schemas import DataSourceCreate, DataSourceResponse

router = APIRouter(prefix="/api/v1/data-sources", tags=["integrations"])


@router.post("", response_model=DataSourceResponse)
def create_data_source(source: DataSourceCreate, db: Session = Depends(get_db)):
    """Create a new data source for meter integration."""
    db_source = DataSource(**source.model_dump())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


@router.get("", response_model=List[DataSourceResponse])
def list_data_sources(
    site_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List all data sources, optionally filtered by site."""
    query = db.query(DataSource)
    if site_id:
        query = query.filter(DataSource.site_id == site_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{source_id}", response_model=DataSourceResponse)
def get_data_source(source_id: int, db: Session = Depends(get_db)):
    """Get data source by ID."""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    return source
