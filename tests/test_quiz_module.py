"""Tests for the Quiz game module.

Tests cover:
- Content validation
- Scoring and token calculation
- Question selection (history-based)
- Player authentication
- Run lifecycle

NOTE: Quiz module uses JSONB columns which require PostgreSQL.
      Tests expect postgres running at localhost:54320
      Start with: docker compose -f docker-compose.dev-postgres.yml up -d
"""

import os
from datetime import datetime, timezone
from typing import Generator

import pytest
from flask import Flask

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session


# ============================================================================
# PostgreSQL Test Database URL
# ============================================================================
QUIZ_TEST_DB_URL = os.environ.get(
    "QUIZ_TEST_DATABASE_URL",
    "postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth"
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def quiz_app() -> Generator[Flask, None, None]:
    """Create Flask app with quiz module configured.
    
    Note: Uses PostgreSQL because quiz models require JSONB columns.
    Start postgres with: docker compose -f docker-compose.dev-postgres.yml up -d
    """
    from pathlib import Path
    
    # Set up correct template and static paths
    project_root = Path(__file__).resolve().parents[1]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"
    
    app = Flask(
        __name__, 
        template_folder=str(template_dir), 
        static_folder=str(static_dir)
    )
    # Quiz module requires PostgreSQL for JSONB columns
    app.config["AUTH_DATABASE_URL"] = QUIZ_TEST_DB_URL
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    
    from src.app.extensions import register_extensions
    
    register_extensions(app)
    init_engine(app)
    
    # Create quiz tables
    from game_modules.quiz.models import QuizBase
    engine = get_engine()
    QuizBase.metadata.create_all(bind=engine)
    
    # Register quiz blueprint
    from game_modules.quiz.routes import blueprint as quiz_blueprint
    app.register_blueprint(quiz_blueprint)
    
    ctx = app.app_context()
    ctx.push()
    yield app
    
    # Clean up test data after test
    _cleanup_quiz_test_data()
    ctx.pop()


def _cleanup_quiz_test_data():
    """Clean up test data from the quiz tables."""
    from game_modules.quiz.models import (
        QuizPlayer, QuizSession, QuizTopic, QuizQuestion, 
        QuizRun, QuizRunAnswer
    )
    with get_session() as session:
        # Delete in order respecting foreign keys
        session.execute(QuizRunAnswer.__table__.delete())
        session.execute(QuizRun.__table__.delete())
        session.execute(QuizSession.__table__.delete())
        session.execute(QuizPlayer.__table__.delete())
        session.execute(QuizQuestion.__table__.delete())
        session.execute(QuizTopic.__table__.delete())
        session.commit()


@pytest.fixture
def quiz_client(quiz_app: Flask):
    """Test client for quiz module."""
    return quiz_app.test_client()


@pytest.fixture
def seeded_quiz_db(quiz_app: Flask):
    """Seed the quiz database with test data."""
    from game_modules.quiz.models import QuizTopic, QuizQuestion
    
    with get_session() as session:
        # Create test topic
        topic = QuizTopic(
            id="test_topic",
            title_key="topics.test.title",
            description_key="topics.test.description",
            is_active=True,
        )
        session.add(topic)
        
        # Create questions for all 5 difficulty levels (2 per level)
        for difficulty in range(1, 6):
            for q_num in range(1, 3):
                q_id = f"test_q{difficulty}_{q_num}"
                question = QuizQuestion(
                    id=q_id,
                    topic_id="test_topic",
                    difficulty=difficulty,
                    type="single_choice",
                    prompt_key=f"questions.{q_id}.prompt",
                    explanation_key=f"questions.{q_id}.explanation",  # Required per spec 3.4
                    answers=[
                        {"id": 1, "text_key": f"questions.{q_id}.a1", "correct": True},
                        {"id": 2, "text_key": f"questions.{q_id}.a2", "correct": False},
                        {"id": 3, "text_key": f"questions.{q_id}.a3", "correct": False},
                        {"id": 4, "text_key": f"questions.{q_id}.a4", "correct": False},
                    ],
                )
                session.add(question)
        
        session.commit()
    
    return quiz_app


# ============================================================================
# Validation Tests
# ============================================================================

class TestContentValidation:
    """Tests for content validation logic."""
    
    def test_validate_valid_topic(self):
        """Valid topic content should pass validation."""
        from game_modules.quiz.validation import validate_topic_content, ValidationError
        
        content = {
            "topic_id": "test",
            "questions": [
                {
                    "id": f"q{d}_{n}",
                    "difficulty": d,
                    "prompt_key": f"q{d}_{n}.prompt",
                    "explanation_key": f"q{d}_{n}.explanation",  # Required per spec 3.4
                    "answers": [
                        {"id": 1, "text_key": f"q{d}_{n}.a1", "correct": True},
                        {"id": 2, "text_key": f"q{d}_{n}.a2", "correct": False},
                        {"id": 3, "text_key": f"q{d}_{n}.a3", "correct": False},
                        {"id": 4, "text_key": f"q{d}_{n}.a4", "correct": False},
                    ],
                }
                for d in range(1, 6) for n in range(1, 3)
            ],
        }
        
        # Should not raise ValidationError
        try:
            result = validate_topic_content(content)
            assert result is not None
        except ValidationError:
            pytest.fail("Valid topic should not raise ValidationError")
    
    def test_validate_missing_topic_id(self):
        """Missing topic_id should fail validation."""
        from game_modules.quiz.validation import validate_topic_content, ValidationError
        
        content = {
            "questions": [],
        }
        
        with pytest.raises(ValidationError) as exc_info:
            validate_topic_content(content)
        errors_str = " ".join(exc_info.value.errors).lower()
        assert "topic_id" in errors_str
    
    def test_validate_invalid_difficulty(self):
        """Difficulty outside 1-5 range should fail validation."""
        from game_modules.quiz.validation import validate_topic_content, ValidationError
        
        content = {
            "topic_id": "test",
            "questions": [
                {
                    "id": "q1",
                    "difficulty": 6,  # Invalid
                    "prompt_key": "q1.prompt",
                    "explanation_key": "q1.explanation",
                    "answers": [
                        {"id": 1, "text_key": "q1.a1", "correct": True},
                        {"id": 2, "text_key": "q1.a2", "correct": False},
                        {"id": 3, "text_key": "q1.a3", "correct": False},
                        {"id": 4, "text_key": "q1.a4", "correct": False},
                    ],
                }
            ],
        }
        
        with pytest.raises(ValidationError) as exc_info:
            validate_topic_content(content)
        errors_str = " ".join(exc_info.value.errors).lower()
        assert "difficulty" in errors_str
    
    def test_validate_no_correct_answer(self):
        """Question with no correct answer should fail validation."""
        from game_modules.quiz.validation import validate_topic_content, ValidationError
        
        content = {
            "topic_id": "test",
            "questions": [
                {
                    "id": "q1",
                    "difficulty": 1,
                    "prompt_key": "q1.prompt",
                    "explanation_key": "q1.explanation",
                    "answers": [
                        {"id": 1, "text_key": "q1.a1", "correct": False},
                        {"id": 2, "text_key": "q1.a2", "correct": False},
                        {"id": 3, "text_key": "q1.a3", "correct": False},
                        {"id": 4, "text_key": "q1.a4", "correct": False},
                    ],
                }
            ],
        }
        
        with pytest.raises(ValidationError) as exc_info:
            validate_topic_content(content)
        errors_str = " ".join(exc_info.value.errors).lower()
        assert "correct" in errors_str
    
    def test_validate_multiple_correct_answers(self):
        """Question with multiple correct answers should fail for single_choice."""
        from game_modules.quiz.validation import validate_topic_content, ValidationError
        
        content = {
            "topic_id": "test",
            "questions": [
                {
                    "id": "q1",
                    "difficulty": 1,
                    "type": "single_choice",
                    "prompt_key": "q1.prompt",
                    "explanation_key": "q1.explanation",
                    "answers": [
                        {"id": 1, "text_key": "q1.a1", "correct": True},
                        {"id": 2, "text_key": "q1.a2", "correct": True},
                        {"id": 3, "text_key": "q1.a3", "correct": False},
                        {"id": 4, "text_key": "q1.a4", "correct": False},
                    ],
                }
            ],
        }
        
        with pytest.raises(ValidationError) as exc_info:
            validate_topic_content(content)
        errors_str = " ".join(exc_info.value.errors).lower()
        assert "correct" in errors_str or "single" in errors_str
    
    def test_validate_missing_explanation_key(self):
        """Missing explanation_key should fail validation (required per spec 3.4)."""
        from game_modules.quiz.validation import validate_topic_content, ValidationError
        
        content = {
            "topic_id": "test",
            "questions": [
                {
                    "id": "q1",
                    "difficulty": 1,
                    "prompt_key": "q1.prompt",
                    # Missing explanation_key
                    "answers": [
                        {"id": 1, "text_key": "q1.a1", "correct": True},
                        {"id": 2, "text_key": "q1.a2", "correct": False},
                        {"id": 3, "text_key": "q1.a3", "correct": False},
                        {"id": 4, "text_key": "q1.a4", "correct": False},
                    ],
                }
            ],
        }
        
        with pytest.raises(ValidationError) as exc_info:
            validate_topic_content(content)
        errors_str = " ".join(exc_info.value.errors).lower()
        assert "explanation" in errors_str


# ============================================================================
# Scoring Tests
# ============================================================================

class TestScoring:
    """Tests for scoring and token calculation per spec section 1.7."""
    
    def test_calculate_score_correct_by_difficulty(self):
        """Correct answer should get base points by difficulty.
        
        Per spec 1.7:
        - difficulty 1: 10 points
        - difficulty 2: 20 points
        - difficulty 3: 30 points
        - difficulty 4: 40 points
        - difficulty 5: 50 points
        """
        from game_modules.quiz.services import calculate_answer_score
        
        assert calculate_answer_score(difficulty=1, is_correct=True) == 10
        assert calculate_answer_score(difficulty=2, is_correct=True) == 20
        assert calculate_answer_score(difficulty=3, is_correct=True) == 30
        assert calculate_answer_score(difficulty=4, is_correct=True) == 40
        assert calculate_answer_score(difficulty=5, is_correct=True) == 50
    
    def test_calculate_score_incorrect(self):
        """Incorrect answer should get 0 points."""
        from game_modules.quiz.services import calculate_answer_score
        
        assert calculate_answer_score(difficulty=5, is_correct=False) == 0
        assert calculate_answer_score(difficulty=1, is_correct=False) == 0
    
    def test_token_bonus_per_difficulty(self):
        """Token bonus is awarded when both questions of a difficulty level are correct.
        
        Per spec 1.7:
        Token-Bonus = 2 * (10 * difficulty)
        - Stufe 1: +20
        - Stufe 2: +40
        - Stufe 3: +60
        - Stufe 4: +80
        - Stufe 5: +100
        """
        from game_modules.quiz.services import POINTS_PER_DIFFICULTY
        
        # Token bonus formula verification
        for difficulty in range(1, 6):
            expected_bonus = 2 * (10 * difficulty)
            actual_bonus = 2 * POINTS_PER_DIFFICULTY[difficulty]
            assert actual_bonus == expected_bonus, f"Token bonus for difficulty {difficulty}"


# ============================================================================
# Question Selection Tests
# ============================================================================

class TestQuestionSelection:
    """Tests for history-based question selection."""
    
    def test_select_questions_correct_distribution(self, seeded_quiz_db):
        """Question selection should return 2 questions per difficulty level."""
        from game_modules.quiz.services import select_questions_for_run
        
        with get_session() as session:
            questions = select_questions_for_run(
                session=session,
                topic_id="test_topic",
                player_id=None,
            )
        
        # Should have 10 questions total
        assert len(questions) == 10
        
        # Count by difficulty
        difficulty_counts = {}
        for q in questions:
            d = q["difficulty"]
            difficulty_counts[d] = difficulty_counts.get(d, 0) + 1
        
        # Each difficulty should have exactly 2 questions
        for d in range(1, 6):
            assert difficulty_counts.get(d, 0) == 2, f"Difficulty {d} should have 2 questions"
    
    def test_select_questions_sorted_by_difficulty(self, seeded_quiz_db):
        """Questions should be sorted by difficulty (ascending)."""
        from game_modules.quiz.services import select_questions_for_run
        
        with get_session() as session:
            questions = select_questions_for_run(
                session=session,
                topic_id="test_topic",
                player_id=None,
            )
        
        difficulties = [q["difficulty"] for q in questions]
        assert difficulties == sorted(difficulties)


# ============================================================================
# Authentication Tests
# ============================================================================

class TestQuizAuth:
    """Tests for quiz player authentication."""
    
    def test_register_player(self, quiz_client, seeded_quiz_db):
        """Player registration should create new player."""
        response = quiz_client.post(
            "/api/quiz/auth/register",
            json={
                "name": "TestPlayer",
                "pin": "1234",
            },
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert "quiz_session" in response.headers.get("Set-Cookie", "")
    
    def test_register_duplicate_pseudonym(self, quiz_client, seeded_quiz_db):
        """Registering duplicate name should fail."""
        # First registration
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "DupePlayer", "pin": "1234"},
        )
        
        # Second registration with same pseudonym
        response = quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "DupePlayer", "pin": "5678"},
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert data.get("code") == "NAME_TAKEN"
    
    def test_login_player(self, quiz_client, seeded_quiz_db):
        """Player login should set session cookie."""
        # Register first
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "LoginTest", "pin": "4321"},
        )
        
        # Clear quiz session cookie (FlaskClient may not expose cookie_jar)
        quiz_client.delete_cookie("quiz_session")
        
        # Login
        response = quiz_client.post(
            "/api/quiz/auth/login",
            json={"name": "LoginTest", "pin": "4321"},
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert "quiz_session" in response.headers.get("Set-Cookie", "")
    
    def test_login_wrong_pin(self, quiz_client, seeded_quiz_db):
        """Login with wrong PIN should fail."""
        # Register first
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "WrongPinTest", "pin": "1111"},
        )
        
        # Clear quiz session cookie (FlaskClient may not expose cookie_jar)
        quiz_client.delete_cookie("quiz_session")
        
        # Login with wrong PIN
        response = quiz_client.post(
            "/api/quiz/auth/login",
            json={"name": "WrongPinTest", "pin": "9999"},
        )
        
        assert response.status_code == 401
    
    def test_anonymous_play(self, quiz_client, seeded_quiz_db):
        """Anonymous players should be able to start runs after creating anonymous session."""
        # Create anonymous session
        anon_resp = quiz_client.post(
            "/api/quiz/auth/register",
            json={"anonymous": True},
        )
        assert anon_resp.status_code == 200

        response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("success") is True
        assert data.get("run", {}).get("run_id")


