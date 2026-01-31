"""Request tracing service for debugging and observability with OpenTelemetry support."""
from typing import Dict, Optional, Any, List
from dataclasses import dataclass, field
from datetime import datetime
from contextvars import ContextVar
import uuid
import time
import logging
import os

logger = logging.getLogger(__name__)

# OpenTelemetry configuration
OTEL_ENABLED = os.getenv("OTEL_ENABLED", "false").lower() == "true"
OTEL_EXPORTER_OTLP_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
OTEL_SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "saveit-backend")

_otel_tracer = None

_trace_context: ContextVar[Optional["TraceContext"]] = ContextVar("trace_context", default=None)


@dataclass
class Span:
    """A span representing a unit of work."""
    id: str
    name: str
    parent_id: Optional[str]
    trace_id: str
    start_time: float
    end_time: Optional[float] = None
    status: str = "ok"
    attributes: Dict[str, Any] = field(default_factory=dict)
    events: List[Dict] = field(default_factory=list)
    
    @property
    def duration_ms(self) -> Optional[float]:
        if self.end_time:
            return (self.end_time - self.start_time) * 1000
        return None


@dataclass
class TraceContext:
    """Context for distributed tracing."""
    trace_id: str
    spans: List[Span] = field(default_factory=list)
    current_span: Optional[Span] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    
    def start_span(self, name: str, attributes: Optional[Dict] = None) -> Span:
        """Start a new span."""
        span = Span(
            id=str(uuid.uuid4())[:8],
            name=name,
            parent_id=self.current_span.id if self.current_span else None,
            trace_id=self.trace_id,
            start_time=time.perf_counter(),
            attributes=attributes or {},
        )
        self.spans.append(span)
        self.current_span = span
        return span
    
    def end_span(self, status: str = "ok"):
        """End the current span."""
        if self.current_span:
            self.current_span.end_time = time.perf_counter()
            self.current_span.status = status
            
            parent_id = self.current_span.parent_id
            if parent_id:
                for span in self.spans:
                    if span.id == parent_id:
                        self.current_span = span
                        return
            self.current_span = None
    
    def add_event(self, name: str, attributes: Optional[Dict] = None):
        """Add an event to the current span."""
        if self.current_span:
            self.current_span.events.append({
                "name": name,
                "timestamp": time.perf_counter(),
                "attributes": attributes or {},
            })
    
    def set_attribute(self, key: str, value: Any):
        """Set an attribute on the current span."""
        if self.current_span:
            self.current_span.attributes[key] = value


class TracingService:
    """Service for managing request traces."""
    
    def __init__(self):
        self._traces: Dict[str, TraceContext] = {}
        self._max_traces = 1000
    
    def start_trace(
        self,
        trace_id: Optional[str] = None,
        attributes: Optional[Dict] = None,
    ) -> TraceContext:
        """Start a new trace."""
        trace_id = trace_id or str(uuid.uuid4())
        context = TraceContext(
            trace_id=trace_id,
            attributes=attributes or {},
        )
        
        self._traces[trace_id] = context
        _trace_context.set(context)
        
        if len(self._traces) > self._max_traces:
            oldest = list(self._traces.keys())[0]
            del self._traces[oldest]
        
        return context
    
    def get_current_trace(self) -> Optional[TraceContext]:
        """Get the current trace context."""
        return _trace_context.get()
    
    def get_trace(self, trace_id: str) -> Optional[TraceContext]:
        """Get a trace by ID."""
        return self._traces.get(trace_id)
    
    def end_trace(self):
        """End the current trace."""
        context = _trace_context.get()
        if context:
            while context.current_span:
                context.end_span()
            _trace_context.set(None)
    
    def export_trace(self, trace_id: str) -> Optional[dict]:
        """Export a trace for viewing."""
        context = self._traces.get(trace_id)
        if not context:
            return None
        
        return {
            "trace_id": context.trace_id,
            "attributes": context.attributes,
            "spans": [
                {
                    "id": span.id,
                    "name": span.name,
                    "parent_id": span.parent_id,
                    "duration_ms": span.duration_ms,
                    "status": span.status,
                    "attributes": span.attributes,
                    "events": span.events,
                }
                for span in context.spans
            ],
        }


