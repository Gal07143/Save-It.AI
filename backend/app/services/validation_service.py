"""
Validation Service for SAVE-IT.AI
Data validation and quality control:
- Schema validation
- Range checking
- Anomaly detection
- Data quality scoring
"""
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float

from app.core.database import Base

logger = logging.getLogger(__name__)


class ValidationLevel(Enum):
    """Validation severity levels."""
    ERROR = "error"       # Invalid data, must be rejected
    WARNING = "warning"   # Suspicious data, may be accepted
    INFO = "info"         # Informational only


class ValidationRuleType(Enum):
    """Types of validation rules."""
    RANGE = "range"             # Min/max value check
    REGEX = "regex"             # Pattern matching
    ENUM = "enum"               # Allowed values list
    TYPE = "type"               # Data type check
    REQUIRED = "required"       # Non-null check
    UNIQUE = "unique"           # Uniqueness check
    CUSTOM = "custom"           # Custom function
    RATE_OF_CHANGE = "rate_of_change"  # Change rate limit
    STATISTICAL = "statistical"  # Statistical anomaly


class ValidationRule(Base):
    """Validation rule definition."""
    __tablename__ = "validation_rules"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Rule target
    entity_type = Column(String(50), nullable=False)  # device, telemetry, user, etc.
    field_name = Column(String(100), nullable=False)

    # Rule configuration
    rule_type = Column(String(30), nullable=False)
    rule_config = Column(Text, nullable=True)  # JSON configuration

    level = Column(String(20), default="error")  # error, warning, info
    error_message = Column(String(500), nullable=True)

    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ValidationLog(Base):
    """Log of validation failures."""
    __tablename__ = "validation_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("validation_rules.id"), nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)

    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True, index=True)
    field_name = Column(String(100), nullable=False)

    level = Column(String(20), nullable=False, index=True)
    message = Column(Text, nullable=False)

    invalid_value = Column(Text, nullable=True)
    expected_value = Column(Text, nullable=True)

    action_taken = Column(String(50), nullable=True)  # rejected, accepted, corrected

    created_at = Column(DateTime, default=datetime.utcnow, index=True)


@dataclass
class ValidationResult:
    """Result of a validation check."""
    valid: bool
    level: ValidationLevel
    field: str
    message: str
    value: Any = None
    expected: Any = None
    rule_id: Optional[int] = None


@dataclass
class ValidationReport:
    """Complete validation report."""
    entity_type: str
    entity_id: Optional[int]
    valid: bool
    errors: List[ValidationResult] = field(default_factory=list)
    warnings: List[ValidationResult] = field(default_factory=list)
    info: List[ValidationResult] = field(default_factory=list)
    score: float = 100.0  # Quality score 0-100


@dataclass
class DataQualityMetrics:
    """Data quality metrics."""
    total_records: int
    valid_records: int
    invalid_records: int
    warning_records: int
    completeness: float  # % of non-null required fields
    accuracy: float      # % passing validation
    consistency: float   # % with consistent values
    timeliness: float    # % received on time


