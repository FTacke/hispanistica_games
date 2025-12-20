"""Initialize auth database tables."""
import os
import sys
from pathlib import Path

# Add src to Python path
repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root))

# Set database URL if not already set
if "AUTH_DATABASE_URL" not in os.environ:
    db_path = repo_root / "data" / "db" / "auth.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    os.environ["AUTH_DATABASE_URL"] = f"sqlite:///{db_path}"

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
from src.app.auth.models import Base


class FakeApp:
    """Minimal Flask app stub for database initialization."""
    def __init__(self):
        self.config = {
            'AUTH_DATABASE_URL': os.environ.get('AUTH_DATABASE_URL')
        }


def main():
    """Initialize database tables."""
    print(f"Initializing auth database...")
    print(f"URL: {os.environ.get('AUTH_DATABASE_URL')}")
    
    app = FakeApp()
    init_engine(app)
    engine = get_engine()
    
    Base.metadata.create_all(bind=engine)
    print('✓ Database tables initialized.')


if __name__ == "__main__":
    main()
