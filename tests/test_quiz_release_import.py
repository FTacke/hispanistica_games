"""Integration tests for release import semantics (UPSERT/merge)."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Generator

import pytest
from flask import Flask
from sqlalchemy import text

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session


QUIZ_TEST_DB_URL = os.environ.get(
    "QUIZ_TEST_DATABASE_URL",
    "postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth",
)


@pytest.fixture
def import_app() -> Generator[Flask, None, None]:
    """Create Flask app with quiz import service configured."""
    project_root = Path(__file__).resolve().parents[1]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"

    app = Flask(
        __name__,
        template_folder=str(template_dir),
        static_folder=str(static_dir),
    )
    app.config["AUTH_DATABASE_URL"] = QUIZ_TEST_DB_URL
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"
    app.config["JWT_SECRET_KEY"] = "test-secret"

    from src.app.extensions import register_extensions

    register_extensions(app)
    init_engine(app)

    # Create quiz tables
    from game_modules.quiz.models import QuizBase

    engine = get_engine()
    QuizBase.metadata.create_all(bind=engine)

    # Ensure release_id columns exist (migration 0010)
    with engine.connect() as conn:
        conn.execute(
            text("ALTER TABLE quiz_topics ADD COLUMN IF NOT EXISTS release_id VARCHAR(50)")
        )
        conn.execute(
            text("ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS release_id VARCHAR(50)")
        )
        conn.commit()

    ctx = app.app_context()
    ctx.push()
    yield app

    _cleanup_import_test_data()
    ctx.pop()


def _cleanup_import_test_data() -> None:
    from game_modules.quiz.models import QuizTopic, QuizQuestion
    from game_modules.quiz.release_model import QuizContentRelease

    with get_session() as session:
        session.execute(QuizQuestion.__table__.delete())
        session.execute(QuizTopic.__table__.delete())
        session.execute(QuizContentRelease.__table__.delete())
        session.commit()


def _prepare_release_dir(tmp_path: Path, release_id: str) -> tuple[Path, Path]:
    release_root = tmp_path / "media" / "releases" / release_id
    units_dir = release_root / "units"
    audio_dir = release_root / "audio"
    units_dir.mkdir(parents=True, exist_ok=True)
    audio_dir.mkdir(parents=True, exist_ok=True)
    return units_dir, audio_dir


def test_import_upsert_keeps_existing_units(import_app: Flask, tmp_path: Path) -> None:
    from game_modules.quiz.import_service import QuizImportService
    from game_modules.quiz.models import QuizTopic

    project_root = Path(__file__).resolve().parents[1]
    content_root = project_root / "content" / "quiz" / "topics"

    unit_a = content_root / "variation_aussprache_v2.json"
    unit_a_patch = content_root / "variation_aussprache_v2_patch.json"
    unit_b = content_root / "kreativitaet.json"

    release_id = "test_release_import_semantics"
    units_dir, audio_dir = _prepare_release_dir(tmp_path, release_id)

    service = QuizImportService(project_root=tmp_path)

    # Import Unit A
    shutil.copyfile(unit_a, units_dir / "variation_aussprache.json")
    with get_session() as session:
        result_a = service.import_release(
            session=session,
            units_path=str(units_dir),
            audio_path=str(audio_dir),
            release_id=release_id,
            request_id="test-import-a",
        )
    assert result_a.success is True
    assert result_a.units_imported == 1

    # Import Unit B in same release (Unit A file removed to prove no delete)
    for json_file in units_dir.glob("*.json"):
        json_file.unlink()
    shutil.copyfile(unit_b, units_dir / "kreativitaet.json")

    with get_session() as session:
        result_b = service.import_release(
            session=session,
            units_path=str(units_dir),
            audio_path=str(audio_dir),
            release_id=release_id,
            request_id="test-import-b",
        )
    assert result_b.success is True

    with get_session() as session:
        topic_a = session.query(QuizTopic).filter(QuizTopic.id == "variation_aussprache").first()
        topic_b = session.query(QuizTopic).filter(QuizTopic.id == "kreativitaet").first()

    assert topic_a is not None
    assert topic_b is not None

    # Re-import Unit A with patch (upsert update)
    for json_file in units_dir.glob("*.json"):
        json_file.unlink()
    shutil.copyfile(unit_a_patch, units_dir / "variation_aussprache.json")

    with get_session() as session:
        result_patch = service.import_release(
            session=session,
            units_path=str(units_dir),
            audio_path=str(audio_dir),
            release_id=release_id,
            request_id="test-import-a-patch",
        )
    assert result_patch.success is True

    with get_session() as session:
        updated_topic_a = session.query(QuizTopic).filter(QuizTopic.id == "variation_aussprache").first()
        still_topic_b = session.query(QuizTopic).filter(QuizTopic.id == "kreativitaet").first()

    assert updated_topic_a is not None
    assert updated_topic_a.title_key == "Variation in der Aussprache (Beta)"
    assert still_topic_b is not None
