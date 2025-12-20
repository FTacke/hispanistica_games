import pytest
from flask import Flask


@pytest.fixture
def client():
    from pathlib import Path

    project_root = Path(__file__).resolve().parents[1]
    templates_dir = project_root / "templates"

    app = Flask(__name__, template_folder=str(templates_dir))

    # Provide minimal context helpers required by templates
    @app.context_processor
    def _inject_now():
        from datetime import datetime

        return {"now": datetime.utcnow}

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints

    register_extensions(app)
    register_blueprints(app)

    ctx = app.app_context()
    ctx.push()
    c = app.test_client()
    yield c
    ctx.pop()


def test_privacy_page_contains_auth_text(client):
    # Uses the app fixture from other tests in this repo - ensure auth routes/templates are available
    resp = client.get("/privacy")
    assert resp.status_code == 200
    text = resp.get_data(as_text=True)
    assert "refreshToken" in text or "Refresh-Token" in text
    assert "/auth/account/data-export" in text or "data-export" in text
