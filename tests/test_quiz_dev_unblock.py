"""Regression test: quiz run start should succeed in dev/test DB."""


def test_api_start_run_returns_200(seeded_quiz_db, quiz_client):
    # Ensure a session cookie exists
    response = quiz_client.get("/quiz/test_topic/play")
    assert response.status_code == 200

    start_response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
    assert start_response.status_code == 200

    data = start_response.get_json()
    assert data["success"] is True
    assert len(data["run"]["run_questions"]) == 10
