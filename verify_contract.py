import json
import sys
import os

# Set env vars before importing app
os.environ["FLASK_SECRET_KEY"] = "test-secret"
os.environ["FLASK_JWT_SECRET_KEY"] = "test-secret"

from flask import Flask

# Add project root to path
sys.path.append(os.getcwd())

from src.app import create_app
from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from game_modules.quiz.models import QuizBase

def print_json(label, data):
    print(f"\n--- {label} ---")
    print(json.dumps(data, indent=2))

def verify():
    print("Setting up app...")
    os.environ["FLASK_SECRET_KEY"] = "test-secret"
    os.environ["FLASK_JWT_SECRET_KEY"] = "test-secret"
    
    app = create_app()
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    # Use real dev DB
    app.config["AUTH_DATABASE_URL"] = "postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth"
    
    # Initialize DB
    with app.app_context():
        init_engine(app)
        # Don't create tables, assume they exist
        
        # Seed test topic (force recreate)
        from game_modules.quiz.models import QuizTopic, QuizQuestion, QuizRun, QuizRunAnswer
        from sqlalchemy import select, delete
        with get_session() as session:
            # Clean up runs for test_topic to avoid FK issues
            session.execute(delete(QuizRunAnswer).where(QuizRunAnswer.run_id.in_(
                select(QuizRun.id).where(QuizRun.topic_id == "test_topic")
            )))
            session.execute(delete(QuizRun).where(QuizRun.topic_id == "test_topic"))
            
            # Delete topic and questions
            session.execute(delete(QuizQuestion).where(QuizQuestion.topic_id == "test_topic"))
            session.execute(delete(QuizTopic).where(QuizTopic.id == "test_topic"))
            session.commit()

            print("Seeding test_topic...")
            topic = QuizTopic(id="test_topic", title_key="t", description_key="d", is_active=True)
            session.add(topic)
            # Add question 0 (difficulty 1)
            q0 = QuizQuestion(
                id="q0", topic_id="test_topic", difficulty=1, type="single_choice",
                prompt_key="p", explanation_key="e",
                answers=[{"id": 1, "text_key": "a1", "correct": True}, {"id": 2, "text_key": "a2", "correct": False}]
            )
            session.add(q0)
            # Add question 1 (difficulty 1)
            q1 = QuizQuestion(
                id="q1", topic_id="test_topic", difficulty=1, type="single_choice",
                prompt_key="p", explanation_key="e",
                answers=[{"id": 1, "text_key": "a1", "correct": True}, {"id": 2, "text_key": "a2", "correct": False}]
            )
            session.add(q1)
            session.commit()

    client = app.test_client()

    print("1. Registering user...")
    auth_resp = client.post("/api/quiz/auth/name-pin", json={"name": "ContractTest", "pin": "1234"})
    if auth_resp.status_code != 200:
        print(f"Auth failed: {auth_resp.text}")
        return

    print("2. Starting run...")
    start_resp = client.post("/api/quiz/test_topic/run/start", json={"force_new": True})
    if start_resp.status_code != 200:
        print(f"Start failed: {start_resp.text}")
        return
    
    run_data = start_resp.get_json()
    run_id = run_data["run"]["run_id"]
    print(f"Run ID: {run_id}")

    print("3. Starting question 0...")
    client.post(f"/api/quiz/run/{run_id}/question/start", json={"question_index": 0, "started_at_ms": 1000000})

    print("4. Submitting answer 0 (correct)...")
    answer_resp = client.post(f"/api/quiz/run/{run_id}/answer", json={
        "question_index": 0,
        "selected_answer_id": 1,
        "answered_at_ms": 1001000
    })
    if answer_resp.status_code != 200:
        print(f"Answer 0 failed: {answer_resp.text}")
        return
    
    print("5. Starting question 1...")
    client.post(f"/api/quiz/run/{run_id}/question/start", json={"question_index": 1, "started_at_ms": 1002000})

    print("6. Submitting answer 1 (correct) - Expecting Level Completion...")
    # Assuming test_topic question 1 (difficulty 1) has correct answer id 1 or 2?
    # In seeded data: test_q1_2 has correct answer id 1? No, let's check seed_quiz_data.sql or the inline seed in verify_contract.py
    # The inline seed in verify_contract.py only added q0. I need to add q1.
    
    answer_resp = client.post(f"/api/quiz/run/{run_id}/answer", json={
        "question_index": 1,
        "selected_answer_id": 1, # Need to ensure this is correct for q1
        "answered_at_ms": 1003000
    })
    
    if answer_resp.status_code != 200:
        print(f"Answer 1 failed: {answer_resp.text}")
        return

    answer_data = answer_resp.get_json()
    print_json("/answer (Q1) Response", answer_data)

    print("7. Getting status...")
    status_resp = client.get(f"/api/quiz/run/{run_id}/status")
    
    if status_resp.status_code != 200:
        print(f"Status failed: {status_resp.text}")
        return

    status_data = status_resp.get_json()
    print_json("/status Response", status_data)

    print("8. Verifying consistency...")
    
    # Check /answer fields
    required_answer_fields = [
        "running_score", "earned_points", "level_completed", 
        "level_perfect", "level_bonus", "bonus_applied_now", 
        "is_run_finished", "next_question_index"
    ]
    for field in required_answer_fields:
        if field not in answer_data:
            print(f"MISSING in /answer: {field}")
        else:
            print(f"OK: /answer has {field}")

    # Check /status fields
    required_status_fields = ["running_score", "current_index", "is_run_finished"]
    for field in required_status_fields:
        if field not in status_data:
            print(f"MISSING in /status: {field}")
        else:
            print(f"OK: /status has {field}")

    # Check consistency
    if answer_data["running_score"] == status_data["running_score"]:
        print(f"SUCCESS: running_score matches ({answer_data['running_score']})")
    else:
        print(f"FAILURE: running_score mismatch! /answer={answer_data['running_score']}, /status={status_data['running_score']}")

if __name__ == "__main__":
    try:
        verify()
    except Exception as e:
        print(f"Error: {e}")
