"""Background job queue for async task processing."""
import asyncio
import logging
import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("saveit.jobs")


class JobStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobPriority(Enum):
    LOW = 0
    NORMAL = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class Job:
    id: str
    name: str
    func: Callable
    args: tuple = field(default_factory=tuple)
    kwargs: Dict[str, Any] = field(default_factory=dict)
    priority: JobPriority = JobPriority.NORMAL
    status: JobStatus = JobStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retries: int = 0
    max_retries: int = 3


class JobQueue:
    """
    Job queue with in-memory processing and optional database persistence.
    
    Supports database fallback for job persistence across restarts.
    For high-volume production, consider Celery + Redis/RabbitMQ.
    """
    
    def __init__(self, max_workers: int = 4, persist_to_db: bool = True):
        self._jobs: Dict[str, Job] = {}
        self._queue: asyncio.Queue = None
        self._workers: List[asyncio.Task] = []
        self._max_workers = max_workers
        self._running = False
        self._handlers: Dict[str, Callable] = {}
        self._persist_to_db = persist_to_db
        self._db_session_factory = None
    
    def set_db_session_factory(self, factory):
        """Set database session factory for persistence."""
        self._db_session_factory = factory
    
    def _persist_job(self, job: Job):
        """Persist job state to database."""
        if not self._persist_to_db or not self._db_session_factory:
            return
        
        try:
            from sqlalchemy import text
            db = self._db_session_factory()
            try:
                db.execute(
                    text("""
                        INSERT INTO background_jobs (id, name, status, priority, created_at, started_at, completed_at, retries, error, result_json)
                        VALUES (:id, :name, :status, :priority, :created_at, :started_at, :completed_at, :retries, :error, :result)
                        ON CONFLICT (id) DO UPDATE SET
                            status = :status,
                            started_at = :started_at,
                            completed_at = :completed_at,
                            retries = :retries,
                            error = :error,
                            result_json = :result
                    """),
                    {
                        "id": job.id,
                        "name": job.name,
                        "status": job.status.value,
                        "priority": job.priority.value,
                        "created_at": job.created_at,
                        "started_at": job.started_at,
                        "completed_at": job.completed_at,
                        "retries": job.retries,
                        "error": job.error,
                        "result": str(job.result) if job.result else None,
                    }
                )
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to persist job {job.id}: {e}")
    
    async def start(self):
        if self._running:
            return
        
        self._running = True
        self._queue = asyncio.Queue()
        
        for i in range(self._max_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self._workers.append(worker)
        
        logger.info(f"Job queue started with {self._max_workers} workers")
    
    async def stop(self):
        self._running = False
        
        for worker in self._workers:
            worker.cancel()
        
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()
        logger.info("Job queue stopped")
    
    async def _worker(self, name: str):
        logger.info(f"Worker {name} started")
        while self._running:
            try:
                job = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                await self._process_job(job)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker {name} error: {e}")
    
    async def _process_job(self, job: Job):
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        logger.info(f"Processing job {job.id}: {job.name}")
        
        try:
            if asyncio.iscoroutinefunction(job.func):
                result = await job.func(*job.args, **job.kwargs)
            else:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, lambda: job.func(*job.args, **job.kwargs)
                )
            
            job.status = JobStatus.COMPLETED
            job.result = result
            job.completed_at = datetime.utcnow()
            logger.info(f"Job {job.id} completed successfully")
            self._persist_job(job)
            
        except Exception as e:
            job.error = str(e)
            job.retries += 1
            
            if job.retries < job.max_retries:
                job.status = JobStatus.PENDING
                await self._queue.put(job)
                logger.warning(f"Job {job.id} failed, retrying ({job.retries}/{job.max_retries})")
            else:
                job.status = JobStatus.FAILED
                job.completed_at = datetime.utcnow()
                logger.error(f"Job {job.id} failed permanently: {e}")
            self._persist_job(job)
    
    def enqueue(
        self,
        func: Callable,
        args: tuple = (),
        kwargs: dict = None,
        name: str = None,
        priority: JobPriority = JobPriority.NORMAL,
        max_retries: int = 3,
    ) -> str:
        job_id = str(uuid.uuid4())
        job = Job(
            id=job_id,
            name=name or func.__name__,
            func=func,
            args=args,
            kwargs=kwargs or {},
            priority=priority,
            max_retries=max_retries,
        )
        
        self._jobs[job_id] = job
        self._persist_job(job)
        
        if self._queue:
            asyncio.create_task(self._queue.put(job))
        
        return job_id
    
    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)
    
    def get_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        job = self._jobs.get(job_id)
        if not job:
            return None
        
        return {
            "id": job.id,
            "name": job.name,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "retries": job.retries,
            "error": job.error,
        }
    
    def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if not job or job.status != JobStatus.PENDING:
            return False
        
        job.status = JobStatus.CANCELLED
        return True
    
    def stats(self) -> Dict[str, Any]:
        status_counts = {}
        for status in JobStatus:
            status_counts[status.value] = sum(
                1 for j in self._jobs.values() if j.status == status
            )
        
        return {
            "total_jobs": len(self._jobs),
            "queue_size": self._queue.qsize() if self._queue else 0,
            "workers": len(self._workers),
            "status_counts": status_counts,
        }
    
    def register_handler(self, name: str, handler: Callable):
        self._handlers[name] = handler
    
    def dispatch(self, name: str, *args, **kwargs) -> str:
        handler = self._handlers.get(name)
        if not handler:
            raise ValueError(f"No handler registered for '{name}'")
        return self.enqueue(handler, args, kwargs, name=name)


job_queue = JobQueue()


def background_task(name: str = None, priority: JobPriority = JobPriority.NORMAL):
    """
    Decorator to run a function as a background job.
    
    Usage:
        @background_task(name="send_email")
        def send_email(to: str, subject: str):
            ...
    """
    def decorator(func):
        job_queue.register_handler(name or func.__name__, func)
        
        def wrapper(*args, **kwargs):
            return job_queue.enqueue(func, args, kwargs, name=name, priority=priority)
        
        wrapper.delay = wrapper
        wrapper.apply_async = lambda args=(), kwargs=None: job_queue.enqueue(
            func, args, kwargs or {}, name=name, priority=priority
        )
        
        return wrapper
    return decorator
