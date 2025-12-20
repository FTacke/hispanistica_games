"""
Tests for login redirect logic based on user role.
"""

import pytest
from unittest.mock import MagicMock, patch


class TestLoginRedirectLogic:
    """Tests for _get_role_based_redirect and _get_login_redirect_target functions."""

    @pytest.fixture
    def mock_url_for(self):
        """Mock url_for to return predictable URLs."""
        with patch("src.app.routes.auth.url_for") as mock:
            mock.side_effect = (
                lambda endpoint, **kwargs: f"/{endpoint.replace('.', '/')}"
            )
            yield mock

    @pytest.fixture
    def mock_user(self):
        """Create a mock user object."""
        user = MagicMock()
        user.role = "user"
        user.username = "testuser"
        user.display_name = "Test User"
        return user

    def test_role_based_redirect_admin(self, mock_url_for):
        """Admin users should be redirected to user management."""
        from src.app.routes.auth import _get_role_based_redirect

        user = MagicMock()
        user.role = "admin"

        result = _get_role_based_redirect(user)
        assert "admin_users_page" in result or "admin" in result

    def test_role_based_redirect_editor(self, mock_url_for):
        """Editor users should be redirected to editor overview."""
        from src.app.routes.auth import _get_role_based_redirect

        user = MagicMock()
        user.role = "editor"

        result = _get_role_based_redirect(user)
        assert "editor" in result

    def test_role_based_redirect_user(self, mock_url_for):
        """Regular users should be redirected to atlas."""
        from src.app.routes.auth import _get_role_based_redirect

        user = MagicMock()
        user.role = "user"

        result = _get_role_based_redirect(user)
        assert "atlas" in result

    def test_login_redirect_with_next_url(self, mock_url_for, mock_user):
        """When next_url is provided (not index), redirect there."""
        from src.app.routes.auth import _get_login_redirect_target

        result = _get_login_redirect_target("/corpus/search", mock_user)
        assert result == "/corpus/search"

    def test_login_redirect_from_index_none(self, mock_url_for, mock_user):
        """When next_url is None (from index), use role-based redirect."""
        from src.app.routes.auth import _get_login_redirect_target

        mock_user.role = "admin"
        result = _get_login_redirect_target(None, mock_user)
        assert "admin" in result

    def test_login_redirect_from_index_empty(self, mock_url_for, mock_user):
        """When next_url is empty string, use role-based redirect."""
        from src.app.routes.auth import _get_login_redirect_target

        mock_user.role = "editor"
        result = _get_login_redirect_target("", mock_user)
        assert "editor" in result

    def test_login_redirect_from_index_root(self, mock_url_for, mock_user):
        """When next_url is '/', use role-based redirect."""
        from src.app.routes.auth import _get_login_redirect_target

        mock_user.role = "user"
        result = _get_login_redirect_target("/", mock_user)
        assert "atlas" in result

    def test_safe_next_rejects_login_page(self):
        """_safe_next should reject /login to prevent redirect loops."""
        from flask import Flask
        from src.app.routes.auth import _safe_next

        app = Flask(__name__)
        with app.test_request_context("/"):
            result = _safe_next("/login")
            assert result is None

    def test_safe_next_rejects_auth_login(self):
        """_safe_next should reject /auth/login to prevent redirect loops."""
        from flask import Flask
        from src.app.routes.auth import _safe_next

        app = Flask(__name__)
        with app.test_request_context("/"):
            result = _safe_next("/auth/login")
            assert result is None

    def test_safe_next_allows_valid_path(self):
        """_safe_next should allow valid internal paths."""
        from flask import Flask
        from src.app.routes.auth import _safe_next

        app = Flask(__name__)
        with app.test_request_context("/"):
            result = _safe_next("/corpus/search?q=test")
            assert result == "/corpus/search?q=test"
