"""Authentication utilities and role definitions."""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "admin"
    EDITOR = "editor"
    USER = "user"


ROLE_ORDER = [Role.ADMIN, Role.EDITOR, Role.USER]
