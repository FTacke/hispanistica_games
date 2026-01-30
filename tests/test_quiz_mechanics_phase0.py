"""Phase 0 smoke tests for quiz mechanics flag and core run behavior."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from src.app.extensions.sqlalchemy_ext import get_session


def _create_player(session, name: str) -> str:
    from game_modules.quiz.models import QuizPlayer
    from game_modules.quiz.services import normalize_name

    player_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    session.add(
        QuizPlayer(
            id=player_id,
            name=name,
            normalized_name=normalize_name(name),
            pin_hash="test-hash",
            is_anonymous=False,
            created_at=now,
            last_seen_at=now,
        )
    )
    session.flush()
    return player_id


def test_mechanics_flag_defaults_to_v2(monkeypatch):
    monkeypatch.delenv("QUIZ_MECHANICS_VERSION", raising=False)

    from game_modules.quiz.config import get_quiz_mechanics_version

    assert get_quiz_mechanics_version() == "v2"


def test_start_run_creates_10_questions(seeded_quiz_db):
    from game_modules.quiz.services import start_run, QUESTIONS_PER_RUN

    with get_session() as session:
        player_id = _create_player(session, "Tester")
        run, is_new = start_run(session, player_id, "test_topic")
        session.commit()

    assert is_new is True
    assert isinstance(run.run_questions, list)
    assert len(run.run_questions) == QUESTIONS_PER_RUN


def test_leaderboard_ordering_is_score_desc_created_at_asc(seeded_quiz_db):
    from game_modules.quiz.models import QuizRun, QuizScore
    from game_modules.quiz.services import get_leaderboard

    with get_session() as session:
        player_id_a = _create_player(session, "Player A")
        player_id_b = _create_player(session, "Player B")

        run_a = QuizRun(
            id=str(uuid.uuid4()),
            player_id=player_id_a,
            topic_id="test_topic",
            status="finished",
            created_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            current_index=10,
            run_questions=[],
            joker_remaining=0,
            joker_used_on=[],
        )
        run_b = QuizRun(
            id=str(uuid.uuid4()),
            player_id=player_id_b,
            topic_id="test_topic",
            status="finished",
            created_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
            current_index=10,
            run_questions=[],
            joker_remaining=0,
            joker_used_on=[],
        )
        session.add_all([run_a, run_b])

        base_time = datetime.now(timezone.utc)
        score_newer = QuizScore(
            run_id=run_b.id,
            player_name="Player B",
            topic_id="test_topic",
            total_score=500,
            tokens_count=0,
            created_at=base_time + timedelta(seconds=5),
        )
        score_older = QuizScore(
            run_id=run_a.id,
            player_name="Player A",
            topic_id="test_topic",
            total_score=500,
            tokens_count=0,
            created_at=base_time,
        )
        session.add_all([score_newer, score_older])
        session.commit()

        leaderboard = get_leaderboard(session, "test_topic", limit=10)

    assert len(leaderboard) >= 2
    assert leaderboard[0]["player_name"] == "Player A"
    assert leaderboard[1]["player_name"] == "Player B"
