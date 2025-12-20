"""Check auth database users."""
import os
import sys
from pathlib import Path

repo_root = Path(__file__).parent.parent
sys.path.insert(0, str(repo_root))

os.environ["AUTH_DATABASE_URL"] = "sqlite:///data/db/auth.db"

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine
from src.app.auth.models import User
from sqlalchemy.orm import Session


class FakeApp:
    config = {'AUTH_DATABASE_URL': 'sqlite:///data/db/auth.db'}


app = FakeApp()
init_engine(app)
engine = get_engine()

session = Session(engine)
users = session.query(User).all()

print(f'\n✓ Found {len(users)} users in database:')
for u in users:
    print(f'  - {u.username} (id={u.id}, active={u.is_active}, role={u.role})')
session.close()
