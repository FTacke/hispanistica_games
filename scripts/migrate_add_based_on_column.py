"""Add based_on JSONB column to quiz_topics table.

Migration script for adding source reference information to quiz topics.

Usage:
    python scripts/migrate_add_based_on_column.py

Environment:
    AUTH_DATABASE_URL - PostgreSQL connection URL (required)
"""

import os
import sys
from pathlib import Path

# Add src to Python path
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root))


def main():
    db_url = os.environ.get('AUTH_DATABASE_URL')
    if not db_url:
        print("ERROR: AUTH_DATABASE_URL environment variable is required.")
        sys.exit(1)
    
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
    
    class FakeApp:
        def __init__(self):
            self.config = {'AUTH_DATABASE_URL': db_url}
    
    print("Migrating quiz_topics table: adding based_on column...")
    
    app = FakeApp()
    init_engine(app)
    engine = get_engine()
    
    from sqlalchemy import text
    
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(
            text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'quiz_topics' AND column_name = 'based_on'
            """)
        )
        if result.fetchone():
            print("[INFO] Column 'based_on' already exists. Migration skipped.")
            return
        
        # Add column
        conn.execute(
            text("""
            ALTER TABLE quiz_topics 
            ADD COLUMN IF NOT EXISTS based_on JSONB NULL
            """)
        )
        conn.commit()
        print("[OK] Column 'based_on' added successfully.")


if __name__ == "__main__":
    main()
