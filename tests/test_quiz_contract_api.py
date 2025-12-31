"""Focused contract/regression tests for Quiz API.

These tests specifically guard the frontend-facing JSON contract for:
- /api/quiz/<topic_id>/run/start
- /api/quiz/run/<run_id>/answer
- /api/quiz/run/<run_id>/status

They also cover the historical regression where running_score could lag behind
because the DB insert wasn't flushed before score calculation.

NOTE: Quiz module uses JSONB columns and expects PostgreSQL.
"""

import pytest


@pytest.fixture
def _authed(quiz_client, seeded_quiz_db):
    # Unified auth sets the session cookie.
    resp = quiz_client.post(
        "/api/quiz/auth/name-pin",
        json={"name": "ContractUser", "pin": "TEST"},
    )
    assert resp.status_code == 200
    return quiz_client


def test_answer_and_status_scores_match_and_monotonic(_authed):
    # Start a deterministic new run
    start = _authed.post("/api/quiz/test_topic/run/start", json={"force_new": True})
    assert start.status_code == 200
    run_id = start.get_json()["run"]["run_id"]

    # Q0 start + answer correct
    _authed.post(
        f"/api/quiz/run/{run_id}/question/start",
        json={"question_index": 0, "started_at_ms": 1000000},
    )
    a0 = _authed.post(
        f"/api/quiz/run/{run_id}/answer",
        json={"question_index": 0, "selected_answer_id": 1, "answered_at_ms": 1001000},
    )
    assert a0.status_code == 200
    a0j = a0.get_json()
    assert a0j["success"] is True
    assert isinstance(a0j.get("running_score"), int)
    s0 = a0j["running_score"]

    # Status should reflect the same (regression guard for missing flush)
    st0 = _authed.get(f"/api/quiz/run/{run_id}/status")
    assert st0.status_code == 200
    st0j = st0.get_json()
    assert st0j["run_id"] == run_id
    assert st0j["running_score"] == s0

    # Q1 start + answer wrong (score should not decrease)
    _authed.post(
        f"/api/quiz/run/{run_id}/question/start",
        json={"question_index": 1, "started_at_ms": 1002000},
    )
    a1 = _authed.post(
        f"/api/quiz/run/{run_id}/answer",
        json={"question_index": 1, "selected_answer_id": 2, "answered_at_ms": 1003000},
    )
    assert a1.status_code == 200
    a1j = a1.get_json()
    assert a1j["success"] is True
    assert a1j["running_score"] >= s0

    st1 = _authed.get(f"/api/quiz/run/{run_id}/status")
    assert st1.status_code == 200
    assert st1.get_json()["running_score"] == a1j["running_score"]


def test_timeout_contract_shape(_authed):
    start = _authed.post("/api/quiz/test_topic/run/start", json={"force_new": True})
    run_id = start.get_json()["run"]["run_id"]

    # No selected_answer_id => treated as timeout by service
    _authed.post(
        f"/api/quiz/run/{run_id}/question/start",
        json={"question_index": 0, "started_at_ms": 1000000},
    )
    resp = _authed.post(
        f"/api/quiz/run/{run_id}/answer",
        json={"question_index": 0, "selected_answer_id": None, "answered_at_ms": 1001000},
    )
    assert resp.status_code == 200
    data = resp.get_json()

    # Contract fields used by frontend
    assert data["success"] is True
    assert data["result"] in {"timeout", "wrong", "correct"}
    assert isinstance(data.get("running_score"), int)
    assert "is_run_finished" in data
    assert "next_question_index" in data


def test_expected_errors_not_500(quiz_client, seeded_quiz_db):
    # Run start requires auth
    no_auth = quiz_client.post("/api/quiz/test_topic/run/start", json={})
    assert no_auth.status_code == 401
    assert no_auth.get_json().get("code") in {"AUTH_REQUIRED", "SESSION_INVALID"}

    # Status on missing run returns 404, not 500
    auth = quiz_client.post(
        "/api/quiz/auth/name-pin",
        json={"name": "ErrUser", "pin": "TEST"},
    )
    assert auth.status_code == 200

    missing = quiz_client.get("/api/quiz/run/does-not-exist/status")
    assert missing.status_code == 404
    assert missing.get_json().get("code") == "RUN_NOT_FOUND"
