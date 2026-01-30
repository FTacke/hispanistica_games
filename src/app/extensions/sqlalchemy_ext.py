"""Lightweight SQLAlchemy extension for this project.

Provides a create_engine+sessionmaker and helper contextmanager `get_session()`.
The auth migration uses a separate AUTH database by default (data/db/auth.db), but
this extension can accept any SQLAlchemy URL via config (AUTH_DATABASE_URL).
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

_engine = None
_SessionLocal: sessionmaker | None = None

_quiz_engine = None
_QuizSessionLocal: sessionmaker | None = None


def init_engine(app) -> None:
    global _engine, _SessionLocal
    db_url = app.config.get("AUTH_DATABASE_URL")
    if not db_url:
        raise RuntimeError("AUTH_DATABASE_URL is not configured")

    _engine = create_engine(db_url, future=True)
    _SessionLocal = sessionmaker(
        bind=_engine, autoflush=False, autocommit=False, expire_on_commit=False
    )


def _resolve_quiz_db_url(app) -> Optional[str]:
    """Resolve quiz DB URL from env or app config.
    
    Priority:
    1) QUIZ_DATABASE_URL
    2) QUIZ_DB_* (host/port/user/password/name)
    3) DATABASE_URL
    4) app.config["QUIZ_DATABASE_URL"] (if provided)
    """
    import os

    if os.getenv("QUIZ_DATABASE_URL"):
        return os.getenv("QUIZ_DATABASE_URL")

    host = os.getenv("QUIZ_DB_HOST")
    port = os.getenv("QUIZ_DB_PORT")
    user = os.getenv("QUIZ_DB_USER")
    password = os.getenv("QUIZ_DB_PASSWORD")
    name = os.getenv("QUIZ_DB_NAME")

    if host and port and user and password and name:
        return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"

    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")

    if app is not None:
        cfg = app.config.get("QUIZ_DATABASE_URL")
        if cfg:
            return cfg

    return None


def init_quiz_engine(app) -> None:
    """Initialize SQLAlchemy engine for quiz module (PostgreSQL-only)."""
    global _quiz_engine, _QuizSessionLocal
    import os

    db_url = _resolve_quiz_db_url(app)
    if not db_url:
        raise RuntimeError("QUIZ_DATABASE_URL / QUIZ_DB_* not configured")

    auth_url = None
    if app is not None:
        auth_url = app.config.get("AUTH_DATABASE_URL")
    if not auth_url:
        auth_url = os.getenv("AUTH_DATABASE_URL")

    if _should_enforce_quiz_auth_guard(app) and auth_url:
        _assert_quiz_not_auth_db(auth_url, db_url)

    _quiz_engine = create_engine(db_url, future=True)
    _QuizSessionLocal = sessionmaker(
        bind=_quiz_engine, autoflush=False, autocommit=False, expire_on_commit=False
    )


def _should_enforce_quiz_auth_guard(app) -> bool:
    import os

    if os.getenv("ENV") == "test":
        return False
    if os.getenv("FLASK_ENV") == "test":
        return False
    if app is not None and app.config.get("TESTING"):
        return False
    return True


def _normalize_db_target(db_url: str) -> Optional[tuple[str, int, str]]:
    url = make_url(db_url)
    host = (url.host or "").lower()
    database = url.database or ""
    if not host or not database:
        return None
    port = url.port or 5432
    return (host, port, database)


def _assert_quiz_not_auth_db(auth_url: str, quiz_url: str) -> None:
    auth_target = _normalize_db_target(auth_url)
    quiz_target = _normalize_db_target(quiz_url)
    if auth_target and quiz_target and auth_target == quiz_target:
        raise RuntimeError(
            "Misconfiguration: QUIZ_DATABASE_URL must not point to AUTH database."
        )


def get_engine():
    return _engine


def get_quiz_engine():
    return _quiz_engine


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


@contextmanager
def get_quiz_session() -> Iterator[Session]:
    """Yield SQLAlchemy session for quiz DB and ensure rollback/close."""
    if _QuizSessionLocal is None:
        raise RuntimeError("Quiz engine not initialized — call init_quiz_engine(app) first")
    session = _QuizSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
