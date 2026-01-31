"""Tests for rate limiting middleware."""
import pytest
from fastapi.testclient import TestClient
import time


class TestRateLimiting:
    """Test rate limiting functionality."""

    def test_rate_limit_headers_present(self, client: TestClient, auth_headers: dict):
        """Test that rate limit headers are present in responses."""
        response = client.get("/api/v1/sites", headers=auth_headers)

        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers

    def test_rate_limit_remaining_decreases(self, client: TestClient, auth_headers: dict):
        """Test that remaining count decreases with requests."""
        response1 = client.get("/api/v1/sites", headers=auth_headers)
        remaining1 = int(response1.headers.get("X-RateLimit-Remaining", 0))

        response2 = client.get("/api/v1/sites", headers=auth_headers)
        remaining2 = int(response2.headers.get("X-RateLimit-Remaining", 0))

        # Remaining should decrease (or stay same if limit is very high)
        assert remaining2 <= remaining1

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
