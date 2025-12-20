"""Blueprint registration for hispanistica_games (minimal games platform)."""

from __future__ import annotations

from flask import Flask

from . import (
    auth,
    public,
)


BLUEPRINTS = [
    public.blueprint,
    auth.blueprint,
]


def register_blueprints(app: Flask) -> None:
    """Register all blueprints with the Flask application."""
    for bp in BLUEPRINTS:
        app.register_blueprint(bp)
