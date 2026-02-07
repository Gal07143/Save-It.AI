"""Tests for site endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Site, User, Organization
from app.models.platform import OrgSite


@pytest.fixture
def test_site(db: Session, test_organization: Organization) -> Site:
    """Create a test site linked to test organization."""
    site = Site(
        name="Test Site",
        address="123 Test St",
        city="Test City",
        country="Test Country",
        timezone="UTC"
    )
    db.add(site)
    db.commit()
    db.refresh(site)

    # Link to organization for multi-tenant validation
    org_site = OrgSite(
        organization_id=test_organization.id,
        site_id=site.id,
        is_primary=1
    )
    db.add(org_site)
    db.commit()

    return site


class TestSiteList:
    """Tests for site listing."""

    def test_list_sites_public_accessible(self, client: TestClient, db: Session):
        """Test that sites list is publicly accessible (no 401)."""
        response = client.get("/api/v1/sites")
        assert response.status_code == 200
        # Returns list (may contain data depending on test state)
        assert isinstance(response.json(), list)

    def test_list_sites_success(
        self, client: TestClient, auth_headers: dict, test_site: Site
    ):
        """Test successful site listing."""
        response = client.get("/api/v1/sites", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # Site name comes from fixture - just verify we have sites
        assert any(s["id"] == test_site.id for s in data)

    def test_list_sites_pagination(
        self, client: TestClient, auth_headers: dict, test_site: Site
    ):
        """Test site listing with pagination."""
        response = client.get("/api/v1/sites?skip=0&limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSiteGet:
    """Tests for getting a single site."""

    def test_get_site_success(
        self, client: TestClient, auth_headers: dict, test_site: Site
    ):
        """Test successful site retrieval."""
        response = client.get(f"/api/v1/sites/{test_site.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        # Just verify we got the right site back
        assert data["id"] == test_site.id
        assert "name" in data

    def test_get_site_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test getting non-existent site."""
        response = client.get("/api/v1/sites/99999", headers=auth_headers)
        assert response.status_code == 404


class TestSiteCreate:
    """Tests for site creation."""

    def test_create_site_requires_auth(self, client: TestClient, db: Session):
        """Test that creating sites requires authentication."""
        response = client.post(
            "/api/v1/sites",
            json={"name": "New Site", "timezone": "UTC"}
        )
        assert response.status_code == 401

    def test_create_site_success(
        self, client: TestClient, auth_headers: dict, test_organization: Organization
    ):
        """Test successful site creation."""
        response = client.post(
            "/api/v1/sites",
            json={
                "name": "New Site",
                "address": "456 New St",
                "city": "New City",
                "country": "New Country",
                "timezone": "America/New_York"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Site"
        assert data["city"] == "New City"

    def test_create_site_minimal(
        self, client: TestClient, auth_headers: dict
    ):
        """Test site creation with minimal required fields."""
        response = client.post(
            "/api/v1/sites",
            json={"name": "Minimal Site", "timezone": "UTC"},
            headers=auth_headers
        )
        assert response.status_code == 200


class TestSiteUpdate:
    """Tests for site updates."""

    def test_update_site_success(
        self, client: TestClient, auth_headers: dict, test_site: Site
    ):
        """Test successful site update."""
        response = client.put(
            f"/api/v1/sites/{test_site.id}",
            json={"name": "Updated Site Name"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Site Name"

    def test_update_site_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test updating non-existent site."""
        response = client.put(
            "/api/v1/sites/99999",
            json={"name": "Updated"},
            headers=auth_headers
        )
        assert response.status_code == 404


class TestSiteDelete:
    """Tests for site deletion."""

    def test_delete_site_success(
        self, client: TestClient, auth_headers: dict, test_site: Site
    ):
        """Test successful site deletion."""
        response = client.delete(f"/api/v1/sites/{test_site.id}", headers=auth_headers)
        assert response.status_code == 200

    def test_delete_site_not_found(
        self, client: TestClient, auth_headers: dict
    ):
        """Test deleting non-existent site."""
        response = client.delete("/api/v1/sites/99999", headers=auth_headers)
        assert response.status_code == 404
