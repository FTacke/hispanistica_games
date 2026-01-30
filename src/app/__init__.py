"""Application factory for the games_hispanistica web app."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from flask import Flask, flash, jsonify, redirect, render_template, request, url_for
from werkzeug.middleware.proxy_fix import ProxyFix

from .extensions import register_extensions
from .routes import register_blueprints

# Import load_config from the config.py module (bypassing the config package)
from .config import load_config


def _verify_critical_dependencies() -> list[str]:
    """Verify critical dependencies are available. Returns list of errors."""
    errors = []

    # Check psycopg2 for PostgreSQL support
    try:
        import psycopg2

        logging.getLogger(__name__).debug(f"psycopg2 version: {psycopg2.__version__}")
    except ImportError as e:
        errors.append(f"psycopg2 not available: {e}. PostgreSQL support disabled.")

    # Check argon2-cffi for secure password hashing
    try:
        import argon2

        logging.getLogger(__name__).debug(f"argon2-cffi version: {argon2.__version__}")
    except ImportError as e:
        errors.append(
            f"argon2-cffi not available: {e}. Secure password hashing may be degraded."
        )

    # Check passlib argon2 backend
    try:
        from passlib.hash import argon2 as passlib_argon2

        # Verify it can actually hash (not just import)
        _ = passlib_argon2.hash("test")
        logging.getLogger(__name__).debug("passlib argon2 backend: OK")
    except Exception as e:
        errors.append(
            f"passlib argon2 backend unavailable: {e}. Will fall back to bcrypt."
        )

    return errors


def _verify_auth_db_connection(app: Flask, require_postgres: bool) -> None:
    """Verify auth database connection works. Raises exception on failure."""
    from sqlalchemy import text
    from .extensions.sqlalchemy_ext import get_engine

    engine = get_engine()
    if engine is None:
        raise RuntimeError("Auth engine not initialized")

    if require_postgres and engine.dialect.name != "postgresql":
        raise RuntimeError(
            "Auth DB must be PostgreSQL (sqlite not supported). Set AUTH_DATABASE_URL."
        )

    # Try a simple query
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    app.logger.info(f"Auth DB connection verified: {engine.url}")


def _verify_quiz_db_connection(app: Flask, require_postgres: bool) -> None:
    """Verify quiz database connection works. Raises exception on failure."""
    from sqlalchemy import text
    from .extensions.sqlalchemy_ext import get_quiz_engine

    engine = get_quiz_engine()
    if engine is None:
        raise RuntimeError("Quiz engine not initialized")

    if require_postgres and engine.dialect.name != "postgresql":
        raise RuntimeError(
            "Quiz DB must be PostgreSQL (sqlite not supported). Set QUIZ_DB_* or QUIZ_DATABASE_URL."
        )

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))

    app.logger.info(f"Quiz DB connection verified: {engine.url}")


def _verify_media_storage(app: Flask) -> None:
    """Verify media storage is writable and initialize required dirs.

    This fails fast in non-test environments if /app/media is not writable.
    """
    media_root = Path(app.config.get("MEDIA_DIR") or Path(__file__).resolve().parents[2] / "media")
    required_dirs = [
        media_root / "quiz",
        media_root / "releases",
    ]

    try:
        media_root.mkdir(parents=True, exist_ok=True)
        for required_dir in required_dirs:
            required_dir.mkdir(parents=True, exist_ok=True)

        test_file = media_root / f".rw_test_{uuid.uuid4().hex}"
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("ok")
            f.flush()
            os.fsync(f.fileno())
        test_file.unlink(missing_ok=True)
    except Exception as e:
        app.logger.error(
            "FATAL: Media storage is not writable. "
            f"media_root={media_root} error={e}"
        )
        raise RuntimeError(
            "Media storage not writable. Ensure /app/media is a read-write mount "
            "and required directories exist (quiz, releases)."
        ) from e


def create_app(env_name: str | None = None) -> Flask:
    """Create and configure the Flask application instance."""

    # Verify critical dependencies at startup
    dep_errors = _verify_critical_dependencies()
    if dep_errors:
        logger = logging.getLogger(__name__)
        for err in dep_errors:
            logger.warning(f"Dependency warning: {err}")

    project_root = Path(__file__).resolve().parents[2]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"

    app = Flask(
        __name__,
        instance_relative_config=True,
        template_folder=str(template_dir),
        static_folder=str(static_dir),
    )
    load_config(app, env_name)

    is_test_env = env_name == "test" or app.config.get("TESTING") is True
    if not is_test_env:
        _verify_media_storage(app)

    # Apply ProxyFix to correctly handle X-Forwarded-* headers from Nginx
    # This ensures url_for(_external=True) generates https:// URLs when behind HTTPS proxy
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

    # Initialize auth DB engine with fail-fast behavior in non-test envs
    from .extensions.sqlalchemy_ext import init_engine as init_auth_db
    from .extensions.sqlalchemy_ext import init_quiz_engine as init_quiz_db

    try:
        init_auth_db(app)
        _verify_auth_db_connection(app, require_postgres=not is_test_env)
    except Exception as e:
        if not is_test_env:
            app.logger.error(f"FATAL: Auth DB initialization failed: {e}")
            app.logger.error(
                "Non-test environments require a PostgreSQL auth database. Check AUTH_DATABASE_URL."
            )
            raise RuntimeError(f"Auth DB initialization failed: {e}") from e
        else:
            app.logger.warning(
                f"Auth DB not initialized in test: {e}. Some features may be unavailable."
            )

    try:
        init_quiz_db(app)
        _verify_quiz_db_connection(app, require_postgres=not is_test_env)
    except Exception as e:
        if not is_test_env:
            app.logger.error(f"FATAL: Quiz DB initialization failed: {e}")
            app.logger.error(
                "Production requires a working quiz database. Check QUIZ_DB_* or QUIZ_DATABASE_URL."
            )
            raise RuntimeError(f"Quiz DB initialization failed: {e}") from e
        else:
            app.logger.warning(
                f"Quiz DB not initialized: {e}. Quiz features may be unavailable."
            )

    # Add build ID for cache busting and deployment verification
    import time

    app.config["APP_BUILD_ID"] = time.strftime("%Y%m%d%H%M%S")

    # Store dependency check results for health endpoint
    app.config["_STARTUP_DEP_WARNINGS"] = dep_errors

    # Legacy env-based credential hydration removed. All auth now uses DB-backed flows.
    register_extensions(app)
    register_blueprints(app)
    register_context_processors(app)
    register_auth_context(app)
    register_security_headers(app)
    register_maintenance_commands(app)
    register_error_handlers(app)
    setup_logging(app)
    
    # Note: Quiz units auto-seeding has been moved to scripts/quiz_seed.py
    # and is now triggered by dev-start.ps1 before server start (DEV only)

    return app


def register_maintenance_commands(app: Flask) -> None:
    """Register maintenance CLI commands (anonymization, housekeeping)."""
    from flask.cli import with_appcontext

    @app.cli.command("auth-anonymize")
    @with_appcontext
    def auth_anonymize_command():
        """Anonymize soft-deleted accounts older than configured window.

        Usage: flask auth-anonymize
        """
        from .auth import services

        days = int(app.config.get("AUTH_ACCOUNT_ANONYMIZE_AFTER_DAYS", 30))
        count = services.anonymize_soft_deleted_users_older_than(days)
        app.logger.info(f"Anonymized {count} users soft-deleted older than {days} days")


def register_context_processors(app: Flask) -> None:
    """Expose helpers to the template engine."""

    @app.context_processor
    def inject_utilities():  # pragma: no cover - thin wrapper
        return {
            "now": datetime.utcnow,
            
        }


def register_auth_context(app: Flask) -> None:
    """Register before_request hook and context processor for authentication state.

    This enables server-side rendering of Login/Logout in Navbar/Drawer.
    Every request checks JWT cookies and exposes:
    - g.user: username (string) or None
    - g.role: Role enum or None
    - is_authenticated: bool (True if valid JWT present)
    - current_user: username string or None
    """
    from flask import g
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
    from .auth import Role

    @app.before_request
    def _set_auth_context():
        """Load auth state into g context for all requests."""
        # Public routes - skip JWT processing entirely
        PUBLIC_PREFIXES = (
            "/static/",
            "/favicon",
            "/robots.txt",
            "/health",
        )

        path = request.path

        # Skip JWT processing for static assets
        if any(path.startswith(p) for p in PUBLIC_PREFIXES):
            g.user = None
            g.role = None
            return

        # Try to verify JWT (optional - don't fail if no token)
        try:
            verify_jwt_in_request(optional=True, locations=["cookies"])
            identity = get_jwt_identity()
            token = get_jwt() or {}

            # Prefer exposing the human-friendly username to templates / g.user
            # The JWT identity is a stable user_id; additional claims include
            # the username. Use the username claim when present so templates
            # (e.g. top-app-bar) show readable names instead of internal IDs.
            g.user = token.get("username") or identity
            role_value = token.get("role")
            try:
                g.role = Role(role_value) if role_value else None
            except (ValueError, KeyError):
                g.role = None
            # Expose must_reset_password flag to request context
            g.must_reset_password = bool(token.get("must_reset_password", False))
        except Exception:  # noqa: BLE001
            # Token error - treat as no authentication
            g.user = None
            g.role = None

        # If the account requires a password reset, block access to other
        # routes until the user completes the password change.
        # Allowed routes include the password change page, reset APIs and
        # static assets so the user can complete the flow.
        allowed_prefixes = (
            "/static/",
            "/favicon",
            "/robots.txt",
            "/health",
            "/auth/account/password",
            "/auth/change-password",
            "/auth/reset-password",
            "/auth/password/reset",
            "/auth/password/forgot",
            "/auth/login",
            "/login",
            # NOTE: /auth/login_sheet removed - MD3 Goldstandard uses full-page login
            "/auth/logout_any",
        )

        if getattr(g, "user", None) and getattr(g, "must_reset_password", False):
            # allow only specific routes to proceed
            if not any(request.path.startswith(p) for p in allowed_prefixes):
                # For API/HTMX clients return a 403 with a specific code
                if request.headers.get("HX-Request") or request.is_json:
                    return jsonify({"error": "password_reset_required"}), 403
                # For standard HTML, redirect to the account password page
                return redirect(
                    url_for("auth.account_password_page") + "?mustReset=1", 303
                )

    @app.context_processor
    def _inject_auth_context():
        """Expose auth state to templates."""
        user = getattr(g, "user", None)
        must_reset = getattr(g, "must_reset_password", False)
        return {
            "is_authenticated": bool(user),
            "current_user": user,
            "must_reset_password": must_reset,
        }


def register_security_headers(app: Flask) -> None:
    """Add security headers to all responses."""

    @app.after_request
    def set_security_headers(response):
        """Set security headers on every response."""
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # XSS Protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer Policy - control information sent in Referer header
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HSTS - only in production
        if not app.debug:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        # Content Security Policy
        # Note: 'unsafe-inline' needed for current jQuery/DataTables implementation
        # TODO: Remove 'unsafe-inline' after jQuery migration
        csp = (
            "default-src 'self'; "
            # we removed 'unsafe-inline' for scripts after moving inline scripts to external files
            "script-src 'self' https://code.jquery.com https://cdn.jsdelivr.net "
            "https://cdn.datatables.net https://cdnjs.cloudflare.com https://unpkg.com; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.datatables.net "
            "https://cdnjs.cloudflare.com https://unpkg.com https://fonts.googleapis.com; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net "
            "https://fonts.googleapis.com https://fonts.gstatic.com; "
            "connect-src 'self'; "
            "media-src 'self' blob:; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp

        # Auth-specific caching rules for htmx compatibility
        if request.path.startswith("/auth/"):
            # Prevent caching of auth endpoints (login sheet, session check, etc.)
            response.headers["Cache-Control"] = "no-store, private"
            response.headers["Vary"] = "Cookie"

        return response


def register_error_handlers(app: Flask) -> None:
    """Register custom error handlers for common HTTP errors."""

    @app.errorhandler(400)
    def bad_request(error):
        """Handle 400 Bad Request errors."""
        app.logger.warning(f"Bad request: {error}")
        if request.path.startswith("/api/") :
            return jsonify({"error": "Bad request", "message": str(error)}), 400
        return render_template("errors/400.html", error=error), 400

    @app.errorhandler(401)
    def unauthorized(error):
        """Handle 401 Unauthorized errors - redirect to login for HTML requests."""
        app.logger.warning(
            f"Unauthorized access attempt: {request.path} from {request.remote_addr}"
        )

        # API requests get JSON response
        if request.path.startswith("/api/") :
            return jsonify({"error": "Unauthorized", "message": str(error)}), 401

        # AJAX/fetch requests get JSON response (check Accept header)
        if request.accept_mimetypes.best == "application/json":
            return jsonify({"error": "Unauthorized", "message": str(error)}), 401

        # HTML requests: save return URL and redirect to login
        from .routes.auth import save_return_url

        save_return_url()

        # Redirect to referrer (or home) with login dialog query parameter
        # Using query param instead of hash to avoid automatic scroll-to-anchor
        referrer = request.referrer or url_for("public.landing_page")
        flash("Bitte melden Sie sich an, um auf diesen Inhalt zuzugreifen.", "info")

        # Add ?showlogin=1 to URL (preserves scroll position)
        separator = "&" if "?" in referrer else "?"
        return redirect(f"{referrer}{separator}showlogin=1")

    @app.errorhandler(403)
    def forbidden(error):
        """Handle 403 Forbidden errors."""
        app.logger.warning(
            f"Forbidden access attempt: {request.path} from {request.remote_addr}"
        )
        if request.path.startswith("/api/") :
            return jsonify({"error": "Forbidden", "message": str(error)}), 403
        return render_template("errors/403.html", error=error), 403

    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 Not Found errors."""
        if request.path.startswith("/api/") :
            return jsonify({"error": "Not found", "message": str(error)}), 404
        return render_template("errors/404.html", error=error), 404

    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 Internal Server errors."""
        app.logger.error(f"Server Error: {error}", exc_info=True)
        if request.path.startswith("/api/") :
            return jsonify({"error": "Internal server error"}), 500
        return render_template("errors/500.html"), 500


def setup_logging(app: Flask) -> None:
    """Configure application logging."""
    if not app.debug:
        # Create logs directory
        log_dir = Path(__file__).resolve().parents[2] / "logs"
        log_dir.mkdir(exist_ok=True)

        # Setup rotating file handler
        file_handler = RotatingFileHandler(
            log_dir / "games_hispanistica.log",
            maxBytes=10_000_000,  # 10MB
            backupCount=5,
        )
        file_handler.setFormatter(
            logging.Formatter("[%(asctime)s] %(levelname)s in %(module)s: %(message)s")
        )
        file_handler.setLevel(logging.INFO)

        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info("games_hispanistica application startup")
