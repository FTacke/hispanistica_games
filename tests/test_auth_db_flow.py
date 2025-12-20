import secrets
from datetime import datetime
from datetime import timezone

import pytest

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from src.app.auth import services
from src.app.auth.models import Base, User


@pytest.fixture
def app():
    # Create a minimal Flask app used only to init auth engine for tests
    from flask import Flask

    app = Flask(__name__)
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    init_engine(app)

    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    ctx = app.app_context()
    ctx.push()
    yield app
    ctx.pop()


def test_password_hash_and_verify(app):
    plain = "S3cure_P@ssw0rd"
    h = services.hash_password(plain)
    assert services.verify_password(plain, h)


def test_refresh_token_rotation_and_reuse(app):
    # create user
    with get_session() as session:
        u = User(
            id=str(secrets.token_hex(8)),
            username="alice",
            email="alice@example.org",
            password_hash=services.hash_password("password123"),
            role="user",
            is_active=True,
            must_reset_password=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(u)

    # create refresh token
    raw, row = services.create_refresh_token_for_user(
        u, user_agent="pytest", ip_address="127.0.0.1"
    )
    assert raw and row

    # rotate
    new_raw, new_row, status = services.rotate_refresh_token(raw, "pytest", "127.0.0.1")
    assert status == "ok"
    assert new_raw and new_row

    # reuse detection: presenting the old token again should be treated as reuse
    nr, nrrow, stat = services.rotate_refresh_token(raw, "pytest", "127.0.0.1")
    assert stat == "reused"
