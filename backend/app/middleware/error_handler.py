"""Standardized error handling middleware."""
import traceback
import logging
from typing import Callable
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, OperationalError

logger = logging.getLogger("saveit.errors")


class ErrorResponse:
    """Standardized error response format."""
    
    @staticmethod
    def create(
        status_code: int,
        error_type: str,
        message: str,
        details: dict = None,
        request_id: str = None,
    ) -> JSONResponse:
        content = {
            "error": {
                "type": error_type,
                "message": message,
                "status_code": status_code,
            }
        }
        if details:
            content["error"]["details"] = details
        if request_id:
            content["error"]["request_id"] = request_id
        
        return JSONResponse(status_code=status_code, content=content)


async def error_handler_middleware(request: Request, call_next: Callable):
    """
    Middleware to catch and standardize all error responses.
    
    Converts various exception types to consistent JSON error format.
    """
    try:
        return await call_next(request)
    
    except ValidationError as e:
        logger.warning(f"Validation error: {e}")
        return ErrorResponse.create(
            status_code=422,
            error_type="validation_error",
            message="Request validation failed",
            details={"errors": e.errors()},
        )
    
    except IntegrityError as e:
        logger.error(f"Database integrity error: {e}")
        error_msg = str(e.orig) if hasattr(e, "orig") else str(e)
        
        if "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
            return ErrorResponse.create(
                status_code=409,
                error_type="conflict",
                message="Resource already exists or conflicts with existing data",
            )
        elif "foreign key" in error_msg.lower():
            return ErrorResponse.create(
                status_code=400,
                error_type="invalid_reference",
                message="Referenced resource does not exist",
            )
        else:
            return ErrorResponse.create(
                status_code=400,
                error_type="database_error",
                message="Database constraint violation",
            )
    
    except OperationalError as e:
        logger.error(f"Database operational error: {e}")
        return ErrorResponse.create(
            status_code=503,
            error_type="service_unavailable",
            message="Database temporarily unavailable. Please try again.",
        )
    
    except PermissionError as e:
        logger.warning(f"Permission denied: {e}")
        return ErrorResponse.create(
            status_code=403,
            error_type="forbidden",
            message="You do not have permission to perform this action",
        )
    
    except FileNotFoundError as e:
        logger.warning(f"File not found: {e}")
        return ErrorResponse.create(
            status_code=404,
            error_type="not_found",
            message="Requested resource not found",
        )
    
    except Exception as e:
        logger.error(f"Unhandled exception: {e}\n{traceback.format_exc()}")
        return ErrorResponse.create(
            status_code=500,
            error_type="internal_error",
            message="An unexpected error occurred. Please try again later.",
        )


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Wrapper class for error handling middleware."""
    
    async def dispatch(self, request: Request, call_next):
        return await error_handler_middleware(request, call_next)
