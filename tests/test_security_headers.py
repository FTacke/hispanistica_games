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
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["TESTING"] = True

    from src.app.extensions.sqlalchemy_ext import init_engine as init_auth, get_engine
    from src.app.auth.models import Base
    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints

    register_extensions(app)
    init_auth(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    register_blueprints(app)

    # register global context processors and security headers used by create_app
    from src.app import register_context_processors, register_security_headers

    register_context_processors(app)
    register_security_headers(app)

    # ensure template helpers are available (already registered above)

    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def test_csp_script_src_no_unsafe_inline(client):
    r = client.get("/")
    assert "Content-Security-Policy" in r.headers
    csp = r.headers["Content-Security-Policy"]
    # Ensure 'unsafe-inline' was removed for scripts (styles still need it until jQuery migration)
    assert "script-src" in csp
    assert "'unsafe-inline'" not in csp.split("script-src", 1)[1].split(";", 1)[0]
    assert "style-src" in csp
    # NOTE: style-src still contains 'unsafe-inline' due to jQuery/DataTables dependency
    # This will be removed after jQuery migration (see TODO in src/app/__init__.py:213)
    # For now, we only verify that script-src doesn't have unsafe-inline