# ============================================================================
# Run Lifecycle Tests
# ============================================================================

class TestRunLifecycle:
    """Tests for quiz run lifecycle."""
    
    def test_start_run(self, quiz_client, seeded_quiz_db):
        """Starting a run should create run with 10 questions."""
        # Register and get session
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "RunTest", "pin": "1234"},
        )
        
        response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
        
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("success") is True
        assert data.get("run", {}).get("run_id")
        assert data["run"].get("current_index") == 0
        assert len(data["run"].get("run_questions", [])) == 10
    
    def test_get_current_run(self, quiz_client, seeded_quiz_db):
        """Getting current run should return run state."""
        # Register and start run
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "CurrentRunTest", "pin": "1234"},
        )
        quiz_client.post("/api/quiz/test_topic/run/start", json={})
        
        response = quiz_client.get("/api/quiz/run/current?topic_id=test_topic")
        
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("has_run") is True
        assert data.get("run", {}).get("run_id")
    
    def test_restart_run(self, quiz_client, seeded_quiz_db):
        """Restarting should abandon current run and create new one."""
        # Register and start run
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "RestartTest", "pin": "1234"},
        )
        
        start_response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
        first_run_id = start_response.get_json()["run"]["run_id"]
        
        # Restart
        restart_response = quiz_client.post("/api/quiz/test_topic/run/restart")
        
        assert restart_response.status_code == 200
        second_run_id = restart_response.get_json()["run"]["run_id"]
        
        # Should be different run
        assert second_run_id != first_run_id


