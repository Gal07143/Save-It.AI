"""
Custom Field Service for SAVE-IT.AI
Dynamic custom field management:
- Field definitions per entity type
- Field value storage
- Validation rules
- Search and filtering
"""
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index

from app.core.database import Base

logger = logging.getLogger(__name__)


class FieldType(Enum):
    """Custom field data types."""
    STRING = "string"
    TEXT = "text"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    SELECT = "select"           # Single select from options
    MULTISELECT = "multiselect" # Multiple select
    URL = "url"
    EMAIL = "email"
    PHONE = "phone"
    JSON = "json"
    REFERENCE = "reference"     # Reference to another entity


class EntityType(Enum):
    """Entity types that support custom fields."""
    DEVICE = "device"
    SITE = "site"
    USER = "user"
    ORGANIZATION = "organization"
    METER = "meter"
    GATEWAY = "gateway"
    ALARM = "alarm"
    ASSET = "asset"


class CustomFieldDefinition(Base):
    """Custom field definition."""
    __tablename__ = "custom_field_definitions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)

    entity_type = Column(String(50), nullable=False, index=True)  # device, site, user, etc.
    field_key = Column(String(100), nullable=False)  # Internal key
    field_name = Column(String(255), nullable=False)  # Display name
    field_type = Column(String(30), nullable=False)

    description = Column(Text, nullable=True)
    placeholder = Column(String(255), nullable=True)
    default_value = Column(Text, nullable=True)

    # Options for select/multiselect
    options = Column(Text, nullable=True)  # JSON array

    # Validation
    is_required = Column(Integer, default=0)
    min_length = Column(Integer, nullable=True)
    max_length = Column(Integer, nullable=True)
    min_value = Column(Integer, nullable=True)
    max_value = Column(Integer, nullable=True)
    regex_pattern = Column(String(500), nullable=True)
    validation_message = Column(String(500), nullable=True)

    # Reference field config
    reference_entity_type = Column(String(50), nullable=True)

    # Display
    display_order = Column(Integer, default=0)
    is_searchable = Column(Integer, default=0)
    is_filterable = Column(Integer, default=0)
    show_in_list = Column(Integer, default=0)
    group_name = Column(String(100), nullable=True)  # For grouping fields

    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_custom_field_def_org_entity', 'organization_id', 'entity_type'),
        Index('ix_custom_field_def_unique', 'organization_id', 'entity_type', 'field_key', unique=True),
    )


class CustomFieldValue(Base):
    """Custom field value storage."""
    __tablename__ = "custom_field_values"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("custom_field_definitions.id", ondelete="CASCADE"), nullable=False, index=True)

    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)

    # Value storage (all types stored as text, converted on read)
    value_text = Column(Text, nullable=True)
    value_int = Column(Integer, nullable=True)
    value_float = Column(Integer, nullable=True)  # Stored as cents/milliunits
    value_bool = Column(Integer, nullable=True)
    value_date = Column(DateTime, nullable=True)
    value_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('ix_custom_field_value_entity', 'entity_type', 'entity_id'),
        Index('ix_custom_field_value_unique', 'field_id', 'entity_type', 'entity_id', unique=True),
    )


@dataclass
class FieldValidationResult:
    """Result of field validation."""
    valid: bool
    field_key: str
    message: Optional[str] = None


@dataclass
class CustomFieldData:
    """Custom field with its value."""
    field_id: int
    field_key: str
    field_name: str
    field_type: FieldType
    value: Any
    options: Optional[List[str]] = None
    is_required: bool = False


