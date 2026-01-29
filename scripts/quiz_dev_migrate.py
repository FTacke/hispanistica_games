#!/usr/bin/env python3
"""DEV-only migration runner for quiz schema hotfixes.

Applies SQL migrations needed for local development databases.
Do NOT use in production deployments.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def apply_sql_file(sql_path: Path) -> None:
    if not sql_path.exists():
        raise FileNotFoundError(f"Migration file not found: {sql_path}")

    sql = sql_path.read_text(encoding="utf-8")
    if not sql.strip():
        logger.warning(f"Empty migration file: {sql_path}")
        return

    from src.app import create_app
    from src.app.extensions.sqlalchemy_ext import get_engine

    app = create_app()

    with app.app_context():
        engine = get_engine()
        if engine is None:
            raise RuntimeError("Database engine not initialized. Check AUTH_DATABASE_URL.")

        with engine.begin() as conn:
            conn.exec_driver_sql(sql)


def main() -> int:
    logger.info("Quiz DEV migration runner starting...")

    migrations_dir = Path(__file__).parent.parent / "migrations"
    migration_file = migrations_dir / "0012_add_server_based_timer.sql"

    logger.info(f"Applying migration: {migration_file}")
    apply_sql_file(migration_file)

    logger.info("✓ Migration applied (idempotent)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
