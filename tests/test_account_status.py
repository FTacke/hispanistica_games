import secrets
from datetime import datetime, timedelta, timezone

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
    app.config["JWT_COOKIE_SECURE"] = False
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


def create_user(username: str = "statuser") -> User:
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


def test_inactive_account_blocked(client):
    create_user("inactive")
    with get_session() as session:
        row = session.query(User).filter(User.username == "inactive").first()
        row.is_active = False

    r = client.post(
        "/auth/login", json={"username": "inactive", "password": "password123"}
    )
    assert r.status_code == 403
    assert r.json.get("error") == "account_inactive"


def test_valid_from_future_blocked(client):
    create_user("future")
    with get_session() as session:
        row = session.query(User).filter(User.username == "future").first()
        row.valid_from = datetime.now(timezone.utc) + timedelta(days=1)

    r = client.post(
        "/auth/login", json={"username": "future", "password": "password123"}
    )
    assert r.status_code == 403
    assert r.json.get("error") == "account_not_yet_valid"


def test_access_expired_blocked(client):
    create_user("expired")
    with get_session() as session:
        row = session.query(User).filter(User.username == "expired").first()
        row.access_expires_at = datetime.now(timezone.utc) - timedelta(days=1)

    r = client.post(
        "/auth/login", json={"username": "expired", "password": "password123"}
    )
    assert r.status_code == 403
    assert r.json.get("error") == "account_expired"


def test_locked_until_blocked(client):
    create_user("locked")
    with get_session() as session:
        row = session.query(User).filter(User.username == "locked").first()
        row.locked_until = datetime.now(timezone.utc) + timedelta(minutes=5)

    r = client.post(
        "/auth/login", json={"username": "locked", "password": "password123"}
    )
    assert r.status_code == 403
    assert r.json.get("error") == "account_locked"


def test_deleted_account_blocked(client):
    from src.app.auth import services

    u = create_user("deleted")
    services.mark_user_deleted(str(u.id))

    r = client.post(
        "/auth/login", json={"username": "deleted", "password": "password123"}
    )
    assert r.status_code == 403
    # currently check_account_status returns account_inactive when is_active==False
    assert r.json.get("error") in ("account_inactive", "account_deleted")
