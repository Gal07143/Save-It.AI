"""General hashing utilities.

This module provides consistent hashing functions for non-password use cases
such as checksums, API key hashing, and HMAC verification.
"""

import hashlib
import hmac
from typing import Union


def hash_string(value: str, algorithm: str = "sha256") -> str:
    """Hash a string value.

    Args:
        value: The string to hash.
        algorithm: The hash algorithm to use (default: sha256).

    Returns:
        The hex digest of the hash.
    """
    hasher = hashlib.new(algorithm)
    hasher.update(value.encode('utf-8'))
    return hasher.hexdigest()


def hash_bytes(data: bytes, algorithm: str = "sha256") -> str:
    """Hash binary data.

    Args:
        data: The bytes to hash.
        algorithm: The hash algorithm to use (default: sha256).

    Returns:
        The hex digest of the hash.
    """
    hasher = hashlib.new(algorithm)
    hasher.update(data)
    return hasher.hexdigest()


def verify_hmac(
    message: Union[str, bytes],
    signature: str,
    secret: Union[str, bytes],
    algorithm: str = "sha256"
) -> bool:
    """Verify an HMAC signature.

    Args:
        message: The message that was signed.
        signature: The signature to verify.
        secret: The secret key used for signing.
        algorithm: The hash algorithm used (default: sha256).

    Returns:
        True if the signature is valid, False otherwise.
    """
    if isinstance(message, str):
        message = message.encode('utf-8')
    if isinstance(secret, str):
        secret = secret.encode('utf-8')

    expected = hmac.new(secret, message, algorithm).hexdigest()
    return hmac.compare_digest(expected, signature)


def create_hmac(
    message: Union[str, bytes],
    secret: Union[str, bytes],
    algorithm: str = "sha256"
) -> str:
    """Create an HMAC signature.

    Args:
        message: The message to sign.
        secret: The secret key for signing.
        algorithm: The hash algorithm to use (default: sha256).

    Returns:
        The hex digest of the HMAC signature.
    """
    if isinstance(message, str):
        message = message.encode('utf-8')
    if isinstance(secret, str):
        secret = secret.encode('utf-8')

    return hmac.new(secret, message, algorithm).hexdigest()
