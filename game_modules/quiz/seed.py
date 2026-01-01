"""Seed and import functionality for Quiz module.

Handles:
- Loading YAML content files (legacy i18n-based)
- Loading JSON quiz units (new plaintext format)
- Validating question format
- Importing topics and questions into database
- Initial demo topic seeding
- Automatic seeding with advisory locks
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from .models import QuizTopic, QuizQuestion
from .validation import (
    validate_quiz_unit,
    ValidationError,
    QuizUnitSchema,
)

logger = logging.getLogger(__name__)

# Path to quiz units content
QUIZ_UNITS_DIR = Path(__file__).parent / "quiz_units"
QUIZ_UNITS_TOPICS_DIR = QUIZ_UNITS_DIR / "topics"

# Advisory lock ID for seeding (prevent parallel execution)
QUIZ_SEED_LOCK_ID = hashlib.md5(b"quiz_seed_lock").hexdigest()[:8]  # 8-char hex

# ============================================================================
# Quiz Units (JSON format with plaintext content)
# ============================================================================

def acquire_seed_lock(session: Session) -> bool:
    """Try to acquire advisory lock for seeding (PostgreSQL-compatible).
    
    For SQLite, always returns True (no locking mechanism available).
    
    Returns:
        True if lock acquired or not needed, False if already locked
    """
    try:
        # Detect database type from dialect name
        dialect_name = session.bind.dialect.name
        
        if dialect_name == "postgresql":
            # Use pg_try_advisory_lock with integer ID
            lock_id = int(QUIZ_SEED_LOCK_ID, 16)  # Convert hex to int
            result = session.execute(text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": lock_id})
            acquired = result.scalar()
            return bool(acquired)
        else:
            # SQLite or other dialects: no advisory lock support, allow execution
            logger.debug(f"Database dialect {dialect_name} does not support advisory locks, skipping")
            return True
            
    except Exception as e:
        logger.warning(f"Failed to acquire advisory lock: {e}")
        return False


def release_seed_lock(session: Session) -> None:
    """Release advisory lock for seeding (PostgreSQL-compatible).
    
    For SQLite, this is a no-op.
    """
    try:
        # Detect database type from dialect name
        dialect_name = session.bind.dialect.name
        
        if dialect_name == "postgresql":
            lock_id = int(QUIZ_SEED_LOCK_ID, 16)
            session.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id})
        else:
            # SQLite or other dialects: no-op
            pass
            
    except Exception as e:
        logger.warning(f"Failed to release advisory lock: {e}")


def load_quiz_unit(json_path: Path) -> QuizUnitSchema:
    """Load and validate a quiz unit from JSON file.
    
    Args:
        json_path: Path to JSON file
        
    Returns:
        Validated QuizUnitSchema
        
    Raises:
        ValidationError: If validation fails
        FileNotFoundError: If file not found
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    return validate_quiz_unit(data, filename=json_path.name)


