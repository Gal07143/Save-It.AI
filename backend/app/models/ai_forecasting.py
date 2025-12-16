"""AI Agents & Forecasting models: AgentSession, AgentMessage, Recommendation, ForecastJob, ForecastSeries."""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class AgentType(PyEnum):
    """Types of AI agents."""
    ENERGY_ANALYST = "energy_analyst"
    DETECTIVE = "detective"
    RECOMMENDER = "recommender"
    FORECASTER = "forecaster"


class AgentSession(Base):
    """AI agent conversation sessions."""
    __tablename__ = "agent_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    agent_type = Column(Enum(AgentType), nullable=False)
    context_json = Column(Text, nullable=True)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentMessage(Base):
    """Messages in AI agent conversations."""
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("agent_sessions.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    evidence_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Recommendation(Base):
    """AI-generated recommendations pending approval."""
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    agent_type = Column(Enum(AgentType), nullable=False)
    category = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    expected_savings = Column(Float, nullable=True)
    confidence_score = Column(Float, nullable=True)
    priority = Column(String(20), default="medium")
    status = Column(String(50), default="pending")
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_reason = Column(Text, nullable=True)
    evidence_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ForecastJob(Base):
    """Forecasting jobs for load/PV predictions."""
    __tablename__ = "forecast_jobs"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id"), nullable=True, index=True)
    forecast_type = Column(String(50), nullable=False)
    horizon_hours = Column(Integer, default=24)
    model_name = Column(String(100), nullable=True)
    status = Column(String(50), default="pending")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ForecastSeries(Base):
    """Forecast data points."""
    __tablename__ = "forecast_series"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("forecast_jobs.id"), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    predicted_value = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
