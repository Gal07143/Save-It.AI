"""
Certificate Service for SAVE-IT.AI
X.509 certificate management for device authentication:
- Generate device certificates
- Sign with CA
- Revocation
- Rotation
"""
import os
import logging
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from dataclasses import dataclass

from sqlalchemy.orm import Session

from backend.app.models.devices import Device, DeviceCertificate

logger = logging.getLogger(__name__)

# Try to import cryptography, but allow graceful fallback
try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa, ec
    from cryptography.hazmat.backends import default_backend
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logger.warning("cryptography package not available - certificate generation disabled")


@dataclass
class CertificateBundle:
    """Generated certificate bundle."""
    certificate_pem: str
    private_key_pem: str
    ca_certificate_pem: str
    serial_number: str
    thumbprint: str
    expires_at: datetime


@dataclass
class ValidationResult:
    """Certificate validation result."""
    valid: bool
    message: str
    subject: Optional[str] = None
    issuer: Optional[str] = None
    expires_at: Optional[datetime] = None
    is_revoked: bool = False


class CertificateService:
    """
    X.509 certificate management for device authentication.
    Generates, validates, and manages device certificates.
    """

    def __init__(self, db: Session, ca_cert_path: Optional[str] = None, ca_key_path: Optional[str] = None):
        self.db = db
        self.ca_cert_path = ca_cert_path or os.environ.get("CA_CERT_PATH")
        self.ca_key_path = ca_key_path or os.environ.get("CA_KEY_PATH")
        self._ca_cert = None
        self._ca_key = None

        if CRYPTO_AVAILABLE and self.ca_cert_path and self.ca_key_path:
            self._load_ca()

    def _load_ca(self):
        """Load CA certificate and key."""
        try:
            if os.path.exists(self.ca_cert_path):
                with open(self.ca_cert_path, "rb") as f:
                    self._ca_cert = x509.load_pem_x509_certificate(f.read(), default_backend())

            if os.path.exists(self.ca_key_path):
                with open(self.ca_key_path, "rb") as f:
                    self._ca_key = serialization.load_pem_private_key(
                        f.read(),
                        password=os.environ.get("CA_KEY_PASSWORD", "").encode() or None,
                        backend=default_backend()
                    )
            logger.info("CA certificate and key loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load CA: {e}")

    def generate_certificate(
        self,
        device_id: int,
        validity_days: int = 365,
        key_type: str = "rsa"
    ) -> Optional[CertificateBundle]:
        """
        Generate new certificate for device.

        Args:
            device_id: Device ID
            validity_days: Certificate validity period
            key_type: Key type (rsa or ec)

        Returns:
            CertificateBundle with certificate and keys
        """
        if not CRYPTO_AVAILABLE:
            logger.error("cryptography package required for certificate generation")
            return None

        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            logger.error(f"Device {device_id} not found")
            return None

        # Generate key pair
        if key_type == "ec":
            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        else:
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
                backend=default_backend()
            )

        # Build certificate
        subject = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "California"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Save-It.AI"),
            x509.NameAttribute(NameOID.COMMON_NAME, f"device-{device_id}"),
        ])

        now = datetime.utcnow()
        expires = now + timedelta(days=validity_days)

        # Generate serial number
        serial = x509.random_serial_number()

        builder = x509.CertificateBuilder()
        builder = builder.subject_name(subject)
        builder = builder.public_key(private_key.public_key())
        builder = builder.serial_number(serial)
        builder = builder.not_valid_before(now)
        builder = builder.not_valid_after(expires)

        # Add extensions
        builder = builder.add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True
        )
        builder = builder.add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=False,
                crl_sign=False,
                encipher_only=False,
                decipher_only=False
            ),
            critical=True
        )
        builder = builder.add_extension(
            x509.ExtendedKeyUsage([
                x509.oid.ExtendedKeyUsageOID.CLIENT_AUTH
            ]),
            critical=False
        )

        # Sign with CA or self-sign
        if self._ca_cert and self._ca_key:
            builder = builder.issuer_name(self._ca_cert.subject)
            certificate = builder.sign(self._ca_key, hashes.SHA256(), default_backend())
            ca_pem = self._ca_cert.public_bytes(serialization.Encoding.PEM).decode()
        else:
            builder = builder.issuer_name(subject)
            certificate = builder.sign(private_key, hashes.SHA256(), default_backend())
            ca_pem = ""

        # Serialize
        cert_pem = certificate.public_bytes(serialization.Encoding.PEM).decode()
        key_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode()

        # Calculate thumbprint
        thumbprint = hashlib.sha256(
            certificate.public_bytes(serialization.Encoding.DER)
        ).hexdigest()

        # Store in database
        db_cert = DeviceCertificate(
            name=f"Device {device_id} Certificate",
            serial_number=format(serial, 'x'),
            thumbprint=thumbprint,
            issued_at=now,
            expires_at=expires,
            issuer=self._ca_cert.subject.rfc4514_string() if self._ca_cert else subject.rfc4514_string(),
            subject=subject.rfc4514_string(),
            public_key_pem=certificate.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode()
        )
        self.db.add(db_cert)
        self.db.flush()

        # Link to device
        device.certificate_id = db_cert.id

        logger.info(f"Generated certificate for device {device_id}, expires {expires}")

        return CertificateBundle(
            certificate_pem=cert_pem,
            private_key_pem=key_pem,
            ca_certificate_pem=ca_pem,
            serial_number=format(serial, 'x'),
            thumbprint=thumbprint,
            expires_at=expires
        )

    def revoke(self, certificate_id: int, reason: str) -> bool:
        """
        Revoke a certificate.

        Args:
            certificate_id: Certificate ID
            reason: Revocation reason

        Returns:
            True if revoked successfully
        """
        cert = self.db.query(DeviceCertificate).filter(
            DeviceCertificate.id == certificate_id
        ).first()

        if not cert:
            return False

        if cert.is_revoked:
            logger.warning(f"Certificate {certificate_id} already revoked")
            return True

        cert.is_revoked = 1
        cert.revoked_at = datetime.utcnow()
        cert.revocation_reason = reason

        # Unlink from any devices
        self.db.query(Device).filter(
            Device.certificate_id == certificate_id
        ).update({"certificate_id": None})

        logger.info(f"Certificate {certificate_id} revoked: {reason}")
        return True

    def validate(self, cert_pem: str) -> ValidationResult:
        """
        Validate a certificate against CA.

        Args:
            cert_pem: PEM-encoded certificate

        Returns:
            ValidationResult with validation status
        """
        if not CRYPTO_AVAILABLE:
            return ValidationResult(
                valid=False,
                message="cryptography package not available"
            )

        try:
            cert = x509.load_pem_x509_certificate(cert_pem.encode(), default_backend())

            # Check expiration
            now = datetime.utcnow()
            if cert.not_valid_after < now:
                return ValidationResult(
                    valid=False,
                    message="Certificate expired",
                    subject=cert.subject.rfc4514_string(),
                    issuer=cert.issuer.rfc4514_string(),
                    expires_at=cert.not_valid_after
                )

            if cert.not_valid_before > now:
                return ValidationResult(
                    valid=False,
                    message="Certificate not yet valid",
                    subject=cert.subject.rfc4514_string(),
                    issuer=cert.issuer.rfc4514_string(),
                    expires_at=cert.not_valid_after
                )

            # Calculate thumbprint
            thumbprint = hashlib.sha256(
                cert.public_bytes(serialization.Encoding.DER)
            ).hexdigest()

            # Check if revoked in database
            db_cert = self.db.query(DeviceCertificate).filter(
                DeviceCertificate.thumbprint == thumbprint
            ).first()

            if db_cert and db_cert.is_revoked:
                return ValidationResult(
                    valid=False,
                    message="Certificate has been revoked",
                    subject=cert.subject.rfc4514_string(),
                    issuer=cert.issuer.rfc4514_string(),
                    expires_at=cert.not_valid_after,
                    is_revoked=True
                )

            # Verify signature if CA available
            if self._ca_cert:
                try:
                    self._ca_cert.public_key().verify(
                        cert.signature,
                        cert.tbs_certificate_bytes,
                        cert.signature_algorithm_parameters
                    )
                except Exception:
                    return ValidationResult(
                        valid=False,
                        message="Certificate signature verification failed",
                        subject=cert.subject.rfc4514_string(),
                        issuer=cert.issuer.rfc4514_string(),
                        expires_at=cert.not_valid_after
                    )

            # Update usage tracking
            if db_cert:
                db_cert.last_used_at = datetime.utcnow()
                db_cert.usage_count = (db_cert.usage_count or 0) + 1

            return ValidationResult(
                valid=True,
                message="Certificate is valid",
                subject=cert.subject.rfc4514_string(),
                issuer=cert.issuer.rfc4514_string(),
                expires_at=cert.not_valid_after
            )

        except Exception as e:
            return ValidationResult(
                valid=False,
                message=f"Certificate parsing error: {str(e)}"
            )

    def rotate(self, device_id: int) -> Optional[CertificateBundle]:
        """
        Rotate device certificate (generate new, revoke old).

        Args:
            device_id: Device ID

        Returns:
            New CertificateBundle
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return None

        # Revoke old certificate if exists
        if device.certificate_id:
            self.revoke(device.certificate_id, "Certificate rotation")

        # Generate new certificate
        return self.generate_certificate(device_id)

    def get_ca_cert(self) -> str:
        """
        Get CA certificate for client distribution.

        Returns:
            PEM-encoded CA certificate
        """
        if self._ca_cert:
            return self._ca_cert.public_bytes(serialization.Encoding.PEM).decode()
        return ""

    def check_expiring(self, days_threshold: int = 30) -> List[DeviceCertificate]:
        """
        Find certificates expiring soon.

        Args:
            days_threshold: Days until expiration

        Returns:
            List of expiring certificates
        """
        cutoff = datetime.utcnow() + timedelta(days=days_threshold)

        return self.db.query(DeviceCertificate).filter(
            DeviceCertificate.expires_at <= cutoff,
            DeviceCertificate.is_revoked == 0
        ).all()

    def get_device_certificate(self, device_id: int) -> Optional[DeviceCertificate]:
        """
        Get certificate for a device.

        Args:
            device_id: Device ID

        Returns:
            DeviceCertificate or None
        """
        device = self.db.query(Device).filter(Device.id == device_id).first()
        if not device or not device.certificate_id:
            return None

        return self.db.query(DeviceCertificate).filter(
            DeviceCertificate.id == device.certificate_id
        ).first()

    def list_certificates(
        self,
        include_revoked: bool = False,
        limit: int = 100
    ) -> List[DeviceCertificate]:
        """
        List all certificates.

        Args:
            include_revoked: Include revoked certificates
            limit: Max results

        Returns:
            List of certificates
        """
        query = self.db.query(DeviceCertificate)

        if not include_revoked:
            query = query.filter(DeviceCertificate.is_revoked == 0)

        return query.order_by(DeviceCertificate.expires_at).limit(limit).all()


def get_certificate_service(db: Session) -> CertificateService:
    """Get CertificateService instance."""
    return CertificateService(db)
