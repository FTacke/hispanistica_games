import secrets
from datetime import datetime, timezone
import threading

import pytest

from flask import Flask

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from src.app.auth.models import Base, User


@pytest.fixture
def app(tmp_path):
    dbfile = tmp_path / "race_auth.db"
    url = f"sqlite:///{dbfile}"
    app = Flask(__name__)
    app.config["AUTH_DATABASE_URL"] = url
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
    yield app
    ctx.pop()


def create_user(username: str = "race_user") -> User:
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


def test_parallel_refresh_requests_race(app):
    from src.app.auth import services

    client_a = app.test_client()
    client_b = app.test_client()

    u = create_user("race_user")
    raw, row = services.create_refresh_token_for_user(u)

    # both clients use the same raw refresh token
    client_a.set_cookie("refreshToken", raw, path="/auth/refresh")
    client_b.set_cookie("refreshToken", raw, path="/auth/refresh")

    results = []

    def call_refresh(c):
        r = c.post("/auth/refresh")
        results.append((r.status_code, r.data))

    t1 = threading.Thread(target=call_refresh, args=(client_a,))
    t2 = threading.Thread(target=call_refresh, args=(client_b,))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Exactly one request must succeed (200) and the other must be treated as reuse (403)
    statuses = [s for s, _ in results]
    assert statuses.count(200) == 1 and statuses.count(403) == 1
