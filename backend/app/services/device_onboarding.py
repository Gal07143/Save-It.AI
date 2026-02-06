"""
Device Onboarding Service for SAVE-IT.AI
Handles device registration, credential generation, and edge key resolution.
"""
import secrets
import hashlib
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.devices import (
    Device, DeviceModel, DeviceProduct, Datapoint, DeviceDatapoint,
    DevicePolicy, DeviceType, AuthType, ConfigSyncStatus
)
from app.models.integrations import Gateway, GatewayCredentials

logger = logging.getLogger(__name__)


class DeviceOnboardingService:
    """
    Manages device registration and credential generation.
    Implements Zoho IoT-style device onboarding flow.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def register_device(
        self,
        site_id: int,
        name: str,
        device_type: DeviceType,
        model_id: Optional[int] = None,
        product_id: Optional[int] = None,
        gateway_id: Optional[int] = None,
        edge_key: Optional[str] = None,
        asset_id: Optional[int] = None,
        auth_type: AuthType = AuthType.TOKEN,
        policy_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        port: Optional[int] = None,
        slave_id: Optional[int] = None,
        serial_number: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Register a new device and generate credentials.
        Returns device info and connection credentials.

        Note: This method does not commit the transaction. The caller is
        responsible for committing or rolling back based on the outcome.
        All operations are performed within a consistent transaction state.
        """
        if device_type == DeviceType.PERIPHERAL and not gateway_id:
            raise ValueError("Peripheral devices require a gateway_id")

        if gateway_id and edge_key:
            existing = self.db.query(Device).filter(
                Device.gateway_id == gateway_id,
                Device.edge_key == edge_key,
                Device.is_active == 1
            ).first()
            if existing:
                raise ValueError(f"Edge key '{edge_key}' already in use for this gateway")

        if not edge_key and gateway_id:
            edge_key = f"dev_{secrets.token_hex(4)}"

        credentials = self._generate_credentials(device_type, auth_type)

        device = Device(
            site_id=site_id,
            name=name,
            device_type=device_type,
            model_id=model_id,
            product_id=product_id,
            gateway_id=gateway_id,
            edge_key=edge_key,
            asset_id=asset_id,
            auth_type=auth_type,
            policy_id=policy_id,
            ip_address=ip_address,
            port=port,
            slave_id=slave_id,
            serial_number=serial_number,
            description=description,
            mqtt_client_id=credentials.get("mqtt_client_id"),
            mqtt_username=credentials.get("mqtt_username"),
            mqtt_password_hash=credentials.get("mqtt_password_hash"),
            api_token=credentials.get("api_token"),
            is_active=1,
            is_online=0,
            config_sync_status=ConfigSyncStatus.PENDING,
        )

        try:
            self.db.add(device)
            self.db.flush()

            if model_id:
                self._propagate_model_datapoints(device.id, model_id)

            formatted_credentials = self._format_credentials(device, credentials)

            logger.info(f"Registered device {device.id}: {name} ({device_type.value})")

            return {
                "device": device,
                "credentials": formatted_credentials,
            }
        except Exception as e:
            # Rollback on any error to ensure consistent state
            self.db.rollback()
            logger.error(f"Failed to register device {name}: {e}")
            raise
    
    def _generate_credentials(
        self,
        device_type: DeviceType,
        auth_type: AuthType,
    ) -> Dict[str, Any]:
        """Generate authentication credentials based on device type and auth method."""
        credentials = {}
        
        if auth_type in [AuthType.TOKEN, AuthType.TOKEN_TLS]:
            client_id = f"device_{secrets.token_hex(8)}"
            username = f"dev_{secrets.token_hex(6)}"
            password = secrets.token_urlsafe(32)
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            credentials["mqtt_client_id"] = client_id
            credentials["mqtt_username"] = username
            credentials["mqtt_password"] = password
            credentials["mqtt_password_hash"] = password_hash
        
        if auth_type == AuthType.API_KEY:
            api_token = f"sav_{secrets.token_urlsafe(48)}"
            credentials["api_token"] = api_token
        
        return credentials
    
    def _format_credentials(
        self,
        device: Device,
        raw_credentials: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Format credentials for client consumption."""
        formatted = {
            "device_id": device.id,
            "device_type": device.device_type.value,
            "auth_type": device.auth_type.value,
        }
        
        if device.auth_type in [AuthType.TOKEN, AuthType.TOKEN_TLS]:
            import os
            mqtt_host = os.getenv("MQTT_BROKER_HOST", "localhost")
            mqtt_port = os.getenv("MQTT_BROKER_PORT", "1883")
            formatted["mqtt_broker_url"] = f"mqtt://{mqtt_host}:{mqtt_port}"
            formatted["mqtt_client_id"] = raw_credentials.get("mqtt_client_id")
            formatted["mqtt_username"] = raw_credentials.get("mqtt_username")
            formatted["mqtt_password"] = raw_credentials.get("mqtt_password")
            formatted["mqtt_topics"] = {
                "telemetry": f"device/{device.id}/telemetry",
                "events": f"device/{device.id}/events",
                "command": f"device/{device.id}/command",
                "command_ack": f"device/{device.id}/commands/ack",
            }
        
        if device.auth_type == AuthType.API_KEY:
            import os
            api_base = os.getenv("API_BASE_URL", "")
            formatted["webhook_url"] = f"{api_base}/api/v1/devices/{device.id}/telemetry"
            formatted["webhook_api_key"] = raw_credentials.get("api_token")
        
        if device.device_type == DeviceType.GATEWAY:
            formatted["gateway_topics"] = {
                "data": f"gateway/{device.id}/+/data",
                "status": f"gateway/{device.id}/status",
                "config": f"gateway/{device.id}/config",
            }
        
        return formatted
    
    def _propagate_model_datapoints(self, device_id: int, model_id: int):
        """Create DeviceDatapoint entries for all model datapoints."""
        datapoints = self.db.query(Datapoint).filter(
            Datapoint.model_id == model_id
        ).all()
        
        for dp in datapoints:
            device_dp = DeviceDatapoint(
                device_id=device_id,
                datapoint_id=dp.id,
                quality="unknown",
            )
            self.db.add(device_dp)
    
    def regenerate_credentials(self, device_id: int) -> Dict[str, Any]:
        """Regenerate credentials for an existing device."""
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            raise ValueError(f"Device {device_id} not found")
        
        credentials = self._generate_credentials(device.device_type, device.auth_type)
        
        device.mqtt_client_id = credentials.get("mqtt_client_id")
        device.mqtt_username = credentials.get("mqtt_username")
        device.mqtt_password_hash = credentials.get("mqtt_password_hash")
        device.api_token = credentials.get("api_token")
        device.updated_at = datetime.utcnow()
        
        logger.info(f"Regenerated credentials for device {device_id}")
        
        return self._format_credentials(device, credentials)
    
    def get_device_by_gateway_edge_key(
        self,
        gateway_id: int,
        edge_key: str,
    ) -> Optional[Device]:
        """Resolve device by gateway ID and edge key."""
        return self.db.query(Device).filter(
            Device.gateway_id == gateway_id,
            Device.edge_key == edge_key,
            Device.is_active == 1
        ).first()
    
    def get_devices_by_gateway(self, gateway_id: int) -> List[Device]:
        """Get all devices connected to a gateway."""
        return self.db.query(Device).filter(
            Device.gateway_id == gateway_id,
            Device.is_active == 1
        ).all()
    
    def update_device_status(
        self,
        device_id: int,
        is_online: bool,
        last_error: Optional[str] = None,
    ):
        """Update device online status."""
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if device:
            device.is_online = 1 if is_online else 0
            device.last_seen_at = datetime.utcnow()
            if last_error:
                device.last_error = last_error


class EdgeKeyResolver:
    """
    Resolves device identity from gateway and edge key.
    Used by MQTT/webhook handlers to route incoming data.
    """
    
    CACHE_TTL_SECONDS = 300
    
    def __init__(self, db: Session):
        self.db = db
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[str, datetime] = {}
    
    def resolve(
        self,
        gateway_id: Optional[int] = None,
        edge_key: Optional[str] = None,
        device_id: Optional[int] = None,
        mqtt_username: Optional[str] = None,
        api_token: Optional[str] = None,
    ) -> Optional[Device]:
        """
        Resolve device from various identifiers.
        Priority: device_id > gateway_id+edge_key > mqtt_username > api_token
        """
        if device_id:
            return self.db.query(Device).filter(
                Device.id == device_id,
                Device.is_active == 1
            ).first()
        
        if gateway_id and edge_key:
            cache_key = f"{gateway_id}:{edge_key}"
            
            if cache_key in self._cache:
                cached_at = self._cache_timestamps.get(cache_key)
                if cached_at and (datetime.utcnow() - cached_at).total_seconds() < self.CACHE_TTL_SECONDS:
                    cached_device_id = self._cache[cache_key].get("device_id")
                    return self.db.query(Device).filter(Device.id == cached_device_id).first()
                else:
                    self._cache.pop(cache_key, None)
                    self._cache_timestamps.pop(cache_key, None)
            
            device = self.db.query(Device).filter(
                Device.gateway_id == gateway_id,
                Device.edge_key == edge_key,
                Device.is_active == 1
            ).first()
            
            if device:
                self._cache[cache_key] = {"device_id": device.id}
                self._cache_timestamps[cache_key] = datetime.utcnow()
            return device
        
        if mqtt_username:
            return self.db.query(Device).filter(
                Device.mqtt_username == mqtt_username,
                Device.is_active == 1
            ).first()
        
        if api_token:
            return self.db.query(Device).filter(
                Device.api_token == api_token,
                Device.is_active == 1
            ).first()
        
        return None
    
    def resolve_from_mqtt_topic(self, topic: str) -> Optional[Device]:
        """
        Extract device ID from MQTT topic and resolve device.
        Topics: device/{device_id}/telemetry, gateway/{gateway_id}/{edge_key}/data
        """
        parts = topic.split("/")
        
        if len(parts) >= 2 and parts[0] == "device":
            try:
                device_id = int(parts[1])
                return self.resolve(device_id=device_id)
            except ValueError:
                pass
        
        if len(parts) >= 3 and parts[0] == "gateway":
            try:
                gateway_id = int(parts[1])
                edge_key = parts[2]
                return self.resolve(gateway_id=gateway_id, edge_key=edge_key)
            except ValueError:
                pass
        
        return None
    
    def invalidate_cache(self, gateway_id: int = None, edge_key: str = None):
        """Remove cached entry or clear entire cache."""
        if gateway_id is not None and edge_key is not None:
            cache_key = f"{gateway_id}:{edge_key}"
            self._cache.pop(cache_key, None)
            self._cache_timestamps.pop(cache_key, None)
        elif gateway_id is not None:
            keys_to_remove = [k for k in self._cache if k.startswith(f"{gateway_id}:")]
            for key in keys_to_remove:
                self._cache.pop(key, None)
                self._cache_timestamps.pop(key, None)
    
    def clear_cache(self):
        """Clear entire cache."""
        self._cache.clear()
        self._cache_timestamps.clear()


def get_onboarding_service(db: Session) -> DeviceOnboardingService:
    """Get device onboarding service instance."""
    return DeviceOnboardingService(db)


def get_edge_key_resolver(db: Session) -> EdgeKeyResolver:
    """Get edge key resolver instance."""
    return EdgeKeyResolver(db)
