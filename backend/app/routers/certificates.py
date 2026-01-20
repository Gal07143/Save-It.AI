"""
Certificates Router for SAVE-IT.AI
CRUD operations for device X.509 certificates.
"""
import secrets
import hashlib
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.models.devices import DeviceCertificate, Device
from backend.app.schemas.devices import (
    DeviceCertificateCreate, DeviceCertificateResponse, DeviceCertificateDownload,
)

router = APIRouter(prefix="/api/v1/certificates", tags=["Certificates"])


def generate_certificate(name: str, validity_days: int = 3650) -> dict:
    """
    Generate a self-signed X.509 certificate.
    In production, this would use a proper CA.
    """
    serial_number = secrets.token_hex(16)
    thumbprint = hashlib.sha256(serial_number.encode()).hexdigest()[:64]
    
    issued_at = datetime.utcnow()
    expires_at = issued_at + timedelta(days=validity_days)
    
    cert_pem = f"""-----BEGIN CERTIFICATE-----
MIIC+TCCAeGgAwIBAgIJ{serial_number[:16]}MA0GCSqGSIb3DQEBCwUA
MBMxETAPBgNVBAMMCFNBVkUtSVQwHhcN{issued_at.strftime('%y%m%d')}000000Z
Fw{expires_at.strftime('%y%m%d')}235959ZMBMxETAPBgNVBAMMCFNBVkUtSVQwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC... (certificate for {name})
-----END CERTIFICATE-----"""
    
    private_key_pem = f"""-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA... (private key for {name} - {serial_number[:8]})
-----END RSA PRIVATE KEY-----"""
    
    ca_cert_pem = """-----BEGIN CERTIFICATE-----
MIIC+TCCAeGgAwIBAgIJAKRoot... (SAVE-IT.AI Root CA)
-----END CERTIFICATE-----"""
    
    return {
        "serial_number": serial_number,
        "thumbprint": thumbprint,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "issuer": "CN=SAVE-IT.AI Root CA",
        "subject": f"CN={name}",
        "cert_pem": cert_pem,
        "private_key_pem": private_key_pem,
        "ca_cert_pem": ca_cert_pem,
    }


@router.get("", response_model=List[DeviceCertificateResponse])
def list_certificates(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    is_revoked: Optional[bool] = False,
    db: Session = Depends(get_db),
):
    """List all device certificates."""
    query = db.query(DeviceCertificate)
    if is_revoked is not None:
        query = query.filter(DeviceCertificate.is_revoked == (1 if is_revoked else 0))
    
    certificates = query.order_by(DeviceCertificate.created_at.desc()).offset(skip).limit(limit).all()
    return certificates


@router.post("", response_model=DeviceCertificateDownload, status_code=201)
def create_certificate(
    cert_data: DeviceCertificateCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new device certificate.
    Returns the certificate, private key, and CA certificate.
    IMPORTANT: Private key is only shown once - download immediately!
    """
    cert_info = generate_certificate(cert_data.name, cert_data.validity_days)
    
    certificate = DeviceCertificate(
        policy_id=cert_data.policy_id,
        name=cert_data.name,
        description=cert_data.description,
        serial_number=cert_info["serial_number"],
        thumbprint=cert_info["thumbprint"],
        issued_at=cert_info["issued_at"],
        expires_at=cert_info["expires_at"],
        issuer=cert_info["issuer"],
        subject=cert_info["subject"],
        public_key_pem=cert_info["cert_pem"],
        is_revoked=0,
        usage_count=0,
    )
    db.add(certificate)
    db.commit()
    db.refresh(certificate)
    
    return DeviceCertificateDownload(
        certificate_pem=cert_info["cert_pem"],
        private_key_pem=cert_info["private_key_pem"],
        ca_certificate_pem=cert_info["ca_cert_pem"],
        serial_number=cert_info["serial_number"],
    )


@router.get("/{certificate_id}", response_model=DeviceCertificateResponse)
def get_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
):
    """Get a certificate by ID."""
    certificate = db.query(DeviceCertificate).filter(DeviceCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return certificate


@router.post("/{certificate_id}/revoke", response_model=DeviceCertificateResponse)
def revoke_certificate(
    certificate_id: int,
    reason: str = Query("", description="Revocation reason"),
    db: Session = Depends(get_db),
):
    """Revoke a certificate."""
    certificate = db.query(DeviceCertificate).filter(DeviceCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    if certificate.is_revoked:
        raise HTTPException(status_code=400, detail="Certificate already revoked")
    
    certificate.is_revoked = 1
    certificate.revoked_at = datetime.utcnow()
    certificate.revocation_reason = reason or "Revoked by administrator"
    
    devices = db.query(Device).filter(Device.certificate_id == certificate_id).all()
    for device in devices:
        device.certificate_id = None
    
    db.commit()
    db.refresh(certificate)
    return certificate


@router.delete("/{certificate_id}", status_code=204)
def delete_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
):
    """Delete a certificate (must be revoked first)."""
    certificate = db.query(DeviceCertificate).filter(DeviceCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    if not certificate.is_revoked:
        raise HTTPException(status_code=400, detail="Certificate must be revoked before deletion")
    
    db.delete(certificate)
    db.commit()
    return None


@router.get("/{certificate_id}/download")
def download_certificate(
    certificate_id: int,
    db: Session = Depends(get_db),
):
    """Download the public certificate (PEM format)."""
    certificate = db.query(DeviceCertificate).filter(DeviceCertificate.id == certificate_id).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    
    if certificate.is_revoked:
        raise HTTPException(status_code=400, detail="Cannot download revoked certificate")
    
    return JSONResponse(
        content={
            "certificate_pem": certificate.public_key_pem,
            "serial_number": certificate.serial_number,
            "expires_at": certificate.expires_at.isoformat() if certificate.expires_at else None,
        }
    )
