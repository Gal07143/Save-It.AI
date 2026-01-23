"""Password hashing utilities using bcrypt.

This module centralizes password hashing to ensure consistent and secure
password storage across the application. Always use bcrypt for user passwords.
"""

import bcrypt


def hash_password(password: str) -> str:
    """Hash a password using bcrypt.

    Args:
        password: The plain text password to hash.

    Returns:
        The bcrypt hash as a string.
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash.

    Args:
        plain_password: The plain text password to verify.
        hashed_password: The bcrypt hash to verify against.

    Returns:
        True if the password matches, False otherwise.
    """
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