def import_quiz_unit(session: Session, unit: QuizUnitSchema) -> tuple[QuizTopic, int]:
    """Import a quiz unit into database (idempotent upsert).
    
    Args:
        session: SQLAlchemy session
        unit: Validated quiz unit schema
        
    Returns:
        Tuple of (topic, questions_count)
    """
    logger.info(f"Importing quiz unit: {unit.slug}")
    
    # Normalize based_on with defaults
    based_on_json = None
    if unit.based_on:
        based_on_json = {
            "chapter_title": unit.based_on.chapter_title,
            "chapter_url": unit.based_on.chapter_url,
            "course_title": unit.based_on.course_title or "Spanische Linguistik @ School",
            "course_url": unit.based_on.course_url,
        }
    
    # Upsert topic
    topic = session.query(QuizTopic).filter(QuizTopic.id == unit.slug).first()
    
    if not topic:
        topic = QuizTopic(
            id=unit.slug,
            title_key=unit.title,  # Store plaintext as "key" (pragmatic solution)
            description_key=unit.description,
            authors=unit.authors,
            based_on=based_on_json,
            is_active=unit.is_active,
            order_index=unit.order_index,
            created_at=datetime.now(timezone.utc),
        )
        session.add(topic)
        logger.info(f"Created new topic: {unit.slug}")
    else:
        # Update existing topic
        topic.title_key = unit.title
        topic.description_key = unit.description
        topic.authors = unit.authors
        topic.based_on = based_on_json
        topic.is_active = unit.is_active
        topic.order_index = unit.order_index
        logger.info(f"Updated existing topic: {unit.slug}")
    
    # Upsert questions
    questions_count = 0
    difficulty_counts = {}  # Track difficulty distribution
    
    for q in unit.questions:
        # Build answers as JSONB (store plaintext as text_key)
        answers_json = [
            {
                "id": ans.id,
                "text_key": ans.text,  # Store plaintext as "key"
                "correct": ans.correct,
            }
            for ans in q.answers
        ]
        
        # Track difficulty distribution
        difficulty_counts[q.difficulty] = difficulty_counts.get(q.difficulty, 0) + 1
        
        # Check if question exists
        existing = session.query(QuizQuestion).filter(QuizQuestion.id == q.id).first()
        
        if existing:
            # Update existing question
            existing.topic_id = unit.slug
            existing.difficulty = q.difficulty
            existing.type = q.type
            existing.prompt_key = q.prompt  # Store plaintext as "key"
            existing.explanation_key = q.explanation  # Store plaintext as "key"
            existing.answers = answers_json
            existing.media = q.media
            existing.sources = q.sources
            existing.meta = q.meta
            logger.debug(f"Updated question: {q.id}")
        else:
            # Create new question
            question = QuizQuestion(
                id=q.id,
                topic_id=unit.slug,
                difficulty=q.difficulty,
                type=q.type,
                prompt_key=q.prompt,
                explanation_key=q.explanation,
                answers=answers_json,
                media=q.media,
                sources=q.sources,
                meta=q.meta,
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(question)
            logger.debug(f"Created question: {q.id}")
        
        questions_count += 1
    
    session.flush()
    
    # Log difficulty distribution
    diff_str = " | ".join([f"d{d}={count}" for d, count in sorted(difficulty_counts.items())])
    logger.info(f"Seeding topic {unit.slug} | questions: {questions_count} | {diff_str}")
    
    return topic, questions_count


def seed_quiz_units(session: Session, units_dir: Optional[Path] = None) -> Dict[str, Any]:
    """Load and import all quiz units from JSON files.
    
    Args:
        session: SQLAlchemy session
        units_dir: Directory containing topics/*.json (defaults to QUIZ_UNITS_DIR)
        
    Returns:
        Dict with results: {
            "success": bool,
            "units_imported": int,
            "questions_imported": int,
            "errors": List[str]
        }
    """
    if units_dir is None:
        units_dir = QUIZ_UNITS_DIR
    
    topics_dir = units_dir / "topics"
    
    if not topics_dir.exists():
        logger.warning(f"Quiz units directory not found: {topics_dir}")
        return {
            "success": False,
            "units_imported": 0,
            "questions_imported": 0,
            "errors": [f"Directory not found: {topics_dir}"]
        }
    
    # Try to acquire lock
    if not acquire_seed_lock(session):
        logger.info("Seed already in progress (locked), skipping")
        return {
            "success": True,
            "units_imported": 0,
            "questions_imported": 0,
            "errors": [],
            "skipped": "locked"
        }
    
    try:
        units_imported = 0
        questions_imported = 0
        errors = []
        
        # Load all JSON files
        json_files = sorted(topics_dir.glob("*.json"))
        
        if not json_files:
            logger.warning(f"No JSON files found in {topics_dir}")
            return {
                "success": True,
                "units_imported": 0,
                "questions_imported": 0,
                "errors": []
            }
        
        logger.info(f"Found {len(json_files)} quiz unit(s) to import")
        
        for json_file in json_files:
            try:
                # Load and validate unit
                unit = load_quiz_unit(json_file)
                
                # Import into database
                topic, q_count = import_quiz_unit(session, unit)
                
                units_imported += 1
                questions_imported += q_count
                
            except ValidationError as e:
                error_msg = f"{json_file.name}: {e.message}"
                if e.errors:
                    error_msg += f" - {'; '.join(e.errors[:3])}"  # Show first 3 errors
                errors.append(error_msg)
                logger.error(f"Validation failed for {json_file.name}: {e.errors}")
                
            except Exception as e:
                error_msg = f"{json_file.name}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"Failed to import {json_file.name}: {e}", exc_info=True)
        
        # Commit transaction
        session.commit()
        
        logger.info(
            f"Quiz units seeding completed: {units_imported} units, "
            f"{questions_imported} questions, {len(errors)} errors"
        )
        
        return {
            "success": len(errors) == 0,
            "units_imported": units_imported,
            "questions_imported": questions_imported,
            "errors": errors
        }
        
    except Exception as e:
        session.rollback()
        logger.error(f"Quiz units seeding failed: {e}", exc_info=True)
        return {
            "success": False,
            "units_imported": 0,
            "questions_imported": 0,
            "errors": [str(e)]
        }
        
    finally:
        # Always release lock
        release_seed_lock(session)
