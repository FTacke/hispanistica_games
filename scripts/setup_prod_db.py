#!/usr/bin/env python3
"""Production database setup script for games_hispanistica.

This script is designed to run during deployment to ensure the database
is properly initialized. It is IDEMPOTENT - safe to run multiple times.

Operations:
1. Apply pending migrations (creates schema if missing)
2. Ensure admin user exists (creates if not present)

Exit codes:
- 0: Success
- 1: Database connection failed
- 2: Migration error
- 3: Admin user creation failed

Required environment variables:
- AUTH_DATABASE_URL: PostgreSQL connection string

Optional environment variables:
- START_ADMIN_USERNAME: Admin username (default: admin)
- START_ADMIN_PASSWORD: Admin password (REQUIRED in production)
- START_ADMIN_EMAIL: Admin email (default: admin@games.hispanistica.com)

Usage (in container):
    python scripts/setup_prod_db.py

Usage (production deployment):
    docker exec games-webapp python scripts/setup_prod_db.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime, timezone

# Add repository root to path
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def log_info(msg: str) -> None:
    """Print info message with timestamp."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] INFO: {msg}")


def log_error(msg: str) -> None:
    """Print error message with timestamp."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] ERROR: {msg}", file=sys.stderr)


def log_success(msg: str) -> None:
    """Print success message with timestamp."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] ✓ {msg}")


def check_env() -> bool:
    """Verify required environment variables are set."""
    db_url = os.environ.get("AUTH_DATABASE_URL")
    if not db_url:
        log_error("AUTH_DATABASE_URL environment variable is not set")
        return False

    # In production, require admin password
    flask_env = os.environ.get("FLASK_ENV", "development")
    if flask_env == "production":
        admin_pass = os.environ.get("START_ADMIN_PASSWORD")
        if not admin_pass:
            log_error("START_ADMIN_PASSWORD is required in production")
            log_error("Set it in config/passwords.env or as environment variable")
            return False

    return True


def init_database() -> bool:
    """Initialize database connection and create tables."""
    from sqlalchemy.exc import OperationalError, SQLAlchemyError
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
    from src.app.auth.models import Base

    class AppLike:
        """Minimal Flask app stub for database initialization."""
        def __init__(self):
            self.config = {
                "AUTH_DATABASE_URL": os.environ.get("AUTH_DATABASE_URL"),
                "AUTH_HASH_ALGO": os.environ.get("AUTH_HASH_ALGO", "argon2"),
            }

    try:
        log_info("Connecting to database...")
        app = AppLike()
        init_engine(app)
        engine = get_engine()

        log_info("Creating tables (if not exist)...")
        Base.metadata.create_all(bind=engine)
        log_success("Database schema ready")
        return True

    except OperationalError as e:
        log_error(f"Failed to connect to database: {e}")
        log_error("Check that PostgreSQL is running and AUTH_DATABASE_URL is correct")
        return False
    except SQLAlchemyError as e:
        log_error(f"Database error: {e}")
        return False


def ensure_admin_user() -> bool:
    """Ensure admin user exists, create if not present."""
    from sqlalchemy.exc import SQLAlchemyError
    from src.app.extensions.sqlalchemy_ext import get_session
    from src.app.auth.models import User
    from src.app.auth import services

    username = os.environ.get("START_ADMIN_USERNAME", "admin")
    password = os.environ.get("START_ADMIN_PASSWORD")
    email = os.environ.get(
        "START_ADMIN_EMAIL",
        f"{username}@games.hispanistica.com"
    )

    # In development, use a default password if not set
    flask_env = os.environ.get("FLASK_ENV", "development")
    if not password:
        if flask_env == "production":
            log_error("START_ADMIN_PASSWORD is required in production")
            return False
        password = "change-me"
        log_info(f"Using default password for development (username: {username})")

    try:
        with get_session() as session:
            # Check if admin exists
            existing = session.query(User).filter_by(username=username).first()

            if existing:
                log_info(f"Admin user '{username}' already exists (id={existing.id})")
                return True

            # Create new admin user
            log_info(f"Creating admin user: {username}")
            hashed_pw = services.hash_password(password)

            admin = User(
                username=username,
                email=email,
                password_hash=hashed_pw,
                role="admin",
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(admin)
            session.commit()

            log_success(f"Admin user '{username}' created successfully")
            return True

    except SQLAlchemyError as e:
        log_error(f"Failed to create admin user: {e}")
        return False


def main() -> int:
    """Main entry point."""
    print("=" * 60)
    print("games_hispanistica - Production Database Setup")
    print("=" * 60)
    print(f"Started at: {datetime.now(timezone.utc).isoformat()}")
    print()

    # Check environment
    if not check_env():
        return 1

    db_url = os.environ.get("AUTH_DATABASE_URL", "")
    # Mask password in URL for logging
    if "@" in db_url:
        masked_url = db_url.split("@")[0].rsplit(":", 1)[0] + ":***@" + db_url.split("@")[1]
    else:
        masked_url = db_url
    log_info(f"Database URL: {masked_url}")
    print()

    # Initialize database
    if not init_database():
        return 2

    # Ensure admin user
    if not ensure_admin_user():
        return 3

    print()
    print("=" * 60)
    log_success("Database setup completed successfully")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
