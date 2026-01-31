"""
Geofences API Router for SAVE-IT.AI
Endpoints for location-based device management.
"""
from datetime import datetime
from typing import Optional, List, Tuple
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.geofence_service import (
    GeofenceService,
    GeofenceType,
    GeofenceEventType,
    LocationUpdate,
    get_geofence_service,
)

router = APIRouter(prefix="/geofences", tags=["geofences"])


class GeofenceCreate(BaseModel):
    """Create geofence request."""
    name: str
    description: Optional[str] = None
    fence_type: str  # circle, polygon, rectangle
    site_id: Optional[int] = None
    # Circle params
    center_lat: Optional[float] = None
    center_lng: Optional[float] = None
    radius_meters: Optional[float] = None
    # Polygon params
    boundary_points: Optional[List[List[float]]] = None
    # Alert config
    alert_on_enter: bool = True
    alert_on_exit: bool = True
    alert_on_dwell: bool = False
    dwell_time_seconds: int = 300
    color: Optional[str] = None


class GeofenceResponse(BaseModel):
    """Geofence response."""
    id: int
    name: str
    description: Optional[str]
    fence_type: str
    center_lat: Optional[float]
    center_lng: Optional[float]
    radius_meters: Optional[float]
    alert_on_enter: bool
    alert_on_exit: bool
    color: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LocationUpdateRequest(BaseModel):
    """Update device location request."""
    device_id: int
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None
    source: str = "gps"


class LocationResponse(BaseModel):
    """Device location response."""
    device_id: int
    latitude: float
    longitude: float
    altitude: Optional[float]
    accuracy_meters: Optional[float]
    source: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


class GeofenceCheckResponse(BaseModel):
    """Geofence check result."""
    device_id: int
    geofence_id: int
    geofence_name: str
    is_inside: bool
    distance_meters: Optional[float]
    event_type: Optional[str]


class GeofenceEventResponse(BaseModel):
    """Geofence event response."""
    id: int
    geofence_id: int
    device_id: int
    event_type: str
    latitude: float
    longitude: float
    dwell_seconds: Optional[int]
    timestamp: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=GeofenceResponse)
