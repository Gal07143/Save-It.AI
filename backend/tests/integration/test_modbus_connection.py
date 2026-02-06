"""Integration tests for Modbus connection management."""
import pytest
import asyncio
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch

from backend.app.services.modbus_manager import (
    ModbusConnectionManager,
    ModbusConnection,
    ModbusProtocol,
    RegisterMapping,
    RegisterParser,
    DataType,
    Endianness,
    CircuitBreaker,
)


class TestRegisterParser:
    """Test Modbus register value parsing."""

    def test_parse_uint16(self):
        """Parse unsigned 16-bit integer."""
        mapping = RegisterMapping(
            name="power", address=0, data_type=DataType.UINT16
        )
        result = RegisterParser.parse([0x00FF], mapping)
        assert result == 255

    def test_parse_int16_positive(self):
        """Parse signed 16-bit integer (positive)."""
        mapping = RegisterMapping(
            name="temp", address=0, data_type=DataType.INT16
        )
        result = RegisterParser.parse([0x0064], mapping)
        assert result == 100

    def test_parse_int16_negative(self):
        """Parse signed 16-bit integer (negative)."""
        mapping = RegisterMapping(
            name="temp", address=0, data_type=DataType.INT16
        )
        result = RegisterParser.parse([0xFFCE], mapping)  # -50 in two's complement
        assert result == -50

    def test_parse_uint32(self):
        """Parse unsigned 32-bit integer."""
        mapping = RegisterMapping(
            name="energy", address=0, data_type=DataType.UINT32, count=2
        )
        result = RegisterParser.parse([0x0001, 0x0000], mapping)
        assert result == 65536

    def test_parse_float32(self):
        """Parse 32-bit floating point."""
        mapping = RegisterMapping(
            name="voltage", address=0, data_type=DataType.FLOAT32, count=2
        )
        # 230.5 in IEEE 754 = 0x4366C000
        result = RegisterParser.parse([0x4366, 0xC000], mapping)
        assert abs(result - 230.5) < 0.5  # Allow small floating point variance

    def test_parse_with_scale_factor(self):
        """Parse with scale factor applied."""
        mapping = RegisterMapping(
            name="power", address=0, data_type=DataType.UINT16,
            scale_factor=0.1
        )
        result = RegisterParser.parse([1000], mapping)
        assert result == 100.0

    def test_parse_with_offset(self):
        """Parse with offset applied."""
        mapping = RegisterMapping(
            name="temp", address=0, data_type=DataType.INT16,
            scale_factor=0.1, offset=-40.0
        )
        result = RegisterParser.parse([500], mapping)
        assert result == 10.0  # (500 * 0.1) - 40 = 10

    def test_parse_little_endian(self):
        """Parse with little endian byte order."""
        mapping = RegisterMapping(
            name="value", address=0, data_type=DataType.UINT32, count=2,
            endianness=Endianness.LITTLE
        )
        result = RegisterParser.parse([0x0102, 0x0304], mapping)
        # Little endian swaps entire byte array
        expected = int.from_bytes(
            bytes([0x04, 0x03, 0x02, 0x01])[::-1], 'big'
        )
        assert result is not None

    def test_parse_string(self):
        """Parse ASCII string from registers."""
        mapping = RegisterMapping(
            name="serial", address=0, data_type=DataType.STRING, count=4
        )
        # "ABCD" = 0x4142, 0x4344
        result = RegisterParser.parse([0x4142, 0x4344], mapping)
        assert result == "ABCD"

    def test_parse_empty_registers(self):
        """Parse empty register list returns None."""
        mapping = RegisterMapping(
            name="power", address=0, data_type=DataType.UINT16
        )
        result = RegisterParser.parse([], mapping)
        assert result is None


class TestCircuitBreaker:
    """Test circuit breaker pattern."""

    def test_initial_state_closed(self):
        """Circuit breaker starts closed."""
        cb = CircuitBreaker()
        assert cb.state == "closed"
        assert cb.can_attempt() is True

    def test_opens_after_threshold(self):
        """Circuit breaker opens after failure threshold."""
        cb = CircuitBreaker(failure_threshold=3)

        for _ in range(3):
            cb.record_failure()

        assert cb.state == "open"
        assert cb.can_attempt() is False

    def test_success_resets_failures(self):
        """Successful connection resets failure count."""
        cb = CircuitBreaker(failure_threshold=5)

        for _ in range(3):
            cb.record_failure()

        cb.record_success()

        assert cb.failures == 0
        assert cb.state == "closed"

    def test_recovery_after_timeout(self):
        """Circuit breaker recovers after timeout."""
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0)

        cb.record_failure()
        cb.record_failure()

        assert cb.state == "open"

        # Simulate timeout by setting last_failure to past
        from datetime import timedelta
        cb.last_failure = datetime.utcnow() - timedelta(seconds=61)

        assert cb.can_attempt() is True
        assert cb.state == "half-open"


