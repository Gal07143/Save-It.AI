"""Integration tests for command execution flow."""
import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from sqlalchemy.orm import Session

from app.services.command_service import (
    CommandService, CommandAckHandler, get_command_service
)
from app.models.devices import (
    Device, DeviceModel, Command, CommandExecution, DeviceType
)


class TestCommandService:
    """Test command service core functionality."""

    @pytest.fixture
    def test_model(self, db):
        """Create a test device model with commands."""
        model = DeviceModel(
            name="Smart Inverter"
        )
        db.add(model)
        db.commit()
        db.refresh(model)
        return model

    @pytest.fixture
    def test_commands(self, db: Session, test_model):
        """Create test commands for the model."""
        commands = [
            Command(
                model_id=test_model.id,
                name="set_power_limit",
                display_name="Set Power Limit",
                description="Set max power output percentage",
                parameters_schema='{"limit": {"type": "number", "min": 0, "max": 100}}',
                timeout_seconds=30,
                display_order=1
            ),
            Command(
                model_id=test_model.id,
                name="reset",
                display_name="Reset Device",
                description="Perform soft reset",
                timeout_seconds=60,
                display_order=2
            ),
        ]
        for cmd in commands:
            db.add(cmd)
        db.commit()
        for cmd in commands:
            db.refresh(cmd)
        return commands

    @pytest.fixture
    def test_device(self, db: Session, test_model, test_site):
        """Create a test device."""
        device = Device(
            site_id=test_site.id,
            model_id=test_model.id,
            name="Inverter 1",
            serial_number="INV-001",
            device_type=DeviceType.PERIPHERAL,
            is_active=1,
            is_online=1
        )
        db.add(device)
        db.commit()
        db.refresh(device)
        return device

    def test_send_command_creates_execution(
        self, db: Session, test_device, test_commands
    ):
        """Test sending command creates execution record."""
        service = CommandService(db)
        command = test_commands[0]

        execution = service.send_command(
            device_id=test_device.id,
            command_id=command.id,
            parameters={"limit": 80}
        )
        db.commit()

        assert execution.id is not None
        assert execution.device_id == test_device.id
        assert execution.command_id == command.id
        assert execution.correlation_id.startswith("cmd_")
        assert execution.status == "sent"
        assert json.loads(execution.parameters) == {"limit": 80}

    def test_send_command_to_offline_device_warns(
        self, db: Session, test_device, test_commands, caplog
    ):
        """Test sending to offline device logs warning."""
        test_device.is_online = 0
        db.commit()

        service = CommandService(db)
        command = test_commands[0]

        execution = service.send_command(
            device_id=test_device.id,
            command_id=command.id
        )

        assert execution is not None
        assert "offline device" in caplog.text.lower()

    def test_send_command_invalid_device_raises(self, db: Session, test_commands):
        """Test sending to non-existent device raises."""
        service = CommandService(db)

        with pytest.raises(ValueError, match="Device .* not found"):
            service.send_command(device_id=99999, command_id=test_commands[0].id)

    def test_send_command_invalid_command_raises(self, db: Session, test_device):
        """Test sending non-existent command raises."""
        service = CommandService(db)

        with pytest.raises(ValueError, match="Command .* not found"):
            service.send_command(device_id=test_device.id, command_id=99999)

    def test_acknowledge_command_completes(
        self, db: Session, test_device, test_commands
    ):
        """Test acknowledging command marks it complete."""
        service = CommandService(db)
        command = test_commands[0]

        execution = service.send_command(
            device_id=test_device.id,
            command_id=command.id
        )
        db.commit()

        acked = service.acknowledge_command(
            correlation_id=execution.correlation_id,
            status="completed",
            result={"new_limit": 80}
        )

        assert acked is not None
        assert acked.status == "completed"
        assert acked.acked_at is not None
        assert acked.completed_at is not None
        assert json.loads(acked.result) == {"new_limit": 80}

    def test_acknowledge_command_failed(
        self, db: Session, test_device, test_commands
    ):
        """Test acknowledging failed command."""
        service = CommandService(db)
        command = test_commands[1]

        execution = service.send_command(
            device_id=test_device.id,
            command_id=command.id
        )
        db.commit()

        acked = service.acknowledge_command(
            correlation_id=execution.correlation_id,
            status="failed",
            error_message="Hardware fault"
        )

        assert acked.status == "failed"
        assert acked.error_message == "Hardware fault"

    def test_acknowledge_command_invalid_status(
        self, db: Session, test_device, test_commands
    ):
        """Test acknowledging with invalid status defaults to failed."""
        service = CommandService(db)
        command = test_commands[0]

        execution = service.send_command(
            device_id=test_device.id,
            command_id=command.id
        )
        db.commit()

        acked = service.acknowledge_command(
            correlation_id=execution.correlation_id,
            status="unknown_status"
        )

        assert acked.status == "failed"

    def test_acknowledge_unknown_correlation_id(self, db: Session):
        """Test acknowledging unknown command returns None."""
        service = CommandService(db)

        result = service.acknowledge_command(
            correlation_id="cmd_nonexistent123",
            status="completed"
        )

        assert result is None

    def test_get_pending_commands(
        self, db: Session, test_device, test_commands
    ):
        """Test listing pending commands."""
        service = CommandService(db)

        exec1 = service.send_command(
            device_id=test_device.id,
            command_id=test_commands[0].id
        )
        exec2 = service.send_command(
            device_id=test_device.id,
            command_id=test_commands[1].id
        )
        db.commit()

        pending = service.get_pending_commands(device_id=test_device.id)

        assert len(pending) == 2
        correlation_ids = [p.correlation_id for p in pending]
        assert exec1.correlation_id in correlation_ids
        assert exec2.correlation_id in correlation_ids

    def test_get_pending_commands_excludes_completed(
        self, db: Session, test_device, test_commands
    ):
        """Test pending list excludes completed commands."""
        service = CommandService(db)

        execution = service.send_command(
            device_id=test_device.id,
            command_id=test_commands[0].id
        )
        db.commit()

        service.acknowledge_command(execution.correlation_id, "completed")

        pending = service.get_pending_commands(device_id=test_device.id)

        assert len(pending) == 0

    def test_timeout_stale_commands(
        self, db: Session, test_device, test_commands
    ):
        """Test stale commands are timed out."""
        service = CommandService(db)

        execution = service.send_command(
            device_id=test_device.id,
            command_id=test_commands[0].id
        )
        db.commit()

        # Manually set sent_at to past
        execution.sent_at = datetime.utcnow() - timedelta(minutes=10)
        db.commit()

        count = service.timeout_stale_commands(timeout_seconds=60)
        db.commit()

        assert count == 1
        db.refresh(execution)
        assert execution.status == "timeout"

    def test_get_command_history(
        self, db: Session, test_device, test_commands
    ):
        """Test command history retrieval."""
        service = CommandService(db)

        for _ in range(5):
            service.send_command(
                device_id=test_device.id,
                command_id=test_commands[0].id
            )
        db.commit()

        history = service.get_command_history(test_device.id, limit=3)

        assert len(history) == 3

    def test_get_available_commands(
        self, db: Session, test_device, test_commands
    ):
        """Test listing available commands for device."""
        service = CommandService(db)

        commands = service.get_available_commands(test_device.id)

        assert len(commands) == 2
        assert commands[0].name == "set_power_limit"  # Order by display_order

    def test_build_command_message(self, db: Session):
        """Test building MQTT command message."""
        service = CommandService(db)

        msg = service.build_command_message(
            device_id=42,
            command_name="toggle",
            parameters={"state": "on"}
        )

        assert msg["correlation_id"].startswith("cmd_")
        assert msg["device_id"] == 42
        assert msg["command"] == "toggle"
        assert msg["parameters"] == {"state": "on"}
        assert msg["topic"] == "device/42/command"

    def test_command_callback_invoked(
        self, db: Session, test_device, test_commands
    ):
        """Test command callbacks are invoked on send."""
        service = CommandService(db)
        callback = MagicMock()
        service.add_command_callback(callback)

        service.send_command(
            device_id=test_device.id,
            command_id=test_commands[0].id
        )
        db.commit()

        callback.assert_called_once()
        call_args = callback.call_args
        assert call_args[0][0] == test_device  # First arg is device