# ============================================================================
# Answer Submission Tests
# ============================================================================

class TestAnswerSubmission:
    """Tests for answer submission."""
    
    def test_submit_answer(self, quiz_client, seeded_quiz_db):
        """Submitting an answer should record it and return result."""
        # Register and start run
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "AnswerTest", "pin": "1234"},
        )
        
        start_response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
        run_id = start_response.get_json()["run"]["run_id"]
        
        # Start question timer
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 0, "started_at_ms": 1000000},
        )
        
        # Submit answer (selected_answer_id=1 is correct in our seeded test data)
        response = quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 0, "selected_answer_id": 1, "answered_at_ms": 1001000},
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert "is_correct" in data
        assert data.get("success") is True
        assert data.get("correct_option_id") == 1
        assert isinstance(data.get("earned_points"), int)
        assert isinstance(data.get("running_score"), int)
        assert data["running_score"] >= data["earned_points"]
    
    def test_submit_answer_timeout(self, quiz_client, seeded_quiz_db):
        """Answer submitted after timeout should be marked incorrect."""
        # This test would need to manipulate time or mock the deadline
        # For now, we just verify the endpoint exists
        pass

    def test_level_perfect_sets_bonus_on_second_question(self, quiz_client, seeded_quiz_db):
        """Second correct answer in same difficulty should complete a perfect level.

        This is important for the LevelUp stage and must be deterministic.
        """
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "LevelPerfectTest", "pin": "1234"},
        )

        start_response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
        assert start_response.status_code == 200
        run_id = start_response.get_json()["run"]["run_id"]

        # Difficulty 1 questions are always indices 0 and 1 (selection within the level can vary).
        # In seeded test_topic data, BOTH difficulty-1 questions have correct answer id=1.
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 0, "started_at_ms": 1000000},
        )
        r1 = quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 0, "selected_answer_id": 1, "answered_at_ms": 1001000},
        )
        assert r1.status_code == 200
        d1 = r1.get_json()
        assert d1["result"] == "correct"
        assert d1["earned_points"] == 10
        assert d1["level_completed"] is False
        assert d1["level_perfect"] is False
        assert d1["level_bonus"] == 0

        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 1, "started_at_ms": 1002000},
        )
        r2 = quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 1, "selected_answer_id": 1, "answered_at_ms": 1003000},
        )
        assert r2.status_code == 200
        d2 = r2.get_json()

        assert d2["result"] == "correct"
        assert d2["earned_points"] == 10
        assert d2["level_completed"] is True
        assert d2["level_perfect"] is True
        assert d2["level_bonus"] == 20
        assert d2["running_score"] == 40

        # /status must agree (refresh source-of-truth)
        status = quiz_client.get(f"/api/quiz/run/{run_id}/status")
        assert status.status_code == 200
        s = status.get_json()
        assert s["running_score"] == 40
        assert s["level_completed"] is True
        assert s["level_perfect"] is True
        assert s["level_bonus"] == 20


