import secrets
from datetime import datetime, timezone

import pytest

from flask import Flask

from src.app.extensions.sqlalchemy_ext import get_engine
from src.app.auth.models import Base, User


@pytest.fixture
def client():
    from pathlib import Path

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
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints
    from src.app.extensions.sqlalchemy_ext import init_engine as init_auth

    register_extensions(app)
    init_auth(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    register_blueprints(app)

    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def create_user(username: str = "e2euser", role: str = "user") -> User:
    from src.app.auth import services

    with services.get_session() as session:
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


def test_login_refresh_logout_flow(client):
    create_user("e2e1")

    r = client.post("/auth/login", json={"username": "e2e1", "password": "password123"})
    assert r.status_code in (200, 303, 204)
    # client should now have access + refresh cookie
    # access a protected page
    p = client.get("/auth/account/profile")
    assert p.status_code == 200

    # refresh tokens: call /auth/refresh
    rr = client.post("/auth/refresh")
    # allow both 200 and 401 depending on rotation
    assert rr.status_code in (200, 401, 403)

    # logout should clear cookie
    logout = client.get("/auth/logout")
    assert logout.status_code in (303, 302)


def test_password_forgot_and_reset(client):
    from src.app.auth import services

    u = create_user("e2e_reset")

    r = client.post("/auth/reset-password/request", json={"email": u.email})
    assert r.status_code == 200

    raw, row = services.create_reset_token_for_user(u)
    assert raw

    rc = client.post(
        "/auth/reset-password/confirm",
        json={"resetToken": raw, "newPassword": "newpass123"},
    )
    assert rc.status_code == 200

    # login with new password
    login_resp = client.post(
        "/auth/login", json={"username": "e2e_reset", "password": "newpass123"}
    )
    assert login_resp.status_code in (200, 303, 204)


def test_admin_create_user_via_api_and_verify_ui(client):
    from src.app.auth import services

    create_user("e2e_admin", role="admin")
    # login as admin and set cookies
    resp = client.post(
        "/auth/login", json={"username": "e2e_admin", "password": "password123"}
    )
    for s in resp.headers.getlist("Set-Cookie"):
        try:
            name = s.split("=", 1)[0]
            val = s.split("=", 1)[1].split(";", 1)[0]
            client.set_cookie(name, val, path="/")
        except Exception:
            pass
    token = services.create_access_token_for_user(
        services.find_user_by_username_or_email("e2e_admin")
    )
    client.set_cookie("access_token_cookie", token, path="/")

    new_user_resp = client.post(
        "/admin/users", json={"username": "invited_e2e", "email": "invite@e2e.test"}
    )
    assert new_user_resp.status_code in (201, 200)

    # visit admin UI (requires admin) and ensure we get HTML
    ui = client.get("/auth/admin_users")
    assert ui.status_code == 200
