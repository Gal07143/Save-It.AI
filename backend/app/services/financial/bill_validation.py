"""
Bill Validation Service for Financial Engine.

This module parses bills and cross-references them with meter readings
to validate the accuracy of utility charges.
"""
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.models import Bill, Meter, MeterReading, Site
from backend.app.schemas import BillValidationResult


class BillValidationService:
    """
    Service for validating utility bills against meter readings.
    
    The validation process:
    1. Parse the bill data (JSON input for now)
    2. Query meter readings for the same billing period
    3. Calculate the sum of meter readings
    4. Compare with the bill's total kWh
    5. Generate variance report
    
    Variance thresholds:
    - < 2%: Considered normal (meter accuracy tolerance)
    - 2-5%: Minor variance, should be investigated
    - > 5%: Significant variance, action required
    """

    VARIANCE_THRESHOLD_NORMAL = 2.0
    VARIANCE_THRESHOLD_MINOR = 5.0

    def __init__(self, db: Session):
        """Initialize the service with a database session."""
        self.db = db

    def validate_bill(self, bill_id: int) -> BillValidationResult:
        """
        Validate a bill by comparing with meter readings.
        
        Args:
            bill_id: The ID of the bill to validate
            
        Returns:
            BillValidationResult with variance analysis
            
        Raises:
            ValueError: If the bill is not found
        """
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            raise ValueError(f"Bill with ID {bill_id} not found")

        period_start = datetime.combine(bill.period_start, datetime.min.time())
        period_end = datetime.combine(bill.period_end, datetime.max.time())

        meter_total_kwh = self._calculate_meter_total(
            bill.site_id, period_start, period_end
        )

        variance_kwh = bill.total_kwh - meter_total_kwh
        variance_percentage = (
            (variance_kwh / bill.total_kwh * 100) if bill.total_kwh > 0 else 0.0
        )

        is_valid = abs(variance_percentage) <= self.VARIANCE_THRESHOLD_NORMAL

        message = self._generate_validation_message(
            variance_percentage, bill.total_kwh, meter_total_kwh
        )

        bill.is_validated = 1 if is_valid else 0
        bill.validation_variance_pct = variance_percentage
        self.db.commit()

        return BillValidationResult(
            bill_id=bill_id,
            is_valid=is_valid,
            bill_total_kwh=bill.total_kwh,
            meter_total_kwh=meter_total_kwh,
            variance_kwh=variance_kwh,
            variance_percentage=round(variance_percentage, 2),
            message=message
        )

    def _calculate_meter_total(
        self, site_id: int, period_start: datetime, period_end: datetime
    ) -> float:
        """
        Calculate total energy consumption from all meters at a site.
        
        For interval meters, we sum all readings in the period.
        For cumulative meters, we calculate the difference between
        start and end readings.
        
        Args:
            site_id: The site ID
            period_start: Start of the billing period
            period_end: End of the billing period
            
        Returns:
            Total kWh consumed during the period
        """
        meters = self.db.query(Meter).filter(
            Meter.site_id == site_id,
            Meter.is_active == 1
        ).all()

        total_kwh = 0.0

        for meter in meters:
            readings = self.db.query(MeterReading).filter(
                MeterReading.meter_id == meter.id,
                MeterReading.timestamp >= period_start,
                MeterReading.timestamp <= period_end
            ).all()

            if readings:
                meter_sum = sum(r.energy_kwh for r in readings)
                total_kwh += meter_sum

        return total_kwh

    def _generate_validation_message(
        self, variance_pct: float, bill_kwh: float, meter_kwh: float
    ) -> str:
        """
        Generate a human-readable validation message.
        
        Args:
            variance_pct: Variance percentage
            bill_kwh: Bill total in kWh
            meter_kwh: Meter total in kWh
            
        Returns:
            Descriptive message about the validation result
        """
        abs_variance = abs(variance_pct)

        if abs_variance <= self.VARIANCE_THRESHOLD_NORMAL:
            return (
                f"Bill validated successfully. Variance of {variance_pct:.2f}% "
                f"is within normal tolerance (Bill: {bill_kwh:.2f} kWh, "
                f"Meters: {meter_kwh:.2f} kWh)."
            )
        elif abs_variance <= self.VARIANCE_THRESHOLD_MINOR:
            return (
                f"Minor variance detected ({variance_pct:.2f}%). "
                f"Bill shows {bill_kwh:.2f} kWh, meters recorded {meter_kwh:.2f} kWh. "
                "Recommend investigating potential meter gaps or timing differences."
            )
        else:
            if variance_pct > 0:
                return (
                    f"Significant overcharge detected ({variance_pct:.2f}%). "
                    f"Bill shows {bill_kwh:.2f} kWh but meters only recorded "
                    f"{meter_kwh:.2f} kWh. Review billing accuracy."
                )
            else:
                return (
                    f"Significant undermetering detected ({variance_pct:.2f}%). "
                    f"Bill shows {bill_kwh:.2f} kWh but meters recorded "
                    f"{meter_kwh:.2f} kWh. Possible unmetered loads or meter issues."
                )

    def parse_bill_json(self, bill_data: Dict[str, Any], site_id: int) -> Bill:
        """
        Parse a bill from JSON input and create a Bill record.
        
        Args:
            bill_data: Dictionary containing bill information
            site_id: The site ID to associate the bill with
            
        Returns:
            Created Bill object
        """
        bill = Bill(
            site_id=site_id,
            bill_number=bill_data.get("bill_number"),
            provider_name=bill_data.get("provider_name"),
            period_start=date.fromisoformat(bill_data["period_start"]),
            period_end=date.fromisoformat(bill_data["period_end"]),
            issue_date=date.fromisoformat(bill_data["issue_date"]) if bill_data.get("issue_date") else None,
            due_date=date.fromisoformat(bill_data["due_date"]) if bill_data.get("due_date") else None,
            total_kwh=bill_data["total_kwh"],
            total_amount=bill_data["total_amount"],
            currency=bill_data.get("currency", "USD"),
            peak_kwh=bill_data.get("peak_kwh"),
            off_peak_kwh=bill_data.get("off_peak_kwh"),
            demand_kw=bill_data.get("demand_kw"),
            taxes=bill_data.get("taxes"),
            other_charges=bill_data.get("other_charges"),
            notes=bill_data.get("notes")
        )

        self.db.add(bill)
        self.db.commit()
        self.db.refresh(bill)

        return bill


def get_bill_validation_service(db: Session) -> BillValidationService:
    """Factory function to create a BillValidationService instance."""
    return BillValidationService(db)
