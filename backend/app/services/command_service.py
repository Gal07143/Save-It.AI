"""
Command Service for SAVE-IT.AI
Manages sending commands to devices and tracking execution.
Implements Zoho IoT-style command/ack flow.
"""
import json
import secrets
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from backend.app.models.devices import (
    Device, Command, CommandExecution, DeviceType
)

logger = logging.getLogger(__name__)


class CommandService:
    """
    Manages device commands: send, track, acknowledge.
    Commands flow: Cloud -> Device via MQTT/webhook.
    Acks flow: Device -> Cloud confirming execution.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._pending_commands: Dict[str, CommandExecution] = {}
        self._command_callbacks: List[callable] = []
    
    def send_command(
        self,
        device_id: int,
        command_id: int,
        parameters: Optional[Dict[str, Any]] = None,
        initiated_by: Optional[int] = None,
    ) -> CommandExecution:
        """
        Send a command to a device.
        Creates execution record and queues for delivery.
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            raise ValueError(f"Device {device_id} not found")
        
        if not device.is_online:
            logger.warning(f"Sending command to offline device {device_id}")
        
        command = self.db.query(Command).filter(Command.id == command_id).first()
        if not command:
            raise ValueError(f"Command {command_id} not found")
        
        if device.model_id and command.model_id != device.model_id:
            raise ValueError("Command does not belong to device's model")
        
        correlation_id = f"cmd_{secrets.token_hex(12)}"
        
        execution = CommandExecution(
            device_id=device_id,
            command_id=command_id,
            correlation_id=correlation_id,
            parameters=json.dumps(parameters) if parameters else None,
            status="pending",
            sent_at=datetime.utcnow(),
            initiated_by=initiated_by,
        )
        
        self.db.add(execution)
        self.db.flush()
        
        self._pending_commands[correlation_id] = execution
        
        self._deliver_command(device, command, execution, parameters)
        
        execution.status = "sent"
        
        logger.info(f"Sent command {command.name} to device {device_id} (correlation: {correlation_id})")
        
        return execution
    
    def _deliver_command(
        self,
        device: Device,
        command: Command,
        execution: CommandExecution,
        parameters: Optional[Dict[str, Any]],
    ):
        """
        Deliver command to device via appropriate channel.
        For MQTT devices: publish to device/{device_id}/command
        For webhook devices: queue for outbound webhook
        """
        payload = {
            "correlation_id": execution.correlation_id,
            "command": command.name,
            "parameters": parameters or {},
            "timeout_seconds": command.timeout_seconds,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        if device.device_type == DeviceType.GATEWAY:
            for callback in self._command_callbacks:
                try:
                    callback(device, payload)
                except Exception as e:
                    logger.error(f"Command callback failed: {e}")
        
        logger.debug(f"Command payload: {json.dumps(payload)}")
    
    def add_command_callback(self, callback: callable):
        """Add callback for command delivery (e.g., MQTT publish)."""
        self._command_callbacks.append(callback)
    
    def acknowledge_command(
        self,
        correlation_id: str,
        status: str = "completed",
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Optional[CommandExecution]:
        """
        Process command acknowledgment from device.
        Called when device sends to device/{device_id}/commands/ack
        """
        execution = self.db.query(CommandExecution).filter(
            CommandExecution.correlation_id == correlation_id
        ).first()
        
        if not execution:
            logger.warning(f"Unknown command acknowledgment: {correlation_id}")
            return None
        
        execution.acked_at = datetime.utcnow()
        execution.status = status
        
        if status == "completed":
            execution.completed_at = datetime.utcnow()
            execution.result = json.dumps(result) if result else None
        elif status == "failed":
            execution.completed_at = datetime.utcnow()
            execution.error_message = error_message
        
        self._pending_commands.pop(correlation_id, None)
        
        logger.info(f"Command {correlation_id} acknowledged: {status}")
        
        return execution
    
    def get_pending_commands(
        self,
        device_id: Optional[int] = None,
        timeout_seconds: int = 300,
    ) -> List[CommandExecution]:
        """Get pending commands, optionally filtered by device."""
        cutoff = datetime.utcnow() - timedelta(seconds=timeout_seconds)
        
        query = self.db.query(CommandExecution).filter(
            CommandExecution.status.in_(["pending", "sent"]),
            CommandExecution.sent_at > cutoff
        )
        
        if device_id:
            query = query.filter(CommandExecution.device_id == device_id)
        
        return query.all()
    
    def get_command_history(
        self,
        device_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> List[CommandExecution]:
        """Get command execution history for a device."""
        return self.db.query(CommandExecution).filter(
            CommandExecution.device_id == device_id
        ).order_by(
            CommandExecution.sent_at.desc()
        ).offset(offset).limit(limit).all()
    
    def timeout_stale_commands(self, timeout_seconds: int = 300) -> int:
        """Mark stale commands as timed out. Returns count updated."""
        cutoff = datetime.utcnow() - timedelta(seconds=timeout_seconds)
        
        stale = self.db.query(CommandExecution).filter(
            CommandExecution.status.in_(["pending", "sent"]),
            CommandExecution.sent_at < cutoff
        ).all()
        
        count = 0
        for execution in stale:
            execution.status = "timeout"
            execution.completed_at = datetime.utcnow()
            execution.error_message = "Command timed out waiting for acknowledgment"
            self._pending_commands.pop(execution.correlation_id, None)
            count += 1
        
        if count > 0:
            logger.info(f"Timed out {count} stale commands")
        
        return count
    
    def get_available_commands(self, device_id: int) -> List[Command]:
        """Get commands available for a device based on its model."""
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device or not device.model_id:
            return []
        
        return self.db.query(Command).filter(
            Command.model_id == device.model_id
        ).order_by(Command.display_order).all()
    
    def build_command_message(
        self,
        device_id: int,
        command_name: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Build a command message payload for MQTT publishing.
        Useful for external systems that want to format their own messages.
        """
        correlation_id = f"cmd_{secrets.token_hex(12)}"
        
        return {
            "correlation_id": correlation_id,
            "device_id": device_id,
            "command": command_name,
            "parameters": parameters or {},
            "timestamp": datetime.utcnow().isoformat(),
            "topic": f"device/{device_id}/command",
        }


class CommandAckHandler:
    """
    Handles command acknowledgments from devices.
    Processes messages from device/{device_id}/commands/ack topic.
    """
    
    def __init__(self, command_service: CommandService):
        self.command_service = command_service
    
    def handle_ack(self, device_id: int, payload: Dict[str, Any]) -> bool:
        """
        Process acknowledgment payload from device.
        Expected format:
        {
            "correlation_id": "cmd_xxx",
            "status": "completed|failed|rejected",
            "result": {...},
            "error": "..."
        }
        """
        correlation_id = payload.get("correlation_id")
        if not correlation_id:
            logger.warning(f"Ack from device {device_id} missing correlation_id")
            return False
        
        status = payload.get("status", "completed")
        result = payload.get("result")
        error = payload.get("error")
        
        execution = self.command_service.acknowledge_command(
            correlation_id=correlation_id,
            status=status,
            result=result,
            error_message=error,
        )
        
        return execution is not None


def get_command_service(db: Session) -> CommandService:
    """Get command service instance."""
    return CommandService(db)
