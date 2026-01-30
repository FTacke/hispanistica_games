#!/usr/bin/env python3
"""Verify a patched quiz question explanation in the quiz DB."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Add repo root to Python path
repo_root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(repo_root))

from src.app import create_app
from src.app.extensions.sqlalchemy_ext import get_quiz_session
from game_modules.quiz.models import QuizQuestion


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify quiz patch content")
    parser.add_argument("--question-id", required=True, help="QuizQuestion.id")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    app = create_app(os.getenv("ENV"))
    with app.app_context():
        with get_quiz_session() as session:
            q = session.query(QuizQuestion).filter(QuizQuestion.id == args.question_id).first()
            print(f"question_id={q.id if q else None}")
            print(f"explanation={q.explanation_key if q else None}")
            return 0 if q else 1


if __name__ == "__main__":
    raise SystemExit(main())