"""Hydrate credential store from environment variables."""

from __future__ import annotations


from . import Role


def _parse_role_account(env_key: str) -> tuple[Role, str]:
    token = env_key.removesuffix("_PASSWORD_HASH")  # strip suffix
    if "__" in token:
        role_token, account_token = token.split("__", 1)
    else:
        role_token, account_token = token, token
    role_value = role_token.lower()
    account = account_token.lower()
    try:
        role = Role(role_value)
    except ValueError:
        role = Role.USER
    return role, account


def hydrate() -> None:
    """Deprecated: env-based credential hydration is removed.

    Historically this populated an in-memory credential store from
    environment variables (`*_PASSWORD_HASH`) when AUTH_BACKEND=env was used.
    The project has migrated to DB-backed authentication and environment-based
    hydration is no longer supported. This function is now a no-op kept for
    compatibility with older startup sequences.
    """
    try:
        import logging

        logging.getLogger(__name__).info(
            "Auth env-based hydration is disabled — environment-based auth is deprecated"
        )
    except Exception:
        pass
