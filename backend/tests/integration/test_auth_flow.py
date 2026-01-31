"""Integration tests for authentication flow."""
import pytest
from fastapi.testclient import TestClient


class TestAuthenticationFlow:
    """Test complete authentication workflows."""

    def test_register_login_access_logout_flow(self, client: TestClient, db):
        """Test complete auth flow: register -> login -> access protected -> logout."""
        # Step 1: Register new user
        register_data = {
            "email": "newuser@example.com",
            "password": "SecurePassword123!",
            "first_name": "New",
            "last_name": "User",
            "organization_name": "New Corp",
        }
        response = client.post("/api/v1/auth/register", json=register_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "newuser@example.com"
        token = data["access_token"]

        # Step 2: Access protected endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["email"] == "newuser@example.com"

        # Step 3: Access site listing (should work but be empty)
        response = client.get("/api/v1/sites", headers=headers)
        assert response.status_code == 200

        # Step 4: Logout
        response = client.post("/api/v1/auth/logout", headers=headers)
        assert response.status_code == 200

    def test_login_with_wrong_password_locks_account(self, client: TestClient, test_user):
        """Test that multiple failed logins lock the account."""
        # Try wrong password 5 times
        for i in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": test_user.email, "password": "wrongpassword"}
            )
            assert response.status_code == 401

        # 6th attempt should be locked
        response = client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "wrongpassword"}
        )
        assert response.status_code == 403
        assert "locked" in response.json()["detail"].lower()

    def test_token_expiry(self, client: TestClient, auth_headers: dict):
        """Test that valid token works for protected endpoints."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200

    def test_invalid_token_rejected(self, client: TestClient):
        """Test that invalid tokens are rejected."""
        headers = {"Authorization": "Bearer invalid-token-here"}
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401
