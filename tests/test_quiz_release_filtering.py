"""Tests for quiz release filtering.

Validates that:
- Only topics/questions from published releases are visible in frontend
- Draft releases are hidden
- Topics/questions without release_id (DEV mode) remain visible
- Backward compatibility with existing data
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from game_modules.quiz.models import QuizBase, QuizTopic, QuizQuestion
from game_modules.quiz.release_model import QuizContentRelease
from game_modules.quiz import services


@pytest.fixture
def in_memory_db():
    """Create in-memory SQLite database for testing."""
    engine = create_engine('sqlite:///:memory:', echo=False)
    QuizBase.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session
    
    session.close()
    engine.dispose()


def test_published_release_visible(in_memory_db):
    """Test that topics from published releases are visible."""
    # Create published release
    release_pub = QuizContentRelease(
        release_id="rel_published_001",
        status="published",
        units_count=1,
        questions_count=2
    )
    in_memory_db.add(release_pub)
    
    # Create topic in published release
    topic_pub = QuizTopic(
        id="topic_published",
        title_key="topic.published.title",
        description_key="topic.published.desc",
        is_active=True,
        release_id="rel_published_001",
        order_index=1
    )
    in_memory_db.add(topic_pub)
    in_memory_db.commit()
    
    # Get active topics
    topics = services.get_active_topics(in_memory_db)
    
    # Should contain published topic
    assert len(topics) == 1
    assert topics[0].id == "topic_published"


def test_draft_release_hidden(in_memory_db):
    """Test that topics from draft releases are hidden."""
    # Create draft release
    release_draft = QuizContentRelease(
        release_id="rel_draft_001",
        status="draft",
        units_count=1,
        questions_count=2
    )
    in_memory_db.add(release_draft)
    
    # Create topic in draft release
    topic_draft = QuizTopic(
        id="topic_draft",
        title_key="topic.draft.title",
        description_key="topic.draft.desc",
        is_active=True,
        release_id="rel_draft_001",
        order_index=1
    )
    in_memory_db.add(topic_draft)
    in_memory_db.commit()
    
    # Get active topics
    topics = services.get_active_topics(in_memory_db)
    
    # Should NOT contain draft topic
    assert len(topics) == 0


def test_unpublished_release_hidden(in_memory_db):
    """Test that topics from unpublished releases are hidden."""
    # Create unpublished release
    release_unpub = QuizContentRelease(
        release_id="rel_unpublished_001",
        status="unpublished",
        units_count=1,
        questions_count=2
    )
    in_memory_db.add(release_unpub)
    
    # Create topic in unpublished release
    topic_unpub = QuizTopic(
        id="topic_unpublished",
        title_key="topic.unpublished.title",
        description_key="topic.unpublished.desc",
        is_active=True,
        release_id="rel_unpublished_001",
        order_index=1
    )
    in_memory_db.add(topic_unpub)
    in_memory_db.commit()
    
    # Get active topics
    topics = services.get_active_topics(in_memory_db)
    
    # Should NOT contain unpublished topic
    assert len(topics) == 0


def test_legacy_topics_without_release_id_visible(in_memory_db):
    """Test that topics without release_id (legacy DEV data) remain visible."""
    # Create topic without release_id (simulates DEV seed data)
    topic_legacy = QuizTopic(
        id="topic_legacy",
        title_key="topic.legacy.title",
        description_key="topic.legacy.desc",
        is_active=True,
        release_id=None,  # No release tracking
        order_index=1
    )
    in_memory_db.add(topic_legacy)
    in_memory_db.commit()
    
    # Get active topics
    topics = services.get_active_topics(in_memory_db)
    
    # Should contain legacy topic
    assert len(topics) == 1
    assert topics[0].id == "topic_legacy"


def test_mixed_releases(in_memory_db):
    """Test mixed scenario: published + draft + legacy."""
    # Published release
    release_pub = QuizContentRelease(
        release_id="rel_published",
        status="published",
        units_count=1,
        questions_count=1
    )
    in_memory_db.add(release_pub)
    
    # Draft release
    release_draft = QuizContentRelease(
        release_id="rel_draft",
        status="draft",
        units_count=1,
        questions_count=1
    )
    in_memory_db.add(release_draft)
    
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
    
    in_memory_db.add_all([topic_pub, topic_draft, topic_legacy])
    in_memory_db.commit()
    
    # Get active topics
    topics = services.get_active_topics(in_memory_db)
    topic_ids = {t.id for t in topics}
    
    # Should contain: published + legacy, NOT draft
    assert len(topics) == 2
    assert "topic_pub" in topic_ids
    assert "topic_legacy" in topic_ids
    assert "topic_draft" not in topic_ids


def test_inactive_topics_hidden_regardless_of_release(in_memory_db):
    """Test that is_active=False hides topics even from published releases."""
    # Published release
    release_pub = QuizContentRelease(
        release_id="rel_published",
        status="published",
        units_count=1,
        questions_count=1
    )
    in_memory_db.add(release_pub)
    
    # Inactive topic in published release
    topic_inactive = QuizTopic(
        id="topic_inactive",
        title_key="inactive",
        description_key="inactive",
        is_active=False,  # Explicitly inactive
        release_id="rel_published",
        order_index=1
    )
    in_memory_db.add(topic_inactive)
    in_memory_db.commit()
    
    # Get active topics
    topics = services.get_active_topics(in_memory_db)
    
    # Should be empty (is_active takes precedence)
    assert len(topics) == 0


def test_question_selection_filters_by_release(in_memory_db):
    """Test that question selection only uses questions from published releases."""
    # Create published and draft releases
    rel_pub = QuizContentRelease(
        release_id="rel_pub",
        status="published",
        units_count=1,
        questions_count=2
    )
    rel_draft = QuizContentRelease(
        release_id="rel_draft",
        status="draft",
        units_count=1,
        questions_count=2
    )
    in_memory_db.add_all([rel_pub, rel_draft])
    
    # Topic (published)
    topic = QuizTopic(
        id="topic_001",
        title_key="topic",
        description_key="topic",
        is_active=True,
        release_id="rel_pub",
        order_index=1
    )
    in_memory_db.add(topic)
    
    # Questions: 2 from published, 2 from draft
    q1_pub = QuizQuestion(
        id="q1_pub",
        topic_id="topic_001",
        difficulty=1,
        type="multiple-choice",
        prompt_key="q1.prompt",
        explanation_key="q1.exp",
        answers=[{"id": "a1", "text": "Answer", "correct": True}],
        is_active=True,
        release_id="rel_pub"
    )
    q2_pub = QuizQuestion(
        id="q2_pub",
        topic_id="topic_001",
        difficulty=1,
        type="multiple-choice",
        prompt_key="q2.prompt",
        explanation_key="q2.exp",
        answers=[{"id": "a1", "text": "Answer", "correct": True}],
        is_active=True,
        release_id="rel_pub"
    )
    q3_draft = QuizQuestion(
        id="q3_draft",
        topic_id="topic_001",
        difficulty=1,
        type="multiple-choice",
        prompt_key="q3.prompt",
        explanation_key="q3.exp",
        answers=[{"id": "a1", "text": "Answer", "correct": True}],
        is_active=True,
        release_id="rel_draft"
    )
    q4_draft = QuizQuestion(
        id="q4_draft",
        topic_id="topic_001",
        difficulty=1,
        type="multiple-choice",
        prompt_key="q4.prompt",
        explanation_key="q4.exp",
        answers=[{"id": "a1", "text": "Answer", "correct": True}],
        is_active=True,
        release_id="rel_draft"
    )
    
    in_memory_db.add_all([q1_pub, q2_pub, q3_draft, q4_draft])
    in_memory_db.commit()
    
    # Create player and run
    from game_modules.quiz.models import QuizPlayer, QuizRun
    player = QuizPlayer(
        id="player_test",
        name="Test Player",
        password_hash="dummy",
        is_anonymous=False
    )
    run = QuizRun(
        id="run_test",
        player_id="player_test",
        topic_id="topic_001",
        stage="playing",
        current_question_index=0,
        score=0
    )
    in_memory_db.add_all([player, run])
    in_memory_db.commit()
    
    # Select questions for run
    from game_modules.quiz.services import _select_questions_for_run
    selected = _select_questions_for_run(in_memory_db, "player_test", "topic_001")
    
    # Should only contain questions from published release
    selected_ids = {q.id for q in selected}
    assert "q1_pub" in selected_ids or "q2_pub" in selected_ids
    assert "q3_draft" not in selected_ids
    assert "q4_draft" not in selected_ids
