"""
Workflow Rules Engine for SAVE-IT.AI
Automation rules engine:
- Trigger-based execution
- Condition evaluation
- Action execution
- Rule chaining
"""
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum

from backend.app.core.database import Base

logger = logging.getLogger(__name__)


class TriggerType(Enum):
    """Types of workflow triggers."""
    TELEMETRY_RECEIVED = "telemetry_received"
    ALARM_TRIGGERED = "alarm_triggered"
    ALARM_CLEARED = "alarm_cleared"
    DEVICE_ONLINE = "device_online"
    DEVICE_OFFLINE = "device_offline"
    SCHEDULE = "schedule"
    MANUAL = "manual"
    THRESHOLD_CROSSED = "threshold_crossed"
    VALUE_CHANGED = "value_changed"


class ActionType(Enum):
    """Types of workflow actions."""
    SEND_NOTIFICATION = "send_notification"
    SEND_COMMAND = "send_command"
    UPDATE_DEVICE = "update_device"
    LOG_EVENT = "log_event"
    CALL_WEBHOOK = "call_webhook"
    RUN_SCRIPT = "run_script"
    CHAIN_RULE = "chain_rule"


# Database Models
class WorkflowRule(Base):
    """Workflow rule definition."""
    __tablename__ = "workflow_rules"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True, index=True)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    trigger_type = Column(String(50), nullable=False)
    trigger_config = Column(Text, nullable=True)  # JSON config for trigger

    conditions = Column(Text, nullable=True)  # JSON array of conditions
    actions = Column(Text, nullable=True)  # JSON array of actions

    priority = Column(Integer, default=0)  # Higher priority executes first
    is_active = Column(Integer, default=1)
    max_executions_per_hour = Column(Integer, default=100)

    last_executed_at = Column(DateTime, nullable=True)
    execution_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkflowExecution(Base):
    """Workflow execution history."""
    __tablename__ = "workflow_executions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("workflow_rules.id", ondelete="CASCADE"), nullable=False, index=True)

    trigger_type = Column(String(50), nullable=False)
    trigger_context = Column(Text, nullable=True)  # JSON

    status = Column(String(20), default="pending")  # pending, running, completed, failed
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    actions_executed = Column(Integer, default=0)
    actions_failed = Column(Integer, default=0)
    execution_log = Column(Text, nullable=True)  # JSON array of action results
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


@dataclass
class ExecutionResult:
    """Result of workflow execution."""
    rule_id: int
    rule_name: str
    success: bool
    actions_executed: int
    actions_failed: int
    duration_ms: int
    error_message: Optional[str] = None
    action_results: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class WorkflowAction:
    """Action to execute in workflow."""
    action_type: str
    config: Dict[str, Any]


class ConditionEvaluator:
    """Evaluates workflow conditions."""

    OPERATORS = {
        "eq": lambda a, b: a == b,
        "neq": lambda a, b: a != b,
        "gt": lambda a, b: a > b,
        "gte": lambda a, b: a >= b,
        "lt": lambda a, b: a < b,
        "lte": lambda a, b: a <= b,
        "contains": lambda a, b: b in str(a),
        "not_contains": lambda a, b: b not in str(a),
        "in": lambda a, b: a in b,
        "not_in": lambda a, b: a not in b,
        "is_null": lambda a, _: a is None,
        "is_not_null": lambda a, _: a is not None,
    }

    def evaluate(self, conditions: List[Dict], context: Dict[str, Any]) -> bool:
        """
        Evaluate list of conditions against context.

        Conditions format:
        [
            {"field": "value", "operator": "gt", "value": 100},
            {"field": "device_type", "operator": "eq", "value": "gateway"}
        ]

        Args:
            conditions: List of condition dicts
            context: Data context to evaluate against

        Returns:
            True if all conditions are met
        """
        if not conditions:
            return True

        for cond in conditions:
            field = cond.get("field")
            operator = cond.get("operator", "eq")
            expected = cond.get("value")

            # Get actual value from context
            actual = self._get_nested_value(context, field)

            # Get operator function
            op_func = self.OPERATORS.get(operator)
            if not op_func:
                logger.warning(f"Unknown operator: {operator}")
                return False

            # Evaluate
            try:
                if not op_func(actual, expected):
                    return False
            except Exception as e:
                logger.warning(f"Condition evaluation error: {e}")
                return False

        return True

    def _get_nested_value(self, obj: Dict, path: str) -> Any:
        """Get value from nested dict using dot notation."""
        parts = path.split(".")
        value = obj

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None

        return value


