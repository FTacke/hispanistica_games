"""Register Flask extensions."""

from __future__ import annotations

from flask import Flask, jsonify, request
from flask_caching import Cache
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

jwt = JWTManager()

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["1000 per day", "200 per hour"],
    storage_uri="memory://",
    strategy="fixed-window",
)

# Cache configuration
# TODO: For production, use Redis: CACHE_TYPE='RedisCache', CACHE_REDIS_URL='redis://localhost:6379/0'
cache = Cache(
    config={
        "CACHE_TYPE": "SimpleCache",  # In-memory cache (dev/testing)
        "CACHE_DEFAULT_TIMEOUT": 300,  # 5 minutes default
    }
)


def register_extensions(app: Flask) -> None:
    """Attach Flask extensions to the app."""
    jwt.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)

    # Disable rate limiting in debug mode for easier testing
    if app.debug:
        limiter.enabled = False

    # Register JWT error handlers
    register_jwt_handlers()


def register_jwt_handlers() -> None:
    """Register JWT error handlers for expired/invalid tokens.

    CRITICAL: Flask-JWT-Extended calls these error handlers even for
    @jwt_required(optional=True) routes when expired tokens are present.

    SOLUTION: We treat /auth/ endpoints as API endpoints to ensure
    they always return JSON (never HTML redirects). This is especially
    important for /auth/session which must always return 200 JSON.

    Optional auth routes should handle their own token state without
    triggering these error handlers.
    """

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        """Handle expired JWT tokens.

        CRITICAL FIX (2025-11-11): Public routes should NEVER reach this handler.
        Early-return in load_user_dimensions() prevents JWT processing on public routes.

        This handler only triggers for PROTECTED routes with expired tokens.

        Returns machine-readable codes for client-side refresh logic:
        - access_expired: Access token expired, try refresh
        - refresh_expired: Refresh token expired, user must login again
        """
        # Safety check: Public (infra) routes should not reach here
        PUBLIC_PREFIXES = ("/static/", "/favicon", "/robots.txt", "/health")
        if request.path.startswith(PUBLIC_PREFIXES):
            # Fallback: return 200 for public routes (should not happen)
            return jsonify({"authenticated": False}), 200

        # Determine token type for appropriate error code
        token_type = jwt_payload.get("type", "access")
        error_code = "access_expired" if token_type == "access" else "refresh_expired"

        # API endpoints: Return JSON error with code
        if request.path.startswith("/api/"):
            return jsonify(
                {
                    "error": "token_expired",
                    "code": error_code,
                    "message": "The token has expired",
                }
            ), 401

        # AJAX/fetch requests: Return JSON error with code
        if request.accept_mimetypes.best == "application/json":
            return jsonify(
                {
                    "error": "token_expired",
                    "code": error_code,
                    "message": "The token has expired",
                }
            ), 401

        # HTML pages with mandatory auth: Redirect to login
        from flask import flash, redirect, url_for
        from ..routes.auth import save_return_url

        save_return_url()
        referrer = request.referrer or url_for("public.landing_page")
        try:
            flash("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", "info")
        except RuntimeError:
            # Session unavailable (e.g. tests without secret_key) - ignore flash
            pass

        # Add ?showlogin=1 to URL (preserves scroll position)
        separator = "&" if "?" in referrer else "?"
        return redirect(f"{referrer}{separator}showlogin=1")

    @jwt.invalid_token_loader
    def invalid_token_callback(error_string):
        """Handle invalid JWT tokens (malformed, wrong signature, etc.).

        CRITICAL FIX (2025-11-11): Public routes should NEVER reach this handler.

        Returns machine-readable code for client-side handling.
        """
        # Safety check: Public (infra) routes should not reach here
        PUBLIC_PREFIXES = ("/static/", "/favicon", "/robots.txt", "/health")
        if request.path.startswith(PUBLIC_PREFIXES):
            # Fallback: return 200 for public routes (should not happen)
            return jsonify({"authenticated": False}), 200

        # API endpoints: Return JSON error with code
        if request.path.startswith("/api/"):
            return jsonify(
                {
                    "error": "invalid_token",
                    "code": "invalid_token",
                    "message": error_string,
                }
            ), 401

        # AJAX/fetch requests: Return JSON error with code
        if request.accept_mimetypes.best == "application/json":
            return jsonify(
                {
                    "error": "invalid_token",
                    "code": "invalid_token",
                    "message": error_string,
                }
            ), 401

        # HTML pages: Redirect to login with message
        from flask import flash, redirect, url_for
        from ..routes.auth import save_return_url

        save_return_url()
        referrer = request.referrer or url_for("public.landing_page")
        try:
            flash("Ungültiger Token. Bitte melden Sie sich erneut an.", "info")
        except RuntimeError:
            pass

        # Add ?showlogin=1 to URL (preserves scroll position)
        separator = "&" if "?" in referrer else "?"
        return redirect(f"{referrer}{separator}showlogin=1")

    @jwt.unauthorized_loader
    def unauthorized_callback(error_string):
        """Handle requests without JWT token to @jwt_required() endpoints.

        Note: This is ONLY triggered by @jwt_required() (mandatory auth),
        NOT by @jwt_required(optional=True).

        CRITICAL FIX (2025-11-11): Public routes should NEVER have @jwt_required().

        Returns machine-readable code for client-side handling.
        """
        # Safety check: Public (infra) routes should never reach here
        PUBLIC_PREFIXES = ("/static/", "/favicon", "/robots.txt", "/health")
        if request.path.startswith(PUBLIC_PREFIXES):
            # Fallback: return 200 for public routes (should not happen)
            return jsonify({"authenticated": False}), 200

        # API endpoints: Return JSON error with code
        if request.path.startswith("/api/"):
            return jsonify(
                {
                    "error": "unauthorized",
                    "code": "unauthorized",
                    "message": error_string,
                }
            ), 401

        # AJAX/fetch requests expecting JSON: Return JSON error
        # IMPORTANT: Check Accept header BEFORE falling through to HTML redirect
        # This ensures /auth/account/profile API calls (with Accept: application/json)
        # get proper JSON errors, while /auth/account/profile/page gets HTML redirect
        if request.accept_mimetypes.best == "application/json":
            return jsonify(
                {
                    "error": "unauthorized",
                    "code": "unauthorized",
                    "message": error_string,
                }
            ), 401

        # For certain auth-related HTML pages we want to redirect the browser
        # to the login UI (not return JSON). These are server-rendered pages
        # under /auth/account/**/page and /auth/password/**/page.
        # Note: API routes like /auth/account/profile are handled above via Accept header
        if request.path.startswith("/auth/account") or request.path.startswith(
            "/auth/password"
        ):
            # fall through to HTML redirect behavior below
            pass

        # HTML pages: Save return URL and redirect to login
        from flask import flash, redirect, url_for
        from ..routes.auth import save_return_url

        save_return_url()
        referrer = request.referrer or url_for("public.landing_page")
        try:
            flash("Bitte melden Sie sich an, um auf diesen Inhalt zuzugreifen.", "info")
        except RuntimeError:
            pass

        # Add ?showlogin=1 to URL (preserves scroll position)
        separator = "&" if "?" in referrer else "?"
        return redirect(f"{referrer}{separator}showlogin=1")
