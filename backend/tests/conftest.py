"""Pytest fixtures for Save-It.AI backend tests."""

import os
import pytest
from datetime import datetime
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Set test environment before importing app modules
os.environ["DEBUG"] = "true"
os.environ["SESSION_SECRET"] = "test-secret-key-for-testing-only"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from backend.app.main import app
from backend.app.core.database import Base, get_db
from backend.app.models import User, Organization, UserRole
from backend.app.utils.password import hash_password


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db() -> Generator[Session, None, None]:
    """Override database dependency for testing."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db() -> Generator[Session, None, None]:
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db: Session) -> Generator[TestClient, None, None]:
    """Create a test client with database override."""
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_organization(db: Session) -> Organization:
    """Create a test organization."""
    org = Organization(
        name="Test Organization",
        slug="test-org",
        is_active=1
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@pytest.fixture
def test_user(db: Session, test_organization: Organization) -> User:
    """Create a test user."""
    user = User(
        organization_id=test_organization.id,
        email="test@example.com",
        password_hash=hash_password("testpassword123"),
        first_name="Test",
        last_name="User",
        role=UserRole.ORG_ADMIN,
        is_active=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_super_admin(db: Session, test_organization: Organization) -> User:
    """Create a test super admin user."""
    user = User(
        organization_id=test_organization.id,
        email="admin@example.com",
        password_hash=hash_password("adminpassword123"),
        first_name="Admin",
        last_name="User",
        role=UserRole.SUPER_ADMIN,
        is_active=1
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client: TestClient, test_user: User) -> dict:
    """Get authentication headers for a test user."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(client: TestClient, test_super_admin: User) -> dict:
    """Get authentication headers for a super admin user."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "adminpassword123"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
