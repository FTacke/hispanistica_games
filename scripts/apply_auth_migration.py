#!/usr/bin/env python3
"""
Apply Auth Database Migration

Initializes auth database schema (create tables).
Works with SQLite and PostgreSQL.

Usage:
    python scripts/apply_auth_migration.py --engine sqlite
    python scripts/apply_auth_migration.py --engine postgres
"""
import argparse
import os
import sys
from pathlib import Path

# Add src to Python path
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root))


def main():
    """Apply auth database migration."""
    parser = argparse.ArgumentParser(description="Apply auth database migration")
    parser.add_argument(
        "--engine",
        choices=["sqlite", "postgres"],
        default="sqlite",
        help="Database engine (default: sqlite)"
    )
    args = parser.parse_args()
    
    print(f"Applying auth migration for {args.engine}...")
    
    # Validate AUTH_DATABASE_URL is set
    db_url = os.environ.get("AUTH_DATABASE_URL")
    if not db_url:
        print("❌ ERROR: AUTH_DATABASE_URL not set")
        sys.exit(2)
    
    print(f"Database URL: {db_url}")
    
    # Import after env is set
    from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
    from src.app.auth.models import Base
    
    class FakeApp:
        """Minimal Flask app stub."""
        def __init__(self):
            self.config = {
                'AUTH_DATABASE_URL': db_url
            }
    
    try:
        app = FakeApp()
        init_engine(app)
        engine = get_engine()
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        print("✅ Migration applied successfully")
        sys.exit(0)
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(2)


if __name__ == "__main__":
    main()
