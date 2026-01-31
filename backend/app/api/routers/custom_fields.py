"""
Custom Fields API Router for SAVE-IT.AI
Endpoints for dynamic custom field management.
"""
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.custom_field_service import (
    CustomFieldService,
    FieldType,
    EntityType,
    get_custom_field_service,
)

router = APIRouter(prefix="/custom-fields", tags=["custom-fields"])


class FieldDefinitionCreate(BaseModel):
    """Create custom field definition request."""
    entity_type: str
    name: str
    field_type: str
    label: str
    description: Optional[str] = None
    is_required: bool = False
    default_value: Optional[Any] = None
    validation_rules: Optional[dict] = None
    options: Optional[List[str]] = None  # For select/multi-select
    display_order: int = 0
    is_searchable: bool = False
    is_filterable: bool = False


class FieldDefinitionUpdate(BaseModel):
    """Update custom field definition request."""
    label: Optional[str] = None
    description: Optional[str] = None
    is_required: Optional[bool] = None
    default_value: Optional[Any] = None
    validation_rules: Optional[dict] = None
    options: Optional[List[str]] = None
    display_order: Optional[int] = None
    is_searchable: Optional[bool] = None
    is_filterable: Optional[bool] = None
    is_active: Optional[bool] = None


class FieldDefinitionResponse(BaseModel):
    """Custom field definition response."""
    id: int
    entity_type: str
    name: str
    field_type: str
    label: str
    description: Optional[str]
    is_required: bool
    default_value: Optional[Any]
    options: Optional[List[str]]
    display_order: int
    is_searchable: bool
    is_filterable: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FieldValueSet(BaseModel):
    """Set custom field value request."""
    value: Any


class FieldValueResponse(BaseModel):
    """Custom field value response."""
    field_id: int
    field_name: str
    field_label: str
    field_type: str
    value: Any
    updated_at: datetime


class BulkFieldValuesRequest(BaseModel):
    """Bulk set custom field values request."""
    values: dict  # field_name -> value


