"""
Seed Quiz Content from quiz_content_v1.json (idempotent)

This script reads quiz content from the new quiz_seed_v1 format and
imports it into the database using UPSERT operations (no delete-all).

Features:
- Idempotent: Can be run multiple times safely
- Deterministic IDs based on content hashing
- Validates question structure before import
- No deletion of existing data (runs/sessions/players)
- Transactional: All or nothing

Usage:
    python scripts/seed_quiz_content.py
    python scripts/seed_quiz_content.py --path docs/games_modules/custom.json
    python scripts/seed_quiz_content.py --dry-run
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any, Tuple

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database URL (PostgreSQL for quiz module)
DATABASE_URL = "postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth"


class ValidationError(Exception):
    """Raised when quiz content validation fails."""
    pass


class ValidationError(Exception):
    """Raised when quiz content validation fails."""
    pass


def generate_question_id(topic_slug: str, author_initials: str, prompt: str) -> str:
    """Generate deterministic question ID from content hash.
    
    Args:
        topic_slug: Topic slug
        author_initials: Author initials
        prompt: Question prompt text
        
    Returns:
        24-character hex ID
    """
    content = f"{topic_slug}|{author_initials}|{prompt}"
    hash_obj = hashlib.sha256(content.encode('utf-8'))
    return hash_obj.hexdigest()[:24]


def generate_answer_id(question_id: str, answer_text: str) -> str:
    """Generate deterministic answer ID from content hash.
    
    Args:
        question_id: Question ID
        answer_text: Answer text
        
    Returns:
        16-character hex ID
    """
    content = f"{question_id}|{answer_text}"
    hash_obj = hashlib.sha256(content.encode('utf-8'))
    return hash_obj.hexdigest()[:16]


def load_quiz_content(path: Path) -> Dict[str, Any]:
    """Load quiz content from JSON file.
    
    Args:
        path: Path to JSON file
        
    Returns:
        Parsed JSON content
        
    Raises:
        FileNotFoundError: If file doesn't exist
        json.JSONDecodeError: If JSON is invalid
    """
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_content(content: Dict[str, Any]) -> None:
    """Validate quiz content structure.
    
    Args:
        content: Quiz content dict
        
    Raises:
        ValidationError: If validation fails
    """
    # Check schema version
    schema_version = content.get("schema_version")
    if schema_version != "quiz_seed_v1":
        raise ValidationError(f"Invalid schema_version: {schema_version}. Expected 'quiz_seed_v1'")
    
    # Check defaults
    defaults = content.get("defaults", {})
    missing_explanation = defaults.get("missing_explanation_text", "Erklärung folgt.")
    
    # Validate quizzes
    quizzes = content.get("quizzes", [])
    if not quizzes:
        raise ValidationError("No quizzes found")
    
    for quiz_idx, quiz in enumerate(quizzes):
        quiz_num = quiz_idx + 1
        
        # Check required fields
        if not quiz.get("slug"):
            raise ValidationError(f"Quiz #{quiz_num}: Missing 'slug'")
        if not quiz.get("title"):
            raise ValidationError(f"Quiz #{quiz_num}: Missing 'title'")
        
        # Validate questions
        questions = quiz.get("questions", [])
        if not questions:
            raise ValidationError(f"Quiz '{quiz['slug']}': No questions")
        
        for q_idx, question in enumerate(questions):
            q_num = q_idx + 1
            q_label = f"Quiz '{quiz['slug']}' Question #{q_num}"
            
            # Check required fields
            if not question.get("author_initials"):
                raise ValidationError(f"{q_label}: Missing 'author_initials'")
            if not question.get("prompt"):
                raise ValidationError(f"{q_label}: Missing 'prompt'")
            if "difficulty" not in question:
                raise ValidationError(f"{q_label}: Missing 'difficulty'")
            
            # Validate difficulty
            difficulty = question.get("difficulty")
            if not isinstance(difficulty, int) or difficulty < 1 or difficulty > 5:
                raise ValidationError(f"{q_label}: Invalid difficulty {difficulty} (must be 1-5)")
            
            # Validate answers
            answers = question.get("answers", [])
            if len(answers) < 2:
                raise ValidationError(f"{q_label}: Must have at least 2 answers (has {len(answers)})")
            
            # Count correct answers
            correct_count = sum(1 for a in answers if a.get("correct") is True)
            if correct_count != 1:
                raise ValidationError(
                    f"{q_label}: Must have exactly 1 correct answer (has {correct_count})"
                )
            
            # Check all answers have text
            for a_idx, answer in enumerate(answers):
                if not answer.get("text"):
                    raise ValidationError(f"{q_label} Answer #{a_idx+1}: Missing 'text'")


def transform_to_db_schema(content: Dict[str, Any]) -> Tuple[List[Dict], List[Dict]]:
    """Transform quiz_seed_v1 JSON to database records.
    
    Args:
        content: Quiz content dict
        
    Returns:
        Tuple of (topics, questions)
    """
    defaults = content.get("defaults", {})
    missing_explanation = defaults.get("missing_explanation_text", "Erklärung folgt.")
    
    topics = []
    questions = []
    
    for quiz_idx, quiz in enumerate(content.get("quizzes", [])):
        # Create topic record
        topic = {
            "id": quiz["slug"],
            "title_key": quiz["title"],
            "description_key": quiz.get("description", ""),
            "is_active": quiz.get("is_active", True),
            "order_index": quiz_idx + 1,
            "created_at": datetime.now(timezone.utc)
        }
        topics.append(topic)
        
        # Create question records
        for question in quiz.get("questions", []):
            # Generate deterministic question ID
            q_id = generate_question_id(
                quiz["slug"],
                question["author_initials"],
                question["prompt"]
            )
            
            # Build answers JSONB array with deterministic IDs
            answers = []
            for answer in question["answers"]:
                answer_id = generate_answer_id(q_id, answer["text"])
                answers.append({
                    "id": answer_id,
                    "text_key": answer["text"],
                    "correct": answer["correct"]
                })
            
            # Get explanation or use default
            explanation = question.get("explanation", "").strip()
            if not explanation:
                explanation = missing_explanation
            
            # Create question record
            q = {
                "id": q_id,
                "topic_id": quiz["slug"],
                "difficulty": question["difficulty"],
                "type": question.get("type", "single_choice"),
                "prompt_key": question["prompt"],
                "explanation_key": explanation,
                "answers": answers,
                "author_initials": question["author_initials"],
                "is_active": question.get("is_active", True),
                "created_at": datetime.now(timezone.utc)
            }
            questions.append(q)
    
    return topics, questions


def seed_database(topics: List[Dict], questions: List[Dict], dry_run: bool = False) -> None:
    """Seed the database with topics and questions using UPSERT.
    
    Args:
        topics: List of topic records
        questions: List of question records
        dry_run: If True, don't commit changes
        
    Note: Uses ON CONFLICT DO UPDATE for idempotent imports.
    """
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Upsert topics
        print(f"\n📚 Upserting {len(topics)} topics...")
        for topic in topics:
            session.execute(
                text("""
                    INSERT INTO quiz_topics (id, title_key, description_key, is_active, order_index, created_at)
                    VALUES (:id, :title_key, :description_key, :is_active, :order_index, :created_at)
                    ON CONFLICT (id) DO UPDATE SET
                        title_key = EXCLUDED.title_key,
                        description_key = EXCLUDED.description_key,
                        is_active = EXCLUDED.is_active,
                        order_index = EXCLUDED.order_index
                """),
                topic,
            )
        
        if not dry_run:
            session.commit()
            print(f"✅ Upserted {len(topics)} topics")
        else:
            print(f"🔍 DRY RUN: Would upsert {len(topics)} topics")
        
        # Upsert questions
        print(f"\n❓ Upserting {len(questions)} questions...")
        for question in questions:
            # Convert answers list to JSON string for PostgreSQL
            answers_json = json.dumps(question["answers"])
            
            session.execute(
                text("""
                    INSERT INTO quiz_questions (
                        id, topic_id, difficulty, type, prompt_key, explanation_key, 
                        answers, author_initials, is_active, created_at
                    )
                    VALUES (
                        :id, :topic_id, :difficulty, :type, :prompt_key, :explanation_key,
                        CAST(:answers AS jsonb), :author_initials, :is_active, :created_at
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        topic_id = EXCLUDED.topic_id,
                        difficulty = EXCLUDED.difficulty,
                        type = EXCLUDED.type,
                        prompt_key = EXCLUDED.prompt_key,
                        explanation_key = EXCLUDED.explanation_key,
                        answers = EXCLUDED.answers,
                        author_initials = EXCLUDED.author_initials,
                        is_active = EXCLUDED.is_active
                """),
                {**question, "answers": answers_json}
            )
        
        if not dry_run:
            session.commit()
            print(f"✅ Upserted {len(questions)} questions")
        else:
            print(f"🔍 DRY RUN: Would upsert {len(questions)} questions")
        
        # Show summary
        print("\n" + "="*60)
        print("📊 Summary:")
        print("="*60)
        
        for topic in topics:
            topic_questions = [q for q in questions if q["topic_id"] == topic["id"]]
            print(f"\n📗 {topic['title_key']}")
            print(f"   ID: {topic['id']}")
            print(f"   Questions: {len(topic_questions)}")
            print(f"   Active: {'✅' if topic['is_active'] else '❌'}")
            
            # Show difficulty distribution
            diff_counts = {}
            for q in topic_questions:
                d = q["difficulty"]
                diff_counts[d] = diff_counts.get(d, 0) + 1
            print(f"   Difficulty: {', '.join(f'L{d}={c}' for d, c in sorted(diff_counts.items()))}")
        
        if dry_run:
            print("\n🔍 DRY RUN: No changes committed")
        else:
            print("\n✨ Database seeded successfully!")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Error seeding database: {e}")
        raise
    finally:
        session.close()


def reset_quiz_content(reset_players: bool = False) -> None:
    """Delete all quiz content from database in correct FK order.
    
    Args:
        reset_players: If True, also delete quiz players (default: False)
        
    Note: Does NOT delete webapp auth/users, only quiz module data.
    """
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("\n🗑️  Resetting quiz content...")
        
        # Delete in correct FK order
        tables = [
            ("quiz_run_answers", "Run answers"),
            ("quiz_runs", "Quiz runs"),
            ("quiz_scores", "Quiz scores"),
            ("quiz_questions", "Questions"),
            ("quiz_topics", "Topics"),
        ]
        
        if reset_players:
            tables.append(("quiz_players", "Quiz players"))
        
        for table_name, label in tables:
            result = session.execute(text(f"DELETE FROM {table_name}"))
            count = result.rowcount
            print(f"   ✓ Deleted {count} rows from {label} ({table_name})")
        
        session.commit()
        print("✅ Quiz content reset complete")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ Error resetting quiz content: {e}")
        raise
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(
        description="Seed quiz content from quiz_seed_v1 JSON (idempotent)"
    )
    parser.add_argument(
        "--path",
        type=Path,
        default=project_root / "docs" / "quiz-seed" / "quiz_content_v1.json",
        help="Path to quiz content JSON file (default: docs/quiz-seed/quiz_content_v1.json)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and preview without committing changes"
    )
    parser.add_argument(
        "--reset-content",
        action="store_true",
        help="Delete all quiz content before importing (DESTRUCTIVE)"
    )
    parser.add_argument(
        "--reset-players",
        action="store_true",
        help="Also delete quiz players when using --reset-content"
    )
    
    args = parser.parse_args()
    
    print("🌱 Seeding Quiz Content (quiz_seed_v1)")
    print("="*60)
    print(f"Path: {args.path}")
    if args.dry_run:
        print("Mode: DRY RUN (no changes will be committed)")
    if args.reset_content:
        print("Mode: RESET (will delete existing content)")
        if args.reset_players:
            print("      Also deleting quiz players")
    print("="*60)
    
    # Reset content if requested
    if args.reset_content and not args.dry_run:
        reset_quiz_content(reset_players=args.reset_players)
    
    # Load content
    try:
        print("\n📖 Loading quiz content...")
        content = load_quiz_content(args.path)
        print(f"✅ Loaded {len(content.get('quizzes', []))} quizzes")
    except FileNotFoundError:
        print(f"❌ File not found: {args.path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        sys.exit(1)
    
    # Validate content
    try:
        print("\n🔍 Validating content...")
        validate_content(content)
        print("✅ Content validation passed")
    except ValidationError as e:
        print(f"❌ Validation failed: {e}")
        sys.exit(1)
    
    # Transform
    print("\n🔄 Transforming to database schema...")
    topics, questions = transform_to_db_schema(content)
    print(f"✅ Transformed to {len(topics)} topics and {len(questions)} questions")
    
    # Seed
    print("\n💾 Seeding database...")
    try:
        seed_database(topics, questions, dry_run=args.dry_run)
    except Exception as e:
        print(f"\n❌ Seeding failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
