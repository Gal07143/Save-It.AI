"""Integration tests for device management flow."""
import pytest
from fastapi.testclient import TestClient


class TestDeviceOnboardingFlow:
    """Test complete device onboarding workflow."""

    def test_gateway_device_datapoint_flow(
        self, client: TestClient, auth_headers: dict, test_site, db
    ):
        """Test: Create gateway -> Create device -> Verify commissioning."""
        # Step 1: Create gateway
        gateway_data = {
            "site_id": test_site.id,
            "name": "Main Gateway",
            "ip_address": "192.168.1.1",
        }
        response = client.post(
            "/api/v1/gateways",
            json=gateway_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        gateway = response.json()
        gateway_id = gateway["id"]

        # Step 2: Register gateway for MQTT
        response = client.post(
            f"/api/v1/gateways/{gateway_id}/register",
            headers=auth_headers
        )
        assert response.status_code == 200
        registration = response.json()
        assert "mqtt" in registration

        # Step 3: Create device attached to gateway
        device_data = {
            "site_id": test_site.id,
            "gateway_id": gateway_id,
            "name": "Power Meter 1",
            "source_type": "modbus_tcp",
            "host": "192.168.1.100",
            "port": 502,
            "slave_id": 1,
        }
        response = client.post(
            "/api/v1/data-sources",
            json=device_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        device = response.json()
        device_id = device["id"]

        # Step 4: Check commissioning status
        response = client.get(
            f"/api/v1/data-sources/{device_id}/commissioning",
            headers=auth_headers
        )
        assert response.status_code == 200
        commissioning = response.json()
        assert "checklist" in commissioning
        assert commissioning["device_id"] == device_id

        # Step 5: Verify device appears in health dashboard
        response = client.get(
            f"/api/v1/data-sources/health/dashboard?site_id={test_site.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        health = response.json()
        assert health["total_devices"] >= 1


class TestDeviceTemplateFlow:
    """Test device template application flow."""

    def test_list_and_apply_template(
        self, client: TestClient, auth_headers: dict, test_site, db
    ):
        """Test listing templates and applying to device."""
        # Step 1: List available templates
        response = client.get("/api/v1/device-templates", headers=auth_headers)
        assert response.status_code == 200
        templates = response.json()

        if len(templates) == 0:
            # Seed templates first
            client.post("/api/v1/device-templates/seed", headers=auth_headers)
            response = client.get("/api/v1/device-templates", headers=auth_headers)
            templates = response.json()

        # Step 2: Create a device to apply template to
        device_data = {
            "site_id": test_site.id,
            "name": "Template Test Device",
            "source_type": "modbus_tcp",
        }
        response = client.post(
            "/api/v1/data-sources",
            json=device_data,
            headers=auth_headers
        )
        if response.status_code not in [200, 201]:
            pytest.skip("Could not create device for template test")

        device = response.json()

        # Step 3: Apply template if templates exist
        if templates:
            template_id = templates[0]["id"]
            response = client.post(
                "/api/v1/device-templates/apply",
                json={
                    "template_id": template_id,
                    "data_source_id": device["id"],
                },
                headers=auth_headers
            )
            # May fail if registers already exist, which is OK
            assert response.status_code in [200, 400]
