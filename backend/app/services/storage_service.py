"""File storage service for uploads and exports."""
from typing import Dict, Optional, Any, List, BinaryIO
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import os
import uuid
import hashlib
import mimetypes
import logging

logger = logging.getLogger(__name__)


@dataclass
class StoredFile:
    """Represents a stored file."""
    id: str
    filename: str
    original_filename: str
    path: str
    size: int
    mime_type: str
    checksum: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)
    organization_id: Optional[int] = None
    user_id: Optional[int] = None


class StorageService:
    """Service for file storage and retrieval."""
    
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or os.getenv("STORAGE_PATH", "/tmp/saveit_storage"))
        self.base_path.mkdir(parents=True, exist_ok=True)
        self._files: Dict[str, StoredFile] = {}
        self._max_file_size = 100 * 1024 * 1024
        self._allowed_extensions = {
            ".csv", ".xlsx", ".xls", ".pdf", ".png", ".jpg", ".jpeg",
            ".json", ".xml", ".txt", ".doc", ".docx", ".zip",
        }
    
    def _get_storage_path(self, category: str, date: Optional[datetime] = None) -> Path:
        """Get the storage path for a category and date."""
        date = date or datetime.utcnow()
        path = self.base_path / category / date.strftime("%Y/%m")
        path.mkdir(parents=True, exist_ok=True)
        return path
    
    def _generate_filename(self, original: str) -> tuple:
        """Generate a unique filename."""
        file_id = str(uuid.uuid4())
        ext = Path(original).suffix.lower()
        safe_name = f"{file_id}{ext}"
        return file_id, safe_name
    
    def _calculate_checksum(self, content: bytes) -> str:
        """Calculate MD5 checksum of content."""
        return hashlib.md5(content).hexdigest()
    
    def validate_file(
        self,
        filename: str,
        size: int,
        mime_type: Optional[str] = None,
    ) -> tuple:
        """Validate a file before storing."""
        ext = Path(filename).suffix.lower()
        
        if ext not in self._allowed_extensions:
            return False, f"File type not allowed: {ext}"
        
        if size > self._max_file_size:
            return False, f"File too large: {size} bytes (max: {self._max_file_size})"
        
        return True, None
    
    async def store(
        self,
        content: bytes,
        original_filename: str,
        category: str = "uploads",
        organization_id: Optional[int] = None,
        user_id: Optional[int] = None,
        metadata: Optional[Dict] = None,
    ) -> StoredFile:
        """Store a file."""
        valid, error = self.validate_file(original_filename, len(content))
        if not valid:
            raise ValueError(error)
        
        file_id, safe_filename = self._generate_filename(original_filename)
        storage_path = self._get_storage_path(category)
        file_path = storage_path / safe_filename
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        mime_type, _ = mimetypes.guess_type(original_filename)
        
        stored_file = StoredFile(
            id=file_id,
            filename=safe_filename,
            original_filename=original_filename,
            path=str(file_path),
            size=len(content),
            mime_type=mime_type or "application/octet-stream",
            checksum=self._calculate_checksum(content),
            organization_id=organization_id,
            user_id=user_id,
            metadata=metadata or {},
        )
        
        self._files[file_id] = stored_file
        logger.info(f"File stored: {file_id} ({original_filename})")
        
        return stored_file
    
    async def store_stream(
        self,
        stream: BinaryIO,
        original_filename: str,
        category: str = "uploads",
        **kwargs,
    ) -> StoredFile:
        """Store a file from a stream."""
        content = stream.read()
        return await self.store(content, original_filename, category, **kwargs)
    
    def retrieve(self, file_id: str) -> Optional[bytes]:
        """Retrieve a file's content."""
        stored_file = self._files.get(file_id)
        if not stored_file:
            return None
        
        try:
            with open(stored_file.path, "rb") as f:
                return f.read()
        except FileNotFoundError:
            logger.error(f"File not found: {stored_file.path}")
            return None
    
    def get_file_info(self, file_id: str) -> Optional[StoredFile]:
        """Get file metadata."""
        return self._files.get(file_id)
    
    def delete(self, file_id: str) -> bool:
        """Delete a file."""
        stored_file = self._files.get(file_id)
        if not stored_file:
            return False
        
        try:
            os.remove(stored_file.path)
            del self._files[file_id]
            logger.info(f"File deleted: {file_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file {file_id}: {e}")
            return False
    
    def list_files(
        self,
        category: Optional[str] = None,
        organization_id: Optional[int] = None,
        limit: int = 100,
    ) -> List[StoredFile]:
        """List stored files."""
        files = list(self._files.values())
        
        if organization_id:
            files = [f for f in files if f.organization_id == organization_id]
        
        if category:
            files = [f for f in files if category in f.path]
        
        files.sort(key=lambda f: f.created_at, reverse=True)
        return files[:limit]
    
    def get_stats(self) -> dict:
        """Get storage statistics."""
        total_size = sum(f.size for f in self._files.values())
        by_type = {}
        for f in self._files.values():
            ext = Path(f.original_filename).suffix.lower()
            by_type[ext] = by_type.get(ext, 0) + 1
        
        return {
            "total_files": len(self._files),
            "total_size_bytes": total_size,
            "total_size_mb": total_size / (1024 * 1024),
            "by_extension": by_type,
        }


storage_service = StorageService()
