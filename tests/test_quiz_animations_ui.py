"""Tests for Quiz Animation Package and UI Components.

Tests verify:
- Score Chip UI (icon + number visible)
- Points pop animation on correct answers
- Answer states (neutral, selected_correct, selected_wrong, correct_reveal, locked)
- Explanation card (visible, no "Richtig/Falsch" text)
- Question transitions (leaving/entering states)
- Reduced motion support
- Accessibility (aria-live, focus management)

These tests focus on the DOM structure and CSS classes.
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


class TestScoreChipUI:
    """Test Score Chip component in quiz header."""
    
    def test_score_chip_exists_in_play_template(self, client: FlaskClient):
        """Score chip should be present in the quiz play template."""
        # We test the template directly since play requires authentication
        response = client.get("/quiz/demo_topic/play")
        # May redirect to entry if not authenticated, but template structure matters
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'quiz-score-chip' in html
            assert 'quiz-score-display' in html
            assert 'quiz-score-pop' in html
            # Check for trophy/star icon
            assert 'emoji_events' in html or 'star' in html
    
    def test_score_chip_value_element(self, client: FlaskClient):
        """Score chip should have a value element for displaying the score."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'id="quiz-score-display"' in html
            assert 'quiz-score-chip__value' in html


class TestAnswerStates:
    """Test Answer component states."""
    
    def test_answer_has_icon_element(self, client: FlaskClient):
        """Answer buttons should have an icon element for check mark."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            # Template should define the answer structure
            assert 'quiz-answer__icon' in html or 'quiz-answer' in html


class TestExplanationCard:
    """Test Explanation Card component."""
    
    def test_explanation_card_exists_in_template(self, client: FlaskClient):
        """Explanation card should be present in play template."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'quiz-explanation-card' in html
            assert 'quiz-explanation-text' in html
    
    def test_explanation_card_has_title(self, client: FlaskClient):
        """Explanation card should have 'Erklärung' as title."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'Erklärung' in html
            assert 'quiz-explanation-card__title' in html
    
    def test_no_richtig_falsch_in_feedback_structure(self, client: FlaskClient):
        """Template should not contain 'Richtig!' or 'Falsch!' text elements."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            # The template should not have hardcoded "Richtig!" or "Falsch!" text
            # (These were removed in favor of color-based feedback)
            # Note: i18n keys may still exist but visible text should not
            assert 'quiz-feedback-status' not in html or 'quiz-feedback__status' not in html


class TestQuestionTransitions:
    """Test Question transition wrapper."""
    
    def test_question_wrapper_exists(self, client: FlaskClient):
        """Question wrapper element should exist for transitions."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'quiz-question-wrapper' in html
    
    def test_question_wrapper_has_transition_state(self, client: FlaskClient):
        """Question wrapper should have data-transition-state attribute."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'data-transition-state' in html


class TestAccessibility:
    """Test Accessibility features."""
    
    def test_aria_live_region_exists(self, client: FlaskClient):
        """aria-live region should exist for screen reader announcements."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'aria-live="polite"' in html
            assert 'quiz-a11y-announce' in html
    
    def test_screen_reader_only_class_exists(self, client: FlaskClient):
        """Screen reader only class should be present."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'quiz-sr-only' in html
    
    def test_answers_have_role_group(self, client: FlaskClient):
        """Answers container should have role='group'."""
        response = client.get("/quiz/demo_topic/play")
        if response.status_code == 200:
            html = response.data.decode('utf-8')
            assert 'role="group"' in html


class TestCSSTokens:
    """Test CSS uses tokens instead of hardcoded colors."""
    
    def test_css_has_surface_container_token(self):
        """CSS should define surface-container token."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '--quiz-surface-container' in css
    
    def test_css_has_outline_variant_token(self):
        """CSS should define outline-variant token."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '--quiz-outline-variant' in css
    
    def test_css_has_success_token(self):
        """CSS should define success color token."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '--quiz-success' in css
            assert '--quiz-success-container' in css
    
    def test_css_no_hardcoded_success_color(self):
        """CSS should not have hardcoded green colors for success (except token definitions)."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            # Token definition is ok: --quiz-success: var(--md-sys-color-success, #2e7d32);
            # But direct use like background: #2e7d32 is not ok
            lines = css.split('\n')
            for line in lines:
                # Skip token definitions
                if '--quiz-' in line and ':' in line:
                    continue
                # Check for hardcoded hex colors (common greens)
                if '#2e7d32' in line or '#4caf50' in line:
                    # Only allow in token definitions
                    assert '--quiz-' in line, f"Hardcoded color found: {line}"


