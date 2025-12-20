#!/usr/bin/env python3
"""Reset or rotate password for an existing user.

This CLI tool allows administrators to reset a user's password without
knowing the current password. Useful for:
- Emergency admin access recovery
- Resetting locked accounts
- Rotating passwords after security incidents

Usage:
    python scripts/reset_user_password.py admin --password new-secure-password
    python scripts/reset_user_password.py admin  # prompts for password

Environment:
    AUTH_DATABASE_URL - Database connection string (default: sqlite:///data/db/auth.db)
    AUTH_HASH_ALGO    - Hashing algorithm: argon2 (default) or bcrypt
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Ensure repository package path is available
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(
        description="Reset password for an existing user",
        epilog="Example: python scripts/reset_user_password.py admin --password new-password",
    )
    parser.add_argument("username", help="Username to reset password for")
    parser.add_argument(
        "--password", "-p", help="New password (will prompt if not provided)"
    )
    parser.add_argument(
        "--unlock",
        "-u",
        action="store_true",
        help="Also unlock the account (clear failed login count and locked_until)",
    )
    parser.add_argument(
        "--force-reset",
        "-f",
        action="store_true",
        help="Force user to change password on next login",
    )
    args = parser.parse_args()

    # Get password interactively if not provided
    password = args.password
    if not password:
        password = getpass.getpass(f"New password for '{args.username}': ")
        password_confirm = getpass.getpass("Confirm password: ")
        if password != password_confirm:
            print("ERROR: Passwords do not match", file=sys.stderr)
            sys.exit(1)

    if not password:
        print("ERROR: Password cannot be empty", file=sys.stderr)
        sys.exit(1)

    # Setup minimal config
    cfg = {
        "AUTH_DATABASE_URL": os.environ.get(
            "AUTH_DATABASE_URL",
            f"sqlite:///{(ROOT / 'data' / 'db' / 'auth.db').as_posix()}",
        ),
        "AUTH_HASH_ALGO": os.environ.get("AUTH_HASH_ALGO", "argon2"),
    }

    from sqlalchemy.exc import OperationalError
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
    from src.app.auth.models import User
    from src.app.auth import services

    class AppLike:
        def __init__(self, cfg):
            self.config = cfg

    app = AppLike(cfg)

    try:
        init_engine(app)
        get_engine()
    except OperationalError as e:
        print(f"ERROR: Failed to connect to auth database: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Database setup failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Setup Flask app context for services
    from flask import Flask

    tmp_app = Flask("reset_password")
    tmp_app.config.update(cfg)

    with tmp_app.app_context():
        with get_session() as session:
            user = session.query(User).filter(User.username == args.username).first()

            if not user:
                print(f"ERROR: User '{args.username}' not found", file=sys.stderr)
                sys.exit(1)

            # Hash new password
            def _safe_hash(pw: str) -> str:
                try:
                    return services.hash_password(pw)
                except Exception:
                    tmp_app.config["AUTH_HASH_ALGO"] = "bcrypt"
                    return services.hash_password(pw)

            now = datetime.now(timezone.utc)
            user.password_hash = _safe_hash(password)
            user.updated_at = now

            changes = ["password reset"]

            if args.unlock:
                user.login_failed_count = 0
                user.locked_until = None
                user.is_active = True
                changes.append("account unlocked")

            if args.force_reset:
                user.must_reset_password = True
                changes.append("must change password on next login")
            else:
                user.must_reset_password = False

            print(f"✓ User '{args.username}': {', '.join(changes)}")


if __name__ == "__main__":
    main()