class CustomFieldService:
    """
    Custom field management service.
    Allows dynamic extension of entities with custom fields.
    """

    def __init__(self, db: Session):
        self.db = db

    def create_field(
        self,
        organization_id: int,
        entity_type: str,
        field_key: str,
        field_name: str,
        field_type: FieldType,
        options: Optional[List[str]] = None,
        is_required: bool = False,
        default_value: Optional[Any] = None,
        **kwargs
    ) -> CustomFieldDefinition:
        """
        Create a custom field definition.

        Args:
            organization_id: Organization ID
            entity_type: Type of entity (device, site, user, etc.)
            field_key: Internal field key
            field_name: Display name
            field_type: Data type
            options: Options for select fields
            is_required: Whether field is required
            default_value: Default value

        Returns:
            Created CustomFieldDefinition
        """
        # Check for existing
        existing = self.db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.organization_id == organization_id,
            CustomFieldDefinition.entity_type == entity_type,
            CustomFieldDefinition.field_key == field_key
        ).first()

        if existing:
            raise ValueError(f"Field '{field_key}' already exists for {entity_type}")

        field = CustomFieldDefinition(
            organization_id=organization_id,
            entity_type=entity_type,
            field_key=field_key,
            field_name=field_name,
            field_type=field_type.value,
            options=json.dumps(options) if options else None,
            is_required=1 if is_required else 0,
            default_value=json.dumps(default_value) if default_value is not None else None,
            **kwargs
        )

        self.db.add(field)
        self.db.flush()

        logger.info(f"Created custom field: {field_key} for {entity_type} (ID: {field.id})")

        return field

    def update_field(
        self,
        field_id: int,
        **updates
    ) -> Optional[CustomFieldDefinition]:
        """Update a custom field definition."""
        field = self.db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.id == field_id
        ).first()

        if not field:
            return None

        for key, value in updates.items():
            if hasattr(field, key) and key not in ['id', 'created_at', 'organization_id']:
                if key == 'options' and value is not None:
                    value = json.dumps(value)
                elif key == 'default_value' and value is not None:
                    value = json.dumps(value)
                setattr(field, key, value)

        return field

    def delete_field(self, field_id: int) -> bool:
        """Delete a custom field and all its values."""
        field = self.db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.id == field_id
        ).first()

        if not field:
            return False

        # Delete all values
        self.db.query(CustomFieldValue).filter(
            CustomFieldValue.field_id == field_id
        ).delete()

        self.db.delete(field)

        return True

    def get_fields(
        self,
        organization_id: int,
        entity_type: str,
        include_inactive: bool = False
    ) -> List[CustomFieldDefinition]:
        """Get all custom fields for an entity type."""
        query = self.db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.organization_id == organization_id,
            CustomFieldDefinition.entity_type == entity_type
        )

        if not include_inactive:
            query = query.filter(CustomFieldDefinition.is_active == 1)

        return query.order_by(CustomFieldDefinition.display_order).all()

    def set_value(
        self,
        field_id: int,
        entity_type: str,
        entity_id: int,
        value: Any
    ) -> CustomFieldValue:
        """
        Set a custom field value for an entity.

        Args:
            field_id: Field definition ID
            entity_type: Entity type
            entity_id: Entity ID
            value: Value to set

        Returns:
            CustomFieldValue
        """
        # Get field definition
        field_def = self.db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.id == field_id
        ).first()

        if not field_def:
            raise ValueError(f"Field definition {field_id} not found")

        # Validate value
        validation = self._validate_value(field_def, value)
        if not validation.valid:
            raise ValueError(validation.message)

        # Get or create value record
        field_value = self.db.query(CustomFieldValue).filter(
            CustomFieldValue.field_id == field_id,
            CustomFieldValue.entity_type == entity_type,
            CustomFieldValue.entity_id == entity_id
        ).first()

        if not field_value:
            field_value = CustomFieldValue(
                field_id=field_id,
                entity_type=entity_type,
                entity_id=entity_id
            )
            self.db.add(field_value)

        # Set value based on type
        self._set_typed_value(field_value, field_def.field_type, value)

        return field_value

    def get_value(
        self,
        field_id: int,
        entity_type: str,
        entity_id: int
    ) -> Any:
        """Get a custom field value."""
        field_value = self.db.query(CustomFieldValue).filter(
            CustomFieldValue.field_id == field_id,
            CustomFieldValue.entity_type == entity_type,
            CustomFieldValue.entity_id == entity_id
        ).first()

        if not field_value:
            # Return default value
            field_def = self.db.query(CustomFieldDefinition).filter(
                CustomFieldDefinition.id == field_id
            ).first()

            if field_def and field_def.default_value:
                return json.loads(field_def.default_value)
            return None

        # Get field definition for type
        field_def = self.db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.id == field_id
        ).first()

        return self._get_typed_value(field_value, field_def.field_type if field_def else "string")

    def get_all_values(
        self,
        entity_type: str,
        entity_id: int,
        organization_id: int
    ) -> Dict[str, Any]:
        """Get all custom field values for an entity."""
        fields = self.get_fields(organization_id, entity_type)
        values = {}

        for field in fields:
            value = self.get_value(field.id, entity_type, entity_id)
            values[field.field_key] = value

        return values

    def set_all_values(
        self,
        entity_type: str,
        entity_id: int,
        organization_id: int,
        values: Dict[str, Any]
    ) -> List[FieldValidationResult]:
        """
        Set multiple custom field values for an entity.

        Args:
            entity_type: Entity type
            entity_id: Entity ID
            organization_id: Organization ID
            values: Dict of field_key -> value

        Returns:
            List of validation results
        """
        fields = self.get_fields(organization_id, entity_type)
        field_map = {f.field_key: f for f in fields}
        results = []

        for field_key, value in values.items():
            if field_key not in field_map:
                results.append(FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"Unknown field: {field_key}"
                ))
                continue

            field = field_map[field_key]

            try:
                self.set_value(field.id, entity_type, entity_id, value)
                results.append(FieldValidationResult(valid=True, field_key=field_key))
            except ValueError as e:
                results.append(FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=str(e)
                ))

        return results

    def get_entities_with_field(
        self,
        field_id: int,
        entity_type: str,
        value: Optional[Any] = None
    ) -> List[int]:
        """Get entity IDs that have a specific field value."""
        query = self.db.query(CustomFieldValue.entity_id).filter(
            CustomFieldValue.field_id == field_id,
            CustomFieldValue.entity_type == entity_type
        )

        if value is not None:
            # Filter by value
            field_def = self.db.query(CustomFieldDefinition).filter(
                CustomFieldDefinition.id == field_id
            ).first()

            if field_def:
                field_type = field_def.field_type

                if field_type in [FieldType.STRING.value, FieldType.TEXT.value, FieldType.URL.value,
                                  FieldType.EMAIL.value, FieldType.PHONE.value]:
                    query = query.filter(CustomFieldValue.value_text == str(value))
                elif field_type == FieldType.INTEGER.value:
                    query = query.filter(CustomFieldValue.value_int == int(value))
                elif field_type == FieldType.BOOLEAN.value:
                    query = query.filter(CustomFieldValue.value_bool == (1 if value else 0))

        return [r.entity_id for r in query.all()]

    def search_by_custom_fields(
        self,
        organization_id: int,
        entity_type: str,
        filters: Dict[str, Any]
    ) -> List[int]:
        """
        Search entities by custom field values.

        Args:
            organization_id: Organization ID
            entity_type: Entity type
            filters: Dict of field_key -> value to filter by

        Returns:
            List of matching entity IDs
        """
        fields = self.get_fields(organization_id, entity_type)
        field_map = {f.field_key: f for f in fields}

        matching_ids = None

        for field_key, value in filters.items():
            if field_key not in field_map:
                continue

            field = field_map[field_key]
            entity_ids = set(self.get_entities_with_field(field.id, entity_type, value))

            if matching_ids is None:
                matching_ids = entity_ids
            else:
                matching_ids = matching_ids.intersection(entity_ids)

        return list(matching_ids) if matching_ids else []

    def get_field_data(
        self,
        entity_type: str,
        entity_id: int,
        organization_id: int
    ) -> List[CustomFieldData]:
        """Get all custom field data for an entity with full field info."""
        fields = self.get_fields(organization_id, entity_type)
        result = []

        for field in fields:
            value = self.get_value(field.id, entity_type, entity_id)
            options = json.loads(field.options) if field.options else None

            result.append(CustomFieldData(
                field_id=field.id,
                field_key=field.field_key,
                field_name=field.field_name,
                field_type=FieldType(field.field_type),
                value=value,
                options=options,
                is_required=field.is_required == 1
            ))

        return result

    def _validate_value(
        self,
        field_def: CustomFieldDefinition,
        value: Any
    ) -> FieldValidationResult:
        """Validate a field value."""
        field_key = field_def.field_key

        # Required check
        if field_def.is_required and (value is None or value == ""):
            return FieldValidationResult(
                valid=False,
                field_key=field_key,
                message=f"{field_def.field_name} is required"
            )

        if value is None:
            return FieldValidationResult(valid=True, field_key=field_key)

        field_type = field_def.field_type

        # Type validation
        if field_type == FieldType.INTEGER.value:
            try:
                int(value)
            except (ValueError, TypeError):
                return FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"{field_def.field_name} must be an integer"
                )

            if field_def.min_value is not None and int(value) < field_def.min_value:
                return FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"{field_def.field_name} must be >= {field_def.min_value}"
                )

            if field_def.max_value is not None and int(value) > field_def.max_value:
                return FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"{field_def.field_name} must be <= {field_def.max_value}"
                )

        elif field_type == FieldType.FLOAT.value:
            try:
                float(value)
            except (ValueError, TypeError):
                return FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"{field_def.field_name} must be a number"
                )

        elif field_type in [FieldType.STRING.value, FieldType.TEXT.value]:
            str_value = str(value)

            if field_def.min_length and len(str_value) < field_def.min_length:
                return FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"{field_def.field_name} must be at least {field_def.min_length} characters"
                )

            if field_def.max_length and len(str_value) > field_def.max_length:
                return FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"{field_def.field_name} must be at most {field_def.max_length} characters"
                )

            if field_def.regex_pattern:
                import re
                if not re.match(field_def.regex_pattern, str_value):
                    return FieldValidationResult(
                        valid=False,
                        field_key=field_key,
                        message=field_def.validation_message or f"{field_def.field_name} format is invalid"
                    )

        elif field_type in [FieldType.SELECT.value, FieldType.MULTISELECT.value]:
            options = json.loads(field_def.options) if field_def.options else []

            if field_type == FieldType.SELECT.value:
                if value not in options:
                    return FieldValidationResult(
                        valid=False,
                        field_key=field_key,
                        message=f"{field_def.field_name} must be one of: {options}"
                    )
            else:
                # Multiselect
                values = value if isinstance(value, list) else [value]
                for v in values:
                    if v not in options:
                        return FieldValidationResult(
                            valid=False,
                            field_key=field_key,
                            message=f"Invalid option '{v}' for {field_def.field_name}"
                        )

        elif field_type == FieldType.EMAIL.value:
            import re
            if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', str(value)):
                return FieldValidationResult(
                    valid=False,
                    field_key=field_key,
                    message=f"{field_def.field_name} must be a valid email address"
                )

        return FieldValidationResult(valid=True, field_key=field_key)

    def _set_typed_value(
        self,
        field_value: CustomFieldValue,
        field_type: str,
        value: Any
    ):
        """Set the appropriate value column based on field type."""
        # Clear all value columns
        field_value.value_text = None
        field_value.value_int = None
        field_value.value_float = None
        field_value.value_bool = None
        field_value.value_date = None
        field_value.value_json = None

        if value is None:
            return

        if field_type in [FieldType.STRING.value, FieldType.TEXT.value, FieldType.URL.value,
                          FieldType.EMAIL.value, FieldType.PHONE.value]:
            field_value.value_text = str(value)

        elif field_type == FieldType.INTEGER.value:
            field_value.value_int = int(value)

        elif field_type == FieldType.FLOAT.value:
            field_value.value_float = int(float(value) * 1000000)  # Store as microunits

        elif field_type == FieldType.BOOLEAN.value:
            field_value.value_bool = 1 if value else 0

        elif field_type in [FieldType.DATE.value, FieldType.DATETIME.value]:
            if isinstance(value, datetime):
                field_value.value_date = value
            else:
                field_value.value_date = datetime.fromisoformat(str(value).replace('Z', '+00:00'))

        elif field_type in [FieldType.SELECT.value]:
            field_value.value_text = str(value)

        elif field_type in [FieldType.MULTISELECT.value, FieldType.JSON.value]:
            field_value.value_json = json.dumps(value)

        elif field_type == FieldType.REFERENCE.value:
            field_value.value_int = int(value)

    def _get_typed_value(
        self,
        field_value: CustomFieldValue,
        field_type: str
    ) -> Any:
        """Get value from the appropriate column based on field type."""
        if field_type in [FieldType.STRING.value, FieldType.TEXT.value, FieldType.URL.value,
                          FieldType.EMAIL.value, FieldType.PHONE.value, FieldType.SELECT.value]:
            return field_value.value_text

        elif field_type == FieldType.INTEGER.value:
            return field_value.value_int

        elif field_type == FieldType.FLOAT.value:
            if field_value.value_float is not None:
                return field_value.value_float / 1000000
            return None

        elif field_type == FieldType.BOOLEAN.value:
            if field_value.value_bool is not None:
                return field_value.value_bool == 1
            return None

        elif field_type in [FieldType.DATE.value, FieldType.DATETIME.value]:
            return field_value.value_date

        elif field_type in [FieldType.MULTISELECT.value, FieldType.JSON.value]:
            if field_value.value_json:
                return json.loads(field_value.value_json)
            return None

        elif field_type == FieldType.REFERENCE.value:
            return field_value.value_int

        return None


def get_custom_field_service(db: Session) -> CustomFieldService:
    """Get CustomFieldService instance."""
    return CustomFieldService(db)
