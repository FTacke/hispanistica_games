#!/usr/bin/env python3
"""DEV-only hard prune for quiz data.

Deletes all quiz-related data in DEV databases. Guarded against non-DEV usage.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def _resolve_db_host() -> Optional[str]:
    db_url = os.environ.get("AUTH_DATABASE_URL")
    if not db_url:
        from src.app import create_app

        app = create_app()
        db_url = app.config.get("AUTH_DATABASE_URL")
    if not db_url:
        return None

    from sqlalchemy.engine.url import make_url

    try:
        return make_url(db_url).host
    except Exception:
        return None


def _enforce_dev_guard(acknowledge: bool) -> None:
    env_value = os.getenv("ENV", "").lower()
    host = _resolve_db_host()

    if host in {"localhost", "127.0.0.1"}:
        return

    if env_value == "dev" and acknowledge:
        logger.warning("DEV override active (ENV=dev + --i-know-what-im-doing).")
        return

    logger.error("Aborting: unsafe environment. DB host=%s ENV=%s", host, env_value or "(unset)")
    raise SystemExit(1)


def _log_counts(session, models: list[tuple[str, object]]) -> dict:
    counts = {}
    for name, model in models:
        counts[name] = session.query(model).count()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="DEV-only hard prune for quiz data")
    parser.add_argument(
        "--i-know-what-im-doing",
        action="store_true",
        help="Required when ENV=dev and DB host is not local",
    )
    args = parser.parse_args()

    _enforce_dev_guard(args.i_know_what_im_doing)

    from src.app import create_app
    from src.app.extensions.sqlalchemy_ext import get_session
    from game_modules.quiz.models import (
        QuizRunAnswer,
        QuizRun,
        QuizScore,
        QuizQuestion,
        QuizTopic,
        QuizSession,
        QuizPlayer,
        QuizQuestionStats,
    )
    from game_modules.quiz.release_model import QuizContentRelease

    app = create_app()

    with app.app_context():
        with get_session() as session:
            models = [
                ("quiz_run_answers", QuizRunAnswer),
                ("quiz_runs", QuizRun),
                ("quiz_scores", QuizScore),
                ("quiz_questions", QuizQuestion),
                ("quiz_topics", QuizTopic),
                ("quiz_content_releases", QuizContentRelease),
                ("quiz_question_stats", QuizQuestionStats),
                ("quiz_sessions", QuizSession),
                ("quiz_players", QuizPlayer),
            ]

            logger.info("Counts BEFORE prune:")
            before = _log_counts(session, models)
            for name, count in before.items():
                logger.info("  %s: %s", name, count)

            session.query(QuizRunAnswer).delete(synchronize_session=False)
            session.query(QuizRun).delete(synchronize_session=False)
            session.query(QuizScore).delete(synchronize_session=False)
            session.query(QuizQuestion).delete(synchronize_session=False)
            session.query(QuizTopic).delete(synchronize_session=False)
            session.query(QuizContentRelease).delete(synchronize_session=False)
            session.query(QuizQuestionStats).delete(synchronize_session=False)
            session.query(QuizSession).delete(synchronize_session=False)
            session.query(QuizPlayer).delete(synchronize_session=False)

            session.commit()

            logger.info("Counts AFTER prune:")
            after = _log_counts(session, models)
            for name, count in after.items():
                logger.info("  %s: %s", name, count)

    logger.info("✓ DEV hard prune complete")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
