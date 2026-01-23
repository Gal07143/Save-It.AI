"""Tests for meter endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.models import Meter, Site, Organization


@pytest.fixture
def test_site(db: Session, test_organization: Organization) -> Site:
    """Create a test site for meters."""
    site = Site(
        organization_id=test_organization.id,
        name="Meter Test Site",
        timezone="UTC",
        is_active=1
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@pytest.fixture
def test_meter(db: Session, test_site: Site) -> Meter:
    """Create a test meter."""
    meter = Meter(
        site_id=test_site.id,
        meter_id="MTR-001",
        name="Test Meter",
        is_active=1
    )
    db.add(meter)
    db.commit()
    db.refresh(meter)
    return meter


class TestMeterList:
    """Tests for meter listing."""

    def test_list_meters_success(
        self, client: TestClient, auth_headers: dict, test_meter: Meter
    ):
        """Test successful meter listing."""
        response = client.get("/api/v1/meters", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_meters_filter_by_site(
        self, client: TestClient, auth_headers: dict, test_meter: Meter, test_site: Site
    ):
        """Test meter listing filtered by site."""
        response = client.get(
            f"/api/v1/meters?site_id={test_site.id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert all(m["site_id"] == test_site.id for m in data)

    def test_list_meters_pagination(
        self, client: TestClient, auth_headers: dict, test_meter: Meter
    ):
        """Test meter listing with pagination limits."""
        response = client.get(
            "/api/v1/meters?skip=0&limit=10",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 10


class TestMeterGet:
    """Tests for getting a single meter."""

    def test_get_meter_success(
        self, client: TestClient, auth_headers: dict, test_meter: Meter
    ):
        """Test successful meter retrieval."""
        response = client.get(f"/api/v1/meters/{test_meter.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Meter"
        assert data["meter_id"] == "MTR-001"

    def test_get_meter_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test getting non-existent meter."""
        response = client.get("/api/v1/meters/99999", headers=auth_headers)
        assert response.status_code == 404


class TestMeterCreate:
    """Tests for meter creation."""

    def test_create_meter_requires_auth(self, client: TestClient, db: Session, test_site: Site):
        """Test that creating meters requires authentication."""
        response = client.post(
            "/api/v1/meters",
            json={
                "site_id": test_site.id,
                "meter_id": "MTR-NEW",
                "name": "New Meter"
            }
        )
        assert response.status_code == 401

    def test_create_meter_success(
        self, client: TestClient, auth_headers: dict, test_site: Site
    ):
        """Test successful meter creation."""
        response = client.post(
            "/api/v1/meters",
            json={
                "site_id": test_site.id,
                "meter_id": "MTR-002",
                "name": "Created Meter",
                "description": "A test meter"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Created Meter"
        assert data["meter_id"] == "MTR-002"

    def test_create_meter_duplicate_id(
        self, client: TestClient, auth_headers: dict, test_site: Site, test_meter: Meter
    ):
        """Test creating meter with duplicate meter_id fails."""
        response = client.post(
            "/api/v1/meters",
            json={
                "site_id": test_site.id,
                "meter_id": "MTR-001",  # Already exists
                "name": "Duplicate Meter"
            },
            headers=auth_headers
        )
        assert response.status_code == 400


class TestMeterUpdate:
    """Tests for meter updates."""

    def test_update_meter_success(
        self, client: TestClient, auth_headers: dict, test_meter: Meter
    ):
        """Test successful meter update."""
        response = client.put(
            f"/api/v1/meters/{test_meter.id}",
            json={"name": "Updated Meter Name"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Meter Name"

    def test_update_meter_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test updating non-existent meter."""
        response = client.put(
            "/api/v1/meters/99999",
            json={"name": "Updated"},
            headers=auth_headers
        )
        assert response.status_code == 404


class TestMeterDelete:
    """Tests for meter deletion."""

    def test_delete_meter_success(
        self, client: TestClient, auth_headers: dict, test_meter: Meter
    ):
        """Test successful meter deletion."""
        response = client.delete(f"/api/v1/meters/{test_meter.id}", headers=auth_headers)
        assert response.status_code == 200

    def test_delete_meter_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test deleting non-existent meter."""
        response = client.delete("/api/v1/meters/99999", headers=auth_headers)
        assert response.status_code == 404


class TestMeterReadings:
    """Tests for meter readings."""

    def test_get_meter_readings(
        self, client: TestClient, auth_headers: dict, test_meter: Meter
    ):
        """Test getting meter readings."""
        response = client.get(
            f"/api/v1/meters/{test_meter.id}/readings",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
