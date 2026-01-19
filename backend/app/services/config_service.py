"""Configuration management service with environment-based settings."""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
import os
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class ConfigValue:
    """A configuration value with metadata."""
    key: str
    value: Any
    source: str
    encrypted: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


class ConfigService:
    """Environment-based configuration management."""
    
    def __init__(self):
        self._config: Dict[str, ConfigValue] = {}
        self._defaults: Dict[str, Any] = {}
        self._watchers: List[callable] = []
        self._load_defaults()
        self._load_from_env()
    
    def _load_defaults(self):
        """Load default configuration values."""
        self._defaults = {
            "app.name": "SAVE-IT.AI",
            "app.version": "1.0.0",
            "app.environment": "development",
            "app.debug": False,
            "database.pool_size": 10,
            "database.max_overflow": 20,
            "database.pool_timeout": 30,
            "database.pool_recycle": 1800,
            "cache.enabled": True,
            "cache.default_ttl": 300,
            "rate_limit.enabled": True,
            "rate_limit.requests_per_second": 20,
            "rate_limit.burst": 50,
            "polling.default_interval": 60,
            "polling.max_retries": 3,
            "polling.backoff_multiplier": 2,
            "websocket.ping_interval": 30,
            "websocket.max_connections": 1000,
            "scheduler.enabled": True,
            "metrics.enabled": True,
            "metrics.export_interval": 60,
            "logging.level": "INFO",
            "logging.format": "json",
            "auth.session_timeout": 3600,
            "auth.token_expiry": 86400,
            "retention.meter_readings_days": 365,
            "retention.audit_logs_days": 90,
            "retention.notifications_days": 30,
            "email.enabled": False,
            "email.from_address": "noreply@saveit.ai",
            "reports.default_format": "pdf",
            "timezone": "UTC",
        }
    
    def _load_from_env(self):
        """Load configuration from environment variables."""
        for key, default in self._defaults.items():
            env_key = key.replace(".", "_").upper()
            env_value = os.getenv(env_key)
            
            if env_value is not None:
                value = self._parse_value(env_value, type(default))
                self._config[key] = ConfigValue(
                    key=key,
                    value=value,
                    source="environment",
                )
            else:
                self._config[key] = ConfigValue(
                    key=key,
                    value=default,
                    source="default",
                )
    
    def _parse_value(self, value: str, value_type: type) -> Any:
        """Parse a string value to the appropriate type."""
        if value_type == bool:
            return value.lower() in ("true", "1", "yes", "on")
        elif value_type == int:
            return int(value)
        elif value_type == float:
            return float(value)
        elif value_type == list:
            return json.loads(value)
        elif value_type == dict:
            return json.loads(value)
        return value
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value."""
        if key in self._config:
            return self._config[key].value
        return default
    
    def set(self, key: str, value: Any, source: str = "runtime"):
        """Set a configuration value."""
        old_value = self._config.get(key)
        self._config[key] = ConfigValue(
            key=key,
            value=value,
            source=source,
            updated_at=datetime.utcnow(),
        )
        
        for watcher in self._watchers:
            try:
                watcher(key, old_value.value if old_value else None, value)
            except Exception as e:
                logger.error(f"Config watcher error: {e}")
    
    def watch(self, callback: callable):
        """Register a callback for configuration changes."""
        self._watchers.append(callback)
    
    def get_all(self) -> Dict[str, Any]:
        """Get all configuration values."""
        return {k: v.value for k, v in self._config.items()}
    
    def get_by_prefix(self, prefix: str) -> Dict[str, Any]:
        """Get all configuration values with a given prefix."""
        return {
            k: v.value for k, v in self._config.items()
            if k.startswith(prefix)
        }
    
    def export(self) -> List[dict]:
        """Export configuration for display (hides sensitive values)."""
        sensitive_keys = {"password", "secret", "token", "key", "credential"}
        result = []
        
        for key, config in self._config.items():
            is_sensitive = any(s in key.lower() for s in sensitive_keys)
            result.append({
                "key": key,
                "value": "***" if is_sensitive else config.value,
                "source": config.source,
                "updated_at": config.updated_at.isoformat(),
            })
        
        return result


config_service = ConfigService()


class FeatureFlags:
    """Feature flag management."""
    
    def __init__(self):
        self._flags: Dict[str, bool] = {}
        self._load_defaults()
    
    def _load_defaults(self):
        """Load default feature flags."""
        self._flags = {
            "websocket_enabled": True,
            "polling_enabled": True,
            "scheduler_enabled": True,
            "ai_assistant_enabled": True,
            "dark_mode_enabled": True,
            "guided_tours_enabled": True,
            "beta_features_enabled": False,
            "maintenance_mode": False,
            "new_dashboard": False,
            "advanced_analytics": True,
            "export_to_excel": True,
            "export_to_pdf": True,
            "bulk_operations": True,
            "api_key_auth": True,
            "sso_enabled": False,
            "two_factor_auth": False,
        }
        
        for flag, default in self._flags.items():
            env_key = f"FEATURE_{flag.upper()}"
            env_value = os.getenv(env_key)
            if env_value is not None:
                self._flags[flag] = env_value.lower() in ("true", "1", "yes", "on")
    
    def is_enabled(self, flag: str) -> bool:
        """Check if a feature flag is enabled."""
        return self._flags.get(flag, False)
    
    def enable(self, flag: str):
        """Enable a feature flag."""
        self._flags[flag] = True
        logger.info(f"Feature flag enabled: {flag}")
    
    def disable(self, flag: str):
        """Disable a feature flag."""
        self._flags[flag] = False
        logger.info(f"Feature flag disabled: {flag}")
    
    def get_all(self) -> Dict[str, bool]:
        """Get all feature flags."""
        return self._flags.copy()


feature_flags = FeatureFlags()
