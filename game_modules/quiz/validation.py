"""Validation schemas for Quiz module content.

Uses dataclasses for validation since Pydantic is not in the project.
Provides strict validation for questions imported from YAML and JSON quiz units.
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
# Quiz Unit v1 Schemas (JSON format with plaintext content)
# ============================================================================

@dataclass
class UnitAnswerSchema:
    """Answer for quiz unit (JSON format with plaintext)."""
    id: str  # String ID (generated if missing)
    text: str  # Plaintext answer
    correct: bool


@dataclass
class UnitQuestionSchema:
    """Question for quiz unit (JSON format with plaintext)."""
    id: str  # String ID (generated if missing)
    difficulty: int  # 1-5
    type: str  # "single_choice"
    prompt: str  # Plaintext question
    explanation: str  # Plaintext explanation
    answers: List[UnitAnswerSchema]
    media: Optional[Dict[str, Any]] = None
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
# Quiz Unit v1 Validation
# ============================================================================

SLUG_PATTERN = re.compile(r'^[a-z0-9_]+$')


def validate_quiz_unit(data: Dict[str, Any], filename: str = "") -> QuizUnitSchema:
    """Validate quiz unit JSON content (quiz_unit_v1 format).
    
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
    
    # Validate schema_version
    schema_version = data.get("schema_version")
    if schema_version != "quiz_unit_v1":
        errors.append(f"Invalid schema_version{context}: expected 'quiz_unit_v1', got '{schema_version}'")
    
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
    context: str = ""
) -> UnitQuestionSchema:
    """Validate a single question in quiz unit format."""
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
    
    # Validate each answer
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
        
        answers.append(UnitAnswerSchema(
            id=answer_id,
            text=text.strip() if text else "",
            correct=correct if isinstance(correct, bool) else False,
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
        media=data.get("media"),
        sources=data.get("sources"),
        meta=data.get("meta"),
    )
