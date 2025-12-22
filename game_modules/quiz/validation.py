"""Validation schemas for Quiz module content.

Uses dataclasses for validation since Pydantic is not in the project.
Provides strict validation for questions imported from YAML.
"""

from __future__ import annotations

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