class TestCommandAckHandler:
    """Test command acknowledgment handler."""

    @pytest.fixture
    def mock_command_service(self):
        """Create mock command service."""
        return MagicMock(spec=CommandService)

    def test_handle_ack_success(self, mock_command_service):
        """Test successful ack processing."""
        mock_command_service.acknowledge_command.return_value = MagicMock()
        handler = CommandAckHandler(mock_command_service)

        result = handler.handle_ack(
            device_id=1,
            payload={
                "correlation_id": "cmd_abc123",
                "status": "completed",
                "result": {"value": 42}
            }
        )

        assert result is True
        mock_command_service.acknowledge_command.assert_called_once_with(
            correlation_id="cmd_abc123",
            status="completed",
            result={"value": 42},
            error_message=None
        )

    def test_handle_ack_failed(self, mock_command_service):
        """Test failed command ack processing."""
        mock_command_service.acknowledge_command.return_value = MagicMock()
        handler = CommandAckHandler(mock_command_service)

        result = handler.handle_ack(
            device_id=1,
            payload={
                "correlation_id": "cmd_xyz789",
                "status": "failed",
                "error": "Device busy"
            }
        )

        assert result is True
        mock_command_service.acknowledge_command.assert_called_once_with(
            correlation_id="cmd_xyz789",
            status="failed",
            result=None,
            error_message="Device busy"
        )

    def test_handle_ack_missing_correlation_id(self, mock_command_service):
        """Test ack without correlation_id fails."""
        handler = CommandAckHandler(mock_command_service)

        result = handler.handle_ack(
            device_id=1,
            payload={"status": "completed"}
        )

        assert result is False
        mock_command_service.acknowledge_command.assert_not_called()

    def test_handle_ack_unknown_command(self, mock_command_service):
        """Test ack for unknown command returns False."""
        mock_command_service.acknowledge_command.return_value = None
        handler = CommandAckHandler(mock_command_service)

        result = handler.handle_ack(
            device_id=1,
            payload={"correlation_id": "cmd_unknown", "status": "completed"}
        )

        assert result is False


