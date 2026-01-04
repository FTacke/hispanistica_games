"""Authentication endpoints."""

from __future__ import annotations


from flask import (
    Blueprint,
    Response,
    current_app,
    flash,
    g,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_jwt_extended import (
    get_jwt,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    unset_jwt_cookies,
    verify_jwt_in_request,
)

from ..auth import Role
from ..auth.decorators import require_role
from ..auth import services as auth_services
from ..extensions import limiter

blueprint = Blueprint("auth", __name__, url_prefix="/auth")

# Session key for storing intended destination after login
RETURN_URL_SESSION_KEY = "_return_url_after_login"


def save_return_url(url: str | None = None) -> None:
    """
    Save the current or specified URL for redirect after login.
    Called by protected routes when authentication is required.
    """
    if url is None:
        url = request.url

    # Don't save login/logout URLs or static assets
    if url and not any(x in url for x in ["/auth/", "/static/", "/health"]):
        session[RETURN_URL_SESSION_KEY] = url
        current_app.logger.debug(f"Saved return URL: {url}")


@blueprint.post("/save-redirect")
def save_redirect() -> Response:
    """
    API endpoint to save player redirect URL in server session.
    Called by JavaScript before opening login dialog.
    """
    data = request.get_json() or {}
    redirect_url = data.get("url", "").strip()

    if redirect_url and not any(
        x in redirect_url for x in ["/auth/", "/static/", "/health"]
    ):
        session[RETURN_URL_SESSION_KEY] = redirect_url
        current_app.logger.debug(f"Saved redirect URL via API: {redirect_url}")
        return jsonify({"success": True}), 200

    return jsonify({"success": False, "error": "Invalid URL"}), 400


@blueprint.get("/session")
def check_session() -> Response:
    """
    Check if user has valid auth session.
    Used by player to ensure cookies are set before loading data.
    Also returns token expiration for proactive refresh on client-side.

    ALWAYS returns 200 with JSON, regardless of token state.
    This is an "optional auth" endpoint that reports state without failing.

    Contract:
    - authenticated: bool (True if valid token present)
    - user: str|None (username if authenticated)
    - exp: int|None (Unix timestamp of token expiration)

    Response is always 200 OK, even if not authenticated.
    This prevents JWT error handlers from interfering and ensures
    consistent JSON responses (no HTML redirects).
    """
    try:
        # Manual token verification without decorator to avoid error handlers
        # Ensure we check cookies explicitly so fetch('/auth/session') inherits cookies
        verify_jwt_in_request(optional=True, locations=["cookies"])
        token = get_jwt() or {}
        sub = token.get("sub")
        exp = token.get("exp")

        resp = jsonify(
            {"authenticated": bool(sub), "user": sub if sub else None, "exp": exp}
        )
    except Exception as e:
        # Fallback for any token errors (expired, invalid, etc.)
        # Still return 200 with authenticated: false
        current_app.logger.debug(f"Session check fallback: {e}")
        resp = jsonify({"authenticated": False, "user": None, "exp": None})

    # Cache-Control headers as documented in auth-flow.md
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Vary"] = "Cookie"

    return resp, 200


# Environment-based credential hydration has been removed. All auth flows
# use the DB-backed implementation provided by src.app.auth.services.


def _safe_next(raw: str | None) -> str | None:
    """
    Validate and sanitize redirect URL to prevent open redirect vulnerabilities.

    Args:
        raw: URL from form, query param, or referrer (may be double-encoded)

    Returns:
        Safe path+query if valid, None otherwise

    Security rules:
    - Must be same origin (empty netloc or matches request.host)
    - Must not redirect to auth endpoints (login/logout)
    - Only path and query preserved, no scheme/netloc/fragment

    Note: Handles double-encoded URLs (used to preserve query strings through HTMX redirects).
    """
    from urllib.parse import urlparse, unquote

    if not raw:
        return None

    # Decode once (in case it's double-encoded from HTMX flow)
    decoded = unquote(raw)
    parsed = urlparse(decoded)

    # External origin → reject
    if parsed.netloc and parsed.netloc != request.host:
        return None

    # Auth endpoints and login page → reject (prevent redirect loops)
    if parsed.path.startswith(("/auth/login", "/auth/logout", "/login")):
        return None

    # Build safe path+query
    safe_url = parsed.path
    if parsed.query:
        safe_url += f"?{parsed.query}"

    return safe_url if safe_url else None


def _get_role_based_redirect(user) -> str:
    """
    Get the default redirect URL based on user role.

    Role-based mapping:
    - admin: User Management page (if exists)
    - All others: Landing page

    Args:
        user: The authenticated user object

    Returns:
        URL string for the appropriate landing page
    """
    # For now, redirect everyone to landing page
    return url_for("public.landing_page")


def _get_login_redirect_target(next_url: str | None, user) -> str:
    """
    Determine the redirect target after successful login.

    Logic:
    1. If next_url is provided and is NOT the index page (/):
       - Redirect to next_url (user came from a specific page)
    2. If next_url is None, empty, or is the index page:
       - Use default redirect (landing page)

    Args:
        next_url: The validated next URL from request, or None
        user: The authenticated user object

    Returns:
        The target URL for redirect
    """
    # Check if "from index" - next is None, empty, or root path
    is_from_index = not next_url or next_url in ("/", "")

    if is_from_index:
        # Use role-based default
        return _get_role_based_redirect(user)
    else:
        # User has a specific destination
        return next_url


# NOTE: login_sheet endpoint has been removed as part of MD3 Goldstandard migration.
# All authentication flows now use the full-page login at /login with ?next= parameter.
# See docs/md3-template/md3-structural-compliance.md section 6.2 for details.


@blueprint.get("/password/forgot")
def password_forgot_page() -> Response:
    """Render the password-forgot page (simple form)."""
    return render_template("auth/password_forgot.html"), 200


@blueprint.get("/password/reset")
def password_reset_page() -> Response:
    """Render the password-reset page (uses ?token=... query param)."""
    token = request.args.get("token") or ""
    return render_template("auth/password_reset.html", token=token), 200


@blueprint.get("/account/profile/page")
@jwt_required()
def account_profile_page() -> Response:
    user = None
    identity = get_jwt_identity()
    if identity:
        user = auth_services.find_user_by_username_or_email(identity)
    elif g.user:
        # Fallback to g.user if set by other means (e.g. session)
        user = auth_services.find_user_by_username_or_email(g.user)

    return render_template("auth/account_profile.html", user=user), 200


@blueprint.get("/account/password/page")
@jwt_required()
def account_password_page() -> Response:
    return render_template("auth/account_password.html"), 200


@blueprint.get("/account/delete/page")
@jwt_required()
def account_delete_page() -> Response:
    return render_template("auth/account_delete.html"), 200


@blueprint.get("/admin_users")
@jwt_required()
@require_role(Role.ADMIN)
def admin_users_page() -> Response:
    return render_template("auth/admin_users.html"), 200


@blueprint.get("/login", endpoint="login")
def login_form() -> Response:
    """
    GET /auth/login - Router für direktes Aufrufen.

    HTMX-Requests: 204 No Content + HX-Redirect zu login_sheet
    Full-Page: 303 zu Inicio mit ?login=1&next=...

    Zweck: Verhindert Full-Page-Login; triggert Sheet stattdessen.
    """
    next_url = _safe_next(request.args.get("next") or request.referrer)

    # HTMX & full-page behavior: redirect to the canonical full-page login
    # We prefer the root /login page as the canonical destination for user
    # driven login flows. The POST handler remains at /auth/login.
    target = (
        url_for("public.login", next=next_url) if next_url else url_for("public.login")
    )

    # Keep HTMX-friendly response (client will follow HX-Redirect)
    if request.headers.get("HX-Request"):
        response = make_response("", 204)
        response.headers["HX-Redirect"] = target
        return response

    return redirect(target, 303)


@blueprint.post("/login", endpoint="login_post")
@limiter.limit("5 per minute")
def login_post() -> Response:
    """
    Login endpoint (POST) - supports both HTMX and full-page.

    Rate limit ist deaktiviert in debug mode (siehe extensions.py DevFriendlyLimiter).

    Flow:
    1. POST /auth/login mit username+password+next
    2. Wenn erfolgreich:
       - HTMX: 204 No Content + HX-Redirect zum intended target
       - Full-page: 303 Redirect zum intended target
    3. Wenn fehler: Re-render full-page login with error messages
    """
    username = request.form.get("username", "").strip().lower()
    password = request.form.get("password", "")

    # Get next URL from form, query param, or referrer
    next_raw = (
        request.form.get("next")
        or request.args.get("next")
        or request.headers.get("Referer")
    )
    # Fallback: if the previous step saved a redirect in session, use it
    if not next_raw and RETURN_URL_SESSION_KEY in session:
        next_raw = session.pop(RETURN_URL_SESSION_KEY, None)
        current_app.logger.debug(
            f"Login POST using session RETURN_URL_SESSION_KEY: {next_raw}"
        )
    next_url = _safe_next(next_raw)

    # Resolve identifier and support JSON payloads
    identifier = username
    is_json_request = request.is_json
    if is_json_request:
        payload = request.get_json()
        identifier = (
            (payload.get("username") or payload.get("email") or "").strip().lower()
        )
        password = payload.get("password", "")

    # Helper to render full-page login with error (replaces old sheet rendering)
    def _render_login_error(status_code: int = 400, error_code: str = None) -> Response:
        """Render full-page login template with flashed error messages.
        For JSON requests, return JSON error response instead."""
        if is_json_request and error_code:
            return jsonify({"error": error_code}), status_code
        return render_template("auth/login.html", next=next_url or ""), status_code

    if not identifier:
        current_app.logger.warning(
            f"Failed login attempt - missing identifier from {request.remote_addr}"
        )
        # Friendly German message for missing identifier
        flash("Bitte geben Sie Benutzername oder E-Mail an.", "error")
        return _render_login_error(400)

    user = auth_services.find_user_by_username_or_email(identifier)
    if not user:
        current_app.logger.warning(
            f"Failed login attempt - unknown user: {identifier} from {request.remote_addr}"
        )
        # Generic German error message (avoid account enumeration)
        flash("Benutzername oder Passwort ist falsch.", "error")
        return _render_login_error(400)

    # check account status and password
    status = auth_services.check_account_status(user)
    if not status.ok:
        current_app.logger.warning(f"Login blocked for {identifier}: {status.code}")
        # Map status codes to user-friendly German messages
        error_messages = {
            "account_inactive": "Ihr Konto wurde deaktiviert. Bitte kontaktieren Sie den Administrator.",
            "account_deleted": "Dieses Konto existiert nicht mehr.",
            "account_not_yet_valid": "Ihr Konto ist noch nicht aktiv. Bitte versuchen Sie es später erneut.",
            "account_expired": "Ihr Zugang ist abgelaufen. Bitte kontaktieren Sie den Administrator.",
            "account_locked": "Ihr Konto ist vorübergehend gesperrt. Bitte versuchen Sie es später erneut.",
        }
        flash(
            error_messages.get(status.code, "Auf dieses Konto kann nicht zugegriffen werden."),
            "error",
        )
        return _render_login_error(403, error_code=status.code)

    if not auth_services.verify_password(password, user.password_hash):
        auth_services.on_failed_login(user)
        current_app.logger.warning(
            f"Failed login attempt - wrong password: {identifier} from {request.remote_addr}"
        )
        # Generic German error message for invalid credentials
        flash("Benutzername oder Passwort ist falsch.", "error")
        return _render_login_error(400)

    # Success: create tokens and set cookies
    auth_services.on_successful_login(user)
    access_token = auth_services.create_access_token_for_user(user)
    raw_refresh, _ = auth_services.create_refresh_token_for_user(
        user,
        user_agent=request.headers.get("User-Agent"),
        ip_address=request.remote_addr,
    )

    # If the account requires a forced password reset, redirect the client
    # to the account password page and keep mustReset indicator. The token
    # still includes must_reset_password so server-side checks may continue
    # to enforce this state.
    if user.must_reset_password:
        target = url_for("auth.account_password_page") + "?mustReset=1"
    else:
        # Determine target based on next_url or role-based default
        target = _get_login_redirect_target(next_url, user)

    # Flash success message for snackbar display on target page
    display_name = user.display_name or user.username
    flash(f"Erfolgreich angemeldet als {display_name}", "success")
    if request.headers.get("HX-Request"):
        response = make_response("", 204)
        response.headers["HX-Redirect"] = target
        set_access_cookies(response, access_token)
        response.set_cookie(
            "refreshToken",
            raw_refresh,
            max_age=int(current_app.config.get("REFRESH_TOKEN_EXP", 2592000)),
            httponly=True,
            secure=current_app.config.get("JWT_COOKIE_SECURE", True),
            samesite=current_app.config.get("JWT_COOKIE_SAMESITE", "Lax"),
            path="/auth/refresh",
        )
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        current_app.logger.info(
            f"Successful login (DB, HTMX): {identifier} from {request.remote_addr} -> {target}"
        )
        return response

    response = make_response(redirect(target, 303))
    set_access_cookies(response, access_token)
    response.set_cookie(
        "refreshToken",
        raw_refresh,
        max_age=int(current_app.config.get("REFRESH_TOKEN_EXP", 2592000)),
        httponly=True,
        secure=current_app.config.get("JWT_COOKIE_SECURE", True),
        samesite=current_app.config.get("JWT_COOKIE_SAMESITE", "Lax"),
        path="/auth/refresh",
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    current_app.logger.info(
        f"Successful login (DB): {identifier} from {request.remote_addr} -> {target}"
    )
    return response

    # Legacy env-based login support was removed. The route above already
    # performs DB-backed login and returns; any env-based auth branch was
    # intentionally removed to make DB the canonical backend.


@blueprint.post("/change-password")
@jwt_required()
def change_password() -> Response:
    # DB-backed auth is the only supported implementation in this branch.

    data = request.get_json() or request.form or {}
    old_pass = data.get("oldPassword")
    new_pass = data.get("newPassword")
    if not old_pass or not new_pass:
        return jsonify({"error": "missing_parameters"}), 400

    # Validate password strength
    is_valid, error = auth_services.validate_password_strength(new_pass)
    if not is_valid:
        return jsonify({"error": error}), 400

    # identify current user via JWT sub
    identity = get_jwt_identity()
    # attempt DB user lookup
    user = auth_services.get_user_by_id(identity) if identity else None
    if not user:
        # maybe identity is username
        user = auth_services.find_user_by_username_or_email(identity or "")
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    if not auth_services.verify_password(old_pass, user.password_hash):
        return jsonify({"error": "invalid_credentials"}), 401

    hashed = auth_services.hash_password(new_pass)
    auth_services.update_user_password(str(user.id), hashed)
    # Invalidate all refresh tokens
    auth_services.revoke_all_refresh_tokens_for_user(str(user.id))
    return jsonify({"ok": True}), 200


@blueprint.post("/reset-password/request")
@limiter.limit("5 per minute")
def reset_password_request() -> Response:
    # DB-backed flow only
    data = request.get_json() or request.form or {}
    identifier = (data.get("email") or data.get("username") or "").strip().lower()

    # Always respond 200 to avoid enumeration; DB-backed flow below

    user = auth_services.find_user_by_username_or_email(identifier)
    if not user:
        # don't reveal
        current_app.logger.info(
            "Password reset requested for unknown account %s", identifier
        )
        return jsonify({"ok": True}), 200

    raw, row = auth_services.create_reset_token_for_user(user)
    # send email (or log) with reset link — in dev we log it
    reset_link = url_for("auth.login", _external=True) + f"?reset={raw}"
    current_app.logger.info(f"Reset link for {user.username}: {reset_link}")
    return jsonify({"ok": True}), 200


@blueprint.post("/reset-password/confirm")
def reset_password_confirm() -> Response:
    data = request.get_json() or {}
    token = data.get("resetToken")
    new_password = data.get("newPassword")
    if not token or not new_password:
        return jsonify({"error": "missing_parameters"}), 400

    # Validate password strength
    is_valid, error = auth_services.validate_password_strength(new_password)
    if not is_valid:
        return jsonify({"error": error}), 400

    row, status = auth_services.verify_and_use_reset_token(token)
    if status != "ok":
        return jsonify({"error": status}), 400

    # update user's password
    user = auth_services.get_user_by_id(row.user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404
    new_hashed = auth_services.hash_password(new_password)
    auth_services.update_user_password(str(user.id), new_hashed)
    auth_services.revoke_all_refresh_tokens_for_user(str(user.id))
    return jsonify({"ok": True}), 200


@blueprint.get("/account/profile")
@jwt_required()
def account_profile_get() -> Response:
    # DB-backed flow only

    identity = get_jwt_identity()
    user = auth_services.get_user_by_id(
        identity
    ) or auth_services.find_user_by_username_or_email(identity)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    payload = {
        "username": user.username,
        "email": user.email,
        "display_name": getattr(user, "display_name", None),
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "is_active": bool(user.is_active),
        "access_expires_at": user.access_expires_at.isoformat()
        if user.access_expires_at
        else None,
        "valid_from": user.valid_from.isoformat() if user.valid_from else None,
    }
    return jsonify(payload), 200


@blueprint.patch("/account/profile")
@jwt_required()
def account_profile_patch() -> Response:
    # DB-backed flow only

    identity = get_jwt_identity()
    user = auth_services.get_user_by_id(
        identity
    ) or auth_services.find_user_by_username_or_email(identity)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    data = request.get_json() or {}
    # allowed fields: username, display_name, email
    username = data.get("username")
    display = data.get("display_name")
    email = data.get("email")
    # update using service helper, handle uniqueness / validation
    try:
        auth_services.update_user_profile(
            str(user.id), username=username, display_name=display, email=email
        )
    except ValueError as e:
        if str(e) == "username_exists":
            return jsonify(
                {
                    "error": "username_exists",
                    "message": "Benutzername bereits vergeben.",
                }
            ), 409
        raise
    return jsonify({"ok": True}), 200


@blueprint.post("/account/delete")
@jwt_required()
def account_delete() -> Response:
    # DB-backed flow only

    data = request.get_json() or {}
    password = data.get("password")
    identity = get_jwt_identity()
    user = auth_services.get_user_by_id(
        identity
    ) or auth_services.find_user_by_username_or_email(identity)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    # require re-auth via password
    if not password or not auth_services.verify_password(password, user.password_hash):
        return jsonify({"error": "invalid_credentials"}), 401

    auth_services.mark_user_deleted(str(user.id))

    auth_services.revoke_all_refresh_tokens_for_user(str(user.id))

    # schedule anonymization job externally (cron/worker); return accepted
    return jsonify({"accepted": True, "anonymization_in_days": 30}), 202


@blueprint.get("/account/data-export")
@jwt_required()
def account_data_export() -> Response:
    # DB-backed flow only

    identity = get_jwt_identity()
    user = auth_services.get_user_by_id(
        identity
    ) or auth_services.find_user_by_username_or_email(identity)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    # collect PII and audit info
    # Collect refresh token count via fresh session to avoid lazy-loading on a detached instance
    from ..auth.models import RefreshToken

    refresh_count = None
    with auth_services.get_session() as session:
        refresh_count = (
            session.query(RefreshToken)
            .filter(RefreshToken.user_id == str(user.id))
            .count()
        )

    payload = {
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": bool(user.is_active),
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat()
            if user.last_login_at
            else None,
        },
        "tokens": {
            # only show metadata (no token values)
            "refresh_token_count": refresh_count,
        },
    }
    return jsonify(payload), 200


def _next_url_after_logout() -> str:
    """Determine redirect target after logout.

    Logic:
    - Protected routes (/player, /editor, /admin) → Redirect to Inicio (/)
    - Public routes (/corpus, /search, /) → Stay on same page
    - External/invalid referrer → Fallback to Inicio

    Returns:
        Redirect URL (absolute or relative)
    """
    from urllib.parse import urlparse

    # Protected route prefixes
    PROTECTED_PATHS = ("/admin",)

    # Public route prefixes (can stay on page after logout)
    PUBLIC_PATHS = (
        "/projekt",
        "/quiz",
        "/impressum",
        "/privacy",
        "/",
    )

    # Get referrer from query param (explicit) or header (implicit)
    referrer = request.args.get("next") or request.headers.get("Referer")

    # No referrer or external origin → fallback to inicio
    if not referrer:
        return url_for("public.landing_page")

    # Parse referrer to check same-origin
    parsed = urlparse(referrer)
    if parsed.netloc and parsed.netloc != request.host:
        # External referrer → fallback to inicio
        return url_for("public.landing_page")

    # Extract path from referrer
    path = parsed.path

    # Protected route → redirect to inicio
    if any(path.startswith(p) for p in PROTECTED_PATHS):
        return url_for("public.landing_page")

    # Public route → stay on same page
    if any(path.startswith(p) for p in PUBLIC_PATHS):
        return referrer

    # Unknown route → fallback to inicio
    return url_for("public.landing_page")


@blueprint.route("/logout", methods=["GET", "POST"])
def logout_any() -> Response:
    """Logout endpoint (GET + POST) - clears JWT cookies and redirects.

    CRITICAL FIX (2025-11-11): Unified GET+POST endpoint, NO @jwt_required, NO CSRF.

    WHY NO CSRF?
    - Logout is idempotent (just clears cookies)
    - No sensitive data modified
    - No state change that could harm user
    - CSRF attack on logout = annoying, not dangerous

    WHY NO @jwt_required?
    - Must work even with expired/invalid tokens
    - Public endpoint that clears cookies unconditionally
    - Prevents JWT error handlers from intercepting

    Redirect logic: Smart (public → stay, protected → inicio)
    Cookies cleared: access_token_cookie, refresh_token_cookie
    """
    # For API/AJAX requests (POST), return JSON to avoid redirect issues in JS
    if request.method == "POST":
        response = jsonify({"msg": "logout successful"})
    else:
        # For browser navigation (GET), redirect
        redirect_to = _next_url_after_logout()
        response = make_response(redirect(redirect_to, 303))

    # Clear access token cookie (flask-jwt-extended)
    unset_jwt_cookies(response)

    # Revoke refresh token if present (DB-backed)
    raw = request.cookies.get("refreshToken")
    if raw:
        try:
            auth_services.revoke_refresh_token_by_raw(raw)
        except Exception:
            current_app.logger.exception("Failed to revoke refresh token during logout")
    # Clear refresh cookie manually
    response.delete_cookie("refreshToken", path="/auth/refresh")

    # Force browser to reload page after redirect
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    # Add a small UI flash (only relevant for browser GET flow) and audit log
    method = request.method
    if method != "POST":
        try:
            flash("Sie wurden erfolgreich abgemeldet.", "success")
        except Exception:
            # Running in contexts where flash is unavailable/undesired shouldn't break logout
            current_app.logger.debug("Flash unavailable while logging out (GET)")

    current_app.logger.info(
        f"User logged out via {method} from {request.remote_addr} -> {vars().get('redirect_to', 'N/A')}"
    )

    return response


@blueprint.post("/refresh")
def refresh() -> Response:
    """
    Refresh endpoint - issues new access token from valid refresh token.
    Called automatically by frontend when access token expires.
    No user interaction required.
    """
    # DB-backed flow: opaque refresh tokens in cookie and rotation

    # DB-backed flow: opaque refresh tokens in cookie and rotation
    raw = request.cookies.get("refreshToken")
    if not raw:
        return jsonify({"error": "missing_refresh_token"}), 401

    new_raw, new_row, status = auth_services.rotate_refresh_token(
        raw, request.headers.get("User-Agent"), request.remote_addr
    )
    if status == "invalid":
        return jsonify({"error": "invalid_refresh_token"}), 401
    if status == "expired":
        return jsonify({"error": "refresh_token_expired"}), 401
    if status == "reused":
        current_app.logger.warning(
            "Refresh token reuse detected: revoking all tokens for user"
        )
        return jsonify({"error": "refresh_token_reused"}), 403

    # success: load user & create access token
    if not new_row:
        return jsonify({"error": "internal_error"}), 500

    user = auth_services.get_user_by_id(new_row.user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    status = auth_services.check_account_status(user)
    if not status.ok:
        return jsonify({"error": status.code}), 403

    access_token = auth_services.create_access_token_for_user(user)
    response = jsonify({"msg": "Token refreshed successfully"})
    set_access_cookies(response, access_token)
    # set new refresh cookie
    response.set_cookie(
        "refreshToken",
        new_raw,
        max_age=int(current_app.config.get("REFRESH_TOKEN_EXP", 2592000)),
        httponly=True,
        secure=current_app.config.get("JWT_COOKIE_SECURE", True),
        samesite=current_app.config.get("JWT_COOKIE_SAMESITE", "Lax"),
        path="/auth/refresh",
    )
    current_app.logger.info(f"Token rotated and refreshed for user: {user.username}")
    return response


@blueprint.before_app_request
def load_user_dimensions():
    """Load user info from JWT into flask.g context.

    CRITICAL FIX (2025-11-11): Public routes bypass JWT processing entirely.

    Problem:
    - Global verify_jwt_in_request() triggered expired_token_loader even for public routes
    - Caused 401/302 redirects on /corpus/, /search/advanced when expired tokens present

    Solution:
    - Public routes skip JWT processing completely
    - Only protected routes (/admin) perform JWT verification
    - Prevents error handlers from blocking public access
    """
    # Public route prefixes - NO JWT processing
    PUBLIC_PREFIXES = (
        "/static/",
        "/favicon",
        "/robots.txt",
        "/health",
    )

    path = request.path
    current_app.logger.debug(
        f"[Auth.load_user_dimensions] Path: {path}; Public prefixes: {PUBLIC_PREFIXES}"
    )

    # Early return for public routes - skip JWT entirely
    if path.startswith(PUBLIC_PREFIXES):
        g.user = None
        g.role = None
        return

    # Protected routes: Standard JWT processing - verify JWT in cookies
    try:
        # Use cookie location explicitly to avoid header-only tokens in API tests
        verify_jwt_in_request(optional=True, locations=["cookies"])
        token = get_jwt() or {}
        g.user = token.get("sub")
        role_value = token.get("role")
        try:
            g.role = Role(role_value) if role_value else None
        except ValueError:
            g.role = None
    except Exception:  # noqa: BLE001
        # Silently ignore - treat as no token
        g.user = None
        g.role = None
        current_app.logger.debug(
            f"[Auth.load_user_dimensions] Token invalid or missing - g.user set to None for path {path}"
        )
    else:
        current_app.logger.debug(
            f"[Auth.load_user_dimensions] g.user set to {g.user} for path {path}"
        )
