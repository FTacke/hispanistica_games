"""
Tests for Quiz Seed Content System

Tests:
- Content validation rules
- Idempotent upsert behavior
- Deterministic ID generation
- Answer shuffling
"""

import json
import pytest
from pathlib import Path
from datetime import datetime, timezone

# Import seed script functions
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.seed_quiz_content import (
    validate_content,
    transform_to_db_schema,
    generate_question_id,
    generate_answer_id,
    ValidationError,
)


def test_validate_content_correct_schema():
    """Test that valid content passes validation."""
    content = {
        "schema_version": "quiz_seed_v1",
        "defaults": {"missing_explanation_text": "Erklärung folgt."},
        "quizzes": [
            {
                "title": "Test Quiz",
                "slug": "test-quiz",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Test question?",
                        "difficulty": 3,
                        "answers": [
                            {"text": "Answer 1", "correct": False},
                            {"text": "Answer 2", "correct": True},
                        ]
                    }
                ]
            }
        ]
    }
    
    # Should not raise
    validate_content(content)


def test_validate_content_wrong_schema_version():
    """Test that wrong schema version is rejected."""
    content = {
        "schema_version": "wrong_version",
        "quizzes": []
    }
    
    with pytest.raises(ValidationError, match="Invalid schema_version"):
        validate_content(content)


def test_validate_content_no_quizzes():
    """Test that content without quizzes is rejected."""
    content = {
        "schema_version": "quiz_seed_v1",
        "quizzes": []
    }
    
    with pytest.raises(ValidationError, match="No quizzes found"):
        validate_content(content)


def test_validate_content_missing_slug():
    """Test that quiz without slug is rejected."""
    content = {
        "schema_version": "quiz_seed_v1",
        "quizzes": [
            {
                "title": "Test",
                # Missing slug
                "questions": []
            }
        ]
    }
    
    with pytest.raises(ValidationError, match="Missing 'slug'"):
        validate_content(content)


def test_validate_content_no_correct_answer():
    """Test that question without exactly 1 correct answer is rejected."""
    content = {
        "schema_version": "quiz_seed_v1",
        "quizzes": [
            {
                "title": "Test",
                "slug": "test",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Test?",
                        "difficulty": 1,
                        "answers": [
                            {"text": "A", "correct": False},
                            {"text": "B", "correct": False},  # No correct answer!
                        ]
                    }
                ]
            }
        ]
    }
    
    with pytest.raises(ValidationError, match="Must have exactly 1 correct answer"):
        validate_content(content)


def test_validate_content_multiple_correct_answers():
    """Test that question with multiple correct answers is rejected."""
    content = {
        "schema_version": "quiz_seed_v1",
        "quizzes": [
            {
                "title": "Test",
                "slug": "test",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Test?",
                        "difficulty": 1,
                        "answers": [
                            {"text": "A", "correct": True},
                            {"text": "B", "correct": True},  # Two correct!
                        ]
                    }
                ]
            }
        ]
    }
    
    with pytest.raises(ValidationError, match="Must have exactly 1 correct answer"):
        validate_content(content)


def test_validate_content_invalid_difficulty():
    """Test that invalid difficulty is rejected."""
    content = {
        "schema_version": "quiz_seed_v1",
        "quizzes": [
            {
                "title": "Test",
                "slug": "test",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Test?",
                        "difficulty": 10,  # Invalid: must be 1-5
                        "answers": [
                            {"text": "A", "correct": True},
                            {"text": "B", "correct": False},
                        ]
                    }
                ]
            }
        ]
    }
    
    with pytest.raises(ValidationError, match="Invalid difficulty"):
        validate_content(content)


def test_validate_content_insufficient_answers():
    """Test that question with fewer than 2 answers is rejected."""
    content = {
        "schema_version": "quiz_seed_v1",
        "quizzes": [
            {
                "title": "Test",
                "slug": "test",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Test?",
                        "difficulty": 1,
                        "answers": [
                            {"text": "A", "correct": True},
                            # Only 1 answer!
                        ]
                    }
                ]
            }
        ]
    }
    
    with pytest.raises(ValidationError, match="Must have at least 2 answers"):
        validate_content(content)


