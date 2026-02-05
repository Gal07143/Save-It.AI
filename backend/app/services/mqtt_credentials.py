"""
MQTT Credential Manager for Save-It.AI
Syncs gateway credentials to Mosquitto's password file.
"""
import os
import subprocess
import logging
import secrets
import hashlib
from typing import Dict, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)


class MQTTCredentialManager:
    """
    Manages MQTT credentials for Mosquitto broker.
    Syncs gateway credentials to Mosquitto's password file.
    """

    def __init__(self):
        self.passwd_file = os.getenv("MOSQUITTO_PASSWD_FILE", "/etc/mosquitto/passwd")
        self.acl_file = os.getenv("MOSQUITTO_ACL_FILE", "/etc/mosquitto/acl")
        self.creds_dir = os.path.expanduser("~/.saveit")
        self._internal_user: Optional[str] = None
        self._internal_pass: Optional[str] = None
        self._initialized = False

    async def initialize(self):
        """Initialize the credential manager and load internal credentials."""
        try:
            # Load internal credentials (for backend subscriber)
            creds_file = os.path.join(self.creds_dir, "mqtt-credentials")
            if os.path.exists(creds_file):
                with open(creds_file, "r") as f:
                    for line in f:
                        if line.startswith("MQTT_INTERNAL_USER="):
                            self._internal_user = line.split("=", 1)[1].strip()
                        elif line.startswith("MQTT_INTERNAL_PASS="):
                            self._internal_pass = line.split("=", 1)[1].strip()
                logger.info("Loaded MQTT internal credentials")
            else:
                # Fallback for development (no auth)
                logger.warning(f"MQTT credentials file not found at {creds_file}. Using anonymous auth.")
                self._internal_user = None
                self._internal_pass = None

            self._initialized = True
        except Exception as e:
            logger.error(f"Failed to initialize MQTT credentials: {e}")
            self._initialized = False

    def get_internal_credentials(self) -> Tuple[Optional[str], Optional[str]]:
        """Get the internal subscriber credentials."""
        return self._internal_user, self._internal_pass

    def generate_gateway_credentials(self, gateway_id: int) -> Dict[str, str]:
        """
        Generate new MQTT credentials for a gateway.
        Returns credentials dict but doesn't persist to file yet.
        """
        username = f"gw_{gateway_id}_{secrets.token_hex(6)}"
        password = secrets.token_urlsafe(24)

        return {
            "username": username,
            "password": password,
            "client_id": f"saveit-gw-{gateway_id}",
            "topic_prefix": f"saveit/{gateway_id}",
        }

    def add_gateway_credentials(self, username: str, password: str) -> bool:
        """
        Add gateway credentials to Mosquitto's password file.
        Returns True on success.
        """
        try:
            # Use mosquitto_passwd to add/update credentials
            # The -b flag allows passing password on command line
            result = subprocess.run(
                ["sudo", "mosquitto_passwd", "-b", self.passwd_file, username, password],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                logger.error(f"Failed to add MQTT credentials: {result.stderr}")
                return False

            # Reload Mosquitto to pick up new credentials
            self._reload_mosquitto()

            logger.info(f"Added MQTT credentials for {username}")
            return True

        except subprocess.TimeoutExpired:
            logger.error("Timeout adding MQTT credentials")
            return False
        except FileNotFoundError:
            logger.warning("mosquitto_passwd not found. Running in development mode?")
            return True  # Allow to proceed in dev
        except Exception as e:
            logger.error(f"Error adding MQTT credentials: {e}")
            return False

    def remove_gateway_credentials(self, username: str) -> bool:
        """Remove gateway credentials from Mosquitto's password file."""
        try:
            result = subprocess.run(
                ["sudo", "mosquitto_passwd", "-D", self.passwd_file, username],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                logger.warning(f"Failed to remove MQTT credentials for {username}: {result.stderr}")
                return False

            self._reload_mosquitto()
            logger.info(f"Removed MQTT credentials for {username}")
            return True

        except Exception as e:
            logger.error(f"Error removing MQTT credentials: {e}")
            return False

    def _reload_mosquitto(self):
        """Send SIGHUP to Mosquitto to reload configuration."""
        try:
            subprocess.run(
                ["sudo", "systemctl", "reload", "mosquitto"],
                capture_output=True,
                timeout=10
            )
        except Exception as e:
            logger.warning(f"Could not reload Mosquitto: {e}")

    async def stop(self):
        """Cleanup on shutdown."""
        self._initialized = False
        logger.info("MQTT credential manager stopped")


# Global instance
mqtt_credential_manager = MQTTCredentialManager()
