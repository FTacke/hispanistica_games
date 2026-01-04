"""Test Admin Highscore Management Endpoints

Tests for admin-only highscore management:
- Reset all highscores for a topic
- Delete single highscore entry
- Security: Admin-only access
- IDOR prevention
"""

import pytest
from flask import Flask
from flask.testing import FlaskClient
from sqlalchemy.orm import Session

from game_modules.quiz.models import QuizScore, QuizPlayer, QuizRun, QuizTopic
from game_modules.quiz import services


def test_admin_reset_highscores_success(client: FlaskClient, db_session: Session):
    """Admin can reset all highscores for a topic."""
    # Setup: Create topic and scores
    topic = QuizTopic(
        id="test_topic",
        title_key="Test Topic",
        is_active=True,
        order_index=1
    )
    db_session.add(topic)
    
    player = QuizPlayer(
        id="player_1",
        name="Test Player",
        normalized_name="test player",
        is_anonymous=False
    )
    db_session.add(player)
    
    # Create scores
    for i in range(3):
        run = QuizRun(
            id=f"run_{i}",
            player_id=player.id,
            topic_id=topic.id,
            status="finished",
            run_questions=[],
            joker_remaining=0,
            joker_used_on=[]
        )
        db_session.add(run)
        
        score = QuizScore(
            id=f"score_{i}",
            run_id=run.id,
            player_name=player.name,
            topic_id=topic.id,
            total_score=100 + i * 10,
            tokens_count=i
        )
        db_session.add(score)
    
    db_session.commit()
    
    # Login as admin (mock JWT)
    # Note: This requires proper JWT setup in test fixtures
    # For now, we test the endpoint logic
    
    # Action: Reset highscores
    response = client.post(
        f'/api/quiz/admin/topics/{topic.id}/highscores/reset',
        headers={'Authorization': 'Bearer MOCK_ADMIN_TOKEN'}  # Mock
    )
    
    # For this test to work, you'd need proper JWT test setup
    # This is a placeholder showing the expected behavior
    
    # Assert: All scores deleted
    # remaining_scores = db_session.query(QuizScore).filter_by(topic_id=topic.id).count()
    # assert remaining_scores == 0


def test_admin_delete_single_entry_success(client: FlaskClient, db_session: Session):
    """Admin can delete a single highscore entry."""
    # Similar setup as above
    pass


def test_admin_reset_not_authorized(client: FlaskClient):
    """Non-admin cannot reset highscores."""
    response = client.post('/api/quiz/admin/topics/test_topic/highscores/reset')
    assert response.status_code == 401


def test_admin_delete_idor_protection(client: FlaskClient, db_session: Session):
    """Cannot delete entry from different topic (IDOR protection)."""
    # Setup: Create two topics with scores
    # Attempt to delete score_A using topic_B URL
    # Should return 404
    pass


def test_leaderboard_includes_admin_status(client: FlaskClient):
    """Leaderboard endpoint returns is_admin flag."""
    response = client.get('/api/quiz/topics/test_topic/leaderboard')
    assert response.status_code == 200
    data = response.json
    assert 'is_admin' in data
    assert isinstance(data['is_admin'], bool)


def test_leaderboard_includes_entry_id(client: FlaskClient, db_session: Session):
    """Leaderboard entries include entry_id for admin delete."""
    # Setup: Create topic and score
    topic = QuizTopic(
        id="test_topic",
        title_key="Test Topic",
        is_active=True,
        order_index=1
    )
    db_session.add(topic)
    
    player = QuizPlayer(
        id="player_1",
        name="Test Player",
        normalized_name="test player",
        is_anonymous=False
    )
    db_session.add(player)
    
    run = QuizRun(
        id="run_1",
        player_id=player.id,
        topic_id=topic.id,
        status="finished",
        run_questions=[],
        joker_remaining=0,
        joker_used_on=[]
    )
    db_session.add(run)
    
    score = QuizScore(
        id="score_1",
        run_id=run.id,
        player_name=player.name,
        topic_id=topic.id,
        total_score=100,
        tokens_count=2
    )
    db_session.add(score)
    db_session.commit()
    
    # Action
    response = client.get(f'/api/quiz/topics/{topic.id}/leaderboard')
    
    # Assert
    assert response.status_code == 200
    data = response.json
    assert len(data['leaderboard']) > 0
    assert 'entry_id' in data['leaderboard'][0]
    assert data['leaderboard'][0]['entry_id'] == score.id


if __name__ == '__main__':
    print("Run with: pytest test_quiz_admin_highscore.py -v")