def create_geofence(
    request: GeofenceCreate,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """Create a new geofence."""
    service = get_geofence_service(db)

    try:
        fence_type = GeofenceType(request.fence_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid fence type: {request.fence_type}")

    center = None
    if request.center_lat and request.center_lng:
        center = (request.center_lat, request.center_lng)

    boundary_points = None
    if request.boundary_points:
        boundary_points = [(p[0], p[1]) for p in request.boundary_points]

    geofence = service.create_geofence(
        organization_id=organization_id,
        name=request.name,
        fence_type=fence_type,
        center=center,
        radius=request.radius_meters,
        boundary_points=boundary_points,
        description=request.description,
        site_id=request.site_id,
        alert_on_enter=1 if request.alert_on_enter else 0,
        alert_on_exit=1 if request.alert_on_exit else 0,
        alert_on_dwell=1 if request.alert_on_dwell else 0,
        dwell_time_seconds=request.dwell_time_seconds,
        color=request.color
    )

    db.commit()

    return GeofenceResponse(
        id=geofence.id,
        name=geofence.name,
        description=geofence.description,
        fence_type=geofence.fence_type,
        center_lat=geofence.center_lat,
        center_lng=geofence.center_lng,
        radius_meters=geofence.radius_meters,
        alert_on_enter=geofence.alert_on_enter == 1,
        alert_on_exit=geofence.alert_on_exit == 1,
        color=geofence.color,
        is_active=geofence.is_active == 1,
        created_at=geofence.created_at
    )


@router.get("", response_model=List[GeofenceResponse])
def list_geofences(
    site_id: Optional[int] = None,
    db: Session = Depends(get_db),
    organization_id: int = 1
):
    """List all geofences."""
    service = get_geofence_service(db)
    geofences = service.get_geofences(organization_id, site_id)

    return [
        GeofenceResponse(
            id=g.id,
            name=g.name,
            description=g.description,
            fence_type=g.fence_type,
            center_lat=g.center_lat,
            center_lng=g.center_lng,
            radius_meters=g.radius_meters,
            alert_on_enter=g.alert_on_enter == 1,
            alert_on_exit=g.alert_on_exit == 1,
            color=g.color,
            is_active=g.is_active == 1,
            created_at=g.created_at
        )
        for g in geofences
    ]


@router.get("/{geofence_id}", response_model=GeofenceResponse)
def get_geofence(
    geofence_id: int,
    db: Session = Depends(get_db)
):
    """Get a geofence by ID."""
    from backend.app.services.geofence_service import Geofence

    geofence = db.query(Geofence).filter(Geofence.id == geofence_id).first()
    if not geofence:
        raise HTTPException(status_code=404, detail="Geofence not found")

    return GeofenceResponse(
        id=geofence.id,
        name=geofence.name,
        description=geofence.description,
        fence_type=geofence.fence_type,
        center_lat=geofence.center_lat,
        center_lng=geofence.center_lng,
        radius_meters=geofence.radius_meters,
        alert_on_enter=geofence.alert_on_enter == 1,
        alert_on_exit=geofence.alert_on_exit == 1,
        color=geofence.color,
        is_active=geofence.is_active == 1,
        created_at=geofence.created_at
    )


@router.delete("/{geofence_id}")
def delete_geofence(
    geofence_id: int,
    db: Session = Depends(get_db)
):
    """Delete a geofence."""
    from backend.app.services.geofence_service import Geofence

    geofence = db.query(Geofence).filter(Geofence.id == geofence_id).first()
    if not geofence:
        raise HTTPException(status_code=404, detail="Geofence not found")

    geofence.is_active = 0
    db.commit()

    return {"message": "Geofence deleted"}


@router.get("/{geofence_id}/devices")
def get_devices_in_geofence(
    geofence_id: int,
    db: Session = Depends(get_db)
):
    """Get all devices currently inside a geofence."""
    service = get_geofence_service(db)
    device_ids = service.get_devices_in_geofence(geofence_id)

    return {"geofence_id": geofence_id, "device_ids": device_ids, "count": len(device_ids)}


# Location endpoints
@router.post("/locations", response_model=List[GeofenceCheckResponse])
async def update_location(
    request: LocationUpdateRequest,
    db: Session = Depends(get_db)
):
    """Update device location and check geofences."""
    service = get_geofence_service(db)

    update = LocationUpdate(
        device_id=request.device_id,
        latitude=request.latitude,
        longitude=request.longitude,
        altitude=request.altitude,
        accuracy=request.accuracy,
        heading=request.heading,
        speed=request.speed,
        source=request.source
    )

    checks = await service.update_location(update)

    db.commit()

    return [
        GeofenceCheckResponse(
            device_id=c.device_id,
            geofence_id=c.geofence_id,
            geofence_name=c.geofence_name,
            is_inside=c.is_inside,
            distance_meters=c.distance_meters,
            event_type=c.event_type
        )
        for c in checks
    ]


@router.get("/locations/{device_id}", response_model=Optional[LocationResponse])
def get_device_location(
    device_id: int,
    db: Session = Depends(get_db)
):
    """Get latest device location."""
    service = get_geofence_service(db)
    location = service.get_device_location(device_id)

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    return LocationResponse(
        device_id=location.device_id,
        latitude=location.latitude,
        longitude=location.longitude,
        altitude=location.altitude,
        accuracy_meters=location.accuracy_meters,
        source=location.source,
        timestamp=location.timestamp
    )


@router.get("/locations/{device_id}/history", response_model=List[LocationResponse])
def get_location_history(
    device_id: int,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get device location history."""
    service = get_geofence_service(db)
    locations = service.get_device_history(device_id, start_time, end_time, limit)

    return [
        LocationResponse(
            device_id=l.device_id,
            latitude=l.latitude,
            longitude=l.longitude,
            altitude=l.altitude,
            accuracy_meters=l.accuracy_meters,
            source=l.source,
            timestamp=l.timestamp
        )
        for l in locations
    ]


# Events endpoints
@router.get("/events", response_model=List[GeofenceEventResponse])
def list_geofence_events(
    geofence_id: Optional[int] = None,
    device_id: Optional[int] = None,
    event_type: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """List geofence events."""
    service = get_geofence_service(db)

    event_type_enum = None
    if event_type:
        try:
            event_type_enum = GeofenceEventType(event_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid event type: {event_type}")

    events = service.get_geofence_events(
        geofence_id=geofence_id,
        device_id=device_id,
        event_type=event_type_enum,
        start_time=start_time,
        end_time=end_time,
        limit=limit
    )

    return [
        GeofenceEventResponse(
            id=e.id,
            geofence_id=e.geofence_id,
            device_id=e.device_id,
            event_type=e.event_type,
            latitude=e.latitude,
            longitude=e.longitude,
            dwell_seconds=e.dwell_seconds,
            timestamp=e.timestamp
        )
        for e in events
    ]
