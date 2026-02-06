"""
Configuration Sync Service for SAVE-IT.AI
Pushes configuration to edge devices:
- Device settings
- Modbus register maps
- Alarm rules for edge evaluation
- Polling intervals
"""
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum

from sqlalchemy.orm import Session

from app.models.devices import (
    Device, DeviceModel, Datapoint, AlarmRule, RemoteModbusConfig, ConfigSyncStatus
)
from app.models.integrations import Gateway, ModbusRegister

logger = logging.getLogger(__name__)


class ConfigType(Enum):
    """Types of configuration that can be synced."""
    FULL = "full"
    SETTINGS = "settings"
    MODBUS = "modbus"
    ALARMS = "alarms"
    POLLING = "polling"


@dataclass
class SyncResult:
    """Result of configuration sync attempt."""
    success: bool
    device_id: int
    config_type: str
    correlation_id: str
    message: str
    timestamp: datetime
    config_size_bytes: int = 0


@dataclass
class ConfigSyncStatus:
    """Status of device configuration sync."""
    device_id: int
    status: str  # pending, syncing, synced, failed
    last_sync_at: Optional[datetime]
    last_error: Optional[str]
    pending_configs: List[str]
    retry_count: int


class ConfigSyncService:
    """
    Pushes configuration to edge devices.
    Handles full and partial config syncs with retry logic.
    """

    def __init__(self, db: Session, mqtt_client=None):
        self.db = db
        self.mqtt_client = mqtt_client
        self._pending_syncs: Dict[str, Dict[str, Any]] = {}  # correlation_id -> sync info
        self._retry_queue: List[Dict[str, Any]] = []

    def push_full_config(self, device_id: int) -> SyncResult:
        """
        Push complete configuration to device.

        Args:
            device_id: Device ID

        Returns:
            SyncResult with status
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return SyncResult(
                success=False,
                device_id=device_id,
                config_type="full",
                correlation_id="",
                message="Device not found",
                timestamp=datetime.utcnow()
            )

        # Build full configuration
        config = self._build_full_config(device)
        correlation_id = str(uuid.uuid4())

        # Send via MQTT
        result = self._send_config(device, config, correlation_id, ConfigType.FULL)

        if result.success:
            device.config_sync_status = "syncing"
            self._pending_syncs[correlation_id] = {
                "device_id": device_id,
                "config_type": "full",
                "sent_at": datetime.utcnow(),
                "config": config
            }

        return result

    def push_partial_config(
        self,
        device_id: int,
        config_keys: List[str]
    ) -> SyncResult:
        """
        Push specific configuration items.

        Args:
            device_id: Device ID
            config_keys: List of config keys to push (settings, modbus, alarms, polling)

        Returns:
            SyncResult with status
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return SyncResult(
                success=False,
                device_id=device_id,
                config_type="partial",
                correlation_id="",
                message="Device not found",
                timestamp=datetime.utcnow()
            )

        # Build partial configuration
        config = {}
        for key in config_keys:
            if key == "settings":
                config["settings"] = self._build_settings_config(device)
            elif key == "modbus":
                config["modbus"] = self._build_modbus_config(device)
            elif key == "alarms":
                config["alarms"] = self._build_alarms_config(device)
            elif key == "polling":
                config["polling"] = self._build_polling_config(device)

        correlation_id = str(uuid.uuid4())
        result = self._send_config(device, config, correlation_id, ConfigType.SETTINGS)

        if result.success:
            self._pending_syncs[correlation_id] = {
                "device_id": device_id,
                "config_type": "partial",
                "config_keys": config_keys,
                "sent_at": datetime.utcnow()
            }

        return result

    def push_modbus_config(self, gateway_id: int, device_id: int) -> SyncResult:
        """
        Push Modbus register configuration to gateway for a peripheral device.

        Args:
            gateway_id: Gateway ID
            device_id: Peripheral device ID

        Returns:
            SyncResult with status
        """
        gateway = self.db.query(Gateway).filter(Gateway.id == gateway_id).first()
        device = self.db.query(Device).filter(Device.id == device_id).first()

        if not gateway or not device:
            return SyncResult(
                success=False,
                device_id=device_id,
                config_type="modbus",
                correlation_id="",
                message="Gateway or device not found",
                timestamp=datetime.utcnow()
            )

        # Get or create RemoteModbusConfig
        remote_config = self.db.query(RemoteModbusConfig).filter(
            RemoteModbusConfig.device_id == device_id,
            RemoteModbusConfig.gateway_id == gateway_id
        ).first()

        if not remote_config:
            remote_config = RemoteModbusConfig(
                device_id=device_id,
                gateway_id=gateway_id,
                slave_id=device.slave_id or 1,
                host=device.ip_address,
                port=device.port or 502,
                polling_interval_ms=1000
            )
            self.db.add(remote_config)
            self.db.flush()

        # Build Modbus configuration
        config = {
            "device_id": device_id,
            "edge_key": device.edge_key,
            "slave_id": remote_config.slave_id,
            "protocol": remote_config.protocol,
            "host": remote_config.host,
            "port": remote_config.port,
            "polling_interval_ms": remote_config.polling_interval_ms,
            "timeout_ms": remote_config.timeout_ms,
            "retries": remote_config.retries,
            "registers": self._build_register_list(device)
        }

        correlation_id = str(uuid.uuid4())

        # Send to gateway
        topic = f"gateway/{gateway.mqtt_client_id or gateway_id}/config/modbus"
        payload = json.dumps({
            "correlation_id": correlation_id,
            "action": "configure_device",
            "config": config
        })

        if self.mqtt_client:
            try:
                self.mqtt_client.publish(topic, payload)
                remote_config.sync_status = "syncing"
                return SyncResult(
                    success=True,
                    device_id=device_id,
                    config_type="modbus",
                    correlation_id=correlation_id,
                    message="Modbus config sent to gateway",
                    timestamp=datetime.utcnow(),
                    config_size_bytes=len(payload)
                )
            except Exception as e:
                logger.error(f"Failed to send Modbus config: {e}")
                return SyncResult(
                    success=False,
                    device_id=device_id,
                    config_type="modbus",
                    correlation_id=correlation_id,
                    message=str(e),
                    timestamp=datetime.utcnow()
                )

        # No MQTT client - mark for retry
        remote_config.sync_status = "pending"
        return SyncResult(
            success=False,
            device_id=device_id,
            config_type="modbus",
            correlation_id=correlation_id,
            message="MQTT client not available",
            timestamp=datetime.utcnow()
        )

    def handle_ack(
        self,
        device_id: int,
        correlation_id: str,
        success: bool,
        error: Optional[str] = None
    ):
        """
        Handle configuration acknowledgment from device.

        Args:
            device_id: Device ID
            correlation_id: Correlation ID from config push
            success: Whether device accepted config
            error: Error message if failed
        """
        pending = self._pending_syncs.pop(correlation_id, None)

        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return

        if success:
            device.config_sync_status = "synced"
            device.config_last_synced_at = datetime.utcnow()
            device.last_error = None
            logger.info(f"Config sync successful for device {device_id}")
        else:
            device.config_sync_status = "failed"
            device.last_error = error

            # Add to retry queue
            if pending:
                self._retry_queue.append({
                    "device_id": device_id,
                    "config_type": pending.get("config_type"),
                    "config_keys": pending.get("config_keys"),
                    "retry_count": pending.get("retry_count", 0) + 1,
                    "last_error": error
                })

            logger.warning(f"Config sync failed for device {device_id}: {error}")

    async def retry_failed(self, max_retries: int = 3) -> int:
        """
        Retry all failed configuration syncs.

        Args:
            max_retries: Maximum retry attempts per device

        Returns:
            Count of retried syncs
        """
        retried = 0

        # Process retry queue
        to_retry = [r for r in self._retry_queue if r.get("retry_count", 0) < max_retries]
        self._retry_queue = [r for r in self._retry_queue if r.get("retry_count", 0) >= max_retries]

        for item in to_retry:
            device_id = item["device_id"]
            config_type = item.get("config_type")

            if config_type == "full":
                result = self.push_full_config(device_id)
            elif config_type == "partial":
                config_keys = item.get("config_keys", [])
                result = self.push_partial_config(device_id, config_keys)
            else:
                continue

            if result.success:
                retried += 1

        # Also retry devices with failed status in database
        failed_devices = self.db.query(Device).filter(
            Device.config_sync_status == "failed",
            Device.is_active == 1
        ).all()

        for device in failed_devices:
            result = self.push_full_config(device.id)
            if result.success:
                retried += 1

        logger.info(f"Retried {retried} failed config syncs")
        return retried

    def get_sync_status(self, device_id: int) -> Dict[str, Any]:
        """
        Get current sync status for a device.

        Args:
            device_id: Device ID

        Returns:
            Dict with sync status details
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return {"error": "Device not found"}

        # Check for pending syncs
        pending = [
            {"correlation_id": cid, "type": info.get("config_type")}
            for cid, info in self._pending_syncs.items()
            if info.get("device_id") == device_id
        ]

        return {
            "device_id": device_id,
            "status": device.config_sync_status or "unknown",
            "last_sync_at": device.config_last_synced_at.isoformat() if device.config_last_synced_at else None,
            "last_error": device.last_error,
            "pending_syncs": pending,
            "in_retry_queue": any(r.get("device_id") == device_id for r in self._retry_queue)
        }

    def _build_full_config(self, device: Device) -> Dict[str, Any]:
        """Build complete device configuration."""
        return {
            "device_id": device.id,
            "name": device.name,
            "settings": self._build_settings_config(device),
            "modbus": self._build_modbus_config(device),
            "alarms": self._build_alarms_config(device),
            "polling": self._build_polling_config(device),
            "timestamp": datetime.utcnow().isoformat()
        }

    def _build_settings_config(self, device: Device) -> Dict[str, Any]:
        """Build device settings configuration."""
        return {
            "device_type": device.device_type.value if device.device_type else None,
            "auth_type": device.auth_type.value if device.auth_type else None,
            "firmware_version": device.firmware_version,
            "custom_config": json.loads(device.config_json) if device.config_json else {}
        }

    def _build_modbus_config(self, device: Device) -> Dict[str, Any]:
        """Build Modbus configuration."""
        registers = self._build_register_list(device)

        return {
            "enabled": bool(registers),
            "slave_id": device.slave_id,
            "protocol": "modbus_tcp",
            "registers": registers
        }

    def _build_register_list(self, device: Device) -> List[Dict[str, Any]]:
        """Build list of Modbus registers for device."""
        # Get registers from data source if linked
        registers = []

        # Query ModbusRegister for this device's data source
        modbus_regs = self.db.query(ModbusRegister).filter(
            ModbusRegister.is_active == 1
        ).all()

        for reg in modbus_regs:
            registers.append({
                "address": reg.register_address,
                "name": reg.name,
                "type": reg.register_type,
                "data_type": reg.data_type,
                "byte_order": reg.byte_order,
                "count": reg.register_count,
                "scale_factor": reg.scale_factor,
                "offset": reg.offset,
                "unit": reg.unit
            })

        return registers

    def _build_alarms_config(self, device: Device) -> List[Dict[str, Any]]:
        """Build alarm rules configuration for edge evaluation."""
        if not device.model_id:
            return []

        rules = self.db.query(AlarmRule).filter(
            AlarmRule.model_id == device.model_id,
            AlarmRule.is_active == 1
        ).all()

        return [
            {
                "id": rule.id,
                "name": rule.name,
                "datapoint_id": rule.datapoint_id,
                "condition": rule.condition.value,
                "threshold": rule.threshold_value,
                "threshold2": rule.threshold_value_2,
                "duration_seconds": rule.duration_seconds,
                "severity": rule.severity.value,
                "auto_clear": bool(rule.auto_clear)
            }
            for rule in rules
        ]

    def _build_polling_config(self, device: Device) -> Dict[str, Any]:
        """Build polling configuration."""
        return {
            "enabled": True,
            "interval_ms": 1000,
            "batch_size": 10,
            "timeout_ms": 5000,
            "retries": 3
        }

    def _send_config(
        self,
        device: Device,
        config: Dict[str, Any],
        correlation_id: str,
        config_type: ConfigType
    ) -> SyncResult:
        """Send configuration to device via MQTT."""
        topic = f"device/{device.mqtt_client_id or device.id}/config"
        payload = json.dumps({
            "correlation_id": correlation_id,
            "action": "update_config",
            "config_type": config_type.value,
            "config": config,
            "timestamp": datetime.utcnow().isoformat()
        })

        if self.mqtt_client:
            try:
                self.mqtt_client.publish(topic, payload)
                return SyncResult(
                    success=True,
                    device_id=device.id,
                    config_type=config_type.value,
                    correlation_id=correlation_id,
                    message="Config sent successfully",
                    timestamp=datetime.utcnow(),
                    config_size_bytes=len(payload)
                )
            except Exception as e:
                logger.error(f"Failed to send config to device {device.id}: {e}")
                return SyncResult(
                    success=False,
                    device_id=device.id,
                    config_type=config_type.value,
                    correlation_id=correlation_id,
                    message=str(e),
                    timestamp=datetime.utcnow()
                )

        # No MQTT client available
        logger.warning(f"MQTT client not available, config queued for device {device.id}")
        return SyncResult(
            success=False,
            device_id=device.id,
            config_type=config_type.value,
            correlation_id=correlation_id,
            message="MQTT client not available",
            timestamp=datetime.utcnow()
        )


def get_config_sync_service(db: Session, mqtt_client=None) -> ConfigSyncService:
    """Get ConfigSyncService instance."""
    return ConfigSyncService(db, mqtt_client)
