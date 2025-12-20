"""Create or update an initial admin user in the AUTH database.

NOTE: This script is a development / staging helper and is intentionally
convenient and non-destructive for local usage. Do NOT run this against
production databases unless you understand the consequences.

This helper supports both a local sqlite DB file (default) and any SQLAlchemy
URL provided via the `AUTH_DATABASE_URL` environment variable.

Usage (PowerShell):
    $env:START_ADMIN_USERNAME='admin'; $env:START_ADMIN_PASSWORD='change-me'; python scripts/create_initial_admin.py

Or explicit DB file (sqlite):
    python scripts/create_initial_admin.py --db data/db/auth.db --username admin --password mypass

This script creates tables if missing and will either create a new admin user
or update an existing user with the same username. When updating it will
unlock the account, reset the password, clear failed/locked flags and mark the
user active.
"""

from __future__ import annotations

import os
from pathlib import Path
import argparse
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        help="Path to sqlite DB file (defaults data/db/auth.db)",
        default="data/db/auth.db",
    )
    parser.add_argument(
        "--username", default=os.environ.get("START_ADMIN_USERNAME", "admin")
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("START_ADMIN_PASSWORD"),
        help="Password for the admin user (required unless START_ADMIN_PASSWORD env is set).",
    )
    parser.add_argument(
        "--email",
        default=None,
        help="Optional email for the admin (defaults to <username>@example.org)",
    )
    parser.add_argument(
        "--display-name",
        dest="display_name",
        default=None,
        help="Optional display name for the created admin user",
    )
    parser.add_argument(
        "--allow-production",
        dest="allow_production",
        action="store_true",
        help="Allow running this script in production environments (use with care)",
    )
    args = parser.parse_args()

    # Setup a minimal app-like config for the SQLAlchemy helpers
    # config must behave like a mapping with .get() for the SQLAlchemy helper
    cfg = {
        "AUTH_DATABASE_URL": os.environ.get(
            "AUTH_DATABASE_URL", f"sqlite:///{Path(args.db).as_posix()}"
        )
    }
    # allow optional override for the hashing algorithm used by services
    cfg["AUTH_HASH_ALGO"] = os.environ.get("AUTH_HASH_ALGO", "argon2")

    # Prevent accidental execution in production-like envs
    flask_env = os.environ.get("FLASK_ENV", "").lower()
    auth_env = os.environ.get("AUTH_ENV", "").lower()
    if not args.allow_production and (
        flask_env == "production" or auth_env == "production"
    ):
        raise RuntimeError(
            "Refusing to run create_initial_admin in production environment. Use --allow-production to override."
        )

    # validate password argument (required for safety in Dev/CI runs)
    if not args.password:
        parser.error("--password is required (or set START_ADMIN_PASSWORD env)")

    # initialize auth engine and create tables
    import sys

    # ensure repository package path is available when running the script directly
    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    from sqlalchemy.exc import OperationalError, SQLAlchemyError
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
    from src.app.auth.models import Base, User
    from src.app.auth import services

    class AppLike:
        def __init__(self, cfg):
            # mimic Flask app.config API (mapping-like get)
            self.config = cfg

    app = AppLike(cfg)

    # Fail-fast: attempt to init engine and create tables with error handling
    try:
        init_engine(app)
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
    except OperationalError as e:
        print(f"ERROR: Failed to connect to auth database: {e}", file=sys.stderr)
        print(
            "  Check that the database is running and AUTH_DATABASE_URL is correct.",
            file=sys.stderr,
        )
        sys.exit(1)
    except SQLAlchemyError as e:
        print(f"ERROR: Database initialization failed: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Unexpected error during database setup: {e}", file=sys.stderr)
        sys.exit(1)

    # We need a Flask app context for service helpers that read current_app.config
    from flask import Flask

    tmp_app = Flask("create_initial_admin")
    tmp_app.config.update(cfg)

    with tmp_app.app_context():
        with get_session() as session:
            # Check if username exists
            existing = (
                session.query(User).filter(User.username == args.username).first()
            )
            now = datetime.now(timezone.utc)

            def _safe_hash(pw: str) -> str:
                # try configured hashing algorithm first, fall back to bcrypt if unavailable
                try:
                    return services.hash_password(pw)
                except Exception as e:
                    # fall back to bcrypt
                    tmp_app.logger.debug("hashing fallback (bcrypt) due to: %s", e)
                    tmp_app.config["AUTH_HASH_ALGO"] = "bcrypt"
                    return services.hash_password(pw)

            if existing:
                # Idempotent update: unlock and reset password so admin is always usable in dev/staging
                existing.role = "admin"
                existing.is_active = True
                existing.must_reset_password = False
                existing.login_failed_count = 0
                existing.locked_until = None
                existing.deleted_at = None
                existing.deletion_requested_at = None
                existing.password_hash = _safe_hash(args.password)
                existing.updated_at = now
                if args.display_name:
                    existing.display_name = args.display_name
                print(
                    f"Updated existing user '{args.username}' as admin (unlocked, password reset)"
                )
            else:
                # create a new admin user
                import uuid

                # create a new canonical UUID for the user id
                u = User(
                    id=str(uuid.uuid4()),
                    username=args.username,
                    email=args.email or f"{args.username}@example.org",
                    password_hash=_safe_hash(args.password),
                    role="admin",
                    is_active=True,
                    must_reset_password=False,
                    login_failed_count=0,
                    locked_until=None,
                    deleted_at=None,
                    deletion_requested_at=None,
                    created_at=now,
                    updated_at=now,
                )
                if args.display_name:
                    u.display_name = args.display_name
                session.add(u)
                print(f"Created admin user '{args.username}' (unlocked)")


if __name__ == "__main__":
    main()
