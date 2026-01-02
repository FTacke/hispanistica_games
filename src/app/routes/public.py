"""Public routes for hispanistica_games."""

from __future__ import annotations

import logging
from flask import (
    Blueprint,
    make_response,
    render_template,
    request,
    jsonify,
)

logger = logging.getLogger(__name__)

blueprint = Blueprint("public", __name__)


@blueprint.get("/")
def landing_page():
    """Render the landing page with game cards."""
    return render_template("pages/index.html", page_name="index")


@blueprint.get("/login", endpoint="login")
def login_page():
    """Render a full-page login screen.

    This is the canonical login page for the site (public /login). It
    renders the existing template `templates/auth/login.html` and accepts
    an optional `next` query parameter for redirect-after-login.
    """
    next_url = request.args.get("next") or ""

    # Render the full login page (no caching)
    response = make_response(render_template("auth/login.html", next=next_url))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Vary"] = "Cookie"
    return response, 200


@blueprint.get("/health")
def health_check():
    """
    Simple health check endpoint for monitoring.

    Response:
    {
        "status": "healthy",
        "service": "games.hispanistica"
    }

    HTTP Status:
    - 200: Service is running
    """
    return jsonify({
        "status": "healthy",
        "service": "games.hispanistica"
    }), 200


@blueprint.get("/impressum")
def impressum_page():
    """Render the legal notice (Impressum) page."""
    return render_template("pages/impressum.html", page_name="impressum")


@blueprint.get("/projekt/ueber")
def projekt_ueber():
    """Render the 'Über das Projekt' page."""
    return render_template("pages/projekt_ueber.html", page_name="projekt")


@blueprint.get("/projekt/konzept")
def projekt_konzept():
    """Render the 'Didaktisches Konzept' page."""
    return render_template("pages/projekt_konzept.html", page_name="projekt")


@blueprint.get("/projekt/entwicklung")
def projekt_entwicklung():
    """Render the 'Offene Entwicklung' page."""
    return render_template("pages/projekt_entwicklung.html", page_name="projekt")


@blueprint.get("/privacy")
def privacy_page():
    """Render the privacy policy (Datenschutz) page."""
    return render_template("pages/privacy.html", page_name="privacy")
