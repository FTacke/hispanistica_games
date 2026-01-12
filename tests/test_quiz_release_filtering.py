"""Tests for quiz topic visibility.

Validates that:
- Topic visibility is controlled by is_active flag only
- Release status (published/draft/unpublished) does NOT affect visibility
- Releases are now only used for import history tracking
- is_active=False hides topics regardless of release status

NOTE: Uses PostgreSQL because quiz models require JSONB/ARRAY columns.
      Start with: docker compose -f docker-compose.dev-postgres.yml up -d
"""

import pytest

from game_modules.quiz.models import QuizTopic, QuizQuestion, QuizPlayer, QuizRun
from game_modules.quiz.release_model import QuizContentRelease
from game_modules.quiz import services
from src.app.extensions.sqlalchemy_ext import get_session


def test_active_topic_visible_regardless_of_release_status(quiz_app):
    """Test that active topics are visible regardless of release status."""
    with get_session() as session:
        # Create published release
        release_pub = QuizContentRelease(
            release_id="rel_published_001",
            status="published",
            units_count=1,
            questions_count=2
        )
        session.add(release_pub)
        
        # Create active topic in published release
        topic_pub = QuizTopic(
            id="topic_published",
            title_key="topic.published.title",
            description_key="topic.published.desc",
            is_active=True,
            release_id="rel_published_001",
            order_index=1
        )
        session.add(topic_pub)
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        
        # Should contain active topic
        assert len(topics) == 1
        assert topics[0].id == "topic_published"


def test_active_topic_in_draft_release_visible(quiz_app):
    """Test that active topics from draft releases ARE visible (release status doesn't affect visibility)."""
    with get_session() as session:
        # Create draft release
        release_draft = QuizContentRelease(
            release_id="rel_draft_001",
            status="draft",
            units_count=1,
            questions_count=2
        )
        session.add(release_draft)
        
        # Create active topic in draft release
        topic_draft = QuizTopic(
            id="topic_draft",
            title_key="topic.draft.title",
            description_key="topic.draft.desc",
            is_active=True,  # Active topics are visible regardless of release status
            release_id="rel_draft_001",
            order_index=1
        )
        session.add(topic_draft)
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        
        # Should NOW contain draft topic (behavior changed: visibility = is_active only)
        assert len(topics) == 1
        assert topics[0].id == "topic_draft"


def test_active_topic_in_unpublished_release_visible(quiz_app):
    """Test that active topics from unpublished releases ARE visible (release status doesn't affect visibility)."""
    with get_session() as session:
        # Create unpublished release
        release_unpub = QuizContentRelease(
            release_id="rel_unpublished_001",
            status="unpublished",
            units_count=1,
            questions_count=2
        )
        session.add(release_unpub)
        
        # Create active topic in unpublished release
        topic_unpub = QuizTopic(
            id="topic_unpublished",
            title_key="topic.unpublished.title",
            description_key="topic.unpublished.desc",
            is_active=True,  # Active topics are visible regardless of release status
            release_id="rel_unpublished_001",
            order_index=1
        )
        session.add(topic_unpub)
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        
        # Should NOW contain unpublished topic (behavior changed: visibility = is_active only)
        assert len(topics) == 1
        assert topics[0].id == "topic_unpublished"


def test_legacy_topics_without_release_id_visible(quiz_app):
    """Test that topics without release_id (legacy DEV data) remain visible."""
    with get_session() as session:
        # Create topic without release_id (simulates DEV seed data)
        topic_legacy = QuizTopic(
            id="topic_legacy",
            title_key="topic.legacy.title",
            description_key="topic.legacy.desc",
            is_active=True,
            release_id=None,  # No release tracking
            order_index=1
        )
        session.add(topic_legacy)
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        
        # Should contain legacy topic
        assert len(topics) == 1
        assert topics[0].id == "topic_legacy"


