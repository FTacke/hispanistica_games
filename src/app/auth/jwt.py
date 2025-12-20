"""JWT helper functions."""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from flask import current_app
from flask_jwt_extended import create_access_token

from . import Role


def issue_token(group: str, role: Role) -> str:
    """Create a signed access token for the given principal."""
    expires = timedelta(hours=int(current_app.config.get("JWT_EXPIRY_HOURS", 3)))
    claims: dict[str, Any] = {"group": group, "role": role.value}
    return create_access_token(
        identity=group, additional_claims=claims, expires_delta=expires
    )
