#!/usr/bin/env python3
"""games_hispanistica CLI.

Command-line interface for production operations.

Commands:
    import-content    Import quiz content from JSON files
    publish-release   Publish a previously imported release
    unpublish-release Unpublish a release (rollback)
    list-releases     List available content releases

Usage:
    python manage.py import-content --help
    python manage.py publish-release --help
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
    """Import quiz content from JSON files."""
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
                click.echo(f"\nWarnings: {len(result.warnings)}")
                for warning in result.warnings:
                    click.echo(f"  - {warning}")

            if dry_run:
                click.echo("\n(Dry-run: no data written)")

            sys.exit(0)

        click.echo("[FAIL] Import failed", err=True)
        for error in result.errors:
            click.echo(f"  - {error}", err=True)

        error_text = " ".join(result.errors)
        if "not found" in error_text.lower() or "directory" in error_text.lower():
            sys.exit(3)
        if "validation" in error_text.lower() or "invalid" in error_text.lower():
            sys.exit(2)
        sys.exit(4)

    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("Import failed with exception")
        sys.exit(4)


@cli.command('publish-release')
@click.option('--release', required=True, help='Release ID to publish')
def publish_release(release):
    """Publish a previously imported release."""
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
    """Unpublish a release (rollback)."""
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
    """List all content releases."""
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

        click.echo(f"{'Release ID':<20} {'Status':<12} {'Units':<8} {'Questions':<10} {'Imported At':<20}")
        click.echo("-" * 80)

        for release_row in releases:
            status_display = release_row['status']
            if release_row['status'] == 'published':
                status_display = click.style(status_display, fg='green', bold=True)
            elif release_row['status'] == 'draft':
                status_display = click.style(status_display, fg='yellow')

            imported_at = release_row['imported_at'][:19] if release_row['imported_at'] else 'not imported'
            click.echo(
                f"{release_row['release_id']:<20} "
                f"{status_display:<12} "
                f"{release_row['units_count'] or 0:<8} "
                f"{release_row['questions_count'] or 0:<10} "
                f"{imported_at:<20}"
            )

    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("List failed with exception")
        sys.exit(4)


@cli.command("ensure-dev-admin")
def ensure_dev_admin():
    """Ensure DEV admin user exists (admin/change-me by default). DEV only."""
    env = os.environ.get("ENV") or os.environ.get("FLASK_ENV")
    if env != "dev":
        raise RuntimeError("Refusing to create dev admin outside ENV=dev")

    from src.app import create_app
    from src.app.auth import services

    target_username = (os.environ.get("START_ADMIN_USERNAME") or "admin").strip().lower()
    target_password = os.environ.get("START_ADMIN_PASSWORD") or "change-me"
    target_email = (os.environ.get("START_ADMIN_EMAIL") or f"{target_username}@dev.local").strip().lower()
    legacy_username = "admin_dev"

    app = create_app(env)
    with app.app_context():
        user = services.find_user_by_username_or_email(target_username)
        legacy_user = services.find_user_by_username_or_email(legacy_username)

        if not user and legacy_user:
            services.update_user_profile(str(legacy_user.id), username=target_username)
            user = services.find_user_by_username_or_email(target_username)

        if not user:
            user, _ = services.create_user(
                username=target_username,
                email=target_email,
                role="admin",
                generate_reset_token=False,
            )

        services.update_user_password(str(user.id), services.hash_password(target_password))
        services.admin_update_user(
            str(user.id),
            email=target_email,
            role="admin",
            is_active=True,
        )

        legacy_user = services.find_user_by_username_or_email(legacy_username)
        if legacy_user and str(legacy_user.id) != str(user.id):
            services.admin_update_user(str(legacy_user.id), is_active=False)

        click.echo(f"[OK] ensured dev admin: {target_username}")
    sys.exit(0)


@cli.command('quiz-db-report')
@click.option('--json', 'as_json', is_flag=True, help='Output JSON')
@click.option('--minimal', is_flag=True, help='Only output core counts (topics/questions)')
def quiz_db_report(as_json, minimal):
    """Read-only DB report for quiz tables and releases."""
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
                    "release_id": release_row.release_id,
                    "status": release_row.status,
                    "published_at": release_row.published_at.isoformat() if release_row.published_at else None,
                    "imported_at": release_row.imported_at.isoformat() if release_row.imported_at else None,
                    "units_count": release_row.units_count,
                    "questions_count": release_row.questions_count,
                }
                for release_row in published
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
            for release_row in published_releases:
                click.echo(
                    f"  - {release_row['release_id']} | published_at={release_row['published_at']} | imported_at={release_row['imported_at']} | units={release_row['units_count']} | questions={release_row['questions_count']}"
                )

        click.echo(f"\nCurrent release id: {current_release_id}")
        sys.exit(0)
    
    except Exception as e:
        click.echo(f"[FAIL] Fatal error: {e}", err=True)
        logger.exception("quiz-db-report failed with exception")
        sys.exit(4)


if __name__ == '__main__':
    cli()
