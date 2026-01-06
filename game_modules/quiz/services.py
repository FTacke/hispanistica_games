"""Business logic services for the Quiz game module.

Includes:
- Player authentication (register, login, logout)
- Session management
- Run lifecycle (start, resume, restart, finish)
- Question selection with history-based weighting
- Scoring and token calculation
- Leaderboard queries
"""

from __future__ import annotations

import hashlib
import logging
import os
import random
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple, Dict, Any

from flask import current_app
from passlib.hash import argon2
from sqlalchemy import select, and_, desc, asc, func, or_
from sqlalchemy.orm import Session

from .models import (
    QuizPlayer,
    QuizSession,
    QuizTopic,
    QuizQuestion,
    QuizRun,
    QuizRunAnswer,
    QuizScore,
)


logger = logging.getLogger(__name__)


_debug_counter = 0


def _quiz_debug_enabled() -> bool:
    try:
        if current_app and current_app.config.get("QUIZ_DEBUG"):
            return True
    except Exception:
        # current_app may not be available outside app context
        pass

    return os.environ.get("QUIZ_DEBUG", "0") in {"1", "true", "TRUE", "yes", "YES"}


def _quiz_debug_log(event: str, **fields: Any) -> None:
    global _debug_counter
    if not _quiz_debug_enabled():
        return
    _debug_counter += 1
    logger.info(
        "[quiz-debug:%s] %s %s",
        _debug_counter,
        event,
        {k: v for k, v in fields.items() if v is not None},
    )


# ============================================================================
# Configuration
# ============================================================================

TIMER_SECONDS = 30
JOKERS_PER_RUN = 2
QUESTIONS_PER_RUN = 10
DIFFICULTY_LEVELS = 5
QUESTIONS_PER_DIFFICULTY = 2
LEADERBOARD_LIMIT = 30
SESSION_EXPIRY_DAYS = 30
HISTORY_RUNS_COUNT = 3
MAX_HISTORY_QUESTIONS_PER_RUN = 2

# Scoring points per difficulty level
POINTS_PER_DIFFICULTY = {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    5: 50,
}


# ============================================================================
# Response Types
# ============================================================================

@dataclass
class AuthResult:
    success: bool
    player_id: Optional[str] = None
    player_name: Optional[str] = None
    session_token: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class RunState:
    """Complete run state for frontend."""
    run_id: str
    topic_id: str
    status: str
    current_index: int
    run_questions: List[Dict[str, Any]]
    joker_remaining: int
    joker_used_on: List[int]
    question_started_at_ms: Optional[int]
    deadline_at_ms: Optional[int]
    answers: List[Dict[str, Any]]


@dataclass
class AnswerResult:
    success: bool
    result: Optional[str] = None  # correct, wrong, timeout
    correct_option_id: Optional[str] = None  # The correct answer's ID (string hash)
    explanation: Optional[str] = None  # Explanation text (can be empty string)
    explanation_key: Optional[str] = None  # i18n key for explanation
    next_question_index: Optional[int] = None
    finished: bool = False
    joker_remaining: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    is_new_user: bool = False
    # Scoring fields - source of truth for live score
    earned_points: int = 0  # Points earned for this answer
    running_score: int = 0  # Total score so far in this run
    level_completed: bool = False  # True if this answer completes a difficulty level
    level_perfect: bool = False  # True if both questions in level were correct
    level_bonus: int = 0  # Bonus points for perfect level (if any)
    difficulty: int = 0  # Difficulty of the answered question
    level_correct_count: int = 0
    level_questions_in_level: int = 0


@dataclass
class ScoreResult:
    total_score: int
    tokens_count: int
    breakdown: List[Dict[str, Any]]  # Per-difficulty breakdown


# ============================================================================
# Name Normalization
# ============================================================================

def normalize_name(name: str) -> str:
    """Normalize player name: trim, lowercase, collapse multiple spaces."""
    import re
    normalized = name.strip().lower()
    normalized = re.sub(r'\s+', ' ', normalized)
    return normalized


# ============================================================================
# PIN Hashing (simplified for game use)
# ============================================================================

def hash_pin(pin: str) -> str:
    """Hash a 4-character PIN using argon2."""
    # Normalize to uppercase
    normalized = pin.upper().strip()
    return argon2.hash(normalized)


def verify_pin(plain: str, hashed: str) -> bool:
    """Verify PIN against stored hash."""
    normalized = plain.upper().strip()
    try:
        return argon2.verify(normalized, hashed)
    except Exception:
        return False


def hash_session_token(token: str) -> str:
    """Hash session token using SHA-256."""
    return hashlib.sha256(token.encode()).hexdigest()


# ============================================================================
# Player Authentication
# ============================================================================

