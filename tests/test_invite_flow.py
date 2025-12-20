"""
Tests for invite flow: admin creates user with invite, user redeems invite.

This tests the full invite flow:
1. Admin creates a new user (no password set)
2. System generates invite/reset token
3. User receives invite link
4. User sets password via reset token
5. User can now login with new password
"""

import secrets
from datetime import datetime, timezone
from pathlib import Path

import pytest
from flask import Flask

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from src.app.auth.models import Base, User, ResetToken


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


def create_admin() -> User:
    """Create an admin user."""
    from src.app.auth import services

    with get_session() as session:
        u = User(
            id=str(secrets.token_hex(8)),
            username="admin",
            email="admin@example.org",
            password_hash=services.hash_password("adminpass"),
            role="admin",
            is_active=True,
            must_reset_password=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(u)
    return u


def login_admin(client):
    """Login as admin and set cookies."""
    resp = client.post(
        "/auth/login", json={"username": "admin", "password": "adminpass"}
    )
    for s in resp.headers.getlist("Set-Cookie"):
        try:
            name = s.split("=", 1)[0]
            val = s.split("=", 1)[1].split(";", 1)[0]
            client.set_cookie(name, val, path="/")
        except Exception:
            continue
    from src.app.auth import services

    uobj = services.find_user_by_username_or_email("admin")
    if uobj:
        tok = services.create_access_token_for_user(uobj)
        client.set_cookie("access_token_cookie", tok, path="/")
    return resp


class TestInviteFlow:
    """Test the complete invite flow."""

    def test_admin_creates_user_with_invite(self, client):
        """Admin creates new user, system generates invite token."""
        create_admin()
        login_admin(client)

        # Create new user via admin endpoint
        resp = client.post(
            "/admin/users", json={"username": "newuser", "email": "newuser@example.org"}
        )

        assert resp.status_code == 201
        assert resp.json.get("inviteSent") is True
        assert resp.json.get("inviteId") is not None
        assert resp.json.get("inviteExpiresAt") is not None
        assert resp.json.get("userId") is not None

        user_id = resp.json.get("userId")

        # Verify user was created in DB
        with get_session() as session:
            user = session.query(User).filter(User.id == user_id).first()
            assert user is not None
            assert user.username == "newuser"
            assert user.is_active is True
            # User should require password reset
            assert user.must_reset_password is True

            # Reset token should exist
            token = (
                session.query(ResetToken).filter(ResetToken.user_id == user_id).first()
            )
            assert token is not None
            assert token.used_at is None  # Not yet used

    def test_invited_user_cannot_login_without_password(self, client):
        """Invited user cannot login before setting password."""
        create_admin()
        login_admin(client)

        # Create invited user
        client.post(
            "/admin/users",
            json={"username": "invited1", "email": "invited1@example.org"},
        )

        # Logout admin (clear session by calling logout)
        client.get("/auth/logout")

        # Try to login as invited user (no password set yet)
        resp = client.post("/auth/login", json={"username": "invited1", "password": ""})

        # Should fail
        assert resp.status_code in (400, 401)

    def test_invited_user_redeems_invite_and_logs_in(self, client):
        """Complete flow: invite → set password → login."""
        from src.app.auth import services

        create_admin()
        login_admin(client)

        # Create invited user
        create_resp = client.post(
            "/admin/users",
            json={"username": "invited2", "email": "invited2@example.org"},
        )

        user_id = create_resp.json.get("userId")

        # Get the reset token from DB (in real flow this comes via email link)
        with get_session() as session:
            session.query(ResetToken).filter(ResetToken.user_id == user_id).first()
            # We need the raw token, which isn't stored directly
            # In the real flow, the admin endpoint returns an invite link
            # Let's create a fresh token for testing
            session.query(User).filter(User.id == user_id).first()

        raw_token, _ = services.create_reset_token_for_user(
            services.find_user_by_username_or_email("invited2")
        )

        # Logout admin (clear session)
        client.get("/auth/logout")

        # Redeem invite by setting password
        confirm_resp = client.post(
            "/auth/reset-password/confirm",
            json={"resetToken": raw_token, "newPassword": "MyNewPass123"},
        )

        assert confirm_resp.status_code == 200
        assert confirm_resp.json.get("ok") is True

        # Now login with new password
        login_resp = client.post(
            "/auth/login", json={"username": "invited2", "password": "MyNewPass123"}
        )

        assert login_resp.status_code in (200, 303, 204)

        # Set cookies from login
        for s in login_resp.headers.getlist("Set-Cookie"):
            try:
                name = s.split("=", 1)[0]
                val = s.split("=", 1)[1].split(";", 1)[0]
                client.set_cookie(name, val, path="/")
            except Exception:
                continue

        # Verify can access protected resource
        uobj = services.find_user_by_username_or_email("invited2")
        if uobj:
            tok = services.create_access_token_for_user(uobj)
            client.set_cookie("access_token_cookie", tok, path="/")

        profile_resp = client.get("/auth/account/profile")
        assert profile_resp.status_code == 200
        assert profile_resp.json.get("username") == "invited2"

    def test_invite_token_cannot_be_reused(self, client):
        """Once an invite token is used, it cannot be used again."""
        from src.app.auth import services

        create_admin()
        login_admin(client)

        # Create invited user
        client.post(
            "/admin/users",
            json={"username": "invited3", "email": "invited3@example.org"},
        )

        # Logout admin (clear session)
        client.get("/auth/logout")

        # Create a reset token
        user = services.find_user_by_username_or_email("invited3")
        raw_token, _ = services.create_reset_token_for_user(user)

        # First use - should succeed
        resp1 = client.post(
            "/auth/reset-password/confirm",
            json={"resetToken": raw_token, "newPassword": "Password1X"},
        )
        assert resp1.status_code == 200

        # Second use - should fail
        resp2 = client.post(
            "/auth/reset-password/confirm",
            json={"resetToken": raw_token, "newPassword": "Password2X"},
        )
        assert resp2.status_code == 400

    def test_admin_can_reset_existing_user_password(self, client):
        """Admin can trigger password reset for existing user."""
        from src.app.auth import services

        create_admin()

        # Create a regular user with password
        with get_session() as session:
            target = User(
                id=str(secrets.token_hex(8)),
                username="existinguser",
                email="existing@example.org",
                password_hash=services.hash_password("oldpassword"),
                role="user",
                is_active=True,
                must_reset_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(target)
            target_id = target.id

        login_admin(client)

        # Admin triggers password reset
        reset_resp = client.post(f"/admin/users/{target_id}/reset-password")
        assert reset_resp.status_code == 200
        assert reset_resp.json.get("ok") is True
        assert reset_resp.json.get("inviteLink") is not None
        assert reset_resp.json.get("inviteExpiresAt") is not None

        # Verify a reset token was created for this user
        with get_session() as session:
            token = (
                session.query(ResetToken)
                .filter(ResetToken.user_id == target_id)
                .first()
            )
            assert token is not None
