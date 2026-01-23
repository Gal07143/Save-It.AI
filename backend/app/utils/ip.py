"""IP address utilities.

This module centralizes client IP extraction to ensure consistent handling
across middleware and routers.
"""

from fastapi import Request


def get_client_ip(request: Request) -> str:
    """Extract the client IP address from a request.

    Handles proxied requests by checking X-Forwarded-For header first,
    then falls back to X-Real-IP, and finally the direct client host.

    Args:
        request: The FastAPI request object.

    Returns:
        The client IP address as a string.
    """
    # Check X-Forwarded-For header (set by reverse proxies)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs; the first is the client
        return forwarded_for.split(",")[0].strip()

    # Check X-Real-IP header (alternative proxy header)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fall back to direct client host
    if request.client:
        return request.client.host

    return "unknown"