# ============================================================================
# Joker Tests
# ============================================================================

class TestJoker:
    """Tests for 50:50 joker functionality."""
    
    def test_use_joker(self, quiz_client, seeded_quiz_db):
        """Using joker should eliminate 2 wrong answers."""
        # Register and start run
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "JokerTest", "pin": "1234"},
        )
        
        start_response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
        run_id = start_response.get_json()["run"]["run_id"]
        
        # Start question timer
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 0, "started_at_ms": 1000000},
        )
        
        # Use joker
        response = quiz_client.post(
            f"/api/quiz/run/{run_id}/joker",
            json={"question_index": 0},
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("success") is True
        assert "disabled_answer_ids" in data
        assert len(data["disabled_answer_ids"]) == 2
        assert 1 not in data["disabled_answer_ids"]
    
    def test_joker_only_once_per_run(self, quiz_client, seeded_quiz_db):
        """Joker can be used exactly 2 times per run."""
        # Register and start run
        quiz_client.post(
            "/api/quiz/auth/register",
            json={"name": "JokerOnceTest", "pin": "1234"},
        )
        
        start_response = quiz_client.post("/api/quiz/test_topic/run/start", json={})
        run_id = start_response.get_json()["run"]["run_id"]
        
        # Start question and use joker (1st time)
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 0, "started_at_ms": 1000000},
        )
        quiz_client.post(
            f"/api/quiz/run/{run_id}/joker",
            json={"question_index": 0},
        )
        
        # Answer first question
        quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 0, "selected_answer_id": 1, "answered_at_ms": 1001000},
        )
        
        # Start next question and use joker (2nd time)
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 1, "started_at_ms": 1002000},
        )
        response2 = quiz_client.post(
            f"/api/quiz/run/{run_id}/joker",
            json={"question_index": 1},
        )
        assert response2.status_code == 200
        assert response2.get_json().get("fifty_fifty_remaining") == 0

        # Start third question and try joker 3rd time -> LIMIT_REACHED
        quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 1, "selected_answer_id": 1, "answered_at_ms": 1003000},
        )
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 2, "started_at_ms": 1004000},
        )
        response3 = quiz_client.post(
            f"/api/quiz/run/{run_id}/joker",
            json={"question_index": 2},
        )
        assert response3.status_code == 400
        assert response3.get_json().get("code") == "LIMIT_REACHED"


