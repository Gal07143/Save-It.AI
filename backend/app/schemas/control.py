"""Control System Pydantic schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class ControlRuleType(str, Enum):
    """Types of control rules."""
    DEMAND_RESPONSE = "demand_response"
    PEAK_SHAVING = "peak_shaving"
    LOAD_SHIFTING = "load_shifting"
    SCHEDULE = "schedule"
    THRESHOLD = "threshold"


class SafetyGateStatus(str, Enum):
    """Status of safety gates."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    BYPASSED = "bypassed"


class ControlRuleCreate(BaseModel):
    """Schema for creating a control rule."""
    site_id: int
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    rule_type: ControlRuleType
    trigger_condition: str
    action_type: str
    action_params: Optional[str] = None
    target_asset_id: Optional[int] = None
    requires_approval: bool = True
    requires_mfa: bool = False


class ControlRuleResponse(BaseModel):
    """Response schema for control rules."""
    id: int
    site_id: int
    name: str
    description: Optional[str] = None
    rule_type: ControlRuleType
    trigger_condition: str
    action_type: str
    requires_approval: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ControlCommandCreate(BaseModel):
    """Schema for creating a control command."""
    rule_id: Optional[int] = None
    asset_id: int
    command_type: str
    command_params: Optional[str] = None
    expires_at: Optional[datetime] = None


class ControlCommandResponse(BaseModel):
    """Response schema for control commands."""
    id: int
    rule_id: Optional[int] = None
    asset_id: int
    command_type: str
    status: str
    safety_gate_status: SafetyGateStatus
    executed_at: Optional[datetime] = None
    result: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SafetyGateCreate(BaseModel):
    """Schema for creating a safety gate."""
    control_rule_id: int
    name: str = Field(..., min_length=1, max_length=255)
    gate_type: str
    precondition: Optional[str] = None
    timeout_seconds: int = 300
    requires_2fa: bool = False
    whitelist_commands: Optional[str] = None


class SafetyGateResponse(BaseModel):
    """Response schema for safety gates."""
    id: int
    control_rule_id: int
    name: str
    gate_type: str
    precondition: Optional[str] = None
    timeout_seconds: int
    requires_2fa: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
