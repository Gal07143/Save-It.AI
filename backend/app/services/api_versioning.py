"""API versioning service for version negotiation."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
import re
import logging

logger = logging.getLogger(__name__)


class VersionStatus(str, Enum):
    CURRENT = "current"
    SUPPORTED = "supported"
    DEPRECATED = "deprecated"
    SUNSET = "sunset"


@dataclass
class APIVersion:
    """Represents an API version."""
    version: str
    status: VersionStatus
    release_date: date
    deprecation_date: Optional[date] = None
    sunset_date: Optional[date] = None
    changelog: List[str] = field(default_factory=list)


class APIVersioningService:
    """Service for API version management and negotiation."""
    
    CURRENT_VERSION = "1.0.0"
    
    def __init__(self):
        self.versions: Dict[str, APIVersion] = {}
        self._register_versions()
    
    def _register_versions(self):
        """Register available API versions."""
        self.versions["1.0.0"] = APIVersion(
            version="1.0.0",
            status=VersionStatus.CURRENT,
            release_date=date(2025, 1, 1),
            changelog=[
                "Initial API release",
                "Energy management endpoints",
                "Device integration",
                "Billing and invoicing",
                "Digital twin management",
                "AI-powered analytics",
            ],
        )
    
    def get_version(self, version: str) -> Optional[APIVersion]:
        """Get version information."""
        return self.versions.get(version)
    
    def get_current_version(self) -> str:
        """Get current API version."""
        return self.CURRENT_VERSION
    
    def get_all_versions(self) -> List[dict]:
        """Get all API versions."""
        return [
            {
                "version": v.version,
                "status": v.status.value,
                "release_date": v.release_date.isoformat(),
                "deprecation_date": v.deprecation_date.isoformat() if v.deprecation_date else None,
                "sunset_date": v.sunset_date.isoformat() if v.sunset_date else None,
            }
            for v in self.versions.values()
        ]
    
    def is_version_supported(self, version: str) -> bool:
        """Check if a version is supported."""
        v = self.versions.get(version)
        return v is not None and v.status != VersionStatus.SUNSET
    
    def parse_accept_header(self, accept_header: str) -> str:
        """Parse Accept header to determine requested version."""
        version_pattern = r'application/vnd\.saveit\.v(\d+(?:\.\d+)*)\+json'
        match = re.search(version_pattern, accept_header)
        
        if match:
            return match.group(1)
        
        return self.CURRENT_VERSION
    
    def get_version_headers(self, version: str) -> Dict[str, str]:
        """Get response headers for version information."""
        v = self.versions.get(version)
        headers = {
            "X-API-Version": version,
            "X-API-Current-Version": self.CURRENT_VERSION,
        }
        
        if v:
            if v.status == VersionStatus.DEPRECATED and v.sunset_date:
                headers["X-API-Deprecated"] = "true"
                headers["X-API-Sunset-Date"] = v.sunset_date.isoformat()
                headers["Deprecation"] = v.deprecation_date.isoformat() if v.deprecation_date else ""
                headers["Sunset"] = v.sunset_date.isoformat()
        
        return headers
    
    def deprecate_version(self, version: str, sunset_date: date):
        """Mark a version as deprecated."""
        if version in self.versions:
            self.versions[version].status = VersionStatus.DEPRECATED
            self.versions[version].deprecation_date = date.today()
            self.versions[version].sunset_date = sunset_date
            logger.info(f"API version {version} deprecated, sunset: {sunset_date}")


api_versioning = APIVersioningService()


class VersioningMiddleware:
    """Middleware for API version negotiation."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        headers = dict(scope.get("headers", []))
        accept = headers.get(b"accept", b"").decode()
        
        version = api_versioning.parse_accept_header(accept)
        
        if not api_versioning.is_version_supported(version):
            await self._send_version_error(send, version)
            return
        
        v = api_versioning.get_version(version)
        if v and v.status == VersionStatus.SUNSET:
            await self._send_sunset_error(send, version, v)
            return
        
        scope["api_version"] = version
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                version_headers = api_versioning.get_version_headers(version)
                new_headers = list(message.get("headers", []))
                for k, v in version_headers.items():
                    new_headers.append((k.lower().encode(), v.encode()))
                message["headers"] = new_headers
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)
    
    async def _send_version_error(self, send, version: str):
        """Send error response for unsupported version."""
        import json
        body = json.dumps({
            "error": "Unsupported API version",
            "requested_version": version,
            "current_version": api_versioning.CURRENT_VERSION,
            "available_versions": [v.version for v in api_versioning.versions.values()],
        }).encode()
        
        await send({
            "type": "http.response.start",
            "status": 400,
            "headers": [
                (b"content-type", b"application/json"),
                (b"x-api-current-version", api_versioning.CURRENT_VERSION.encode()),
            ],
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })
    
    async def _send_sunset_error(self, send, version: str, v):
        """Send error response for sunset version."""
        import json
        body = json.dumps({
            "error": "API version has been sunset",
            "requested_version": version,
            "sunset_date": v.sunset_date.isoformat() if v.sunset_date else None,
            "current_version": api_versioning.CURRENT_VERSION,
            "message": f"API version {version} is no longer available. Please upgrade to {api_versioning.CURRENT_VERSION}.",
        }).encode()
        
        await send({
            "type": "http.response.start",
            "status": 410,
            "headers": [
                (b"content-type", b"application/json"),
                (b"x-api-current-version", api_versioning.CURRENT_VERSION.encode()),
            ],
        })
        await send({
            "type": "http.response.body",
            "body": body,
        })
