"""Circuit breaker pattern for external service resilience."""
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import functools
import logging

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitStats:
    """Statistics for a circuit breaker."""
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    consecutive_failures: int = 0
    last_failure: Optional[datetime] = None
    last_success: Optional[datetime] = None
    last_state_change: Optional[datetime] = None


@dataclass
class CircuitConfig:
    """Configuration for a circuit breaker."""
    failure_threshold: int = 5
    success_threshold: int = 2
    timeout_seconds: int = 30
    half_open_max_calls: int = 3


class CircuitBreaker:
    """Circuit breaker for a single service."""
    
    def __init__(self, name: str, config: Optional[CircuitConfig] = None):
        self.name = name
        self.config = config or CircuitConfig()
        self.state = CircuitState.CLOSED
        self.stats = CircuitStats()
        self._half_open_calls = 0
        self._half_open_successes = 0
        self._lock = asyncio.Lock()
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute a function through the circuit breaker."""
        async with self._lock:
            if not self._can_execute():
                raise CircuitOpenError(f"Circuit {self.name} is open")
            
            if self.state == CircuitState.HALF_OPEN:
                self._half_open_calls += 1
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            await self._record_success()
            return result
        
        except Exception as e:
            await self._record_failure()
            raise
    
    def _can_execute(self) -> bool:
        """Check if the circuit allows execution."""
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN:
            if self.stats.last_failure:
                elapsed = datetime.utcnow() - self.stats.last_failure
                if elapsed.total_seconds() >= self.config.timeout_seconds:
                    self._transition_to(CircuitState.HALF_OPEN)
                    return True
            return False
        
        if self.state == CircuitState.HALF_OPEN:
            return self._half_open_calls < self.config.half_open_max_calls
        
        return False
    
    async def _record_success(self):
        """Record a successful call."""
        async with self._lock:
            self.stats.total_calls += 1
            self.stats.successful_calls += 1
            self.stats.consecutive_failures = 0
            self.stats.last_success = datetime.utcnow()
            
            if self.state == CircuitState.HALF_OPEN:
                self._half_open_successes += 1
                if self._half_open_successes >= self.config.success_threshold:
                    self._transition_to(CircuitState.CLOSED)
    
    async def _record_failure(self):
        """Record a failed call."""
        async with self._lock:
            self.stats.total_calls += 1
            self.stats.failed_calls += 1
            self.stats.consecutive_failures += 1
            self.stats.last_failure = datetime.utcnow()
            
            if self.state == CircuitState.HALF_OPEN:
                self._transition_to(CircuitState.OPEN)
            elif self.stats.consecutive_failures >= self.config.failure_threshold:
                self._transition_to(CircuitState.OPEN)
    
    def _transition_to(self, new_state: CircuitState):
        """Transition to a new state."""
        old_state = self.state
        self.state = new_state
        self.stats.last_state_change = datetime.utcnow()
        
        if new_state == CircuitState.HALF_OPEN:
            self._half_open_calls = 0
            self._half_open_successes = 0
        
        logger.info(f"Circuit {self.name}: {old_state.value} -> {new_state.value}")
    
    def force_open(self):
        """Force the circuit to open."""
        self._transition_to(CircuitState.OPEN)
    
    def force_close(self):
        """Force the circuit to close."""
        self.stats.consecutive_failures = 0
        self._transition_to(CircuitState.CLOSED)
    
    def get_status(self) -> dict:
        """Get circuit breaker status."""
        return {
            "name": self.name,
            "state": self.state.value,
            "stats": {
                "total_calls": self.stats.total_calls,
                "successful_calls": self.stats.successful_calls,
                "failed_calls": self.stats.failed_calls,
                "consecutive_failures": self.stats.consecutive_failures,
                "last_failure": self.stats.last_failure.isoformat() if self.stats.last_failure else None,
                "last_success": self.stats.last_success.isoformat() if self.stats.last_success else None,
            },
            "config": {
                "failure_threshold": self.config.failure_threshold,
                "success_threshold": self.config.success_threshold,
                "timeout_seconds": self.config.timeout_seconds,
            },
        }


class CircuitOpenError(Exception):
    """Exception raised when circuit is open."""
    pass


class CircuitBreakerRegistry:
    """Registry for managing multiple circuit breakers."""
    
    def __init__(self):
        self._circuits: Dict[str, CircuitBreaker] = {}
    
    def get_or_create(
        self,
        name: str,
        config: Optional[CircuitConfig] = None,
    ) -> CircuitBreaker:
        """Get or create a circuit breaker."""
        if name not in self._circuits:
            self._circuits[name] = CircuitBreaker(name, config)
        return self._circuits[name]
    
    def get(self, name: str) -> Optional[CircuitBreaker]:
        """Get a circuit breaker by name."""
        return self._circuits.get(name)
    
    def get_all_status(self) -> List[dict]:
        """Get status of all circuit breakers."""
        return [cb.get_status() for cb in self._circuits.values()]
    
    def reset_all(self):
        """Reset all circuit breakers."""
        for cb in self._circuits.values():
            cb.force_close()


circuit_registry = CircuitBreakerRegistry()


def with_circuit_breaker(
    name: str,
    config: Optional[CircuitConfig] = None,
):
    """Decorator to wrap a function with circuit breaker."""
    def decorator(func: Callable):
        circuit = circuit_registry.get_or_create(name, config)
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            return await circuit.call(func, *args, **kwargs)
        
        return wrapper
    return decorator
