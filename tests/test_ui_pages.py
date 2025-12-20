import secrets
from datetime import datetime, timezone

import pytest

from flask import Flask

from src.app.extensions.sqlalchemy_ext import get_engine
from src.app.auth.models import Base, User


@pytest.fixture
def client():
    # Create Flask app with explicit template/static paths so our templates are found
    from pathlib import Path

    project_root = Path(__file__).resolve().parents[1]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"
    app = Flask(
        __name__, template_folder=str(template_dir), static_folder=str(static_dir)
    )
    # Test override: small auth DB in-memory and JWT config for tests
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret-key"  # Required for flash() session

    from src.app.extensions.sqlalchemy_ext import init_engine as init_auth

    # re-init auth DB to in-memory for tests
    init_auth(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints

    register_extensions(app)

    register_blueprints(app)

    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def create_user(username: str = "uiuser", role: str = "user") -> User:
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


def test_ui_pages_render(client):
    # pages should render successfully
    r = client.get("/auth/password/forgot")
    assert r.status_code == 200
    r = client.get("/auth/password/reset")
    assert r.status_code == 200

    # login page (full-page, MD3 Goldstandard - replaces login_sheet)
    r = client.get("/login")
    assert r.status_code == 200

    # account pages should return 200 even without auth (login prompt)
    r = client.get("/auth/account/profile/page")
    assert r.status_code in (200, 302)


def test_admin_ui_requires_admin(client):
    # create normal user and admin
    from src.app.auth import services

    create_user("plain")
    create_user("bob", role="admin")

    # try admin page without auth - should redirect to login (302) or return 401/403
    r = client.get("/auth/admin_users")
    assert r.status_code in (302, 401, 403)

    # login as admin and retry
    resp = client.post(
        "/auth/login", json={"username": "bob", "password": "password123"}
    )
    for s in resp.headers.getlist("Set-Cookie"):
        try:
            name = s.split("=", 1)[0]
            val = s.split("=", 1)[1].split(";", 1)[0]
            client.set_cookie(name, val, path="/")
        except Exception:
            pass

    # set access cookie explicitly
    uobj = services.find_user_by_username_or_email("bob")
    tok = services.create_access_token_for_user(uobj)
    client.set_cookie("access_token_cookie", tok, path="/")

    r2 = client.get("/auth/admin_users")
    assert r2.status_code == 200
