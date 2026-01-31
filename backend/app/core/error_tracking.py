"""Error tracking integration with Sentry for production monitoring."""
import os
import logging
from typing import Optional, Dict, Any
from functools import wraps

logger = logging.getLogger(__name__)

# Sentry configuration
SENTRY_DSN = os.getenv("SENTRY_DSN", "")
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", "production")
SENTRY_RELEASE = os.getenv("SENTRY_RELEASE", os.getenv("APP_VERSION", "1.0.0"))
SENTRY_SAMPLE_RATE = float(os.getenv("SENTRY_SAMPLE_RATE", "1.0"))
SENTRY_TRACES_SAMPLE_RATE = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))

_sentry_initialized = False


def init_sentry() -> bool:
    """Initialize Sentry error tracking."""
    global _sentry_initialized

    if _sentry_initialized:
        return True

    if not SENTRY_DSN:
        logger.info("Sentry DSN not configured, error tracking disabled")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=SENTRY_ENVIRONMENT,
            release=SENTRY_RELEASE,
            sample_rate=SENTRY_SAMPLE_RATE,
            traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                LoggingIntegration(
                    level=logging.INFO,
                    event_level=logging.ERROR,
                ),
            ],
            # Don't send PII by default
            send_default_pii=False,
            # Attach request data
            request_bodies="medium",
            # Filter sensitive data
            before_send=_before_send,
        )

        _sentry_initialized = True
        logger.info(f"Sentry initialized: environment={SENTRY_ENVIRONMENT}, release={SENTRY_RELEASE}")
        return True

    except ImportError:
        logger.warning("sentry-sdk not installed, error tracking disabled")
        return False
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")
        return False


def _before_send(event: Dict, hint: Dict) -> Optional[Dict]:
    """Process events before sending to Sentry."""
    # Filter out sensitive data
    if "request" in event:
        request = event["request"]

        # Remove sensitive headers
        if "headers" in request:
            sensitive_headers = ["authorization", "cookie", "x-api-key", "x-csrf-token"]
            request["headers"] = {
                k: v for k, v in request["headers"].items()
                if k.lower() not in sensitive_headers
            }

        # Remove sensitive query params
        if "query_string" in request:
            sensitive_params = ["token", "api_key", "password", "secret"]
            query = request.get("query_string", "")
            for param in sensitive_params:
                if param in query.lower():
                    request["query_string"] = "[FILTERED]"
                    break

    # Remove sensitive data from exception
    if "exception" in event:
        for exception in event.get("exception", {}).get("values", []):
            for frame in exception.get("stacktrace", {}).get("frames", []):
                # Filter local variables
                if "vars" in frame:
                    sensitive_keys = ["password", "secret", "token", "api_key", "credential"]
                    frame["vars"] = {
                        k: "[FILTERED]" if any(s in k.lower() for s in sensitive_keys) else v
                        for k, v in frame["vars"].items()
                    }

    return event


def set_user_context(
    user_id: Optional[int] = None,
    email: Optional[str] = None,
    organization_id: Optional[int] = None,
    tenant_id: Optional[str] = None,
) -> None:
    """Set user context for error tracking."""
    if not _sentry_initialized:
        return

    try:
        import sentry_sdk

        sentry_sdk.set_user({
            "id": str(user_id) if user_id else None,
            "email": email,
        })

        if organization_id:
            sentry_sdk.set_tag("organization_id", str(organization_id))
        if tenant_id:
            sentry_sdk.set_tag("tenant_id", tenant_id)

    except Exception as e:
        logger.debug(f"Failed to set Sentry user context: {e}")


def set_context(name: str, data: Dict[str, Any]) -> None:
    """Set additional context for error tracking."""
    if not _sentry_initialized:
        return

    try:
        import sentry_sdk
        sentry_sdk.set_context(name, data)
    except Exception as e:
        logger.debug(f"Failed to set Sentry context: {e}")


def set_tag(key: str, value: str) -> None:
    """Set a tag for error grouping."""
    if not _sentry_initialized:
        return

    try:
        import sentry_sdk
        sentry_sdk.set_tag(key, value)
    except Exception as e:
        logger.debug(f"Failed to set Sentry tag: {e}")


def capture_exception(
    exception: Exception,
    extra: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Capture an exception and send to Sentry."""
    if not _sentry_initialized:
        logger.exception("Exception captured (Sentry disabled)")
        return None

    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            if extra:
                for key, value in extra.items():
                    scope.set_extra(key, value)

            event_id = sentry_sdk.capture_exception(exception)
            logger.info(f"Exception captured in Sentry: {event_id}")
            return event_id

    except Exception as e:
        logger.error(f"Failed to capture exception in Sentry: {e}")
        return None


def capture_message(
    message: str,
    level: str = "info",
    extra: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Capture a message and send to Sentry."""
    if not _sentry_initialized:
        logger.log(getattr(logging, level.upper(), logging.INFO), message)
        return None

    try:
        import sentry_sdk

        with sentry_sdk.push_scope() as scope:
            if extra:
                for key, value in extra.items():
                    scope.set_extra(key, value)

            event_id = sentry_sdk.capture_message(message, level=level)
            return event_id

    except Exception as e:
        logger.error(f"Failed to capture message in Sentry: {e}")
        return None


def track_performance(name: str, op: str = "function"):
    """Decorator to track function performance in Sentry."""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not _sentry_initialized:
                return await func(*args, **kwargs)

            try:
                import sentry_sdk
                with sentry_sdk.start_transaction(name=name, op=op) as transaction:
                    result = await func(*args, **kwargs)
                    transaction.set_status("ok")
                    return result
            except Exception as e:
                if _sentry_initialized:
                    import sentry_sdk
                    sentry_sdk.capture_exception(e)
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not _sentry_initialized:
                return func(*args, **kwargs)

            try:
                import sentry_sdk
                with sentry_sdk.start_transaction(name=name, op=op) as transaction:
                    result = func(*args, **kwargs)
                    transaction.set_status("ok")
                    return result
            except Exception as e:
                if _sentry_initialized:
                    import sentry_sdk
                    sentry_sdk.capture_exception(e)
                raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# Initialize Sentry on module import (only in production)
if os.getenv("DEBUG", "false").lower() != "true":
    init_sentry()
