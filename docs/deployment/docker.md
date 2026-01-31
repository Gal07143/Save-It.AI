# Docker Deployment Guide

This guide covers deploying Save-It.AI using Docker and Docker Compose.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available

## Quick Start

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-org/save-it-ai.git
cd save-it-ai

# Copy environment file
cp .env.example .env

# Edit .env with secure values
# IMPORTANT: Change SESSION_SECRET to a secure random string
```

### 2. Generate Secure Secrets

```bash
# Generate SESSION_SECRET
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update .env with the generated value
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
docker-compose ps
```

### 4. Access Application

- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Services

| Service | Port | Description |
|---------|------|-------------|
| frontend | 5000 | React application (nginx) |
| backend | 8000 | FastAPI application |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Rate limiting & caching |

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
SESSION_SECRET=your-32-char-minimum-secret-here
DATABASE_URL=postgresql://saveit:saveit_password@postgres:5432/saveit

# Optional
DEBUG=false
REDIS_URL=redis://redis:6379/0
ALLOWED_ORIGINS=http://localhost:5000,https://yourdomain.com

# Optional: AI features
OPENAI_API_KEY=sk-...

# Optional: Email
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
```

### Database Initialization

On first run, the database is automatically initialized. To run migrations manually:

```bash
docker-compose exec backend alembic upgrade head
```

## Production Deployment

### Using nginx Reverse Proxy

For production with TLS, enable the nginx service:

```bash
# Create SSL certificates directory
mkdir -p nginx/ssl

# Copy your certificates
cp fullchain.pem nginx/ssl/
cp privkey.pem nginx/ssl/

# Start with nginx profile
docker-compose --profile production up -d
```

### Resource Limits

Add resource limits for production:

```yaml
# docker-compose.override.yml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Operations

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U saveit saveit > backup.sql

# Compressed backup
docker-compose exec postgres pg_dump -U saveit saveit | gzip > backup.sql.gz
```

### Restore Database

```bash
# Restore from backup
cat backup.sql | docker-compose exec -T postgres psql -U saveit saveit

# From compressed backup
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U saveit saveit
```

### Scaling

```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3
```

Note: When scaling, use a load balancer in front of backend instances.

### Updates

```bash
# Pull latest images
docker-compose pull

# Recreate containers
docker-compose up -d --force-recreate

# Or rebuild from source
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart backend
```

### Database Connection Issues

```bash
# Check if postgres is running
docker-compose exec postgres pg_isready

# Check connection from backend
docker-compose exec backend python -c "from backend.app.core.database import engine; print(engine.connect())"
```

### Reset Everything

```bash
# Stop and remove all containers, volumes
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Start fresh
docker-compose up -d
```

### Health Check

```bash
# Backend health
curl http://localhost:8000/api/v1/health

# Liveness probe
curl http://localhost:8000/api/v1/health/live

# Readiness probe
curl http://localhost:8000/api/v1/health/ready
```

## Security Checklist

- [ ] Changed default database password
- [ ] Generated secure SESSION_SECRET (32+ characters)
- [ ] Configured ALLOWED_ORIGINS for your domain
- [ ] Enabled TLS in production
- [ ] Set DEBUG=false in production
- [ ] Restricted exposed ports (only 80/443 in production)
- [ ] Configured backup strategy
