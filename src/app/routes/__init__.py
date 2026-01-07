"""Blueprint registration for hispanistica_games (minimal games platform)."""

from __future__ import annotations

from flask import Flask

from . import (
    admin,
    auth,
    public,
    quiz_admin,
)

# Import game modules
from game_modules.quiz import quiz_blueprint


BLUEPRINTS = [
    public.blueprint,
    auth.blueprint,
    admin.blueprint,
    quiz_admin.blueprint,  # Quiz Admin Dashboard
    quiz_blueprint,  # Quiz game module
]


def register_blueprints(app: Flask) -> None:
    """Register all blueprints with the Flask application."""
    for bp in BLUEPRINTS:
        app.register_blueprint(bp)
