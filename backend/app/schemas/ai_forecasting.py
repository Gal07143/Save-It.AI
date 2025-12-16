"""AI Agent and Forecasting Pydantic schemas."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from enum import Enum


class AgentType(str, Enum):
    """Types of AI agents."""
    ENERGY_ANALYST = "energy_analyst"
    BILL_VALIDATOR = "bill_validator"
    MAINTENANCE_PREDICTOR = "maintenance_predictor"
    OPTIMIZATION_ENGINE = "optimization_engine"
    SUSTAINABILITY_ADVISOR = "sustainability_advisor"


class AgentChatRequest(BaseModel):
    """Request to chat with an AI agent."""
    message: str
    site_id: Optional[int] = None
    agent_type: AgentType = AgentType.ENERGY_ANALYST
    session_id: Optional[int] = None


class AgentChatResponse(BaseModel):
    """Response from AI agent chat."""
    session_id: int
    response: str
    evidence: Optional[Dict[str, Any]] = None
    recommendations: List[Dict[str, Any]] = []


class RecommendationResponse(BaseModel):
    """Response schema for recommendations."""
    id: int
    site_id: int
    agent_type: AgentType
    category: str
    title: str
    description: str
    expected_savings: Optional[float] = None
    confidence_score: Optional[float] = None
    priority: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForecastRequest(BaseModel):
    """Request for generating a forecast."""
    site_id: int
    meter_id: Optional[int] = None
    forecast_type: str = "load"
    horizon_hours: int = 24


class ForecastPointResponse(BaseModel):
    """Response schema for forecast data point."""
    timestamp: datetime
    predicted_value: float
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    confidence: Optional[float] = None


class ForecastResponse(BaseModel):
    """Response schema for forecast results."""
    job_id: int
    site_id: int
    forecast_type: str
    horizon_hours: int
    status: str
    data: List[ForecastPointResponse] = []


class ForecastJobCreate(BaseModel):
    """Schema for creating a forecast job."""
    site_id: int
    meter_id: Optional[int] = None
    forecast_type: str = "load"
    horizon_hours: int = 24
    model_type: str = "arima"


class ForecastJobResponse(BaseModel):
    """Response schema for forecast job."""
    id: int
    site_id: int
    meter_id: Optional[int] = None
    forecast_type: str
    horizon_hours: int
    model_type: str
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForecastSeriesResponse(BaseModel):
    """Response schema for forecast series data."""
    job_id: int
    forecast_type: str
    data_points: List[ForecastPointResponse] = []
    metrics: Optional[Dict[str, float]] = None
