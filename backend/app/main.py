"""
SAVE-IT.AI - FastAPI Main Application

An AI-driven energy management platform that combines financial analysis
with electrical engineering (SLD/Digital Twin) to optimize energy usage
for B2B clients.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.core.database import init_db
from backend.app.api.routers import sites, assets, meters, bills, analysis, notifications


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    init_db()
    yield


app = FastAPI(
    title="SAVE-IT.AI",
    description="AI-driven energy management platform for B2B clients",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sites.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(meters.router, prefix="/api/v1")
app.include_router(bills.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "name": "SAVE-IT.AI",
        "version": "0.1.0",
        "description": "AI-driven energy management platform",
        "docs_url": "/docs",
        "api_prefix": "/api/v1"
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
