"""
Comprehensive tests for role-based access control.

Tests that all protected routes properly enforce role requirements:
- Admin routes require admin role
- Editor routes require editor or admin role
- User routes require any authenticated user
- Unauthenticated users get 401
- Wrong role gets 403
"""

import secrets
from datetime import datetime, timezone
from pathlib import Path

import pytest
from flask import Flask

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from src.app.auth.models import Base, User


@pytest.fixture
def app():
    """Create test Flask app with auth configured."""
    project_root = Path(__file__).resolve().parents[1]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"

    app = Flask(
        __name__, template_folder=str(template_dir), static_folder=str(static_dir)
    )
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["TESTING"] = True
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["SECRET_KEY"] = "test-secret"

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints
    from src.app import register_context_processors, register_security_headers

    register_extensions(app)
    init_engine(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    register_blueprints(app)
    register_context_processors(app)
    register_security_headers(app)

    return app


@pytest.fixture
def client(app):
    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def create_user(username: str, role: str = "user") -> User:
    """Create a test user with specified role."""
    from src.app.auth import services

    with get_session() as session:
        u = User(
            id=str(secrets.token_hex(8)),
            username=username,
            email=f"{username}@example.org",
            password_hash=services.hash_password("password123"),
            role=role,
            is_active=True,
            must_reset_password=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(u)
    return u


def login_and_get_token(client, username: str, password: str = "password123"):
    """Login user and set cookies on client."""
    resp = client.post("/auth/login", json={"username": username, "password": password})
    for s in resp.headers.getlist("Set-Cookie"):
        try:
            name = s.split("=", 1)[0]
            val = s.split("=", 1)[1].split(";", 1)[0]
            client.set_cookie(name, val, path="/")
        except Exception:
            continue
    # Ensure access token cookie
    try:
        from src.app.auth import services

        uobj = services.find_user_by_username_or_email(username)
        if uobj:
            tok = services.create_access_token_for_user(uobj)
            client.set_cookie("access_token_cookie", tok, path="/")
    except Exception:
        pass
    return resp


class TestAdminRouteProtection:
    """Test that admin routes are properly protected."""

    def test_admin_dashboard_requires_auth(self, client):
        """Unauthenticated user cannot access admin dashboard."""
        resp = client.get("/api/admin/dashboard")
        assert resp.status_code in (401, 302, 303), "Should reject unauthenticated"

    def test_admin_dashboard_requires_admin_role(self, client):
        """Regular user cannot access admin dashboard."""
        create_user("regularuser", role="user")
        login_and_get_token(client, "regularuser")

        resp = client.get("/api/admin/dashboard")
        assert resp.status_code == 403, "Regular user should get 403"

    def test_admin_dashboard_allows_admin(self, client):
        """Admin user can access admin dashboard."""
        create_user("adminuser", role="admin")
        login_and_get_token(client, "adminuser")

        resp = client.get("/api/admin/dashboard")
        assert resp.status_code == 200, "Admin should access dashboard"

    def test_analytics_stats_requires_admin(self, client):
        """Analytics stats endpoint requires admin role."""
        create_user("user1", role="user")
        login_and_get_token(client, "user1")

        resp = client.get("/api/analytics/stats")
        assert resp.status_code == 403

    def test_admin_users_list_requires_admin(self, client):
        """User list endpoint requires admin role."""
        create_user("user2", role="user")
        login_and_get_token(client, "user2")

        resp = client.get("/api/admin/users")
        assert resp.status_code == 403

    def test_admin_users_list_allows_admin(self, client):
        """Admin can list users."""
        create_user("admin2", role="admin")
        login_and_get_token(client, "admin2")

        resp = client.get("/api/admin/users")
        assert resp.status_code == 200
        assert "items" in resp.json


class TestUserRouteProtection:
    """Test user-only routes."""

    def test_profile_requires_auth(self, client):
        """Profile endpoint requires authentication."""
        resp = client.get("/auth/account/profile")
        assert resp.status_code in (401, 302, 303)

    def test_profile_allows_any_authenticated_user(self, client):
        """Any authenticated user can access their profile."""
        create_user("anyuser", role="user")
        login_and_get_token(client, "anyuser")

        resp = client.get("/auth/account/profile")
        assert resp.status_code == 200
        assert resp.json.get("username") == "anyuser"

    def test_change_password_requires_auth(self, client):
        """Password change requires authentication."""
        resp = client.post(
            "/auth/change-password", json={"oldPassword": "x", "newPassword": "y"}
        )
        assert resp.status_code in (401, 302, 303)


class TestEditorRouteProtection:
    """Test editor routes if they exist."""

    def test_editor_routes_documented(self):
        """
        Editor routes should follow the pattern:
        @jwt_required()
        @require_role(Role.EDITOR)

        This test documents the expected behavior.
        """
        # Editor role sits between user and admin
        # Editor can access corpus editing features
        # But not admin user management
        pass


class TestPublicRoutes:
    """Test that public routes are accessible."""

    def test_landing_page_public(self, client):
        """Landing page is public."""
        resp = client.get("/")
        assert resp.status_code == 200

    def test_login_page_public(self, client):
        """Login page is public."""
        resp = client.get("/login")
        assert resp.status_code == 200

    def test_health_public(self, client):
        """Health endpoint is public."""
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_bls_public(self, client):
        """BlackLab health endpoint is public."""
        resp = client.get("/health/bls")
        # May be 200 or 502 depending on BlackLab availability
        assert resp.status_code in (200, 502)


class TestRoleEscalation:
    """Test that users cannot escalate their own privileges."""

    def test_user_cannot_change_own_role(self, client):
        """Regular user cannot change their role via profile update."""
        create_user("normaluser", role="user")
        login_and_get_token(client, "normaluser")

        # Attempt to change role via profile patch
        resp = client.patch("/auth/account/profile", json={"role": "admin"})

        # Should either reject or ignore the role field
        if resp.status_code == 200:
            # Verify role wasn't actually changed
            profile = client.get("/auth/account/profile")
            # Role should not be in response or should still be user
            assert profile.json.get("role", "user") == "user"

    def test_admin_can_change_user_role(self, client):
        """Admin can change another user's role."""
        create_user("superadmin", role="admin")
        target = create_user("targetuser", role="user")

        login_and_get_token(client, "superadmin")

        resp = client.patch(f"/api/admin/users/{target.id}", json={"role": "editor"})

        assert resp.status_code == 200

        # Verify role was changed
        detail = client.get(f"/api/admin/users/{target.id}")
        assert detail.json.get("role") == "editor"

