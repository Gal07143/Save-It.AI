"""Tests for device management endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestDataSources:
    """Test data source (device) CRUD operations."""

    def test_list_data_sources_unauthenticated(self, client: TestClient):
        """Test that listing data sources requires authentication."""
        response = client.get("/api/v1/data-sources")
        assert response.status_code == 401

    def test_list_data_sources_empty(self, client: TestClient, auth_headers: dict, test_site):
        """Test listing data sources when none exist."""
        response = client.get(
            f"/api/v1/data-sources?site_id={test_site.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_create_data_source(self, client: TestClient, auth_headers: dict, test_site):
        """Test creating a new data source."""
        data = {
            "site_id": test_site.id,
            "name": "Test Modbus Device",
            "source_type": "modbus",
            "host": "192.168.1.100",
            "port": 502,
            "slave_id": 1,
        }
        response = client.post(
            "/api/v1/data-sources",
            json=data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        result = response.json()
        assert result["name"] == "Test Modbus Device"
        assert result["source_type"] == "modbus"

    def test_get_data_source(self, client: TestClient, auth_headers: dict, test_site, data_source_factory):
        """Test getting a specific data source."""
        source = data_source_factory(site_id=test_site.id, name="My Device")

        response = client.get(
            f"/api/v1/data-sources/{source.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "My Device"

    def test_update_data_source(self, client: TestClient, auth_headers: dict, test_site, data_source_factory):
        """Test updating a data source."""
        source = data_source_factory(site_id=test_site.id)

        response = client.put(
            f"/api/v1/data-sources/{source.id}",
            json={"name": "Updated Device Name"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Device Name"

    def test_delete_data_source(self, client: TestClient, auth_headers: dict, test_site, data_source_factory):
        """Test deleting a data source."""
        source = data_source_factory(site_id=test_site.id)

        response = client.delete(
            f"/api/v1/data-sources/{source.id}",
            headers=auth_headers
        )
        assert response.status_code in [200, 204]

        # Verify deletion
        response = client.get(
            f"/api/v1/data-sources/{source.id}",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestDeviceHealth:
    """Test device health monitoring endpoints."""

    def test_health_dashboard(self, client: TestClient, auth_headers: dict, test_site):
        """Test getting device health dashboard."""
        response = client.get(
            f"/api/v1/data-sources/health/dashboard?site_id={test_site.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_devices" in data
        assert "online_count" in data
        assert "overall_success_rate" in data


class TestDeviceOnboarding:
    """Test device onboarding flow."""

    def test_commissioning_status(self, client: TestClient, auth_headers: dict, test_site, data_source_factory):
        """Test getting commissioning status for a device."""
        source = data_source_factory(site_id=test_site.id)

        response = client.get(
            f"/api/v1/data-sources/{source.id}/commissioning",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "device_id" in data
        assert "checklist" in data
        assert "progress_percent" in data
