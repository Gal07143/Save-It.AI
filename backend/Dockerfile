# SAVE-IT.AI Backend Dockerfile
# Multi-stage build for minimal production image

# =============================================================================
# Stage 1: Builder - Install dependencies and build wheels
# =============================================================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install pip and wheel
RUN pip install --no-cache-dir --upgrade pip wheel

# Copy dependency files
COPY pyproject.toml ./
COPY requirements.txt* ./

# Create requirements.txt from pyproject.toml if it doesn't exist
RUN if [ ! -f requirements.txt ]; then \
    pip install --no-cache-dir toml && \
    python -c "import toml; deps = toml.load('pyproject.toml')['project']['dependencies']; print('\n'.join(deps))" > requirements.txt; \
    fi

# Install dependencies into a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# =============================================================================
# Stage 2: Production - Minimal runtime image
# =============================================================================
FROM python:3.11-slim AS production

# Create non-root user for security
RUN groupadd -r saveit && useradd -r -g saveit saveit

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY --chown=saveit:saveit . .

# Remove unnecessary files
RUN rm -rf tests/ .pytest_cache/ .git/ __pycache__/ *.pyc *.pyo

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

# Switch to non-root user
USER saveit

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health/live || exit 1

# Run with uvicorn
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
