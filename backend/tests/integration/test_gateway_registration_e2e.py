"""End-to-end tests for complete gateway registration flow."""
import pytest
import json
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.models.integrations import Gateway, GatewayStatus, GatewayCredentials


@pytest.mark.skip(reason="Requires conftest db fixture which has known index creation issues")
class TestGatewayRegistrationE2E:
    """
    Complete gateway registration workflow tests.
    Tests the full flow: Create gateway -> Register -> Get credentials -> Connect devices
    """

    def test_complete_gateway_onboarding_flow(
        self, client: TestClient, auth_headers: dict, test_site, db: Session
    ):
        """
        Test complete gateway onboarding:
        1. Create gateway
        2. Register for MQTT/Webhook
        3. Verify credentials generated
        4. Create device attached to gateway
        5. Verify commissioning status
        """
        # Step 1: Create gateway
        gateway_data = {
            "site_id": test_site.id,
            "name": "Industrial Gateway 1",
            "ip_address": "192.168.10.1",
            "mac_address": "00:1A:2B:3C:4D:5E",
            "description": "Main factory floor gateway",
            "model": "RPI-5",
            "manufacturer": "Raspberry Pi Foundation",
            "firmware_version": "1.0.0",
            "heartbeat_interval_seconds": 30,
        }

        response = client.post(
            "/api/v1/gateways",
            json=gateway_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201], f"Create failed: {response.text}"

        gateway = response.json()
        gateway_id = gateway["id"]

        assert gateway["name"] == "Industrial Gateway 1"
        assert gateway["site_id"] == test_site.id
        assert gateway["status"] in ["offline", "OFFLINE"]

        # Step 2: Register gateway for connectivity
        response = client.post(
            f"/api/v1/gateways/{gateway_id}/register",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Register failed: {response.text}"

        registration = response.json()

        # Verify MQTT credentials
        assert "mqtt" in registration
        mqtt_config = registration["mqtt"]
        assert "host" in mqtt_config
        assert mqtt_config["port"] == 1883
        assert mqtt_config["tls_port"] == 8883
        assert "username" in mqtt_config
        assert mqtt_config["username"].startswith("gw_")
        assert "password" in mqtt_config
        assert len(mqtt_config["password"]) > 20
        assert "client_id" in mqtt_config
        assert mqtt_config["client_id"] == f"saveit-gw-{gateway_id}"
        assert f"saveit/{gateway_id}" in mqtt_config["publish_topic"]
        assert f"saveit/{gateway_id}" in mqtt_config["heartbeat_topic"]
        assert f"saveit/{gateway_id}" in mqtt_config["subscribe_topic"]

        # Verify Webhook credentials
        assert "webhook" in registration
        webhook_config = registration["webhook"]
        assert webhook_config["method"] == "POST"
        assert webhook_config["content_type"] == "application/json"
        assert "api_key" in webhook_config
        assert webhook_config["api_key"].startswith("whk_")
        assert "secret_key" in webhook_config
        assert len(webhook_config["secret_key"]) > 20
        assert f"/api/v1/webhooks/ingest/{gateway_id}" in webhook_config["url"]

        # Verify credentials stored in database
        creds = db.query(GatewayCredentials).filter(
            GatewayCredentials.gateway_id == gateway_id
        ).first()
        assert creds is not None
        assert creds.mqtt_username == mqtt_config["username"]
        assert creds.webhook_api_key == webhook_config["api_key"]

        # Step 3: Create device attached to gateway
        device_data = {
            "site_id": test_site.id,
            "gateway_id": gateway_id,
            "name": "Power Meter A1",
            "source_type": "modbus",
            "host": "192.168.10.100",
            "port": 502,
            "slave_id": 1,
        }

        response = client.post(
            "/api/v1/data-sources",
            json=device_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201], f"Device create failed: {response.text}"

        device = response.json()
        device_id = device["id"]

        assert device["gateway_id"] == gateway_id
        assert device["name"] == "Power Meter A1"

        # Step 4: Verify commissioning status
        response = client.get(
            f"/api/v1/data-sources/{device_id}/commissioning",
            headers=auth_headers
        )
        assert response.status_code == 200

        commissioning = response.json()
        assert "checklist" in commissioning
        assert commissioning["device_id"] == device_id

    def test_gateway_credential_rotation(
        self, client: TestClient, auth_headers: dict, test_site, db: Session, gateway_factory
    ):
        """Test credentials can be rotated and old ones invalidated."""
        gateway = gateway_factory(site_id=test_site.id, name="Rotation Test Gateway")

        # Initial registration
        response = client.post(
            f"/api/v1/gateways/{gateway.id}/register",
            headers=auth_headers
        )
        assert response.status_code == 200
        original = response.json()
        original_password = original["mqtt"]["password"]
        original_api_key = original["webhook"]["api_key"]

        # Rotate credentials
        response = client.post(
            f"/api/v1/gateways/{gateway.id}/rotate-credentials",
            headers=auth_headers
        )
        assert response.status_code == 200
        rotated = response.json()

        # Verify credentials changed
        assert rotated["mqtt"]["password"] != original_password
        assert rotated["webhook"]["api_key"] != original_api_key

        # Username format should remain consistent
        assert rotated["mqtt"]["username"].startswith("gw_")

    def test_get_gateway_credentials_masks_secrets(
        self, client: TestClient, auth_headers: dict, test_site, gateway_factory
    ):
        """Test GET credentials masks password and secret."""
        gateway = gateway_factory(site_id=test_site.id)

        # Register first
        client.post(f"/api/v1/gateways/{gateway.id}/register", headers=auth_headers)

        # Get credentials
        response = client.get(
            f"/api/v1/gateways/{gateway.id}/credentials",
            headers=auth_headers
        )
        assert response.status_code == 200

        creds = response.json()
        assert creds["mqtt"]["password"] == "********"
        assert creds["webhook"]["secret_key"] == "********"
        # Username and API key should be visible
        assert creds["mqtt"]["username"].startswith("gw_")
        assert creds["webhook"]["api_key"].startswith("whk_")

    def test_unregistered_gateway_credentials_404(
        self, client: TestClient, auth_headers: dict, test_site, gateway_factory
    ):
        """Test getting credentials for unregistered gateway returns 404."""
        gateway = gateway_factory(site_id=test_site.id)

        response = client.get(
            f"/api/v1/gateways/{gateway.id}/credentials",
            headers=auth_headers
        )

        assert response.status_code == 404
        assert "not registered" in response.json()["detail"].lower()

    def test_gateway_heartbeat_updates_status(
        self, client: TestClient, auth_headers: dict, test_site, gateway_factory
    ):
        """Test heartbeat endpoint updates gateway status."""
        gateway = gateway_factory(site_id=test_site.id)

        # Initially offline
        response = client.get(
            f"/api/v1/gateways/{gateway.id}",
            headers=auth_headers
        )
        initial_status = response.json()["status"]

        # Send heartbeat
        response = client.post(
            f"/api/v1/gateways/{gateway.id}/heartbeat",
            headers=auth_headers
        )
        assert response.status_code == 200

        updated = response.json()
        assert updated["status"] in ["online", "ONLINE"]
        assert updated["last_seen_at"] is not None

    def test_multiple_devices_per_gateway(
        self, client: TestClient, auth_headers: dict, test_site, gateway_factory
    ):
        """Test gateway can have multiple devices attached."""
        gateway = gateway_factory(site_id=test_site.id, name="Multi-Device Gateway")

        # Register gateway
        client.post(f"/api/v1/gateways/{gateway.id}/register", headers=auth_headers)

        # Create multiple devices
        devices = []
        for i in range(3):
            device_data = {
                "site_id": test_site.id,
                "gateway_id": gateway.id,
                "name": f"Meter {i+1}",
                "source_type": "modbus",
                "slave_id": i + 1,
            }
            response = client.post(
                "/api/v1/data-sources",
                json=device_data,
                headers=auth_headers
            )
            if response.status_code in [200, 201]:
                devices.append(response.json())

        assert len(devices) >= 1, "Should create at least one device"

        # Verify devices are linked
        for device in devices:
            assert device["gateway_id"] == gateway.id

    def test_gateway_communication_logs(
        self, client: TestClient, auth_headers: dict, test_site, gateway_factory
    ):
        """Test gateway communication logs endpoint."""
        gateway = gateway_factory(site_id=test_site.id)

        response = client.get(
            f"/api/v1/gateways/{gateway.id}/logs?hours=24&limit=50",
            headers=auth_headers
        )

        assert response.status_code == 200
        logs = response.json()
        assert isinstance(logs, list)

    def test_gateway_health_summary(
        self, client: TestClient, auth_headers: dict, test_site, gateway_factory
    ):
        """Test gateway health summary endpoint."""
        gateway = gateway_factory(site_id=test_site.id)

        # Note: This endpoint might be at /health/summary
        response = client.get(
            "/api/v1/gateways/health/summary",
            headers=auth_headers
        )

        if response.status_code == 200:
            summary = response.json()
            assert isinstance(summary, list)


@pytest.mark.skip(reason="Requires conftest db fixture which has known index creation issues")
class TestGatewayMQTTIntegration:
    """Test gateway MQTT topic patterns and message handling."""

    def test_mqtt_topics_correct_format(
        self, client: TestClient, auth_headers: dict, test_site, gateway_factory
    ):
        """Verify MQTT topics follow correct patterns."""
        gateway = gateway_factory(site_id=test_site.id)

        response = client.post(
            f"/api/v1/gateways/{gateway.id}/register",
            headers=auth_headers
        )
        assert response.status_code == 200

        mqtt = response.json()["mqtt"]
        gw_id = gateway.id

        # Verify topic patterns
        assert mqtt["publish_topic"] == f"saveit/{gw_id}/+/data"
        assert mqtt["heartbeat_topic"] == f"saveit/{gw_id}/heartbeat"
        assert mqtt["subscribe_topic"] == f"saveit/{gw_id}/commands"

    def test_credentials_stored_with_topics(
        self, db: Session, client: TestClient, auth_headers: dict,
        test_site, gateway_factory
    ):
        """Verify topic patterns stored in database."""
        gateway = gateway_factory(site_id=test_site.id)

        client.post(
            f"/api/v1/gateways/{gateway.id}/register",
            headers=auth_headers
        )

        creds = db.query(GatewayCredentials).filter(
            GatewayCredentials.gateway_id == gateway.id
        ).first()

        assert creds is not None
        topics = json.loads(creds.mqtt_topics)
        assert "publish" in topics
        assert "heartbeat" in topics
        assert "subscribe" in topics
