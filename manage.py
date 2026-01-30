#!/usr/bin/env python3
"""
games_hispanistica CLI

Command-line interface for production operations.

Commands:
  import-content    Import quiz content from JSON files
  publish-release   Publish a previously imported release
  unpublish-release Unpublish a release (rollback)
  list-releases     List available content releases

Usage:
  python manage.py import-content --help
  python manage.py publish-release --help
  
Production Example:
  # After rsync upload and symlink activation
  python manage.py import-content \\
    --units-path media/current/units \\
    --audio-path media/current/audio \\
    --release 2026-01-06_1430
  
  python manage.py publish-release --release 2026-01-06_1430

See also:
  games_hispanistica_production.md - Full production documentation
"""

import sys
import os
import uuid
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

import click
import logging

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


@click.group()
def cli():
    """games_hispanistica production CLI"""
    pass


def _init_cli_app() -> None:
    """Initialize app config/DB for CLI commands."""
    from src.app import create_app
    from src.app.extensions.sqlalchemy_ext import get_quiz_engine
    env_name = os.environ.get("ENV") or os.environ.get("FLASK_ENV")
    create_app(env_name)
    if get_quiz_engine() is None:
        raise RuntimeError("Quiz DB not initialized. Set QUIZ_DB_* or QUIZ_DATABASE_URL.")
    if get_quiz_engine().dialect.name == "sqlite":
        raise RuntimeError("Quiz DB must be PostgreSQL (sqlite not supported).")


@cli.command('import-content')
@click.option('--units-path', required=True, help='Path to JSON units directory')
@click.option('--audio-path', required=True, help='Path to audio files directory')
@click.option('--release', required=True, help='Release ID (e.g., 2026-01-06_1430)')
@click.option('--dry-run', is_flag=True, help='Validate without writing to database')
def import_content(units_path, audio_path, release, dry_run):
    """Import quiz content from JSON files
    
    This command imports quiz units and audio files from a release directory.
    Content is imported as 'draft' status (not published).
    
    Example:
        python manage.py import-content \\
            --units-path media/current/units \\
            --audio-path media/current/audio \\
            --release 2026-01-06_1430
    
    Exit codes:
        0 = success
        2 = validation error
        3 = filesystem error
        4 = database error
    """
    from game_modules.quiz.import_service import QuizImportService
    from src.app.extensions.sqlalchemy_ext import get_quiz_session
    
    try:
        _init_cli_app()
        request_id = os.getenv("REQUEST_ID") or f"cli-{uuid.uuid4().hex[:12]}"
        click.echo(f"Request ID: {request_id}")
        service = QuizImportService()
        
        with get_quiz_session() as session:
            result = service.import_release(
                session=session,
                units_path=units_path,
                audio_path=audio_path,
                release_id=release,
                dry_run=dry_run,
                request_id=request_id,
            )
        
        if result.success:
            click.echo("[OK] Import successful")
            click.echo(f"  Units: {result.units_imported}")
            click.echo(f"  Questions: {result.questions_imported}")
            click.echo(f"  Audio files: {result.audio_files_processed}")
            
            if result.warnings:
                click.echo(f"\n⚠️  Warnings: {len(result.warnings)}")
                for warning in result.warnings:
                    click.echo(f"  - {warning}")
            
            if dry_run:
                click.echo("\n(Dry-run: no data written)")
            
            sys.exit(0)
        else:
            click.echo("[FAIL] Import failed", err=True)
            for error in result.errors:
                click.echo(f"  - {error}", err=True)
            
            # Determine exit code from error types
            error_text = " ".join(result.errors)
            if "not found" in error_text.lower() or "directory" in error_text.lower():
                sys.exit(3)  # Filesystem error
            elif "validation" in error_text.lower() or "invalid" in error_text.lower():
                sys.exit(2)  # Validation error
            else:
                sys.exit(4)  # Database/other error
    
    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("Import failed with exception")
        sys.exit(4)


