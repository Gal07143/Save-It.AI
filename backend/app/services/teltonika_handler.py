"""
Teltonika RUT200/RUT240/TRB series message handler.
Parses Teltonika's Data to Server JSON format and maps to SAVE-IT.AI schema.
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)


class TeltonikaMessageHandler:
    """
    Handles Teltonika gateway messages (RUT200, RUT240, TRB140, etc.).

    Teltonika Data to Server sends data in various formats:

    1. Modbus Data format:
    {
        "id": "device_serial",
        "ts": 1234567890,
        "slave_id": 1,
        "registers": [
            {"address": 0, "value": 1234, "type": "holding", "name": "voltage"},
            ...
        ]
    }

    2. Generic sensor/values format:
    {
        "id": "device_serial",
        "ts": 1234567890,
        "values": {
            "temperature": 25.5,
            "humidity": 60,
            ...
        }
    }

    3. I/O data format:
    {
        "id": "device_serial",
        "ts": 1234567890,
        "io": {
            "din1": 1,
            "din2": 0,
            "ain1": 512,
            ...
        }
    }

    4. GPS/Mobile data:
    {
        "id": "device_serial",
        "ts": 1234567890,
        "gps": {"lat": 54.123, "lon": 25.456, "speed": 0},
        "gsm": {"signal": -75, "operator": "Telia"}
    }
    """

    def __init__(self):
        self._data_type_converters = {
            "INT16": self._convert_int16,
            "UINT16": self._convert_uint16,
            "INT32": self._convert_int32,
            "UINT32": self._convert_uint32,
            "FLOAT32": self._convert_float32,
        }

    def parse_teltonika_message(self, payload: Dict[str, Any], gateway_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Convert Teltonika format to SAVE-IT.AI format.

        Args:
            payload: Raw JSON payload from Teltonika device
            gateway_id: Gateway ID from MQTT topic

        Returns:
            Normalized data structure for SAVE-IT.AI ingestion
        """
        result = {
            "gateway_id": gateway_id,
            "device_serial": payload.get("id") or payload.get("serial"),
            "timestamp": self._parse_timestamp(payload.get("ts")),
            "datapoints": {},
            "metadata": {},
        }

        # Parse different data sections
        if "registers" in payload:
            modbus_data = self._parse_modbus_data(payload)
            result["datapoints"].update(modbus_data.get("datapoints", {}))
            result["edge_key"] = modbus_data.get("edge_key")

        if "values" in payload:
            result["datapoints"].update(self._parse_values(payload["values"]))

        if "io" in payload:
            result["datapoints"].update(self._parse_io_data(payload["io"]))

        if "gps" in payload:
            result["metadata"]["gps"] = payload["gps"]

        if "gsm" in payload:
            result["metadata"]["gsm"] = payload["gsm"]

        # Include device info if present
        if "fw" in payload:
            result["metadata"]["firmware_version"] = payload["fw"]
        if "model" in payload:
            result["metadata"]["model"] = payload["model"]

        return result

    def _parse_modbus_data(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse Modbus register data from Teltonika.

        Teltonika Modbus Data to Server format:
        {
            "slave_id": 1,
            "registers": [
                {"address": 0, "value": 2305, "type": "holding", "name": "voltage_l1"},
                {"address": 2, "value": 2301, "type": "holding", "name": "voltage_l2"},
                ...
            ]
        }
        """
        slave_id = payload.get("slave_id", 1)
        registers = payload.get("registers", [])

        datapoints = {}
        for reg in registers:
            addr = reg.get("address")
            value = reg.get("value")
            reg_type = reg.get("type", "holding")
            name = reg.get("name")
            data_type = reg.get("data_type", "UINT16")
            scale = reg.get("scale", 1.0)
            offset = reg.get("offset", 0)

            # Apply data type conversion
            if data_type in self._data_type_converters:
                value = self._data_type_converters[data_type](value, reg.get("raw_values", [value]))

            # Apply scale and offset
            if isinstance(value, (int, float)):
                value = value * scale + offset

            # Create datapoint key
            if name:
                key = name
            else:
                key = f"mb_{slave_id}_{reg_type}_{addr}"

            datapoints[key] = value

        return {
            "edge_key": f"modbus_{slave_id}",
            "datapoints": datapoints,
        }

    def _parse_values(self, values: Dict[str, Any]) -> Dict[str, Any]:
        """Parse generic key-value sensor data."""
        datapoints = {}
        for key, value in values.items():
            # Normalize key names
            normalized_key = key.lower().replace(" ", "_").replace("-", "_")
            datapoints[normalized_key] = value
        return datapoints

    def _parse_io_data(self, io_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse I/O pin data (digital/analog inputs)."""
        datapoints = {}
        for key, value in io_data.items():
            # Prefix I/O data to distinguish from other datapoints
            datapoints[f"io_{key}"] = value
        return datapoints

    def _parse_timestamp(self, ts: Any) -> Optional[datetime]:
        """Parse timestamp from Teltonika format."""
        if ts is None:
            return datetime.utcnow()

        if isinstance(ts, (int, float)):
            # Unix timestamp
            if ts > 1e12:  # Milliseconds
                ts = ts / 1000
            return datetime.utcfromtimestamp(ts)

        if isinstance(ts, str):
            # ISO format string
            try:
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                pass

        return datetime.utcnow()

    def _convert_int16(self, value: int, raw_values: List[int]) -> int:
        """Convert to signed 16-bit integer."""
        if value > 32767:
            return value - 65536
        return value

    def _convert_uint16(self, value: int, raw_values: List[int]) -> int:
        """Convert to unsigned 16-bit integer (no conversion needed)."""
        return value

    def _convert_int32(self, value: int, raw_values: List[int]) -> int:
        """Convert two registers to signed 32-bit integer."""
        if len(raw_values) >= 2:
            combined = (raw_values[0] << 16) | raw_values[1]
            if combined > 2147483647:
                return combined - 4294967296
            return combined
        return value

    def _convert_uint32(self, value: int, raw_values: List[int]) -> int:
        """Convert two registers to unsigned 32-bit integer."""
        if len(raw_values) >= 2:
            return (raw_values[0] << 16) | raw_values[1]
        return value

    def _convert_float32(self, value: int, raw_values: List[int]) -> float:
        """Convert two registers to 32-bit float."""
        import struct
        if len(raw_values) >= 2:
            # Combine registers and convert to float
            combined = (raw_values[0] << 16) | raw_values[1]
            try:
                return struct.unpack('>f', struct.pack('>I', combined))[0]
            except struct.error:
                pass
        return float(value)

    def create_heartbeat_response(self, gateway_id: int) -> Dict[str, Any]:
        """Create a heartbeat acknowledgment message."""
        return {
            "type": "heartbeat_ack",
            "gateway_id": gateway_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "ok"
        }

    def create_config_message(
        self,
        gateway_id: int,
        modbus_devices: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Create a Modbus configuration message for the gateway.

        This can be published to the gateway's command topic to configure
        Modbus polling. Note: Teltonika devices typically require manual
        configuration via their web UI, but this can be used for custom
        firmware or future API support.
        """
        return {
            "type": "config",
            "gateway_id": gateway_id,
            "timestamp": datetime.utcnow().isoformat(),
            "modbus": {
                "devices": modbus_devices
            }
        }


# Singleton instance
teltonika_handler = TeltonikaMessageHandler()


def get_teltonika_handler() -> TeltonikaMessageHandler:
    """Get the Teltonika handler instance."""
    return teltonika_handler
