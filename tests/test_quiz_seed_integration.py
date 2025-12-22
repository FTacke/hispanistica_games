"""
Integration test for quiz seed idempotency.

This test requires a running PostgreSQL database.
Run with: pytest tests/test_quiz_seed_integration.py -v -s
"""

import json
import pytest
from pathlib import Path
from datetime import datetime, timezone

# Import seed functions
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.seed_quiz_content import (
    load_quiz_content,
    validate_content,
    transform_to_db_schema,
    seed_database,
)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Use test database or main dev database
DATABASE_URL = "postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth"


@pytest.fixture
def db_session():
    """Create a database session for testing."""
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_seed_idempotency(db_session):
    """Test that running seed twice with same content doesn't create duplicates."""
    
    # Simple test content
    content = {
        "schema_version": "quiz_seed_v1",
        "defaults": {"missing_explanation_text": "Erklärung folgt."},
        "quizzes": [
            {
                "title": "Integration Test Quiz",
                "slug": "integration-test-quiz",
                "description": "Test quiz for idempotency",
                "is_active": True,
                "questions": [
                    {
                        "author_initials": "IT",
                        "prompt": "Integration test question 1?",
                        "explanation": "Test explanation",
                        "difficulty": 1,
                        "tags": ["test"],
                        "is_active": True,
                        "answers": [
                            {"text": "Wrong answer", "correct": False},
                            {"text": "Correct answer", "correct": True},
                            {"text": "Another wrong", "correct": False},
                        ]
                    },
                    {
                        "author_initials": "IT",
                        "prompt": "Integration test question 2?",
                        "explanation": "",
                        "difficulty": 2,
                        "tags": ["test"],
                        "is_active": True,
                        "answers": [
                            {"text": "A", "correct": False},
                            {"text": "B", "correct": True},
                            {"text": "C", "correct": False},
                            {"text": "D", "correct": False},
                        ]
                    }
                ]
            }
        ]
    }
    
    # Validate and transform
    validate_content(content)
    topics, questions = transform_to_db_schema(content)
    
    # Count before first import
    count_before_topics = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_topics WHERE id = 'integration-test-quiz'")
    ).scalar()
    count_before_questions = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_questions WHERE topic_id = 'integration-test-quiz'")
    ).scalar()
    
    print(f"\nBefore first seed: {count_before_topics} topics, {count_before_questions} questions")
    
    # First seed
    seed_database(topics, questions, dry_run=False)
    
    count_after_first = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_topics WHERE id = 'integration-test-quiz'")
    ).scalar()
    count_questions_first = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_questions WHERE topic_id = 'integration-test-quiz'")
    ).scalar()
    
    print(f"After first seed: {count_after_first} topics, {count_questions_first} questions")
    
    assert count_after_first == 1
    assert count_questions_first == 2
    
    # Second seed (should be idempotent - no duplicates)
    seed_database(topics, questions, dry_run=False)
    
    count_after_second = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_topics WHERE id = 'integration-test-quiz'")
    ).scalar()
    count_questions_second = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_questions WHERE topic_id = 'integration-test-quiz'")
    ).scalar()
    
    print(f"After second seed: {count_after_second} topics, {count_questions_second} questions")
    
    # Should still be 1 topic and 2 questions (no duplicates)
    assert count_after_second == 1
    assert count_questions_second == 2
    
    # Verify author_initials was stored
    result = db_session.execute(
        text("SELECT author_initials FROM quiz_questions WHERE topic_id = 'integration-test-quiz' LIMIT 1")
    ).scalar()
    
    assert result == "IT"
    
    print("\n✅ Idempotency test passed!")


def test_seed_updates_existing_content(db_session):
    """Test that re-seeding updates existing records."""
    
    # First version of content
    content_v1 = {
        "schema_version": "quiz_seed_v1",
        "defaults": {"missing_explanation_text": "Default"},
        "quizzes": [
            {
                "title": "Update Test Quiz V1",
                "slug": "update-test-quiz",
                "description": "Original description",
                "is_active": True,
                "questions": [
                    {
                        "author_initials": "UT",
                        "prompt": "Original question?",
                        "explanation": "Original explanation",
                        "difficulty": 1,
                        "answers": [
                            {"text": "A", "correct": True},
                            {"text": "B", "correct": False},
                        ]
                    }
                ]
            }
        ]
    }
    
    # Seed first version
    topics_v1, questions_v1 = transform_to_db_schema(content_v1)
    seed_database(topics_v1, questions_v1, dry_run=False)
    
    # Get original title
    original_title = db_session.execute(
        text("SELECT title_key FROM quiz_topics WHERE id = 'update-test-quiz'")
    ).scalar()
    
    print(f"\nOriginal title: {original_title}")
    assert original_title == "Update Test Quiz V1"
    
    # Updated version with new title
    content_v2 = {
        "schema_version": "quiz_seed_v1",
        "defaults": {"missing_explanation_text": "Default"},
        "quizzes": [
            {
                "title": "Update Test Quiz V2 (UPDATED)",
                "slug": "update-test-quiz",
                "description": "Updated description",
                "is_active": True,
                "questions": [
                    {
                        "author_initials": "UT",
                        "prompt": "Original question?",  # Same prompt = same ID
                        "explanation": "UPDATED explanation",
                        "difficulty": 2,  # Changed difficulty
                        "answers": [
                            {"text": "A", "correct": True},
                            {"text": "B", "correct": False},
                        ]
                    }
                ]
            }
        ]
    }
    
    # Seed updated version
    topics_v2, questions_v2 = transform_to_db_schema(content_v2)
    seed_database(topics_v2, questions_v2, dry_run=False)
    
    # Check updated title
    updated_title = db_session.execute(
        text("SELECT title_key FROM quiz_topics WHERE id = 'update-test-quiz'")
    ).scalar()
    
    print(f"Updated title: {updated_title}")
    assert updated_title == "Update Test Quiz V2 (UPDATED)"
    
    # Check updated difficulty
    updated_difficulty = db_session.execute(
        text("SELECT difficulty FROM quiz_questions WHERE topic_id = 'update-test-quiz'")
    ).scalar()
    
    print(f"Updated difficulty: {updated_difficulty}")
    assert updated_difficulty == 2
    
    # Still only 1 topic and 1 question
    count_topics = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_topics WHERE id = 'update-test-quiz'")
    ).scalar()
    count_questions = db_session.execute(
        text("SELECT COUNT(*) FROM quiz_questions WHERE topic_id = 'update-test-quiz'")
    ).scalar()
    
    assert count_topics == 1
    assert count_questions == 1
    
    print("\n✅ Update test passed!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
