"""Seed a test DB with an E2E user account.

Usage:
  python scripts/seed_e2e_db.py --db data/db/auth_e2e.db --user e2e_user --password password123

This is intentionally simple: it configures the auth engine and creates the tables
and a single user for browser E2E smoke tests.
"""

from pathlib import Path
import argparse
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="data/db/auth_e2e.db")
    parser.add_argument("--user", default="e2e_user")
    parser.add_argument("--password", default="password123")
    args = parser.parse_args()

    # ensure parent folder exists
    p = Path(args.db)
    p.parent.mkdir(parents=True, exist_ok=True)

    # make src package importable when running from the repository root
    import sys

    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    # minimal Flask-like config object for init_engine (mapping-like)
    cfg = {"AUTH_DATABASE_URL": f"sqlite:///{p.as_posix()}"}
    cfg["AUTH_HASH_ALGO"] = "bcrypt"

    # initialize auth engine and create tables
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
    from src.app.auth.models import Base, User
    from src.app.auth import services

    # use a tiny fake app container since init_engine expects an app with config
    class AppLike:
        def __init__(self, cfg):
            # keep mapping-style config for init_engine
            self.config = cfg

    app = AppLike(cfg)
    init_engine(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    # seed user (id, username, email, hash, role) — we need an app context for hashing
    from flask import Flask

    tmp_app = Flask("seed_e2e_db")
    tmp_app.config.update(cfg)

    def _safe_hash(pw: str) -> str:
        try:
            return services.hash_password(pw)
        except Exception:
            tmp_app.logger.debug("argon2 missing or error — falling back to bcrypt")
            tmp_app.config["AUTH_HASH_ALGO"] = "bcrypt"
            return services.hash_password(pw)

    with tmp_app.app_context():
        import secrets

        with get_session() as session:
            if session.query(User).filter(User.username == args.user).first():
                print("User already present — skipping")
                return

            u = User(
                id=str(secrets.token_hex(8)),
                username=args.user,
                email=f"{args.user}@example.org",
                password_hash=_safe_hash(args.password),
                role="user",
                is_active=True,
                must_reset_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(u)

    print(f"Seeded {args.user} in {p}")


if __name__ == "__main__":
    main()
