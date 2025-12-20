"""Lightweight SQLAlchemy extension for this project.

Provides a create_engine+sessionmaker and helper contextmanager `get_session()`.
The auth migration uses a separate AUTH database by default (data/db/auth.db), but
this extension can accept any SQLAlchemy URL via config (AUTH_DATABASE_URL).
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

_engine = None
_SessionLocal: sessionmaker | None = None


def init_engine(app) -> None:
    global _engine, _SessionLocal
    db_url = app.config.get("AUTH_DATABASE_URL")
    if not db_url:
        raise RuntimeError("AUTH_DATABASE_URL is not configured")

    _engine = create_engine(db_url, future=True)
    _SessionLocal = sessionmaker(
        bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False
    )


def get_engine():
    return _engine


@contextmanager
def get_session() -> Iterator[Session]:
    """Yield SQLAlchemy session and ensure rollback/close."""
    if _SessionLocal is None:
        raise RuntimeError("Engine not initialized — call init_engine(app) first")
    session = _SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
