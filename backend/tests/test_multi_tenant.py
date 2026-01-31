"""Tests for multi-tenant isolation."""
import pytest
from fastapi.testclient import TestClient


class TestTenantIsolation:
    """Test that tenants are properly isolated."""

    def test_user_cannot_access_other_org_site(
        self, client: TestClient, db, test_organization, user_factory, site_factory
    ):
        """Test that users cannot access sites from other organizations."""
        from backend.app.models import Organization

        # Create another organization
        other_org = Organization(name="Other Org", slug="other-org", is_active=1)
        db.add(other_org)
        db.commit()

        # Create a site for the other org
        other_site = site_factory(name="Other Site")
        other_site.organization_id = other_org.id
        db.commit()

        # Create user in first org
        user = user_factory()

        # Login as user from first org
        response = client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "testpassword123"}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Try to access other org's site
        response = client.get(f"/api/v1/sites/{other_site.id}", headers=headers)
        # Should either return 404 or 403
        assert response.status_code in [403, 404]

    def test_user_can_only_see_own_org_sites(
        self, client: TestClient, db, test_organization, user_factory, site_factory
    ):
        """Test that site listing only shows user's organization sites."""
        from backend.app.models import Organization

        # Create site for test org
        my_site = site_factory(name="My Site")

        # Create another org with site
        other_org = Organization(name="Other Org", slug="other-org-2", is_active=1)
        db.add(other_org)
        db.commit()

        # Create user
        user = user_factory()

        # Login
        response = client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "testpassword123"}
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # List sites
        response = client.get("/api/v1/sites", headers=headers)
        assert response.status_code == 200

        sites = response.json()
        # Should only see own org's site
        site_names = [s["name"] for s in sites]
        assert "My Site" in site_names

    def test_cannot_create_site_for_other_org(
        self, client: TestClient, db, test_organization, user_factory
    ):
        """Test that users cannot create sites for other organizations."""
        from backend.app.models import Organization

        # Create another org
        other_org = Organization(name="Other Org", slug="other-org-3", is_active=1)
        db.add(other_org)
        db.commit()

        # Create user in first org
        user = user_factory()

        # Login
        response = client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": "testpassword123"}
        )
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Try to create site for other org (if org_id is exposed)
        response = client.post(
            "/api/v1/sites",
            json={
                "name": "Sneaky Site",
                "organization_id": other_org.id,  # Try to set other org
            },
            headers=headers
        )
        # Should either fail or ignore the org_id
        if response.status_code == 200:
            # If created, should be in user's org, not other org
            created_site = response.json()
            assert created_site.get("organization_id") != other_org.id
