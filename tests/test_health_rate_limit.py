import pytest
from pathlib import Path

from flask import Flask

from src.app.auth.models import Base
from src.app.extensions.sqlalchemy_ext import get_engine, init_engine


@pytest.fixture
def client():
    project_root = Path(__file__).resolve().parents[1]
    app = Flask(
        __name__,
        template_folder=str(project_root / "templates"),
        static_folder=str(project_root / "static"),
    )
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["TESTING"] = True
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["SECRET_KEY"] = "test-secret"

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints

    register_extensions(app)
    init_engine(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    register_blueprints(app)

    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def test_health_returns_200(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json == {
        "status": "healthy",
        "service": "games.hispanistica",
    }


def test_health_is_not_rate_limited(client):
    statuses = [client.get("/health").status_code for _ in range(250)]

    assert statuses == [200] * 250


def test_normal_routes_still_use_default_rate_limit(client):
    statuses = [client.get("/").status_code for _ in range(201)]

    assert statuses[199] == 200
    assert statuses[200] == 429