@cli.command('publish-release')
@click.option('--release', required=True, help='Release ID to publish')
def publish_release(release):
    """Publish a previously imported release
    
    Sets status='published' and published_at=NOW() for all units in release.
    Makes content visible to end users.
    
    Only one release can be published at a time.
    Publishing a new release automatically unpublishes the previous one.
    
    Example:
        python manage.py publish-release --release 2026-01-06_1430
    """
    from game_modules.quiz.import_service import QuizImportService
    from src.app.extensions.sqlalchemy_ext import get_quiz_session
    
    try:
        _init_cli_app()
        request_id = os.getenv("REQUEST_ID") or f"cli-{uuid.uuid4().hex[:12]}"
        click.echo(f"Request ID: {request_id}")
        service = QuizImportService()
        
        with get_quiz_session() as session:
            result = service.publish_release(
                session=session,
                release_id=release,
                request_id=request_id,
            )
        
        if result.success:
            click.echo(f"[OK] Release '{release}' published")
            click.echo(f"  Units affected: {result.units_affected}")
            sys.exit(0)
        else:
            click.echo("[FAIL] Publish failed", err=True)
            for error in result.errors:
                click.echo(f"  - {error}", err=True)
            sys.exit(4)
    
    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("Publish failed with exception")
        sys.exit(4)


@cli.command('unpublish-release')
@click.option('--release', required=True, help='Release ID to unpublish')
def unpublish_release(release):
    """Unpublish a release (rollback)
    
    Sets status='unpublished' and sets unpublished_at for the release.
    Makes content invisible to end users.
    
    Example:
        python manage.py unpublish-release --release 2026-01-06_1430
    """
    from game_modules.quiz.import_service import QuizImportService
    from src.app.extensions.sqlalchemy_ext import get_quiz_session
    
    try:
        _init_cli_app()
        request_id = os.getenv("REQUEST_ID") or f"cli-{uuid.uuid4().hex[:12]}"
        click.echo(f"Request ID: {request_id}")
        service = QuizImportService()
        
        with get_quiz_session() as session:
            result = service.unpublish_release(
                session=session,
                release_id=release,
                request_id=request_id,
            )
        
        if result.success:
            click.echo(f"[OK] Release '{release}' unpublished")
            click.echo(f"  Units affected: {result.units_affected}")
            sys.exit(0)
        else:
            click.echo("[FAIL] Unpublish failed", err=True)
            for error in result.errors:
                click.echo(f"  - {error}", err=True)
            sys.exit(4)
    
    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("Unpublish failed with exception")
        sys.exit(4)


@cli.command('list-releases')
def list_releases():
    """List all content releases
    
    Shows release ID, status, counts, and timestamps.
    
    Example:
        python manage.py list-releases
    """
    from game_modules.quiz.import_service import QuizImportService
    from src.app.extensions.sqlalchemy_ext import get_quiz_session
    
    try:
        _init_cli_app()
        service = QuizImportService()
        
        with get_quiz_session() as session:
            releases = service.list_releases(session=session)
        
        if not releases:
            click.echo("No releases found")
            sys.exit(0)
        
        # Print header
        click.echo(f"{'Release ID':<20} {'Status':<12} {'Units':<8} {'Questions':<10} {'Imported At':<20}")
        click.echo("-" * 80)
        
        # Print releases
        for r in releases:
            status_display = r['status']
            if r['status'] == 'published':
                status_display = click.style(status_display, fg='green', bold=True)
            elif r['status'] == 'draft':
                status_display = click.style(status_display, fg='yellow')
            
            imported_at = r['imported_at'][:19] if r['imported_at'] else "not imported"
            
            click.echo(
                f"{r['release_id']:<20} "
                f"{status_display:<12} "
                f"{r['units_count'] or 0:<8} "
                f"{r['questions_count'] or 0:<10} "
                f"{imported_at:<20}"
            )

    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("List failed with exception")
        sys.exit(4)


