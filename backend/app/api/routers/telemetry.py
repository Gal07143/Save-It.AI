"""
Telemetry API Router for SAVE-IT.AI
Endpoints for telemetry ingestion and querying.
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.telemetry_service import TelemetryService, TelemetryRecord

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])


# Request/Response Models
class TelemetryIngest(BaseModel):
    """Single telemetry ingestion request."""
    device_id: int
    datapoints: Dict[str, Any]
    timestamp: Optional[datetime] = None
    source: str = "api"


class TelemetryBatchRecord(BaseModel):
    """Record for batch ingestion."""
    device_id: int
    datapoint_name: Optional[str] = None
    datapoint_id: Optional[int] = None
    timestamp: datetime
    value: Optional[float] = None
    string_value: Optional[str] = None
    quality: str = "good"
    edge_key: Optional[str] = None


class TelemetryBatchIngest(BaseModel):
    """Batch telemetry ingestion request."""
    records: List[TelemetryBatchRecord]


class TelemetryResponse(BaseModel):
    """Telemetry record response."""
    id: int
    device_id: int
    datapoint_id: Optional[int]
    timestamp: str
    value: Optional[float]
    string_value: Optional[str]
    quality: str


class TelemetryLatestResponse(BaseModel):
    """Latest telemetry values response."""
    device_id: int
    datapoints: Dict[str, Any]


class TelemetryStatsResponse(BaseModel):
    """Telemetry statistics response."""
    device_id: int
    datapoint: str
    start: str
    end: str
    min: Optional[float]
    max: Optional[float]
    avg: Optional[float]
    sum: Optional[float]
    count: int
    first: Optional[float]
    last: Optional[float]
    first_timestamp: Optional[str]
    last_timestamp: Optional[str]


class IngestResponse(BaseModel):
    """Ingestion response."""
    status: str
    datapoints_stored: int
    message: Optional[str] = None


class CleanupResponse(BaseModel):
    """Cleanup response."""
    deleted_count: int
    retention_days: int


# Endpoints
@router.post("", response_model=IngestResponse)
@router.post("/", response_model=IngestResponse, include_in_schema=False)
def ingest_telemetry(
    data: TelemetryIngest,
    db: Session = Depends(get_db)
):
    """
    Ingest telemetry data for a device.

    Stores datapoint values and updates current values.
    Alarm evaluation is performed automatically.
    """
    service = TelemetryService(db)

    try:
        count = service.store_telemetry(
            device_id=data.device_id,
            datapoints=data.datapoints,
            timestamp=data.timestamp,
            source=data.source
        )
        db.commit()

        return IngestResponse(
            status="success",
            datapoints_stored=count
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch", response_model=IngestResponse)
def ingest_telemetry_batch(
    data: TelemetryBatchIngest,
    db: Session = Depends(get_db)
):
    """
    Batch ingest telemetry records.

    High-throughput endpoint for ingesting multiple records at once.
    """
    service = TelemetryService(db)

    records = [
        TelemetryRecord(
            device_id=r.device_id,
            datapoint_id=r.datapoint_id,
            datapoint_name=r.datapoint_name,
            timestamp=r.timestamp,
            value=r.value,
            string_value=r.string_value,
            quality=r.quality,
            edge_key=r.edge_key
        )
        for r in data.records
    ]

    try:
        count = service.store_batch(records)
        db.commit()

        return IngestResponse(
            status="success",
            datapoints_stored=count
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/devices/{device_id}")
def get_device_telemetry(
    device_id: int,
    datapoints: Optional[str] = Query(None, description="Comma-separated datapoint names"),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    aggregation: Optional[str] = Query(None, description="Aggregation: sum, avg, min, max, count"),
    interval: Optional[str] = Query(None, description="Interval: 1h, 1d, 1M"),
    limit: int = Query(1000, le=10000),
    db: Session = Depends(get_db)
):
    """
    Query telemetry data for a device.

    Supports time range filtering and optional aggregation.
    For aggregated queries, use interval parameter (1h, 1d, 1M).
    """
    service = TelemetryService(db)

    datapoint_list = datapoints.split(",") if datapoints else None

    return service.query(
        device_id=device_id,
        datapoint_names=datapoint_list,
        start=start,
        end=end,
        aggregation=aggregation,
        interval=interval,
        limit=limit
    )


@router.get("/devices/{device_id}/latest", response_model=TelemetryLatestResponse)
def get_latest_telemetry(
    device_id: int,
    db: Session = Depends(get_db)
):
    """
    Get latest telemetry values for all datapoints of a device.

    Returns current values stored in DeviceDatapoint table.
    """
    service = TelemetryService(db)

    latest = service.get_latest(device_id)

    datapoints = {}
    for name, tv in latest.items():
        datapoints[name] = {
            "value": tv.value,
            "timestamp": tv.timestamp.isoformat() if tv.timestamp else None,
            "quality": tv.quality
        }

    return TelemetryLatestResponse(
        device_id=device_id,
        datapoints=datapoints
    )


@router.get("/devices/{device_id}/history")
def get_telemetry_history(
    device_id: int,
    datapoint: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = Query(1000, le=10000),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Get historical telemetry values for a single datapoint.

    Supports pagination via offset and limit.
    """
    service = TelemetryService(db)

    history = service.get_history(
        device_id=device_id,
        datapoint=datapoint,
        limit=limit,
        offset=offset,
        start=start,
        end=end
    )

    return [
        {
            "timestamp": tv.timestamp.isoformat() if tv.timestamp else None,
            "value": tv.value,
            "quality": tv.quality,
            "raw_value": tv.raw_value
        }
        for tv in history
    ]


@router.get("/devices/{device_id}/stats", response_model=TelemetryStatsResponse)
def get_telemetry_statistics(
    device_id: int,
    datapoint: str,
    start: datetime,
    end: datetime,
    db: Session = Depends(get_db)
):
    """
    Get statistical summary for a datapoint over a time range.

    Returns min, max, avg, sum, count, first, and last values.
    """
    service = TelemetryService(db)

    stats = service.get_statistics(
        device_id=device_id,
        datapoint=datapoint,
        start=start,
        end=end
    )

    return TelemetryStatsResponse(**stats)


@router.delete("/cleanup", response_model=CleanupResponse)
def cleanup_old_telemetry(
    retention_days: int = Query(90, ge=1, description="Delete data older than this many days"),
    device_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Delete telemetry data older than retention period.

    Use with caution - data cannot be recovered.
    """
    service = TelemetryService(db)

    try:
        deleted = service.delete_old_data(
            retention_days=retention_days,
            device_id=device_id
        )
        db.commit()

        return CleanupResponse(
            deleted_count=deleted,
            retention_days=retention_days
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/devices/{device_id}")
def ingest_device_telemetry(
    device_id: int,
    datapoints: Dict[str, Any],
    timestamp: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    """
    Ingest telemetry for a specific device.

    Alternative endpoint for device-specific telemetry ingestion.
    """
    service = TelemetryService(db)

    try:
        count = service.store_telemetry(
            device_id=device_id,
            datapoints=datapoints,
            timestamp=timestamp,
            source="api"
        )
        db.commit()

        return {
            "status": "success",
            "device_id": device_id,
            "datapoints_stored": count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
