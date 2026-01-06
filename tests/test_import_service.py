"""Tests for QuizImportService

These tests validate:
- Import creates release record and imports units
- Import is idempotent (running twice produces same result)
- Publish activates release
- Unpublish deactivates release
- List shows all releases
"""

import pytest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from game_modules.quiz.models import QuizBase, QuizTopic, QuizQuestion
from game_modules.quiz.release_model import QuizContentRelease
from game_modules.quiz.import_service import QuizImportService


@pytest.fixture
def in_memory_db():
    """Create in-memory SQLite database for testing."""
    # SQLite in-memory for fast tests
    engine = create_engine('sqlite:///:memory:', echo=False)
    
    # Create all tables
    QuizBase.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session
    
    session.close()
    engine.dispose()


@pytest.fixture
def test_fixtures_path():
    """Path to test fixtures directory."""
    return Path(__file__).parent / "fixtures" / "releases" / "test_release_001"


def test_import_creates_release_and_units(in_memory_db, test_fixtures_path):
    """Test that import creates release record and imports units."""
    service = QuizImportService()
    
    units_path = str(test_fixtures_path / "units")
    audio_path = str(test_fixtures_path / "audio")
    release_id = "test_release_001"
    
    # Import
    result = service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id=release_id,
        dry_run=False
    )
    
    # Verify result
    assert result.success is True
    assert result.units_imported == 1
    assert result.questions_imported == 2
    assert result.release_id == release_id
    
    # Verify release record exists
    release = in_memory_db.query(QuizContentRelease).filter(
        QuizContentRelease.release_id == release_id
    ).first()
    
    assert release is not None
    assert release.status == "draft"
    assert release.units_count == 1
    assert release.questions_count == 2
    assert release.imported_at is not None
    
    # Verify topic exists
    topic = in_memory_db.query(QuizTopic).filter(
        QuizTopic.id == "test_unit_001"
    ).first()
    
    assert topic is not None
    assert topic.title_key == "test.unit.001.title"
    assert topic.release_id == release_id
    
    # Verify questions exist
    questions = in_memory_db.query(QuizQuestion).filter(
        QuizQuestion.topic_id == "test_unit_001"
    ).all()
    
    assert len(questions) == 2
    assert questions[0].release_id == release_id


def test_import_idempotent(in_memory_db, test_fixtures_path):
    """Test that importing same release twice is idempotent."""
    service = QuizImportService()
    
    units_path = str(test_fixtures_path / "units")
    audio_path = str(test_fixtures_path / "audio")
    release_id = "test_release_001"
    
    # First import
    result1 = service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id=release_id,
        dry_run=False
    )
    
    assert result1.success is True
    
    # Get counts before second import
    topics_before = in_memory_db.query(QuizTopic).count()
    questions_before = in_memory_db.query(QuizQuestion).count()
    
    # Second import
    result2 = service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id=release_id,
        dry_run=False
    )
    
    assert result2.success is True
    
    # Verify counts unchanged (UPSERT, not INSERT)
    topics_after = in_memory_db.query(QuizTopic).count()
    questions_after = in_memory_db.query(QuizQuestion).count()
    
    assert topics_after == topics_before
    assert questions_after == questions_before


def test_publish_marks_active_release(in_memory_db, test_fixtures_path):
    """Test that publish marks release as published."""
    service = QuizImportService()
    
    units_path = str(test_fixtures_path / "units")
    audio_path = str(test_fixtures_path / "audio")
    release_id = "test_release_001"
    
    # Import first
    import_result = service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id=release_id,
        dry_run=False
    )
    
    assert import_result.success is True
    
    # Publish
    publish_result = service.publish_release(
        session=in_memory_db,
        release_id=release_id
    )
    
    assert publish_result.success is True
    assert publish_result.units_affected == 1
    
    # Verify status changed
    release = in_memory_db.query(QuizContentRelease).filter(
        QuizContentRelease.release_id == release_id
    ).first()
    
    assert release.status == "published"
    assert release.published_at is not None


def test_unpublish_deactivates(in_memory_db, test_fixtures_path):
    """Test that unpublish marks release as unpublished."""
    service = QuizImportService()
    
    units_path = str(test_fixtures_path / "units")
    audio_path = str(test_fixtures_path / "audio")
    release_id = "test_release_001"
    
    # Import and publish
    service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id=release_id,
        dry_run=False
    )
    
    service.publish_release(
        session=in_memory_db,
        release_id=release_id
    )
    
    # Unpublish
    unpublish_result = service.unpublish_release(
        session=in_memory_db,
        release_id=release_id
    )
    
    assert unpublish_result.success is True
    
    # Verify status changed
    release = in_memory_db.query(QuizContentRelease).filter(
        QuizContentRelease.release_id == release_id
    ).first()
    
    assert release.status == "unpublished"
    assert release.unpublished_at is not None


def test_list_releases(in_memory_db, test_fixtures_path):
    """Test that list_releases returns all releases."""
    service = QuizImportService()
    
    units_path = str(test_fixtures_path / "units")
    audio_path = str(test_fixtures_path / "audio")
    
    # Import two releases
    service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id="test_release_001",
        dry_run=False
    )
    
    service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id="test_release_002",
        dry_run=False
    )
    
    # List releases
    releases = service.list_releases(session=in_memory_db)
    
    assert len(releases) == 2
    assert releases[0]['release_id'] in ["test_release_001", "test_release_002"]
    assert releases[1]['release_id'] in ["test_release_001", "test_release_002"]


def test_dry_run_does_not_write(in_memory_db, test_fixtures_path):
    """Test that dry-run validates but does not write to DB."""
    service = QuizImportService()
    
    units_path = str(test_fixtures_path / "units")
    audio_path = str(test_fixtures_path / "audio")
    release_id = "test_release_001"
    
    # Dry-run import
    result = service.import_release(
        session=in_memory_db,
        units_path=units_path,
        audio_path=audio_path,
        release_id=release_id,
        dry_run=True
    )
    
    assert result.success is True
    assert result.dry_run is True
    
    # Verify nothing written to DB
    release = in_memory_db.query(QuizContentRelease).filter(
        QuizContentRelease.release_id == release_id
    ).first()
    
    assert release is None
    
    topics = in_memory_db.query(QuizTopic).count()
    questions = in_memory_db.query(QuizQuestion).count()
    
    assert topics == 0
    assert questions == 0
