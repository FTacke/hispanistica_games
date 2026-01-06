#!/usr/bin/env python3
"""
Quiz Seed CLI

Orchestrates the complete quiz content pipeline:
1. Normalizes JSON units (IDs + statistics)
2. Seeds database (idempotent upsert)
3. Prunes removed topics (soft: is_active=false, hard: DELETE)

Usage:
  python scripts/quiz_seed.py                     # Normalize + seed + soft prune
  python scripts/quiz_seed.py --prune-soft        # Explicit soft prune
  python scripts/quiz_seed.py --prune-hard        # Hard delete (DANGEROUS)
  python scripts/quiz_seed.py --skip-normalize    # Skip normalization step
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import Set

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def normalize_units(topics_dir: Path) -> bool:
    """Run normalize script on all quiz units.
    
    Returns:
        True if successful, False if errors
    """
    try:
        import subprocess
        
        normalize_script = Path(__file__).parent / "quiz_units_normalize.py"
        if not normalize_script.exists():
            logger.warning(f"Normalize script not found: {normalize_script}")
            return True  # Don't fail if script missing
        
        logger.info("Normalizing quiz units...")
        result = subprocess.run(
            [sys.executable, str(normalize_script), "--write", "--topics-dir", str(topics_dir)],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            logger.error(f"Normalize failed: {result.stderr}")
            return False
        
        logger.info("✓ Normalization complete")
        return True
        
    except Exception as e:
        logger.error(f"Normalize error: {e}")
        return False


def get_existing_topic_slugs_from_json(topics_dir: Path) -> Set[str]:
    """Get set of topic slugs from JSON files."""
    import json
    
    slugs = set()
    for json_file in topics_dir.glob("*.json"):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                slug = data.get("slug")
                if slug:
                    slugs.add(slug)
        except Exception as e:
            logger.warning(f"Could not read {json_file.name}: {e}")
    
    return slugs


def prune_topics_soft(session, topics_dir: Path, QuizTopic) -> dict:
    """Soft-prune topics: set is_active=false for topics without JSON.
    
    Returns:
        Dict with prune statistics
    """
    logger.info("Running soft prune...")
    
    # Get slugs from JSON files
    json_slugs = get_existing_topic_slugs_from_json(topics_dir)
    logger.info(f"Found {len(json_slugs)} topic(s) in JSON files")
    
    # Get all topics from DB
    all_topics = session.query(QuizTopic).all()
    logger.info(f"Found {len(all_topics)} topic(s) in database")
    
    pruned_count = 0
    for topic in all_topics:
        if topic.id not in json_slugs and topic.is_active:
            logger.info(f"Soft-pruning topic: {topic.id} (no JSON file)")
            topic.is_active = False
            pruned_count += 1
    
    session.commit()
    
    logger.info(f"✓ Soft prune complete: {pruned_count} topic(s) deactivated")
    
    return {
        "json_topics": len(json_slugs),
        "db_topics": len(all_topics),
        "pruned": pruned_count
    }


def prune_topics_hard(session, topics_dir: Path, QuizTopic, QuizQuestion) -> dict:
    """Hard-prune topics: DELETE topics and questions without JSON.
    
    WARNING: This permanently deletes data. Skips topics with player runs/scores.
    
    Returns:
        Dict with prune statistics
    """
    logger.warning("Running HARD prune (DELETE)...")
    
    # Import QuizRun to check for dependencies
    from game_modules.quiz.models import QuizRun
    
    # Get slugs from JSON files
    json_slugs = get_existing_topic_slugs_from_json(topics_dir)
    logger.info(f"Found {len(json_slugs)} topic(s) in JSON files")
    
    # Get all topics from DB
    all_topics = session.query(QuizTopic).all()
    logger.info(f"Found {len(all_topics)} topic(s) in database")
    
    deleted_topics = 0
    deleted_questions = 0
    skipped_topics = 0
    
    for topic in all_topics:
        if topic.id not in json_slugs:
            # Check if topic has associated runs (player data)
            run_count = session.query(QuizRun).filter(QuizRun.topic_id == topic.id).count()
            
            if run_count > 0:
                logger.warning(f"Skipping topic {topic.id} - has {run_count} player run(s)")
                # Soft-delete instead
                if topic.is_active:
                    topic.is_active = False
                    skipped_topics += 1
                continue
            
            logger.warning(f"Hard-deleting topic: {topic.id}")
            
            # Delete questions first
            questions = session.query(QuizQuestion).filter(QuizQuestion.topic_id == topic.id).all()
            for q in questions:
                session.delete(q)
                deleted_questions += 1
            
            # Delete topic
            session.delete(topic)
            deleted_topics += 1
    
    session.commit()
    
    logger.warning(
        f"✓ Hard prune complete: {deleted_topics} topic(s) deleted, "
        f"{deleted_questions} question(s) deleted, {skipped_topics} topic(s) soft-deleted"
    )
    
    return {
        "json_topics": len(json_slugs),
        "db_topics": len(all_topics),
        "deleted_topics": deleted_topics,
        "deleted_questions": deleted_questions,
        "skipped_topics": skipped_topics
    }


def main():
    parser = argparse.ArgumentParser(
        description="Quiz content pipeline: normalize → seed → prune"
    )
    parser.add_argument(
        "--prune-soft",
        action="store_true",
        help="Soft prune: set is_active=false for removed topics (default)"
    )
    parser.add_argument(
        "--prune-hard",
        action="store_true",
        help="Hard prune: DELETE removed topics and questions (DANGEROUS)"
    )
    parser.add_argument(
        "--skip-normalize",
        action="store_true",
        help="Skip normalization step"
    )
    parser.add_argument(
        "--topics-dir",
        type=str,
        default=None,
        help="Custom topics directory (default: content/quiz/topics)"
    )
    
    args = parser.parse_args()
    
    # Default: soft prune if neither specified
    if not args.prune_soft and not args.prune_hard:
        args.prune_soft = True
    
    # Import app first to set up all modules correctly
    from src.app import create_app
    
    app = create_app()
    
    with app.app_context():
        # Now import quiz modules within app context
        from game_modules.quiz.seed import seed_quiz_units, QUIZ_UNITS_TOPICS_DIR
        from game_modules.quiz.models import QuizTopic, QuizQuestion
        from src.app.extensions.sqlalchemy_ext import get_session
        
        # Determine topics directory
        topics_dir = Path(args.topics_dir) if args.topics_dir else QUIZ_UNITS_TOPICS_DIR
        if not topics_dir.exists():
            logger.error(f"Topics directory not found: {topics_dir}")
            sys.exit(1)
        
        logger.info("Quiz Seed Pipeline starting...")
        logger.info(f"Topics directory: {topics_dir}")
        
        # Step 1: Normalize (optional)
        if not args.skip_normalize:
            if not normalize_units(topics_dir):
                logger.error("Normalization failed, aborting")
                sys.exit(1)
        else:
            logger.info("Skipping normalization (--skip-normalize)")
        
        # Step 2: Seed database
        logger.info("Seeding database...")
        with get_session() as session:
            result = seed_quiz_units(session, units_dir=topics_dir.parent)
        
        if not result["success"]:
            logger.error(f"Seeding failed: {result.get('errors', [])}")
            sys.exit(1)
        
        logger.info(
            f"✓ Seeding complete: {result['units_imported']} units, "
            f"{result['questions_imported']} questions"
        )
        
        # Step 3: Prune
        with get_session() as session:
            if args.prune_hard:
                prune_stats = prune_topics_hard(session, topics_dir, QuizTopic, QuizQuestion)
            else:
                prune_stats = prune_topics_soft(session, topics_dir, QuizTopic)
        
        # Summary
        logger.info("=" * 60)
        logger.info("Quiz Seed Pipeline completed successfully")
        logger.info(f"  Units seeded: {result['units_imported']}")
        logger.info(f"  Questions: {result['questions_imported']}")
        if args.prune_hard:
            logger.info(f"  Deleted: {prune_stats['deleted_topics']} topics, {prune_stats['deleted_questions']} questions")
        else:
            logger.info(f"  Pruned (soft): {prune_stats['pruned']} topics")
        logger.info("=" * 60)
    
    sys.exit(0)


if __name__ == "__main__":
    main()
