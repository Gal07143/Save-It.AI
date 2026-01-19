"""
Modbus Connection Manager for SAVE-IT.AI
Manages Modbus TCP/RTU connections with pooling, polling, and error handling.
"""
import asyncio
import struct
import logging
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class ModbusProtocol(str, Enum):
    TCP = "tcp"
    RTU = "rtu"


class DataType(str, Enum):
    INT16 = "int16"
    UINT16 = "uint16"
    INT32 = "int32"
    UINT32 = "uint32"
    FLOAT32 = "float32"
    FLOAT64 = "float64"
    STRING = "string"


class Endianness(str, Enum):
    BIG = "big"
    LITTLE = "little"
    BIG_SWAP = "big_swap"
    LITTLE_SWAP = "little_swap"


@dataclass
class RegisterMapping:
    """Defines a Modbus register mapping."""
    name: str
    address: int
    data_type: DataType
    count: int = 1
    scale_factor: float = 1.0
    offset: float = 0.0
    unit: str = ""
    function_code: int = 3
    endianness: Endianness = Endianness.BIG


@dataclass
class ModbusConnection:
    """Represents a Modbus connection."""
    id: int
    protocol: ModbusProtocol
    host: str
    port: int = 502
    slave_id: int = 1
    timeout: float = 5.0
    retry_count: int = 3
    is_connected: bool = False
    last_poll: Optional[datetime] = None
    last_error: Optional[str] = None
    error_count: int = 0
    consecutive_failures: int = 0
    
    serial_port: Optional[str] = None
    baudrate: int = 9600
    parity: str = "N"
    stopbits: int = 1


@dataclass
class CircuitBreaker:
    """Circuit breaker for connection resilience."""
    failure_threshold: int = 5
    recovery_timeout: int = 60
    failures: int = 0
    last_failure: Optional[datetime] = None
    state: str = "closed"
    
    def record_failure(self):
        """Record a connection failure."""
        self.failures += 1
        self.last_failure = datetime.utcnow()
        if self.failures >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"Circuit breaker opened after {self.failures} failures")
    
    def record_success(self):
        """Record a successful connection."""
        self.failures = 0
        self.state = "closed"
    
    def can_attempt(self) -> bool:
        """Check if connection attempt is allowed."""
        if self.state == "closed":
            return True
        if self.last_failure:
            elapsed = (datetime.utcnow() - self.last_failure).total_seconds()
            if elapsed >= self.recovery_timeout:
                self.state = "half-open"
                return True
        return False


class RegisterParser:
    """Parses Modbus register values based on data type and endianness."""
    
    @staticmethod
    def parse(registers: List[int], mapping: RegisterMapping) -> Any:
        """Parse register values to the appropriate data type."""
        if not registers:
            return None
        
        byte_data = b''.join(r.to_bytes(2, 'big') for r in registers)
        
        if mapping.endianness == Endianness.LITTLE:
            byte_data = byte_data[::-1]
        elif mapping.endianness == Endianness.BIG_SWAP:
            swapped = bytearray()
            for i in range(0, len(byte_data), 4):
                chunk = byte_data[i:i+4]
                if len(chunk) == 4:
                    swapped.extend([chunk[2], chunk[3], chunk[0], chunk[1]])
                else:
                    swapped.extend(chunk)
            byte_data = bytes(swapped)
        elif mapping.endianness == Endianness.LITTLE_SWAP:
            swapped = bytearray()
            for i in range(0, len(byte_data), 4):
                chunk = byte_data[i:i+4]
                if len(chunk) == 4:
                    swapped.extend([chunk[1], chunk[0], chunk[3], chunk[2]])
                else:
                    swapped.extend(chunk[::-1])
            byte_data = bytes(swapped)
        
        try:
            if mapping.data_type == DataType.INT16:
                value = struct.unpack('>h', byte_data[:2])[0]
            elif mapping.data_type == DataType.UINT16:
                value = struct.unpack('>H', byte_data[:2])[0]
            elif mapping.data_type == DataType.INT32:
                value = struct.unpack('>i', byte_data[:4])[0]
            elif mapping.data_type == DataType.UINT32:
                value = struct.unpack('>I', byte_data[:4])[0]
            elif mapping.data_type == DataType.FLOAT32:
                value = struct.unpack('>f', byte_data[:4])[0]
            elif mapping.data_type == DataType.FLOAT64:
                value = struct.unpack('>d', byte_data[:8])[0]
            elif mapping.data_type == DataType.STRING:
                value = byte_data.decode('ascii', errors='ignore').strip('\x00')
                return value
            else:
                value = registers[0]
            
            return value * mapping.scale_factor + mapping.offset
            
        except Exception as e:
            logger.error(f"Failed to parse register {mapping.name}: {e}")
            return None


