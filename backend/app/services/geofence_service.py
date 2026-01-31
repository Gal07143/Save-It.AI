"""
Geofence Service for SAVE-IT.AI
Location-based device management:
- Geofence definitions
- Device location tracking
- Entry/exit events
- Boundary alerts
"""
import json
import math
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Float

from backend.app.core.database import Base

logger = logging.getLogger(__name__)


class GeofenceType(Enum):
    """Types of geofence shapes."""
    CIRCLE = "circle"
    POLYGON = "polygon"
    RECTANGLE = "rectangle"


class GeofenceEventType(Enum):
    """Geofence event types."""
    ENTER = "enter"
    EXIT = "exit"
    DWELL = "dwell"


class Geofence(Base):
    """Geofence definition."""
    __tablename__ = "geofences"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    fence_type = Column(String(20), nullable=False)  # circle, polygon, rectangle

    # For circle: center point
    center_lat = Column(Float, nullable=True)
    center_lng = Column(Float, nullable=True)
    radius_meters = Column(Float, nullable=True)

    # For polygon/rectangle: array of points
    boundary_points = Column(Text, nullable=True)  # JSON array of [lat, lng]

    # Alert configuration
    alert_on_enter = Column(Integer, default=1)
    alert_on_exit = Column(Integer, default=1)
    alert_on_dwell = Column(Integer, default=0)
    dwell_time_seconds = Column(Integer, default=300)  # 5 minutes

    is_active = Column(Integer, default=1)
    color = Column(String(20), nullable=True)  # For map display

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DeviceLocation(Base):
    """Device location history."""
    __tablename__ = "device_locations"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)

    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    altitude = Column(Float, nullable=True)
    accuracy_meters = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)

    source = Column(String(50), nullable=True)  # gps, wifi, cell, manual

    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class GeofenceEvent(Base):
    """Geofence crossing event."""
    __tablename__ = "geofence_events"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    geofence_id = Column(Integer, ForeignKey("geofences.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)

    event_type = Column(String(20), nullable=False)  # enter, exit, dwell
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    entered_at = Column(DateTime, nullable=True)
    exited_at = Column(DateTime, nullable=True)
    dwell_seconds = Column(Integer, nullable=True)

    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


@dataclass
class LocationUpdate:
    """Location update data."""
    device_id: int
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None
    source: str = "gps"
    timestamp: Optional[datetime] = None


@dataclass
class GeofenceCheck:
    """Result of checking device against geofences."""
    device_id: int
    geofence_id: int
    geofence_name: str
    is_inside: bool
    distance_meters: Optional[float] = None
    event_type: Optional[str] = None


class GeofenceService:
    """
    Geofence management service.
    Handles location tracking and boundary detection.
    """

    # Earth's radius in meters
    EARTH_RADIUS = 6371000

    def __init__(self, db: Session):
        self.db = db
        # Track device states for enter/exit detection
        self._device_states: Dict[int, Dict[int, bool]] = {}  # device_id -> {geofence_id -> is_inside}
        self._dwell_timers: Dict[str, datetime] = {}  # device_geofence key -> enter_time

    def create_geofence(
        self,
        organization_id: int,
        name: str,
        fence_type: GeofenceType,
        center: Optional[Tuple[float, float]] = None,
        radius: Optional[float] = None,
        boundary_points: Optional[List[Tuple[float, float]]] = None,
        **kwargs
    ) -> Geofence:
        """
        Create a new geofence.

        Args:
            organization_id: Organization ID
            name: Geofence name
            fence_type: Type of geofence
            center: Center point for circle (lat, lng)
            radius: Radius in meters for circle
            boundary_points: List of (lat, lng) for polygon

        Returns:
            Created Geofence
        """
        geofence = Geofence(
            organization_id=organization_id,
            name=name,
            fence_type=fence_type.value,
            **kwargs
        )

        if fence_type == GeofenceType.CIRCLE:
            if not center or not radius:
                raise ValueError("Circle geofence requires center and radius")
            geofence.center_lat = center[0]
            geofence.center_lng = center[1]
            geofence.radius_meters = radius

        elif fence_type in [GeofenceType.POLYGON, GeofenceType.RECTANGLE]:
            if not boundary_points or len(boundary_points) < 3:
                raise ValueError("Polygon geofence requires at least 3 points")
            geofence.boundary_points = json.dumps(boundary_points)

        self.db.add(geofence)
        self.db.flush()

        logger.info(f"Created geofence: {name} (ID: {geofence.id})")

        return geofence

    def update_location(
        self,
        update: LocationUpdate
    ) -> List[GeofenceCheck]:
        """
        Update device location and check geofences.

        Args:
            update: Location update data

        Returns:
            List of geofence events triggered
        """
        # Store location
        location = DeviceLocation(
            device_id=update.device_id,
            latitude=update.latitude,
            longitude=update.longitude,
            altitude=update.altitude,
            accuracy_meters=update.accuracy,
            heading=update.heading,
            speed=update.speed,
            source=update.source,
            timestamp=update.timestamp or datetime.utcnow()
        )

        self.db.add(location)

        # Check all active geofences
        geofences = self.db.query(Geofence).filter(
            Geofence.is_active == 1
        ).all()

        results = []

        for geofence in geofences:
            check = self._check_geofence(
                device_id=update.device_id,
                lat=update.latitude,
                lng=update.longitude,
                geofence=geofence
            )
            results.append(check)

            # Handle state changes
            if check.event_type:
                self._record_event(check, update)

        return results

    def _check_geofence(
        self,
        device_id: int,
        lat: float,
        lng: float,
        geofence: Geofence
    ) -> GeofenceCheck:
        """Check if device is inside geofence."""
        is_inside = False
        distance = None
        event_type = None

        if geofence.fence_type == GeofenceType.CIRCLE.value:
            distance = self._haversine_distance(
                lat, lng,
                geofence.center_lat, geofence.center_lng
            )
            is_inside = distance <= geofence.radius_meters

        elif geofence.fence_type in [GeofenceType.POLYGON.value, GeofenceType.RECTANGLE.value]:
            points = json.loads(geofence.boundary_points) if geofence.boundary_points else []
            is_inside = self._point_in_polygon(lat, lng, points)

        # Determine event type based on state change
        prev_state = self._device_states.get(device_id, {}).get(geofence.id)

        if prev_state is None:
            # First check, just record state
            pass
        elif prev_state and not is_inside:
            event_type = GeofenceEventType.EXIT.value
        elif not prev_state and is_inside:
            event_type = GeofenceEventType.ENTER.value
        elif is_inside and geofence.alert_on_dwell:
            # Check dwell time
            key = f"{device_id}_{geofence.id}"
            if key not in self._dwell_timers:
                self._dwell_timers[key] = datetime.utcnow()
            else:
                dwell_seconds = (datetime.utcnow() - self._dwell_timers[key]).total_seconds()
                if dwell_seconds >= geofence.dwell_time_seconds:
                    event_type = GeofenceEventType.DWELL.value
                    self._dwell_timers[key] = datetime.utcnow()  # Reset timer

        # Update state
        if device_id not in self._device_states:
            self._device_states[device_id] = {}
        self._device_states[device_id][geofence.id] = is_inside

        return GeofenceCheck(
            device_id=device_id,
            geofence_id=geofence.id,
            geofence_name=geofence.name,
            is_inside=is_inside,
            distance_meters=distance,
            event_type=event_type
        )

    def _record_event(self, check: GeofenceCheck, update: LocationUpdate):
        """Record geofence event."""
        event = GeofenceEvent(
            geofence_id=check.geofence_id,
            device_id=check.device_id,
            event_type=check.event_type,
            latitude=update.latitude,
            longitude=update.longitude,
            timestamp=update.timestamp or datetime.utcnow()
        )

        if check.event_type == GeofenceEventType.ENTER.value:
            event.entered_at = datetime.utcnow()
        elif check.event_type == GeofenceEventType.EXIT.value:
            event.exited_at = datetime.utcnow()
            # Calculate dwell time from last enter
            key = f"{check.device_id}_{check.geofence_id}"
            if key in self._dwell_timers:
                event.dwell_seconds = int(
                    (datetime.utcnow() - self._dwell_timers[key]).total_seconds()
                )
                del self._dwell_timers[key]

        self.db.add(event)

        logger.info(f"Geofence event: Device {check.device_id} {check.event_type} {check.geofence_name}")

    def _haversine_distance(
        self,
        lat1: float,
        lng1: float,
        lat2: float,
        lng2: float
    ) -> float:
        """Calculate distance between two points in meters."""
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lng = math.radians(lng2 - lng1)

        a = (math.sin(delta_lat / 2) ** 2 +
             math.cos(lat1_rad) * math.cos(lat2_rad) *
             math.sin(delta_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return self.EARTH_RADIUS * c

    def _point_in_polygon(
        self,
        lat: float,
        lng: float,
        polygon: List[List[float]]
    ) -> bool:
        """Check if point is inside polygon using ray casting."""
        n = len(polygon)
        if n < 3:
            return False

        inside = False

        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]

            if ((yi > lng) != (yj > lng)) and (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi):
                inside = not inside

            j = i

        return inside

    def get_device_location(
        self,
        device_id: int
    ) -> Optional[DeviceLocation]:
        """Get latest device location."""
        return self.db.query(DeviceLocation).filter(
            DeviceLocation.device_id == device_id
        ).order_by(DeviceLocation.timestamp.desc()).first()

    def get_device_history(
        self,
        device_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[DeviceLocation]:
        """Get device location history."""
        query = self.db.query(DeviceLocation).filter(
            DeviceLocation.device_id == device_id
        )

        if start_time:
            query = query.filter(DeviceLocation.timestamp >= start_time)
        if end_time:
            query = query.filter(DeviceLocation.timestamp <= end_time)

        return query.order_by(
            DeviceLocation.timestamp.desc()
        ).limit(limit).all()

    def get_devices_in_geofence(
        self,
        geofence_id: int
    ) -> List[int]:
        """Get all devices currently inside a geofence."""
        geofence = self.db.query(Geofence).filter(
            Geofence.id == geofence_id
        ).first()

        if not geofence:
            return []

        # Get latest location for all devices
        from backend.app.models.devices import Device

        devices = self.db.query(Device).filter(Device.is_active == 1).all()
        inside_devices = []

        for device in devices:
            location = self.get_device_location(device.id)
            if location:
                check = self._check_geofence(
                    device_id=device.id,
                    lat=location.latitude,
                    lng=location.longitude,
                    geofence=geofence
                )
                if check.is_inside:
                    inside_devices.append(device.id)

        return inside_devices

    def get_geofence_events(
        self,
        geofence_id: Optional[int] = None,
        device_id: Optional[int] = None,
        event_type: Optional[GeofenceEventType] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[GeofenceEvent]:
        """Query geofence events."""
        query = self.db.query(GeofenceEvent)

        if geofence_id:
            query = query.filter(GeofenceEvent.geofence_id == geofence_id)
        if device_id:
            query = query.filter(GeofenceEvent.device_id == device_id)
        if event_type:
            query = query.filter(GeofenceEvent.event_type == event_type.value)
        if start_time:
            query = query.filter(GeofenceEvent.timestamp >= start_time)
        if end_time:
            query = query.filter(GeofenceEvent.timestamp <= end_time)

        return query.order_by(
            GeofenceEvent.timestamp.desc()
        ).limit(limit).all()

    def get_geofences(
        self,
        organization_id: int,
        site_id: Optional[int] = None
    ) -> List[Geofence]:
        """Get geofences for organization."""
        query = self.db.query(Geofence).filter(
            Geofence.organization_id == organization_id,
            Geofence.is_active == 1
        )

        if site_id:
            query = query.filter(Geofence.site_id == site_id)

        return query.all()


def get_geofence_service(db: Session) -> GeofenceService:
    """Get GeofenceService instance."""
    return GeofenceService(db)
