"""Seed and import functionality for Quiz module.

Handles:
- Loading YAML content files
- Validating question format
- Importing topics and questions into database
- Initial demo topic seeding
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

import yaml
from sqlalchemy.orm import Session

from .models import QuizTopic, QuizQuestion
from .validation import validate_topic_content, validate_i18n_keys, ValidationError

logger = logging.getLogger(__name__)

# Path to content files relative to this module
CONTENT_DIR = Path(__file__).parent / "content"
TOPICS_DIR = CONTENT_DIR / "topics"
I18N_DIR = CONTENT_DIR / "i18n"


def load_yaml_file(path: Path) -> Dict[str, Any]:
    """Load and parse a YAML file."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_i18n_data(locale: str = "de") -> Dict[str, Any]:
    """Load i18n data for a locale."""
    i18n_path = I18N_DIR / f"{locale}.yml"
    if not i18n_path.exists():
        return {}
    return load_yaml_file(i18n_path)


def import_topic_from_yaml(
    session: Session,
    yaml_path: Path,
    i18n_locale: str = "de",
    validate_i18n: bool = True,
) -> tuple[QuizTopic, int]:
    """Import a topic and its questions from YAML file.
    
    Args:
        session: SQLAlchemy session
        yaml_path: Path to topic YAML file
        i18n_locale: Locale for i18n validation
        validate_i18n: Whether to validate i18n keys exist
        
    Returns:
        Tuple of (topic, questions_count)
        
    Raises:
        ValidationError: If content validation fails
        FileNotFoundError: If YAML file not found
    """
    logger.info(f"Importing topic from {yaml_path}")
    
    # Load and validate content
    data = load_yaml_file(yaml_path)
    topic_content = validate_topic_content(data)
    
    # Optionally validate i18n keys
    if validate_i18n:
        i18n_data = get_i18n_data(i18n_locale)
        if i18n_data:
            i18n_errors = validate_i18n_keys(topic_content, i18n_data)
            if i18n_errors:
                logger.warning(f"i18n validation warnings for {topic_content.topic_id}: {i18n_errors}")
                # Don't fail, just warn - keys might be in a different i18n setup
    
    # Get or create topic
    topic = session.query(QuizTopic).filter(QuizTopic.id == topic_content.topic_id).first()
    
    if not topic:
        # Get title from i18n or use topic_id
        i18n_data = get_i18n_data(i18n_locale)
        title_key = f"topics.{topic_content.topic_id}.title"
        
        topic = QuizTopic(
            id=topic_content.topic_id,
            title_key=title_key,
            description_key=f"topics.{topic_content.topic_id}.description",
            is_active=True,
            order_index=0,
            created_at=datetime.now(timezone.utc),
        )
        session.add(topic)
        logger.info(f"Created new topic: {topic_content.topic_id}")
    
    # Import/update questions
    questions_count = 0
    
    for q_schema in topic_content.questions:
        # Build answers as list of dicts for JSONB
        answers_json = [
            {
                "id": ans.id,
                "text_key": ans.text_key,
                "correct": ans.correct,
            }
            for ans in q_schema.answers
        ]
        
        # Check if question exists
        existing = session.query(QuizQuestion).filter(QuizQuestion.id == q_schema.id).first()
        
        if existing:
            # Update existing question
            existing.topic_id = topic_content.topic_id
            existing.difficulty = q_schema.difficulty
            existing.type = q_schema.type
            existing.prompt_key = q_schema.prompt_key
            existing.explanation_key = q_schema.explanation_key
            existing.answers = answers_json
            existing.media = q_schema.media
            existing.sources = q_schema.sources
            existing.meta = q_schema.meta
            logger.debug(f"Updated question: {q_schema.id}")
        else:
            # Create new question
            question = QuizQuestion(
                id=q_schema.id,
                topic_id=topic_content.topic_id,
                difficulty=q_schema.difficulty,
                type=q_schema.type,
                prompt_key=q_schema.prompt_key,
                explanation_key=q_schema.explanation_key,
                answers=answers_json,
                media=q_schema.media,
                sources=q_schema.sources,
                meta=q_schema.meta,
                is_active=True,
                created_at=datetime.now(timezone.utc),
            )
            session.add(question)
            logger.debug(f"Created question: {q_schema.id}")
        
        questions_count += 1
    
    session.flush()
    logger.info(f"Imported {questions_count} questions for topic {topic_content.topic_id}")
    
    return topic, questions_count


def seed_demo_topic(session: Session) -> bool:
    """Seed the demo topic with questions.
    
    Returns:
        True if seeded successfully, False if already exists
    """
    demo_yaml = TOPICS_DIR / "demo_topic.yml"
    
    if not demo_yaml.exists():
        logger.error(f"Demo topic YAML not found at {demo_yaml}")
        return False
    
    # Check if demo topic already has questions
    existing_count = session.query(QuizQuestion).filter(
        QuizQuestion.topic_id == "demo_topic"
    ).count()
    
    if existing_count >= 10:
        logger.info("Demo topic already seeded with questions")
        return False
    
    try:
        topic, count = import_topic_from_yaml(session, demo_yaml, validate_i18n=False)
        logger.info(f"Seeded demo topic with {count} questions")
        return True
    except (ValidationError, Exception) as e:
        logger.error(f"Failed to seed demo topic: {e}")
        raise


def import_all_topics(session: Session, i18n_locale: str = "de") -> Dict[str, int]:
    """Import all topic YAML files from content directory.
    
    Returns:
        Dict mapping topic_id to questions_count
    """
    results = {}
    
    if not TOPICS_DIR.exists():
        logger.warning(f"Topics directory not found: {TOPICS_DIR}")
        return results
    
    for yaml_file in TOPICS_DIR.glob("*.yml"):
        try:
            topic, count = import_topic_from_yaml(session, yaml_file, i18n_locale)
            results[topic.id] = count
        except Exception as e:
            logger.error(f"Failed to import {yaml_file}: {e}")
    
    return results