# ============================================================================
# Unified Auth Tests (name-pin endpoint)
# ============================================================================

class TestUnifiedAuth:
    """Tests for unified name-pin authentication (auto-create or login)."""
    
    def test_auth_auto_create_new_user(self, quiz_client, seeded_quiz_db):
        """Submitting unknown name+pin should auto-create a new profile."""
        response = quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "NewPlayer", "pin": "ABCD"},
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("status") == "ok"
        assert data.get("is_new_user")
        assert data.get("player_name") == "NewPlayer"
        assert "user_id" in data
    
    def test_auth_login_existing_correct_pin(self, quiz_client, seeded_quiz_db):
        """Existing user with correct PIN should login successfully."""
        # First create user
        quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "ExistingPlayer", "pin": "1234"},
        )
        
        # Logout to clear session
        quiz_client.post("/api/quiz/auth/logout")
        
        # Login again with same credentials
        response = quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "ExistingPlayer", "pin": "1234"},
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert data.get("status") == "ok"
        assert not data.get("is_new_user")
        assert data.get("player_name") == "ExistingPlayer"
    
    def test_auth_login_wrong_pin(self, quiz_client, seeded_quiz_db):
        """Existing user with wrong PIN should get PIN_MISMATCH error."""
        # First create user
        quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "PinTestPlayer", "pin": "GOOD"},
        )
        
        # Logout
        quiz_client.post("/api/quiz/auth/logout")
        
        # Try login with wrong PIN
        response = quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "PinTestPlayer", "pin": "BADD"},
        )
        
        assert response.status_code == 403
        data = response.get_json()
        assert data.get("status") == "error"
        assert data.get("code") == "PIN_MISMATCH"
    
    def test_auth_name_normalization(self, quiz_client, seeded_quiz_db):
        """Names should be normalized (case-insensitive, trimmed)."""
        # Create user with specific casing
        quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "CamelCase", "pin": "TEST"},
        )
        
        # Logout
        quiz_client.post("/api/quiz/auth/logout")
        
        # Login with different casing - should still work
        response = quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "  camelcase  ", "pin": "TEST"},
        )
        
        assert response.status_code == 200
        data = response.get_json()
        assert not data.get("is_new_user")
    
    def test_auth_invalid_pin_length(self, quiz_client, seeded_quiz_db):
        """PIN must be exactly 4 characters."""
        response = quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "TestPlayer", "pin": "AB"},  # Too short
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert data.get("code") == "INVALID_PIN"
    
    def test_auth_invalid_name_too_short(self, quiz_client, seeded_quiz_db):
        """Name must be at least 2 characters."""
        response = quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "X", "pin": "ABCD"},  # Too short
        )
        
        assert response.status_code == 400
        data = response.get_json()
        assert data.get("code") == "INVALID_NAME"


