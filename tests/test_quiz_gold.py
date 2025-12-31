import pytest
from datetime import datetime
from game_modules.quiz import services
from game_modules.quiz.models import QuizRun, QuizScore
from src.app.extensions.sqlalchemy_ext import get_session

def test_finish_run_idempotency(quiz_app):
    """Test that finish_run is idempotent."""
    with get_session() as session:
        # Setup
        player = services.register_player(session, "TestPlayer", "1234").player_id
        
        # Create a dummy topic if none exists
        topic = services.get_active_topics(session)
        if not topic:
            from game_modules.quiz.models import QuizTopic
            t = QuizTopic(id="test-topic", title_key="test", is_active=True, order_index=1)
            session.add(t)
            session.commit()
            topic_id = "test-topic"
        else:
            topic_id = topic[0].id
            
        run, _ = services.start_run(session, player, topic_id)
        
        # Simulate answering all questions
        # We need to mock run_questions to avoid needing actual questions in DB
        run.run_questions = [
            {"question_id": f"q{i}", "difficulty": 1} for i in range(10)
        ]
        session.commit()
        
        # First finish
        result1 = services.finish_run(session, run)
        session.commit()
        
        assert run.status == "finished"
        
        # Second finish
        result2 = services.finish_run(session, run)
        
        assert result1.total_score == result2.total_score
        assert result1.tokens_count == result2.tokens_count
        # Ensure no duplicate scores
        scores = session.query(QuizScore).filter_by(run_id=run.id).all()
        assert len(scores) == 1

def test_leaderboard_empty(quiz_app):
    """Test leaderboard returns empty list instead of crashing."""
    with get_session() as session:
        topic_id = "non_existent_topic"
        leaderboard = services.get_leaderboard(session, topic_id)
        assert isinstance(leaderboard, list)
        assert len(leaderboard) == 0

def test_leaderboard_sorting(quiz_app):
    """Test leaderboard sorting (score DESC, time ASC)."""
    with get_session() as session:
        # Create dummy topic
        from game_modules.quiz.models import QuizTopic, QuizPlayer
        t = QuizTopic(id="t1", title_key="test", is_active=True, order_index=1)
        session.add(t)
        
        # Create dummy player
        p = QuizPlayer(id="p1", name="P1", normalized_name="p1", is_anonymous=True)
        session.add(p)
        session.commit()

        # Create dummy runs
        r1 = QuizRun(id="r1", player_id="p1", topic_id="t1", status="finished", run_questions=[])
        r2 = QuizRun(id="r2", player_id="p1", topic_id="t1", status="finished", run_questions=[])
        r3 = QuizRun(id="r3", player_id="p1", topic_id="t1", status="finished", run_questions=[])
        session.add_all([r1, r2, r3])
        session.commit()

        # Create dummy scores
        s1 = QuizScore(id="1", run_id="r1", player_name="P1", topic_id="t1", total_score=100, tokens_count=0, created_at=datetime(2023, 1, 1, 10, 0, 0))
        s2 = QuizScore(id="2", run_id="r2", player_name="P2", topic_id="t1", total_score=200, tokens_count=0, created_at=datetime(2023, 1, 1, 11, 0, 0))
        s3 = QuizScore(id="3", run_id="r3", player_name="P3", topic_id="t1", total_score=100, tokens_count=0, created_at=datetime(2023, 1, 1, 9, 0, 0)) # Same score as P1, but earlier
        
        session.add_all([s1, s2, s3])
        session.commit()
        
        lb = services.get_leaderboard(session, "t1")
        
        assert len(lb) == 3
        assert lb[0]["player_name"] == "P2" # 200
        assert lb[1]["player_name"] == "P3" # 100, earlier
        assert lb[2]["player_name"] == "P1" # 100, later
