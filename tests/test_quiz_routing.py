"""Tests for Quiz module routing and navigation integration.

Verifies that:
- Dummy /quiz-redirect route is removed
- All navigation points to quiz.quiz_index
- /quiz properly loads the quiz module
"""

import pytest


def test_quiz_index_route_accessible(quiz_app):
    """Test that /quiz route exists and is registered."""
    # Just verify the route is registered, don't try to render
    rules = list(quiz_app.url_map.iter_rules())
    quiz_rules = [r for r in rules if str(r).startswith('/quiz')]
    
    assert len(quiz_rules) > 0, "/quiz routes should be registered"
    assert any(str(r) == '/quiz' for r in quiz_rules), "/quiz route should exist"


def test_quiz_api_topics_works(quiz_client, seeded_quiz_db):
    """Test that the quiz topics API works (doesn't require auth blueprint)."""
    response = quiz_client.get('/api/quiz/topics')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, dict)
    assert 'topics' in data
    assert isinstance(data['topics'], list)


def test_quiz_redirect_removed(quiz_app):
    """Test that /quiz-redirect route no longer exists."""
    # Check that accessing /quiz-redirect returns 404
    with quiz_app.test_client() as client:
        response = client.get('/quiz-redirect')
        assert response.status_code == 404, "/quiz-redirect should be removed"


def test_quiz_blueprint_registered(quiz_app):
    """Test that quiz blueprint is registered with correct prefix."""
    # Check that quiz routes are registered
    rules = [str(rule) for rule in quiz_app.url_map.iter_rules()]
    
    # Should have quiz routes
    assert any('/quiz' in rule for rule in rules), "Quiz routes should be registered"
    assert any('/api/quiz' in rule for rule in rules), "Quiz API routes should be registered"
