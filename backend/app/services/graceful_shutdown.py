"""Graceful shutdown service for clean connection handling."""
from typing import Dict, List, Callable, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import asyncio
import signal
import logging

logger = logging.getLogger(__name__)


class ShutdownState(str, Enum):
    RUNNING = "running"
    SHUTTING_DOWN = "shutting_down"
    STOPPED = "stopped"


@dataclass
class ShutdownHandler:
    """Registered shutdown handler."""
    name: str
    callback: Callable
    priority: int
    timeout_seconds: int = 30


class GracefulShutdownService:
    """Service for managing graceful application shutdown."""
    
    def __init__(self):
        self.state = ShutdownState.RUNNING
        self.handlers: List[ShutdownHandler] = []
        self._shutdown_event = asyncio.Event()
        self._started_at = datetime.utcnow()
        self._shutdown_requested_at = None
    
    def register_handler(
        self,
        name: str,
        callback: Callable,
        priority: int = 100,
        timeout_seconds: int = 30,
    ):
        """Register a shutdown handler."""
        handler = ShutdownHandler(
            name=name,
            callback=callback,
            priority=priority,
            timeout_seconds=timeout_seconds,
        )
        self.handlers.append(handler)
        self.handlers.sort(key=lambda h: h.priority, reverse=True)
        logger.info(f"Registered shutdown handler: {name} (priority={priority})")
    
    def unregister_handler(self, name: str):
        """Unregister a shutdown handler."""
        self.handlers = [h for h in self.handlers if h.name != name]
    
    async def shutdown(self):
        """Execute graceful shutdown."""
        if self.state != ShutdownState.RUNNING:
            return
        
        self.state = ShutdownState.SHUTTING_DOWN
        self._shutdown_requested_at = datetime.utcnow()
        logger.info("Starting graceful shutdown...")
        
        failed_handlers = []
        
        for handler in self.handlers:
            logger.info(f"Executing shutdown handler: {handler.name}")
            try:
                if asyncio.iscoroutinefunction(handler.callback):
                    await asyncio.wait_for(
                        handler.callback(),
                        timeout=handler.timeout_seconds,
                    )
                else:
                    handler.callback()
                logger.info(f"Shutdown handler completed: {handler.name}")
            except asyncio.TimeoutError:
                logger.warning(f"Shutdown handler timed out: {handler.name}")
                failed_handlers.append((handler.name, "timeout"))
            except Exception as e:
                logger.error(f"Shutdown handler error ({handler.name}): {e}")
                failed_handlers.append((handler.name, str(e)))
        
        if failed_handlers:
            logger.warning(f"Shutdown completed with {len(failed_handlers)} handler failures: {failed_handlers}")
        
        self.state = ShutdownState.STOPPED
        self._shutdown_event.set()
        logger.info("Graceful shutdown complete")
    
    async def wait_for_shutdown(self):
        """Wait for shutdown to complete."""
        await self._shutdown_event.wait()
    
    def is_shutting_down(self) -> bool:
        """Check if shutdown is in progress."""
        return self.state in (ShutdownState.SHUTTING_DOWN, ShutdownState.STOPPED)
    
    def get_status(self) -> dict:
        """Get shutdown service status."""
        return {
            "state": self.state.value,
            "started_at": self._started_at.isoformat(),
            "shutdown_requested_at": (
                self._shutdown_requested_at.isoformat()
                if self._shutdown_requested_at else None
            ),
            "uptime_seconds": (
                datetime.utcnow() - self._started_at
            ).total_seconds(),
            "handlers": [
                {"name": h.name, "priority": h.priority}
                for h in self.handlers
            ],
        }


shutdown_service = GracefulShutdownService()


def setup_signal_handlers(loop: Optional[asyncio.AbstractEventLoop] = None):
    """Setup signal handlers for graceful shutdown."""
    loop = loop or asyncio.get_event_loop()
    
    def signal_handler(sig):
        logger.info(f"Received signal {sig}, initiating shutdown...")
        asyncio.create_task(shutdown_service.shutdown())
    
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, lambda s=sig: signal_handler(s))
        except NotImplementedError:
            logger.warning(f"Signal handler for {sig} not supported on this platform")
        except Exception as e:
            logger.error(f"Failed to setup signal handler for {sig}: {e}")
