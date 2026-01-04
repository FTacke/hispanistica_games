"""Validation schemas for Quiz module content.

Uses dataclasses for validation since Pydantic is not in the project.
Provides strict validation for questions imported from YAML and JSON quiz units.

Supports both quiz_unit_v1 (legacy) and quiz_unit_v2 (with media arrays).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


class ValidationError(Exception):
    """Raised when content validation fails."""
    def __init__(self, message: str, errors: List[str] = None):
        super().__init__(message)
        self.errors = errors or []


@dataclass
class AnswerSchema:
    """Single answer option."""
    id: int
    text_key: str
    correct: bool


@dataclass
class QuestionSchema:
    """Quiz question definition."""
    id: str
    difficulty: int
    type: str
    prompt_key: str
    explanation_key: str
    answers: List[AnswerSchema]
    media: Optional[Dict[str, Any]] = None
    sources: Optional[List[Dict[str, Any]]] = None
    meta: Optional[Dict[str, Any]] = None


@dataclass
class TopicContentSchema:
    """Complete topic content file."""
    topic_id: str
    questions: List[QuestionSchema]


# ============================================================================
# Quiz Unit v1/v2 Schemas (JSON format with plaintext content)
# ============================================================================

# Allowed file extensions for media
ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.ogg', '.wav'}
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
ALLOWED_MEDIA_EXTENSIONS = ALLOWED_AUDIO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS


@dataclass
class UnitMediaSchema:
    """Media item for quiz unit (audio or image).
    
    In seed JSON: seed_src points to local file relative to JSON.
    After import: src contains final URL (/static/quiz-media/...).
    """
    id: str  # Unique within question/answer context (e.g., "m1", "m2")
    type: str  # "audio" or "image"
    seed_src: Optional[str] = None  # Local path relative to JSON (seed time only)
    src: Optional[str] = None  # Final URL after import (/static/quiz-media/...)
    label: Optional[str] = None  # Display label (e.g., "Audio 1", "Bild 1")
    alt: Optional[str] = None  # Alt text for images (accessibility)
    caption: Optional[str] = None  # Optional caption


@dataclass
class UnitAnswerSchema:
    """Answer for quiz unit (JSON format with plaintext).
    
    v2 supports media array per answer.
    """
    id: str  # String ID (generated if missing)
    text: str  # Plaintext answer
    correct: bool
    media: List[UnitMediaSchema] = field(default_factory=list)  # v2: media per answer


@dataclass
class UnitQuestionSchema:
    """Question for quiz unit (JSON format with plaintext).
    
    v2 supports media array instead of single object.
    """
    id: str  # String ID (generated if missing)
    difficulty: int  # 1-5
    type: str  # "single_choice"
    prompt: str  # Plaintext question
    explanation: str  # Plaintext explanation
    answers: List[UnitAnswerSchema]
    media: List[UnitMediaSchema] = field(default_factory=list)  # v2: array of media
    sources: Optional[List[Dict[str, Any]]] = None
    meta: Optional[Dict[str, Any]] = None


@dataclass
class BasedOnSchema:
    """Source reference information for quiz unit."""
    chapter_title: str
    chapter_url: str
    course_title: str = "Spanische Linguistik @ School"
    course_url: Optional[str] = None


@dataclass
class QuizUnitSchema:
    """Complete quiz unit (JSON format)."""
    schema_version: str
    slug: str
    title: str
    description: str
    authors: List[str]
    is_active: bool
    order_index: int
    questions: List[UnitQuestionSchema]
    based_on: Optional[BasedOnSchema] = None


def validate_answer(data: Dict[str, Any], question_id: str, idx: int) -> tuple[AnswerSchema, List[str]]:
    """Validate a single answer option."""
    errors = []
    
    if "id" not in data:
        errors.append(f"Question {question_id}: Answer {idx} missing 'id'")
    if "text_key" not in data:
        errors.append(f"Question {question_id}: Answer {idx} missing 'text_key'")
    if "correct" not in data:
        errors.append(f"Question {question_id}: Answer {idx} missing 'correct'")
    
    if errors:
        return None, errors
    
    answer_id = data["id"]
    if not isinstance(answer_id, int):
        errors.append(f"Question {question_id}: Answer {idx} 'id' must be an integer")
    
    return AnswerSchema(
        id=int(data["id"]),
        text_key=str(data["text_key"]),
        correct=bool(data["correct"]),
    ), errors


def validate_question(data: Dict[str, Any], topic_id: str) -> tuple[QuestionSchema, List[str]]:
    """Validate a single question."""
    errors = []
    
    # Required fields
    required = ["id", "difficulty", "prompt_key", "explanation_key", "answers"]
    for field_name in required:
        if field_name not in data:
            errors.append(f"Question missing required field: {field_name}")
    
    if errors:
        return None, errors
    
    question_id = data["id"]
    
    # Validate difficulty (1-5)
    difficulty = data["difficulty"]
    if not isinstance(difficulty, int) or difficulty < 1 or difficulty > 5:
        errors.append(f"Question {question_id}: difficulty must be 1-5, got {difficulty}")
    
    # Validate answers
    answers_data = data.get("answers", [])
    if not isinstance(answers_data, list):
        errors.append(f"Question {question_id}: 'answers' must be a list")
        return None, errors
    
    if len(answers_data) != 4:
        errors.append(f"Question {question_id}: must have exactly 4 answers, got {len(answers_data)}")
    
    answers = []
    correct_count = 0
    
    for idx, ans_data in enumerate(answers_data):
        answer, ans_errors = validate_answer(ans_data, question_id, idx)
        errors.extend(ans_errors)
        if answer:
            answers.append(answer)
            if answer.correct:
                correct_count += 1
    
    if correct_count != 1:
        errors.append(f"Question {question_id}: must have exactly 1 correct answer, got {correct_count}")
    
    if errors:
        return None, errors
    
    return QuestionSchema(
        id=str(question_id),
        difficulty=int(difficulty),
        type=str(data.get("type", "single_choice")),
        prompt_key=str(data["prompt_key"]),
        explanation_key=str(data["explanation_key"]),
        answers=answers,
        media=data.get("media"),
        sources=data.get("sources"),
        meta=data.get("meta"),
    ), []


def validate_topic_content(data: Dict[str, Any]) -> TopicContentSchema:
    """Validate complete topic content file.
    
    Args:
        data: Parsed YAML content
        
    Returns:
        Validated TopicContentSchema
        
    Raises:
        ValidationError: If validation fails
    """
    errors = []
    
    if "topic_id" not in data:
        errors.append("Missing required field: topic_id")
    
    if "questions" not in data:
        errors.append("Missing required field: questions")
    
    if errors:
        raise ValidationError("Topic content validation failed", errors)
    
    topic_id = str(data["topic_id"])
    questions_data = data.get("questions", [])
    
    if not isinstance(questions_data, list):
        raise ValidationError("Topic content validation failed", ["'questions' must be a list"])
    
    questions = []
    seen_ids = set()
    
    for q_data in questions_data:
        question, q_errors = validate_question(q_data, topic_id)
        errors.extend(q_errors)
        
        if question:
            # Check for duplicate IDs
            if question.id in seen_ids:
                errors.append(f"Duplicate question ID: {question.id}")
            seen_ids.add(question.id)
            questions.append(question)
    
    # Validate we have 2 questions per difficulty level
    difficulty_counts = {}
    for q in questions:
        difficulty_counts[q.difficulty] = difficulty_counts.get(q.difficulty, 0) + 1
    
    for d in range(1, 6):
        count = difficulty_counts.get(d, 0)
        if count < 2:
            errors.append(f"Difficulty {d}: need at least 2 questions, got {count}")
    
    if errors:
        raise ValidationError(f"Topic '{topic_id}' validation failed", errors)
    
    return TopicContentSchema(
        topic_id=topic_id,
        questions=questions,
    )


def validate_i18n_keys(topic_content: TopicContentSchema, i18n_data: Dict[str, Any]) -> List[str]:
    """Validate that all i18n keys used in questions exist in the i18n file.
    
    Args:
        topic_content: Validated topic content
        i18n_data: Parsed i18n YAML data
        
    Returns:
        List of missing key errors (empty if all valid)
    """
    errors = []
    
    def key_exists(key: str) -> bool:
        """Check if a dotted key exists in nested dict."""
        parts = key.split(".")
        current = i18n_data
        for part in parts:
            if not isinstance(current, dict) or part not in current:
                return False
            current = current[part]
        return True
    
    for q in topic_content.questions:
        # Check prompt_key
        if not key_exists(q.prompt_key):
            errors.append(f"Missing i18n key: {q.prompt_key}")
        
        # Check explanation_key
        if not key_exists(q.explanation_key):
            errors.append(f"Missing i18n key: {q.explanation_key}")
        
        # Check answer text_keys
        for ans in q.answers:
            if not key_exists(ans.text_key):
                errors.append(f"Missing i18n key: {ans.text_key}")
    
    return errors


# ============================================================================
# Quiz Unit v1/v2 Validation
# ============================================================================

SLUG_PATTERN = re.compile(r'^[a-z0-9_]+$')
MEDIA_ID_PATTERN = re.compile(r'^[a-zA-Z0-9_]+$')  # Simple alphanumeric IDs
SUPPORTED_SCHEMA_VERSIONS = {'quiz_unit_v1', 'quiz_unit_v2'}


def _validate_media_item(
    media_data: Dict[str, Any],
    context: str,
    is_v2: bool = True
) -> tuple[UnitMediaSchema, List[str]]:
    """Validate a single media item.
    
    Args:
        media_data: Raw media dict from JSON
        context: Error context string
        is_v2: Whether this is v2 format (array) or v1 (single object)
    
    Returns:
        Tuple of (UnitMediaSchema, errors)
    """
    errors = []
    
    # Validate id (required in v2, auto-generated for v1)
    media_id = media_data.get('id')
    if not media_id:
        if is_v2:
            errors.append(f"Media missing required 'id'{context}")
        media_id = 'm1'  # Default for v1 conversion
    elif not isinstance(media_id, str):
        errors.append(f"Media 'id' must be a string{context}")
        media_id = str(media_id)
    elif not MEDIA_ID_PATTERN.match(media_id):
        errors.append(f"Media 'id' must be alphanumeric{context}: '{media_id}'")
    
    # Validate type (required)
    media_type = media_data.get('type')
    if not media_type:
        errors.append(f"Media missing required 'type'{context}")
    elif media_type not in ('audio', 'image'):
        errors.append(f"Media 'type' must be 'audio' or 'image'{context}, got '{media_type}'")
    
    # Validate seed_src or src (one must be present for v2)
    seed_src = media_data.get('seed_src')
    src = media_data.get('src') or media_data.get('url')  # Support legacy 'url' field
    
    if is_v2 and not seed_src and not src:
        errors.append(f"Media must have 'seed_src' or 'src'{context}")
    
    # Validate extension if seed_src is provided
    if seed_src:
        from pathlib import Path
        ext = Path(seed_src).suffix.lower()
        if ext not in ALLOWED_MEDIA_EXTENSIONS:
            errors.append(f"Media file extension '{ext}' not allowed{context}. Allowed: {sorted(ALLOWED_MEDIA_EXTENSIONS)}")
        # Type/extension mismatch check
        if media_type == 'audio' and ext not in ALLOWED_AUDIO_EXTENSIONS:
            errors.append(f"Audio media has non-audio extension '{ext}'{context}")
        elif media_type == 'image' and ext not in ALLOWED_IMAGE_EXTENSIONS:
            errors.append(f"Image media has non-image extension '{ext}'{context}")
    
    # Optional fields
    label = media_data.get('label')
    alt = media_data.get('alt')
    caption = media_data.get('caption')
    
    if errors:
        return None, errors
    
    return UnitMediaSchema(
        id=media_id,
        type=media_type,
        seed_src=seed_src,
        src=src,
        label=label,
        alt=alt,
        caption=caption,
    ), []


def _convert_v1_media_to_v2(media_data: Any, context: str) -> tuple[List[UnitMediaSchema], List[str]]:
    """Convert v1 media format (null|object) to v2 format (array).
    
    v1 formats:
    - null/missing -> []
    - {"type": "audio", "url": "..."} -> [UnitMediaSchema(...)]
    
    Returns:
        Tuple of (media_list, errors)
    """
    if media_data is None:
        return [], []
    
    if isinstance(media_data, list):
        # Already v2 format (array)
        media_list = []
        errors = []
        for idx, item in enumerate(media_data):
            item_context = f"{context} Media #{idx+1}"
            media_schema, item_errors = _validate_media_item(item, item_context, is_v2=True)
            errors.extend(item_errors)
            if media_schema:
                media_list.append(media_schema)
        return media_list, errors
    
    if isinstance(media_data, dict):
        # v1 format: single object -> convert to array
        media_schema, errors = _validate_media_item(media_data, context, is_v2=False)
        if media_schema:
            return [media_schema], errors
        return [], errors
    
    return [], [f"Invalid media format{context}: expected null, object, or array"]


def validate_quiz_unit(data: Dict[str, Any], filename: str = "") -> QuizUnitSchema:
    """Validate quiz unit JSON content (quiz_unit_v1 or quiz_unit_v2 format).
    
    Args:
        data: Parsed JSON content
        filename: Optional filename for better error messages
        
    Returns:
        Validated QuizUnitSchema
        
    Raises:
        ValidationError: If validation fails with detailed error list
    """
    errors = []
    context = f" in {filename}" if filename else ""
    
    # Validate schema_version (v1 or v2)
    schema_version = data.get("schema_version")
    if schema_version not in SUPPORTED_SCHEMA_VERSIONS:
        errors.append(f"Invalid schema_version{context}: expected one of {SUPPORTED_SCHEMA_VERSIONS}, got '{schema_version}'")
    
    is_v2 = (schema_version == "quiz_unit_v2")
    
    # Validate slug
    slug = data.get("slug", "")
    if not slug:
        errors.append(f"Missing required field: 'slug'{context}")
    elif not isinstance(slug, str):
        errors.append(f"Field 'slug' must be a string{context}")
    elif not SLUG_PATTERN.match(slug):
        errors.append(f"Invalid slug{context}: '{slug}' (must be lowercase [a-z0-9_])")
    
    # Validate title
    title = data.get("title", "")
    if not title or not isinstance(title, str):
        errors.append(f"Missing or invalid 'title'{context}")
    elif len(title.strip()) < 3:
        errors.append(f"Field 'title' too short{context} (min 3 chars)")
    
    # Validate description
    description = data.get("description", "")
    if not description or not isinstance(description, str):
        errors.append(f"Missing or invalid 'description'{context}")
    elif len(description.strip()) < 10:
        errors.append(f"Field 'description' too short{context} (min 10 chars)")
    
    # Validate authors
    authors = data.get("authors", [])
    if not isinstance(authors, list):
        errors.append(f"Field 'authors' must be an array{context}")
    elif len(authors) < 1:
        errors.append(f"Field 'authors' must have at least 1 author{context}")
    else:
        for idx, author in enumerate(authors):
            if not isinstance(author, str) or not author.strip():
                errors.append(f"Author {idx+1} must be a non-empty string{context}")
    
    # Validate is_active
    is_active = data.get("is_active")
    if not isinstance(is_active, bool):
        errors.append(f"Field 'is_active' must be a boolean{context}")
    
    # Validate order_index
    order_index = data.get("order_index", 0)
    if not isinstance(order_index, int):
        errors.append(f"Field 'order_index' must be an integer{context}")
    
    # Validate based_on (optional)
    based_on = data.get("based_on")
    based_on_schema = None
    if based_on is not None:
        if not isinstance(based_on, dict):
            errors.append(f"Field 'based_on' must be an object{context}")
        else:
            # Validate required fields
            chapter_title = based_on.get("chapter_title", "").strip()
            chapter_url = based_on.get("chapter_url", "").strip()
            
            if not chapter_title:
                errors.append(f"Field 'based_on.chapter_title' is required and must be non-empty{context}")
            if not chapter_url:
                errors.append(f"Field 'based_on.chapter_url' is required and must be non-empty{context}")
            elif not (chapter_url.startswith("http://") or chapter_url.startswith("https://")):
                errors.append(f"Field 'based_on.chapter_url' must be a valid HTTP/HTTPS URL{context}")
            
            # Optional fields with defaults
            course_title = based_on.get("course_title", "Spanische Linguistik @ School").strip()
            if not course_title:
                course_title = "Spanische Linguistik @ School"
            
            course_url = based_on.get("course_url")
            if course_url is not None:
                course_url = course_url.strip() if isinstance(course_url, str) else None
                if course_url and not (course_url.startswith("http://") or course_url.startswith("https://")):
                    errors.append(f"Field 'based_on.course_url' must be a valid HTTP/HTTPS URL or null{context}")
            
            # Create schema if valid
            if chapter_title and chapter_url:
                based_on_schema = BasedOnSchema(
                    chapter_title=chapter_title,
                    chapter_url=chapter_url,
                    course_title=course_title,
                    course_url=course_url if course_url else None
                )
    
    # Validate questions
    questions_data = data.get("questions", [])
    if not isinstance(questions_data, list):
        errors.append(f"Field 'questions' must be an array{context}")
    elif len(questions_data) < 1:
        errors.append(f"Must have at least 1 question{context}")
    
    if errors:
        raise ValidationError(f"Quiz unit validation failed{context}", errors)
    
    # Validate each question
    questions = []
    seen_ids = set()
    
    for q_idx, q_data in enumerate(questions_data):
        q_num = q_idx + 1
        q_context = f"{context} Question #{q_num}"
        
        try:
            question = _validate_unit_question(q_data, slug, q_idx, q_context)
            
            # Check duplicate IDs
            if question.id in seen_ids:
                errors.append(f"Duplicate question ID: '{question.id}'{q_context}")
            seen_ids.add(question.id)
            
            questions.append(question)
        except ValidationError as e:
            errors.extend(e.errors)
    
    if errors:
        raise ValidationError(f"Quiz unit validation failed{context}", errors)
    
    return QuizUnitSchema(
        schema_version=schema_version,
        slug=slug,
        title=title.strip(),
        description=description.strip(),
        authors=[a.strip() for a in authors if a.strip()],
        is_active=is_active,
        order_index=order_index,
        questions=questions,
        based_on=based_on_schema,
    )


def _validate_unit_question(
    data: Dict[str, Any],
    slug: str,
    index: int,
    context: str = "",
    is_v2: bool = True
) -> UnitQuestionSchema:
    """Validate a single question in quiz unit format.
    
    Supports both v1 (media as object) and v2 (media as array) formats.
    """
    errors = []
    
    # Generate ID if missing
    question_id = data.get("id")
    if not question_id:
        question_id = f"{slug}_q{index+1:02d}"
    elif not isinstance(question_id, str):
        errors.append(f"Field 'id' must be a string{context}")
    
    # Validate difficulty
    difficulty = data.get("difficulty")
    if difficulty is None:
        errors.append(f"Missing required field: 'difficulty'{context}")
    elif not isinstance(difficulty, int) or difficulty < 1 or difficulty > 5:
        errors.append(f"Field 'difficulty' must be 1-5{context}, got {difficulty}")
    
    # Validate type
    q_type = data.get("type", "single_choice")
    if q_type != "single_choice":
        errors.append(f"Only 'single_choice' type supported{context}, got '{q_type}'")
    
    # Validate prompt
    prompt = data.get("prompt", "")
    if not prompt or not isinstance(prompt, str):
        errors.append(f"Missing or invalid 'prompt'{context}")
    elif len(prompt.strip()) < 5:
        errors.append(f"Field 'prompt' too short{context} (min 5 chars)")
    
    # Validate explanation
    explanation = data.get("explanation", "")
    if not explanation or not isinstance(explanation, str):
        errors.append(f"Missing or invalid 'explanation'{context}")
    elif len(explanation.strip()) < 5:
        errors.append(f"Field 'explanation' too short{context} (min 5 chars)")
    
    # Validate question media (v1: object, v2: array)
    question_media, media_errors = _convert_v1_media_to_v2(
        data.get("media"), f"{context} Question media"
    )
    errors.extend(media_errors)
    
    # Validate answers
    answers_data = data.get("answers", [])
    if not isinstance(answers_data, list):
        errors.append(f"Field 'answers' must be an array{context}")
    elif len(answers_data) < 2:
        errors.append(f"Must have at least 2 answers{context}")
    elif len(answers_data) > 6:
        errors.append(f"Must have at most 6 answers{context}")
    
    if errors:
        raise ValidationError("Question validation failed", errors)
    
    # Validate each answer (with media support)
    answers = []
    correct_count = 0
    seen_answer_ids = set()
    
    for ans_idx, ans_data in enumerate(answers_data):
        ans_num = ans_idx + 1
        ans_context = f"{context} Answer #{ans_num}"
        
        # Generate ID if missing
        answer_id = ans_data.get("id")
        if not answer_id:
            answer_id = f"a{ans_num}"
        elif not isinstance(answer_id, str):
            errors.append(f"Field 'id' must be a string{ans_context}")
        
        # Check duplicate answer IDs
        if answer_id in seen_answer_ids:
            errors.append(f"Duplicate answer ID: '{answer_id}'{ans_context}")
        seen_answer_ids.add(answer_id)
        
        # Validate text
        text = ans_data.get("text", "")
        if not text or not isinstance(text, str):
            errors.append(f"Missing or invalid 'text'{ans_context}")
        elif len(text.strip()) < 1:
            errors.append(f"Field 'text' cannot be empty{ans_context}")
        
        # Validate correct
        correct = ans_data.get("correct")
        if not isinstance(correct, bool):
            errors.append(f"Field 'correct' must be a boolean{ans_context}")
        elif correct:
            correct_count += 1
        
        # Validate answer media (v2 feature, optional array)
        answer_media, ans_media_errors = _convert_v1_media_to_v2(
            ans_data.get("media"), f"{ans_context} media"
        )
        errors.extend(ans_media_errors)
        
        answers.append(UnitAnswerSchema(
            id=answer_id,
            text=text.strip() if text else "",
            correct=correct if isinstance(correct, bool) else False,
            media=answer_media,
        ))
    
    # Must have exactly 1 correct answer
    if correct_count != 1:
        errors.append(f"Must have exactly 1 correct answer{context}, got {correct_count}")
    
    if errors:
        raise ValidationError("Question validation failed", errors)
    
    return UnitQuestionSchema(
        id=question_id,
        difficulty=difficulty,
        type=q_type,
        prompt=prompt.strip(),
        explanation=explanation.strip(),
        answers=answers,
        media=question_media,
        sources=data.get("sources"),
        meta=data.get("meta"),
    )
