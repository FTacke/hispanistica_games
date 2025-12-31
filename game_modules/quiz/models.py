"""SQLAlchemy ORM models for the Quiz game module.

PostgreSQL-ONLY implementation per quiz_module_implementation.md spec.

Tables:
- quiz_players: Game-specific player accounts (separate from webapp auth)
- quiz_sessions: Game session tokens
- quiz_topics: Quiz topic definitions
- quiz_questions: Question bank
- quiz_runs: Run state and progress
- quiz_run_answers: Individual answer records
- quiz_scores: Highscore snapshots
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    BigInteger,
    UniqueConstraint,
    Index,
    ARRAY,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class QuizBase(DeclarativeBase):
    """Base class for all Quiz module models."""
    pass


class QuizPlayer(QuizBase):
    """Game player account (separate from webapp users).
    
    Players authenticate with pseudonym + 4-char PIN.
    Anonymous players use name='Anónimo' with is_anonymous=True.
    """
    __tablename__ = "quiz_players"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)  # lowercase, trimmed, collapsed spaces
    pin_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # NULL for anonymous
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    sessions: Mapped[List["QuizSession"]] = relationship("QuizSession", back_populates="player", cascade="all, delete-orphan")
    runs: Mapped[List["QuizRun"]] = relationship("QuizRun", back_populates="player", cascade="all, delete-orphan")


class QuizSession(QuizBase):
    """Game session token for player authentication."""
    __tablename__ = "quiz_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    player_id: Mapped[str] = mapped_column(String(36), ForeignKey("quiz_players.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    player: Mapped["QuizPlayer"] = relationship("QuizPlayer", back_populates="sessions")

    __table_args__ = (
        Index("ix_quiz_sessions_token_hash", "token_hash"),
        Index("ix_quiz_sessions_expires_at", "expires_at"),
    )


class QuizTopic(QuizBase):
    """Quiz topic/category definition."""
    __tablename__ = "quiz_topics"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # topic_id e.g. "demo_topic"
    title_key: Mapped[str] = mapped_column(String(100), nullable=False)  # i18n key for title (or plaintext)
    description_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # i18n key for description (or plaintext)
    authors: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True, server_default='{}')  # List of author names
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    questions: Mapped[List["QuizQuestion"]] = relationship("QuizQuestion", back_populates="topic", cascade="all, delete-orphan")
    runs: Mapped[List["QuizRun"]] = relationship("QuizRun", back_populates="topic")
    scores: Mapped[List["QuizScore"]] = relationship("QuizScore", back_populates="topic")


class QuizQuestion(QuizBase):
    """Question bank entry.
    
    answers is a JSONB array: [{"id": 1, "text_key": "...", "correct": bool}, ...]
    media is optional JSONB: {"type": "audio", "url": "..."}
    sources is optional JSONB array of source references
    meta is optional JSONB for additional metadata
    """
    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)  # stable question id e.g. "topic_slug_q_<ULID>"
    topic_id: Mapped[str] = mapped_column(String(50), ForeignKey("quiz_topics.id", ondelete="CASCADE"), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="single_choice")
    prompt_key: Mapped[str] = mapped_column(String(100), nullable=False)  # i18n key
    explanation_key: Mapped[str] = mapped_column(String(100), nullable=False)  # i18n key - REQUIRED per spec 3.4
    answers: Mapped[dict] = mapped_column(JSONB, nullable=False)  # [{id, text_key, correct}, ...]
    media: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    sources: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    topic: Mapped["QuizTopic"] = relationship("QuizTopic", back_populates="questions")

    __table_args__ = (
        Index("ix_quiz_questions_topic_difficulty", "topic_id", "difficulty"),
    )


class QuizRun(QuizBase):
    """Quiz run state including questions, progress, and joker status.
    
    run_questions is JSONB array of 10 items:
    [{"question_id": "...", "difficulty": N, "answers_order": [1,3,2,4], "joker_disabled": [2,4]}, ...]
    
    joker_used_on is JSONB array of question indices where joker was used.
    """
    __tablename__ = "quiz_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    player_id: Mapped[str] = mapped_column(String(36), ForeignKey("quiz_players.id", ondelete="CASCADE"), nullable=False)
    topic_id: Mapped[str] = mapped_column(String(50), ForeignKey("quiz_topics.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="in_progress")  # in_progress, finished, abandoned
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Run state
    current_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-9
    run_questions: Mapped[dict] = mapped_column(JSONB, nullable=False)  # array of 10 question configs
    
    # Joker state
    joker_remaining: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    joker_used_on: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)  # [0, 5] = used on indices 0 and 5
    
    # Timer state (client epoch ms)
    question_started_at_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    deadline_at_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Relationships
    player: Mapped["QuizPlayer"] = relationship("QuizPlayer", back_populates="runs")
    topic: Mapped["QuizTopic"] = relationship("QuizTopic", back_populates="runs")
    answers: Mapped[List["QuizRunAnswer"]] = relationship("QuizRunAnswer", back_populates="run", cascade="all, delete-orphan")
    score: Mapped[Optional["QuizScore"]] = relationship("QuizScore", back_populates="run", uselist=False)

    __table_args__ = (
        Index("ix_quiz_runs_player_topic_status", "player_id", "topic_id", "status"),
        Index("ix_quiz_runs_created_at", "created_at"),
    )


class QuizRunAnswer(QuizBase):
    """Individual answer record for a run."""
    __tablename__ = "quiz_run_answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("quiz_runs.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(100), nullable=False)
    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_answer_id: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)  # NULL for timeout, string hash ID
    result: Mapped[str] = mapped_column(String(20), nullable=False)  # correct, wrong, timeout
    answered_at_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    used_joker: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    run: Mapped["QuizRun"] = relationship("QuizRun", back_populates="answers")

    __table_args__ = (
        UniqueConstraint("run_id", "question_index", name="uq_quiz_run_answers_run_index"),
    )


class QuizScore(QuizBase):
    """Highscore snapshot for a completed run."""
    __tablename__ = "quiz_scores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String(36), ForeignKey("quiz_runs.id", ondelete="CASCADE"), unique=True, nullable=False)
    player_name: Mapped[str] = mapped_column(String(50), nullable=False)  # Snapshot of player name
    topic_id: Mapped[str] = mapped_column(String(50), ForeignKey("quiz_topics.id", ondelete="CASCADE"), nullable=False)
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens_count: Mapped[int] = mapped_column(Integer, nullable=False)  # Number of difficulty levels completed perfectly
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

    # Relationships
    run: Mapped["QuizRun"] = relationship("QuizRun", back_populates="score")
    topic: Mapped["QuizTopic"] = relationship("QuizTopic", back_populates="scores")

    __table_args__ = (
        Index("ix_quiz_scores_topic_leaderboard", "topic_id", "total_score", "tokens_count", "created_at"),
    )


class QuizQuestionStats(QuizBase):
    """Optional statistics per question (for future analytics)."""
    __tablename__ = "quiz_question_stats"

    question_id: Mapped[str] = mapped_column(String(100), ForeignKey("quiz_questions.id", ondelete="CASCADE"), primary_key=True)
    played_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wrong_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    timeout_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
