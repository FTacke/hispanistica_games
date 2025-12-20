from flask import Flask, g, render_template


def make_app():
    import os

    here = os.path.dirname(__file__)
    templates_dir = os.path.abspath(os.path.join(here, "..", "templates"))
    app = Flask(__name__, template_folder=templates_dir)
    app.config["TESTING"] = True

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints

    register_extensions(app)
    register_blueprints(app)

    return app


def test_account_button_admin_renders():
    app = make_app()
    from src.app.auth import Role

    with app.test_request_context("/"):
        g.user = "alice"
        g.role = Role.ADMIN

        html = render_template("partials/_top_app_bar.html")
        assert "md3-top-app-bar__account-chip" in html
        assert "alice" in html
        assert "admin_panel_settings" in html


def test_account_button_editor_renders():
    app = make_app()
    from src.app.auth import Role

    with app.test_request_context("/"):
        g.user = "bob"
        g.role = Role.EDITOR

        html = render_template("partials/_top_app_bar.html")
        assert "md3-top-app-bar__account-chip" in html
        assert "bob" in html
        assert "person_edit" in html


def test_account_button_user_renders():
    app = make_app()
    from src.app.auth import Role

    with app.test_request_context("/"):
        g.user = "carla"
        g.role = Role.USER

        html = render_template("partials/_top_app_bar.html")
        assert "md3-top-app-bar__account-chip" in html
        assert "carla" in html
        assert "person_check" in html


def test_guest_shows_login_button():
    app = make_app()

    with app.test_request_context("/"):
        # No g.user -> unauthenticated state
        html = render_template("partials/_top_app_bar.html")
        # The top app bar should include the login affordance; check for the icon
        assert "account_circle" in html or "Iniciar" in html
