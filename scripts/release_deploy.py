#!/usr/bin/env python3
"""
Quiz Content Release Deployment CLI

One-command deployment of quiz content releases to production:
- Validates local release
- Rsyncs to remote server
- Switches 'current' symlink
- Runs quiz seed import
- Performs health check
- Rollback on failure

Usage:
    python scripts/release_deploy.py \\
        --release 2026-01-06_1430 \\
        --ssh root@marele.online.uni-marburg.de \\
        --media-root /srv/webapps/games_hispanistica/media \\
        --container games-webapp \\
        --prune soft

Exit Codes:
    0  - Success
    10 - Validation failed
    20 - Rsync failed
    30 - Current symlink switch failed
    40 - Import/seed failed (after rollback)
    50 - Health check failed (after rollback)
"""

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import the service module directly
# This avoids importing the Flask app which has many dependencies
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import the service module directly (not via app package)
import importlib.util
service_path = Path(__file__).parent.parent / "src" / "app" / "services" / "content_release.py"
spec = importlib.util.spec_from_file_location("content_release", service_path)
content_release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(content_release)

# Import functions from the loaded module
validate_release_dir = content_release.validate_release_dir
compute_release_name = content_release.compute_release_name
rsync_release_to_server = content_release.rsync_release_to_server
get_remote_current_target = content_release.get_remote_current_target
set_remote_current = content_release.set_remote_current
run_remote_seed = content_release.run_remote_seed
remote_healthcheck = content_release.remote_healthcheck
rollback_remote_current = content_release.rollback_remote_current
create_remote_releases_dir = content_release.create_remote_releases_dir


# Configure logging with UTF-8 encoding for Windows compatibility
import sys
import io

# Ensure stdout uses UTF-8 encoding on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("logs/release_deploy.log", mode="a", encoding="utf-8")
    ]
)

logger = logging.getLogger(__name__)


# Exit codes
EXIT_SUCCESS = 0
EXIT_VALIDATION_FAILED = 10
EXIT_RSYNC_FAILED = 20
EXIT_SWITCH_FAILED = 30
EXIT_IMPORT_FAILED = 40
EXIT_HEALTH_FAILED = 50


