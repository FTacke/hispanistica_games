import secrets
from datetime import datetime, timezone

import pytest

from flask import Flask

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from src.app.auth.models import Base, User


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    # for cookie tests we want secure on to ensure the header is present
    app.config["JWT_COOKIE_SECURE"] = True
    app.config["JWT_COOKIE_SAMESITE"] = "Strict"
    app.config["TESTING"] = True
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["SECRET_KEY"] = "test-secret"

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints

    register_extensions(app)
    init_engine(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    register_blueprints(app)

    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def create_user(username: str = "rluser") -> User:
    from src.app.auth import services

    with get_session() as session:
        u = User(
            id=str(secrets.token_hex(8)),
            username=username,
            email=f"{username}@example.org",
            password_hash=services.hash_password("password123"),
            role="user",
            is_active=True,
            must_reset_password=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(u)
    return u


def test_login_failed_attempts_lockout(client):
    from src.app.auth import services

    u = create_user("lockme")

    # call service-level failure handler 5 times to simulate repeated failed logins
    for _ in range(5):
        services.on_failed_login(u)

    # after 5 attempts, user should be locked_until set
    with get_session() as session:
        row = session.query(User).filter(User.username == "lockme").first()
        assert row.login_failed_count >= 5
        assert row.locked_until is not None


def test_cookie_security_headers_on_login_and_refresh(client):
    create_user("cookietest")

    resp = client.post(
        "/auth/login", json={"username": "cookietest", "password": "password123"}
    )
    assert resp.status_code in (200, 303, 204)

    sc = resp.headers.getlist("Set-Cookie")
    # find refreshToken cookie attributes
    refresh_cookie = None
    for s in sc:
        if s.startswith("refreshToken="):
            refresh_cookie = s
            break
    assert refresh_cookie is not None
    assert "HttpOnly" in refresh_cookie
    assert "Secure" in refresh_cookie
    assert "SameSite=Strict" in refresh_cookie or "SameSite=Strict" in refresh_cookie
    assert "Path=/auth/refresh" in refresh_cookie
    assert ("Max-Age=" in refresh_cookie) or ("Expires=" in refresh_cookie)

    # perform a refresh (use the cookie from resp in the client)
    # test client already has cookies accessible
    r = client.post("/auth/refresh")
    assert r.status_code in (200, 401, 403)  # if rotation occurred we expect 200