def test_generate_question_id_deterministic():
    """Test that question ID generation is deterministic."""
    topic = "test-topic"
    author = "TT"
    prompt = "What is the answer?"
    
    id1 = generate_question_id(topic, author, prompt)
    id2 = generate_question_id(topic, author, prompt)
    
    assert id1 == id2
    assert len(id1) == 24


def test_generate_question_id_unique():
    """Test that different questions get different IDs."""
    topic = "test-topic"
    author = "TT"
    
    id1 = generate_question_id(topic, author, "Question 1?")
    id2 = generate_question_id(topic, author, "Question 2?")
    
    assert id1 != id2


def test_generate_answer_id_deterministic():
    """Test that answer ID generation is deterministic."""
    question_id = "abc123"
    answer_text = "This is the answer"
    
    id1 = generate_answer_id(question_id, answer_text)
    id2 = generate_answer_id(question_id, answer_text)
    
    assert id1 == id2
    assert len(id1) == 16


def test_transform_to_db_schema():
    """Test transformation from content JSON to DB records."""
    content = {
        "schema_version": "quiz_seed_v1",
        "defaults": {"missing_explanation_text": "Default explanation"},
        "quizzes": [
            {
                "title": "Test Quiz",
                "slug": "test-quiz",
                "description": "Test description",
                "is_active": True,
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Test question?",
                        "explanation": "This is why",
                        "difficulty": 2,
                        "tags": ["test"],
                        "is_active": True,
                        "answers": [
                            {"text": "Wrong", "correct": False},
                            {"text": "Right", "correct": True},
                            {"text": "Also wrong", "correct": False},
                        ]
                    }
                ]
            }
        ]
    }
    
    topics, questions = transform_to_db_schema(content)
    
    # Check topics
    assert len(topics) == 1
    assert topics[0]["id"] == "test-quiz"
    assert topics[0]["title_key"] == "Test Quiz"
    assert topics[0]["description_key"] == "Test description"
    assert topics[0]["is_active"] is True
    assert topics[0]["order_index"] == 1
    
    # Check questions
    assert len(questions) == 1
    q = questions[0]
    assert q["topic_id"] == "test-quiz"
    assert q["difficulty"] == 2
    assert q["prompt_key"] == "Test question?"
    assert q["explanation_key"] == "This is why"
    assert q["author_initials"] == "TT"
    assert q["is_active"] is True
    
    # Check answers
    assert len(q["answers"]) == 3
    # One should be correct
    correct_count = sum(1 for a in q["answers"] if a["correct"])
    assert correct_count == 1
    
    # All should have deterministic IDs
    for answer in q["answers"]:
        assert "id" in answer
        assert len(answer["id"]) == 16
        assert "text_key" in answer
        assert "correct" in answer


def test_transform_uses_default_explanation():
    """Test that missing/empty explanation uses default."""
    content = {
        "schema_version": "quiz_seed_v1",
        "defaults": {"missing_explanation_text": "Default explanation"},
        "quizzes": [
            {
                "title": "Test",
                "slug": "test",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Test?",
                        "explanation": "",  # Empty
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
    
    _, questions = transform_to_db_schema(content)
    
    assert questions[0]["explanation_key"] == "Default explanation"


def test_multiple_quizzes_order_index():
    """Test that multiple quizzes get sequential order_index."""
    content = {
        "schema_version": "quiz_seed_v1",
        "quizzes": [
            {
                "title": "Quiz 1",
                "slug": "quiz-1",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Q1?",
                        "difficulty": 1,
                        "answers": [
                            {"text": "A", "correct": True},
                            {"text": "B", "correct": False},
                        ]
                    }
                ]
            },
            {
                "title": "Quiz 2",
                "slug": "quiz-2",
                "questions": [
                    {
                        "author_initials": "TT",
                        "prompt": "Q2?",
                        "difficulty": 1,
                        "answers": [
                            {"text": "A", "correct": True},
                            {"text": "B", "correct": False},
                        ]
                    }
                ]
            },
        ]
    }
    
    topics, _ = transform_to_db_schema(content)
    
    assert topics[0]["order_index"] == 1
    assert topics[1]["order_index"] == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
