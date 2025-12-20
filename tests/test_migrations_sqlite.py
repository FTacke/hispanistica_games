import sqlite3
from pathlib import Path

SQL_FILE = (
    Path(__file__).resolve().parents[1]
    / "migrations"
    / "0001_create_auth_schema_sqlite.sql"
)


def test_sqlite_migration_executes():
    assert SQL_FILE.exists(), "Migration SQL file missing"

    sql = SQL_FILE.read_text(encoding="utf-8")

    # Use an in-memory SQLite DB to validate syntax and table creation
    conn = sqlite3.connect(":memory:")
    try:
        conn.executescript(sql)

        cur = conn.cursor()
        # verify tables exist
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {r[0] for r in cur.fetchall()}
        assert "users" in tables
        assert "refresh_tokens" in tables
        assert "reset_tokens" in tables
    finally:
        conn.close()
