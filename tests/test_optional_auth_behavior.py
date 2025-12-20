import pytest


@pytest.mark.skip(
    reason="Legacy test - CREDENTIALS dict removed, auth is now DB-backed. See test_role_access.py for current auth tests."
)
def test_login_and_optional_auth_routes_set_g_user():
    """Legacy test that was testing in-memory CREDENTIALS dict.

    This functionality has been migrated to DB-backed auth.
    See test_role_access.py for current auth tests.
    """
    # This test is skipped - the auth_routes.CREDENTIALS pattern is obsolete
    # Auth is now handled via database-backed users in src.app.auth.services
    pass