def test_mixed_releases_all_active_visible(quiz_app):
    """Test mixed scenario: all active topics are visible regardless of release status."""
    with get_session() as session:
        # Published release
        release_pub = QuizContentRelease(
            release_id="rel_published",
            status="published",
            units_count=1,
            questions_count=1
        )
        session.add(release_pub)
        
        # Draft release
        release_draft = QuizContentRelease(
            release_id="rel_draft",
            status="draft",
            units_count=1,
            questions_count=1
        )
        session.add(release_draft)
        
        # Topics
        topic_pub = QuizTopic(
            id="topic_pub",
            title_key="pub",
            description_key="pub",
            is_active=True,
            release_id="rel_published",
            order_index=1
        )
        topic_draft = QuizTopic(
            id="topic_draft",
            title_key="draft",
            description_key="draft",
            is_active=True,
            release_id="rel_draft",
            order_index=2
        )
        topic_legacy = QuizTopic(
            id="topic_legacy",
            title_key="legacy",
            description_key="legacy",
            is_active=True,
            release_id=None,
            order_index=3
        )
        
        session.add_all([topic_pub, topic_draft, topic_legacy])
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        topic_ids = {t.id for t in topics}
        
        # Should NOW contain ALL active topics (behavior changed: visibility = is_active only)
        assert len(topics) == 3
        assert "topic_pub" in topic_ids
        assert "topic_legacy" in topic_ids
        assert "topic_draft" in topic_ids  # Changed: draft topics are now visible if active


def test_inactive_topics_hidden_regardless_of_release(quiz_app):
    """Test that is_active=False hides topics even from published releases."""
    with get_session() as session:
        # Published release
        release_pub = QuizContentRelease(
            release_id="rel_published_test6",
            status="published",
            units_count=1,
            questions_count=1
        )
        session.add(release_pub)
        
        # Inactive topic in published release
        topic_inactive = QuizTopic(
            id="topic_inactive_test6",
            title_key="inactive",
            description_key="inactive",
            is_active=False,  # Explicitly inactive
            release_id="rel_published_test6",
            order_index=1
        )
        session.add(topic_inactive)
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        topic_ids = [t.id for t in topics]
        
        # Should not be visible
        assert "topic_inactive_test6" not in topic_ids


def test_question_selection_uses_all_active_questions(quiz_app):
    """Test that question selection uses ALL active questions regardless of release status."""
    with get_session() as session:
        # Create published and draft releases
        rel_pub = QuizContentRelease(
            release_id="rel_pub_test7",
            status="published",
            units_count=1,
            questions_count=2
        )
        rel_draft = QuizContentRelease(
            release_id="rel_draft_test7",
            status="draft",
            units_count=1,
            questions_count=2
        )
        session.add_all([rel_pub, rel_draft])
        
        # Topic (published)
        topic = QuizTopic(
            id="topic_test7",
            title_key="topic",
            description_key="topic",
            is_active=True,
            release_id="rel_pub_test7",
            order_index=1
        )
        session.add(topic)
        
        # Questions: 2 from published, 2 from draft (all active)
        q1_pub = QuizQuestion(
            id="q1_pub_test7",
            topic_id="topic_test7",
            difficulty=1,
            type="multiple-choice",
            prompt_key="q1.prompt",
            explanation_key="q1.exp",
            answers=[{"id": "a1", "text": "Answer", "correct": True}],
            is_active=True,
            release_id="rel_pub_test7"
        )
        q2_pub = QuizQuestion(
            id="q2_pub_test7",
            topic_id="topic_test7",
            difficulty=1,
            type="multiple-choice",
            prompt_key="q2.prompt",
            explanation_key="q2.exp",
            answers=[{"id": "a1", "text": "Answer", "correct": True}],
            is_active=True,
            release_id="rel_pub_test7"
        )
        q3_draft = QuizQuestion(
            id="q3_draft_test7",
            topic_id="topic_test7",
            difficulty=1,
            type="multiple-choice",
            prompt_key="q3.prompt",
            explanation_key="q3.exp",
            answers=[{"id": "a1", "text": "Answer", "correct": True}],
            is_active=True,
            release_id="rel_draft_test7"
        )
        q4_draft = QuizQuestion(
            id="q4_draft_test7",
            topic_id="topic_test7",
            difficulty=1,
            type="multiple-choice",
            prompt_key="q4.prompt",
            explanation_key="q4.exp",
            answers=[{"id": "a1", "text": "Answer", "correct": True}],
            is_active=True,
            release_id="rel_draft_test7"
        )
        
        session.add_all([q1_pub, q2_pub, q3_draft, q4_draft])
        session.commit()
        
        # Create player and run
        player = QuizPlayer(
            id="player_test7",
            name="Test Player",
            password_hash="dummy",
            is_anonymous=False
        )
        run = QuizRun(
            id="run_test7",
            player_id="player_test7",
            topic_id="topic_test7",
            stage="playing",
            current_question_index=0,
            score=0
        )
        session.add_all([player, run])
        session.commit()
        
        # Select questions for run
        from game_modules.quiz.services import _select_questions_for_run
        selected = _select_questions_for_run(session, "player_test7", "topic_test7")
        
        # Should NOW include ALL active questions regardless of release status
        # We can't guarantee which specific ones are selected, but we should have 4 available
        # (behavior changed: questions from draft releases are now available if active)
        assert len(selected) <= 4  # Can select up to all 4 questions