@cli.command("ensure-dev-admin")
def ensure_dev_admin():
    """Ensure DEV admin user exists (admin_dev/0000). DEV only."""
    env = os.environ.get("ENV") or os.environ.get("FLASK_ENV")
    if env != "dev":
        raise RuntimeError("Refusing to create dev admin outside ENV=dev")

    from src.app import create_app
    from src.app.auth import services

    app = create_app(env)
    with app.app_context():
        user = services.find_user_by_username_or_email("admin_dev")
        if not user:
            user, _ = services.create_user(
                username="admin_dev",
                email="admin_dev@dev.local",
                role="admin",
                generate_reset_token=False,
            )

        services.update_user_password(str(user.id), services.hash_password("0000"))
        services.admin_update_user(str(user.id), role="admin", is_active=True)
        click.echo("[OK] ensured dev admin: admin_dev")
    sys.exit(0)


@cli.command('quiz-db-report')
@click.option('--json', 'as_json', is_flag=True, help='Output JSON')
@click.option('--minimal', is_flag=True, help='Only output core counts (topics/questions/releases)')
def quiz_db_report(as_json, minimal):
    """Read-only DB report for quiz tables and releases.
    
    Outputs counts for core tables and published/current release metadata.
    
    Example:
        python manage.py quiz-db-report
        python manage.py quiz-db-report --json
    """
    import json as json_lib
    from game_modules.quiz.models import QuizTopic, QuizQuestion, QuizRun, QuizScore
    from game_modules.quiz.release_model import QuizContentRelease
    from src.app.extensions.sqlalchemy_ext import get_quiz_engine, get_quiz_session
    
    try:
        _init_cli_app()
        engine = get_quiz_engine()
        dialect = engine.dialect.name if engine is not None else "unknown"
        if dialect == "sqlite":
            click.echo("[FAIL] Wrong DB: quiz module requires PostgreSQL (got sqlite). Set QUIZ_DB_* or QUIZ_DATABASE_URL.", err=True)
            sys.exit(2)

        with get_quiz_session() as session:
            counts = {
                "quiz_topics": session.query(QuizTopic).count(),
                "quiz_questions": session.query(QuizQuestion).count(),
                "quiz_content_releases": session.query(QuizContentRelease).count(),
            }
            if not minimal:
                counts.update({
                    "quiz_runs": session.query(QuizRun).count(),
                    "quiz_scores": session.query(QuizScore).count(),
                })
            
            published = session.query(QuizContentRelease).filter(
                QuizContentRelease.status == "published"
            ).order_by(QuizContentRelease.published_at.desc()).all()
            
            published_releases = [
                {
                    "release_id": r.release_id,
                    "status": r.status,
                    "published_at": r.published_at.isoformat() if r.published_at else None,
                    "imported_at": r.imported_at.isoformat() if r.imported_at else None,
                    "units_count": r.units_count,
                    "questions_count": r.questions_count,
                }
                for r in published
            ]
            
            current_release_id = published[0].release_id if published else None
            
            report = {
                "db_dialect": dialect,
                "counts": counts,
                "published_releases": published_releases,
                "current_release_id": current_release_id,
            }
        
        if as_json:
            click.echo(json_lib.dumps(report, indent=2, ensure_ascii=False))
            sys.exit(0)
        
        click.echo("Quiz DB Report (read-only)")
        click.echo(f"DB dialect: {dialect}")
        click.echo("=" * 30)
        click.echo("Counts:")
        for key, value in counts.items():
            click.echo(f"  {key}: {value}")
        
        click.echo("\nPublished Releases:")
        if not published_releases:
            click.echo("  (none)")
        else:
            for r in published_releases:
                click.echo(
                    f"  - {r['release_id']} | published_at={r['published_at']} | imported_at={r['imported_at']} | units={r['units_count']} | questions={r['questions_count']}"
                )
        
        click.echo(f"\nCurrent release id: {current_release_id}")
        sys.exit(0)
    
    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("quiz-db-report failed with exception")
        sys.exit(4)


if __name__ == '__main__':
    cli()
