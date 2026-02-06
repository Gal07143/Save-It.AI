"""
Aggregation Service for SAVE-IT.AI
Creates time-based rollups for efficient querying:
- Hourly: From raw data
- Daily: From hourly
- Monthly: From daily
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.devices import Device, Datapoint, DeviceTelemetry
from app.models.telemetry import TelemetryAggregation, AggregationPeriod

logger = logging.getLogger(__name__)


@dataclass
class AggregationResult:
    """Result of aggregation run."""
    period: str
    records_processed: int
    aggregations_created: int
    aggregations_updated: int
    devices_processed: int
    duration_seconds: float
    errors: List[str]


class AggregationService:
    """
    Creates time-based rollups for efficient querying.
    Aggregates raw telemetry into hourly, daily, and monthly summaries.
    """

    def __init__(self, db: Session):
        self.db = db

    async def aggregate_hourly(
        self,
        device_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> AggregationResult:
        """
        Run hourly aggregation from raw telemetry data.

        Args:
            device_id: Optional - only aggregate for specific device
            start_time: Start of aggregation window (default: last 2 hours)
            end_time: End of aggregation window (default: now)

        Returns:
            AggregationResult with statistics
        """
        start = datetime.utcnow()
        errors = []

        # Default time window: last 2 hours to catch any delayed data
        if not end_time:
            end_time = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        if not start_time:
            start_time = end_time - timedelta(hours=2)

        # Get devices to process
        device_query = self.db.query(Device).filter(Device.is_active == 1)
        if device_id:
            device_query = device_query.filter(Device.id == device_id)
        devices = device_query.all()

        records_processed = 0
        aggregations_created = 0
        aggregations_updated = 0

        for device in devices:
            try:
                # Get datapoints for this device's model
                if not device.model_id:
                    continue

                datapoints = self.db.query(Datapoint).filter(
                    Datapoint.model_id == device.model_id
                ).all()

                for dp in datapoints:
                    # Process each hour in the window
                    current_hour = start_time
                    while current_hour < end_time:
                        next_hour = current_hour + timedelta(hours=1)

                        created, updated, count = self._aggregate_period(
                            device_id=device.id,
                            datapoint_id=dp.id,
                            period=AggregationPeriod.HOURLY,
                            period_start=current_hour,
                            period_end=next_hour
                        )

                        records_processed += count
                        aggregations_created += created
                        aggregations_updated += updated

                        current_hour = next_hour

            except Exception as e:
                errors.append(f"Device {device.id}: {str(e)}")
                logger.error(f"Hourly aggregation error for device {device.id}: {e}")

        self.db.flush()

        duration = (datetime.utcnow() - start).total_seconds()
        logger.info(f"Hourly aggregation completed: {aggregations_created} created, {aggregations_updated} updated in {duration:.2f}s")

        return AggregationResult(
            period="hourly",
            records_processed=records_processed,
            aggregations_created=aggregations_created,
            aggregations_updated=aggregations_updated,
            devices_processed=len(devices),
            duration_seconds=duration,
            errors=errors
        )

    async def aggregate_daily(
        self,
        device_id: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> AggregationResult:
        """
        Run daily aggregation from hourly aggregations.

        Args:
            device_id: Optional - only aggregate for specific device
            start_date: Start date (default: yesterday)
            end_date: End date (default: today)

        Returns:
            AggregationResult with statistics
        """
        start = datetime.utcnow()
        errors = []

        # Default: yesterday's data
        if not end_date:
            end_date = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        if not start_date:
            start_date = end_date - timedelta(days=1)

        device_query = self.db.query(Device).filter(Device.is_active == 1)
        if device_id:
            device_query = device_query.filter(Device.id == device_id)
        devices = device_query.all()

        records_processed = 0
        aggregations_created = 0
        aggregations_updated = 0

        for device in devices:
            try:
                if not device.model_id:
                    continue

                datapoints = self.db.query(Datapoint).filter(
                    Datapoint.model_id == device.model_id
                ).all()

                for dp in datapoints:
                    current_day = start_date
                    while current_day < end_date:
                        next_day = current_day + timedelta(days=1)

                        created, updated, count = self._aggregate_from_lower_period(
                            device_id=device.id,
                            datapoint_id=dp.id,
                            source_period=AggregationPeriod.HOURLY,
                            target_period=AggregationPeriod.DAILY,
                            period_start=current_day,
                            period_end=next_day
                        )

                        records_processed += count
                        aggregations_created += created
                        aggregations_updated += updated

                        current_day = next_day

            except Exception as e:
                errors.append(f"Device {device.id}: {str(e)}")
                logger.error(f"Daily aggregation error for device {device.id}: {e}")

        self.db.flush()

        duration = (datetime.utcnow() - start).total_seconds()
        logger.info(f"Daily aggregation completed: {aggregations_created} created, {aggregations_updated} updated in {duration:.2f}s")

        return AggregationResult(
            period="daily",
            records_processed=records_processed,
            aggregations_created=aggregations_created,
            aggregations_updated=aggregations_updated,
            devices_processed=len(devices),
            duration_seconds=duration,
            errors=errors
        )

    async def aggregate_monthly(
        self,
        device_id: Optional[int] = None,
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> AggregationResult:
        """
        Run monthly aggregation from daily aggregations.

        Args:
            device_id: Optional - only aggregate for specific device
            year: Year to aggregate (default: current year)
            month: Month to aggregate (default: previous month)

        Returns:
            AggregationResult with statistics
        """
        start = datetime.utcnow()
        errors = []

        # Default: previous month
        if not year or not month:
            today = datetime.utcnow()
            if today.month == 1:
                year = today.year - 1
                month = 12
            else:
                year = today.year
                month = today.month - 1

        # Calculate month boundaries
        month_start = datetime(year, month, 1)
        if month == 12:
            month_end = datetime(year + 1, 1, 1)
        else:
            month_end = datetime(year, month + 1, 1)

        device_query = self.db.query(Device).filter(Device.is_active == 1)
        if device_id:
            device_query = device_query.filter(Device.id == device_id)
        devices = device_query.all()

        records_processed = 0
        aggregations_created = 0
        aggregations_updated = 0

        for device in devices:
            try:
                if not device.model_id:
                    continue

                datapoints = self.db.query(Datapoint).filter(
                    Datapoint.model_id == device.model_id
                ).all()

                for dp in datapoints:
                    created, updated, count = self._aggregate_from_lower_period(
                        device_id=device.id,
                        datapoint_id=dp.id,
                        source_period=AggregationPeriod.DAILY,
                        target_period=AggregationPeriod.MONTHLY,
                        period_start=month_start,
                        period_end=month_end
                    )

                    records_processed += count
                    aggregations_created += created
                    aggregations_updated += updated

            except Exception as e:
                errors.append(f"Device {device.id}: {str(e)}")
                logger.error(f"Monthly aggregation error for device {device.id}: {e}")

        self.db.flush()

        duration = (datetime.utcnow() - start).total_seconds()
        logger.info(f"Monthly aggregation completed: {aggregations_created} created, {aggregations_updated} updated in {duration:.2f}s")

        return AggregationResult(
            period="monthly",
            records_processed=records_processed,
            aggregations_created=aggregations_created,
            aggregations_updated=aggregations_updated,
            devices_processed=len(devices),
            duration_seconds=duration,
            errors=errors
        )

    def get_aggregated(
        self,
        device_id: int,
        datapoint: str,
        period: str,
        start: datetime,
        end: datetime
    ) -> List[Dict[str, Any]]:
        """
        Get aggregated data for a device and datapoint.

        Args:
            device_id: Device ID
            datapoint: Datapoint name
            period: Aggregation period (hourly, daily, monthly)
            start: Start time
            end: End time

        Returns:
            List of aggregation records
        """
        # Get datapoint ID
        dp = self.db.query(Datapoint).filter(Datapoint.name == datapoint).first()
        if not dp:
            return []

        period_enum = AggregationPeriod(period)

        results = self.db.query(TelemetryAggregation).filter(
            TelemetryAggregation.device_id == device_id,
            TelemetryAggregation.datapoint_id == dp.id,
            TelemetryAggregation.period == period_enum,
            TelemetryAggregation.period_start >= start,
            TelemetryAggregation.period_end <= end
        ).order_by(TelemetryAggregation.period_start).all()

        return [
            {
                "period_start": r.period_start.isoformat(),
                "period_end": r.period_end.isoformat(),
                "min": r.value_min,
                "max": r.value_max,
                "avg": r.value_avg,
                "sum": r.value_sum,
                "count": r.value_count,
                "first": r.value_first,
                "last": r.value_last,
            }
            for r in results
        ]

    async def rebuild_aggregations(
        self,
        device_id: int,
        start: datetime,
        end: datetime
    ) -> Dict[str, AggregationResult]:
        """
        Rebuild all aggregations for a time range.
        Use after data correction or bulk import.

        Args:
            device_id: Device ID
            start: Start time
            end: End time

        Returns:
            Dict with results for each aggregation level
        """
        results = {}

        # Delete existing aggregations in range
        self.db.query(TelemetryAggregation).filter(
            TelemetryAggregation.device_id == device_id,
            TelemetryAggregation.period_start >= start,
            TelemetryAggregation.period_end <= end
        ).delete(synchronize_session=False)

        # Rebuild hourly first
        results["hourly"] = await self.aggregate_hourly(
            device_id=device_id,
            start_time=start,
            end_time=end
        )

        # Then daily
        results["daily"] = await self.aggregate_daily(
            device_id=device_id,
            start_date=start.replace(hour=0, minute=0, second=0, microsecond=0),
            end_date=end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        )

        # Monthly if range spans months
        if start.month != end.month or start.year != end.year:
            # Aggregate each month in range
            current = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            while current < end:
                await self.aggregate_monthly(
                    device_id=device_id,
                    year=current.year,
                    month=current.month
                )
                if current.month == 12:
                    current = current.replace(year=current.year + 1, month=1)
                else:
                    current = current.replace(month=current.month + 1)

        self.db.commit()
        return results

    def _aggregate_period(
        self,
        device_id: int,
        datapoint_id: int,
        period: AggregationPeriod,
        period_start: datetime,
        period_end: datetime
    ) -> tuple:
        """Aggregate raw telemetry for a period."""
        # Query raw telemetry
        stats = self.db.query(
            func.min(DeviceTelemetry.value).label("min"),
            func.max(DeviceTelemetry.value).label("max"),
            func.avg(DeviceTelemetry.value).label("avg"),
            func.sum(DeviceTelemetry.value).label("sum"),
            func.count(DeviceTelemetry.id).label("count"),
        ).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.datapoint_id == datapoint_id,
            DeviceTelemetry.timestamp >= period_start,
            DeviceTelemetry.timestamp < period_end,
            DeviceTelemetry.value.isnot(None)
        ).first()

        if not stats or stats.count == 0:
            return 0, 0, 0

        # Get first and last values
        first = self.db.query(DeviceTelemetry.value).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.datapoint_id == datapoint_id,
            DeviceTelemetry.timestamp >= period_start,
            DeviceTelemetry.timestamp < period_end,
        ).order_by(DeviceTelemetry.timestamp.asc()).first()

        last = self.db.query(DeviceTelemetry.value).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.datapoint_id == datapoint_id,
            DeviceTelemetry.timestamp >= period_start,
            DeviceTelemetry.timestamp < period_end,
        ).order_by(DeviceTelemetry.timestamp.desc()).first()

        # Quality counts
        good_count = self.db.query(func.count(DeviceTelemetry.id)).filter(
            DeviceTelemetry.device_id == device_id,
            DeviceTelemetry.datapoint_id == datapoint_id,
            DeviceTelemetry.timestamp >= period_start,
            DeviceTelemetry.timestamp < period_end,
            DeviceTelemetry.quality == "good"
        ).scalar() or 0

        bad_count = stats.count - good_count

        # Check for existing aggregation
        existing = self.db.query(TelemetryAggregation).filter(
            TelemetryAggregation.device_id == device_id,
            TelemetryAggregation.datapoint_id == datapoint_id,
            TelemetryAggregation.period == period,
            TelemetryAggregation.period_start == period_start
        ).first()

        if existing:
            # Update existing
            existing.value_min = stats.min
            existing.value_max = stats.max
            existing.value_avg = float(stats.avg) if stats.avg else None
            existing.value_sum = float(stats.sum) if stats.sum else None
            existing.value_count = stats.count
            existing.value_first = first[0] if first else None
            existing.value_last = last[0] if last else None
            existing.quality_good_count = good_count
            existing.quality_bad_count = bad_count
            existing.updated_at = datetime.utcnow()
            return 0, 1, stats.count
        else:
            # Create new
            agg = TelemetryAggregation(
                device_id=device_id,
                datapoint_id=datapoint_id,
                period=period,
                period_start=period_start,
                period_end=period_end,
                value_min=stats.min,
                value_max=stats.max,
                value_avg=float(stats.avg) if stats.avg else None,
                value_sum=float(stats.sum) if stats.sum else None,
                value_count=stats.count,
                value_first=first[0] if first else None,
                value_last=last[0] if last else None,
                quality_good_count=good_count,
                quality_bad_count=bad_count,
            )
            self.db.add(agg)
            return 1, 0, stats.count

    def _aggregate_from_lower_period(
        self,
        device_id: int,
        datapoint_id: int,
        source_period: AggregationPeriod,
        target_period: AggregationPeriod,
        period_start: datetime,
        period_end: datetime
    ) -> tuple:
        """Aggregate from lower-level aggregations (hourly->daily, daily->monthly)."""
        # Query source aggregations
        sources = self.db.query(TelemetryAggregation).filter(
            TelemetryAggregation.device_id == device_id,
            TelemetryAggregation.datapoint_id == datapoint_id,
            TelemetryAggregation.period == source_period,
            TelemetryAggregation.period_start >= period_start,
            TelemetryAggregation.period_end <= period_end
        ).all()

        if not sources:
            return 0, 0, 0

        # Calculate aggregates
        values = [s for s in sources if s.value_avg is not None]
        if not values:
            return 0, 0, 0

        min_val = min(s.value_min for s in values if s.value_min is not None)
        max_val = max(s.value_max for s in values if s.value_max is not None)
        total_sum = sum(s.value_sum or 0 for s in values)
        total_count = sum(s.value_count or 0 for s in values)
        avg_val = total_sum / total_count if total_count > 0 else None

        # First and last from ordered sources
        first_val = sources[0].value_first if sources else None
        last_val = sources[-1].value_last if sources else None

        good_count = sum(s.quality_good_count or 0 for s in sources)
        bad_count = sum(s.quality_bad_count or 0 for s in sources)

        # Check for existing
        existing = self.db.query(TelemetryAggregation).filter(
            TelemetryAggregation.device_id == device_id,
            TelemetryAggregation.datapoint_id == datapoint_id,
            TelemetryAggregation.period == target_period,
            TelemetryAggregation.period_start == period_start
        ).first()

        if existing:
            existing.value_min = min_val
            existing.value_max = max_val
            existing.value_avg = avg_val
            existing.value_sum = total_sum
            existing.value_count = total_count
            existing.value_first = first_val
            existing.value_last = last_val
            existing.quality_good_count = good_count
            existing.quality_bad_count = bad_count
            existing.updated_at = datetime.utcnow()
            return 0, 1, len(sources)
        else:
            agg = TelemetryAggregation(
                device_id=device_id,
                datapoint_id=datapoint_id,
                period=target_period,
                period_start=period_start,
                period_end=period_end,
                value_min=min_val,
                value_max=max_val,
                value_avg=avg_val,
                value_sum=total_sum,
                value_count=total_count,
                value_first=first_val,
                value_last=last_val,
                quality_good_count=good_count,
                quality_bad_count=bad_count,
            )
            self.db.add(agg)
            return 1, 0, len(sources)


def get_aggregation_service(db: Session) -> AggregationService:
    """Get AggregationService instance."""
    return AggregationService(db)
