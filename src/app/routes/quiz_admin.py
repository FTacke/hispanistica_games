"""Quiz Admin API routes for content management.

Provides endpoints for:
- Upload quiz units (JSON + media files)
- Manage releases (import, publish, unpublish)
- Manage units (list, bulk update, soft-delete)

All routes require admin role authentication.
"""

from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from flask import Blueprint, Response, current_app, g, jsonify, render_template, request
from flask_jwt_extended import jwt_required

from ..auth import Role
from ..auth.decorators import require_role


blueprint = Blueprint("quiz_admin", __name__, url_prefix="/quiz-admin")


# =============================================================================
# Helper Functions
# =============================================================================

def generate_release_id() -> str:
    """Generate a unique release ID with collision avoidance.
    
    Format: release_YYYYMMDD_HHMMSS_<4-char-suffix>
    Example: release_20260107_1430_a7x2
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    suffix = secrets.token_hex(2)  # 4 hex chars
    return f"release_{timestamp}_{suffix}"


def get_project_root() -> Path:
    """Get the project root directory."""
    # Flask app is in src/app, project root is 2 levels up
    return Path(current_app.root_path).parent.parent


def get_media_releases_path() -> Path:
    """Get the media/releases directory path."""
    return get_project_root() / "media" / "releases"


# =============================================================================
# Page Routes (HTML)
# =============================================================================

@blueprint.get("/")
@jwt_required()
@require_role(Role.ADMIN)
def quiz_content_page() -> str:
    """Render the Quiz Content admin page."""
    return render_template("admin/quiz_content.html")


# =============================================================================
# API Routes - Releases
# =============================================================================

@blueprint.get("/api/releases")
@jwt_required()
@require_role(Role.ADMIN)
def list_releases() -> Response:
    """List all content releases.
    
    Returns:
        200: {"items": [{"release_id": str, "status": str, ...}]}
    """
    from game_modules.quiz.import_service import QuizImportService
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        service = QuizImportService(project_root=get_project_root())
        
        with get_session() as session:
            releases = service.list_releases(session)
        
        return jsonify({"items": releases}), 200
    except Exception as e:
        current_app.logger.error(f"Failed to list releases: {e}")
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@blueprint.get("/api/releases/<release_id>")
@jwt_required()
@require_role(Role.ADMIN)
def get_release(release_id: str) -> Response:
    """Get a single release by ID.
    
    Returns:
        200: {"release_id": str, "status": str, ...}
        404: {"error": "not_found"}
    """
    from game_modules.quiz.release_model import QuizContentRelease
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        with get_session() as session:
            release = session.query(QuizContentRelease).filter(
                QuizContentRelease.release_id == release_id
            ).first()
            
            if not release:
                return jsonify({"error": "not_found", "message": f"Release not found: {release_id}"}), 404
            
            return jsonify({
                "release_id": release.release_id,
                "status": release.status,
                "units_count": release.units_count,
                "questions_count": release.questions_count,
                "audio_count": release.audio_count,
                "imported_at": release.imported_at.isoformat() if release.imported_at else None,
                "published_at": release.published_at.isoformat() if release.published_at else None,
                "unpublished_at": release.unpublished_at.isoformat() if release.unpublished_at else None,
                "created_at": release.created_at.isoformat() if release.created_at else None,
            }), 200
    except Exception as e:
        current_app.logger.error(f"Failed to get release: {e}")
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@blueprint.post("/api/releases/<release_id>/import")
@jwt_required()
@require_role(Role.ADMIN)
def import_release(release_id: str) -> Response:
    """Import a release (creates draft).
    
    Calls the import service directly (not CLI subprocess).
    
    Returns:
        200: {"ok": true, "units_imported": N, "questions_imported": N, ...}
        400: {"ok": false, "errors": [...]}
        404: {"error": "not_found"}
    """
    from game_modules.quiz.import_service import QuizImportService
    from game_modules.quiz.release_model import QuizContentRelease
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        project_root = get_project_root()
        releases_path = get_media_releases_path()
        release_path = releases_path / release_id
        
        # Verify release directory exists
        if not release_path.exists():
            return jsonify({
                "error": "not_found",
                "message": f"Release directory not found: {release_path}"
            }), 404
        
        units_path = str(release_path / "units")
        audio_path = str(release_path / "audio")
        
        service = QuizImportService(project_root=project_root)
        
        with get_session() as session:
            result = service.import_release(
                session=session,
                units_path=units_path,
                audio_path=audio_path,
                release_id=release_id,
                dry_run=False
            )
        
        return jsonify({
            "ok": result.success,
            "release_id": result.release_id,
            "units_imported": result.units_imported,
            "questions_imported": result.questions_imported,
            "audio_files_processed": result.audio_files_processed,
            "errors": result.errors,
            "warnings": result.warnings,
            "dry_run": result.dry_run
        }), 200 if result.success else 400
    except Exception as e:
        current_app.logger.error(f"Import failed: {e}", exc_info=True)
        # Rollback session to prevent cascading errors
        from src.app.extensions.sqlalchemy_ext import get_session
        try:
            with get_session() as session:
                session.rollback()
        except Exception:
            pass  # Best effort rollback
        return jsonify({"ok": False, "error": str(e)}), 500


@blueprint.post("/api/releases/<release_id>/publish")
@jwt_required()
@require_role(Role.ADMIN)
def publish_release(release_id: str) -> Response:
    """Mark a release as published (workflow/history tracking only).
    
    NOTE: This does NOT affect unit visibility in the frontend.
    Unit visibility is controlled solely by the is_active flag on each unit.
    Publish/unpublish are now optional workflow markers for import history.
    
    Only one release can be published at a time.
    
    Returns:
        200: {"ok": true, "units_affected": N}
        400: {"ok": false, "errors": [...]}
    """
    from game_modules.quiz.import_service import QuizImportService
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        service = QuizImportService(project_root=get_project_root())
        
        with get_session() as session:
            result = service.publish_release(session, release_id)
        
        return jsonify({
            "ok": result.success,
            "release_id": result.release_id,
            "units_affected": result.units_affected,
            "errors": result.errors
        }), 200 if result.success else 400
    except Exception as e:
        current_app.logger.error(f"Publish failed: {e}", exc_info=True)
        return jsonify({"ok": False, "error": str(e)}), 500


@blueprint.post("/api/releases/<release_id>/unpublish")
@jwt_required()
@require_role(Role.ADMIN)
def unpublish_release(release_id: str) -> Response:
    """Mark a release as unpublished (workflow/history tracking only).
    
    NOTE: This does NOT affect unit visibility in the frontend.
    Unit visibility is controlled solely by the is_active flag on each unit.
    To hide units, use the unit toggle/delete endpoints instead.
    
    Returns:
        200: {"ok": true, "units_affected": N}
        400: {"ok": false, "errors": [...]}
    """
    from game_modules.quiz.import_service import QuizImportService
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        service = QuizImportService(project_root=get_project_root())
        
        with get_session() as session:
            result = service.unpublish_release(session, release_id)
        
        return jsonify({
            "ok": result.success,
            "release_id": result.release_id,
            "units_affected": result.units_affected,
            "errors": result.errors
        }), 200 if result.success else 400
    except Exception as e:
        current_app.logger.error(f"Unpublish failed: {e}", exc_info=True)
        return jsonify({"ok": False, "error": str(e)}), 500


# =============================================================================
# API Routes - Units
# =============================================================================

@blueprint.get("/api/units")
@jwt_required()
@require_role(Role.ADMIN)
def list_units() -> Response:
    """List all quiz units (topics).
    
    Query params:
        include_inactive: "1" to include inactive units
        search: Search query (matches slug or title)
        release_id: Filter by release_id
    
    Returns:
        200: {"items": [{"slug": str, "title": str, ...}]}
    """
    from game_modules.quiz.models import QuizTopic
    from src.app.extensions.sqlalchemy_ext import get_session
    from sqlalchemy import or_, func
    
    include_inactive = request.args.get("include_inactive") == "1"
    search_query = request.args.get("search", "").strip() or None
    release_filter = request.args.get("release_id", "").strip() or None
    
    try:
        with get_session() as session:
            query = session.query(QuizTopic)
            
            if not include_inactive:
                query = query.filter(QuizTopic.is_active == True)
            
            if search_query:
                search_pattern = f"%{search_query.lower()}%"
                query = query.filter(
                    or_(
                        func.lower(QuizTopic.id).like(search_pattern),
                        func.lower(QuizTopic.title_key).like(search_pattern)
                    )
                )
            
            if release_filter:
                query = query.filter(QuizTopic.release_id == release_filter)
            
            units = query.order_by(QuizTopic.order_index, QuizTopic.id).all()
            
            items = [
                {
                    "slug": u.id,
                    "title": u.title_key,
                    "description": u.description_key,
                    "is_active": bool(u.is_active),
                    "order_index": u.order_index,
                    "release_id": u.release_id,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                    "questions_count": len(u.questions) if u.questions else 0,
                }
                for u in units
            ]
        
        return jsonify({"items": items}), 200
    except Exception as e:
        current_app.logger.error(f"Failed to list units: {e}")
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@blueprint.get("/api/units/<slug>")
@jwt_required()
@require_role(Role.ADMIN)
def get_unit(slug: str) -> Response:
    """Get a single unit by slug.
    
    Returns:
        200: {"slug": str, "title": str, ...}
        404: {"error": "not_found"}
    """
    from game_modules.quiz.models import QuizTopic
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        with get_session() as session:
            unit = session.query(QuizTopic).filter(QuizTopic.id == slug).first()
            
            if not unit:
                return jsonify({"error": "not_found", "message": f"Unit not found: {slug}"}), 404
            
            return jsonify({
                "slug": unit.id,
                "title": unit.title_key,
                "description": unit.description_key,
                "is_active": bool(unit.is_active),
                "order_index": unit.order_index,
                "release_id": unit.release_id,
                "created_at": unit.created_at.isoformat() if unit.created_at else None,
                "questions_count": len(unit.questions) if unit.questions else 0,
            }), 200
    except Exception as e:
        current_app.logger.error(f"Failed to get unit: {e}")
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@blueprint.patch("/api/units")
@jwt_required()
@require_role(Role.ADMIN)
def bulk_update_units() -> Response:
    """Bulk update unit metadata (is_active, order_index).
    
    Body:
        {"updates": [{"slug": "x", "is_active": false}, {"slug": "y", "order_index": 5}]}
    
    Returns:
        200: {"ok": true, "updated_count": N}
        400: {"error": "invalid_request"}
    """
    from game_modules.quiz.models import QuizTopic
    from src.app.extensions.sqlalchemy_ext import get_session
    
    data = request.get_json() or {}
    updates = data.get("updates", [])
    
    if not isinstance(updates, list) or not updates:
        return jsonify({
            "error": "invalid_request",
            "message": "Body must contain 'updates' array with at least one item"
        }), 400
    
    try:
        updated_count = 0
        
        with get_session() as session:
            for update in updates:
                slug = update.get("slug")
                if not slug:
                    continue
                
                unit = session.query(QuizTopic).filter(QuizTopic.id == slug).first()
                if not unit:
                    continue
                
                # Only allow updating these fields
                if "is_active" in update:
                    unit.is_active = bool(update["is_active"])
                    updated_count += 1
                
                if "order_index" in update:
                    try:
                        unit.order_index = int(update["order_index"])
                        updated_count += 1
                    except (ValueError, TypeError):
                        pass
            
            session.commit()
        
        return jsonify({"ok": True, "updated_count": updated_count}), 200
    except Exception as e:
        current_app.logger.error(f"Bulk update failed: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@blueprint.delete("/api/units/<slug>")
@jwt_required()
@require_role(Role.ADMIN)
def delete_unit(slug: str) -> Response:
    """Soft-delete a unit (sets is_active=false).
    
    Returns:
        200: {"ok": true}
        404: {"error": "not_found"}
    """
    from game_modules.quiz.models import QuizTopic
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        with get_session() as session:
            unit = session.query(QuizTopic).filter(QuizTopic.id == slug).first()
            
            if not unit:
                return jsonify({"error": "not_found", "message": f"Unit not found: {slug}"}), 404
            
            unit.is_active = False
            session.commit()
        
        return jsonify({"ok": True}), 200
    except Exception as e:
        current_app.logger.error(f"Delete failed: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


# =============================================================================
# API Routes - Upload
# =============================================================================

@blueprint.post("/api/upload-unit")
@jwt_required()
@require_role(Role.ADMIN)
def upload_unit() -> Response:
    """Upload a quiz unit (1 JSON + 0-n media files).
    
    Creates a new release directory and stores the files.
    
    Request: multipart/form-data
        - unit_json: File (required)
        - media_files[]: Files (optional, multiple)
    
    Returns:
        200: {"ok": true, "release_id": str, "slug": str, ...}
        400: {"error": "validation_error", "message": str}
    """
    import re
    from werkzeug.utils import secure_filename
    
    # Check for JSON file
    if "unit_json" not in request.files:
        return jsonify({
            "error": "missing_file",
            "message": "JSON file is required (unit_json)"
        }), 400
    
    json_file = request.files["unit_json"]
    if not json_file.filename:
        return jsonify({
            "error": "missing_file",
            "message": "JSON file is required"
        }), 400
    
    # Parse and validate JSON
    try:
        json_content = json_file.read().decode("utf-8")
        unit_data = json.loads(json_content)
    except json.JSONDecodeError as e:
        return jsonify({
            "error": "invalid_json",
            "message": f"Invalid JSON: {e}"
        }), 400
    except UnicodeDecodeError:
        return jsonify({
            "error": "invalid_encoding",
            "message": "JSON file must be UTF-8 encoded"
        }), 400
    
    # Validate slug
    slug = unit_data.get("slug", "").strip()
    if not slug:
        return jsonify({
            "error": "missing_slug",
            "message": "Missing required field: slug"
        }), 400
    
    if not re.match(r"^[a-z0-9_]+$", slug):
        return jsonify({
            "error": "invalid_slug",
            "message": f"Invalid slug format: '{slug}'. Must be lowercase alphanumeric + underscore."
        }), 400
    
    # Extract audio references from JSON
    detected_refs = []
    questions = unit_data.get("questions", [])
    for q in questions:
        # Question-level media
        for media in q.get("media", []):
            if media.get("type") == "audio" and media.get("seed_src"):
                detected_refs.append(media["seed_src"])
        # Answer-level media
        for answer in q.get("answers", []):
            for media in answer.get("media", []):
                if media.get("type") == "audio" and media.get("seed_src"):
                    detected_refs.append(media["seed_src"])
    
    # Generate release ID
    release_id = generate_release_id()
    
    # Create release directory
    releases_path = get_media_releases_path()
    release_path = releases_path / release_id
    units_path = release_path / "units"
    audio_path = release_path / "audio"
    
    try:
        units_path.mkdir(parents=True, exist_ok=True)
        audio_path.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        return jsonify({
            "error": "filesystem_error",
            "message": f"Failed to create release directory: {e}"
        }), 500
    
    # Save JSON file
    json_filename = f"{slug}.json"
    json_filepath = units_path / json_filename
    try:
        with open(json_filepath, "w", encoding="utf-8") as f:
            json.dump(unit_data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        return jsonify({
            "error": "filesystem_error",
            "message": f"Failed to save JSON file: {e}"
        }), 500
    
    # Save media files
    uploaded_files = []
    media_files = request.files.getlist("media_files[]")
    
    for media_file in media_files:
        if media_file.filename:
            filename = secure_filename(media_file.filename)
            media_filepath = audio_path / filename
            try:
                media_file.save(str(media_filepath))
                uploaded_files.append(filename)
            except OSError as e:
                current_app.logger.warning(f"Failed to save media file {filename}: {e}")
    
    # Determine missing files
    missing_files = []
    for ref in detected_refs:
        # Extract filename from path
        ref_filename = Path(ref).name
        if ref_filename not in uploaded_files:
            missing_files.append(ref_filename)
    
    # Create release record in DB
    from game_modules.quiz.release_model import QuizContentRelease
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        with get_session() as session:
            release = QuizContentRelease(
                release_id=release_id,
                status="draft",
                units_path=str(units_path),
                audio_path=str(audio_path),
                units_count=1,
                questions_count=len(questions),
                audio_count=len(uploaded_files),
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            session.add(release)
            session.commit()
    except Exception as e:
        current_app.logger.error(f"Failed to create release record: {e}")
        return jsonify({
            "error": "database_error",
            "message": f"Failed to create release record: {e}"
        }), 500
    
    return jsonify({
        "ok": True,
        "release_id": release_id,
        "slug": slug,
        "title": unit_data.get("title", slug),
        "questions_count": len(questions),
        "detected_refs": detected_refs,
        "uploaded_files": uploaded_files,
        "missing_files": missing_files
    }), 200


# =============================================================================
# API Routes - Logs
# =============================================================================

@blueprint.get("/api/logs/<release_id>")
@jwt_required()
@require_role(Role.ADMIN)
def get_release_logs(release_id: str) -> Response:
    """Get import logs for a release.
    
    Returns the latest log file content for the given release.
    
    Returns:
        200: {"logs": str, "filename": str}
        404: {"error": "not_found"}
    """
    import glob
    
    logs_dir = get_project_root() / "data" / "import_logs"
    
    if not logs_dir.exists():
        return jsonify({"logs": "", "filename": None}), 200
    
    # Find log files for this release
    pattern = f"*_{release_id}.log"
    log_files = list(logs_dir.glob(pattern))
    
    if not log_files:
        return jsonify({"logs": "", "filename": None}), 200
    
    # Get the most recent log file
    log_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    latest_log = log_files[0]
    
    try:
        # Read last 200 lines max
        with open(latest_log, "r", encoding="utf-8") as f:
            lines = f.readlines()
            tail_lines = lines[-200:] if len(lines) > 200 else lines
            log_content = "".join(tail_lines)
        
        return jsonify({
            "logs": log_content,
            "filename": latest_log.name
        }), 200
    except Exception as e:
        current_app.logger.error(f"Failed to read log file: {e}")
        return jsonify({"error": "read_error", "message": str(e)}), 500
