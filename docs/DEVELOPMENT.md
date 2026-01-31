# Development Guide

This guide covers setting up a local development environment for Save-It.AI.

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for rate limiting)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/save-it-ai.git
cd save-it-ai
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e ./backend[dev]

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL=postgresql://user:password@localhost:5432/saveit

# Run database migrations
cd backend
alembic upgrade head

# Start the backend server
uvicorn backend.app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Access the Application

- Frontend: http://localhost:5000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/saveit` |
| `SESSION_SECRET` | JWT signing key (32+ chars) | Generated with `python -c "import secrets; print(secrets.token_urlsafe(32))"` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable debug mode | `false` |
| `REDIS_URL` | Redis connection for rate limiting | - |
| `OPENAI_API_KEY` | OpenAI API key for AI features | - |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:5000` |

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py

# Run tests matching pattern
pytest -k "test_login"
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Code Style

### Python

- Follow PEP 8 style guide
- Use type hints for function signatures
- Maximum line length: 100 characters
- Use `black` for formatting: `black app/`
- Use `isort` for import sorting: `isort app/`

### TypeScript

- Use TypeScript strict mode
- Define explicit types (avoid `any`)
- Use functional components with hooks
- Follow the project's ESLint configuration

## Database Migrations

### Creating a New Migration

```bash
cd backend

# Auto-generate migration from model changes
alembic revision --autogenerate -m "Description of changes"

# Create empty migration for manual edits
alembic revision -m "Manual migration"
```

### Running Migrations

```bash
# Apply all pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# Rollback to specific revision
alembic downgrade abc123
```

## Project Structure

```
save-it-ai/
├── backend/
│   ├── app/
│   │   ├── api/routers/      # API endpoint handlers
│   │   ├── core/             # Core config, database
│   │   ├── middleware/       # Request middleware
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   └── main.py           # FastAPI app entry
│   ├── alembic/              # Database migrations
│   └── tests/                # Backend tests
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   ├── pages/            # Page components
│   │   ├── services/         # API client
│   │   └── types/            # TypeScript types
│   └── __tests__/            # Frontend tests
├── k8s/                      # Kubernetes manifests
├── nginx/                    # nginx configuration
└── docs/                     # Documentation
```

## Common Tasks

### Adding a New API Endpoint

1. Create/update Pydantic schema in `backend/app/schemas/`
2. Create/update SQLAlchemy model in `backend/app/models/`
3. Create router in `backend/app/api/routers/`
4. Register router in `backend/app/api/routers/__init__.py`
5. Add tests in `backend/tests/`

### Adding a New Frontend Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Add API types in `frontend/src/types/api.ts`
4. Add API methods in `frontend/src/services/api.ts`
5. Add tests in `frontend/src/__tests__/`

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U your_user -d saveit
```

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### Clear Python Cache

```bash
find . -type d -name __pycache__ -exec rm -rf {} +
find . -type f -name "*.pyc" -delete
```
