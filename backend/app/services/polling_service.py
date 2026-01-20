"""Polling service for background data collection from devices."""
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import logging

logger = logging.getLogger(__name__)


class PollingStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


@dataclass
class PollingTask:
    """Represents a polling task for a data source."""
    id: str
    data_source_id: int
    protocol: str
    interval_seconds: int
    callback: Callable
    last_poll: Optional[datetime] = None
    next_poll: Optional[datetime] = None
    status: PollingStatus = PollingStatus.IDLE
    error_count: int = 0
    success_count: int = 0
    last_error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class PollingService:
    """Background service for polling data from devices."""
    
    def __init__(self):
        self.tasks: Dict[str, PollingTask] = {}
        self.running = False
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
    
    async def start(self):
        """Start the polling service."""
        if self.running:
            return
        
        self.running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Polling service started")
    
    async def stop(self):
        """Stop the polling service."""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Polling service stopped")
    
    async def add_task(
        self,
        task_id: str,
        data_source_id: int,
        protocol: str,
        interval_seconds: int,
        callback: Callable,
        metadata: Optional[Dict] = None,
    ):
        """Add a new polling task."""
        task = PollingTask(
            id=task_id,
            data_source_id=data_source_id,
            protocol=protocol,
            interval_seconds=interval_seconds,
            callback=callback,
            next_poll=datetime.utcnow(),
            metadata=metadata or {},
        )
        
        async with self._lock:
            self.tasks[task_id] = task
        
        logger.info(f"Added polling task: {task_id} (interval={interval_seconds}s)")
    
    async def remove_task(self, task_id: str):
        """Remove a polling task."""
        async with self._lock:
            if task_id in self.tasks:
                del self.tasks[task_id]
                logger.info(f"Removed polling task: {task_id}")
    
    async def pause_task(self, task_id: str):
        """Pause a polling task."""
        async with self._lock:
            if task_id in self.tasks:
                self.tasks[task_id].status = PollingStatus.PAUSED
    
    async def resume_task(self, task_id: str):
        """Resume a paused polling task."""
        async with self._lock:
            if task_id in self.tasks:
                self.tasks[task_id].status = PollingStatus.IDLE
                self.tasks[task_id].next_poll = datetime.utcnow()
    
    async def _run_loop(self):
        """Main polling loop."""
        while self.running:
            try:
                now = datetime.utcnow()
                tasks_to_poll = []
                
                async with self._lock:
                    for task in self.tasks.values():
                        if task.status == PollingStatus.PAUSED:
                            continue
                        if task.next_poll and task.next_poll <= now:
                            tasks_to_poll.append(task)
                
                for task in tasks_to_poll:
                    asyncio.create_task(self._execute_poll(task))
                
                await asyncio.sleep(1)
            
            except Exception as e:
                logger.error(f"Polling loop error: {e}")
                await asyncio.sleep(5)
    
    async def _execute_poll(self, task: PollingTask):
        """Execute a single poll for a task."""
        task.status = PollingStatus.RUNNING
        task.last_poll = datetime.utcnow()
        
        try:
            await task.callback(task.data_source_id, task.metadata)
            task.success_count += 1
            task.error_count = 0
            task.last_error = None
            task.status = PollingStatus.IDLE
            
        except Exception as e:
            task.error_count += 1
            task.last_error = str(e)
            task.status = PollingStatus.ERROR
            logger.error(f"Polling error for {task.id}: {e}")
            
            if task.error_count >= 5:
                task.status = PollingStatus.PAUSED
                logger.warning(f"Task {task.id} paused after 5 consecutive errors")
        
        finally:
            backoff = min(task.error_count * 2, 60) if task.error_count > 0 else 0
            task.next_poll = datetime.utcnow() + timedelta(
                seconds=task.interval_seconds + backoff
            )
    
    def get_status(self) -> dict:
        """Get polling service status."""
        return {
            "running": self.running,
            "task_count": len(self.tasks),
            "tasks": [
                {
                    "id": t.id,
                    "data_source_id": t.data_source_id,
                    "protocol": t.protocol,
                    "status": t.status.value,
                    "interval_seconds": t.interval_seconds,
                    "success_count": t.success_count,
                    "error_count": t.error_count,
                    "last_poll": t.last_poll.isoformat() if t.last_poll else None,
                    "next_poll": t.next_poll.isoformat() if t.next_poll else None,
                    "last_error": t.last_error,
                }
                for t in self.tasks.values()
            ],
        }


polling_service = PollingService()


async def poll_modbus_device(data_source_id: int, metadata: Dict):
    """Poll a Modbus device for readings."""
    logger.debug(f"Polling Modbus device: {data_source_id}")
    
    try:
        from backend.app.services.modbus_service import modbus_manager
        
        connection_id = metadata.get("connection_id")
        register_map = metadata.get("register_map", [])
        
        if not connection_id:
            logger.warning(f"No connection_id for Modbus device {data_source_id}")
            return
        
        readings = {}
        for reg in register_map:
            try:
                value = await modbus_manager.read_register(
                    connection_id,
                    reg.get("address"),
                    reg.get("count", 1),
                    reg.get("function_code", 3),
                )
                readings[reg.get("name")] = value
            except Exception as e:
                logger.error(f"Failed to read register {reg}: {e}")
        
        if readings:
            logger.info(f"Polled {len(readings)} registers from device {data_source_id}")
            
    except ImportError:
        logger.warning("Modbus service not available")
    except Exception as e:
        logger.error(f"Modbus polling error for device {data_source_id}: {e}")
        raise


async def poll_api_device(data_source_id: int, metadata: Dict):
    """Poll an API-based device for readings."""
    import httpx
    
    logger.debug(f"Polling API device: {data_source_id}")
    
    try:
        url = metadata.get("api_url")
        headers = metadata.get("headers", {})
        auth_token = metadata.get("auth_token")
        
        if not url:
            logger.warning(f"No API URL for device {data_source_id}")
            return
        
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"Polled API device {data_source_id}: {len(data)} fields")
            
    except httpx.HTTPError as e:
        logger.error(f"API polling HTTP error for device {data_source_id}: {e}")
        raise
    except Exception as e:
        logger.error(f"API polling error for device {data_source_id}: {e}")
        raise
