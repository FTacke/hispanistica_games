import pytest


@pytest.fixture
def client():
    from flask import Flask
    from pathlib import Path

    project_root = Path(__file__).resolve().parents[1]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"

    app = Flask(
        __name__, template_folder=str(template_dir), static_folder=str(static_dir)
    )
    app.config["TESTING"] = True
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["SECRET_KEY"] = "test-secret"
    app.config["JWT_COOKIE_SECURE"] = False

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints
    from src.app.extensions.sqlalchemy_ext import init_engine as init_auth

    register_extensions(app)
    init_auth(app)
    # make sure auth DB tables exist for user creation
    from src.app.extensions.sqlalchemy_ext import get_engine
    from src.app.auth.models import Base

    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    # ensure global template helpers like now() are available
    from src.app import register_context_processors

    register_context_processors(app)
    register_blueprints(app)

    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def test_templates_render_logout_marker(client):
    # create a test user and log them in so authenticated UI is rendered
    from src.app.auth import services

    from datetime import datetime, timezone
    import secrets

    # create user record in auth DB
    from src.app.auth.models import User

    def create_user(username: str = "logouttest", role: str = "user") -> User:
        from src.app.extensions.sqlalchemy_ext import get_session

        with get_session() as session:
            u = User(
                id=str(secrets.token_hex(8)),
                username=username,
                email=f"{username}@example.org",
                password_hash=services.hash_password("password123"),
                role=role,
                is_active=True,
                must_reset_password=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(u)
        return u

    create_user("logouttest")

    # perform login endpoint to set cookies
    r = client.post(
        "/auth/login", json={"username": "logouttest", "password": "password123"}
    )
    assert r.status_code in (200, 303, 204)

    # visit landing page which includes top app bar and nav drawer partials
    rv = client.get("/")
    assert rv.status_code == 200
    html = rv.get_data(as_text=True)

    # top app bar should have an anchor with data-logout attribute
    assert 'data-logout="fetch"' in html, (
        "logout anchor should have data-logout attribute"
    )

    # navigation drawer should have logout item marked for JS handling
    assert "md3-navigation-drawer__item--logout" in html
    assert "data-logout-url" in html
