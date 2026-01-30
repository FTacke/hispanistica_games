"""Phase 2 tests for quiz timer defaults (named vs anonymous + media bonus)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from src.app.extensions.sqlalchemy_ext import get_session


def _create_player(session, name: str, is_anonymous: bool) -> str:
    from game_modules.quiz.models import QuizPlayer
    from game_modules.quiz.services import normalize_name

    player_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    session.add(
        QuizPlayer(
            id=player_id,
            name=name,
            normalized_name=normalize_name(name),
            pin_hash=None if is_anonymous else "test-hash",
            is_anonymous=is_anonymous,
            created_at=now,
            last_seen_at=now,
        )
    )
    session.flush()
    return player_id


def _create_topic_question(session, topic_id: str, question_id: str, media: list | None):
    from game_modules.quiz.models import QuizTopic, QuizQuestion

    topic = QuizTopic(
        id=topic_id,
        title_key=f"{topic_id}.title",
        description_key=f"{topic_id}.desc",
        is_active=True,
    )
    session.add(topic)

    question = QuizQuestion(
        id=question_id,
        topic_id=topic_id,
        difficulty=1,
        type="single_choice",
        prompt_key="prompt",
        explanation_key="explanation",
        answers=[
            {"id": 1, "text_key": "a1", "correct": True},
            {"id": 2, "text_key": "a2", "correct": False},
            {"id": 3, "text_key": "a3", "correct": False},
            {"id": 4, "text_key": "a4", "correct": False},
        ],
        media=media,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    session.add(question)
    session.flush()


def _create_run(session, player_id: str, topic_id: str, question_id: str):
    from game_modules.quiz.models import QuizRun

    run = QuizRun(
        id=str(uuid.uuid4()),
        player_id=player_id,
        topic_id=topic_id,
        status="in_progress",
        created_at=datetime.now(timezone.utc),
        current_index=0,
        run_questions=[
            {
                "question_id": question_id,
                "difficulty": 1,
                "answers_order": [1, 2, 3, 4],
                "joker_disabled": [],
            }
        ],
        joker_remaining=2,
        joker_used_on=[],
    )
    session.add(run)
    session.flush()
    return run


def test_timer_named_default_40s(quiz_app):
    from game_modules.quiz import services

    with get_session() as session:
        player_id = _create_player(session, "Named", is_anonymous=False)
        topic_id = "timer_named"
        question_id = "timer_named_q1"
        _create_topic_question(session, topic_id, question_id, media=[])
        run = _create_run(session, player_id, topic_id, question_id)

        ok = services.start_question(session, run, 0)
        session.flush()

    assert ok is True
    assert run.time_limit_seconds == 40


def test_timer_anonymous_media_bonus_250s(quiz_app):
    from game_modules.quiz import services

    with get_session() as session:
        player_id = _create_player(session, "Anon", is_anonymous=True)
        topic_id = "timer_anon"
        question_id = "timer_anon_q1"
        _create_topic_question(
            session,
            topic_id,
            question_id,
            media=[{"id": "m1", "type": "image", "src": "/static/x.png"}],
        )
        run = _create_run(session, player_id, topic_id, question_id)

        ok = services.start_question(session, run, 0)
        session.flush()

    assert ok is True
    assert run.time_limit_seconds == 250
