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


def create_test_user(username: str = "gdpr") -> User:
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


def test_anonymize_user_flow(client):
    from src.app.auth import services

    u = create_test_user("todelete")

    # mark deleted
    services.mark_user_deleted(str(u.id))

    # anonymize
    services.anonymize_user(str(u.id))

    with get_session() as session:
        row = session.query(User).filter(User.id == u.id).first()
        assert row.username.startswith("deleted-")
        assert row.email.endswith("@example.invalid")
        assert row.display_name is None
        assert row.last_login_at is None
        assert not row.is_active


def test_anonymize_job_respects_retention(client):
    """Ensure anonymization job only anonymizes users deleted older than retention."""
    from src.app.auth import services
    from datetime import timedelta

    # Create two users
    u_old = create_test_user("olduser")
    u_recent = create_test_user("recentuser")

    # mark both deleted
    services.mark_user_deleted(str(u_old.id))
    services.mark_user_deleted(str(u_recent.id))

    # Manually set deleted_at for u_old to be older than retention
    from src.app.extensions.sqlalchemy_ext import get_session
    from datetime import datetime, timezone

    with get_session() as session:
        u = session.query(User).filter(User.id == u_old.id).first()
        u.deleted_at = datetime.now(timezone.utc) - timedelta(days=31)

    # Run anonymize for >30 days
    count = services.anonymize_soft_deleted_users_older_than(30)
    assert count >= 1

    # Check u_old was anonymized and u_recent remains
    with get_session() as session:
        row_old = session.query(User).filter(User.id == u_old.id).first()
        row_new = session.query(User).filter(User.id == u_recent.id).first()
        assert row_old.username.startswith("deleted-")
        assert row_new.username == "recentuser"
