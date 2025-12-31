
import pytest
from flask import Flask
from sqlalchemy import select
from src.app.extensions.sqlalchemy_ext import get_session
from game_modules.quiz import services
from game_modules.quiz.models import QuizTopic, QuizQuestion, QuizRun

# Use the fixture from test_quiz_module
from tests.test_quiz_module import quiz_app

@pytest.fixture
def seeded_quiz_app(quiz_app):
    """App with seeded topic and questions."""
    with get_session() as session:
        # Create topic
        topic = QuizTopic(
            id="test-topic-gold",
            title_key="Test Topic",
            description_key="Test Description",
            is_active=True
        )
        session.add(topic)
        
        # Create 10 questions (2 per difficulty 1-5)
        for diff in range(1, 6):
            for i in range(2):
                q = QuizQuestion(
                    id=f"q-{diff}-{i}",
                    topic_id=topic.id,
                    difficulty=diff,
                    prompt_key=f"Question {diff}-{i}",
                    answers=[
                        {"id": "a1", "text": "Correct", "correct": True},
                        {"id": "a2", "text": "Wrong", "correct": False}
                    ],
                    explanation_key="Explanation"
                )
                session.add(q)
        session.commit()
    return quiz_app

def test_level_scoring_perfect(seeded_quiz_app):
    """Test perfect level (2/2) awards bonus."""
    with get_session() as session:
        # Register and start run
        auth = services.register_player(session, "TestPlayer", "1234", False)
        run, _ = services.start_run(session, auth.player_id, "test-topic-gold")
        
        # Answer Q1 (Diff 1) Correct
        res1 = services.submit_answer(session, run, 0, "a1", 1000)
        assert res1.result == "correct"
        assert res1.level_completed is False
        assert res1.running_score == 10
        
        # Answer Q2 (Diff 1) Correct
        res2 = services.submit_answer(session, run, 1, "a1", 2000)
        assert res2.result == "correct"
        assert res2.level_completed is True
        assert res2.level_perfect is True
        assert res2.level_correct_count == 2
        assert res2.level_questions_in_level == 2
        
        # Score: 10 (Q1) + 10 (Q2) + 20 (Bonus for Diff 1) = 40
        assert res2.level_bonus == 20
        assert res2.running_score == 40

def test_level_scoring_partial(seeded_quiz_app):
    """Test partial level (1/2) awards no bonus."""
    with get_session() as session:
        auth = services.register_player(session, "TestPlayer2", "1234", False)
        run, _ = services.start_run(session, auth.player_id, "test-topic-gold")
        
        # Answer Q1 (Diff 1) Correct
        res1 = services.submit_answer(session, run, 0, "a1", 1000)
        assert res1.running_score == 10
        
        # Answer Q2 (Diff 1) Wrong
        res2 = services.submit_answer(session, run, 1, "a2", 2000)
        assert res2.result == "wrong"
        assert res2.level_completed is True
        assert res2.level_perfect is False
        assert res2.level_correct_count == 1
        assert res2.level_questions_in_level == 2
        
        # Score: 10 (Q1) + 0 (Q2) + 0 (Bonus) = 10
        assert res2.level_bonus == 0
        assert res2.running_score == 10

def test_level_scoring_zero(seeded_quiz_app):
    """Test zero level (0/2) awards no bonus."""
    with get_session() as session:
        auth = services.register_player(session, "TestPlayer3", "1234", False)
        run, _ = services.start_run(session, auth.player_id, "test-topic-gold")
        
        # Answer Q1 (Diff 1) Wrong
        res1 = services.submit_answer(session, run, 0, "a2", 1000)
        assert res1.running_score == 0
        
        # Answer Q2 (Diff 1) Wrong
        res2 = services.submit_answer(session, run, 1, "a2", 2000)
        assert res2.level_completed is True
        assert res2.level_perfect is False
        assert res2.level_correct_count == 0
        
        # Score: 0
        assert res2.level_bonus == 0
        assert res2.running_score == 0

def test_finish_idempotency(seeded_quiz_app):
    """Test finish endpoint is idempotent."""
    with get_session() as session:
        auth = services.register_player(session, "TestPlayer4", "1234", False)
        run, _ = services.start_run(session, auth.player_id, "test-topic-gold")
        
        # Answer all questions correct
        for i in range(10):
            services.submit_answer(session, run, i, "a1", 1000)
            
        # Finish first time
        score1 = services.finish_run(session, run)
        session.flush()
        assert score1.total_score > 0
        
        # Finish second time
        score2 = services.finish_run(session, run)
        assert score2.total_score == score1.total_score
        assert len(score2.breakdown) == 5
