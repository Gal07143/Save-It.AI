"""
Firmware OTA Service for SAVE-IT.AI
Over-the-air firmware updates:
- Version management
- Staged rollout
- Progress tracking
- Rollback capability
"""
import os
import json
import logging
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from backend.app.core.database import Base
from backend.app.models.devices import Device, DeviceProduct

logger = logging.getLogger(__name__)


class FirmwareStatus(Enum):
    """Firmware version status."""
    DRAFT = "draft"
    TESTING = "testing"
    RELEASED = "released"
    DEPRECATED = "deprecated"


class UpdateStatus(Enum):
    """Firmware update job status."""
    PENDING = "pending"
    DOWNLOADING = "downloading"
    INSTALLING = "installing"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


# Database Models
class Firmware(Base):
    """Firmware version record."""
    __tablename__ = "firmwares"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("device_products.id"), nullable=False, index=True)

    version = Column(String(50), nullable=False)
    display_name = Column(String(255), nullable=True)
    release_notes = Column(Text, nullable=True)

    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    checksum_md5 = Column(String(32), nullable=True)
    checksum_sha256 = Column(String(64), nullable=True)

    status = Column(String(20), default="draft")
    min_version = Column(String(50), nullable=True)  # Minimum version required to upgrade

    released_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FirmwareUpdate(Base):
    """Firmware update job for a device."""
    __tablename__ = "firmware_updates"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    firmware_id = Column(Integer, ForeignKey("firmwares.id"), nullable=False, index=True)

    correlation_id = Column(String(100), unique=True, nullable=False, index=True)

    status = Column(String(20), default="pending")
    progress_percent = Column(Integer, default=0)

    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    previous_version = Column(String(50), nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


@dataclass
class FirmwareJob:
    """Firmware update job info."""
    job_id: int
    correlation_id: str
    device_ids: List[int]
    firmware_id: int
    firmware_version: str
    scheduled_at: Optional[datetime]
    created_at: datetime


class FirmwareService:
    """
    Over-the-air firmware update service.
    Manages firmware versions and device updates.
    """

    def __init__(self, db: Session, storage_path: str = "/tmp/firmware", mqtt_client=None):
        self.db = db
        self.storage_path = storage_path
        self.mqtt_client = mqtt_client

        # Ensure storage directory exists
        os.makedirs(storage_path, exist_ok=True)

    def upload(
        self,
        product_id: int,
        version: str,
        file_content: bytes,
        release_notes: Optional[str] = None,
        min_version: Optional[str] = None
    ) -> Firmware:
        """
        Upload new firmware version.

        Args:
            product_id: Product ID this firmware is for
            version: Version string
            file_content: Firmware binary content
            release_notes: Release notes
            min_version: Minimum version required to upgrade

        Returns:
            Created Firmware record
        """
        # Check product exists
        product = self.db.query(DeviceProduct).filter(
            DeviceProduct.id == product_id
        ).first()
        if not product:
            raise ValueError(f"Product {product_id} not found")

        # Check version doesn't already exist
        existing = self.db.query(Firmware).filter(
            Firmware.product_id == product_id,
            Firmware.version == version
        ).first()
        if existing:
            raise ValueError(f"Firmware version {version} already exists for this product")

        # Calculate checksums
        md5_hash = hashlib.md5(file_content).hexdigest()
        sha256_hash = hashlib.sha256(file_content).hexdigest()

        # Save file
        filename = f"{product_id}_{version}_{sha256_hash[:8]}.bin"
        file_path = os.path.join(self.storage_path, filename)

        with open(file_path, "wb") as f:
            f.write(file_content)

        # Create database record
        firmware = Firmware(
            product_id=product_id,
            version=version,
            release_notes=release_notes,
            file_path=file_path,
            file_size_bytes=len(file_content),
            checksum_md5=md5_hash,
            checksum_sha256=sha256_hash,
            min_version=min_version,
            status="draft"
        )
        self.db.add(firmware)
        self.db.flush()

        logger.info(f"Firmware {version} uploaded for product {product_id}")

        return firmware

    def release(self, firmware_id: int) -> Firmware:
        """
        Mark firmware as released (available for deployment).

        Args:
            firmware_id: Firmware ID

        Returns:
            Updated Firmware record
        """
        firmware = self.db.query(Firmware).filter(Firmware.id == firmware_id).first()
        if not firmware:
            raise ValueError(f"Firmware {firmware_id} not found")

        firmware.status = "released"
        firmware.released_at = datetime.utcnow()

        logger.info(f"Firmware {firmware.version} released")

        return firmware

    def deprecate(self, firmware_id: int) -> Firmware:
        """
        Mark firmware as deprecated (no longer recommended).

        Args:
            firmware_id: Firmware ID

        Returns:
            Updated Firmware record
        """
        firmware = self.db.query(Firmware).filter(Firmware.id == firmware_id).first()
        if not firmware:
            raise ValueError(f"Firmware {firmware_id} not found")

        firmware.status = "deprecated"

        logger.info(f"Firmware {firmware.version} deprecated")

        return firmware

    def schedule_update(
        self,
        device_ids: List[int],
        firmware_id: int,
        scheduled_at: Optional[datetime] = None
    ) -> FirmwareJob:
        """
        Schedule firmware update for devices.

        Args:
            device_ids: List of device IDs to update
            firmware_id: Firmware version to deploy
            scheduled_at: When to start (None = immediately)

        Returns:
            FirmwareJob with job details
        """
        firmware = self.db.query(Firmware).filter(Firmware.id == firmware_id).first()
        if not firmware:
            raise ValueError(f"Firmware {firmware_id} not found")

        if firmware.status not in ["testing", "released"]:
            raise ValueError(f"Firmware must be in testing or released status")

        updates = []
        for device_id in device_ids:
            device = self.db.query(Device).filter(Device.id == device_id).first()
            if not device:
                logger.warning(f"Device {device_id} not found, skipping")
                continue

            # Check minimum version requirement
            if firmware.min_version and device.firmware_version:
                if device.firmware_version < firmware.min_version:
                    logger.warning(
                        f"Device {device_id} version {device.firmware_version} "
                        f"below minimum {firmware.min_version}, skipping"
                    )
                    continue

            correlation_id = str(uuid.uuid4())

            update = FirmwareUpdate(
                device_id=device_id,
                firmware_id=firmware_id,
                correlation_id=correlation_id,
                status="pending",
                scheduled_at=scheduled_at,
                previous_version=device.firmware_version
            )
            self.db.add(update)
            updates.append(update)

        self.db.flush()

        if not updates:
            raise ValueError("No eligible devices for firmware update")

        # If immediate, trigger updates
        if not scheduled_at or scheduled_at <= datetime.utcnow():
            for update in updates:
                self._push_update(update, firmware)

        logger.info(f"Scheduled firmware {firmware.version} for {len(updates)} devices")

        return FirmwareJob(
            job_id=updates[0].id if updates else 0,
            correlation_id=updates[0].correlation_id if updates else "",
            device_ids=[u.device_id for u in updates],
            firmware_id=firmware_id,
            firmware_version=firmware.version,
            scheduled_at=scheduled_at,
            created_at=datetime.utcnow()
        )

    def push_update(self, device_id: int, firmware_id: int) -> FirmwareUpdate:
        """
        Immediately push update to device.

        Args:
            device_id: Device ID
            firmware_id: Firmware ID

        Returns:
            FirmwareUpdate record
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        firmware = self.db.query(Firmware).filter(Firmware.id == firmware_id).first()

        if not device or not firmware:
            raise ValueError("Device or firmware not found")

        correlation_id = str(uuid.uuid4())

        update = FirmwareUpdate(
            device_id=device_id,
            firmware_id=firmware_id,
            correlation_id=correlation_id,
            status="pending",
            previous_version=device.firmware_version
        )
        self.db.add(update)
        self.db.flush()

        self._push_update(update, firmware)

        return update

    def _push_update(self, update: FirmwareUpdate, firmware: Firmware):
        """Push firmware update to device via MQTT."""
        if not self.mqtt_client:
            logger.warning(f"MQTT not available, update {update.id} queued")
            return

        device = self.db.query(Device).filter(Device.id == update.device_id).first()
        if not device:
            return

        topic = f"device/{device.mqtt_client_id or device.id}/firmware/update"
        payload = json.dumps({
            "correlation_id": update.correlation_id,
            "action": "update_firmware",
            "firmware": {
                "version": firmware.version,
                "url": f"/api/v1/firmwares/{firmware.id}/download",
                "size_bytes": firmware.file_size_bytes,
                "checksum_sha256": firmware.checksum_sha256,
                "release_notes": firmware.release_notes
            }
        })

        try:
            self.mqtt_client.publish(topic, payload)
            update.status = "downloading"
            update.started_at = datetime.utcnow()
            logger.info(f"Firmware update pushed to device {device.id}")
        except Exception as e:
            update.status = "failed"
            update.error_message = str(e)
            logger.error(f"Failed to push firmware update: {e}")

    def handle_progress(
        self,
        device_id: int,
        correlation_id: str,
        status: str,
        progress: int,
        error: Optional[str] = None
    ):
        """
        Handle update progress report from device.

        Args:
            device_id: Device ID
            correlation_id: Correlation ID
            status: Status (downloading, installing, completed, failed)
            progress: Progress percentage
            error: Error message if failed
        """
        update = self.db.query(FirmwareUpdate).filter(
            FirmwareUpdate.correlation_id == correlation_id
        ).first()

        if not update:
            logger.warning(f"Unknown firmware update correlation_id: {correlation_id}")
            return

        update.status = status
        update.progress_percent = progress

        if status == "completed":
            update.completed_at = datetime.utcnow()
            # Update device firmware version
            device = self.db.query(Device).filter(Device.id == device_id).first()
            if device:
                firmware = self.db.query(Firmware).filter(
                    Firmware.id == update.firmware_id
                ).first()
                if firmware:
                    device.firmware_version = firmware.version

            logger.info(f"Firmware update completed for device {device_id}")

        elif status == "failed":
            update.error_message = error
            update.completed_at = datetime.utcnow()
            logger.error(f"Firmware update failed for device {device_id}: {error}")

    def rollback(self, device_id: int) -> Optional[FirmwareUpdate]:
        """
        Rollback to previous firmware version.

        Args:
            device_id: Device ID

        Returns:
            New FirmwareUpdate for rollback or None
        """
        # Get last successful update
        last_update = self.db.query(FirmwareUpdate).filter(
            FirmwareUpdate.device_id == device_id,
            FirmwareUpdate.status == "completed"
        ).order_by(FirmwareUpdate.completed_at.desc()).first()

        if not last_update or not last_update.previous_version:
            logger.warning(f"No previous version to rollback to for device {device_id}")
            return None

        # Find firmware with previous version
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device or not device.product_id:
            return None

        prev_firmware = self.db.query(Firmware).filter(
            Firmware.product_id == device.product_id,
            Firmware.version == last_update.previous_version
        ).first()

        if not prev_firmware:
            logger.warning(f"Previous firmware {last_update.previous_version} not found")
            return None

        # Create rollback update
        return self.push_update(device_id, prev_firmware.id)

    def get_update_history(self, device_id: int, limit: int = 50) -> List[FirmwareUpdate]:
        """
        Get firmware update history for device.

        Args:
            device_id: Device ID
            limit: Max results

        Returns:
            List of FirmwareUpdate records
        """
        return self.db.query(FirmwareUpdate).filter(
            FirmwareUpdate.device_id == device_id
        ).order_by(FirmwareUpdate.created_at.desc()).limit(limit).all()

    def get_pending_updates(self) -> List[FirmwareUpdate]:
        """Get all pending firmware updates."""
        return self.db.query(FirmwareUpdate).filter(
            FirmwareUpdate.status == "pending"
        ).all()

    def get_firmware_versions(
        self,
        product_id: int,
        include_deprecated: bool = False
    ) -> List[Firmware]:
        """
        Get available firmware versions for a product.

        Args:
            product_id: Product ID
            include_deprecated: Include deprecated versions

        Returns:
            List of Firmware records
        """
        query = self.db.query(Firmware).filter(Firmware.product_id == product_id)

        if not include_deprecated:
            query = query.filter(Firmware.status != "deprecated")

        return query.order_by(Firmware.created_at.desc()).all()

    def delete_firmware(self, firmware_id: int) -> bool:
        """
        Delete firmware version (only if not deployed).

        Args:
            firmware_id: Firmware ID

        Returns:
            True if deleted
        """
        firmware = self.db.query(Firmware).filter(Firmware.id == firmware_id).first()
        if not firmware:
            return False

        # Check if deployed
        deployed = self.db.query(FirmwareUpdate).filter(
            FirmwareUpdate.firmware_id == firmware_id,
            FirmwareUpdate.status == "completed"
        ).count()

        if deployed > 0:
            raise ValueError("Cannot delete firmware that has been deployed to devices")

        # Delete file
        if os.path.exists(firmware.file_path):
            os.remove(firmware.file_path)

        self.db.delete(firmware)
        return True


def get_firmware_service(db: Session) -> FirmwareService:
    """Get FirmwareService instance."""
    return FirmwareService(db)