class TestCommandFlowE2E:
    """End-to-end command flow tests with API."""

    @pytest.fixture
    def setup_device_with_commands(self, db, test_site):
        """Setup device model with commands."""
        model = DeviceModel(
            name="Test Switch"
        )
        db.add(model)
        db.commit()
        db.refresh(model)

        command = Command(
            model_id=model.id,
            name="toggle",
            display_name="Toggle State",
            parameters_schema='{"state": {"type": "string", "enum": ["on", "off"]}}'
        )
        db.add(command)
        db.commit()
        db.refresh(command)

        device = Device(
            site_id=test_site.id,
            model_id=model.id,
            name="Switch 1",
            serial_number="SW-001",
            device_type=DeviceType.PERIPHERAL,
            is_active=1,
            is_online=1
        )
        db.add(device)
        db.commit()
        db.refresh(device)

        return device, command

    def test_full_command_lifecycle(
        self, db: Session, setup_device_with_commands
    ):
        """Test complete command: send -> ack -> verify."""
        device, command = setup_device_with_commands
        service = CommandService(db)

        # 1. Send command
        execution = service.send_command(
            device_id=device.id,
            command_id=command.id,
            parameters={"state": "on"}
        )
        db.commit()

        assert execution.status == "sent"
        correlation_id = execution.correlation_id

        # 2. Verify it appears in pending
        pending = service.get_pending_commands(device.id)
        assert len(pending) == 1
        assert pending[0].correlation_id == correlation_id

        # 3. Simulate device acknowledgment
        acked = service.acknowledge_command(
            correlation_id=correlation_id,
            status="completed",
            result={"new_state": "on"}
        )

        assert acked.status == "completed"

        # 4. Verify no longer pending
        pending_after = service.get_pending_commands(device.id)
        assert len(pending_after) == 0

        # 5. Verify in history
        history = service.get_command_history(device.id)
        assert len(history) == 1
        assert history[0].status == "completed"