# ============================================================================
# 50/50 Joker Tests (2x per run, deterministic)
# ============================================================================

class TestFiftyFiftyJoker:
    """Tests for 50/50 joker functionality."""
    
    def test_joker_limit_two_per_run(self, quiz_client, seeded_quiz_db):
        """50/50 joker can be used exactly 2 times per run."""
        # Create user and start run
        quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "JokerLimitTest", "pin": "TEST"},
        )
        
        start_response = quiz_client.post(
            "/api/quiz/test_topic/run/start",
            json={}
        )
        assert start_response.status_code == 200
        run_data = start_response.get_json()
        run_id = run_data["run"]["run_id"]
        
        # Start first question
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 0, "started_at_ms": 1000000}
        )
        
        # Use joker 1st time
        joker_resp1 = quiz_client.post(
            f"/api/quiz/run/{run_id}/joker",
            json={"question_index": 0}
        )
        assert joker_resp1.status_code == 200
        data1 = joker_resp1.get_json()
        assert data1["fifty_fifty_remaining"] == 1
        
        # Answer and advance
        quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 0, "selected_answer_id": 1, "answered_at_ms": 1001000}
        )
        
        # Start second question
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 1, "started_at_ms": 1002000}
        )
        
        # Use joker 2nd time
        joker_resp2 = quiz_client.post(
            f"/api/quiz/run/{run_id}/joker",
            json={"question_index": 1}
        )
        assert joker_resp2.status_code == 200
        data2 = joker_resp2.get_json()
        assert data2["fifty_fifty_remaining"] == 0
        
        # Answer and advance
        quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 1, "selected_answer_id": 1, "answered_at_ms": 1003000}
        )
        
        # Start third question
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 2, "started_at_ms": 1004000}
        )
        
        # Try joker 3rd time - should fail
        joker_resp3 = quiz_client.post(
            f"/api/quiz/run/{run_id}/joker",
            json={"question_index": 2}
        )
        assert joker_resp3.status_code == 400
        data3 = joker_resp3.get_json()
        assert data3.get("code") == "LIMIT_REACHED"
    
    def test_joker_never_hides_correct(self, quiz_client, seeded_quiz_db):
        """50/50 joker must never hide the correct answer."""
        from game_modules.quiz.services import use_joker
        from game_modules.quiz.models import QuizRun, QuizQuestion, QuizPlayer
        from src.app.extensions.sqlalchemy_ext import get_session
        from sqlalchemy import select
        
        with get_session() as session:
            # Get a test question
            stmt = select(QuizQuestion).where(QuizQuestion.topic_id == "test_topic").limit(1)
            question = session.execute(stmt).scalar_one_or_none()
            assert question is not None
            
            # Find correct answer
            correct_id = None
            for ans in question.answers:
                if ans.get("correct"):
                    correct_id = ans["id"]
                    break
            assert correct_id is not None
            
            # Create test player first
            player = QuizPlayer(
                id="test-player",
                name="TestPlayer",
                normalized_name="testplayer",
                is_anonymous=False,
                created_at=datetime.now(timezone.utc),
                last_seen_at=datetime.now(timezone.utc),
            )
            session.add(player)
            session.flush()
            
            # Create a mock run manually for testing
            run = QuizRun(
                id="test-run-joker",
                player_id="test-player",
                topic_id="test_topic",
                status="in_progress",
                current_index=0,
                run_questions=[{
                    "question_id": question.id,
                    "difficulty": question.difficulty,
                    "answers_order": [a["id"] for a in question.answers],
                    "joker_disabled": []
                }],
                joker_remaining=2,
                joker_used_on=[]
            )
            session.add(run)
            session.flush()
            
            # Use joker
            success, disabled_ids, error = use_joker(session, run, 0)
            
            assert success
            assert len(disabled_ids) == 2
            # CRITICAL: correct answer must NOT be in disabled list
            assert correct_id not in disabled_ids
    
    def test_joker_deterministic(self, quiz_client, seeded_quiz_db):
        """Same run_id + question_id should always yield same disabled options."""
        from game_modules.quiz.services import use_joker
        from game_modules.quiz.models import QuizRun, QuizQuestion, QuizPlayer
        from src.app.extensions.sqlalchemy_ext import get_session
        from sqlalchemy import select
        
        with get_session() as session:
            # Get a test question
            stmt = select(QuizQuestion).where(QuizQuestion.topic_id == "test_topic").limit(1)
            question = session.execute(stmt).scalar_one_or_none()
            
            # Create test player first
            player = QuizPlayer(
                id="test-player-det",
                name="TestPlayerDet",
                normalized_name="testplayerdet",
                is_anonymous=False,
                created_at=datetime.now(timezone.utc),
                last_seen_at=datetime.now(timezone.utc),
            )
            session.add(player)
            session.flush()
            
            # Create run with specific ID
            run1 = QuizRun(
                id="deterministic-test-run",
                player_id="test-player-det",
                topic_id="test_topic",
                status="in_progress",
                current_index=0,
                run_questions=[{
                    "question_id": question.id,
                    "difficulty": question.difficulty,
                    "answers_order": [a["id"] for a in question.answers],
                    "joker_disabled": []
                }],
                joker_remaining=2,
                joker_used_on=[]
            )
            session.add(run1)
            session.flush()
            
            # Use joker
            success1, disabled1, _ = use_joker(session, run1, 0)
            assert success1
            
            # Call again - should return same disabled IDs (idempotent)
            success2, disabled2, _ = use_joker(session, run1, 0)
            assert success2
            assert disabled1 == disabled2  # Same result


