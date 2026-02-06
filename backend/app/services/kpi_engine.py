"""
KPI Engine for SAVE-IT.AI
Calculates Key Performance Indicators:
- Simple aggregations (sum, avg, min, max)
- Formulas with multiple variables
- Cross-device calculations
- Scheduled and on-demand
"""
import logging
import json
import math
import re
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.devices import Device, Datapoint, DeviceTelemetry
from app.models.telemetry import (
    KPIDefinition, KPIValue, KPIType, TelemetryAggregation, AggregationPeriod
)

logger = logging.getLogger(__name__)


@dataclass
class TimeRange:
    """Time range for KPI calculation."""
    start: datetime
    end: datetime


@dataclass
class KPIResult:
    """Result of KPI calculation."""
    kpi_id: int
    kpi_name: str
    value: Optional[float]
    status: str  # normal, warning, critical, error
    period_start: datetime
    period_end: datetime
    data_points_used: int
    calculation_time_ms: int
    error_message: Optional[str] = None


class FormulaEvaluator:
    """
    Safe formula evaluator for KPI calculations.
    Supports: +, -, *, /, ^, sqrt, abs, min, max, avg, round
    """

    SAFE_FUNCTIONS = {
        'sqrt': math.sqrt,
        'abs': abs,
        'min': min,
        'max': max,
        'round': round,
        'pow': pow,
        'log': math.log,
        'log10': math.log10,
        'exp': math.exp,
        'sin': math.sin,
        'cos': math.cos,
        'tan': math.tan,
        'floor': math.floor,
        'ceil': math.ceil,
    }

    SAFE_NAMES = {
        'pi': math.pi,
        'e': math.e,
    }

    def evaluate(self, formula: str, variables: Dict[str, float]) -> float:
        """
        Safely evaluate a formula expression.

        Args:
            formula: Formula string (e.g., "var1 + var2 * 0.95")
            variables: Dict mapping variable names to values

        Returns:
            Calculated result

        Raises:
            ValueError: If formula is invalid or unsafe
        """
        if not formula:
            raise ValueError("Empty formula")

        # Replace ^ with ** for power
        formula = formula.replace('^', '**')

        # Build safe namespace
        namespace = {}
        namespace.update(self.SAFE_FUNCTIONS)
        namespace.update(self.SAFE_NAMES)
        namespace.update(variables)

        # Validate formula contains only safe operations
        # Remove known safe tokens
        test_formula = formula
        for name in list(self.SAFE_FUNCTIONS.keys()) + list(self.SAFE_NAMES.keys()) + list(variables.keys()):
            test_formula = test_formula.replace(name, '')

        # Check remaining characters are only numbers, operators, parentheses, whitespace
        safe_chars = set('0123456789.+-*/() ,')
        remaining = set(test_formula) - safe_chars
        if remaining:
            raise ValueError(f"Unsafe characters in formula: {remaining}")

        try:
            result = eval(formula, {"__builtins__": {}}, namespace)
            return float(result)
        except Exception as e:
            raise ValueError(f"Formula evaluation error: {e}")


