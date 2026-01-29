"""Quiz configuration helpers."""

from __future__ import annotations

import os
from typing import Final

from flask import current_app

QUIZ_MECHANICS_VERSION_ENV: Final[str] = "QUIZ_MECHANICS_VERSION"
QUIZ_MECHANICS_ALLOWED: Final[set[str]] = {"v1", "v2"}


def get_quiz_mechanics_version() -> str:
    """Return validated quiz mechanics version.

    Sources:
    - Flask config: QUIZ_MECHANICS_VERSION
    - Environment: QUIZ_MECHANICS_VERSION

    Falls back to "v1" on missing/invalid values.
    """
    value = None

    try:
        if current_app:
            value = current_app.config.get("QUIZ_MECHANICS_VERSION")
    except Exception:
        value = None

    if not value:
        value = os.getenv(QUIZ_MECHANICS_VERSION_ENV, "v1")

    if not isinstance(value, str):
        value = str(value)

    value = value.strip().lower()

    if value not in QUIZ_MECHANICS_ALLOWED:
        return "v1"

    return value