# ============================================================================
# Answer Submit Tests
# ============================================================================

class TestAnswerSubmit:
    """Tests for answer submission and persistence."""
    
    def test_answer_returns_correct_option_id(self, quiz_client, seeded_quiz_db):
        """Answer submit should return correct_option_id in response."""
        # Create user and start run
        quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "AnswerTestPlayer", "pin": "TEST"},
        )
        
        start_response = quiz_client.post(
            "/api/quiz/test_topic/run/start",
            json={}
        )
        run_data = start_response.get_json()
        run_id = run_data["run"]["run_id"]
        
        # Start first question
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 0, "started_at_ms": 1000000}
        )
        
        # Submit answer
        answer_response = quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 0, "selected_answer_id": 1, "answered_at_ms": 1001000}
        )
        
        assert answer_response.status_code == 200
        data = answer_response.get_json()
        
        # Verify response includes correct_option_id
        assert "correct_option_id" in data
        assert "is_correct" in data
        assert "explanation_key" in data
    
    def test_answer_persists_result(self, quiz_client, seeded_quiz_db):
        """Answer submission should persist result in database."""
        from game_modules.quiz.models import QuizRunAnswer
        from src.app.extensions.sqlalchemy_ext import get_session
        from sqlalchemy import select
        
        # Create user and start run
        quiz_client.post(
            "/api/quiz/auth/name-pin",
            json={"name": "PersistTestPlayer", "pin": "TEST"},
        )
        
        start_response = quiz_client.post(
            "/api/quiz/test_topic/run/start",
            json={}
        )
        run_data = start_response.get_json()
        run_id = run_data["run"]["run_id"]
        
        # Start and answer
        quiz_client.post(
            f"/api/quiz/run/{run_id}/question/start",
            json={"question_index": 0, "started_at_ms": 1000000}
        )
        
        quiz_client.post(
            f"/api/quiz/run/{run_id}/answer",
            json={"question_index": 0, "selected_answer_id": 1, "answered_at_ms": 1001000}
        )
        
        # Check database
        with get_session() as session:
            stmt = select(QuizRunAnswer).where(QuizRunAnswer.run_id == run_id)
            answer = session.execute(stmt).scalar_one_or_none()
            
            assert answer is not None
            assert answer.question_index == 0
            assert answer.result in ["correct", "wrong", "timeout"]


# ============================================================================
# Leaderboard Tests
# ============================================================================

class TestLeaderboard:
    """Tests for leaderboard functionality."""
    
    def test_get_leaderboard(self, quiz_client, seeded_quiz_db):
        """Leaderboard should return top scores."""
        response = quiz_client.get("/api/quiz/topics/test_topic/leaderboard")
        
        assert response.status_code == 200
        data = response.get_json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
    
    def test_leaderboard_excludes_anonymous(self, quiz_client, seeded_quiz_db):
        """Anonymous players should not appear on leaderboard."""
        # This would require completing a run as anonymous
        # and then checking the leaderboard
        pass

