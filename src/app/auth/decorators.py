"""Role-based access control decorators."""

from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar

from flask import abort, g

from . import ROLE_ORDER, Role

F = TypeVar("F", bound=Callable[..., object])


def require_role(min_role: Role) -> Callable[[F], F]:
    """Ensure the current user has at least the given role."""

    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            role = getattr(g, "role", None)
            if role not in ROLE_ORDER:
                abort(401)
            if ROLE_ORDER.index(role) > ROLE_ORDER.index(min_role):
                abort(403)
            return func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator
