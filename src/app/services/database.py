"""SQLite database utilities for the games_hispanistica web app."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DATA_ROOT = Path(__file__).resolve().parents[3] / "data"
PRIVATE_DB_ROOT = DATA_ROOT / "db"
PUBLIC_DB_ROOT = DATA_ROOT / "db_public"

DATABASES = {
    "stats_files": PRIVATE_DB_ROOT / "stats_files.db",
    "stats_country": PRIVATE_DB_ROOT / "stats_country.db",
    "stats_all": PUBLIC_DB_ROOT / "stats_all.db",
}


def get_connection(name: str) -> sqlite3.Connection:
    """Return a sqlite3 connection with row factory enabled."""
    path = DATABASES.get(name)
    if path is None:
        raise KeyError(f"Unknown database identifier: {name}")
    connection = sqlite3.connect(str(path), detect_types=sqlite3.PARSE_DECLTYPES)
    connection.row_factory = sqlite3.Row
    return connection


@contextmanager
def open_db(name: str) -> Iterator[sqlite3.Connection]:
    """Context manager that closes the connection automatically."""
    connection = get_connection(name)
    try:
        yield connection
    finally:
        connection.close()
