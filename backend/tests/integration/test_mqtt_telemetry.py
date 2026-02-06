"""Integration tests for MQTT telemetry ingestion pipeline."""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch
from sqlalchemy.orm import Session

from backend.app.services.mqtt_subscriber import MQTTMessage, MQTTSubscriber, DataIngestionHandler


class TestMQTTMessageParsing:
    """Test MQTT message parsing from various topic patterns."""

    def test_parse_gateway_telemetry_topic(self):
        """Parse saveit/{gateway_id}/telemetry topic."""
        topic = "saveit/42/telemetry"
        payload = b'{"power": 1500, "voltage": 230}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.gateway_id == 42
        assert msg.message_type == "telemetry"
        assert msg.topic == topic

    def test_parse_gateway_device_telemetry_topic(self):
        """Parse saveit/{gateway_id}/{device_id}/telemetry topic."""
        topic = "saveit/1/meter-01/telemetry"
        payload = b'{"energy": 12345.6}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.gateway_id == 1
        assert msg.device_id == "meter-01"
        assert msg.message_type == "telemetry"

    def test_parse_direct_device_topic(self):
        """Parse device/{device_id}/telemetry topic."""
        topic = "device/DEV-001/telemetry"
        payload = b'{"temperature": 25.5}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.device_id == "DEV-001"
        assert msg.message_type == "telemetry"
        assert msg.gateway_id is None

    def test_parse_device_events_topic(self):
        """Parse device/{device_id}/events topic."""
        topic = "device/DEV-001/events"
        payload = b'{"type": "alarm", "severity": "warning"}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.device_id == "DEV-001"
        assert msg.message_type == "events"

    def test_parse_command_ack_topic(self):
        """Parse device/{device_id}/commands/ack topic."""
        topic = "device/DEV-001/commands/ack"
        payload = b'{"command_id": 123, "status": "executed"}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.device_id == "DEV-001"
        assert msg.message_type == "commands/ack"

    def test_parse_heartbeat_topic(self):
        """Parse saveit/{gateway_id}/heartbeat topic."""
        topic = "saveit/5/heartbeat"
        payload = b'{}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.gateway_id == 5
        assert msg.message_type == "heartbeat"

    def test_extract_edge_key_from_payload(self):
        """Extract edge_key from JSON payload."""
        topic = "saveit/1/data"
        payload = b'{"edge_key": "meter-a", "power": 500}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.edge_key == "meter-a"

    def test_extract_camelcase_edge_key(self):
        """Extract edgeKey (camelCase) from JSON payload."""
        topic = "saveit/1/data"
        payload = b'{"edgeKey": "sensor-1", "temp": 22}'

        msg = MQTTMessage.from_raw(topic, payload)

        assert msg.edge_key == "sensor-1"

    def test_get_payload_json_valid(self):
        """Get parsed JSON from payload."""
        topic = "device/1/data"
        payload = b'{"power": 1500, "voltage": 230.5}'

        msg = MQTTMessage.from_raw(topic, payload)
        data = msg.get_payload_json()

        assert data == {"power": 1500, "voltage": 230.5}

    def test_get_payload_json_invalid(self):
        """Return None for invalid JSON."""
        topic = "device/1/data"
        payload = b'not valid json'

        msg = MQTTMessage.from_raw(topic, payload)
        data = msg.get_payload_json()

        assert data is None


class TestMQTTSubscriber:
    """Test MQTT subscriber functionality."""

    def test_subscriber_initialization(self):
        """Test subscriber initializes with default values."""
        subscriber = MQTTSubscriber()

        assert subscriber.broker_host == "localhost"
        assert subscriber.broker_port == 1883
        assert subscriber._running is False

    def test_subscriber_custom_config(self):
        """Test subscriber with custom config."""
        subscriber = MQTTSubscriber(broker_host="mqtt.example.com", broker_port=8883)

        assert subscriber.broker_host == "mqtt.example.com"
        assert subscriber.broker_port == 8883

    def test_add_handler(self):
        """Test adding message handlers."""
        subscriber = MQTTSubscriber()
        handler = AsyncMock()

        subscriber.add_handler("telemetry", handler)

        assert handler in subscriber._handlers["telemetry"]

    @pytest.mark.asyncio
    async def test_subscribe_adds_topic(self):
        """Test subscribe adds topic to list."""
        subscriber = MQTTSubscriber()

        await subscriber.subscribe("saveit/#")

        assert "saveit/#" in subscriber._subscriptions

    @pytest.mark.asyncio
    async def test_process_message_calls_handlers(self):
        """Test process_message invokes registered handlers."""
        subscriber = MQTTSubscriber()
        handler = AsyncMock()
        subscriber.add_handler("data", handler)

        msg = MQTTMessage.from_raw("saveit/1/data", b'{"power": 100}')
        await subscriber.process_message(msg)

        handler.assert_called_once_with(msg)

    @pytest.mark.asyncio
    async def test_process_message_fallback_to_data_handler(self):
        """Test unknown message types fall back to data handler."""
        subscriber = MQTTSubscriber()
        data_handler = AsyncMock()
        subscriber.add_handler("data", data_handler)

        msg = MQTTMessage.from_raw("saveit/1/custom", b'{"value": 1}')
        await subscriber.process_message(msg)

        data_handler.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_message_updates_stats(self):
        """Test message processing updates statistics."""
        subscriber = MQTTSubscriber()

        msg = MQTTMessage.from_raw("saveit/1/data", b'{}')
        await subscriber.process_message(msg)

        assert subscriber._stats["messages_processed"] == 1
        assert subscriber._stats["last_message_at"] is not None

    def test_get_status(self):
        """Test get_status returns correct info."""
        subscriber = MQTTSubscriber(broker_host="test-broker", broker_port=1884)

        status = subscriber.get_status()

        assert status["running"] is False
        assert status["broker"] == "test-broker:1884"
        assert "stats" in status


