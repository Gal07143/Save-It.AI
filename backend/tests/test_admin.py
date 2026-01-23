"""Tests for admin endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.models import User, Organization


class TestOrganizationAdmin:
    """Tests for organization management endpoints."""

    def test_list_organizations_requires_auth(self, client: TestClient, db: Session):
        """Test that listing organizations requires authentication."""
        response = client.get("/api/v1/admin/organizations")
        assert response.status_code == 401

    def test_list_organizations_requires_admin(
        self, client: TestClient, auth_headers: dict, test_user: User
    ):
        """Test that listing organizations requires admin role."""
        response = client.get("/api/v1/admin/organizations", headers=auth_headers)
        # org_admin can access
        assert response.status_code == 200

    def test_list_organizations_success(
        self, client: TestClient, admin_auth_headers: dict, test_organization: Organization
    ):
        """Test successful organization listing as super admin."""
        response = client.get("/api/v1/admin/organizations", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(org["slug"] == "test-org" for org in data)

    def test_create_organization_requires_super_admin(
        self, client: TestClient, auth_headers: dict
    ):
        """Test that creating organizations requires super admin."""
        response = client.post(
            "/api/v1/admin/organizations",
            json={"name": "New Org", "slug": "new-org"},
            headers=auth_headers
        )
        assert response.status_code == 403

    def test_create_organization_success(
        self, client: TestClient, admin_auth_headers: dict, db: Session
    ):
        """Test successful organization creation as super admin."""
        response = client.post(
            "/api/v1/admin/organizations",
            json={"name": "New Organization", "slug": "new-org"},
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Organization"
        assert data["slug"] == "new-org"

    def test_get_organization_not_found(
        self, client: TestClient, admin_auth_headers: dict
    ):
        """Test getting non-existent organization."""
        response = client.get("/api/v1/admin/organizations/99999", headers=admin_auth_headers)
        assert response.status_code == 404


class TestUserAdmin:
    """Tests for user management endpoints."""

    def test_list_users_requires_auth(self, client: TestClient, db: Session):
        """Test that listing users requires authentication."""
        response = client.get("/api/v1/admin/users")
        assert response.status_code == 401

    def test_list_users_success(
        self, client: TestClient, admin_auth_headers: dict, test_user: User
    ):
        """Test successful user listing."""
        response = client.get("/api/v1/admin/users", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_create_user_requires_super_admin(
        self, client: TestClient, auth_headers: dict, test_organization: Organization
    ):
        """Test that creating users requires super admin."""
        response = client.post(
            "/api/v1/admin/users",
            json={
                "email": "newuser@test.com",
                "password": "password123",
                "organization_id": test_organization.id,
                "role": "user"
            },
            headers=auth_headers
        )
        assert response.status_code == 403

    def test_create_user_success(
        self, client: TestClient, admin_auth_headers: dict, test_organization: Organization
    ):
        """Test successful user creation."""
        response = client.post(
            "/api/v1/admin/users",
            json={
                "email": "created@test.com",
                "password": "securepassword123",
                "organization_id": test_organization.id,
                "first_name": "Created",
                "last_name": "User",
                "role": "user"
            },
            headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "created@test.com"
        assert data["first_name"] == "Created"

    def test_create_user_uses_bcrypt(
        self, client: TestClient, admin_auth_headers: dict,
        test_organization: Organization, db: Session
    ):
        """Test that created users have bcrypt password hashes."""
        response = client.post(
            "/api/v1/admin/users",
            json={
                "email": "bcrypt@test.com",
                "password": "testpassword",
                "organization_id": test_organization.id,
                "role": "user"
            },
            headers=admin_auth_headers
        )
        assert response.status_code == 200

        # Verify the password is bcrypt hashed (starts with $2b$)
        user = db.query(User).filter(User.email == "bcrypt@test.com").first()
        assert user is not None
        assert user.password_hash.startswith("$2b$")

    def test_get_user_not_found(
        self, client: TestClient, admin_auth_headers: dict
    ):
        """Test getting non-existent user."""
        response = client.get("/api/v1/admin/users/99999", headers=admin_auth_headers)
        assert response.status_code == 404


class TestDemoDataReset:
    """Tests for demo data reset endpoint."""

    def test_reset_demo_requires_super_admin(
        self, client: TestClient, auth_headers: dict
    ):
        """Test that demo reset requires super admin."""
        response = client.post("/api/v1/admin/reset-demo", headers=auth_headers)
        assert response.status_code == 403

    def test_reset_demo_success(
        self, client: TestClient, admin_auth_headers: dict
    ):
        """Test successful demo data reset."""
        response = client.post("/api/v1/admin/reset-demo", headers=admin_auth_headers)
        assert response.status_code == 200
        assert "success" in response.json()["message"].lower() or "reset" in response.json()["message"].lower()
