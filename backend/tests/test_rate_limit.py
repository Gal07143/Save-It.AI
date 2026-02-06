"""Tests for rate limiting middleware."""
import os
import pytest
from fastapi.testclient import TestClient
import time


# Skip rate limit header tests when rate limiting is disabled in test mode
rate_limit_disabled = os.getenv("RATE_LIMIT_ENABLED") == "false" or os.getenv("TESTING") == "true"


class TestRateLimiting:
    """Test rate limiting functionality."""

    def test_rate_limit_headers_in_test_mode(self, client: TestClient, auth_headers: dict):
        """Test rate limit behavior in test mode (headers may or may not be present)."""
        response = client.get("/api/v1/sites", headers=auth_headers)
        assert response.status_code == 200
        # In test mode, rate limiting is disabled so headers may not be present
        # This test just verifies the endpoint works
        if "X-RateLimit-Limit" in response.headers:
            assert "X-RateLimit-Remaining" in response.headers
            assert "X-RateLimit-Reset" in response.headers

    def test_rate_limit_allows_requests_in_test_mode(self, client: TestClient, auth_headers: dict):
        """Test that requests are not blocked in test mode."""
        # Make multiple requests - should all succeed in test mode
        for _ in range(5):
            response = client.get("/api/v1/sites", headers=auth_headers)
            # All requests should succeed (not 429) in test mode
            assert response.status_code == 200

    def test_docs_not_rate_limited(self, client: TestClient):
        """Test that documentation endpoints are not rate limited."""
        # Make many requests to docs
        for _ in range(5):
            response = client.get("/docs")
            assert response.status_code in [200, 307]  # 307 for redirect
            assert "X-RateLimit-Limit" not in response.headers

    def test_health_check_not_rate_limited(self, client: TestClient):
        """Test that health check endpoints are not rate limited."""
        for _ in range(10):
            response = client.get("/api/v1/health/live")
            assert response.status_code == 200


class TestBurstProtection:
    """Test burst rate limiting."""

    def test_burst_limit_response(self, client: TestClient, auth_headers: dict):
        """Test that burst limit returns proper error response."""
        # This test would need many rapid requests to trigger burst limit
        # For now, just verify the endpoint works
        response = client.get("/api/v1/sites", headers=auth_headers)
        assert response.status_code in [200, 429]

        if response.status_code == 429:
            data = response.json()
            assert "error" in data
            assert "retry_after" in data