tracing_service = TracingService()


def get_correlation_id() -> Optional[str]:
    """Get the current correlation/trace ID."""
    context = _trace_context.get()
    return context.trace_id if context else None


def init_opentelemetry() -> bool:
    """Initialize OpenTelemetry tracing."""
    global _otel_tracer

    if not OTEL_ENABLED:
        logger.info("OpenTelemetry tracing disabled")
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME

        # Create resource with service name
        resource = Resource.create({SERVICE_NAME: OTEL_SERVICE_NAME})

        # Create tracer provider
        provider = TracerProvider(resource=resource)

        # Create OTLP exporter (for Jaeger/Tempo)
        exporter = OTLPSpanExporter(endpoint=OTEL_EXPORTER_OTLP_ENDPOINT)

        # Add batch processor for efficient export
        provider.add_span_processor(BatchSpanProcessor(exporter))

        # Set as global tracer provider
        trace.set_tracer_provider(provider)

        # Get tracer
        _otel_tracer = trace.get_tracer(__name__)

        logger.info(f"OpenTelemetry initialized: endpoint={OTEL_EXPORTER_OTLP_ENDPOINT}")
        return True

    except ImportError:
        logger.warning("opentelemetry packages not installed, OTLP export disabled")
        return False
    except Exception as e:
        logger.error(f"Failed to initialize OpenTelemetry: {e}")
        return False


def instrument_fastapi(app):
    """Instrument FastAPI application with OpenTelemetry."""
    if not OTEL_ENABLED:
        return

    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI instrumented with OpenTelemetry")
    except ImportError:
        logger.warning("opentelemetry-instrumentation-fastapi not installed")
    except Exception as e:
        logger.error(f"Failed to instrument FastAPI: {e}")


def instrument_sqlalchemy(engine):
    """Instrument SQLAlchemy with OpenTelemetry."""
    if not OTEL_ENABLED:
        return

    try:
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
        SQLAlchemyInstrumentor().instrument(engine=engine)
        logger.info("SQLAlchemy instrumented with OpenTelemetry")
    except ImportError:
        logger.warning("opentelemetry-instrumentation-sqlalchemy not installed")
    except Exception as e:
        logger.error(f"Failed to instrument SQLAlchemy: {e}")


def instrument_httpx():
    """Instrument HTTPX client with OpenTelemetry."""
    if not OTEL_ENABLED:
        return

    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        HTTPXClientInstrumentor().instrument()
        logger.info("HTTPX instrumented with OpenTelemetry")
    except ImportError:
        pass
    except Exception as e:
        logger.error(f"Failed to instrument HTTPX: {e}")


def create_span(name: str, attributes: Optional[Dict[str, Any]] = None):
    """Create a span for tracing (works with both internal and OTEL)."""
    if _otel_tracer:
        from opentelemetry import trace
        span = _otel_tracer.start_span(name)
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, str(value))
        return span

    # Fallback to internal tracing
    context = _trace_context.get()
    if context:
        return context.start_span(name, attributes)
    return None


# Initialize OpenTelemetry on module import (if enabled)
if OTEL_ENABLED:
    init_opentelemetry()


class TracingMiddleware:
    """Middleware for automatic request tracing."""
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        headers = dict(scope.get("headers", []))
        trace_id = headers.get(b"x-trace-id", b"").decode() or None
        
        context = tracing_service.start_trace(trace_id=trace_id)
        
        path = scope.get("path", "/")
        method = scope.get("method", "GET")
        context.start_span(
            f"{method} {path}",
            attributes={"http.method": method, "http.path": path},
        )
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status = message.get("status", 200)
                context.set_attribute("http.status_code", status)
                
                new_headers = list(message.get("headers", []))
                new_headers.append((b"x-trace-id", context.trace_id.encode()))
                message["headers"] = new_headers
            
            await send(message)
        
        try:
            await self.app(scope, receive, send_wrapper)
            context.end_span("ok")
        except Exception as e:
            context.set_attribute("error", str(e))
            context.end_span("error")
            raise
        finally:
            tracing_service.end_trace()
