"""Phase 1 tests for quiz mechanics v2 (3 levels, 4/4/2 distribution, tokens soft removal)."""

from __future__ import annotations

from src.app.extensions.sqlalchemy_ext import get_session


def test_v2_selection_distribution(monkeypatch, seeded_quiz_db_v2):
    """v2 selection should return 10 questions with 4/4/2 distribution."""
    monkeypatch.setenv("QUIZ_MECHANICS_VERSION", "v2")

    from game_modules.quiz.services import select_questions_for_run

    with get_session() as session:
        questions = select_questions_for_run(
            session=session,
            topic_id="test_topic_v2",
            player_id=None,
        )

    assert len(questions) == 10

    difficulty_counts = {}
    for q in questions:
        difficulty_counts[q["difficulty"]] = difficulty_counts.get(q["difficulty"], 0) + 1

    assert difficulty_counts.get(1, 0) == 4
    assert difficulty_counts.get(2, 0) == 4
    assert difficulty_counts.get(3, 0) == 2


def test_v2_level_completion_indices(monkeypatch, quiz_client, seeded_quiz_db_v2):
    """v2 level completion should occur at indices 3, 7, 9 (4/4/2)."""
    monkeypatch.setenv("QUIZ_MECHANICS_VERSION", "v2")

    quiz_client.post(
        "/api/quiz/auth/register",
        json={"name": "V2Player", "pin": "1234"},
    )

    start_response = quiz_client.post("/api/quiz/test_topic_v2/run/start", json={})
    assert start_response.status_code == 200
    run_id = start_response.get_json()["run"]["run_id"]

    expected_level_complete = {3, 7, 9}

    for idx in range(10):
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": idx, "started_at_ms": 1000000 + idx * 1000},
        )
        answer_response = quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": idx, "selected_answer_id": 1, "answered_at_ms": 1000500 + idx * 1000},
        )
        assert answer_response.status_code == 200
        data = answer_response.get_json()

        assert data.get("level_completed") is (idx in expected_level_complete)
        if idx in expected_level_complete:
            expected_level_size = 4 if idx in {3, 7} else 2
            assert data.get("level_perfect") is True
            assert data.get("level_questions_in_level") == expected_level_size
            assert data.get("level_correct_count") == expected_level_size


def test_v2_finish_tokens_zero(monkeypatch, quiz_client, seeded_quiz_db_v2):
    """v2 finish response should always return tokens_count = 0."""
    monkeypatch.setenv("QUIZ_MECHANICS_VERSION", "v2")

    quiz_client.post(
        "/api/quiz/auth/register",
        json={"name": "V2Finish", "pin": "5678"},
    )

    start_response = quiz_client.post("/api/quiz/test_topic_v2/run/start", json={})
    assert start_response.status_code == 200
    run_id = start_response.get_json()["run"]["run_id"]

    for idx in range(10):
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": idx, "started_at_ms": 2000000 + idx * 1000},
        )
        quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": idx, "selected_answer_id": 1, "answered_at_ms": 2000500 + idx * 1000},
        )

    finish_response = quiz_client.post(f"/api/quiz/run/{run_id}/finish")
    assert finish_response.status_code == 200
    data = finish_response.get_json()
    assert data.get("tokens_count") == 0
