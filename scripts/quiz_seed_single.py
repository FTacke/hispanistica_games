#!/usr/bin/env python3
"""Seed a single quiz unit JSON file (DEV-only).

Usage:
  python scripts/quiz_seed_single.py --file content/quiz/topics/variation_aussprache_v2.json
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed a single quiz unit JSON file")
    parser.add_argument("--file", required=True, help="Path to quiz unit JSON file")
    args = parser.parse_args()

    json_path = Path(args.file)
    if not json_path.exists():
        logger.error("File not found: %s", json_path)
        return 1

    from src.app import create_app
    from src.app.extensions.sqlalchemy_ext import get_session
    from game_modules.quiz.seed import (
        acquire_seed_lock,
        release_seed_lock,
        load_quiz_unit,
        import_quiz_unit,
    )

    app = create_app()

    with app.app_context():
        with get_session() as session:
            if not acquire_seed_lock(session):
                logger.warning("Seed already in progress (locked), aborting")
                return 1

            try:
                unit = load_quiz_unit(json_path)
                project_root = Path(__file__).parent.parent
                topic, q_count, media_count = import_quiz_unit(
                    session, unit, json_path=json_path, project_root=project_root
                )
                session.commit()
                logger.info(
                    "✓ Seeded %s (%s questions, %s media files)",
                    topic.id,
                    q_count,
                    media_count,
                )
            finally:
                release_seed_lock(session)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
