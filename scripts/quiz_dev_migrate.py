#!/usr/bin/env python3
"""DEV-only migration runner for quiz schema hotfixes.

Applies SQL migrations needed for local development databases.
Do NOT use in production deployments.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def _resolve_quiz_db_url() -> Optional[str]:
    """Resolve quiz DB URL from env vars (QUIZ_DATABASE_URL or QUIZ_DB_*)."""
    if os.getenv("QUIZ_DATABASE_URL"):
        return os.getenv("QUIZ_DATABASE_URL")

    host = os.getenv("QUIZ_DB_HOST")
    port = os.getenv("QUIZ_DB_PORT")
    user = os.getenv("QUIZ_DB_USER")
    password = os.getenv("QUIZ_DB_PASSWORD")
    name = os.getenv("QUIZ_DB_NAME")

    if host and port and user and password and name:
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"

    return None


def _resolve_db_host() -> Optional[str]:
    """Resolve DB host from quiz DB URL."""
    db_url = _resolve_quiz_db_url()
    if not db_url:
        return None

    from sqlalchemy.engine.url import make_url

    try:
        url = make_url(db_url)
    except Exception:
        return None
    return url.host


def _enforce_dev_safety() -> None:
    """Abort if ENV is not dev or DB host is not local."""
    env_value = os.getenv("ENV", "").lower()
    if env_value != "dev":
        logger.error("Aborting: ENV must be 'dev' (set ENV=dev).")
        raise SystemExit(1)

    host = _resolve_db_host()
    if host is None:
        logger.error("Aborting: AUTH_DATABASE_URL missing or invalid.")
        raise SystemExit(1)
    if host not in {"localhost", "127.0.0.1"}:
        logger.error("Aborting: DB host must be local (localhost/127.0.0.1). Got '%s'.", host)
        raise SystemExit(1)


def apply_sql_file(sql_path: Path) -> None:
    if not sql_path.exists():
        raise FileNotFoundError(f"Migration file not found: {sql_path}")

    sql = sql_path.read_text(encoding="utf-8")
    if not sql.strip():
        logger.warning(f"Empty migration file: {sql_path}")
        return

    from sqlalchemy import create_engine

    db_url = _resolve_quiz_db_url()
    if not db_url:
        raise RuntimeError("QUIZ_DATABASE_URL / QUIZ_DB_* not configured")

    engine = create_engine(db_url, future=True)
    with engine.begin() as conn:
        conn.exec_driver_sql(sql)


def main() -> int:
    logger.info("Quiz DEV migration runner starting...")

    _enforce_dev_safety()

    migrations_dir = Path(__file__).parent.parent / "migrations"
    migration_file = migrations_dir / "0012_add_server_based_timer.sql"

    logger.info(f"Applying migration: {migration_file}")
    apply_sql_file(migration_file)

    logger.info("✓ Migration applied (idempotent)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
