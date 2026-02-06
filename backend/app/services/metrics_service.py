"""Metrics collection service for monitoring and observability."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict
import time
import logging

logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


@dataclass
class Metric:
    """Represents a metric measurement."""
    name: str
    type: MetricType
    value: float
    labels: Dict[str, str] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    help_text: str = ""


class Counter:
    """A counter metric that only increases."""
    
    def __init__(self, name: str, help_text: str = ""):
        self.name = name
        self.help_text = help_text
        self._values: Dict[tuple, float] = defaultdict(float)
    
    def inc(self, amount: float = 1, labels: Optional[Dict[str, str]] = None):
        """Increment the counter."""
        key = tuple(sorted((labels or {}).items()))
        self._values[key] += amount
    
    def get(self, labels: Optional[Dict[str, str]] = None) -> float:
        """Get the current value."""
        key = tuple(sorted((labels or {}).items()))
        return self._values[key]
    
    def collect(self) -> List[Metric]:
        """Collect all metrics."""
        return [
            Metric(
                name=self.name,
                type=MetricType.COUNTER,
                value=value,
                labels=dict(key),
                help_text=self.help_text,
            )
            for key, value in self._values.items()
        ]


class Gauge:
    """A gauge metric that can increase or decrease."""
    
    def __init__(self, name: str, help_text: str = ""):
        self.name = name
        self.help_text = help_text
        self._values: Dict[tuple, float] = defaultdict(float)
    
    def set(self, value: float, labels: Optional[Dict[str, str]] = None):
        """Set the gauge value."""
        key = tuple(sorted((labels or {}).items()))
        self._values[key] = value
    
    def inc(self, amount: float = 1, labels: Optional[Dict[str, str]] = None):
        """Increment the gauge."""
        key = tuple(sorted((labels or {}).items()))
        self._values[key] += amount
    
    def dec(self, amount: float = 1, labels: Optional[Dict[str, str]] = None):
        """Decrement the gauge."""
        key = tuple(sorted((labels or {}).items()))
        self._values[key] -= amount
    
    def get(self, labels: Optional[Dict[str, str]] = None) -> float:
        """Get the current value."""
        key = tuple(sorted((labels or {}).items()))
        return self._values[key]
    
    def collect(self) -> List[Metric]:
        """Collect all metrics."""
        return [
            Metric(
                name=self.name,
                type=MetricType.GAUGE,
                value=value,
                labels=dict(key),
                help_text=self.help_text,
            )
            for key, value in self._values.items()
        ]


class Histogram:
    """A histogram metric for measuring distributions."""
    
    DEFAULT_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10)
    
    def __init__(self, name: str, help_text: str = "", buckets: tuple = None):
        self.name = name
        self.help_text = help_text
        self.buckets = buckets or self.DEFAULT_BUCKETS
        self._sums: Dict[tuple, float] = defaultdict(float)
        self._counts: Dict[tuple, int] = defaultdict(int)
        self._bucket_counts: Dict[tuple, Dict[float, int]] = defaultdict(
            lambda: defaultdict(int)
        )
    
    def observe(self, value: float, labels: Optional[Dict[str, str]] = None):
        """Record an observation."""
        key = tuple(sorted((labels or {}).items()))
        self._sums[key] += value
        self._counts[key] += 1
        for bucket in self.buckets:
            if value <= bucket:
                self._bucket_counts[key][bucket] += 1
    
    def time(self, labels: Optional[Dict[str, str]] = None):
        """Context manager to measure execution time."""
        return _Timer(self, labels)
    
    def collect(self) -> List[Metric]:
        """Collect all metrics."""
        metrics = []
        for key, total in self._sums.items():
            labels = dict(key)
            metrics.append(Metric(
                name=f"{self.name}_sum",
                type=MetricType.HISTOGRAM,
                value=total,
                labels=labels,
                help_text=self.help_text,
            ))
            metrics.append(Metric(
                name=f"{self.name}_count",
                type=MetricType.HISTOGRAM,
                value=self._counts[key],
                labels=labels,
            ))
            for bucket, count in self._bucket_counts[key].items():
                metrics.append(Metric(
                    name=f"{self.name}_bucket",
                    type=MetricType.HISTOGRAM,
                    value=count,
                    labels={**labels, "le": str(bucket)},
                ))
        return metrics


class _Timer:
    """Context manager for timing operations."""
    
    def __init__(self, histogram: Histogram, labels: Optional[Dict[str, str]]):
        self.histogram = histogram
        self.labels = labels
        self.start = None
    
    def __enter__(self):
        self.start = time.perf_counter()
        return self
    
    def __exit__(self, *args):
        duration = time.perf_counter() - self.start
        self.histogram.observe(duration, self.labels)


class MetricsRegistry:
    """Registry for all application metrics."""
    
    def __init__(self):
        self.metrics: Dict[str, Any] = {}
    
    def counter(self, name: str, help_text: str = "") -> Counter:
        """Create or get a counter metric."""
        if name not in self.metrics:
            self.metrics[name] = Counter(name, help_text)
        return self.metrics[name]
    
    def gauge(self, name: str, help_text: str = "") -> Gauge:
        """Create or get a gauge metric."""
        if name not in self.metrics:
            self.metrics[name] = Gauge(name, help_text)
        return self.metrics[name]
    
    def histogram(self, name: str, help_text: str = "", buckets: tuple = None) -> Histogram:
        """Create or get a histogram metric."""
        if name not in self.metrics:
            self.metrics[name] = Histogram(name, help_text, buckets)
        return self.metrics[name]
    
    def collect_all(self) -> List[Metric]:
        """Collect all registered metrics."""
        all_metrics = []
        for metric in self.metrics.values():
            all_metrics.extend(metric.collect())
        return all_metrics
    
    def to_prometheus(self) -> str:
        """Export metrics in Prometheus exposition format."""
        lines = []
        seen_metrics = set()

        for metric in self.collect_all():
            # Add HELP and TYPE lines for each metric family (once)
            base_name = metric.name.rsplit("_", 1)[0] if metric.name.endswith(("_sum", "_count", "_bucket")) else metric.name
            if base_name not in seen_metrics:
                if metric.help_text:
                    lines.append(f"# HELP {base_name} {metric.help_text}")
                lines.append(f"# TYPE {base_name} {metric.type.value}")
                seen_metrics.add(base_name)

            # Format labels
            label_str = ",".join(f'{k}="{v}"' for k, v in sorted(metric.labels.items()))
            if label_str:
                lines.append(f"{metric.name}{{{label_str}}} {metric.value}")
            else:
                lines.append(f"{metric.name} {metric.value}")

        return "\n".join(lines) + "\n"

    def get_metric_value(self, name: str, labels: Optional[Dict[str, str]] = None) -> Optional[float]:
        """Get a specific metric value."""
        if name in self.metrics:
            return self.metrics[name].get(labels)
        return None


metrics_registry = MetricsRegistry()

http_requests_total = metrics_registry.counter(
    "http_requests_total",
    "Total HTTP requests"
)

http_request_duration = metrics_registry.histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds"
)

active_connections = metrics_registry.gauge(
    "active_connections",
    "Number of active connections"
)

meter_readings_processed = metrics_registry.counter(
    "meter_readings_processed_total",
    "Total meter readings processed"
)

device_polls_total = metrics_registry.counter(
    "device_polls_total",
    "Total device poll attempts"
)

database_queries = metrics_registry.histogram(
    "database_query_duration_seconds",
    "Database query duration in seconds"
)

background_jobs = metrics_registry.gauge(
    "background_jobs_active",
    "Number of active background jobs"
)

websocket_connections = metrics_registry.gauge(
    "websocket_connections",
    "Number of active WebSocket connections"
)

# Additional production metrics
active_sites = metrics_registry.gauge(
    "saveit_active_sites",
    "Number of active sites"
)

data_points_ingested = metrics_registry.counter(
    "saveit_data_points_ingested_total",
    "Total data points ingested"
)

database_connections = metrics_registry.gauge(
    "saveit_database_connections",
    "Number of active database connections"
)

cache_hits = metrics_registry.counter(
    "saveit_cache_hits_total",
    "Total cache hits"
)

cache_misses = metrics_registry.counter(
    "saveit_cache_misses_total",
    "Total cache misses"
)

rate_limit_exceeded = metrics_registry.counter(
    "saveit_rate_limit_exceeded_total",
    "Total rate limit exceeded events"
)

mqtt_messages_received = metrics_registry.counter(
    "saveit_mqtt_messages_received_total",
    "Total MQTT messages received"
)

mqtt_messages_published = metrics_registry.counter(
    "saveit_mqtt_messages_published_total",
    "Total MQTT messages published"
)

api_errors = metrics_registry.counter(
    "saveit_api_errors_total",
    "Total API errors by type"
)

forecast_jobs_completed = metrics_registry.counter(
    "saveit_forecast_jobs_completed_total",
    "Total forecast jobs completed"
)

bill_validations = metrics_registry.counter(
    "saveit_bill_validations_total",
    "Total bill validations performed"
)


def update_database_pool_metrics():
    """Update database connection pool metrics."""
    try:
        from app.core.database import get_pool_status
        pool_status = get_pool_status()
        database_connections.set(pool_status.get("checked_out", 0), {"state": "active"})
        database_connections.set(pool_status.get("checked_in", 0), {"state": "idle"})
        database_connections.set(pool_status.get("overflow", 0), {"state": "overflow"})
    except Exception:
        pass


def update_site_metrics(db_session):
    """Update site-related metrics from database."""
    try:
        from app.models import Site
        from sqlalchemy import func
        count = db_session.query(func.count(Site.id)).filter(Site.is_active == 1).scalar()
        active_sites.set(count or 0)
    except Exception:
        pass
