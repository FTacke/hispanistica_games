"""Quiz content release model for tracking imports and publishes."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from .models import QuizBase


class QuizContentRelease(QuizBase):
    """Content release tracking for production deployment.
    
    Tracks uploaded releases, their import status, and publish state.
    Only ONE release can be published at a time (active release).
    """
    __tablename__ = "quiz_content_releases"

    release_id: Mapped[str] = mapped_column(String(50), primary_key=True)  # e.g., "2026-01-06_1430"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # draft, published, unpublished
    
    # Import metadata
    imported_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    units_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Path used for import
    audio_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Path used for import
    
    # Counts
    units_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    audio_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    questions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    # Publish tracking
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    unpublished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Audit
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Optional: checksum manifest (JSON of file hashes)
    checksum_manifest: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

