"""API key authentication for external API consumers."""
import secrets
from datetime import datetime
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.security import APIKeyHeader

from app.utils.hashing import hash_string

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def hash_api_key(api_key: str) -> str:
    """Hash an API key for secure storage."""
    return hash_string(api_key)


def generate_api_key(prefix: str = "saveit") -> tuple[str, str]:
    """
    Generate a new API key and its hash.
    
    Returns:
        tuple: (plain_key, hashed_key) - Store hashed_key, give plain_key to user once
    """
    random_part = secrets.token_urlsafe(32)
    plain_key = f"{prefix}_{random_part}"
    hashed_key = hash_api_key(plain_key)
    return plain_key, hashed_key


class APIKeyValidator:
    """
    Validate API keys against stored hashes.
    
    In production, this would query the database for stored API key hashes.
    """
    
    def __init__(self, db_session_factory=None):
        self.db_session_factory = db_session_factory
    
    async def validate_key(self, api_key: str) -> Optional[dict]:
        """
        Validate an API key and return associated metadata.
        
        Returns:
            dict with org_id, permissions, rate_limit if valid
            None if invalid
        """
        if not self.db_session_factory:
            return None
        
        hashed = hash_api_key(api_key)
        
        db = self.db_session_factory()
        try:
            from sqlalchemy import text
            result = db.execute(
                text("""
                    SELECT id, organization_id, name, permissions, rate_limit, is_active, expires_at
                    FROM api_keys 
                    WHERE key_hash = :key_hash
                """),
                {"key_hash": hashed}
            ).fetchone()
            
            if not result:
                return None
            
            if not result.is_active:
                return None
            
            if result.expires_at and result.expires_at < datetime.utcnow():
                return None
            
            db.execute(
                text("UPDATE api_keys SET last_used_at = :now WHERE id = :id"),
                {"now": datetime.utcnow(), "id": result.id}
            )
            db.commit()
            
            return {
                "key_id": result.id,
                "org_id": result.organization_id,
                "name": result.name,
                "permissions": result.permissions.split(",") if result.permissions else [],
                "rate_limit": result.rate_limit,
            }
        except Exception:
            return None
        finally:
            db.close()


async def get_api_key_auth(
    request: Request,
    api_key: Optional[str] = Depends(API_KEY_HEADER),
) -> Optional[dict]:
    """
    Dependency to validate API key from header.
    
    Returns API key metadata if valid, None if no key provided.
    Raises HTTPException if key is invalid.
    """
    if not api_key:
        return None
    
    if not api_key.startswith("saveit_"):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key format",
            headers={"WWW-Authenticate": "API-Key"},
        )
    
    from app.core.database import SessionLocal
    validator = APIKeyValidator(db_session_factory=SessionLocal)
    result = await validator.validate_key(api_key)
    
    if not result:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired API key",
            headers={"WWW-Authenticate": "API-Key"},
        )
    
    request.state.api_key = result
    return result


def require_api_key(permissions: list[str] = None):
    """
    Dependency factory to require API key with specific permissions.
    
    Usage:
        @router.get("/endpoint", dependencies=[Depends(require_api_key(["read:meters"]))])
    """
    async def check_permissions(
        api_key_data: Optional[dict] = Depends(get_api_key_auth),
    ) -> dict:
        if not api_key_data:
            raise HTTPException(
                status_code=401,
                detail="API key required",
                headers={"WWW-Authenticate": "API-Key"},
            )
        
        if permissions:
            key_permissions = api_key_data.get("permissions", [])
            if not any(p in key_permissions for p in permissions):
                raise HTTPException(
                    status_code=403,
                    detail=f"Missing required permissions: {permissions}",
                )
        
        return api_key_data
    
    return check_permissions