class ModbusConnectionManager:
    """
    Manages Modbus TCP/RTU connections with connection pooling and polling.
    """
    
    def __init__(self, max_connections: int = 50):
        self.max_connections = max_connections
        self._connections: Dict[int, ModbusConnection] = {}
        self._clients: Dict[int, Any] = {}
        self._circuit_breakers: Dict[int, CircuitBreaker] = {}
        self._poll_tasks: Dict[int, asyncio.Task] = {}
        self._running = False
        self._stats = {
            "total_polls": 0,
            "successful_polls": 0,
            "failed_polls": 0,
            "active_connections": 0,
        }
    
    def add_connection(self, connection: ModbusConnection) -> bool:
        """Add a new Modbus connection."""
        if len(self._connections) >= self.max_connections:
            logger.error("Maximum connections reached")
            return False
        
        self._connections[connection.id] = connection
        self._circuit_breakers[connection.id] = CircuitBreaker()
        logger.info(f"Added Modbus connection {connection.id}: {connection.host}:{connection.port}")
        return True
    
    def remove_connection(self, connection_id: int):
        """Remove a Modbus connection."""
        if connection_id in self._poll_tasks:
            self._poll_tasks[connection_id].cancel()
            del self._poll_tasks[connection_id]
        
        self._connections.pop(connection_id, None)
        self._clients.pop(connection_id, None)
        self._circuit_breakers.pop(connection_id, None)
        logger.info(f"Removed Modbus connection {connection_id}")
    
    async def connect(self, connection_id: int) -> bool:
        """Establish a Modbus connection."""
        if connection_id not in self._connections:
            return False
        
        conn = self._connections[connection_id]
        breaker = self._circuit_breakers[connection_id]
        
        if not breaker.can_attempt():
            logger.warning(f"Circuit breaker open for connection {connection_id}")
            return False
        
        try:
            from pymodbus.client import AsyncModbusTcpClient, AsyncModbusSerialClient
            
            if conn.protocol == ModbusProtocol.TCP:
                client = AsyncModbusTcpClient(
                    host=conn.host,
                    port=conn.port,
                    timeout=conn.timeout,
                )
            else:
                if not conn.serial_port:
                    raise ConnectionError("Serial port not configured for RTU connection")
                client = AsyncModbusSerialClient(
                    port=conn.serial_port,
                    baudrate=conn.baudrate,
                    parity=conn.parity,
                    stopbits=conn.stopbits,
                    timeout=conn.timeout,
                )
            
            await client.connect()
            
            if client.connected:
                self._clients[connection_id] = client
                conn.is_connected = True
                conn.consecutive_failures = 0
                breaker.record_success()
                self._stats["active_connections"] += 1
                logger.info(f"Connected to Modbus device {connection_id}")
                return True
            else:
                raise ConnectionError("Failed to connect")
                
        except Exception as e:
            conn.last_error = str(e)
            conn.error_count += 1
            conn.consecutive_failures += 1
            breaker.record_failure()
            logger.error(f"Modbus connection {connection_id} failed: {e}")
            return False
    
    async def disconnect(self, connection_id: int):
        """Disconnect a Modbus connection."""
        if connection_id in self._clients:
            try:
                await self._clients[connection_id].close()
            except Exception:
                pass
            del self._clients[connection_id]
            self._stats["active_connections"] -= 1
        
        if connection_id in self._connections:
            self._connections[connection_id].is_connected = False
    
    async def read_registers(
        self,
        connection_id: int,
        mapping: RegisterMapping,
    ) -> Optional[Any]:
        """Read and parse Modbus registers."""
        if connection_id not in self._clients:
            if not await self.connect(connection_id):
                return None
        
        client = self._clients.get(connection_id)
        conn = self._connections.get(connection_id)
        
        if not client or not conn:
            return None
        
        self._stats["total_polls"] += 1
        
        try:
            if mapping.function_code == 1:
                result = await client.read_coils(
                    mapping.address, mapping.count, slave=conn.slave_id
                )
            elif mapping.function_code == 2:
                result = await client.read_discrete_inputs(
                    mapping.address, mapping.count, slave=conn.slave_id
                )
            elif mapping.function_code == 3:
                result = await client.read_holding_registers(
                    mapping.address, mapping.count, slave=conn.slave_id
                )
            elif mapping.function_code == 4:
                result = await client.read_input_registers(
                    mapping.address, mapping.count, slave=conn.slave_id
                )
            else:
                logger.error(f"Unsupported function code: {mapping.function_code}")
                return None
            
            if result.isError():
                raise Exception(f"Modbus error: {result}")
            
            conn.last_poll = datetime.utcnow()
            conn.consecutive_failures = 0
            self._stats["successful_polls"] += 1
            
            return RegisterParser.parse(result.registers, mapping)
            
        except Exception as e:
            conn.last_error = str(e)
            conn.consecutive_failures += 1
            self._stats["failed_polls"] += 1
            
            if conn.consecutive_failures >= 3:
                await self.disconnect(connection_id)
                self._circuit_breakers[connection_id].record_failure()
            
            logger.error(f"Read error on connection {connection_id}: {e}")
            return None
    
    async def write_register(
        self,
        connection_id: int,
        address: int,
        value: int,
        slave_id: Optional[int] = None,
    ) -> bool:
        """Write a value to a Modbus register."""
        if connection_id not in self._clients:
            if not await self.connect(connection_id):
                return False
        
        client = self._clients.get(connection_id)
        conn = self._connections.get(connection_id)
        
        if not client or not conn:
            return False
        
        try:
            slave = slave_id or conn.slave_id
            result = await client.write_register(address, value, slave=slave)
            
            if result.isError():
                raise Exception(f"Write error: {result}")
            
            return True
            
        except Exception as e:
            logger.error(f"Write error on connection {connection_id}: {e}")
            return False
    
    async def poll_device(
        self,
        connection_id: int,
        mappings: List[RegisterMapping],
    ) -> Dict[str, Any]:
        """Poll all registers from a device."""
        results = {}
        
        for mapping in mappings:
            value = await self.read_registers(connection_id, mapping)
            if value is not None:
                results[mapping.name] = {
                    "value": value,
                    "unit": mapping.unit,
                    "timestamp": datetime.utcnow().isoformat(),
                }
        
        return results
    
    async def test_connection(self, connection_id: int) -> Dict[str, Any]:
        """Test a Modbus connection."""
        start = datetime.utcnow()
        success = await self.connect(connection_id)
        elapsed = (datetime.utcnow() - start).total_seconds() * 1000
        
        conn = self._connections.get(connection_id)
        
        return {
            "connection_id": connection_id,
            "success": success,
            "latency_ms": round(elapsed, 2),
            "error": conn.last_error if conn and not success else None,
        }
    
    def get_status(self) -> Dict[str, Any]:
        """Get connection manager status."""
        connections_status = []
        for conn_id, conn in self._connections.items():
            breaker = self._circuit_breakers.get(conn_id)
            connections_status.append({
                "id": conn_id,
                "host": conn.host,
                "port": conn.port,
                "protocol": conn.protocol.value,
                "connected": conn.is_connected,
                "last_poll": conn.last_poll.isoformat() if conn.last_poll else None,
                "error_count": conn.error_count,
                "circuit_breaker": breaker.state if breaker else "unknown",
            })
        
        return {
            "max_connections": self.max_connections,
            "active_connections": self._stats["active_connections"],
            "connections": connections_status,
            "stats": self._stats.copy(),
        }


modbus_manager = ModbusConnectionManager()


async def get_modbus_manager() -> ModbusConnectionManager:
    """Get the Modbus connection manager instance."""
    return modbus_manager
