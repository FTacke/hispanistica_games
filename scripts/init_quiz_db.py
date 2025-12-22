"""Initialize Quiz module database tables and seed demo content.

PostgreSQL-ONLY implementation per quiz_module_implementation.md spec.

Usage:
    python scripts/init_quiz_db.py [--seed]

Options:
    --seed    Also seed the demo topic with questions
    --drop    Drop existing tables first (use with caution)

Environment:
    AUTH_DATABASE_URL - PostgreSQL connection URL (required)
                        e.g. postgresql://user:pass@localhost:5432/hispanistica
"""

import os
import sys
import argparse
from pathlib import Path

# Add src to Python path
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root))


def main():
    parser = argparse.ArgumentParser(description="Initialize Quiz module database (PostgreSQL)")
    parser.add_argument("--seed", action="store_true", help="Seed demo content")
    parser.add_argument("--drop", action="store_true", help="Drop existing tables first")
    args = parser.parse_args()

    # Validate PostgreSQL URL
    db_url = os.environ.get('AUTH_DATABASE_URL')
    if not db_url:
        print("ERROR: AUTH_DATABASE_URL environment variable is required.")
        print("       Set it to a PostgreSQL connection URL.")
        print("       Example: postgresql://user:pass@localhost:5432/hispanistica")
        sys.exit(1)
    
    if not db_url.startswith(('postgresql://', 'postgres://')):
        print(f"ERROR: Quiz module requires PostgreSQL.")
        print(f"       Current URL scheme: {db_url.split('://')[0]}")
        print(f"       Expected: postgresql:// or postgres://")
        sys.exit(1)

    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
    from game_modules.quiz.models import QuizBase

    class FakeApp:
        def __init__(self):
            self.config = {
                'AUTH_DATABASE_URL': db_url
            }

    print(f"Initializing Quiz database (PostgreSQL)...")
    print(f"URL: {db_url.split('@')[1] if '@' in db_url else db_url}")  # Hide credentials

    app = FakeApp()
    init_engine(app)
    engine = get_engine()

    if args.drop:
        print("Dropping existing Quiz tables...")
        QuizBase.metadata.drop_all(bind=engine)

    # Create all Quiz tables
    QuizBase.metadata.create_all(bind=engine)
    print('✓ Quiz database tables initialized.')

    if args.seed:
        print("\nSeeding demo content...")
        from game_modules.quiz.seed import seed_demo_topic
        
        with get_session() as session:
            try:
                if seed_demo_topic(session):
                    print('✓ Demo topic seeded successfully.')
                else:
                    print('ℹ Demo topic already exists.')
            except Exception as e:
                print(f'✗ Failed to seed demo topic: {e}')
                raise

    print("\n✓ Quiz module initialization complete.")


if __name__ == "__main__":
    main()
