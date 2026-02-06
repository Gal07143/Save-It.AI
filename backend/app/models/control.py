"""Active Control models: ControlRule, SafetyGate, ControlCommand."""
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Enum, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class ControlRuleType(PyEnum):
    """Types of automation control rules."""
    SCHEDULE = "schedule"
    THRESHOLD = "threshold"
    EVENT = "event"
    DEMAND_RESPONSE = "demand_response"


class SafetyGateStatus(PyEnum):
    """Status of safety gate checks."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class ControlRule(Base):
    """Automation rules for active control."""
    __tablename__ = "control_rules"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    rule_type = Column(Enum(ControlRuleType), nullable=False)
    trigger_condition = Column(Text, nullable=False)
    action_type = Column(String(100), nullable=False)
    action_params = Column(Text, nullable=True)
    target_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    requires_approval = Column(Integer, default=1)
    requires_mfa = Column(Integer, default=0)
    is_active = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SafetyGate(Base):
    """Safety gate for control action approval."""
    __tablename__ = "safety_gates"

    id = Column(Integer, primary_key=True, index=True)
    control_rule_id = Column(Integer, ForeignKey("control_rules.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    gate_type = Column(String(50), nullable=False)
    precondition = Column(Text, nullable=True)
    timeout_seconds = Column(Integer, default=300)
    requires_2fa = Column(Integer, default=0)
    whitelist_commands = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ControlCommand(Base):
    """Control commands sent to devices."""
    __tablename__ = "control_commands"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("control_rules.id"), nullable=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    command_type = Column(String(100), nullable=False)
    command_params = Column(Text, nullable=True)
    status = Column(String(50), default="pending")
    safety_gate_status = Column(Enum(SafetyGateStatus), default=SafetyGateStatus.PENDING)
    executed_at = Column(DateTime, nullable=True)
    result = Column(Text, nullable=True)
    rollback_command = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
