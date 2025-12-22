"""Admin API routes for user management."""

from __future__ import annotations

from flask import Blueprint, Response, jsonify, request, url_for
from flask_jwt_extended import jwt_required

from ..auth import Role
from ..auth.decorators import require_role
from ..auth import services as auth_services

blueprint = Blueprint("admin", __name__, url_prefix="/api/admin")


@blueprint.get("/users")
@jwt_required()
@require_role(Role.ADMIN)
def list_users() -> Response:
    """List all users with optional filtering.

    Query params:
        include_inactive: "1" to include inactive users
        q: Search query (username or email)

    Returns:
        200: {"items": [{"id": str, "username": str, "email": str, ...}]}
    """
    include_inactive = request.args.get("include_inactive") == "1"
    search_query = request.args.get("q", "").strip() or None

    try:
        users = auth_services.list_users(include_inactive, search_query)
        items = [
            {
                "id": str(u.id),
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "is_active": bool(u.is_active),
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat()
                if u.last_login_at
                else None,
            }
            for u in users
        ]
        return jsonify({"items": items}), 200
    except Exception as e:
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@blueprint.post("/users")
@jwt_required()
@require_role(Role.ADMIN)
def create_user() -> Response:
    """Create a new user.

    Body:
        username: str (required)
        email: str (optional)
        role: str (default "user", options: admin/editor/user)

    Returns:
        201: {"ok": true, "user": {...}, "inviteLink": str, "inviteExpiresAt": str}
        400: {"error": "missing_parameters"}
        409: {"error": "username_exists" | "email_exists"}
        500: {"error": "internal_error"}
    """
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip() or None
    role = data.get("role", "user")

    if not username:
        return jsonify({"error": "missing_parameters", "message": "Username ist erforderlich."}), 400

    try:
        user, reset_token = auth_services.create_user(
            username=username, email=email, role=role, generate_reset_token=True
        )

        # Build invite link
        invite_link = None
        invite_expires_at = None
        if reset_token:
            invite_link = url_for("auth.login", reset=reset_token, _external=True)
            # Query reset token expiration from DB
            token_row, _ = auth_services.verify_and_use_reset_token(reset_token)
            if token_row:
                # Rollback the "use" operation (we just wanted to read expiration)
                with auth_services.get_session() as session:
                    from ..auth.models import ResetToken
                    from sqlalchemy import select

                    stmt = select(ResetToken).where(
                        ResetToken.token_hash == auth_services._hash_refresh_token(reset_token)
                    )
                    rt = session.execute(stmt).scalars().first()
                    if rt:
                        rt.used_at = None  # Unmark as used
                        invite_expires_at = (
                            rt.expires_at.isoformat() if rt.expires_at else None
                        )

        return (
            jsonify(
                {
                    "ok": True,
                    "user": {
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email,
                        "role": user.role,
                    },
                    "inviteLink": invite_link,
                    "inviteExpiresAt": invite_expires_at,
                }
            ),
            201,
        )
    except ValueError as e:
        error_code = str(e)
        message_map = {
            "username_exists": "Benutzername bereits vergeben.",
            "email_exists": "E-Mail bereits vergeben.",
            "invalid_role": "Ungültige Rolle.",
        }
        message = message_map.get(error_code, error_code)
        return jsonify({"error": error_code, "message": message}), 409
    except Exception as e:
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@blueprint.get("/users/<user_id>")
@jwt_required()
@require_role(Role.ADMIN)
def get_user(user_id: str) -> Response:
    """Get user by ID.

    Returns:
        200: {"id": str, "username": str, "email": str, "role": str, "is_active": bool, ...}
        404: {"error": "user_not_found"}
    """
    user = auth_services.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    return (
        jsonify(
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": bool(user.is_active),
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login_at": user.last_login_at.isoformat()
                if user.last_login_at
                else None,
            }
        ),
        200,
    )


@blueprint.patch("/users/<user_id>")
@jwt_required()
@require_role(Role.ADMIN)
def update_user(user_id: str) -> Response:
    """Update user fields.

    Body:
        email: str (optional)
        role: str (optional, admin/editor/user)
        is_active: bool (optional)

    Returns:
        200: {"ok": true}
        404: {"error": "user_not_found"}
        409: {"error": "email_exists"}
        500: {"error": "internal_error"}
    """
    data = request.get_json() or {}
    email = data.get("email")
    role = data.get("role")
    is_active = data.get("is_active")

    try:
        auth_services.admin_update_user(
            user_id=user_id, email=email, role=role, is_active=is_active
        )
        return jsonify({"ok": True}), 200
    except KeyError:
        return jsonify({"error": "user_not_found"}), 404
    except ValueError as e:
        error_code = str(e)
        message_map = {
            "email_exists": "E-Mail bereits vergeben.",
            "invalid_role": "Ungültige Rolle.",
        }
        message = message_map.get(error_code, error_code)
        return jsonify({"error": error_code, "message": message}), 409
    except Exception as e:
        return jsonify({"error": "internal_error", "message": str(e)}), 500


@blueprint.post("/users/<user_id>/reset-password")
@jwt_required()
@require_role(Role.ADMIN)
def reset_user_password(user_id: str) -> Response:
    """Generate password reset token for a user.

    Returns:
        200: {"ok": true, "inviteLink": str, "inviteExpiresAt": str}
        404: {"error": "user_not_found"}
        500: {"error": "internal_error"}
    """
    user = auth_services.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "user_not_found"}), 404

    try:
        raw_token, token_row = auth_services.create_reset_token_for_user(user)
        invite_link = url_for("auth.login", reset=raw_token, _external=True)
        invite_expires_at = (
            token_row.expires_at.isoformat() if token_row.expires_at else None
        )

        return (
            jsonify(
                {
                    "ok": True,
                    "inviteLink": invite_link,
                    "inviteExpiresAt": invite_expires_at,
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"error": "internal_error", "message": str(e)}), 500
