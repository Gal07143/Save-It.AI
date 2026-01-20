"""Service discovery for dynamic endpoint resolution."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import logging

logger = logging.getLogger(__name__)


class ServiceStatus(str, Enum):
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class ServiceInstance:
    """Represents a service instance."""
    id: str
    name: str
    host: str
    port: int
    protocol: str = "http"
    status: ServiceStatus = ServiceStatus.UNKNOWN
    metadata: Dict[str, Any] = field(default_factory=dict)
    registered_at: datetime = field(default_factory=datetime.utcnow)
    last_health_check: Optional[datetime] = None
    weight: int = 100


@dataclass
class ServiceDefinition:
    """Represents a service definition."""
    name: str
    instances: List[ServiceInstance] = field(default_factory=list)
    health_check_path: str = "/health"
    health_check_interval: int = 30
    load_balancing: str = "round_robin"


class ServiceRegistry:
    """Registry for service discovery."""
    
    def __init__(self):
        self.services: Dict[str, ServiceDefinition] = {}
        self._round_robin_counters: Dict[str, int] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    async def start(self):
        """Start background health checking."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._health_check_loop())
        logger.info("Service registry started")
    
    async def stop(self):
        """Stop background health checking."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    def register_service(
        self,
        name: str,
        health_check_path: str = "/health",
        load_balancing: str = "round_robin",
    ):
        """Register a new service type."""
        if name not in self.services:
            self.services[name] = ServiceDefinition(
                name=name,
                health_check_path=health_check_path,
                load_balancing=load_balancing,
            )
            self._round_robin_counters[name] = 0
            logger.info(f"Registered service: {name}")
    
    def register_instance(
        self,
        service_name: str,
        instance_id: str,
        host: str,
        port: int,
        protocol: str = "http",
        metadata: Optional[Dict] = None,
        weight: int = 100,
    ) -> ServiceInstance:
        """Register a service instance."""
        if service_name not in self.services:
            self.register_service(service_name)
        
        instance = ServiceInstance(
            id=instance_id,
            name=service_name,
            host=host,
            port=port,
            protocol=protocol,
            metadata=metadata or {},
            weight=weight,
        )
        
        service = self.services[service_name]
        service.instances = [
            i for i in service.instances if i.id != instance_id
        ]
        service.instances.append(instance)
        
        logger.info(f"Registered instance {instance_id} for service {service_name}")
        return instance
    
    def deregister_instance(self, service_name: str, instance_id: str):
        """Deregister a service instance."""
        if service_name in self.services:
            service = self.services[service_name]
            service.instances = [
                i for i in service.instances if i.id != instance_id
            ]
            logger.info(f"Deregistered instance {instance_id}")
    
    def get_instance(self, service_name: str) -> Optional[ServiceInstance]:
        """Get a healthy service instance using load balancing."""
        if service_name not in self.services:
            return None
        
        service = self.services[service_name]
        healthy_instances = [
            i for i in service.instances if i.status == ServiceStatus.HEALTHY
        ]
        
        if not healthy_instances:
            healthy_instances = [
                i for i in service.instances if i.status != ServiceStatus.UNHEALTHY
            ]
        
        if not healthy_instances:
            return None
        
        if service.load_balancing == "round_robin":
            idx = self._round_robin_counters[service_name] % len(healthy_instances)
            self._round_robin_counters[service_name] += 1
            return healthy_instances[idx]
        
        elif service.load_balancing == "random":
            import random
            return random.choice(healthy_instances)
        
        elif service.load_balancing == "weighted":
            import random
            total_weight = sum(i.weight for i in healthy_instances)
            r = random.randint(0, total_weight - 1)
            for instance in healthy_instances:
                r -= instance.weight
                if r < 0:
                    return instance
            return healthy_instances[0]
        
        return healthy_instances[0]
    
    def get_all_instances(self, service_name: str) -> List[ServiceInstance]:
        """Get all instances for a service."""
        if service_name not in self.services:
            return []
        return self.services[service_name].instances
    
    def get_url(self, service_name: str, path: str = "") -> Optional[str]:
        """Get a URL for a service."""
        instance = self.get_instance(service_name)
        if not instance:
            return None
        
        return f"{instance.protocol}://{instance.host}:{instance.port}{path}"
    
    async def _health_check_loop(self):
        """Background loop for health checking."""
        while self._running:
            try:
                for service in self.services.values():
                    for instance in service.instances:
                        await self._check_instance_health(instance, service.health_check_path)
                
                await asyncio.sleep(30)
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(10)
    
    async def _check_instance_health(self, instance: ServiceInstance, health_path: str):
        """Check health of a service instance."""
        import httpx
        
        url = f"{instance.protocol}://{instance.host}:{instance.port}{health_path}"
        
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(url)
                
            if 200 <= response.status_code < 300:
                instance.status = ServiceStatus.HEALTHY
            else:
                instance.status = ServiceStatus.UNHEALTHY
        
        except Exception:
            instance.status = ServiceStatus.UNHEALTHY
        
        instance.last_health_check = datetime.utcnow()
    
    def get_stats(self) -> dict:
        """Get service registry statistics."""
        return {
            "services": len(self.services),
            "total_instances": sum(
                len(s.instances) for s in self.services.values()
            ),
            "healthy_instances": sum(
                sum(1 for i in s.instances if i.status == ServiceStatus.HEALTHY)
                for s in self.services.values()
            ),
            "service_details": {
                name: {
                    "instances": len(s.instances),
                    "healthy": sum(1 for i in s.instances if i.status == ServiceStatus.HEALTHY),
                }
                for name, s in self.services.items()
            },
        }


service_registry = ServiceRegistry()


def register_local_services():
    """Register local services using environment configuration."""
    import os
    
    api_host = os.getenv("API_HOST", "0.0.0.0")
    api_port = int(os.getenv("API_PORT", "8000"))
    frontend_host = os.getenv("FRONTEND_HOST", "0.0.0.0")
    frontend_port = int(os.getenv("FRONTEND_PORT", "5000"))
    app_version = os.getenv("APP_VERSION", "1.0.0")
    
    service_registry.register_instance(
        "saveit-api",
        "api-1",
        api_host,
        api_port,
        metadata={"version": app_version},
    )
    
    service_registry.register_instance(
        "saveit-frontend",
        "frontend-1",
        frontend_host,
        frontend_port,
        metadata={"version": app_version},
    )