class WorkflowEngine:
    """
    Automation rules engine.
    Executes workflows based on triggers with condition evaluation.
    """

    def __init__(self, db: Session):
        self.db = db
        self.evaluator = ConditionEvaluator()
        self._action_handlers: Dict[str, Callable] = {}

        # Register default action handlers
        self._register_default_handlers()

    def _register_default_handlers(self):
        """Register default action handlers."""
        self._action_handlers["send_notification"] = self._action_send_notification
        self._action_handlers["log_event"] = self._action_log_event
        self._action_handlers["send_command"] = self._action_send_command
        self._action_handlers["call_webhook"] = self._action_call_webhook
        self._action_handlers["update_device"] = self._action_update_device
        self._action_handlers["chain_rule"] = self._action_chain_rule

    def register_rule(self, rule: WorkflowRule):
        """
        Register a new workflow rule.

        Args:
            rule: WorkflowRule to register
        """
        self.db.add(rule)
        self.db.flush()
        logger.info(f"Registered workflow rule: {rule.name} (ID: {rule.id})")

    def register_action_handler(self, action_type: str, handler: Callable):
        """
        Register custom action handler.

        Args:
            action_type: Action type identifier
            handler: Handler function(config, context) -> result
        """
        self._action_handlers[action_type] = handler

    def evaluate_trigger(
        self,
        trigger_type: str,
        context: Dict[str, Any]
    ) -> List[ExecutionResult]:
        """
        Evaluate rules for a trigger event.

        Args:
            trigger_type: Type of trigger (telemetry_received, alarm_triggered, etc.)
            context: Trigger context data

        Returns:
            List of ExecutionResults
        """
        results = []

        # Get matching rules
        rules = self.db.query(WorkflowRule).filter(
            WorkflowRule.trigger_type == trigger_type,
            WorkflowRule.is_active == 1
        ).order_by(WorkflowRule.priority.desc()).all()

        for rule in rules:
            # Check rate limiting
            if not self._check_rate_limit(rule):
                logger.debug(f"Rule {rule.id} rate limited")
                continue

            # Check trigger config match
            if not self._match_trigger_config(rule, context):
                continue

            # Evaluate conditions
            conditions = json.loads(rule.conditions) if rule.conditions else []
            if not self.evaluator.evaluate(conditions, context):
                continue

            # Execute rule
            result = self.execute_rule(rule, context)
            results.append(result)

        return results

    def execute_rule(
        self,
        rule: WorkflowRule,
        context: Dict[str, Any]
    ) -> ExecutionResult:
        """
        Execute a single workflow rule.

        Args:
            rule: Rule to execute
            context: Execution context

        Returns:
            ExecutionResult
        """
        start_time = datetime.utcnow()
        action_results = []
        actions_executed = 0
        actions_failed = 0
        error_message = None

        # Create execution record
        execution = WorkflowExecution(
            rule_id=rule.id,
            trigger_type=rule.trigger_type,
            trigger_context=json.dumps(context),
            status="running"
        )
        self.db.add(execution)
        self.db.flush()

        try:
            # Parse and execute actions
            actions = json.loads(rule.actions) if rule.actions else []

            for action in actions:
                action_type = action.get("type")
                action_config = action.get("config", {})

                try:
                    result = self._execute_action(action_type, action_config, context)
                    action_results.append({
                        "type": action_type,
                        "success": True,
                        "result": result
                    })
                    actions_executed += 1
                except Exception as e:
                    action_results.append({
                        "type": action_type,
                        "success": False,
                        "error": str(e)
                    })
                    actions_failed += 1
                    logger.error(f"Action {action_type} failed: {e}")

            # Update rule stats
            rule.last_executed_at = datetime.utcnow()
            rule.execution_count = (rule.execution_count or 0) + 1

            # Update execution record
            execution.status = "completed" if actions_failed == 0 else "partial"
            execution.completed_at = datetime.utcnow()
            execution.actions_executed = actions_executed
            execution.actions_failed = actions_failed
            execution.execution_log = json.dumps(action_results)

        except Exception as e:
            error_message = str(e)
            execution.status = "failed"
            execution.error_message = error_message
            execution.completed_at = datetime.utcnow()
            logger.error(f"Rule {rule.id} execution failed: {e}")

        duration = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        return ExecutionResult(
            rule_id=rule.id,
            rule_name=rule.name,
            success=actions_failed == 0 and error_message is None,
            actions_executed=actions_executed,
            actions_failed=actions_failed,
            duration_ms=duration,
            error_message=error_message,
            action_results=action_results
        )

    def execute_actions(
        self,
        actions: List[WorkflowAction],
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Execute list of actions directly.

        Args:
            actions: List of WorkflowAction
            context: Execution context

        Returns:
            List of action results
        """
        results = []

        for action in actions:
            try:
                result = self._execute_action(action.action_type, action.config, context)
                results.append({
                    "type": action.action_type,
                    "success": True,
                    "result": result
                })
            except Exception as e:
                results.append({
                    "type": action.action_type,
                    "success": False,
                    "error": str(e)
                })

        return results

    def _execute_action(
        self,
        action_type: str,
        config: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Any:
        """Execute a single action."""
        handler = self._action_handlers.get(action_type)
        if not handler:
            raise ValueError(f"Unknown action type: {action_type}")

        return handler(config, context)

    def _check_rate_limit(self, rule: WorkflowRule) -> bool:
        """Check if rule is within rate limit."""
        if not rule.max_executions_per_hour:
            return True

        from datetime import timedelta
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)

        recent_executions = self.db.query(WorkflowExecution).filter(
            WorkflowExecution.rule_id == rule.id,
            WorkflowExecution.created_at >= one_hour_ago
        ).count()

        return recent_executions < rule.max_executions_per_hour

    def _match_trigger_config(
        self,
        rule: WorkflowRule,
        context: Dict[str, Any]
    ) -> bool:
        """Check if trigger config matches context."""
        if not rule.trigger_config:
            return True

        try:
            config = json.loads(rule.trigger_config)

            # Match device_id if specified
            if "device_id" in config and config["device_id"] != context.get("device_id"):
                return False

            # Match site_id if specified
            if "site_id" in config and config["site_id"] != context.get("site_id"):
                return False

            # Match datapoint if specified
            if "datapoint" in config and config["datapoint"] != context.get("datapoint"):
                return False

            return True

        except json.JSONDecodeError:
            return True

    # Default action handlers
    def _action_send_notification(self, config: Dict, context: Dict) -> Dict:
        """Send notification action."""
        logger.info(f"Notification: {config.get('message', 'No message')}")
        return {"sent": True, "channel": config.get("channel", "default")}

    def _action_log_event(self, config: Dict, context: Dict) -> Dict:
        """Log event action."""
        event_type = config.get("event_type", "workflow")
        message = config.get("message", "Workflow event")
        logger.info(f"Event logged: {event_type} - {message}")
        return {"logged": True}

    def _action_send_command(self, config: Dict, context: Dict) -> Dict:
        """Send command to device action."""
        device_id = config.get("device_id") or context.get("device_id")
        command = config.get("command")
        logger.info(f"Command sent to device {device_id}: {command}")
        return {"command_sent": True, "device_id": device_id}

    def _action_call_webhook(self, config: Dict, context: Dict) -> Dict:
        """Call webhook action."""
        url = config.get("url")
        logger.info(f"Webhook called: {url}")
        return {"webhook_called": True, "url": url}

    def _action_update_device(self, config: Dict, context: Dict) -> Dict:
        """Update device action."""
        device_id = config.get("device_id") or context.get("device_id")
        updates = config.get("updates", {})
        logger.info(f"Device {device_id} updated: {updates}")
        return {"updated": True, "device_id": device_id}

    def _action_chain_rule(self, config: Dict, context: Dict) -> Dict:
        """Chain to another rule."""
        rule_id = config.get("rule_id")
        if rule_id:
            rule = self.db.query(WorkflowRule).filter(
                WorkflowRule.id == rule_id
            ).first()
            if rule:
                self.execute_rule(rule, context)
                return {"chained": True, "rule_id": rule_id}
        return {"chained": False}


def get_workflow_engine(db: Session) -> WorkflowEngine:
    """Get WorkflowEngine instance."""
    return WorkflowEngine(db)
