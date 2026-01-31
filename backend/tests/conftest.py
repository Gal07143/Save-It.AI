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


@pytest.fixture
def authenticated_client(client: TestClient, auth_headers: dict) -> TestClient:
    """Return a client with authentication headers pre-configured."""
    client.headers.update(auth_headers)
    return client


# =============================================================================
# Factory Fixtures
# =============================================================================

@pytest.fixture
def site_factory(db: Session, test_organization: Organization):
    """Factory to create test sites."""
    from backend.app.models import Site

    def create_site(
        name: str = "Test Site",
        address: str = "123 Test St",
        city: str = "Test City",
        country: str = "Test Country",
        timezone: str = "UTC",
        **kwargs
    ):
        site = Site(
            organization_id=test_organization.id,
            name=name,
            address=address,
            city=city,
            country=country,
            timezone=timezone,
            is_active=1,
            **kwargs
        )
        db.add(site)
        db.commit()
        db.refresh(site)
        return site

    return create_site


@pytest.fixture
def meter_factory(db: Session):
    """Factory to create test meters."""
    from backend.app.models import Meter

    def create_meter(
        site_id: int,
        name: str = "Test Meter",
        meter_id: str = None,
        **kwargs
    ):
        import uuid
        meter = Meter(
            site_id=site_id,
            name=name,
            meter_id=meter_id or f"MTR-{uuid.uuid4().hex[:8].upper()}",
            is_active=1,
            **kwargs
        )
        db.add(meter)
        db.commit()
        db.refresh(meter)
        return meter

    return create_meter


@pytest.fixture
def asset_factory(db: Session):
    """Factory to create test assets."""
    from backend.app.models import Asset

    def create_asset(
        site_id: int,
        name: str = "Test Asset",
        asset_type: str = "switchboard",
        parent_id: int = None,
        **kwargs
    ):
        asset = Asset(
            site_id=site_id,
            name=name,
            asset_type=asset_type,
            parent_id=parent_id,
            is_critical=kwargs.pop("is_critical", False),
            requires_metering=kwargs.pop("requires_metering", True),
            **kwargs
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        return asset

    return create_asset


@pytest.fixture
def user_factory(db: Session, test_organization: Organization):
    """Factory to create test users."""
    from backend.app.models import User, UserRole

    _counter = [0]

    def create_user(
        email: str = None,
        password: str = "testpassword123",
        role: UserRole = UserRole.VIEWER,
        **kwargs
    ):
        _counter[0] += 1
        user = User(
            organization_id=kwargs.pop("organization_id", test_organization.id),
            email=email or f"user{_counter[0]}@example.com",
            password_hash=hash_password(password),
            first_name=kwargs.pop("first_name", "Test"),
            last_name=kwargs.pop("last_name", f"User{_counter[0]}"),
            role=role,
            is_active=1,
            **kwargs
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return create_user


@pytest.fixture
def gateway_factory(db: Session):
    """Factory to create test gateways."""
    from backend.app.models.integrations import Gateway

    def create_gateway(
        site_id: int,
        name: str = "Test Gateway",
        **kwargs
    ):
        gateway = Gateway(
            site_id=site_id,
            name=name,
            status="online",
            **kwargs
        )
        db.add(gateway)
        db.commit()
        db.refresh(gateway)
        return gateway

    return create_gateway


@pytest.fixture
def data_source_factory(db: Session):
    """Factory to create test data sources."""
    from backend.app.models import DataSource

    def create_data_source(
        site_id: int,
        name: str = "Test Device",
        source_type: str = "modbus",
        **kwargs
    ):
        data_source = DataSource(
            site_id=site_id,
            name=name,
            source_type=source_type,
            is_active=1,
            **kwargs
        )
        db.add(data_source)
        db.commit()
        db.refresh(data_source)
        return data_source

    return create_data_source


@pytest.fixture
def test_site(db: Session, site_factory):
    """Create a default test site."""
    return site_factory(name="Default Test Site")


@pytest.fixture
def test_meter(db: Session, test_site, meter_factory):
    """Create a default test meter."""
    return meter_factory(site_id=test_site.id)


@pytest.fixture
def test_asset(db: Session, test_site, asset_factory):
    """Create a default test asset."""
    return asset_factory(site_id=test_site.id)
