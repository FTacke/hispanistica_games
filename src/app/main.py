"""Entry point for running the application via python -m src.app.main."""

from __future__ import annotations

import os

from . import create_app


def _resolve_env() -> str:
    env_name = os.getenv("FLASK_ENV")
    if env_name:
        return env_name
    env_name = "development"
    os.environ["FLASK_ENV"] = env_name
    return env_name


app = create_app(_resolve_env())


if __name__ == "__main__":
    # Check FLASK_DEBUG env var explicitly to override
    # If not set, default to False to avoid auto-reload issues
    explicit_debug = os.getenv("FLASK_DEBUG", "0").lower() in ("1", "true", "yes")
    app.run(host="0.0.0.0", port=8000, debug=explicit_debug, use_reloader=False)
