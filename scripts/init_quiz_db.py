"""Initialize Quiz module database tables and seed demo content.

PostgreSQL-ONLY implementation per quiz_module_implementation.md spec.

Usage:
    python scripts/init_quiz_db.py [--seed]

Options:
    --seed    Also seed the demo topic with questions
    --drop    Drop existing tables first (use with caution)

Environment:
    QUIZ_DATABASE_URL - PostgreSQL connection URL (preferred)
                        e.g. postgresql+psycopg2://user:pass@games-db-prod:5432/games_hispanistica_quiz
    QUIZ_DB_HOST / QUIZ_DB_PORT / QUIZ_DB_USER / QUIZ_DB_PASSWORD / QUIZ_DB_NAME
                      - alternative explicit connection parts
"""

import os
import sys
import argparse
from pathlib import Path

# Add src to Python path
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root))


def resolve_quiz_db_url() -> str | None:
    """Resolve quiz DB URL from explicit quiz environment variables only."""
    db_url = os.environ.get("QUIZ_DATABASE_URL")
    if db_url:
        return db_url

    host = os.environ.get("QUIZ_DB_HOST")
    port = os.environ.get("QUIZ_DB_PORT")
    user = os.environ.get("QUIZ_DB_USER")
    password = os.environ.get("QUIZ_DB_PASSWORD")
    name = os.environ.get("QUIZ_DB_NAME")

    if host and port and user and password and name:
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"

    return None


def main():
    parser = argparse.ArgumentParser(description="Initialize Quiz module database (PostgreSQL)")
    parser.add_argument("--seed", action="store_true", help="Seed demo content")
    parser.add_argument("--drop", action="store_true", help="Drop existing tables first")
    args = parser.parse_args()

    # Validate PostgreSQL URL
    db_url = resolve_quiz_db_url()
    if not db_url:
        print("ERROR: QUIZ_DATABASE_URL or QUIZ_DB_* environment variables are required.")
        print("       Set them to the dedicated quiz PostgreSQL database.")
        print("       Example: postgresql+psycopg2://games_app:***@games-db-prod:5432/games_hispanistica_quiz")
        sys.exit(1)
    
    scheme = db_url.split('://')[0] if '://' in db_url else ''
    # Accept SQLAlchemy driver-style schemes, e.g. postgresql+psycopg2://...
    if not (scheme.startswith('postgresql') or scheme.startswith('postgres')):
        print("ERROR: Quiz module requires PostgreSQL.")
        print(f"       Current URL scheme: {scheme or '(missing)'}")
        print("       Expected: postgresql://, postgres://, or postgresql+<driver>://")
        sys.exit(1)

    from src.app.extensions.sqlalchemy_ext import init_quiz_engine, get_quiz_engine
    from game_modules.quiz.models import QuizBase
    from game_modules.quiz.release_model import QuizContentRelease  # noqa: F401

    class FakeApp:
        def __init__(self):
            self.config = {
                'QUIZ_DATABASE_URL': db_url,
                'AUTH_DATABASE_URL': os.environ.get('AUTH_DATABASE_URL'),
            }

    print("Initializing Quiz database (PostgreSQL)...")
    print(f"URL: {db_url.split('@')[1] if '@' in db_url else db_url}")  # Hide credentials

    app = FakeApp()
    init_quiz_engine(app)
    engine = get_quiz_engine()

    if args.drop:
        print("Dropping existing Quiz tables...")
        QuizBase.metadata.drop_all(bind=engine)

    # Create all Quiz tables
    QuizBase.metadata.create_all(bind=engine)
    print('[OK] Quiz database tables initialized.')

    if args.seed:
        print("\nSeeding demo content... SKIPPED (Demo removed)")
        # from game_modules.quiz.seed import seed_demo_topic
        
        # with get_session() as session:
        #     try:
        #         if seed_demo_topic(session):
        #             print('[OK] Demo topic seeded successfully.')
        #         else:
        #             print('[INFO] Demo topic already exists.')
        #     except Exception as e:
        #         print(f'[ERROR] Failed to seed demo topic: {e}')
        #         raise

    print("\n[OK] Quiz module initialization complete.")


if __name__ == "__main__":
    main()
