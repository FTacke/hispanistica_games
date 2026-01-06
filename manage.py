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
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        service = QuizImportService()
        
        with get_session() as session:
            result = service.import_release(
                session=session,
                units_path=units_path,
                audio_path=audio_path,
                release_id=release,
                dry_run=dry_run
            )
        
        if result.success:
            click.echo(f"✓ Import successful")
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
            click.echo(f"✗ Import failed", err=True)
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
        click.echo(f"✗ Fatal error: {e}", err=True)
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
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        service = QuizImportService()
        
        with get_session() as session:
            result = service.publish_release(session=session, release_id=release)
        
        if result.success:
            click.echo(f"✓ Release '{release}' published")
            click.echo(f"  Units affected: {result.units_affected}")
            sys.exit(0)
        else:
            click.echo(f"✗ Publish failed", err=True)
            for error in result.errors:
                click.echo(f"  - {error}", err=True)
            sys.exit(4)
    
    except Exception as e:
        click.echo(f"✗ Fatal error: {e}", err=True)
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
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        service = QuizImportService()
        
        with get_session() as session:
            result = service.unpublish_release(session=session, release_id=release)
        
        if result.success:
            click.echo(f"✓ Release '{release}' unpublished")
            click.echo(f"  Units affected: {result.units_affected}")
            sys.exit(0)
        else:
            click.echo(f"✗ Unpublish failed", err=True)
            for error in result.errors:
                click.echo(f"  - {error}", err=True)
            sys.exit(4)
    
    except Exception as e:
        click.echo(f"✗ Fatal error: {e}", err=True)
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
    from src.app.extensions.sqlalchemy_ext import get_session
    
    try:
        service = QuizImportService()
        
        with get_session() as session:
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
        
        sys.exit(0)
    
    except Exception as e:
        click.echo(f"✗ Fatal error: {e}", err=True)
        logger.exception("List failed with exception")
        sys.exit(4)


if __name__ == '__main__':
    cli()
