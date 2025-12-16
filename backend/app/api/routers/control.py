"""Control Rules and Commands API endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models import ControlRule, ControlCommand
from backend.app.schemas import ControlRuleCreate, ControlRuleResponse, ControlCommandResponse

router = APIRouter(prefix="/api/v1", tags=["control"])


@router.get("/control-rules", response_model=List[ControlRuleResponse])
def list_control_rules(site_id: Optional[int] = None, db: Session = Depends(get_db)):
    """List automation control rules."""
    query = db.query(ControlRule)
    if site_id:
        query = query.filter(ControlRule.site_id == site_id)
    return query.all()


@router.post("/control-rules", response_model=ControlRuleResponse)
def create_control_rule(rule: ControlRuleCreate, db: Session = Depends(get_db)):
    """Create a new control rule."""
    db_rule = ControlRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/control-commands", response_model=List[ControlCommandResponse])
def list_control_commands(
    asset_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List control commands."""
    query = db.query(ControlCommand)
    if asset_id:
        query = query.filter(ControlCommand.asset_id == asset_id)
    if status:
        query = query.filter(ControlCommand.status == status)
    return query.order_by(ControlCommand.created_at.desc()).all()
