"""API versioning utilities."""
from datetime import datetime
from typing import Optional
from fastapi import Header, HTTPException, Request
from functools import wraps


API_VERSIONS = {
    "v1": {
        "status": "current",
        "deprecated": False,
        "sunset_date": None,
        "min_date": "2024-01-01",
    },
    "v2": {
        "status": "beta",
        "deprecated": False,
        "sunset_date": None,
        "min_date": "2025-01-01",
    },
}

CURRENT_VERSION = "v1"
SUPPORTED_VERSIONS = ["v1"]


def get_api_version(request: Request) -> str:
    """Extract API version from request path."""
    path_parts = request.url.path.split("/")
    for part in path_parts:
        if part.startswith("v") and part[1:].isdigit():
            return part
    return CURRENT_VERSION


def validate_api_version(
    api_version: Optional[str] = Header(None, alias="X-API-Version"),
) -> str:
    """
    Dependency to validate and return API version.
    
    Checks header first, falls back to URL path version.
    """
    version = api_version or CURRENT_VERSION
    
    if version not in SUPPORTED_VERSIONS:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Unsupported API version",
                "requested_version": version,
                "supported_versions": SUPPORTED_VERSIONS,
                "current_version": CURRENT_VERSION,
            }
        )
    
    return version


def version_info() -> dict:
    """Get API version information."""
    return {
        "current_version": CURRENT_VERSION,
        "supported_versions": SUPPORTED_VERSIONS,
        "versions": API_VERSIONS,
    }


def deprecated(
    sunset_date: str,
    replacement: Optional[str] = None,
    message: Optional[str] = None,
):
    """
    Decorator to mark an endpoint as deprecated.
    
    Adds deprecation headers to response.
    
    Usage:
        @deprecated(sunset_date="2025-06-01", replacement="/api/v2/sites")
        @router.get("/sites")
        def get_sites():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            response = await func(*args, **kwargs) if asyncio.iscoroutinefunction(func) else func(*args, **kwargs)
            
            if hasattr(response, 'headers'):
                response.headers["Deprecation"] = "true"
                response.headers["Sunset"] = sunset_date
                
                if replacement:
                    response.headers["Link"] = f'<{replacement}>; rel="successor-version"'
            
            return response
        
        wrapper._deprecated = True
        wrapper._sunset_date = sunset_date
        wrapper._replacement = replacement
        wrapper._deprecation_message = message
        
        return wrapper
    return decorator


def add_version_headers(response, version: str = CURRENT_VERSION):
    """Add API version headers to response."""
    response.headers["X-API-Version"] = version
    response.headers["X-API-Supported-Versions"] = ", ".join(SUPPORTED_VERSIONS)
    return response


import asyncio
