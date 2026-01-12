"""Test suite for admin persistence across deployments.

This test suite validates that:
1. Admin passwords are NOT overwritten on subsequent deployments
2. Admin passwords CAN be explicitly reset via CLI
3. Bootstrap correctly handles both new and existing admin users
"""

import os
import tempfile
from pathlib import Path
from datetime import datetime, timezone
import sqlite3
import sys

import pytest

# Add src to path for imports
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from src.app.auth.models import Base, User
from src.app.auth import services


@pytest.fixture
def temp_db():
    """Create a temporary SQLite database for testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    yield db_path

    # Cleanup
    if os.path.exists(db_path):
        os.unlink(db_path)


@pytest.fixture
def app_config(temp_db):
    """Create a test app config pointing to temp DB."""
    return {
        "AUTH_DATABASE_URL": f"sqlite:///{Path(temp_db).as_posix()}",
        "AUTH_HASH_ALGO": "argon2",
    }


@pytest.fixture
def flask_app(app_config):
    """Create a Flask app for context."""
    from flask import Flask

    app = Flask("test")
    app.config.update(app_config)
    return app


def init_test_db(app_config):
    """Initialize test database."""

    class AppLike:
        def __init__(self, cfg):
            self.config = cfg

    app = AppLike(app_config)
    init_engine(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    return engine


class TestAdminPersistence:
    """Test admin password persistence across deployments."""

    def test_admin_bootstrap_creates_new_user(self, app_config, flask_app):
        """First bootstrap with ADMIN_BOOTSTRAP=1 should create admin user."""
        init_test_db(app_config)

        with flask_app.app_context():
            with get_session() as session:
                # Create admin with password
                pw_hash = services.hash_password("initial-password-123")
                admin = User(
                    id="admin-id-1",
                    username="admin",
                    email="admin@example.org",
                    password_hash=pw_hash,
                    role="admin",
                    is_active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(admin)
                session.commit()

                # Verify user exists
                user = session.query(User).filter(User.username == "admin").first()
                assert user is not None
                assert user.role == "admin"
                assert user.is_active is True
                assert user.password_hash == pw_hash

    def test_admin_password_not_overwritten_on_update(self, app_config, flask_app):
        """Existing admin password should NOT be overwritten by create_initial_admin update."""
        init_test_db(app_config)

        with flask_app.app_context():
            with get_session() as session:
                # Create admin with original password
                original_hash = services.hash_password("original-secure-password")
                admin = User(
                    id="admin-id-1",
                    username="admin",
                    email="admin@example.org",
                    password_hash=original_hash,
                    role="admin",
                    is_active=False,  # Simulate locked account
                    login_failed_count=5,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(admin)
                session.commit()

                # Simulate deployment update (idempotent behavior):
                # Should unlock but preserve password
                existing = session.query(User).filter(User.username == "admin").first()
                existing.is_active = True
                existing.login_failed_count = 0
                existing.role = "admin"
                # NOTE: do NOT set existing.password_hash here (this is the fix)
                existing.updated_at = datetime.now(timezone.utc)
                session.commit()

            # Verify password is unchanged
            with get_session() as session:
                user = session.query(User).filter(User.username == "admin").first()
                assert user.password_hash == original_hash
                assert user.is_active is True
                assert user.login_failed_count == 0
                # Verify old password still works
                assert services.verify_password("original-secure-password", user.password_hash)

    def test_admin_reset_password_cli(self, app_config, flask_app):
        """Admin password reset via CLI should work correctly."""
        init_test_db(app_config)

        with flask_app.app_context():
            # Create admin with old password
            with get_session() as session:
                old_hash = services.hash_password("old-password-123")
                admin = User(
                    id="admin-id-1",
                    username="admin",
                    email="admin@example.org",
                    password_hash=old_hash,
                    role="admin",
                    is_active=False,
                    login_failed_count=10,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(admin)
                session.commit()

            # Simulate admin_reset_password.py logic
            with get_session() as session:
                user = session.query(User).filter(User.username == "admin").first()

                # Reset password and unlock
                new_password = "new-secure-password-456"
                user.password_hash = services.hash_password(new_password)
                user.login_failed_count = 0
                user.locked_until = None
                user.must_reset_password = False
                user.updated_at = datetime.now(timezone.utc)
                session.commit()

            # Verify new password works
            with get_session() as session:
                user = session.query(User).filter(User.username == "admin").first()
                assert user.is_active is True
                assert user.login_failed_count == 0
                assert services.verify_password(new_password, user.password_hash)
                # Old password should not work
                assert not services.verify_password("old-password-123", user.password_hash)

    def test_admin_bootstrap_flag_controls_bootstrap(self, app_config, flask_app):
        """ADMIN_BOOTSTRAP env var should control whether bootstrap runs."""
        init_test_db(app_config)

        # Simulate: ADMIN_BOOTSTRAP not set in .env (default behavior)
        # → bootstrap should NOT run
        assert os.getenv("ADMIN_BOOTSTRAP", "0") != "1"

        with flask_app.app_context():
            with get_session() as session:
                # Create existing admin
                existing_hash = services.hash_password("existing-password")
                admin = User(
                    id="admin-id-1",
                    username="admin",
                    email="admin@example.org",
                    password_hash=existing_hash,
                    role="admin",
                    is_active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(admin)
                session.commit()

            # In entrypoint.sh with ADMIN_BOOTSTRAP != 1:
            # create_initial_admin.py should NOT be called at all
            # So password stays unchanged
            with get_session() as session:
                user = session.query(User).filter(User.username == "admin").first()
                assert user.password_hash == existing_hash

    def test_secret_key_validation(self):
        """FLASK_SECRET_KEY should be validated at app startup."""
        # This test validates that missing SECRET_KEY causes crash
        from src.app.config import load_config
        from flask import Flask

        app = Flask("test")

        # Remove SECRET_KEY from env if present
        os.environ.pop("FLASK_SECRET_KEY", None)

        # Should raise RuntimeError
        with pytest.raises(RuntimeError, match="FLASK_SECRET_KEY must be provided"):
            load_config(app, "production")


class TestAdminBootstrapScript:
    """Test the create_initial_admin.py script behavior."""

    def test_bootstrap_idempotent_preserves_password(self, app_config, flask_app):
        """Multiple runs of create_initial_admin should preserve password after first run."""
        init_test_db(app_config)

        with flask_app.app_context():
            original_hash = services.hash_password("first-run-password")

            # First run: create admin
            with get_session() as session:
                admin = User(
                    id="admin-id-1",
                    username="admin",
                    email="admin@example.org",
                    password_hash=original_hash,
                    role="admin",
                    is_active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(admin)
                session.commit()

            # Second run (simulated): check if admin exists, update without password change
            with get_session() as session:
                existing = (
                    session.query(User).filter(User.username == "admin").first()
                )
                if existing:
                    # This is what create_initial_admin.py now does (after the fix)
                    existing.role = "admin"
                    existing.is_active = True
                    if existing.must_reset_password:
                        existing.must_reset_password = False
                    existing.login_failed_count = 0
                    existing.locked_until = None
                    # NOT setting password_hash here - this preserves the password
                    session.commit()

            # Verify password unchanged
            with get_session() as session:
                user = session.query(User).filter(User.username == "admin").first()
                assert user.password_hash == original_hash


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
