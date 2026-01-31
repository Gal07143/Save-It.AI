"""Structured JSON logging configuration for production observability."""
import json
import logging
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from contextvars import ContextVar
from functools import wraps

# Context variables for request correlation
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
tenant_id_var: ContextVar[Optional[str]] = ContextVar("tenant_id", default=None)
user_id_var: ContextVar[Optional[int]] = ContextVar("user_id", default=None)


def get_request_id() -> Optional[str]:
    """Get current request ID from context."""
    return request_id_var.get()


def set_request_id(request_id: str) -> None:
    """Set request ID in context."""
    request_id_var.set(request_id)


def get_tenant_id() -> Optional[str]:
    """Get current tenant ID from context."""
    return tenant_id_var.get()


def set_tenant_id(tenant_id: str) -> None:
    """Set tenant ID in context."""
    tenant_id_var.set(tenant_id)


def get_user_id() -> Optional[int]:
    """Get current user ID from context."""
    return user_id_var.get()


def set_user_id(user_id: int) -> None:
    """Set user ID in context."""
    user_id_var.set(user_id)


class JSONFormatter(logging.Formatter):
    """JSON log formatter for structured logging."""

    def __init__(
        self,
        include_timestamp: bool = True,
        include_hostname: bool = True,
        extra_fields: Optional[Dict[str, Any]] = None,
    ):
        super().__init__()
        self.include_timestamp = include_timestamp
        self.include_hostname = include_hostname
        self.extra_fields = extra_fields or {}

        if include_hostname:
            import socket
            self._hostname = socket.gethostname()

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add timestamp in ISO 8601 format
        if self.include_timestamp:
            log_data["timestamp"] = datetime.now(timezone.utc).isoformat()

        # Add hostname
        if self.include_hostname:
            log_data["hostname"] = self._hostname

        # Add request context
        request_id = get_request_id()
        if request_id:
            log_data["request_id"] = request_id

        tenant_id = get_tenant_id()
        if tenant_id:
            log_data["tenant_id"] = tenant_id

        user_id = get_user_id()
        if user_id:
            log_data["user_id"] = user_id

        # Add source location
        log_data["source"] = {
            "file": record.pathname,
            "line": record.lineno,
            "function": record.funcName,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info),
            }

        # Add any extra fields from the record
        for key in record.__dict__:
            if key not in (
                "name", "msg", "args", "created", "filename", "funcName",
                "levelname", "levelno", "lineno", "module", "msecs",
                "pathname", "process", "processName", "relativeCreated",
                "stack_info", "exc_info", "exc_text", "message",
            ):
                log_data[key] = getattr(record, key)

        # Add static extra fields
        log_data.update(self.extra_fields)

        return json.dumps(log_data, default=str)


class RequestLogAdapter(logging.LoggerAdapter):
    """Logger adapter that includes request context in all log messages."""

    def process(self, msg, kwargs):
        extra = kwargs.get("extra", {})

        # Add context from context vars
        request_id = get_request_id()
        if request_id:
            extra["request_id"] = request_id

        tenant_id = get_tenant_id()
        if tenant_id:
            extra["tenant_id"] = tenant_id

        user_id = get_user_id()
        if user_id:
            extra["user_id"] = user_id

        kwargs["extra"] = extra
        return msg, kwargs


def setup_logging(
    level: str = "INFO",
    json_output: bool = True,
    service_name: str = "saveit",
    environment: str = "production",
) -> None:
    """Configure structured logging for the application."""
    # Determine log level
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Use JSON formatting in production
    if json_output:
        formatter = JSONFormatter(
            extra_fields={
                "service": service_name,
                "environment": environment,
            }
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # Set level for third-party loggers
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> RequestLogAdapter:
    """Get a logger with request context support."""
    logger = logging.getLogger(name)
    return RequestLogAdapter(logger, {})


def log_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    request_id: Optional[str] = None,
    user_id: Optional[int] = None,
    tenant_id: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Log an HTTP request with structured data."""
    logger = logging.getLogger("saveit.http")

    log_data = {
        "method": method,
        "path": path,
        "status": status_code,
        "duration_ms": round(duration_ms, 2),
    }

    if request_id:
        log_data["request_id"] = request_id
    if user_id:
        log_data["user_id"] = user_id
    if tenant_id:
        log_data["tenant_id"] = tenant_id
    if extra:
        log_data.update(extra)

    # Determine log level based on status code
    if status_code >= 500:
        logger.error("Request completed", extra=log_data)
    elif status_code >= 400:
        logger.warning("Request completed", extra=log_data)
    else:
        logger.info("Request completed", extra=log_data)


def log_database_query(
    query: str,
    duration_ms: float,
    rows_affected: Optional[int] = None,
    request_id: Optional[str] = None,
) -> None:
    """Log a database query with timing."""
    logger = logging.getLogger("saveit.database")

    log_data = {
        "query": query[:500] if len(query) > 500 else query,  # Truncate long queries
        "duration_ms": round(duration_ms, 2),
    }

    if rows_affected is not None:
        log_data["rows_affected"] = rows_affected
    if request_id:
        log_data["request_id"] = request_id

    # Log slow queries as warnings
    if duration_ms > 1000:
        logger.warning("Slow database query", extra=log_data)
    else:
        logger.debug("Database query", extra=log_data)


def log_external_call(
    service: str,
    method: str,
    url: str,
    status_code: Optional[int],
    duration_ms: float,
    error: Optional[str] = None,
) -> None:
    """Log an external service call."""
    logger = logging.getLogger("saveit.external")

    log_data = {
        "service": service,
        "method": method,
        "url": url,
        "duration_ms": round(duration_ms, 2),
    }

    if status_code:
        log_data["status_code"] = status_code
    if error:
        log_data["error"] = error

    if error or (status_code and status_code >= 500):
        logger.error("External call failed", extra=log_data)
    elif status_code and status_code >= 400:
        logger.warning("External call returned error", extra=log_data)
    else:
        logger.info("External call completed", extra=log_data)


# Initialize logging on module import
_is_debug = os.getenv("DEBUG", "false").lower() == "true"
setup_logging(
    level="DEBUG" if _is_debug else "INFO",
    json_output=not _is_debug,
    service_name="saveit",
    environment="development" if _is_debug else "production",
)
