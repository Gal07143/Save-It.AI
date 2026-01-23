"""Standardized API response schemas.

This module provides consistent response wrappers for API endpoints,
ensuring uniform response structure across the application.
"""

from typing import Generic, TypeVar, Optional, List, Any
from pydantic import BaseModel, Field

T = TypeVar('T')


class PaginationMeta(BaseModel):
    """Pagination metadata for list responses."""
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number (1-indexed)")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_prev: bool = Field(..., description="Whether there is a previous page")

    @classmethod
    def create(cls, total: int, page: int, page_size: int) -> "PaginationMeta":
        """Create pagination metadata from total count and page info."""
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )


class APIResponse(BaseModel, Generic[T]):
    """Standard API response wrapper.

    All successful API responses should use this wrapper for consistency.
    """
    success: bool = Field(True, description="Whether the request was successful")
    data: Optional[T] = Field(None, description="Response data payload")
    message: Optional[str] = Field(None, description="Human-readable message")
    meta: Optional[dict] = Field(None, description="Additional metadata (pagination, etc.)")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {"id": 1, "name": "Example"},
                "message": "Resource retrieved successfully",
                "meta": None
            }
        }


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response wrapper."""
    success: bool = Field(True, description="Whether the request was successful")
    data: List[T] = Field(default_factory=list, description="List of items")
    message: Optional[str] = Field(None, description="Human-readable message")
    meta: PaginationMeta = Field(..., description="Pagination metadata")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": [{"id": 1}, {"id": 2}],
                "message": None,
                "meta": {
                    "total": 100,
                    "page": 1,
                    "page_size": 10,
                    "total_pages": 10,
                    "has_next": True,
                    "has_prev": False
                }
            }
        }


class ErrorDetail(BaseModel):
    """Detailed error information."""
    field: Optional[str] = Field(None, description="Field name if validation error")
    code: str = Field(..., description="Error code")
    message: str = Field(..., description="Error message")


class ErrorResponse(BaseModel):
    """Standard error response wrapper.

    All error responses should use this wrapper for consistency.
    """
    success: bool = Field(False, description="Always false for errors")
    error: str = Field(..., description="Error type/code")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[List[ErrorDetail]] = Field(None, description="Detailed error information")

    class Config:
        json_schema_extra = {
            "example": {
                "success": False,
                "error": "validation_error",
                "message": "Invalid input data",
                "details": [
                    {"field": "email", "code": "invalid_format", "message": "Invalid email format"}
                ]
            }
        }


# Helper functions for creating responses
def success_response(
    data: Any = None,
    message: Optional[str] = None,
    meta: Optional[dict] = None
) -> dict:
    """Create a success response dictionary."""
    return {
        "success": True,
        "data": data,
        "message": message,
        "meta": meta
    }


def error_response(
    error: str,
    message: str,
    details: Optional[List[dict]] = None
) -> dict:
    """Create an error response dictionary."""
    return {
        "success": False,
        "error": error,
        "message": message,
        "details": details
    }


def paginated_response(
    data: List[Any],
    total: int,
    page: int,
    page_size: int,
    message: Optional[str] = None
) -> dict:
    """Create a paginated response dictionary."""
    return {
        "success": True,
        "data": data,
        "message": message,
        "meta": PaginationMeta.create(total, page, page_size).model_dump()
    }