class ValidationService:
    """
    Data validation and quality control service.
    """

    # Built-in validators
    TYPE_VALIDATORS = {
        "integer": lambda v: isinstance(v, int) or (isinstance(v, str) and v.isdigit()),
        "float": lambda v: isinstance(v, (int, float)) or _is_numeric_string(v),
        "string": lambda v: isinstance(v, str),
        "boolean": lambda v: isinstance(v, bool) or v in [0, 1, "true", "false", "True", "False"],
        "datetime": lambda v: isinstance(v, datetime) or _is_datetime_string(v),
        "email": lambda v: bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', str(v))),
        "ip_address": lambda v: bool(re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', str(v))),
    }

    def __init__(self, db: Session):
        self.db = db
        self._custom_validators: Dict[str, Callable] = {}
        # Cache for statistical baselines
        self._baselines: Dict[str, Dict[str, float]] = {}

    def register_custom_validator(
        self,
        name: str,
        validator: Callable[[Any, Dict], bool]
    ):
        """Register a custom validation function."""
        self._custom_validators[name] = validator

    def create_rule(
        self,
        name: str,
        entity_type: str,
        field_name: str,
        rule_type: ValidationRuleType,
        rule_config: Optional[Dict] = None,
        level: ValidationLevel = ValidationLevel.ERROR,
        error_message: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> ValidationRule:
        """
        Create a validation rule.

        Args:
            name: Rule name
            entity_type: Type of entity to validate
            field_name: Field to validate
            rule_type: Type of validation
            rule_config: Rule configuration
            level: Validation level
            error_message: Custom error message
            organization_id: Organization scope

        Returns:
            Created ValidationRule
        """
        rule = ValidationRule(
            name=name,
            entity_type=entity_type,
            field_name=field_name,
            rule_type=rule_type.value,
            rule_config=json.dumps(rule_config) if rule_config else None,
            level=level.value,
            error_message=error_message,
            organization_id=organization_id
        )

        self.db.add(rule)
        self.db.flush()

        logger.info(f"Created validation rule: {name} (ID: {rule.id})")

        return rule

    def validate(
        self,
        entity_type: str,
        data: Dict[str, Any],
        entity_id: Optional[int] = None,
        organization_id: Optional[int] = None
    ) -> ValidationReport:
        """
        Validate data against all applicable rules.

        Args:
            entity_type: Type of entity being validated
            data: Data to validate
            entity_id: Optional entity ID
            organization_id: Organization context

        Returns:
            ValidationReport with results
        """
        # Get applicable rules
        query = self.db.query(ValidationRule).filter(
            ValidationRule.entity_type == entity_type,
            ValidationRule.is_active == 1
        )

        if organization_id:
            from sqlalchemy import or_
            query = query.filter(
                or_(
                    ValidationRule.organization_id == organization_id,
                    ValidationRule.organization_id.is_(None)
                )
            )

        rules = query.all()

        errors = []
        warnings = []
        info = []

        for rule in rules:
            result = self._apply_rule(rule, data)

            if not result.valid:
                if result.level == ValidationLevel.ERROR:
                    errors.append(result)
                elif result.level == ValidationLevel.WARNING:
                    warnings.append(result)
                else:
                    info.append(result)

                # Log validation failure
                self._log_failure(rule, result, entity_id, organization_id)

        # Calculate quality score
        total_rules = len(rules)
        passed_rules = total_rules - len(errors) - len(warnings) * 0.5
        score = (passed_rules / total_rules * 100) if total_rules > 0 else 100

        return ValidationReport(
            entity_type=entity_type,
            entity_id=entity_id,
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            info=info,
            score=round(score, 2)
        )

    def _apply_rule(
        self,
        rule: ValidationRule,
        data: Dict[str, Any]
    ) -> ValidationResult:
        """Apply a single validation rule."""
        field_name = rule.field_name
        value = data.get(field_name)
        config = json.loads(rule.rule_config) if rule.rule_config else {}
        level = ValidationLevel(rule.level)

        valid = True
        message = rule.error_message or f"Validation failed for {field_name}"
        expected = None

        rule_type = rule.rule_type

        if rule_type == ValidationRuleType.REQUIRED.value:
            valid = value is not None and value != ""
            message = f"{field_name} is required"

        elif rule_type == ValidationRuleType.TYPE.value:
            expected_type = config.get("type")
            validator = self.TYPE_VALIDATORS.get(expected_type)
            if validator and value is not None:
                valid = validator(value)
                expected = expected_type
                message = f"{field_name} must be of type {expected_type}"

        elif rule_type == ValidationRuleType.RANGE.value:
            if value is not None:
                min_val = config.get("min")
                max_val = config.get("max")

                try:
                    num_value = float(value)
                    if min_val is not None and num_value < min_val:
                        valid = False
                        message = f"{field_name} must be >= {min_val}"
                        expected = f">= {min_val}"
                    elif max_val is not None and num_value > max_val:
                        valid = False
                        message = f"{field_name} must be <= {max_val}"
                        expected = f"<= {max_val}"
                except (ValueError, TypeError):
                    valid = False
                    message = f"{field_name} must be numeric"

        elif rule_type == ValidationRuleType.REGEX.value:
            pattern = config.get("pattern")
            if value is not None and pattern:
                valid = bool(re.match(pattern, str(value)))
                expected = f"pattern: {pattern}"
                message = f"{field_name} must match pattern"

        elif rule_type == ValidationRuleType.ENUM.value:
            allowed = config.get("values", [])
            if value is not None:
                valid = value in allowed
                expected = allowed
                message = f"{field_name} must be one of: {allowed}"

        elif rule_type == ValidationRuleType.RATE_OF_CHANGE.value:
            max_change = config.get("max_change")
            if value is not None and max_change:
                # Would need previous value from context
                prev_value = data.get(f"_prev_{field_name}")
                if prev_value is not None:
                    change = abs(float(value) - float(prev_value))
                    valid = change <= max_change
                    message = f"{field_name} change rate exceeds {max_change}"

        elif rule_type == ValidationRuleType.STATISTICAL.value:
            if value is not None:
                valid, message = self._statistical_validation(field_name, value, config)

        elif rule_type == ValidationRuleType.CUSTOM.value:
            validator_name = config.get("validator")
            if validator_name and validator_name in self._custom_validators:
                try:
                    valid = self._custom_validators[validator_name](value, config)
                except Exception as e:
                    valid = False
                    message = f"Custom validation error: {e}"

        return ValidationResult(
            valid=valid,
            level=level,
            field=field_name,
            message=message,
            value=value,
            expected=expected,
            rule_id=rule.id
        )

    def _statistical_validation(
        self,
        field_name: str,
        value: Any,
        config: Dict
    ) -> tuple:
        """Perform statistical anomaly detection."""
        try:
            num_value = float(value)
        except (ValueError, TypeError):
            return True, ""

        # Get baseline for this field
        baseline_key = f"{field_name}"
        baseline = self._baselines.get(baseline_key, {})

        if not baseline:
            # No baseline yet, accept value
            return True, ""

        mean = baseline.get("mean", num_value)
        std_dev = baseline.get("std_dev", 0)
        threshold = config.get("std_dev_threshold", 3)

        if std_dev > 0:
            z_score = abs(num_value - mean) / std_dev
            if z_score > threshold:
                return False, f"{field_name} value {value} is {z_score:.1f} standard deviations from mean"

        return True, ""

    def update_baseline(
        self,
        field_name: str,
        values: List[float]
    ):
        """Update statistical baseline for a field."""
        if not values:
            return

        import statistics

        mean = statistics.mean(values)
        std_dev = statistics.stdev(values) if len(values) > 1 else 0

        self._baselines[field_name] = {
            "mean": mean,
            "std_dev": std_dev,
            "count": len(values),
            "updated_at": datetime.utcnow().isoformat()
        }

    def _log_failure(
        self,
        rule: ValidationRule,
        result: ValidationResult,
        entity_id: Optional[int],
        organization_id: Optional[int]
    ):
        """Log validation failure."""
        log = ValidationLog(
            rule_id=rule.id,
            organization_id=organization_id,
            entity_type=rule.entity_type,
            entity_id=entity_id,
            field_name=result.field,
            level=result.level.value,
            message=result.message,
            invalid_value=str(result.value) if result.value is not None else None,
            expected_value=str(result.expected) if result.expected is not None else None
        )

        self.db.add(log)

    def get_quality_metrics(
        self,
        entity_type: str,
        organization_id: Optional[int] = None,
        days: int = 7
    ) -> DataQualityMetrics:
        """Get data quality metrics for an entity type."""
        cutoff = datetime.utcnow() - timedelta(days=days)

        query = self.db.query(ValidationLog).filter(
            ValidationLog.entity_type == entity_type,
            ValidationLog.created_at >= cutoff
        )

        if organization_id:
            query = query.filter(ValidationLog.organization_id == organization_id)

        logs = query.all()

        # Count by level
        error_count = sum(1 for l in logs if l.level == ValidationLevel.ERROR.value)
        warning_count = sum(1 for l in logs if l.level == ValidationLevel.WARNING.value)

        # Simplified metrics
        total = len(logs) if logs else 1
        valid = total - error_count
        accuracy = (valid / total * 100) if total > 0 else 100

        return DataQualityMetrics(
            total_records=total,
            valid_records=valid,
            invalid_records=error_count,
            warning_records=warning_count,
            completeness=100.0,  # Would need schema info
            accuracy=round(accuracy, 2),
            consistency=100.0,   # Would need cross-field validation
            timeliness=100.0    # Would need timestamp analysis
        )

    def get_validation_history(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        level: Optional[ValidationLevel] = None,
        limit: int = 100
    ) -> List[ValidationLog]:
        """Get validation history."""
        query = self.db.query(ValidationLog)

        if entity_type:
            query = query.filter(ValidationLog.entity_type == entity_type)
        if entity_id:
            query = query.filter(ValidationLog.entity_id == entity_id)
        if level:
            query = query.filter(ValidationLog.level == level.value)

        return query.order_by(ValidationLog.created_at.desc()).limit(limit).all()


def _is_numeric_string(v: Any) -> bool:
    """Check if value is a numeric string."""
    try:
        float(v)
        return True
    except (ValueError, TypeError):
        return False


def _is_datetime_string(v: Any) -> bool:
    """Check if value is a valid datetime string."""
    try:
        datetime.fromisoformat(str(v).replace('Z', '+00:00'))
        return True
    except (ValueError, TypeError):
        return False


def get_validation_service(db: Session) -> ValidationService:
    """Get ValidationService instance."""
    return ValidationService(db)
