"""Application configuration settings."""
import os
import logging
from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    APP_NAME: str = "SAVE-IT.AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    # Security settings
    SESSION_SECRET: str = os.getenv("SESSION_SECRET", "")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5000")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

    MQTT_BROKER_HOST: str = os.getenv("MQTT_BROKER_HOST", "localhost")
    MQTT_BROKER_PORT: int = int(os.getenv("MQTT_BROKER_PORT", "1883"))

    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "smtp")
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SENDGRID_API_KEY: str = os.getenv("SENDGRID_API_KEY", "")

    WEBHOOK_BASE_URL: str = os.getenv("WEBHOOK_BASE_URL", "")
    API_BASE_URL: str = os.getenv("API_BASE_URL", "")

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse ALLOWED_ORIGINS as a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def validate_required_settings(self) -> None:
        """Validate that required settings are configured for production."""
        errors = []

        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required")

        if not self.DEBUG:
            # Production-only requirements
            if not self.SESSION_SECRET:
                errors.append("SESSION_SECRET is required in production")
            elif len(self.SESSION_SECRET) < 32:
                errors.append("SESSION_SECRET should be at least 32 characters")

            if self.ALLOWED_ORIGINS == "http://localhost:5000":
                logger.warning(
                    "ALLOWED_ORIGINS is set to default localhost value - "
                    "configure this for production"
                )

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