@router.post("/definitions", response_model=FieldDefinitionResponse)
def create_field_definition(
    request: FieldDefinitionCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Create a custom field definition."""
    service = get_custom_field_service(db)

    try:
        entity_type = EntityType(request.entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {request.entity_type}")

    try:
        field_type = FieldType(request.field_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid field type: {request.field_type}")

    try:
        definition = service.create_field_definition(
            organization_id=organization_id,
            entity_type=entity_type,
            name=request.name,
            field_type=field_type,
            label=request.label,
            description=request.description,
            is_required=request.is_required,
            default_value=request.default_value,
            validation_rules=request.validation_rules,
            options=request.options,
            display_order=request.display_order,
            is_searchable=request.is_searchable,
            is_filterable=request.is_filterable
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()

    import json
    return FieldDefinitionResponse(
        id=definition.id,
        entity_type=definition.entity_type,
        name=definition.name,
        field_type=definition.field_type,
        label=definition.label,
        description=definition.description,
        is_required=definition.is_required == 1,
        default_value=json.loads(definition.default_value) if definition.default_value else None,
        options=json.loads(definition.options) if definition.options else None,
        display_order=definition.display_order,
        is_searchable=definition.is_searchable == 1,
        is_filterable=definition.is_filterable == 1,
        is_active=definition.is_active == 1,
        created_at=definition.created_at
    )


@router.get("/definitions", response_model=List[FieldDefinitionResponse])
def list_field_definitions(
    entity_type: Optional[str] = None,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List custom field definitions."""
    service = get_custom_field_service(db)

    entity_type_filter = None
    if entity_type:
        try:
            entity_type_filter = EntityType(entity_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    definitions = service.get_field_definitions(organization_id, entity_type_filter)

    import json
    return [
        FieldDefinitionResponse(
            id=d.id,
            entity_type=d.entity_type,
            name=d.name,
            field_type=d.field_type,
            label=d.label,
            description=d.description,
            is_required=d.is_required == 1,
            default_value=json.loads(d.default_value) if d.default_value else None,
            options=json.loads(d.options) if d.options else None,
            display_order=d.display_order,
            is_searchable=d.is_searchable == 1,
            is_filterable=d.is_filterable == 1,
            is_active=d.is_active == 1,
            created_at=d.created_at
        )
        for d in definitions
    ]


@router.get("/definitions/{definition_id}", response_model=FieldDefinitionResponse)
def get_field_definition(
    definition_id: int,
    db: Session = Depends(get_db)
):
    """Get a custom field definition by ID."""
    service = get_custom_field_service(db)
    definition = service.get_field_definition(definition_id)

    if not definition:
        raise HTTPException(status_code=404, detail="Field definition not found")

    import json
    return FieldDefinitionResponse(
        id=definition.id,
        entity_type=definition.entity_type,
        name=definition.name,
        field_type=definition.field_type,
        label=definition.label,
        description=definition.description,
        is_required=definition.is_required == 1,
        default_value=json.loads(definition.default_value) if definition.default_value else None,
        options=json.loads(definition.options) if definition.options else None,
        display_order=definition.display_order,
        is_searchable=definition.is_searchable == 1,
        is_filterable=definition.is_filterable == 1,
        is_active=definition.is_active == 1,
        created_at=definition.created_at
    )


@router.patch("/definitions/{definition_id}", response_model=FieldDefinitionResponse)
def update_field_definition(
    definition_id: int,
    request: FieldDefinitionUpdate,
    db: Session = Depends(get_db)
):
    """Update a custom field definition."""
    service = get_custom_field_service(db)

    updates = request.model_dump(exclude_unset=True)
    definition = service.update_field_definition(definition_id, **updates)

    if not definition:
        raise HTTPException(status_code=404, detail="Field definition not found")

    db.commit()

    import json
    return FieldDefinitionResponse(
        id=definition.id,
        entity_type=definition.entity_type,
        name=definition.name,
        field_type=definition.field_type,
        label=definition.label,
        description=definition.description,
        is_required=definition.is_required == 1,
        default_value=json.loads(definition.default_value) if definition.default_value else None,
        options=json.loads(definition.options) if definition.options else None,
        display_order=definition.display_order,
        is_searchable=definition.is_searchable == 1,
        is_filterable=definition.is_filterable == 1,
        is_active=definition.is_active == 1,
        created_at=definition.created_at
    )


@router.delete("/definitions/{definition_id}")
def delete_field_definition(
    definition_id: int,
    db: Session = Depends(get_db)
):
    """Delete a custom field definition."""
    service = get_custom_field_service(db)

    if not service.delete_field_definition(definition_id):
        raise HTTPException(status_code=404, detail="Field definition not found")

    db.commit()

    return {"message": "Field definition deleted"}


# Field value endpoints
@router.get("/{entity_type}/{entity_id}/values", response_model=List[FieldValueResponse])
def get_entity_field_values(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db)
):
    """Get all custom field values for an entity."""
    service = get_custom_field_service(db)

    try:
        entity_type_enum = EntityType(entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    values = service.get_entity_values(entity_type_enum, entity_id)

    return [
        FieldValueResponse(
            field_id=v.field_id,
            field_name=v.field_name,
            field_label=v.field_label,
            field_type=v.field_type,
            value=v.value,
            updated_at=v.updated_at
        )
        for v in values
    ]


@router.put("/{entity_type}/{entity_id}/values/{field_name}", response_model=FieldValueResponse)
def set_field_value(
    entity_type: str,
    entity_id: int,
    field_name: str,
    request: FieldValueSet,
    db: Session = Depends(get_db)
):
    """Set a custom field value for an entity."""
    service = get_custom_field_service(db)

    try:
        entity_type_enum = EntityType(entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    try:
        value = service.set_field_value(
            entity_type=entity_type_enum,
            entity_id=entity_id,
            field_name=field_name,
            value=request.value
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()

    return FieldValueResponse(
        field_id=value.field_id,
        field_name=value.field_name,
        field_label=value.field_label,
        field_type=value.field_type,
        value=value.value,
        updated_at=value.updated_at
    )


@router.put("/{entity_type}/{entity_id}/values", response_model=List[FieldValueResponse])
def set_field_values_bulk(
    entity_type: str,
    entity_id: int,
    request: BulkFieldValuesRequest,
    db: Session = Depends(get_db)
):
    """Set multiple custom field values for an entity."""
    service = get_custom_field_service(db)

    try:
        entity_type_enum = EntityType(entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    try:
        values = service.set_field_values_bulk(
            entity_type=entity_type_enum,
            entity_id=entity_id,
            values=request.values
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()

    return [
        FieldValueResponse(
            field_id=v.field_id,
            field_name=v.field_name,
            field_label=v.field_label,
            field_type=v.field_type,
            value=v.value,
            updated_at=v.updated_at
        )
        for v in values
    ]


@router.delete("/{entity_type}/{entity_id}/values/{field_name}")
def delete_field_value(
    entity_type: str,
    entity_id: int,
    field_name: str,
    db: Session = Depends(get_db)
):
    """Delete a custom field value."""
    service = get_custom_field_service(db)

    try:
        entity_type_enum = EntityType(entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    if not service.delete_field_value(entity_type_enum, entity_id, field_name):
        raise HTTPException(status_code=404, detail="Field value not found")

    db.commit()

    return {"message": "Field value deleted"}


# Search and filter endpoints
@router.post("/search/{entity_type}")
def search_by_custom_fields(
    entity_type: str,
    filters: dict,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Search entities by custom field values."""
    service = get_custom_field_service(db)

    try:
        entity_type_enum = EntityType(entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    entity_ids = service.search_by_fields(organization_id, entity_type_enum, filters)

    return {"entity_type": entity_type, "entity_ids": entity_ids, "count": len(entity_ids)}


@router.get("/filterable/{entity_type}", response_model=List[FieldDefinitionResponse])
def get_filterable_fields(
    entity_type: str,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Get filterable custom fields for an entity type."""
    service = get_custom_field_service(db)

    try:
        entity_type_enum = EntityType(entity_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid entity type: {entity_type}")

    definitions = service.get_filterable_fields(organization_id, entity_type_enum)

    import json
    return [
        FieldDefinitionResponse(
            id=d.id,
            entity_type=d.entity_type,
            name=d.name,
            field_type=d.field_type,
            label=d.label,
            description=d.description,
            is_required=d.is_required == 1,
            default_value=json.loads(d.default_value) if d.default_value else None,
            options=json.loads(d.options) if d.options else None,
            display_order=d.display_order,
            is_searchable=d.is_searchable == 1,
            is_filterable=d.is_filterable == 1,
            is_active=d.is_active == 1,
            created_at=d.created_at
        )
        for d in definitions
    ]
