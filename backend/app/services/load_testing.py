"""Load testing utilities for performance benchmarks."""
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import asyncio
import time
import statistics
import logging

logger = logging.getLogger(__name__)


@dataclass
class LoadTestResult:
    """Result of a load test run."""
    test_name: str
    started_at: datetime
    completed_at: datetime
    total_requests: int
    successful_requests: int
    failed_requests: int
    response_times: List[float]
    errors: List[str]
    
    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 0
        return self.successful_requests / self.total_requests * 100
    
    @property
    def avg_response_time(self) -> float:
        if not self.response_times:
            return 0
        return statistics.mean(self.response_times)
    
    @property
    def p50_response_time(self) -> float:
        if not self.response_times:
            return 0
        return statistics.median(self.response_times)
    
    @property
    def p95_response_time(self) -> float:
        if len(self.response_times) < 2:
            return self.avg_response_time
        sorted_times = sorted(self.response_times)
        idx = int(len(sorted_times) * 0.95)
        return sorted_times[idx]
    
    @property
    def p99_response_time(self) -> float:
        if len(self.response_times) < 2:
            return self.avg_response_time
        sorted_times = sorted(self.response_times)
        idx = int(len(sorted_times) * 0.99)
        return sorted_times[idx]
    
    @property
    def requests_per_second(self) -> float:
        duration = (self.completed_at - self.started_at).total_seconds()
        if duration == 0:
            return 0
        return self.total_requests / duration
    
    def to_dict(self) -> dict:
        return {
            "test_name": self.test_name,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "duration_seconds": (self.completed_at - self.started_at).total_seconds(),
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "success_rate": round(self.success_rate, 2),
            "requests_per_second": round(self.requests_per_second, 2),
            "response_times": {
                "avg_ms": round(self.avg_response_time * 1000, 2),
                "p50_ms": round(self.p50_response_time * 1000, 2),
                "p95_ms": round(self.p95_response_time * 1000, 2),
                "p99_ms": round(self.p99_response_time * 1000, 2),
            },
            "error_count": len(self.errors),
        }


class LoadTestRunner:
    """Runner for load tests."""
    
    def __init__(self):
        self.results: List[LoadTestResult] = []
    
    async def run_test(
        self,
        name: str,
        target_func: Callable,
        num_requests: int = 100,
        concurrency: int = 10,
        **kwargs,
    ) -> LoadTestResult:
        """Run a load test."""
        started_at = datetime.utcnow()
        response_times: List[float] = []
        errors: List[str] = []
        successful = 0
        failed = 0
        
        semaphore = asyncio.Semaphore(concurrency)
        
        async def make_request():
            nonlocal successful, failed
            async with semaphore:
                start = time.perf_counter()
                try:
                    if asyncio.iscoroutinefunction(target_func):
                        await target_func(**kwargs)
                    else:
                        target_func(**kwargs)
                    
                    elapsed = time.perf_counter() - start
                    response_times.append(elapsed)
                    successful += 1
                except Exception as e:
                    elapsed = time.perf_counter() - start
                    response_times.append(elapsed)
                    errors.append(str(e))
                    failed += 1
        
        tasks = [make_request() for _ in range(num_requests)]
        await asyncio.gather(*tasks)
        
        completed_at = datetime.utcnow()
        
        result = LoadTestResult(
            test_name=name,
            started_at=started_at,
            completed_at=completed_at,
            total_requests=num_requests,
            successful_requests=successful,
            failed_requests=failed,
            response_times=response_times,
            errors=errors[:100],
        )
        
        self.results.append(result)
        logger.info(f"Load test completed: {name} - {result.success_rate:.1f}% success, {result.requests_per_second:.1f} req/s")
        
        return result
    
    async def run_http_test(
        self,
        name: str,
        url: str,
        method: str = "GET",
        num_requests: int = 100,
        concurrency: int = 10,
        headers: Optional[Dict] = None,
        body: Optional[Any] = None,
    ) -> LoadTestResult:
        """Run an HTTP load test."""
        import httpx
        
        async def make_http_request():
            async with httpx.AsyncClient(timeout=30) as client:
                if method.upper() == "GET":
                    await client.get(url, headers=headers)
                elif method.upper() == "POST":
                    await client.post(url, headers=headers, json=body)
                elif method.upper() == "PUT":
                    await client.put(url, headers=headers, json=body)
                elif method.upper() == "DELETE":
                    await client.delete(url, headers=headers)
        
        return await self.run_test(
            name=name,
            target_func=make_http_request,
            num_requests=num_requests,
            concurrency=concurrency,
        )
    
    def get_results(self, limit: int = 20) -> List[dict]:
        """Get load test results."""
        return [r.to_dict() for r in self.results[-limit:]]
    
    def clear_results(self):
        """Clear all results."""
        self.results.clear()


load_test_runner = LoadTestRunner()


async def benchmark_database_queries():
    """Benchmark database query performance."""
    from app.core.database import SessionLocal
    from sqlalchemy import text
    
    async def run_query():
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
    
    return await load_test_runner.run_test(
        "database_query",
        run_query,
        num_requests=100,
        concurrency=10,
    )


async def benchmark_api_health():
    """Benchmark API health endpoint."""
    import os
    api_base = os.getenv("API_BASE_URL", "http://localhost:8000")
    return await load_test_runner.run_http_test(
        "api_health",
        f"{api_base}/health",
        num_requests=100,
        concurrency=10,
    )