class KPIEngine:
    """
    Calculates Key Performance Indicators.
    Supports simple aggregations, formulas, and cross-device calculations.
    """

    def __init__(self, db: Session):
        self.db = db
        self.formula_evaluator = FormulaEvaluator()

    def calculate(self, kpi_id: int, time_range: TimeRange) -> KPIResult:
        """
        Calculate a single KPI.

        Args:
            kpi_id: KPI definition ID
            time_range: Time range for calculation

        Returns:
            KPIResult with calculated value
        """
        start_time = datetime.utcnow()

        kpi = self.db.query(KPIDefinition).filter(KPIDefinition.id == kpi_id).first()
        if not kpi:
            return KPIResult(
                kpi_id=kpi_id,
                kpi_name="Unknown",
                value=None,
                status="error",
                period_start=time_range.start,
                period_end=time_range.end,
                data_points_used=0,
                calculation_time_ms=0,
                error_message="KPI not found"
            )

        try:
            if kpi.kpi_type == KPIType.FORMULA:
                value, data_points = self._calculate_formula(kpi, time_range)
            else:
                value, data_points = self._calculate_aggregation(kpi, time_range)

            # Determine status based on thresholds
            status = self._determine_status(kpi, value)

            calc_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

            # Store result
            kpi_value = KPIValue(
                kpi_id=kpi_id,
                period_start=time_range.start,
                period_end=time_range.end,
                value=value,
                status=status,
                data_points_used=data_points,
                calculation_time_ms=calc_time
            )
            self.db.add(kpi_value)

            # Update KPI last calculated
            kpi.last_calculated_at = datetime.utcnow()

            return KPIResult(
                kpi_id=kpi_id,
                kpi_name=kpi.name,
                value=value,
                status=status,
                period_start=time_range.start,
                period_end=time_range.end,
                data_points_used=data_points,
                calculation_time_ms=calc_time
            )

        except Exception as e:
            calc_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.error(f"KPI calculation error for {kpi_id}: {e}")

            return KPIResult(
                kpi_id=kpi_id,
                kpi_name=kpi.name,
                value=None,
                status="error",
                period_start=time_range.start,
                period_end=time_range.end,
                data_points_used=0,
                calculation_time_ms=calc_time,
                error_message=str(e)
            )

    def calculate_formula(self, formula: str, variables: Dict[str, float]) -> float:
        """
        Evaluate a formula expression.

        Args:
            formula: Formula string
            variables: Variable values

        Returns:
            Calculated result
        """
        return self.formula_evaluator.evaluate(formula, variables)

    def calculate_device_kpis(
        self,
        device_id: int,
        time_range: TimeRange
    ) -> Dict[str, KPIResult]:
        """
        Calculate all KPIs for a device.

        Args:
            device_id: Device ID
            time_range: Time range

        Returns:
            Dict mapping KPI names to results
        """
        results = {}

        # Get KPIs that use this device
        kpis = self.db.query(KPIDefinition).filter(
            KPIDefinition.source_device_id == device_id,
            KPIDefinition.is_active == 1
        ).all()

        for kpi in kpis:
            result = self.calculate(kpi.id, time_range)
            results[kpi.name] = result

        return results

    def calculate_site_kpis(
        self,
        site_id: int,
        time_range: TimeRange
    ) -> Dict[str, KPIResult]:
        """
        Calculate all KPIs for a site.

        Args:
            site_id: Site ID
            time_range: Time range

        Returns:
            Dict mapping KPI names to results
        """
        results = {}

        kpis = self.db.query(KPIDefinition).filter(
            KPIDefinition.site_id == site_id,
            KPIDefinition.is_active == 1
        ).all()

        for kpi in kpis:
            result = self.calculate(kpi.id, time_range)
            results[kpi.name] = result

        return results

    def get_kpi_history(
        self,
        kpi_id: int,
        start: datetime,
        end: datetime,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get historical KPI values.

        Args:
            kpi_id: KPI ID
            start: Start time
            end: End time
            limit: Max results

        Returns:
            List of KPI value records
        """
        values = self.db.query(KPIValue).filter(
            KPIValue.kpi_id == kpi_id,
            KPIValue.period_start >= start,
            KPIValue.period_end <= end
        ).order_by(KPIValue.period_start.desc()).limit(limit).all()

        return [
            {
                "period_start": v.period_start.isoformat(),
                "period_end": v.period_end.isoformat(),
                "value": v.value,
                "status": v.status,
                "data_points_used": v.data_points_used
            }
            for v in values
        ]

    def _calculate_aggregation(
        self,
        kpi: KPIDefinition,
        time_range: TimeRange
    ) -> tuple:
        """Calculate KPI using simple aggregation."""
        if not kpi.source_device_id or not kpi.source_datapoint_id:
            raise ValueError("Source device and datapoint required for aggregation KPI")

        # Try to use pre-computed aggregations first
        agg_result = self._get_from_aggregations(kpi, time_range)
        if agg_result is not None:
            return agg_result

        # Fall back to raw telemetry
        query = self.db.query(DeviceTelemetry).filter(
            DeviceTelemetry.device_id == kpi.source_device_id,
            DeviceTelemetry.datapoint_id == kpi.source_datapoint_id,
            DeviceTelemetry.timestamp >= time_range.start,
            DeviceTelemetry.timestamp <= time_range.end,
            DeviceTelemetry.value.isnot(None)
        )

        if kpi.kpi_type == KPIType.SUM:
            result = self.db.query(func.sum(DeviceTelemetry.value)).filter(
                DeviceTelemetry.device_id == kpi.source_device_id,
                DeviceTelemetry.datapoint_id == kpi.source_datapoint_id,
                DeviceTelemetry.timestamp >= time_range.start,
                DeviceTelemetry.timestamp <= time_range.end
            ).scalar()
        elif kpi.kpi_type == KPIType.AVG:
            result = self.db.query(func.avg(DeviceTelemetry.value)).filter(
                DeviceTelemetry.device_id == kpi.source_device_id,
                DeviceTelemetry.datapoint_id == kpi.source_datapoint_id,
                DeviceTelemetry.timestamp >= time_range.start,
                DeviceTelemetry.timestamp <= time_range.end
            ).scalar()
        elif kpi.kpi_type == KPIType.MIN:
            result = self.db.query(func.min(DeviceTelemetry.value)).filter(
                DeviceTelemetry.device_id == kpi.source_device_id,
                DeviceTelemetry.datapoint_id == kpi.source_datapoint_id,
                DeviceTelemetry.timestamp >= time_range.start,
                DeviceTelemetry.timestamp <= time_range.end
            ).scalar()
        elif kpi.kpi_type == KPIType.MAX:
            result = self.db.query(func.max(DeviceTelemetry.value)).filter(
                DeviceTelemetry.device_id == kpi.source_device_id,
                DeviceTelemetry.datapoint_id == kpi.source_datapoint_id,
                DeviceTelemetry.timestamp >= time_range.start,
                DeviceTelemetry.timestamp <= time_range.end
            ).scalar()
        elif kpi.kpi_type == KPIType.COUNT:
            result = query.count()
        else:
            raise ValueError(f"Unknown KPI type: {kpi.kpi_type}")

        count = query.count()
        return float(result) if result is not None else None, count

    def _calculate_formula(
        self,
        kpi: KPIDefinition,
        time_range: TimeRange
    ) -> tuple:
        """Calculate KPI using formula with multiple variables."""
        if not kpi.formula or not kpi.formula_variables:
            raise ValueError("Formula and variables required for formula KPI")

        # Parse variable definitions
        # Format: {"var1": {"device_id": 1, "datapoint_id": 2, "aggregation": "avg"}, ...}
        var_config = json.loads(kpi.formula_variables)

        variables = {}
        total_data_points = 0

        for var_name, config in var_config.items():
            device_id = config.get("device_id")
            datapoint_id = config.get("datapoint_id")
            aggregation = config.get("aggregation", "avg")

            if not device_id or not datapoint_id:
                raise ValueError(f"Variable {var_name} missing device_id or datapoint_id")

            # Get aggregated value for this variable
            if aggregation == "sum":
                agg_func = func.sum
            elif aggregation == "avg":
                agg_func = func.avg
            elif aggregation == "min":
                agg_func = func.min
            elif aggregation == "max":
                agg_func = func.max
            elif aggregation == "last":
                # Get last value
                last = self.db.query(DeviceTelemetry.value).filter(
                    DeviceTelemetry.device_id == device_id,
                    DeviceTelemetry.datapoint_id == datapoint_id,
                    DeviceTelemetry.timestamp >= time_range.start,
                    DeviceTelemetry.timestamp <= time_range.end
                ).order_by(DeviceTelemetry.timestamp.desc()).first()
                variables[var_name] = last[0] if last else 0
                total_data_points += 1
                continue
            else:
                agg_func = func.avg

            result = self.db.query(agg_func(DeviceTelemetry.value)).filter(
                DeviceTelemetry.device_id == device_id,
                DeviceTelemetry.datapoint_id == datapoint_id,
                DeviceTelemetry.timestamp >= time_range.start,
                DeviceTelemetry.timestamp <= time_range.end
            ).scalar()

            count = self.db.query(DeviceTelemetry).filter(
                DeviceTelemetry.device_id == device_id,
                DeviceTelemetry.datapoint_id == datapoint_id,
                DeviceTelemetry.timestamp >= time_range.start,
                DeviceTelemetry.timestamp <= time_range.end
            ).count()

            variables[var_name] = float(result) if result is not None else 0
            total_data_points += count

        # Evaluate formula
        value = self.formula_evaluator.evaluate(kpi.formula, variables)

        # Apply precision
        if kpi.precision is not None:
            value = round(value, kpi.precision)

        return value, total_data_points

    def _get_from_aggregations(
        self,
        kpi: KPIDefinition,
        time_range: TimeRange
    ) -> Optional[tuple]:
        """Try to get KPI value from pre-computed aggregations."""
        # Determine appropriate aggregation period
        duration = (time_range.end - time_range.start).total_seconds()

        if duration <= 3600:  # 1 hour or less - use raw data
            return None
        elif duration <= 86400:  # 1 day or less - use hourly
            period = AggregationPeriod.HOURLY
        elif duration <= 2592000:  # 30 days or less - use daily
            period = AggregationPeriod.DAILY
        else:  # More than 30 days - use monthly
            period = AggregationPeriod.MONTHLY

        # Query aggregations
        aggs = self.db.query(TelemetryAggregation).filter(
            TelemetryAggregation.device_id == kpi.source_device_id,
            TelemetryAggregation.datapoint_id == kpi.source_datapoint_id,
            TelemetryAggregation.period == period,
            TelemetryAggregation.period_start >= time_range.start,
            TelemetryAggregation.period_end <= time_range.end
        ).all()

        if not aggs:
            return None

        # Calculate based on KPI type
        if kpi.kpi_type == KPIType.SUM:
            value = sum(a.value_sum or 0 for a in aggs)
        elif kpi.kpi_type == KPIType.AVG:
            total_sum = sum(a.value_sum or 0 for a in aggs)
            total_count = sum(a.value_count or 0 for a in aggs)
            value = total_sum / total_count if total_count > 0 else None
        elif kpi.kpi_type == KPIType.MIN:
            mins = [a.value_min for a in aggs if a.value_min is not None]
            value = min(mins) if mins else None
        elif kpi.kpi_type == KPIType.MAX:
            maxs = [a.value_max for a in aggs if a.value_max is not None]
            value = max(maxs) if maxs else None
        elif kpi.kpi_type == KPIType.COUNT:
            value = sum(a.value_count or 0 for a in aggs)
        else:
            return None

        count = sum(a.value_count or 0 for a in aggs)
        return value, count

    def _determine_status(self, kpi: KPIDefinition, value: Optional[float]) -> str:
        """Determine KPI status based on thresholds."""
        if value is None:
            return "error"

        # Check critical thresholds first
        if kpi.critical_min is not None and value < kpi.critical_min:
            return "critical"
        if kpi.critical_max is not None and value > kpi.critical_max:
            return "critical"

        # Check warning thresholds
        if kpi.warning_min is not None and value < kpi.warning_min:
            return "warning"
        if kpi.warning_max is not None and value > kpi.warning_max:
            return "warning"

        return "normal"


def get_kpi_engine(db: Session) -> KPIEngine:
    """Get KPIEngine instance."""
    return KPIEngine(db)
