"""Integration smoke tests for Quiz module routing and navigation.

Tests verify:
- Canonical /quiz routes work
- Legacy /games/quiz redirects function
- Templates render correctly
- API endpoints respond
- Deep links work
"""

import pytest
from flask import Flask
from flask.testing import FlaskClient

# Import quiz_app fixture from test_quiz_module
pytest_plugins = ["tests.test_quiz_module"]


@pytest.fixture
def client(quiz_app: Flask) -> FlaskClient:
    """Flask test client using quiz_app fixture."""
    return quiz_app.test_client()


class TestQuizRouting:
    """Test canonical /quiz routes and redirects."""
    
    def test_quiz_index_canonical(self, client: FlaskClient):
        """GET /quiz should return 200 and render quiz index."""
        response = client.get("/quiz")
        assert response.status_code == 200
        assert b"Quiz" in response.data or b"quiz" in response.data
        # Check for game-shell marker
        assert b'data-game="quiz"' in response.data
    
    def test_quiz_legacy_redirect(self, client: FlaskClient):
        """GET /games/quiz should redirect to /quiz."""
        response = client.get("/games/quiz", follow_redirects=False)
        assert response.status_code == 301
        assert response.location.endswith("/quiz")
    
    def test_quiz_topic_entry_canonical(self, client: FlaskClient):
        """GET /quiz/<topic_id> should return 200 or 404 for non-existent topic."""
        response = client.get("/quiz/demo_topic")
        # Will be 404 if demo topic not seeded, but route should exist
        assert response.status_code in (200, 404)
    
    def test_quiz_topic_entry_legacy_redirect(self, client: FlaskClient):
        """GET /games/quiz/<topic_id> should redirect to /quiz/<topic_id>."""
        response = client.get("/games/quiz/demo_topic", follow_redirects=False)
        assert response.status_code == 301
        assert response.location.endswith("/quiz/demo_topic")
    
    def test_quiz_play_legacy_redirect(self, client: FlaskClient):
        """GET /games/quiz/<topic_id>/play should redirect to /quiz/<topic_id>/play."""
        response = client.get("/games/quiz/demo_topic/play", follow_redirects=False)
        assert response.status_code == 301
        assert response.location.endswith("/quiz/demo_topic/play")
    
    def test_public_quiz_page_redirect(self, client: FlaskClient):
        """GET /quiz-redirect (public.quiz_page) should redirect to /quiz."""
        response = client.get("/quiz-redirect", follow_redirects=False)
        assert response.status_code == 302
        assert response.location.endswith("/quiz")


class TestQuizAPI:
    """Test Quiz API endpoints."""
    
    def test_api_topics_list(self, client: FlaskClient):
        """GET /api/quiz/topics should return 200 with JSON."""
        response = client.get("/api/quiz/topics")
        assert response.status_code == 200
        assert response.is_json
        data = response.get_json()
        assert "topics" in data
        assert isinstance(data["topics"], list)
    
    def test_api_leaderboard(self, client: FlaskClient):
        """GET /api/quiz/topics/<topic_id>/leaderboard should return 200."""
        response = client.get("/api/quiz/topics/demo_topic/leaderboard")
        # Will be 200 even if empty, or 404 if topic doesn't exist
        assert response.status_code in (200, 404)
        if response.status_code == 200:
            assert response.is_json


class TestNavigationIntegration:
    """Test that navigation and index contain quiz links."""
    
    def test_index_has_quiz_link(self, client: FlaskClient):
        """Index page should contain a link to quiz."""
        response = client.get("/")
        assert response.status_code == 200
        # Check for quiz link or button
        html = response.data.decode('utf-8')
        assert 'quiz' in html.lower()
    
    def test_base_template_renders(self, client: FlaskClient):
        """Quiz pages should render with base template (nav/footer present)."""
        response = client.get("/quiz")
        assert response.status_code == 200
        html = response.data.decode('utf-8')
        # Check for base template markers
        assert 'navigation-drawer' in html or 'top-app-bar' in html
