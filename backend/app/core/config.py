"""Application configuration settings."""
import os
import logging
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache

logger = logging.getLogger(__name__)

# Minimum required length for session secret in production
MIN_SESSION_SECRET_LENGTH = 32


def load_secret_from_file(file_path: Optional[str]) -> Optional[str]:
    """Load a secret from a file (for Kubernetes secret volume mounts)."""
    if not file_path:
        return None
    try:
        path = Path(file_path)
        if path.exists() and path.is_file():
            return path.read_text().strip()
    except Exception as e:
        logger.warning(f"Failed to read secret from file {file_path}: {e}")
    return None


def get_session_secret() -> str:
    """Get session secret from environment or file."""
    # First try environment variable
    secret = os.getenv("SESSION_SECRET", "")

    # If not set, try file path (for Kubernetes)
    if not secret:
        secret_file = os.getenv("SESSION_SECRET_FILE")
        if secret_file:
            secret = load_secret_from_file(secret_file) or ""

    return secret


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    APP_NAME: str = "SAVE-IT.AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Save-It.AI"

    DATABASE_URL: str = ""

    # Security settings
    SESSION_SECRET: str = get_session_secret()
    SECRET_KEY: str = ""
    CSRF_SECRET_KEY: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:5000"
    CORS_ORIGINS: str = ""

    # Redis for rate limiting and caching (optional)
    REDIS_URL: str = ""

    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    # MQTT Broker Settings
    MQTT_BROKER_HOST: str = "localhost"
    MQTT_BROKER_PORT: int = 1883
    MQTT_BROKER_TLS_PORT: int = 8883
    MQTT_PUBLIC_HOST: str = "localhost"
    MQTT_ENABLE_TLS: bool = False
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""

    EMAIL_PROVIDER: str = "smtp"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SENDGRID_API_KEY: str = ""

    WEBHOOK_BASE_URL: str = ""
    API_BASE_URL: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS as a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def validate_required_settings(self) -> None:
        """Validate that required settings are configured for production."""
        errors = []
        warnings = []

        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required")

        if not self.DEBUG:
            # Production-only requirements
            if not self.SESSION_SECRET:
                errors.append(
                    "SESSION_SECRET is required in production. "
                    "Set via SESSION_SECRET env var or SESSION_SECRET_FILE for Kubernetes. "
                    "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
            elif len(self.SESSION_SECRET) < MIN_SESSION_SECRET_LENGTH:
                errors.append(
                    f"SESSION_SECRET must be at least {MIN_SESSION_SECRET_LENGTH} characters "
                    f"(current length: {len(self.SESSION_SECRET)})"
                )

            if self.ALLOWED_ORIGINS == "http://localhost:5000":
                if self.ENVIRONMENT == "production":
                    errors.append(
                        "ALLOWED_ORIGINS must be set to actual frontend domain(s) in production. "
                        "Example: ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com"
                    )
                else:
                    warnings.append(
                        "ALLOWED_ORIGINS is set to default localhost value - "
                        "configure this for production"
                    )

            # Warn about Redis for horizontal scaling
            if not self.REDIS_URL:
                warnings.append(
                    "REDIS_URL is not set - rate limiting will use in-memory storage. "
                    "For horizontal scaling, configure Redis."
                )

        for warning in warnings:
            logger.warning(warning)

        if errors:
            raise RuntimeError(
                "Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
            )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


def validate_startup_config() -> None:
    """Validate configuration at startup."""
    config = get_settings()
    config.validate_required_settings()
    logger.info(f"Configuration validated: DEBUG={config.DEBUG}")


settings = get_settings()