class TestModbusConnection:
    """Test Modbus connection data class."""

    def test_tcp_connection_defaults(self):
        """TCP connection has correct defaults."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="192.168.1.100"
        )

        assert conn.port == 502
        assert conn.slave_id == 1
        assert conn.timeout == 5.0
        assert conn.is_connected is False

    def test_rtu_connection_serial_config(self):
        """RTU connection includes serial config."""
        conn = ModbusConnection(
            id=2,
            protocol=ModbusProtocol.RTU,
            host="",
            serial_port="/dev/ttyUSB0",
            baudrate=19200,
            parity="E"
        )

        assert conn.serial_port == "/dev/ttyUSB0"
        assert conn.baudrate == 19200
        assert conn.parity == "E"


class TestModbusConnectionManager:
    """Test Modbus connection manager."""

    @pytest.fixture
    def manager(self):
        """Create connection manager."""
        return ModbusConnectionManager(max_connections=10)

    def test_add_connection(self, manager):
        """Add connection to manager."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="192.168.1.100"
        )

        result = manager.add_connection(conn)

        assert result is True
        assert 1 in manager._connections
        assert 1 in manager._circuit_breakers

    def test_add_connection_limit(self, manager):
        """Respect maximum connection limit."""
        manager.max_connections = 2

        for i in range(3):
            conn = ModbusConnection(
                id=i,
                protocol=ModbusProtocol.TCP,
                host=f"192.168.1.{i}"
            )
            manager.add_connection(conn)

        assert len(manager._connections) == 2

    def test_remove_connection(self, manager):
        """Remove connection from manager."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="192.168.1.100"
        )
        manager.add_connection(conn)

        manager.remove_connection(1)

        assert 1 not in manager._connections
        assert 1 not in manager._circuit_breakers

    @pytest.mark.asyncio
    async def test_connect_success(self, manager):
        """Test successful connection."""
        pytest.importorskip("pymodbus")

        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="localhost",
            port=5020
        )
        manager.add_connection(conn)

        mock_client = MagicMock()
        mock_client.connected = True
        mock_client.connect = AsyncMock()

        with patch(
            "pymodbus.client.AsyncModbusTcpClient",
            return_value=mock_client
        ):
            result = await manager.connect(1)

        assert result is True
        assert manager._connections[1].is_connected is True

    @pytest.mark.asyncio
    async def test_connect_failure_records_error(self, manager):
        """Test connection failure records error."""
        pytest.importorskip("pymodbus")

        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="unreachable.local"
        )
        manager.add_connection(conn)

        with patch(
            "pymodbus.client.AsyncModbusTcpClient",
            side_effect=Exception("Connection refused")
        ):
            result = await manager.connect(1)

        assert result is False
        assert manager._connections[1].last_error == "Connection refused"
        assert manager._connections[1].error_count == 1

    @pytest.mark.asyncio
    async def test_read_registers(self, manager):
        """Test reading Modbus registers."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="localhost"
        )
        manager.add_connection(conn)

        mock_client = MagicMock()
        mock_client.connected = True
        mock_client.connect = AsyncMock()

        mock_result = MagicMock()
        mock_result.isError.return_value = False
        mock_result.registers = [0x0190]  # 400
        mock_client.read_holding_registers = AsyncMock(return_value=mock_result)

        manager._clients[1] = mock_client
        manager._connections[1].is_connected = True

        mapping = RegisterMapping(
            name="voltage",
            address=100,
            data_type=DataType.UINT16,
            scale_factor=0.1
        )

        result = await manager.read_registers(1, mapping)

        assert result == 40.0  # 400 * 0.1
        mock_client.read_holding_registers.assert_called_once()

    @pytest.mark.asyncio
    async def test_read_registers_with_error(self, manager):
        """Test reading registers handles errors."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="localhost"
        )
        manager.add_connection(conn)

        mock_client = MagicMock()
        mock_client.read_holding_registers = AsyncMock(
            side_effect=Exception("Communication error")
        )
        mock_client.close = AsyncMock()

        manager._clients[1] = mock_client
        manager._connections[1].is_connected = True

        mapping = RegisterMapping(
            name="power",
            address=0,
            data_type=DataType.UINT16
        )

        result = await manager.read_registers(1, mapping)

        assert result is None
        assert manager._stats["failed_polls"] == 1

    @pytest.mark.asyncio
    async def test_write_register(self, manager):
        """Test writing Modbus register."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="localhost"
        )
        manager.add_connection(conn)

        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.isError.return_value = False
        mock_client.write_register = AsyncMock(return_value=mock_result)

        manager._clients[1] = mock_client
        manager._connections[1].is_connected = True

        result = await manager.write_register(1, address=100, value=500)

        assert result is True
        mock_client.write_register.assert_called_once_with(100, 500, slave=1)

    @pytest.mark.asyncio
    async def test_poll_device(self, manager):
        """Test polling multiple registers from device."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="localhost"
        )
        manager.add_connection(conn)

        mock_client = MagicMock()
        mock_result = MagicMock()
        mock_result.isError.return_value = False
        mock_result.registers = [230]
        mock_client.read_holding_registers = AsyncMock(return_value=mock_result)

        manager._clients[1] = mock_client
        manager._connections[1].is_connected = True

        mappings = [
            RegisterMapping(name="voltage", address=0, data_type=DataType.UINT16),
            RegisterMapping(name="current", address=2, data_type=DataType.UINT16),
        ]

        results = await manager.poll_device(1, mappings)

        assert "voltage" in results
        assert "current" in results
        assert results["voltage"]["value"] == 230

    @pytest.mark.asyncio
    async def test_test_connection(self, manager):
        """Test connection test method."""
        pytest.importorskip("pymodbus")

        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="localhost"
        )
        manager.add_connection(conn)

        mock_client = MagicMock()
        mock_client.connected = True
        mock_client.connect = AsyncMock()

        with patch(
            "pymodbus.client.AsyncModbusTcpClient",
            return_value=mock_client
        ):
            result = await manager.test_connection(1)

        assert result["connection_id"] == 1
        assert result["success"] is True
        assert "latency_ms" in result

    def test_get_status(self, manager):
        """Test status report."""
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="192.168.1.100",
            port=502
        )
        manager.add_connection(conn)

        status = manager.get_status()

        assert status["max_connections"] == 10
        assert len(status["connections"]) == 1
        assert status["connections"][0]["host"] == "192.168.1.100"
        assert "stats" in status


class TestModbusE2E:
    """End-to-end Modbus flow tests (mocked)."""

    @pytest.mark.asyncio
    async def test_full_polling_flow(self):
        """Test complete polling flow from connection to data."""
        manager = ModbusConnectionManager()

        # Setup connection
        conn = ModbusConnection(
            id=1,
            protocol=ModbusProtocol.TCP,
            host="192.168.1.50",
            port=502,
            slave_id=1
        )
        manager.add_connection(conn)

        # Mock the Modbus client
        mock_client = MagicMock()
        mock_client.connected = True
        mock_client.connect = AsyncMock()

        # Define register mappings for a power meter
        mappings = [
            RegisterMapping(
                name="voltage_L1",
                address=0,
                data_type=DataType.FLOAT32,
                count=2,
                unit="V",
                scale_factor=1.0
            ),
            RegisterMapping(
                name="current_L1",
                address=2,
                data_type=DataType.FLOAT32,
                count=2,
                unit="A",
                scale_factor=1.0
            ),
            RegisterMapping(
                name="power_total",
                address=4,
                data_type=DataType.FLOAT32,
                count=2,
                unit="kW",
                scale_factor=0.001
            ),
        ]

        # Mock read responses
        mock_results = {
            0: MagicMock(isError=lambda: False, registers=[0x4366, 0xC000]),  # 230.5V
            2: MagicMock(isError=lambda: False, registers=[0x4120, 0x0000]),  # 10.0A
            4: MagicMock(isError=lambda: False, registers=[0x4570, 0x0000]),  # 3840W
        }

        async def mock_read(address, count, slave):
            return mock_results.get(address, MagicMock(isError=lambda: True))

        mock_client.read_holding_registers = mock_read

        manager._clients[1] = mock_client
        manager._connections[1].is_connected = True

        # Poll device
        results = await manager.poll_device(1, mappings)

        # Verify results
        assert len(results) == 3
        assert abs(results["voltage_L1"]["value"] - 230.5) < 0.5  # Allow small floating point variance
        assert abs(results["current_L1"]["value"] - 10.0) < 0.5  # Allow small floating point variance
        # Power scaled by 0.001
        assert "power_total" in results
