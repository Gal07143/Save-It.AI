"""
Device Discovery Service for SAVE-IT.AI
Auto-discover devices on the network:
- Network scanning
- Modbus device probing
- Device identification
- Template matching
"""
import asyncio
import logging
import socket
import struct
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.devices import Device, DeviceType
from app.models.integrations import DeviceTemplate

logger = logging.getLogger(__name__)


@dataclass
class DiscoveredDevice:
    """Information about a discovered device."""
    host: str
    port: int
    slave_id: Optional[int] = None
    device_type: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    protocol: str = "modbus_tcp"
    discovered_at: datetime = None
    response_time_ms: Optional[float] = None
    matched_template_id: Optional[int] = None

    def __post_init__(self):
        if self.discovered_at is None:
            self.discovered_at = datetime.utcnow()


@dataclass
class DeviceProbe:
    """Result of probing a specific device."""
    host: str
    port: int
    slave_id: int
    reachable: bool
    response_time_ms: Optional[float] = None
    error: Optional[str] = None
    registers_read: Dict[int, int] = None


@dataclass
class DeviceIdentification:
    """Device identification information read from registers."""
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    firmware_version: Optional[str] = None
    device_type: Optional[str] = None
    additional_info: Dict[str, Any] = None


class DiscoveryService:
    """
    Auto-discover devices on the network.
    Scans for Modbus TCP devices and identifies them.
    """

    # Common identification registers (Modbus device info registers)
    IDENTIFICATION_REGISTERS = {
        # Standard Modbus device identification (MEI)
        "mei": True,
        # Common vendor-specific registers
        "vendor_registers": [
            (0, 2),     # Often manufacturer ID
            (2, 2),     # Often product code
            (4, 2),     # Often revision
            (100, 10),  # Sometimes serial number
        ]
    }

    def __init__(self, db: Session, timeout: float = 2.0):
        self.db = db
        self.timeout = timeout

    async def scan_network(
        self,
        ip_range: str,
        ports: List[int] = None,
        slave_ids: List[int] = None
    ) -> List[DiscoveredDevice]:
        """
        Scan IP range for Modbus devices.

        Args:
            ip_range: IP range (e.g., "192.168.1.1-254" or "192.168.1.0/24")
            ports: Ports to scan (default: [502])
            slave_ids: Slave IDs to try (default: [1])

        Returns:
            List of discovered devices
        """
        ports = ports or [502]
        slave_ids = slave_ids or [1]

        # Parse IP range
        ips = self._parse_ip_range(ip_range)

        discovered = []
        tasks = []

        for ip in ips:
            for port in ports:
                tasks.append(self._scan_host(ip, port, slave_ids))

        # Run scans concurrently with some limit
        semaphore = asyncio.Semaphore(50)  # Max 50 concurrent scans

        async def limited_scan(task):
            async with semaphore:
                return await task

        results = await asyncio.gather(
            *[limited_scan(t) for t in tasks],
            return_exceptions=True
        )

        for result in results:
            if isinstance(result, DiscoveredDevice):
                discovered.append(result)
            elif isinstance(result, list):
                discovered.extend(result)

        logger.info(f"Network scan complete: found {len(discovered)} devices")

        return discovered

    async def _scan_host(
        self,
        host: str,
        port: int,
        slave_ids: List[int]
    ) -> List[DiscoveredDevice]:
        """Scan a single host for Modbus devices."""
        discovered = []

        for slave_id in slave_ids:
            try:
                result = await self.probe_device(host, port, [slave_id])
                if result.reachable:
                    device = DiscoveredDevice(
                        host=host,
                        port=port,
                        slave_id=slave_id,
                        response_time_ms=result.response_time_ms
                    )

                    # Try to identify
                    try:
                        ident = await self.identify(host, port, slave_id)
                        device.manufacturer = ident.manufacturer
                        device.model = ident.model
                        device.serial_number = ident.serial_number
                        device.firmware_version = ident.firmware_version
                        device.device_type = ident.device_type
                    except Exception as e:
                        logger.debug(f"Could not identify {host}:{port}/{slave_id}: {e}")

                    discovered.append(device)

            except Exception as e:
                logger.debug(f"Error scanning {host}:{port}/{slave_id}: {e}")

        return discovered

    async def probe_device(
        self,
        host: str,
        port: int,
        slave_ids: List[int]
    ) -> DeviceProbe:
        """
        Probe a specific device.

        Args:
            host: Device IP address
            port: Modbus port
            slave_ids: Slave IDs to try

        Returns:
            DeviceProbe with results
        """
        for slave_id in slave_ids:
            try:
                start_time = datetime.utcnow()

                # Try to read a holding register (address 0)
                response = await self._read_register(host, port, slave_id, 0, 1)

                elapsed = (datetime.utcnow() - start_time).total_seconds() * 1000

                if response is not None:
                    return DeviceProbe(
                        host=host,
                        port=port,
                        slave_id=slave_id,
                        reachable=True,
                        response_time_ms=elapsed,
                        registers_read={0: response}
                    )

            except Exception as e:
                logger.debug(f"Probe failed for {host}:{port}/{slave_id}: {e}")

        return DeviceProbe(
            host=host,
            port=port,
            slave_id=slave_ids[0] if slave_ids else 1,
            reachable=False,
            error="No response from device"
        )

    async def identify(
        self,
        host: str,
        port: int,
        slave_id: int
    ) -> DeviceIdentification:
        """
        Try to identify device type by reading specific registers.

        Args:
            host: Device IP
            port: Port
            slave_id: Slave ID

        Returns:
            DeviceIdentification with discovered info
        """
        ident = DeviceIdentification(additional_info={})

        # Try MEI (Modbus Encapsulated Interface) device identification
        try:
            mei_data = await self._read_mei_device_id(host, port, slave_id)
            if mei_data:
                ident.manufacturer = mei_data.get("vendor_name")
                ident.model = mei_data.get("product_code")
                ident.firmware_version = mei_data.get("revision")
                ident.additional_info["mei"] = mei_data
        except Exception as e:
            logger.debug(f"MEI identification failed: {e}")

        # Try reading common registers
        for addr, count in self.IDENTIFICATION_REGISTERS["vendor_registers"]:
            try:
                value = await self._read_register(host, port, slave_id, addr, count)
                if value is not None:
                    ident.additional_info[f"reg_{addr}"] = value
            except Exception:
                pass

        return ident

    def match_template(
        self,
        device_info: DeviceIdentification
    ) -> Optional[DeviceTemplate]:
        """
        Match discovered device to a template.

        Args:
            device_info: Device identification info

        Returns:
            Matching DeviceTemplate or None
        """
        if not device_info.manufacturer and not device_info.model:
            return None

        # Query templates matching manufacturer/model
        query = self.db.query(DeviceTemplate).filter(
            DeviceTemplate.is_active == 1
        )

        if device_info.manufacturer:
            query = query.filter(
                DeviceTemplate.manufacturer.ilike(f"%{device_info.manufacturer}%")
            )

        if device_info.model:
            query = query.filter(
                DeviceTemplate.model.ilike(f"%{device_info.model}%")
            )

        return query.first()

    async def auto_provision(
        self,
        discovered: DiscoveredDevice,
        site_id: int,
        gateway_id: Optional[int] = None
    ) -> Device:
        """
        Automatically provision a discovered device.

        Args:
            discovered: Discovered device info
            site_id: Site to add device to
            gateway_id: Optional gateway ID

        Returns:
            Created Device
        """
        # Match template if possible
        template = None
        if discovered.manufacturer or discovered.model:
            ident = DeviceIdentification(
                manufacturer=discovered.manufacturer,
                model=discovered.model
            )
            template = self.match_template(ident)

        # Create device
        device = Device(
            site_id=site_id,
            gateway_id=gateway_id,
            name=f"{discovered.manufacturer or 'Unknown'} {discovered.model or discovered.host}",
            device_type=DeviceType.PERIPHERAL if gateway_id else DeviceType.SMART_SENSOR,
            ip_address=discovered.host,
            port=discovered.port,
            slave_id=discovered.slave_id,
            firmware_version=discovered.firmware_version,
            serial_number=discovered.serial_number,
            is_active=1,
            is_online=1,
            last_seen_at=datetime.utcnow()
        )

        if template:
            device.model_id = template.model_id if hasattr(template, 'model_id') else None
            discovered.matched_template_id = template.id

        self.db.add(device)
        self.db.flush()

        logger.info(f"Auto-provisioned device {device.id} from discovery at {discovered.host}")

        return device

    async def _read_register(
        self,
        host: str,
        port: int,
        slave_id: int,
        address: int,
        count: int
    ) -> Optional[int]:
        """Read Modbus holding register(s)."""
        try:
            # Build Modbus TCP request
            transaction_id = 1
            protocol_id = 0
            unit_id = slave_id
            function_code = 3  # Read Holding Registers

            # PDU: function code (1) + start address (2) + quantity (2)
            pdu = struct.pack(">BHH", function_code, address, count)
            length = len(pdu) + 1  # +1 for unit ID

            # MBAP header + PDU
            request = struct.pack(
                ">HHHB",
                transaction_id,
                protocol_id,
                length,
                unit_id
            ) + pdu

            # Send request
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=self.timeout
            )

            try:
                writer.write(request)
                await writer.drain()

                # Read response
                response = await asyncio.wait_for(
                    reader.read(256),
                    timeout=self.timeout
                )

                if len(response) >= 9:
                    # Parse MBAP header
                    resp_transaction, resp_protocol, resp_length, resp_unit = struct.unpack(
                        ">HHHB", response[:7]
                    )

                    # Check for exception
                    resp_function = response[7]
                    if resp_function & 0x80:
                        return None

                    # Parse response data
                    byte_count = response[8]
                    if byte_count >= 2:
                        value = struct.unpack(">H", response[9:11])[0]
                        return value

            finally:
                writer.close()
                await writer.wait_closed()

        except Exception as e:
            logger.debug(f"Register read failed: {e}")

        return None

    async def _read_mei_device_id(
        self,
        host: str,
        port: int,
        slave_id: int
    ) -> Optional[Dict[str, str]]:
        """Read device identification using MEI (function code 43)."""
        # MEI device identification is complex, simplified implementation
        # In production, would use pymodbus or similar library

        # For now, return None - actual implementation would need full MEI protocol
        return None

    def _parse_ip_range(self, ip_range: str) -> List[str]:
        """Parse IP range string to list of IPs."""
        ips = []

        if "/" in ip_range:
            # CIDR notation
            try:
                import ipaddress
                network = ipaddress.ip_network(ip_range, strict=False)
                ips = [str(ip) for ip in network.hosts()]
            except Exception as e:
                logger.error(f"Invalid CIDR notation: {e}")

        elif "-" in ip_range:
            # Range notation (e.g., "192.168.1.1-254")
            parts = ip_range.rsplit(".", 1)
            if len(parts) == 2:
                base = parts[0]
                range_part = parts[1]

                if "-" in range_part:
                    start, end = range_part.split("-")
                    try:
                        for i in range(int(start), int(end) + 1):
                            ips.append(f"{base}.{i}")
                    except ValueError:
                        pass
        else:
            # Single IP
            ips = [ip_range]

        return ips


def get_discovery_service(db: Session) -> DiscoveryService:
    """Get DiscoveryService instance."""
    return DiscoveryService(db)