def main():
    parser = argparse.ArgumentParser(
        description="Deploy quiz content release to production server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Deploy release with soft pruning
  python scripts/release_deploy.py \\
      --release 2026-01-06_1430 \\
      --ssh root@marele.online.uni-marburg.de \\
      --media-root /srv/webapps/games_hispanistica/media \\
      --container games-webapp \\
      --prune soft

  # Dry-run to test without changes
  python scripts/release_deploy.py \\
      --release 2026-01-06_1430 \\
      --ssh root@marele.online.uni-marburg.de \\
      --dry-run

  # Deploy without import (only rsync + switch)
  python scripts/release_deploy.py \\
      --release 2026-01-06_1430 \\
      --ssh root@marele.online.uni-marburg.de \\
      --no-import
        """
    )
    
    # Required arguments
    parser.add_argument(
        "--release",
        required=True,
        help="Release name (directory name under content/quiz_releases/)"
    )
    
    parser.add_argument(
        "--ssh",
        required=True,
        help="SSH host (user@hostname)"
    )
    
    # Optional arguments with defaults
    parser.add_argument(
        "--media-root",
        default="/srv/webapps/games_hispanistica/media",
        help="Remote media root path (default: /srv/webapps/games_hispanistica/media)"
    )
    
    parser.add_argument(
        "--container",
        default="games-webapp",
        help="Docker container name (default: games-webapp)"
    )
    
    parser.add_argument(
        "--topics-dir-in-container",
        default="/app/media/current/topics",
        help="Topics directory path inside container (default: /app/media/current/topics)"
    )
    
    parser.add_argument(
        "--prune",
        choices=["soft", "hard"],
        default="soft",
        help="Pruning mode: soft (deactivate) or hard (delete) (default: soft)"
    )
    
    parser.add_argument(
        "--health-url",
        default="http://localhost:7000/health",
        help="Health check URL (default: http://localhost:7000/health)"
    )
    
    # Flags
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform dry-run (rsync only, no actual changes)"
    )
    
    parser.add_argument(
        "--no-import",
        action="store_true",
        help="Skip import/seed step"
    )
    
    parser.add_argument(
        "--no-switch",
        action="store_true",
        help="Skip current symlink switch"
    )
    
    parser.add_argument(
        "--no-health",
        action="store_true",
        help="Skip health check"
    )
    
    parser.add_argument(
        "--i-know-what-im-doing",
        action="store_true",
        help="Required flag for hard pruning (destructive operation)"
    )
    
    args = parser.parse_args()
    
    # Validate hard prune safety flag
    if args.prune == "hard" and not args.i_know_what_im_doing:
        logger.error("Hard pruning requires --i-know-what-im-doing flag")
        logger.error("Hard pruning PERMANENTLY DELETES topics and questions from database")
        sys.exit(EXIT_VALIDATION_FAILED)
    
    # Build paths
    local_release_dir = Path("content/quiz_releases") / args.release
    remote_release_dir = f"{args.media_root}/releases/{args.release}"
    
    logger.info("=" * 80)
    logger.info("QUIZ CONTENT RELEASE DEPLOYMENT")
    logger.info("=" * 80)
    logger.info(f"Release:         {args.release}")
    logger.info(f"Local path:      {local_release_dir}")
    logger.info(f"Remote host:     {args.ssh}")
    logger.info(f"Remote path:     {remote_release_dir}")
    logger.info(f"Container:       {args.container}")
    logger.info(f"Prune mode:      {args.prune}")
    logger.info(f"Dry run:         {args.dry_run}")
    logger.info("=" * 80)
    
    # Step 1: Validate local release
    logger.info("STEP 1: Validating local release...")
    
    validation = validate_release_dir(local_release_dir)
    
    if not validation["valid"]:
        logger.error("❌ Validation failed:")
        for error in validation["errors"]:
            logger.error(f"  - {error}")
        sys.exit(EXIT_VALIDATION_FAILED)
    
    logger.info(f"✅ Validation passed: {len(validation['topics'])} topics found")
    for topic in validation["topics"]:
        logger.info(f"  - {topic['file']} (slug: {topic['slug']})")
    
    if args.dry_run:
        logger.info("🔍 DRY RUN MODE - No actual changes will be made")
    
    # Step 2: Get current release (for rollback)
    logger.info("\nSTEP 2: Checking current release...")
    
    previous_release = get_remote_current_target(args.ssh, args.media_root)
    
    if previous_release:
        logger.info(f"📦 Current release: {previous_release}")
    else:
        logger.info("📦 No current release (first deployment)")
    
    # Step 3: Ensure remote releases/ directory exists
    logger.info("\nSTEP 3: Ensuring remote releases directory...")
    
    if not args.dry_run:
        try:
            create_remote_releases_dir(args.ssh, args.media_root)
            logger.info("✅ Remote releases directory ready")
        except Exception as e:
            logger.error(f"❌ Failed to create releases directory: {e}")
            sys.exit(EXIT_RSYNC_FAILED)
    else:
        logger.info("🔍 Skipped (dry-run)")
    
    # Step 4: Rsync release to server
    logger.info("\nSTEP 4: Syncing release to server...")
    
    rsync_result = rsync_release_to_server(
        local_release_dir=local_release_dir,
        ssh_host=args.ssh,
        remote_release_dir=remote_release_dir,
        dry_run=args.dry_run
    )
    
    if not rsync_result["success"]:
        logger.error("❌ Rsync failed:")
        logger.error(rsync_result["stderr"])
        sys.exit(EXIT_RSYNC_FAILED)
    
    logger.info("✅ Rsync completed")
    
    if args.dry_run:
        logger.info("\n" + "=" * 80)
        logger.info("DRY RUN COMPLETED - No actual changes made")
        logger.info("=" * 80)
        sys.exit(EXIT_SUCCESS)
    
    # Step 5: Switch current symlink
    if not args.no_switch:
        logger.info("\nSTEP 5: Switching current symlink...")
        
        try:
            set_remote_current(args.ssh, args.media_root, args.release)
            logger.info(f"✅ Current -> {args.release}")
        except Exception as e:
            logger.error(f"❌ Failed to switch current symlink: {e}")
            sys.exit(EXIT_SWITCH_FAILED)
    else:
        logger.info("\nSTEP 5: Skipped switching current symlink (--no-switch)")
    
    # Step 6: Run import/seed
    if not args.no_import:
        logger.info("\nSTEP 6: Running quiz seed import...")
        
        seed_result = run_remote_seed(
            ssh_host=args.ssh,
            container=args.container,
            topics_dir_in_container=args.topics_dir_in_container,
            prune_mode=args.prune
        )
        
        if not seed_result["success"]:
            logger.error("❌ Import failed:")
            logger.error(seed_result["stderr"])
            logger.error("\n📦 Initiating rollback...")
            
            if previous_release:
                try:
                    rollback_remote_current(args.ssh, args.media_root, previous_release)
                    logger.info(f"✅ Rolled back to {previous_release}")
                except Exception as e:
                    logger.error(f"❌ Rollback failed: {e}")
            else:
                logger.warning("⚠️  No previous release to rollback to")
            
            sys.exit(EXIT_IMPORT_FAILED)
        
        logger.info("✅ Import completed")
        logger.info(seed_result["stdout"])
    else:
        logger.info("\nSTEP 6: Skipped import/seed (--no-import)")
    
    # Step 7: Health check
    if not args.no_health:
        logger.info("\nSTEP 7: Performing health check...")
        
        health = remote_healthcheck(args.ssh, args.health_url)
        
        if not health["healthy"]:
            logger.error("❌ Health check failed:")
            logger.error(f"  Status: {health['status_code']}")
            logger.error(f"  Error: {health['error']}")
            logger.error("\n📦 Initiating rollback...")
            
            if previous_release:
                try:
                    rollback_remote_current(args.ssh, args.media_root, previous_release)
                    logger.info(f"✅ Rolled back to {previous_release}")
                    
                    # Re-run seed for previous release
                    logger.info("🔄 Re-seeding previous release...")
                    run_remote_seed(
                        ssh_host=args.ssh,
                        container=args.container,
                        topics_dir_in_container=args.topics_dir_in_container,
                        prune_mode="soft"
                    )
                    
                except Exception as e:
                    logger.error(f"❌ Rollback failed: {e}")
            else:
                logger.warning("⚠️  No previous release to rollback to")
            
            sys.exit(EXIT_HEALTH_FAILED)
        
        logger.info(f"✅ Health check passed (status: {health['status_code']})")
    else:
        logger.info("\nSTEP 7: Skipped health check (--no-health)")
    
    # Success!
    logger.info("\n" + "=" * 80)
    logger.info("🎉 DEPLOYMENT SUCCESSFUL")
    logger.info("=" * 80)
    logger.info(f"Release:  {args.release}")
    logger.info(f"Previous: {previous_release or 'none'}")
    logger.info(f"Topics:   {len(validation['topics'])}")
    logger.info("=" * 80)
    
    sys.exit(EXIT_SUCCESS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.error("\n❌ Deployment interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.exception(f"❌ Unexpected error: {e}")
        sys.exit(1)