def register_player(session: Session, name: str, pin: Optional[str], anonymous: bool = False) -> AuthResult:
    """Register a new player or return existing anonymous player.
    
    Args:
        session: SQLAlchemy session
        name: Player name (ignored if anonymous)
        pin: 4-character PIN (required if not anonymous)
        anonymous: If True, use shared "Anónimo" account
        
    Returns:
        AuthResult with session token on success
    """
    if anonymous:
        # Find or create the shared anonymous player
        stmt = select(QuizPlayer).where(QuizPlayer.is_anonymous)
        player = session.execute(stmt).scalar_one_or_none()
        
        if not player:
            player = QuizPlayer(
                id=str(uuid.uuid4()),
                name="Anónimo",
                normalized_name="anónimo",
                pin_hash=None,
                is_anonymous=True,
                created_at=datetime.now(timezone.utc),
                last_seen_at=datetime.now(timezone.utc),
            )
            session.add(player)
            session.flush()
        
        # Create session for anonymous player
        return _create_player_session(session, player)
    
    # Validate name
    name = name.strip()
    if not name or len(name) < 2 or len(name) > 50:
        return AuthResult(
            success=False,
            error_code="INVALID_NAME",
            error_message="Name must be 2-50 characters"
        )
    
    # Validate PIN
    if not pin or len(pin) != 4:
        return AuthResult(
            success=False,
            error_code="INVALID_PIN",
            error_message="PIN must be exactly 4 characters"
        )
    
    # Normalize name for lookup
    norm_name = normalize_name(name)
    
    # Check if name exists
    stmt = select(QuizPlayer).where(QuizPlayer.normalized_name == norm_name)
    existing = session.execute(stmt).scalar_one_or_none()
    
    if existing:
        return AuthResult(
            success=False,
            error_code="NAME_TAKEN",
            error_message="This name is already taken"
        )
    
    # Create new player
    player = QuizPlayer(
        id=str(uuid.uuid4()),
        name=name,
        normalized_name=norm_name,
        pin_hash=hash_pin(pin),
        is_anonymous=False,
        created_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    session.add(player)
    session.flush()
    
    return _create_player_session(session, player)


def login_player(session: Session, name: str, pin: str) -> AuthResult:
    """Login existing player with name and PIN.
    
    Args:
        session: SQLAlchemy session
        name: Player name
        pin: 4-character PIN
        
    Returns:
        AuthResult with session token on success
    """
    name = name.strip()
    norm_name = normalize_name(name)
    
    # Find player by normalized name
    stmt = select(QuizPlayer).where(
        and_(
            QuizPlayer.normalized_name == norm_name,
            ~QuizPlayer.is_anonymous
        )
    )
    player = session.execute(stmt).scalar_one_or_none()
    
    if not player:
        return AuthResult(
            success=False,
            error_code="INVALID_CREDENTIALS",
            error_message="Invalid name or PIN"
        )
    
    if not player.pin_hash or not verify_pin(pin, player.pin_hash):
        return AuthResult(
            success=False,
            error_code="INVALID_CREDENTIALS",
            error_message="Invalid name or PIN"
        )
    
    # Update last seen
    player.last_seen_at = datetime.now(timezone.utc)
    
    return _create_player_session(session, player)


def auth_name_pin(session: Session, name: str, pin: str) -> AuthResult:
    """Unified auth: Login if user exists, or auto-create if not.
    
    Behavior:
    1. If name unknown: create new user with PIN, login, return is_new_user=True
    2. If name known + PIN correct: login, return is_new_user=False
    3. If name known + PIN incorrect: return error PIN_MISMATCH
    
    Args:
        session: SQLAlchemy session
        name: Player name
        pin: 4-character PIN
        
    Returns:
        AuthResult with session token on success, error on PIN mismatch
    """
    # Validate name
    name = name.strip()
    if not name or len(name) < 2 or len(name) > 50:
        return AuthResult(
            success=False,
            error_code="INVALID_NAME",
            error_message="Name must be 2-50 characters"
        )
    
    # Validate PIN
    if not pin or len(pin) != 4:
        return AuthResult(
            success=False,
            error_code="INVALID_PIN",
            error_message="PIN must be exactly 4 characters"
        )
    
    # Normalize name for lookup
    norm_name = normalize_name(name)
    
    # Find existing player by normalized name
    stmt = select(QuizPlayer).where(
        and_(
            QuizPlayer.normalized_name == norm_name,
            ~QuizPlayer.is_anonymous
        )
    )
    existing = session.execute(stmt).scalar_one_or_none()
    
    if existing:
        # User exists - verify PIN
        if not existing.pin_hash or not verify_pin(pin, existing.pin_hash):
            return AuthResult(
                success=False,
                error_code="PIN_MISMATCH",
                error_message="Profil existiert bereits. Bitte korrekten PIN eingeben."
            )
        
        # PIN correct - login
        existing.last_seen_at = datetime.now(timezone.utc)
        result = _create_player_session(session, existing)
        result.is_new_user = False
        return result
    
    # User doesn't exist - create new account
    player = QuizPlayer(
        id=str(uuid.uuid4()),
        name=name,  # Preserve original casing
        normalized_name=norm_name,
        pin_hash=hash_pin(pin),
        is_anonymous=False,
        created_at=datetime.now(timezone.utc),
        last_seen_at=datetime.now(timezone.utc),
    )
    session.add(player)
    session.flush()
    
    result = _create_player_session(session, player)
    result.is_new_user = True
    return result


def _create_player_session(session: Session, player: QuizPlayer) -> AuthResult:
    """Create a new session for player and return AuthResult with token."""
    # Generate secure token
    token = secrets.token_urlsafe(32)
    token_hash = hash_session_token(token)
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    game_session = QuizSession(
        id=str(uuid.uuid4()),
        player_id=player.id,
        token_hash=token_hash,
        created_at=datetime.now(timezone.utc),
        expires_at=expires_at,
    )
    session.add(game_session)
    
    return AuthResult(
        success=True,
        player_id=player.id,
        player_name=player.name,
        session_token=token,
    )


def verify_session(session: Session, token: str) -> Optional[QuizPlayer]:
    """Verify session token and return player if valid."""
    if not token:
        return None
    
    token_hash = hash_session_token(token)
    now = datetime.now(timezone.utc)
    
    stmt = select(QuizSession).where(
        and_(
            QuizSession.token_hash == token_hash,
            QuizSession.expires_at > now
        )
    )
    game_session = session.execute(stmt).scalar_one_or_none()
    
    if not game_session:
        return None
    
    # Update player last seen
    player = game_session.player
    player.last_seen_at = now
    
    return player


def logout_player(session: Session, token: str) -> bool:
    """Invalidate session token."""
    if not token:
        return False
    
    token_hash = hash_session_token(token)
    stmt = select(QuizSession).where(QuizSession.token_hash == token_hash)
    game_session = session.execute(stmt).scalar_one_or_none()
    
    if game_session:
        session.delete(game_session)
        return True
    
    return False


# ============================================================================
# Topics
# ============================================================================

def get_active_topics(session: Session) -> List[QuizTopic]:
    """Get all active quiz topics ordered by order_index.
    
    Only returns topics from published releases (or topics without release_id for backward compatibility).
    """
    from .release_model import QuizContentRelease
    
    # Get published release IDs
    published_releases = session.query(QuizContentRelease.release_id).filter(
        QuizContentRelease.status == 'published'
    ).all()
    published_ids = [r[0] for r in published_releases]
    
    # Filter topics: must be active AND (release_id in published OR release_id is NULL)
    stmt = select(QuizTopic).where(
        QuizTopic.is_active,
        or_(QuizTopic.release_id.in_(published_ids), QuizTopic.release_id.is_(None))
    ).order_by(QuizTopic.order_index)
    
    return list(session.execute(stmt).scalars().all())


def get_topic(session: Session, topic_id: str) -> Optional[QuizTopic]:
    """Get a specific topic by ID."""
    stmt = select(QuizTopic).where(QuizTopic.id == topic_id)
    return session.execute(stmt).scalar_one_or_none()


# ============================================================================
# Run Lifecycle
# ============================================================================

def get_current_run(session: Session, player_id: str, topic_id: str) -> Optional[QuizRun]:
    """Get player's in-progress run for a topic."""
    stmt = select(QuizRun).where(
        and_(
            QuizRun.player_id == player_id,
            QuizRun.topic_id == topic_id,
            QuizRun.status == "in_progress"
        )
    )
    return session.execute(stmt).scalar_one_or_none()


def get_run_state(session: Session, run: QuizRun) -> RunState:
    """Build complete run state for frontend."""
    # Get answers
    stmt = select(QuizRunAnswer).where(QuizRunAnswer.run_id == run.id).order_by(QuizRunAnswer.question_index)
    answers = session.execute(stmt).scalars().all()
    
    answers_data = [
        {
            "question_id": a.question_id,
            "question_index": a.question_index,
            "selected_answer_id": a.selected_answer_id,
            "result": a.result,
            "answered_at_ms": a.answered_at_ms,
            "used_joker": a.used_joker,
        }
        for a in answers
    ]
    
    return RunState(
        run_id=run.id,
        topic_id=run.topic_id,
        status=run.status,
        current_index=run.current_index,
        run_questions=run.run_questions if isinstance(run.run_questions, list) else [],
        joker_remaining=run.joker_remaining,
        joker_used_on=run.joker_used_on if isinstance(run.joker_used_on, list) else [],
        question_started_at_ms=run.question_started_at_ms,
        deadline_at_ms=run.deadline_at_ms,
        answers=answers_data,
    )


def start_run(session: Session, player_id: str, topic_id: str, force_new: bool = False) -> Tuple[QuizRun, bool]:
    """Start a new run or return existing in-progress run.
    
    Args:
        session: SQLAlchemy session
        player_id: Player ID
        topic_id: Topic ID
        force_new: If True, abandon existing run and create new one
        
    Returns:
        Tuple of (run, is_new)
    """
    # Check for existing in-progress run
    existing = get_current_run(session, player_id, topic_id)
    
    if existing and not force_new:
        _quiz_debug_log(
            "start_run.resume",
            player_id=player_id,
            topic_id=topic_id,
            run_id=existing.id,
            current_index=existing.current_index,
            status=existing.status,
        )
        return (existing, False)
    
    if existing and force_new:
        # Mark existing as abandoned
        existing.status = "abandoned"
        existing.finished_at = datetime.now(timezone.utc)
        _quiz_debug_log(
            "start_run.abandon_existing",
            player_id=player_id,
            topic_id=topic_id,
            run_id=existing.id,
            current_index=existing.current_index,
        )
    
    # Build questions for new run
    run_questions = _build_run_questions(session, player_id, topic_id)
    
    # Create new run
    run = QuizRun(
        id=str(uuid.uuid4()),
        player_id=player_id,
        topic_id=topic_id,
        status="in_progress",
        created_at=datetime.now(timezone.utc),
        current_index=0,
        run_questions=run_questions,
        joker_remaining=JOKERS_PER_RUN,
        joker_used_on=[],
        question_started_at_ms=None,
        deadline_at_ms=None,
    )
    session.add(run)

    _quiz_debug_log(
        "start_run.new",
        player_id=player_id,
        topic_id=topic_id,
        run_id=run.id,
        current_index=run.current_index,
        force_new=force_new,
    )
    
    return (run, True)


def restart_run(session: Session, player_id: str, topic_id: str) -> QuizRun:
    """Abandon current run and start a new one."""
    run, _ = start_run(session, player_id, topic_id, force_new=True)
    return run


def select_questions_for_run(
    session: Session,
    topic_id: str,
    player_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Public interface for building run questions.
    
    This is a wrapper around _build_run_questions for external use (e.g., tests).
    
    Args:
        session: SQLAlchemy session
        topic_id: Topic to select questions from
        player_id: Player ID for history-based selection (optional)
        
    Returns:
        List of question configs with id, difficulty, etc.
    """
    return _build_run_questions(session, player_id, topic_id)


def _build_run_questions(session: Session, player_id: str, topic_id: str) -> List[Dict[str, Any]]:
    """Build array of 10 questions for a new run.
    
    Selection rules:
    - 5 difficulty levels × 2 questions each
    - Prefer questions answered incorrectly in last 3 runs (max 2 per new run)
    - Avoid repeating recently used questions
    - Shuffle answer order per question
    """
    # Get all active questions for topic grouped by difficulty
    # Only use questions from published releases (or questions without release_id)
    from .release_model import QuizContentRelease
    
    published_releases = session.query(QuizContentRelease.release_id).filter(
        QuizContentRelease.status == 'published'
    ).all()
    published_ids = [r[0] for r in published_releases]
    
    stmt = select(QuizQuestion).where(
        and_(
            QuizQuestion.topic_id == topic_id,
            QuizQuestion.is_active,
            or_(QuizQuestion.release_id.in_(published_ids), QuizQuestion.release_id.is_(None))
        )
    )
    all_questions = list(session.execute(stmt).scalars().all())
    
    questions_by_difficulty: Dict[int, List[QuizQuestion]] = {d: [] for d in range(1, DIFFICULTY_LEVELS + 1)}
    for q in all_questions:
        if 1 <= q.difficulty <= DIFFICULTY_LEVELS:
            questions_by_difficulty[q.difficulty].append(q)
    
    # Get history from last 3 runs
    history_question_ids, wrong_question_ids = _get_question_history(session, player_id, topic_id)
    
    # Build run questions
    run_questions = []
    wrong_used = 0
    
    for difficulty in range(1, DIFFICULTY_LEVELS + 1):
        available = questions_by_difficulty[difficulty].copy()
        random.shuffle(available)
        
        selected = []
        
        # Try to select 2 questions, preferring wrong ones
        for q in available:
            if len(selected) >= QUESTIONS_PER_DIFFICULTY:
                break
            
            # Check if this was answered wrong recently (prefer these)
            is_wrong = q.id in wrong_question_ids
            
            if is_wrong and wrong_used < MAX_HISTORY_QUESTIONS_PER_RUN:
                selected.append(q)
                wrong_used += 1
            elif not is_wrong and q.id not in history_question_ids:
                # Prefer questions not seen recently
                selected.append(q)
        
        # If we don't have enough, fill with any available
        for q in available:
            if len(selected) >= QUESTIONS_PER_DIFFICULTY:
                break
            if q not in selected:
                selected.append(q)
        
        # Build question config with shuffled answer order
        for q in selected:
            answer_ids = [a["id"] for a in q.answers]
            random.shuffle(answer_ids)
            
            run_questions.append({
                "question_id": q.id,
                "difficulty": q.difficulty,
                "answers_order": answer_ids,
                "joker_disabled": [],  # Will be populated if joker is used
            })
    
    return run_questions


def _get_question_history(session: Session, player_id: str, topic_id: str) -> Tuple[set, set]:
    """Get question IDs from last 3 runs and set of incorrectly answered ones."""
    # Get last 3 runs (any status)
    stmt = (
        select(QuizRun)
        .where(
            and_(
                QuizRun.player_id == player_id,
                QuizRun.topic_id == topic_id
            )
        )
        .order_by(desc(QuizRun.created_at))
        .limit(HISTORY_RUNS_COUNT)
    )
    runs = list(session.execute(stmt).scalars().all())
    
    history_ids = set()
    wrong_ids = set()
    
    for run in runs:
        # Get answers for this run
        stmt = select(QuizRunAnswer).where(QuizRunAnswer.run_id == run.id)
        answers = session.execute(stmt).scalars().all()
        
        for a in answers:
            history_ids.add(a.question_id)
            if a.result in ("wrong", "timeout"):
                wrong_ids.add(a.question_id)
    
    return history_ids, wrong_ids


# ============================================================================
# Timer / Question Start
# ============================================================================

def start_question(session: Session, run: QuizRun, question_index: int, started_at_ms: int) -> bool:
    """Record when a question was started (for timer resume).
    
    Idempotent: won't overwrite if already set for current index.
    """
    # Only set if this is the current question and not already started
    if run.current_index != question_index:
        return False
    
    if run.question_started_at_ms is not None:
        # Already started, don't overwrite
        return True
    
    run.question_started_at_ms = started_at_ms
    run.deadline_at_ms = started_at_ms + (TIMER_SECONDS * 1000)
    
    return True


# ============================================================================
# Answering
# ============================================================================

# Force reload trigger
def submit_answer(
    session: Session,
    run: QuizRun,
    question_index: int,
    selected_answer_id: Optional[str],
    answered_at_ms: int,
    used_joker: bool = False
) -> AnswerResult:
    """Submit answer for current question.
    
    Args:
        session: SQLAlchemy session
        run: Current run
        question_index: Index of question being answered (0-9)
        selected_answer_id: Selected answer ID (string hash, None for timeout)
        answered_at_ms: Client timestamp when answer was submitted
        used_joker: Whether joker was used on this question
        
    Returns:
        AnswerResult with result and next state
    """
    # Validate index
    if question_index != run.current_index:
        return AnswerResult(
            success=False,
            error_code="INVALID_INDEX",
            error_message="Question index doesn't match current position"
        )
    
    if run.status != "in_progress":
        return AnswerResult(
            success=False,
            error_code="RUN_NOT_ACTIVE",
            error_message="Run is not in progress"
        )
    
    # Get question config and actual question
    question_config = run.run_questions[question_index]
    question_id = question_config["question_id"]
    
    stmt = select(QuizQuestion).where(QuizQuestion.id == question_id)
    question = session.execute(stmt).scalar_one_or_none()
    
    if not question:
        return AnswerResult(
            success=False,
            error_code="QUESTION_NOT_FOUND",
            error_message="Question not found"
        )
    
    # Determine result and find correct answer ID
    result = "timeout"
    correct_id = None
    
    # Find correct answer
    for ans in question.answers:
        if ans.get("correct"):
            correct_id = ans["id"]
            break
    
    # Check for timeout (server-side validation)
    if run.deadline_at_ms and answered_at_ms > run.deadline_at_ms:
        result = "timeout"
    elif selected_answer_id is not None:
        # Frontend sends answer IDs via DOM dataset (always strings).
        # Seeded/demo content may use numeric IDs (int) inside JSONB.
        # Normalize the selected ID for comparison without changing the public
        # correct_option_id type (existing tests expect ints for numeric content).
        selected_id_for_compare = selected_answer_id
        if isinstance(correct_id, int):
            if isinstance(selected_answer_id, str):
                s = selected_answer_id.strip()
                if s.isdigit():
                    selected_id_for_compare = int(s)
        elif isinstance(correct_id, str):
            if isinstance(selected_answer_id, int):
                selected_id_for_compare = str(selected_answer_id)

        result = "correct" if selected_id_for_compare == correct_id else "wrong"
    
    # Record answer
    answer = QuizRunAnswer(
        id=str(uuid.uuid4()),
        run_id=run.id,
        question_id=question_id,
        question_index=question_index,
        selected_answer_id=(str(selected_answer_id) if selected_answer_id is not None else None),
        result=result,
        answered_at_ms=answered_at_ms,
        used_joker=used_joker,
        created_at=datetime.now(timezone.utc),
    )
    session.add(answer)
    
    # Update joker state if used
    if used_joker and question_index not in run.joker_used_on:
        joker_used = list(run.joker_used_on) if run.joker_used_on else []
        joker_used.append(question_index)
        run.joker_used_on = joker_used
        # Note: joker_remaining is decremented when joker is applied, not here
    
    # Advance to next question
    next_index = question_index + 1
    run.current_index = next_index
    run.question_started_at_ms = None
    run.deadline_at_ms = None
    
    finished = next_index >= QUESTIONS_PER_RUN

    # IMPORTANT: flush pending inserts/updates so score calculation sees the just-added answer.
    # Without this, calculate_running_score may query stale DB state and return lagging running_score.
    session.flush()
    
    # Calculate earned points for this answer
    difficulty = question_config["difficulty"]
    is_correct = result == "correct"
    earned_points = calculate_answer_score(difficulty, is_correct)
    
    # Calculate running score and check for level completion
    running_score, level_completed, level_perfect, level_bonus, level_correct_count, level_questions_in_level = calculate_running_score(
        session, run, question_index, result
    )

    _quiz_debug_log(
        "submit_answer.result",
        run_id=run.id,
        player_id=run.player_id,
        question_index=question_index,
        result=result,
        earned_points=earned_points,
        running_score=running_score,
        level_completed=level_completed,
        level_perfect=level_perfect,
        level_bonus=level_bonus,
        finished=finished,
        next_question_index=(next_index if not finished else None),
    )
    
    return AnswerResult(
        success=True,
        result=result,
        correct_option_id=correct_id,
        explanation_key=question.explanation_key,
        next_question_index=next_index if not finished else None,
        finished=finished,
        joker_remaining=run.joker_remaining,
        earned_points=earned_points,
        running_score=running_score,
        level_completed=level_completed,
        level_perfect=level_perfect,
        level_bonus=level_bonus,
        difficulty=difficulty,
        level_correct_count=level_correct_count,
        level_questions_in_level=level_questions_in_level,
    )


def use_joker(session: Session, run: QuizRun, question_index: int) -> Tuple[bool, List[str], Optional[str]]:
    """Use joker on current question to disable 2 wrong answers.
    
    Returns:
        Tuple of (success, disabled_answer_ids (list of string hashes), error_code)
    """
    if run.joker_remaining <= 0:
        return (False, [], "LIMIT_REACHED")
    
    if question_index != run.current_index:
        return (False, [], "INVALID_INDEX")
    
    # Check if joker already used on this question
    if question_index in (run.joker_used_on or []):
        # Return existing disabled answers (idempotent)
        question_config = run.run_questions[question_index]
        return (True, question_config.get("joker_disabled", []), None)
    
    # Get question
    question_config = run.run_questions[question_index]
    question_id = question_config["question_id"]
    
    stmt = select(QuizQuestion).where(QuizQuestion.id == question_id)
    question = session.execute(stmt).scalar_one_or_none()
    
    if not question:
        return (False, [], "QUESTION_NOT_FOUND")
    
    # Find wrong answer IDs
    wrong_ids = []
    for ans in question.answers:
        if not ans.get("correct"):
            wrong_ids.append(ans["id"])
    
    # Validate: need at least 2 wrong answers to hide
    if len(wrong_ids) < 2:
        return (False, [], "NOT_ENOUGH_OPTIONS")
    
    # Select 2 wrong answers to disable - DETERMINISTIC using hash(run_id + question_id)
    # This ensures same result on reload/re-call
    seed_str = f"{run.id}:{question_id}"
    seed_hash = hash(seed_str) & 0xFFFFFFFF  # Ensure positive
    import random as rng
    deterministic_rng = rng.Random(seed_hash)
    
    # Shuffle wrong_ids deterministically and take first 2
    shuffled_wrong = wrong_ids.copy()
    deterministic_rng.shuffle(shuffled_wrong)
    disabled = shuffled_wrong[:2]
    
    # Update run state (persist)
    run_questions = list(run.run_questions)
    run_questions[question_index]["joker_disabled"] = disabled
    run.run_questions = run_questions
    
    joker_used = list(run.joker_used_on) if run.joker_used_on else []
    joker_used.append(question_index)
    run.joker_used_on = joker_used
    
    run.joker_remaining -= 1
    
    return (True, disabled, None)


# ============================================================================
# Scoring
# ============================================================================

def calculate_answer_score(
    difficulty: int,
    is_correct: bool,
) -> int:
    """Calculate score for a single correct answer.
    
    Per spec section 1.7:
    - difficulty 1: 10 points
    - difficulty 2: 20 points
    - difficulty 3: 30 points
    - difficulty 4: 40 points
    - difficulty 5: 50 points
    
    Args:
        difficulty: Question difficulty (1-5)
        is_correct: Whether the answer was correct
        
    Returns:
        Score for this answer (0 if incorrect)
    """
    if not is_correct:
        return 0
    
    return POINTS_PER_DIFFICULTY.get(difficulty, 10)


def calculate_running_score(
    session: Session,
    run: QuizRun,
    current_question_index: int,
    current_result: str,
) -> Tuple[int, bool, bool, int, int, int]:
    """Calculate running score after an answer, including level completion check.
    
    This function calculates the same score that will be saved in quiz_scores
    to ensure consistency between live display and final highscore.
    
    Args:
        session: SQLAlchemy session
        run: Current run
        current_question_index: Index of the question just answered (0-9)
        current_result: Result of current answer ('correct', 'wrong', 'timeout')
    
    Returns:
        Tuple of (running_score, level_completed, level_perfect, level_bonus, level_correct_count, level_questions_in_level)
        - running_score: Total points so far (same formula as highscore)
        - level_completed: True if this answer completes a difficulty level
        - level_perfect: True if both questions in the completed level were correct
        - level_bonus: Bonus points earned for perfect level (0 if not perfect)
        - level_correct_count: Number of correct answers in this level
        - level_questions_in_level: Total questions in this level
    """
    # Get all answers including the one just submitted
    stmt = select(QuizRunAnswer).where(QuizRunAnswer.run_id == run.id).order_by(QuizRunAnswer.question_index)
    answers = list(session.execute(stmt).scalars().all())
    
    # Build results by difficulty
    difficulty_results: Dict[int, List[bool]] = {d: [] for d in range(1, DIFFICULTY_LEVELS + 1)}
    
    for i, q_config in enumerate(run.run_questions):
        if i > current_question_index:
            break  # Don't count future questions
        difficulty = q_config["difficulty"]
        # Find answer for this question
        answer = next((a for a in answers if a.question_index == i), None)
        is_correct = answer and answer.result == "correct"
        difficulty_results[difficulty].append(is_correct)
    
    # Calculate running score using exact same logic as finish_run
    running_score = 0
    total_level_bonus = 0
    
    # Track level completion for current question
    current_difficulty = run.run_questions[current_question_index]["difficulty"]
    level_completed = False
    level_perfect = False
    level_bonus = 0
    
    for difficulty in range(1, DIFFICULTY_LEVELS + 1):
        results = difficulty_results[difficulty]
        correct_count = sum(1 for r in results if r)
        points = correct_count * POINTS_PER_DIFFICULTY[difficulty]
        
        # Token bonus: both questions correct (same as highscore calculation)
        bonus = 0
        is_perfect = len(results) == 2 and all(results)
        if is_perfect:
            bonus = 2 * POINTS_PER_DIFFICULTY[difficulty]
            total_level_bonus += bonus
        
        running_score += points + bonus
        
        # Check if current answer completed this level
        if difficulty == current_difficulty and len(results) == 2:
            level_completed = True
            level_perfect = is_perfect
            level_bonus = bonus if is_perfect else 0
            level_correct_count = correct_count
            level_questions_in_level = len(results)
            
    # Return extended stats for frontend
    return (running_score, level_completed, level_perfect, level_bonus, level_correct_count if level_completed else 0, level_questions_in_level if level_completed else 0)


def finish_run(session: Session, run: QuizRun) -> ScoreResult:
    """Finish run and calculate final score.
    
    Returns:
        ScoreResult with total score and token count
    """
    # Idempotency check: if already finished, return existing score
    if run.status == "finished":
        # Find existing score
        stmt = select(QuizScore).where(QuizScore.run_id == run.id)
        existing_score = session.execute(stmt).scalar_one_or_none()
        
        if existing_score:
            # Re-calculate breakdown (not stored in QuizScore, but needed for result)
            # This is a bit expensive but ensures consistent return type
            stmt = select(QuizRunAnswer).where(QuizRunAnswer.run_id == run.id).order_by(QuizRunAnswer.question_index)
            answers = list(session.execute(stmt).scalars().all())
            
            difficulty_results: Dict[int, List[bool]] = {d: [] for d in range(1, DIFFICULTY_LEVELS + 1)}
            for i, q_config in enumerate(run.run_questions):
                difficulty = q_config["difficulty"]
                answer = next((a for a in answers if a.question_index == i), None)
                is_correct = answer and answer.result == "correct"
                difficulty_results[difficulty].append(is_correct)
                
            breakdown = []
            for difficulty in range(1, DIFFICULTY_LEVELS + 1):
                results = difficulty_results[difficulty]
                correct_count = sum(1 for r in results if r)
                points = correct_count * POINTS_PER_DIFFICULTY[difficulty]
                earned_token = len(results) == 2 and all(results)
                token_bonus = 2 * POINTS_PER_DIFFICULTY[difficulty] if earned_token else 0
                
                breakdown.append({
                    "difficulty": difficulty,
                    "correct": correct_count,
                    "total": len(results),
                    "points": points,
                    "token_earned": earned_token,
                    "token_bonus": token_bonus,
                })
                
            return ScoreResult(
                total_score=existing_score.total_score,
                tokens_count=existing_score.tokens_count,
                breakdown=breakdown,
            )

    # Get all answers
    stmt = select(QuizRunAnswer).where(QuizRunAnswer.run_id == run.id).order_by(QuizRunAnswer.question_index)
    answers = list(session.execute(stmt).scalars().all())
    
    # Calculate score per difficulty
    difficulty_results: Dict[int, List[bool]] = {d: [] for d in range(1, DIFFICULTY_LEVELS + 1)}
    
    for i, q_config in enumerate(run.run_questions):
        difficulty = q_config["difficulty"]
        # Find answer for this question
        answer = next((a for a in answers if a.question_index == i), None)
        is_correct = answer and answer.result == "correct"
        difficulty_results[difficulty].append(is_correct)
    
    # Calculate total score and tokens
    total_score = 0
    tokens_count = 0
    breakdown = []
    
    for difficulty in range(1, DIFFICULTY_LEVELS + 1):
        results = difficulty_results[difficulty]
        correct_count = sum(1 for r in results if r)
        points = correct_count * POINTS_PER_DIFFICULTY[difficulty]
        
        # Token bonus: both questions correct
        token_bonus = 0
        earned_token = len(results) == 2 and all(results)
        if earned_token:
            tokens_count += 1
            token_bonus = 2 * POINTS_PER_DIFFICULTY[difficulty]
        
        total_score += points + token_bonus
        
        breakdown.append({
            "difficulty": difficulty,
            "correct": correct_count,
            "total": len(results),
            "points": points,
            "token_earned": earned_token,
            "token_bonus": token_bonus,
        })
    
    # Update run
    run.status = "finished"
    run.finished_at = datetime.now(timezone.utc)
    
    # Get player name for snapshot
    player = run.player
    
    # Create score snapshot
    score = QuizScore(
        id=str(uuid.uuid4()),
        run_id=run.id,
        player_name=player.name,
        topic_id=run.topic_id,
        total_score=total_score,
        tokens_count=tokens_count,
        created_at=datetime.now(timezone.utc),
    )
    session.add(score)
    
    return ScoreResult(
        total_score=total_score,
        tokens_count=tokens_count,
        breakdown=breakdown,
    )


# ============================================================================
# Leaderboard
# ============================================================================

# Legacy anonymous names that should always be filtered out (backup)
ANONYMOUS_NAME_PATTERNS = frozenset(['anónimo', 'anonimo', 'anonymous', 'anonym', 'gast', 'guest'])

def get_leaderboard(session: Session, topic_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    """Get global leaderboard for topic, sorted by score.
    
    Ranking logic:
    1. total_score DESC (Highest score first)
    2. created_at ASC (Earlier finish wins tiebreaker)
    
    Returns top N entries (default 30).
    Only includes non-anonymous players.
    Filters both by is_anonymous flag AND legacy anonymous names.
    """
    stmt = (
        select(QuizScore)
        .join(QuizRun, QuizScore.run_id == QuizRun.id)
        .join(QuizPlayer, QuizRun.player_id == QuizPlayer.id)
        .where(
            and_(
                QuizScore.topic_id == topic_id,
                ~QuizPlayer.is_anonymous,
                # Legacy backup: also exclude known anonymous name patterns
                ~func.lower(QuizPlayer.name).in_(ANONYMOUS_NAME_PATTERNS)
            )
        )
        .order_by(
            desc(QuizScore.total_score),
            asc(QuizScore.created_at)
        )
        .limit(limit)
    )
    scores = session.execute(stmt).scalars().all()
    
    return [
        {
            "entry_id": s.id,  # NEW: Include entry ID for admin delete functionality
            "rank": i + 1,
            "player_name": s.player_name,
            "total_score": s.total_score,
            "tokens_count": s.tokens_count,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for i, s in enumerate(scores)
    ]
