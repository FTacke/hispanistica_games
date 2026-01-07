"""Production content import service for quiz modules.

This service handles:
- Importing quiz units from JSON files
- Audio file hash calculation
- Idempotent UPSERT operations
- Release tracking (draft/published/unpublished)
- Detailed logging to data/import_logs/
- Validation using existing validators

Design:
- Framework-agnostic (can be used by CLI or Dashboard)
- Transaction-safe (all-or-nothing imports)
- Idempotent (multiple imports of same release → same result)
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from .models import QuizTopic, QuizQuestion
from .release_model import QuizContentRelease
from .validation import validate_quiz_unit, ValidationError, QuizUnitSchema


def to_jsonable(obj: Any) -> Any:
    """Convert an object to JSON-serializable format.
    
    Handles:
    - None -> None
    - Pydantic v2: obj.model_dump(mode="json")
    - Pydantic v1: obj.dict()
    - dataclass: dataclasses.asdict(obj)
    - dict/list/primitives: return as-is
    
    Args:
        obj: Object to convert
        
    Returns:
        JSON-serializable version (dict, list, None, or primitive)
    """
    if obj is None:
        return None
    
    # Already JSON-serializable
    if isinstance(obj, (dict, list, str, int, float, bool)):
        return obj
    
    # Pydantic v2
    if hasattr(obj, 'model_dump'):
        return obj.model_dump(mode='json')
    
    # Pydantic v1
    if hasattr(obj, 'dict'):
        return obj.dict()
    
    # Dataclass
    if hasattr(obj, '__dataclass_fields__'):
        from dataclasses import asdict
        return asdict(obj)
    
    # Fallback: return as-is (may fail at DB insert, but better than silent corruption)
    return obj


# Configure module logger
logger = logging.getLogger(__name__)


@dataclass
class ImportResult:
    """Result of an import operation."""
    success: bool
    release_id: str
    units_imported: int = 0
    questions_imported: int = 0
    audio_files_processed: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    skipped: bool = False
    dry_run: bool = False


@dataclass
class PublishResult:
    """Result of a publish/unpublish operation."""
    success: bool
    release_id: str
    units_affected: int = 0
    errors: List[str] = field(default_factory=list)


class QuizImportService:
    """Service for importing and managing quiz content releases."""
    
    def __init__(self, project_root: Optional[Path] = None):
        """Initialize import service.
        
        Args:
            project_root: Project root directory (auto-detected if not provided)
        """
        if project_root is None:
            # Auto-detect: service is in game_modules/quiz/, root is 2 levels up
            project_root = Path(__file__).parent.parent.parent
        
        self.project_root = project_root
        self.import_logs_dir = project_root / "data" / "import_logs"
        self.import_logs_dir.mkdir(parents=True, exist_ok=True)
    
    def _setup_log_file(self, release_id: str, command: str) -> logging.FileHandler:
        """Create log file for this import operation.
        
        Args:
            release_id: Release identifier
            command: Command name (import, publish, unpublish)
            
        Returns:
            FileHandler configured for this operation
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        log_filename = f"{timestamp}_{command}_{release_id}.log"
        log_path = self.import_logs_dir / log_filename
        
        file_handler = logging.FileHandler(log_path, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(logging.Formatter(
            '[%(asctime)s] %(levelname)s: %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
        
        logger.addHandler(file_handler)
        logger.info(f"Logging to: {log_path}")
        
        return file_handler
    
    def _compute_audio_hash(self, audio_path: Path) -> str:
        """Compute SHA256 hash of audio file.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Hex-encoded SHA256 hash
        """
        sha256 = hashlib.sha256()
        with open(audio_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _validate_unit_file(self, json_path: Path) -> QuizUnitSchema:
        """Load and validate a quiz unit JSON file.
        
        Args:
            json_path: Path to JSON file
            
        Returns:
            Validated QuizUnitSchema
            
        Raises:
            ValidationError: If validation fails
            json.JSONDecodeError: If JSON is malformed
        """
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Use existing validator from validation.py
        unit = validate_quiz_unit(data, json_path.stem)
        return unit
    
    def _collect_audio_refs(self, unit: QuizUnitSchema) -> List[str]:
        """Collect all audio file references from a unit.
        
        Args:
            unit: Validated quiz unit
            
        Returns:
            List of audio file paths (relative refs from JSON)
        """
        audio_refs = []
        
        for question in unit.questions:
            # Question-level media
            for media in question.media:
                if media.type == 'audio' and media.seed_src:
                    audio_refs.append(media.seed_src)
            
            # Answer-level media
            for answer in question.answers:
                for media in answer.media:
                    if media.type == 'audio' and media.seed_src:
                        audio_refs.append(media.seed_src)
        
        return audio_refs
    
    def import_release(
        self,
        session: Session,
        units_path: str,
        audio_path: str,
        release_id: str,
        dry_run: bool = False
    ) -> ImportResult:
        """Import a content release from JSON files.
        
        This is the main entry point for content imports. It:
        1. Validates all JSON files
        2. Checks audio file references
        3. Computes audio hashes
        4. Imports topics and questions (UPSERT)
        5. Updates release metadata
        
        Args:
            session: SQLAlchemy session
            units_path: Path to units directory (contains *.json files)
            audio_path: Path to audio directory (contains *.mp3 files)
            release_id: Release identifier (e.g., "2026-01-06_1430")
            dry_run: If True, validate only (no DB writes)
            
        Returns:
            ImportResult with counts and errors
        """
        file_handler = self._setup_log_file(release_id, "import")
        
        try:
            logger.info(f"{'DRY-RUN: ' if dry_run else ''}Starting import for release '{release_id}'")
            logger.info(f"Units path: {units_path}")
            logger.info(f"Audio path: {audio_path}")
            
            result = ImportResult(
                success=True,
                release_id=release_id,
                dry_run=dry_run
            )
            
            # Convert paths
            units_dir = Path(units_path)
            audio_dir = Path(audio_path)
            
            # Validate paths exist
            if not units_dir.exists():
                msg = f"Units directory not found: {units_dir}"
                logger.error(msg)
                result.errors.append(msg)
                result.success = False
                return result
            
            if not audio_dir.exists():
                msg = f"Audio directory not found: {audio_dir}"
                logger.warning(msg)
                result.warnings.append(msg)
                # Continue - audio might be optional
            
            # Find all JSON files
            json_files = list(units_dir.glob("*.json"))
            if not json_files:
                msg = f"No JSON files found in {units_dir}"
                logger.error(msg)
                result.errors.append(msg)
                result.success = False
                return result
            
            logger.info(f"Found {len(json_files)} JSON files")
            
            # Phase 1: Validate all units
            logger.info("Phase 1: Validating units...")
            units = []
            audio_refs_map = {}  # unit_slug -> [audio_refs]
            
            for json_file in sorted(json_files):
                try:
                    logger.debug(f"Validating {json_file.name}...")
                    unit = self._validate_unit_file(json_file)
                    
                    # Check slug matches filename
                    expected_filename = f"{unit.slug}.json"
                    if json_file.name != expected_filename:
                        msg = f"Filename mismatch: {json_file.name} (expected: {expected_filename})"
                        logger.error(msg)
                        result.errors.append(msg)
                        result.success = False
                        continue
                    
                    units.append((json_file, unit))
                    audio_refs = self._collect_audio_refs(unit)
                    audio_refs_map[unit.slug] = audio_refs
                    
                    logger.info(f"✓ {json_file.name}: {len(unit.questions)} questions, {len(audio_refs)} audio refs")
                    
                except (ValidationError, json.JSONDecodeError) as e:
                    msg = f"Validation failed for {json_file.name}: {e}"
                    logger.error(msg)
                    result.errors.append(msg)
                    result.success = False
            
            if not result.success:
                logger.error(f"Validation failed: {len(result.errors)} error(s)")
                return result
            
            # Phase 2: Check audio files
            logger.info("Phase 2: Checking audio files...")
            audio_hashes = {}  # relative_path -> sha256
            
            for unit_slug, audio_refs in audio_refs_map.items():
                for ref in audio_refs:
                    # Audio refs are relative to JSON file location
                    # For production imports, audio is in separate audio/ dir
                    # So we look for just the filename
                    audio_filename = Path(ref).name
                    audio_file = audio_dir / audio_filename
                    
                    if not audio_file.exists():
                        msg = f"Audio file not found: {audio_file} (ref: {ref} in {unit_slug})"
                        logger.error(msg)
                        result.errors.append(msg)
                        result.success = False
                        continue
                    
                    # Compute hash (cached)
                    if audio_filename not in audio_hashes:
                        sha256 = self._compute_audio_hash(audio_file)
                        audio_hashes[audio_filename] = sha256
                        logger.debug(f"Audio {audio_filename}: SHA256={sha256[:16]}...")
            
            if not result.success:
                logger.error(f"Audio validation failed: {len(result.errors)} error(s)")
                return result
            
            result.audio_files_processed = len(audio_hashes)
            logger.info(f"✓ Audio files: {result.audio_files_processed} unique files")
            
            if dry_run:
                logger.info("DRY-RUN: Skipping database writes")
                logger.info(f"Would import {len(units)} units with {sum(len(u.questions) for _, u in units)} questions")
                return result
            
            # Phase 3: Database import (UPSERT)
            logger.info("Phase 3: Importing to database...")
            
            # Create or update release record
            release = session.query(QuizContentRelease).filter(
                QuizContentRelease.release_id == release_id
            ).first()
            
            if not release:
                release = QuizContentRelease(
                    release_id=release_id,
                    status="draft",
                    units_path=units_path,
                    audio_path=audio_path,
                    created_at=datetime.now(timezone.utc)
                )
                session.add(release)
                logger.info(f"Created release record: {release_id}")
            else:
                release.status = "draft"  # Reset to draft on re-import
                release.units_path = units_path
                release.audio_path = audio_path
                release.updated_at = datetime.now(timezone.utc)
                logger.info(f"Updated release record: {release_id}")
            
            # Import units
            for json_file, unit in units:
                try:
                    # UPSERT topic
                    topic = session.query(QuizTopic).filter(QuizTopic.id == unit.slug).first()
                    
                    if topic:
                        # Update existing (preserve is_active if manually set to false)
                        topic.title_key = unit.title
                        topic.description_key = unit.description
                        topic.authors = unit.authors or []
                        topic.based_on = to_jsonable(unit.based_on)
                        # Do NOT override is_active if set to false (soft-delete semantics)
                        # topic.is_active = True  # ← REMOVED: Admin decision has priority
                        topic.release_id = release_id
                        logger.debug(f"Updated topic: {unit.slug}")
                    else:
                        # Create new
                        topic = QuizTopic(
                            id=unit.slug,
                            title_key=unit.title,
                            description_key=unit.description,
                            authors=unit.authors or [],
                            based_on=to_jsonable(unit.based_on),
                            is_active=True,
                            release_id=release_id,
                            created_at=datetime.now(timezone.utc)
                        )
                        session.add(topic)
                        logger.debug(f"Created topic: {unit.slug}")
                    
                    # UPSERT questions
                    questions_in_unit = []
                    for q in unit.questions:
                        # Build answers JSON
                        answers_json = []
                        for ans in q.answers:
                            ans_dict = {
                                "id": ans.id,
                                "text": ans.text,  # Plaintext
                                "correct": ans.correct,
                            }
                            # Add media if present
                            if ans.media:
                                ans_dict["media"] = [
                                    {"type": m.type, "src": m.src or m.seed_src}
                                    for m in ans.media
                                ]
                            answers_json.append(ans_dict)
                        
                        # Build media JSON
                        media_json = []
                        if q.media:
                            for m in q.media:
                                media_json.append({
                                    "type": m.type,
                                    "src": m.src or m.seed_src
                                })
                        
                        # UPSERT question
                        question = session.query(QuizQuestion).filter(QuizQuestion.id == q.id).first()
                        
                        if question:
                            # Update existing
                            question.topic_id = unit.slug
                            question.difficulty = q.difficulty
                            question.type = q.type
                            question.prompt_key = q.prompt
                            question.explanation_key = q.explanation
                            question.answers = answers_json
                            question.media = media_json if media_json else None
                            question.sources = q.sources
                            question.meta = q.meta
                            question.is_active = True
                            question.release_id = release_id
                            logger.debug(f"Updated question: {q.id}")
                        else:
                            # Create new
                            question = QuizQuestion(
                                id=q.id,
                                topic_id=unit.slug,
                                difficulty=q.difficulty,
                                type=q.type,
                                prompt_key=q.prompt,
                                explanation_key=q.explanation,
                                answers=answers_json,
                                media=media_json if media_json else None,
                                sources=q.sources,
                                meta=q.meta,
                                is_active=True,
                                release_id=release_id,
                                created_at=datetime.now(timezone.utc)
                            )
                            session.add(question)
                            logger.debug(f"Created question: {q.id}")
                        
                        questions_in_unit.append(q.id)
                    
                    result.units_imported += 1
                    result.questions_imported += len(questions_in_unit)
                    logger.info(f"✓ Imported {unit.slug}: {len(questions_in_unit)} questions")
                    
                except Exception as e:
                    msg = f"Failed to import {unit.slug}: {e}"
                    logger.error(msg, exc_info=True)
                    result.errors.append(msg)
                    result.success = False
                    session.rollback()
                    return result
            
            # Update release counts
            release.units_count = result.units_imported
            release.questions_count = result.questions_imported
            release.audio_count = result.audio_files_processed
            release.imported_at = datetime.now(timezone.utc)
            
            # Commit transaction
            session.commit()
            
            logger.info(f"✓ Import completed successfully")
            logger.info(f"  Units: {result.units_imported}")
            logger.info(f"  Questions: {result.questions_imported}")
            logger.info(f"  Audio files: {result.audio_files_processed}")
            
            return result
            
        except Exception as e:
            logger.error(f"Import failed with exception: {e}", exc_info=True)
            result = ImportResult(
                success=False,
                release_id=release_id,
                errors=[str(e)]
            )
            return result
        
        finally:
            logger.removeHandler(file_handler)
            file_handler.close()
    
    def publish_release(self, session: Session, release_id: str) -> PublishResult:
        """Publish a release (mark as active).
        
        Only one release can be published at a time.
        Publishing a new release automatically unpublishes the previous one.
        
        Args:
            session: SQLAlchemy session
            release_id: Release to publish
            
        Returns:
            PublishResult
        """
        file_handler = self._setup_log_file(release_id, "publish")
        
        try:
            logger.info(f"Publishing release: {release_id}")
            
            result = PublishResult(success=True, release_id=release_id)
            
            # Find release
            release = session.query(QuizContentRelease).filter(
                QuizContentRelease.release_id == release_id
            ).first()
            
            if not release:
                msg = f"Release not found: {release_id}"
                logger.error(msg)
                result.errors.append(msg)
                result.success = False
                return result
            
            if not release.imported_at:
                msg = f"Release not imported yet: {release_id}"
                logger.error(msg)
                result.errors.append(msg)
                result.success = False
                return result
            
            # Unpublish all other releases
            other_releases = session.query(QuizContentRelease).filter(
                QuizContentRelease.status == "published"
            ).all()
            
            for other in other_releases:
                other.status = "unpublished"
                other.unpublished_at = datetime.now(timezone.utc)
                logger.info(f"Unpublished previous release: {other.release_id}")
            
            # Publish this release
            release.status = "published"
            release.published_at = datetime.now(timezone.utc)
            release.updated_at = datetime.now(timezone.utc)
            
            # Count affected units
            units = session.query(QuizTopic).filter(
                QuizTopic.release_id == release_id
            ).count()
            
            result.units_affected = units
            
            session.commit()
            
            logger.info(f"✓ Published release {release_id} ({units} units)")
            
            return result
            
        except Exception as e:
            logger.error(f"Publish failed: {e}", exc_info=True)
            result = PublishResult(
                success=False,
                release_id=release_id,
                errors=[str(e)]
            )
            return result
        
        finally:
            logger.removeHandler(file_handler)
            file_handler.close()
    
    def unpublish_release(self, session: Session, release_id: str) -> PublishResult:
        """Unpublish a release (rollback).
        
        Args:
            session: SQLAlchemy session
            release_id: Release to unpublish
            
        Returns:
            PublishResult
        """
        file_handler = self._setup_log_file(release_id, "unpublish")
        
        try:
            logger.info(f"Unpublishing release: {release_id}")
            
            result = PublishResult(success=True, release_id=release_id)
            
            # Find release
            release = session.query(QuizContentRelease).filter(
                QuizContentRelease.release_id == release_id
            ).first()
            
            if not release:
                msg = f"Release not found: {release_id}"
                logger.error(msg)
                result.errors.append(msg)
                result.success = False
                return result
            
            if release.status != "published":
                msg = f"Release not published: {release_id} (status: {release.status})"
                logger.warning(msg)
                # Not an error - idempotent
            
            # Unpublish
            release.status = "unpublished"
            release.unpublished_at = datetime.now(timezone.utc)
            release.updated_at = datetime.now(timezone.utc)
            
            # Count affected units
            units = session.query(QuizTopic).filter(
                QuizTopic.release_id == release_id
            ).count()
            
            result.units_affected = units
            
            session.commit()
            
            logger.info(f"✓ Unpublished release {release_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Unpublish failed: {e}", exc_info=True)
            result = PublishResult(
                success=False,
                release_id=release_id,
                errors=[str(e)]
            )
            return result
        
        finally:
            logger.removeHandler(file_handler)
            file_handler.close()
    
    def list_releases(self, session: Session) -> List[Dict[str, Any]]:
        """List all content releases.
        
        Args:
            session: SQLAlchemy session
            
        Returns:
            List of release dicts with metadata
        """
        releases = session.query(QuizContentRelease).order_by(
            QuizContentRelease.created_at.desc()
        ).all()
        
        result = []
        for r in releases:
            result.append({
                "release_id": r.release_id,
                "status": r.status,
                "units_count": r.units_count,
                "questions_count": r.questions_count,
                "audio_count": r.audio_count,
                "imported_at": r.imported_at.isoformat() if r.imported_at else None,
                "published_at": r.published_at.isoformat() if r.published_at else None,
                "unpublished_at": r.unpublished_at.isoformat() if r.unpublished_at else None,
                "created_at": r.created_at.isoformat(),
            })
        
        return result
