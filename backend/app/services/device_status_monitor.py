"""Device Status Monitoring Service.

Provides background offline detection for devices based on telemetry timestamps.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.devices import Device


def check_device_offline_status(db: Session, offline_threshold_seconds: int = 300):
    """Mark devices as offline if no telemetry received within threshold.

    Args:
        db: Database session
        offline_threshold_seconds: Time in seconds after which a device is considered offline
            Default is 300 seconds (5 minutes)

    Returns:
        dict with counts of devices marked offline
    """
    cutoff = datetime.utcnow() - timedelta(seconds=offline_threshold_seconds)

    # Find devices that are marked online but haven't sent telemetry recently
    devices_to_mark_offline = db.query(Device).filter(
        Device.is_online == 1,
        Device.last_telemetry_at < cutoff
    ).all()

    offline_count = 0
    for device in devices_to_mark_offline:
        device.is_online = 0
        offline_count += 1

    if offline_count > 0:
        db.commit()

    return {
        "checked_at": datetime.utcnow().isoformat(),
        "threshold_seconds": offline_threshold_seconds,
        "devices_marked_offline": offline_count
    }


def get_device_status_summary(db: Session, site_id: int | None = None) -> dict:
    """Get summary of device online/offline status.

    Args:
        db: Database session
        site_id: Optional site filter

    Returns:
        dict with status counts
    """
    query = db.query(Device).filter(Device.is_active == 1)
    if site_id:
        query = query.filter(Device.site_id == site_id)

    devices = query.all()

    online_count = sum(1 for d in devices if d.is_online)
    offline_count = sum(1 for d in devices if not d.is_online)

    # Devices with errors (have last_error set)
    error_count = sum(1 for d in devices if d.last_error)

    # Devices that have never sent telemetry
    never_seen_count = sum(1 for d in devices if d.last_telemetry_at is None)

    return {
        "total_devices": len(devices),
        "online_count": online_count,
        "offline_count": offline_count,
        "error_count": error_count,
        "never_seen_count": never_seen_count,
        "online_percentage": round(online_count / len(devices) * 100, 1) if devices else 0
    }


def mark_device_online(db: Session, device_id: int) -> bool:
    """Mark a device as online when telemetry is received.

    Args:
        db: Database session
        device_id: Device ID to mark online

    Returns:
        True if device was found and updated
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return False

    now = datetime.utcnow()
    device.is_online = 1
    device.last_seen_at = now
    device.last_telemetry_at = now
    device.last_error = None  # Clear any previous error on successful telemetry

    db.commit()
    return True


def mark_device_error(db: Session, device_id: int, error_message: str) -> bool:
    """Mark a device with an error.

    Args:
        db: Database session
        device_id: Device ID
        error_message: Error message to record

    Returns:
        True if device was found and updated
    """
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        return False

    device.last_error = error_message
    device.last_seen_at = datetime.utcnow()

    db.commit()
    return True