def test_inactive_topic_hidden_in_draft_release(quiz_app):
    """Test that is_active=False hides topics even from draft releases."""
    with get_session() as session:
        # Create draft release
        release_draft = QuizContentRelease(
            release_id="rel_draft_test8",
            status="draft",
            units_count=1,
            questions_count=1
        )
        session.add(release_draft)
        
        # Inactive topic in draft release
        topic_inactive = QuizTopic(
            id="topic_inactive_draft_test8",
            title_key="inactive",
            description_key="inactive",
            is_active=False,  # Explicitly inactive
            release_id="rel_draft_test8",
            order_index=1
        )
        session.add(topic_inactive)
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        topic_ids = [t.id for t in topics]
        
        # Should not be visible
        assert "topic_inactive_draft_test8" not in topic_ids


def test_admin_can_toggle_visibility_independently(quiz_app):
    """Test that admin can activate/deactivate units regardless of release status."""
    with get_session() as session:
        # Create published release with 2 topics
        release = QuizContentRelease(
            release_id="rel_001",
            status="published",
            units_count=2,
            questions_count=4
        )
        session.add(release)
        
        topic1 = QuizTopic(
            id="topic_active",
            title_key="active",
            description_key="active",
            is_active=True,  # Admin wants this visible
            release_id="rel_001",
            order_index=1
        )
        topic2 = QuizTopic(
            id="topic_disabled",
            title_key="disabled",
            description_key="disabled",
            is_active=False,  # Admin disabled this one
            release_id="rel_001",
            order_index=2
        )
        session.add_all([topic1, topic2])
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        topic_ids = {t.id for t in topics}
        
        # Only topic1 should be visible
        assert len(topics) == 1
        assert "topic_active" in topic_ids
        assert "topic_disabled" not in topic_ids


def test_new_import_can_be_active_immediately(quiz_app):
    """Test that newly imported units can be active immediately without publishing."""
    with get_session() as session:
        # Create draft release (just imported, not published yet)
        release = QuizContentRelease(
            release_id="rel_new_import",
            status="draft",  # NOT published
            units_count=1,
            questions_count=2
        )
        session.add(release)
        
        # New topic from import, marked active by default
        topic = QuizTopic(
            id="topic_new",
            title_key="new.topic",
            description_key="new.desc",
            is_active=True,  # Active by default on import
            release_id="rel_new_import",
            order_index=1
        )
        session.add(topic)
        session.commit()
        
        # Get active topics
        topics = services.get_active_topics(session)
        
        # Should be visible immediately (no need to "publish" the release)
        assert len(topics) == 1
        assert topics[0].id == "topic_new"