class TestDataIngestionHandler:
    """Test data ingestion from MQTT messages."""

    @pytest.fixture
    def mock_db_factory(self):
        """Create mock database session factory."""
        mock_session = MagicMock(spec=Session)
        return MagicMock(return_value=mock_session)

    def test_handler_initialization(self, mock_db_factory):
        """Test handler initializes correctly."""
        handler = DataIngestionHandler(mock_db_factory)

        assert handler._buffer == []
        assert handler._buffer_size == 100

    @pytest.mark.asyncio
    async def test_handle_data_message_buffers(self, mock_db_factory):
        """Test data message is added to buffer."""
        handler = DataIngestionHandler(mock_db_factory)

        msg = MQTTMessage.from_raw("saveit/1/data", b'{"power": 1500}')
        msg.gateway_id = 1

        await handler.handle_data_message(msg)

        assert len(handler._buffer) == 1
        assert handler._buffer[0]["gateway_id"] == 1
        assert handler._buffer[0]["data"] == {"power": 1500}

    @pytest.mark.asyncio
    async def test_handle_data_message_invalid_json(self, mock_db_factory):
        """Test invalid JSON is handled gracefully."""
        handler = DataIngestionHandler(mock_db_factory)

        msg = MQTTMessage(
            topic="saveit/1/data",
            payload=b'not json',
            gateway_id=1,
            device_id=None,
            edge_key=None,
            message_type="data",
            timestamp=datetime.utcnow()
        )

        await handler.handle_data_message(msg)

        assert len(handler._buffer) == 0

    @pytest.mark.asyncio
    async def test_buffer_flush_on_size_limit(self, mock_db_factory):
        """Test buffer flushes when size limit reached."""
        handler = DataIngestionHandler(mock_db_factory)
        handler._buffer_size = 2

        with patch.object(handler, 'flush_buffer', new_callable=AsyncMock) as mock_flush:
            msg1 = MQTTMessage.from_raw("saveit/1/data", b'{"power": 100}')
            msg2 = MQTTMessage.from_raw("saveit/1/data", b'{"power": 200}')

            await handler.handle_data_message(msg1)
            await handler.handle_data_message(msg2)

            mock_flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_heartbeat(self, mock_db_factory):
        """Test heartbeat handling logs correctly."""
        handler = DataIngestionHandler(mock_db_factory)

        msg = MQTTMessage.from_raw("saveit/5/heartbeat", b'{}')
        msg.gateway_id = 5

        # Should not raise
        await handler.handle_heartbeat(msg)

    @pytest.mark.asyncio
    async def test_handle_status_update(self, mock_db_factory):
        """Test status update handling."""
        handler = DataIngestionHandler(mock_db_factory)

        msg = MQTTMessage.from_raw("device/DEV-01/status", b'{"online": true}')
        msg.device_id = "DEV-01"

        # Should not raise
        await handler.handle_status(msg)


class TestMQTTTelemetryE2E:
    """End-to-end tests for MQTT telemetry flow."""

    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires separate database setup - see test_device_flow.py for integration tests")
    async def test_full_message_flow(self, db: Session):
        """Test complete message flow from MQTT to database."""
        from backend.app.services.data_ingestion import DataIngestionService
        from backend.app.models.devices import Device, DeviceModel

        # Setup: Create device model and device
        model = DeviceModel(
            name="Test Meter Model",
            manufacturer="TestCorp",
            category="meter"
        )
        db.add(model)
        db.commit()
        db.refresh(model)

        device = Device(
            model_id=model.id,
            name="Test Meter",
            serial_number="TM-001",
            is_active=1,
            is_online=0
        )
        db.add(device)
        db.commit()
        db.refresh(device)

        # Simulate MQTT message ingestion
        ingestion = DataIngestionService(db)
        result = ingestion.ingest_telemetry(
            device_id=device.id,
            datapoints={"power": 1500, "voltage": 230.5},
            source="mqtt"
        )
        db.commit()

        # Verify
        assert result["status"] == "success"
        assert result["datapoints_stored"] >= 1

        # Verify device was marked online
        db.refresh(device)
        assert device.is_online == 1
        assert device.last_seen_at is not None
