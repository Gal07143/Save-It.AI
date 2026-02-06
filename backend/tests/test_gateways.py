"""Tests for gateway management endpoints."""
import pytest
from fastapi.testclient import TestClient


class TestGatewayCRUD:
    """Test gateway CRUD operations."""

    def test_list_gateways_public_accessible(self, client: TestClient):
        """Test that gateways list is publicly accessible (no 401)."""
        response = client.get("/api/v1/gateways")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_gateways_empty(self, client: TestClient, auth_headers: dict, test_site):
        """Test listing gateways when none exist."""
        response = client.get(
            f"/api/v1/gateways?site_id={test_site.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_create_gateway(self, client: TestClient, auth_headers: dict, test_site):
        """Test creating a new gateway."""
        data = {
            "site_id": test_site.id,
            "name": "Test Gateway",
            "ip_address": "192.168.1.1",
            "description": "Main site gateway",
        }
        response = client.post(
            "/api/v1/gateways",
            json=data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201]
        result = response.json()
        assert result["name"] == "Test Gateway"

    def test_get_gateway(self, client: TestClient, auth_headers: dict, test_site, gateway_factory):
        """Test getting a specific gateway."""
        gateway = gateway_factory(site_id=test_site.id, name="My Gateway")

        response = client.get(
            f"/api/v1/gateways/{gateway.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "My Gateway"

    def test_update_gateway(self, client: TestClient, auth_headers: dict, test_site, gateway_factory):
        """Test updating a gateway."""
        gateway = gateway_factory(site_id=test_site.id)

        response = client.put(
            f"/api/v1/gateways/{gateway.id}",
            json={"name": "Updated Gateway Name"},
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Gateway Name"

    def test_delete_gateway(self, client: TestClient, auth_headers: dict, test_site, gateway_factory):
        """Test deleting a gateway."""
        gateway = gateway_factory(site_id=test_site.id)

        response = client.delete(
            f"/api/v1/gateways/{gateway.id}",
            headers=auth_headers
        )
        assert response.status_code in [200, 204]


class TestGatewayCredentials:
    """Test gateway MQTT credential management."""

    def test_register_gateway(self, client: TestClient, auth_headers: dict, test_site, gateway_factory):
        """Test registering a gateway for MQTT."""
        gateway = gateway_factory(site_id=test_site.id)

        response = client.post(
            f"/api/v1/gateways/{gateway.id}/register",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "mqtt" in data
        assert "webhook" in data

    def test_get_credentials(self, client: TestClient, auth_headers: dict, test_site, gateway_factory):
        """Test getting gateway credentials."""
        gateway = gateway_factory(site_id=test_site.id)

        # First register
        client.post(f"/api/v1/gateways/{gateway.id}/register", headers=auth_headers)

        # Then get credentials
        response = client.get(
            f"/api/v1/gateways/{gateway.id}/credentials",
            headers=auth_headers
        )
        assert response.status_code == 200

    def test_rotate_credentials(self, client: TestClient, auth_headers: dict, test_site, gateway_factory):
        """Test rotating gateway credentials."""
        gateway = gateway_factory(site_id=test_site.id)

        # First register
        client.post(f"/api/v1/gateways/{gateway.id}/register", headers=auth_headers)

        # Then rotate
        response = client.post(
            f"/api/v1/gateways/{gateway.id}/rotate-credentials",
            headers=auth_headers
        )
        assert response.status_code == 200
