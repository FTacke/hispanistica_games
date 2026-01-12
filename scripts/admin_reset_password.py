#!/usr/bin/env python
"""Reset admin password safely (production-safe).

This script allows resetting an admin user's password without modifying
the deployment bootstrap logic. It should be used when:

1. Admin password is forgotten
2. Password needs to be rotated
3. Account was locked due to failed login attempts

Usage:
    python scripts/admin_reset_password.py --username admin --password newpass

This script will:
- Verify the user exists and has admin role
- Change ONLY the password_hash (no other modifications)
- Unlock the account if locked
- Clear failed login count
- Reset must_reset_password flag if set
- Leave created_at, created_by, and other audit fields unchanged
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime, timezone
import argparse


def main():
    parser = argparse.ArgumentParser(
        description="Reset admin password (safe, production-approved)"
    )
    parser.add_argument(
        "--username",
        default=os.environ.get("ADMIN_USERNAME", "admin"),
        help="Admin username to reset password for",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("ADMIN_PASSWORD"),
        help="New password (required unless ADMIN_PASSWORD env is set)",
    )
    parser.add_argument(
        "--unlock",
        action="store_true",
        default=True,
        help="Unlock account if locked (default: true)",
    )
    args = parser.parse_args()

    # Validate password
    if not args.password:
        parser.error("--password is required (or set ADMIN_PASSWORD env)")

    if len(args.password) < 8:
        print("ERROR: Password must be at least 8 characters", file=sys.stderr)
        sys.exit(1)

    # Setup path and imports
    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    from sqlalchemy.exc import OperationalError
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
    from src.app.auth.models import Base, User
    from src.app.auth import services

    # Load config
    cfg = {
        "AUTH_DATABASE_URL": os.environ.get(
            "AUTH_DATABASE_URL",
            f"sqlite:///{(Path(ROOT) / 'data' / 'db' / 'auth.db').as_posix()}",
        ),
        "AUTH_HASH_ALGO": os.environ.get("AUTH_HASH_ALGO", "argon2"),
    }

    # Initialize DB
    class AppLike:
        def __init__(self, cfg):
            self.config = cfg

    app = AppLike(cfg)

    try:
        init_engine(app)
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
    except OperationalError as e:
        print(f"ERROR: Database connection failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Flask context for password hashing
    from flask import Flask

    tmp_app = Flask("admin_reset_password")
    tmp_app.config.update(cfg)

    with tmp_app.app_context():
        with get_session() as session:
            user = session.query(User).filter(User.username == args.username).first()

            if not user:
                print(f"ERROR: User '{args.username}' not found", file=sys.stderr)
                sys.exit(1)

            if user.role != "admin":
                print(
                    f"ERROR: User '{args.username}' is not an admin (role: {user.role})",
                    file=sys.stderr,
                )
                sys.exit(1)

            # Hash new password
            try:
                new_hash = services.hash_password(args.password)
            except Exception as e:
                print(f"ERROR: Failed to hash password: {e}", file=sys.stderr)
                sys.exit(1)

            # Update ONLY password-related fields
            user.password_hash = new_hash
            user.updated_at = datetime.now(timezone.utc)

            # If unlocking requested (default): clear lock state
            if args.unlock:
                user.login_failed_count = 0
                user.locked_until = None
                user.must_reset_password = False

            session.commit()

            print(f"✓ Password reset for admin user '{args.username}'")
            if args.unlock:
                print("✓ Account unlocked and cleared of failed login flags")
            print("\nNext step: User can now log in with the new password.")


if __name__ == "__main__":
    main()