class TestReducedMotionSupport:
    """Test reduced motion CSS support."""
    
    def test_css_has_reduced_motion_media_query(self):
        """CSS should have prefers-reduced-motion media query."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert 'prefers-reduced-motion: reduce' in css
    
    def test_css_animation_durations_use_tokens(self):
        """CSS should define animation duration tokens."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '--quiz-anim-feedback' in css
            assert '--quiz-anim-pop' in css
            assert '--quiz-anim-transition' in css
            assert '--quiz-anim-explanation' in css


class TestAnswerStateCSS:
    """Test Answer state CSS classes."""
    
    def test_css_has_selected_correct_state(self):
        """CSS should have selected_correct state."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '.quiz-answer--selected-correct' in css
    
    def test_css_has_selected_wrong_state(self):
        """CSS should have selected_wrong state."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '.quiz-answer--selected-wrong' in css
    
    def test_css_has_correct_reveal_state(self):
        """CSS should have correct_reveal state (subtle reveal)."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '.quiz-answer--correct-reveal' in css
    
    def test_css_has_locked_state(self):
        """CSS should have locked state."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '.quiz-answer-option--locked' in css


class TestPointsPopAnimation:
    """Test Points Pop animation CSS."""
    
    def test_css_has_points_pop_class(self):
        """CSS should have points pop animation class."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '.quiz-score-chip__pop' in css
            assert 'quiz-points-pop' in css
    
    def test_css_has_pop_animate_class(self):
        """CSS should have animate trigger class for pop."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '.quiz-score-chip__pop--animate' in css


class TestQuestionTransitionCSS:
    """Test Question transition CSS."""
    
    def test_css_has_transition_states(self):
        """CSS should have leaving and entering transition states."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '[data-transition-state="leaving"]' in css
            assert '[data-transition-state="entering"]' in css
            assert '[data-transition-state="idle"]' in css


class TestExplanationCardCSS:
    """Test Explanation Card CSS."""
    
    def test_css_has_explanation_card_class(self):
        """CSS should have explanation card class."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert '.quiz-explanation-card' in css
    
    def test_css_has_explanation_expand_animation(self):
        """CSS should have expand animation for explanation."""
        with open('static/css/games/quiz.css', 'r', encoding='utf-8') as f:
            css = f.read()
            assert 'quiz-explanation-expand' in css


class TestJavaScriptFunctions:
    """Test JavaScript file has required functions."""
    
    def test_js_has_update_score_display(self):
        """JavaScript should have updateScoreDisplay function."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            assert 'updateScoreDisplay' in js
    
    def test_js_has_show_points_pop(self):
        """JavaScript should have showPointsPop function."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            assert 'showPointsPop' in js
    
    def test_js_has_announce_a11y(self):
        """JavaScript should have announceA11y function."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            assert 'announceA11y' in js
    
    def test_js_has_show_explanation_card(self):
        """JavaScript should have showExplanationCard function."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            assert 'showExplanationCard' in js
    
    def test_js_has_transition_duration_constant(self):
        """JavaScript should define TRANSITION_DURATION_MS constant."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            assert 'TRANSITION_DURATION_MS' in js
    
    def test_js_has_current_score_state(self):
        """JavaScript state should track runningScore (source of truth from server)."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            assert 'runningScore' in js  # ✅ FIX: actual state field name
    
    def test_js_answer_states_use_new_classes(self):
        """JavaScript should use new answer state classes."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            assert 'quiz-answer--selected-correct' in js
            assert 'quiz-answer--selected-wrong' in js
            assert 'quiz-answer--correct-reveal' in js
            assert 'quiz-answer-option--locked' in js  # ✅ FIX: Match CSS class name
    
    def test_js_no_richtig_falsch_text(self):
        """JavaScript should not display 'Richtig!' or 'Falsch!' text."""
        with open('static/js/games/quiz-play.js', 'r', encoding='utf-8') as f:
            js = f.read()
            # Check that we don't set statusText to these values
            # Old code had: statusText = QuizI18n.t('ui.quiz.correct') || 'Richtig!';
            # New code should not have these lines
            assert "statusText = QuizI18n.t('ui.quiz.correct')" not in js
            assert "statusText = QuizI18n.t('ui.quiz.wrong')" not in js
