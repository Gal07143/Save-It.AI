"""AI Agent API endpoints."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import AgentSession, AgentMessage, Recommendation
from app.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    RecommendationResponse,
)

router = APIRouter(prefix="/api/v1", tags=["ai-agents"])


@router.post("/agents/chat", response_model=AgentChatResponse)
def chat_with_agent(request: AgentChatRequest, db: Session = Depends(get_db)):
    """Chat with an AI agent for energy analysis."""
    session = None
    if request.session_id:
        session = db.query(AgentSession).filter(AgentSession.id == request.session_id).first()
    
    if not session:
        session = AgentSession(
            site_id=request.site_id,
            agent_type=request.agent_type
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    
    user_msg = AgentMessage(
        session_id=session.id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    
    response_text = f"I've analyzed your query about '{request.message[:50]}...'. Based on the energy data for this site, I can provide insights on consumption patterns, anomalies, and optimization opportunities. What specific aspect would you like me to focus on?"
    
    agent_msg = AgentMessage(
        session_id=session.id,
        role="assistant",
        content=response_text
    )
    db.add(agent_msg)
    db.commit()
    
    return AgentChatResponse(
        session_id=session.id,
        response=response_text,
        evidence=None,
        recommendations=[]
    )


@router.get("/recommendations", response_model=List[RecommendationResponse])
def list_recommendations(
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List AI-generated recommendations."""
    query = db.query(Recommendation)
    if site_id:
        query = query.filter(Recommendation.site_id == site_id)
    if status:
        query = query.filter(Recommendation.status == status)
    return query.order_by(Recommendation.created_at.desc()).all()


@router.post("/recommendations/{rec_id}/approve", response_model=RecommendationResponse)
def approve_recommendation(rec_id: int, db: Session = Depends(get_db)):
    """Approve an AI recommendation."""
    rec = db.query(Recommendation).filter(Recommendation.id == rec_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    rec.status = "approved"
    rec.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(rec)
    return rec
