"""Role-based access control decorators."""

from __future__ import annotations

from functools import wraps
from typing import Callable, TypeVar

from flask import abort, current_app, g, request

from . import ROLE_ORDER, Role

F = TypeVar("F", bound=Callable[..., object])


def require_role(min_role: Role) -> Callable[[F], F]:
    """Ensure the current user has at least the given role."""

    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            role = getattr(g, "role", None)
            user_id = getattr(g, "user_id", None)
            
            # DEBUG: Log role-based 401s for quiz-admin routes
            if current_app.debug and request.path.startswith("/quiz-admin/api/"):
                if role not in ROLE_ORDER:
                    current_app.logger.warning(
                        "[401 Role Debug] Invalid role on %s %s | "
                        "user_id=%s | role=%s | required=%s",
                        request.method,
                        request.path,
                        user_id,
                        role,
                        min_role
                    )
                elif ROLE_ORDER.index(role) > ROLE_ORDER.index(min_role):
                    current_app.logger.warning(
                        "[403 Role Debug] Insufficient permissions on %s %s | "
                        "user_id=%s | role=%s | required=%s",
                        request.method,
                        request.path,
                        user_id,
                        role,
                        min_role
                    )
            
            if role not in ROLE_ORDER:
                abort(401)
            if ROLE_ORDER.index(role) > ROLE_ORDER.index(min_role):
                abort(403)
            return func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator
