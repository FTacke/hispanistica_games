"""Seed and import functionality for Quiz module.

Handles:
- Loading YAML content files (legacy i18n-based)
- Loading JSON quiz units (new plaintext format)
- Validating question format
- Importing topics and questions into database
- Media file copying (seed_src -> static/quiz-media/)
- Initial demo topic seeding
- Automatic seeding with advisory locks
"""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
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
    UnitMediaSchema,
)

logger = logging.getLogger(__name__)

# Path to quiz units content
QUIZ_UNITS_DIR = Path(__file__).parent / "quiz_units"
QUIZ_UNITS_TOPICS_DIR = QUIZ_UNITS_DIR / "topics"

# Path to static media output
# Relative to project root (will be resolved in copy function)
QUIZ_MEDIA_STATIC_DIR = Path("static/quiz-media")

# Advisory lock ID for seeding (prevent parallel execution)
QUIZ_SEED_LOCK_ID = hashlib.md5(b"quiz_seed_lock").hexdigest()[:8]  # 8-char hex

# Allowed file extensions for media
ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.ogg', '.wav'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_MEDIA_EXTENSIONS = ALLOWED_AUDIO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS


# ============================================================================
# Media Copy Functions
# ============================================================================

def compute_file_hash(file_path: Path) -> str:
    """Compute SHA256 hash of a file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def copy_media_file(
    seed_src: str,
    json_dir: Path,
    slug: str,
    question_id: str,
    media_id: str,
    answer_id: Optional[str] = None,
    project_root: Optional[Path] = None
) -> tuple[str, Optional[str]]:
    """Copy a media file from seed location to static directory.
    
    Args:
        seed_src: Relative path from JSON file to media file
        json_dir: Directory containing the JSON file
        slug: Topic slug
        question_id: Question ID
        media_id: Media ID within question/answer
        answer_id: If present, this is answer-level media
        project_root: Project root directory (default: auto-detect)
    
    Returns:
        Tuple of (final_url, content_hash)
        
    Raises:
        FileNotFoundError: If source file doesn't exist
        ValueError: If file extension not allowed or hash mismatch
    """
    # Resolve source path
    source_path = (json_dir / seed_src).resolve()
    
    if not source_path.exists():
        raise FileNotFoundError(f"Media file not found: {source_path}")
    
    # Validate extension
    ext = source_path.suffix.lower()
    if ext not in ALLOWED_MEDIA_EXTENSIONS:
        raise ValueError(f"File extension '{ext}' not allowed. Allowed: {sorted(ALLOWED_MEDIA_EXTENSIONS)}")
    
    # Build target filename: <media_id>.<ext> or <answer_id>_<media_id>.<ext>
    if answer_id:
        target_filename = f"{answer_id}_{media_id}{ext}"
    else:
        target_filename = f"{media_id}{ext}"
    
    # Build target directory: static/quiz-media/<slug>/<question_id>/
    if project_root is None:
        # Auto-detect: seed.py is in game_modules/quiz/, project root is 2 levels up
        project_root = Path(__file__).parent.parent.parent
    
    target_dir = project_root / QUIZ_MEDIA_STATIC_DIR / slug / question_id
    target_path = target_dir / target_filename
    
    # Compute source hash
    source_hash = compute_file_hash(source_path)
    
    # Check if target exists
    if target_path.exists():
        target_hash = compute_file_hash(target_path)
        if source_hash == target_hash:
            # Same file, skip copy
            logger.debug(f"Media file unchanged, skipping: {target_path}")
        else:
            # Different content! Fail to prevent silent overwrite
            raise ValueError(
                f"Media file conflict: {target_path} exists with different content. "
                f"Source hash: {source_hash[:8]}..., Target hash: {target_hash[:8]}..."
            )
    else:
        # Create directory and copy
        target_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)
        logger.info(f"Copied media: {seed_src} -> {target_path.relative_to(project_root)}")
    
    # Build final URL
    final_url = f"/static/quiz-media/{slug}/{question_id}/{target_filename}"
    
    return final_url, source_hash


def process_media_for_question(
    question: Any,  # UnitQuestionSchema
    json_dir: Path,
    slug: str,
    project_root: Optional[Path] = None
) -> tuple[List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]], int]:
    """Process all media for a question (question-level + answer-level).
    
    Args:
        question: Validated UnitQuestionSchema
        json_dir: Directory containing the JSON file
        slug: Topic slug
        project_root: Project root directory
    
    Returns:
        Tuple of (question_media_list, answer_media_dict, files_copied)
        - question_media_list: List of media dicts with 'src' URLs
        - answer_media_dict: Dict mapping answer_id -> list of media dicts with 'src' URLs
        - files_copied: Number of files actually copied
    """
    files_copied = 0
    question_media_list = []
    answer_media_dict = {}
    
    # Process question-level media
    for media in question.media:
        if media.seed_src:
            try:
                final_url, content_hash = copy_media_file(
                    seed_src=media.seed_src,
                    json_dir=json_dir,
                    slug=slug,
                    question_id=question.id,
                    media_id=media.id,
                    answer_id=None,
                    project_root=project_root
                )
                files_copied += 1
                question_media_list.append({
                    'id': media.id,
                    'type': media.type,
                    'src': final_url,
                    'label': media.label,
                    'alt': media.alt,
                    'caption': media.caption,
                })
            except (FileNotFoundError, ValueError) as e:
                raise ValueError(f"Question {question.id} media '{media.id}': {e}")
        elif media.src:
            # Already has final URL (possibly from previous import)
            question_media_list.append({
                'id': media.id,
                'type': media.type,
                'src': media.src,
                'label': media.label,
                'alt': media.alt,
                'caption': media.caption,
            })
    
    # Process answer-level media
    for answer in question.answers:
        answer_media_list = []
        for media in answer.media:
            if media.seed_src:
                try:
                    final_url, content_hash = copy_media_file(
                        seed_src=media.seed_src,
                        json_dir=json_dir,
                        slug=slug,
                        question_id=question.id,
                        media_id=media.id,
                        answer_id=answer.id,
                        project_root=project_root
                    )
                    files_copied += 1
                    answer_media_list.append({
                        'id': media.id,
                        'type': media.type,
                        'src': final_url,
                        'label': media.label,
                        'alt': media.alt,
                        'caption': media.caption,
                    })
                except (FileNotFoundError, ValueError) as e:
                    raise ValueError(f"Question {question.id} Answer {answer.id} media '{media.id}': {e}")
            elif media.src:
                answer_media_list.append({
                    'id': media.id,
                    'type': media.type,
                    'src': media.src,
                    'label': media.label,
                    'alt': media.alt,
                    'caption': media.caption,
                })
        
        if answer_media_list:
            answer_media_dict[answer.id] = answer_media_list
    
    return question_media_list, answer_media_dict, files_copied

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


def import_quiz_unit(
    session: Session,
    unit: QuizUnitSchema,
    json_path: Optional[Path] = None,
    project_root: Optional[Path] = None
) -> tuple[QuizTopic, int, int]:
    """Import a quiz unit into database (idempotent upsert).
    
    Also copies media files from seed location to static directory.
    
    Args:
        session: SQLAlchemy session
        unit: Validated quiz unit schema
        json_path: Path to source JSON file (needed for media resolution)
        project_root: Project root directory (for media copy destination)
        
    Returns:
        Tuple of (topic, questions_count, media_files_copied)
    """
    logger.info(f"Importing quiz unit: {unit.slug}")
    
    # Resolve paths for media processing
    json_dir = json_path.parent if json_path else QUIZ_UNITS_TOPICS_DIR
    if project_root is None:
        project_root = Path(__file__).parent.parent.parent
    
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
    media_files_copied = 0
    difficulty_counts = {}  # Track difficulty distribution
    
    for q in unit.questions:
        # Process media files (copy from seed to static)
        question_media_list, answer_media_dict, files_copied = process_media_for_question(
            question=q,
            json_dir=json_dir,
            slug=unit.slug,
            project_root=project_root
        )
        media_files_copied += files_copied
        
        # Build answers as JSONB (store plaintext as text_key + media)
        answers_json = []
        for ans in q.answers:
            ans_dict = {
                "id": ans.id,
                "text_key": ans.text,  # Store plaintext as "key"
                "correct": ans.correct,
            }
            # Add media if present
            if ans.id in answer_media_dict:
                ans_dict["media"] = answer_media_dict[ans.id]
            else:
                ans_dict["media"] = []
            answers_json.append(ans_dict)
        
        # Track difficulty distribution
        difficulty_counts[q.difficulty] = difficulty_counts.get(q.difficulty, 0) + 1
        
        # Convert question media list to storable format (already processed)
        media_json = question_media_list if question_media_list else []
        
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
            existing.media = media_json
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
                media=media_json,
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
    media_str = f" | media files: {media_files_copied}" if media_files_copied > 0 else ""
    logger.info(f"Seeding topic {unit.slug} | questions: {questions_count} | {diff_str}{media_str}")
    
    return topic, questions_count, media_files_copied


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
        media_files_copied = 0
        errors = []
        
        # Load all JSON files
        json_files = sorted(topics_dir.glob("*.json"))
        
        if not json_files:
            logger.warning(f"No JSON files found in {topics_dir}")
            return {
                "success": True,
                "units_imported": 0,
                "questions_imported": 0,
                "media_files_copied": 0,
                "errors": []
            }
        
        logger.info(f"Found {len(json_files)} quiz unit(s) to import")
        
        # Determine project root for media copy
        project_root = Path(__file__).parent.parent.parent
        
        for json_file in json_files:
            try:
                # Load and validate unit
                unit = load_quiz_unit(json_file)
                
                # Import into database (with media copy)
                topic, q_count, media_count = import_quiz_unit(
                    session, unit, json_path=json_file, project_root=project_root
                )
                
                units_imported += 1
                questions_imported += q_count
                media_files_copied += media_count
                
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
        
        media_info = f", {media_files_copied} media files" if media_files_copied > 0 else ""
        logger.info(
            f"Quiz units seeding completed: {units_imported} units, "
            f"{questions_imported} questions{media_info}, {len(errors)} errors"
        )
        
        return {
            "success": len(errors) == 0,
            "units_imported": units_imported,
            "questions_imported": questions_imported,
            "media_files_copied": media_files_copied,
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
