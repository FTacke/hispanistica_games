"""Auth service helpers: hashing, token generation, token rotation, account checks.

Intended to be used by the DB-backed auth routes. Uses SQLAlchemy sessions
from extensions.sqlalchemy_ext.get_session.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from flask import current_app
from flask_jwt_extended import create_access_token
from passlib.hash import argon2, bcrypt
import bcrypt as _bcrypt_module  # fallback direct bcrypt usage when passlib backend behaves oddly
from sqlalchemy import select
from werkzeug.security import (
    check_password_hash,
)  # supports scrypt, pbkdf2_sha256, etc.

from ..extensions.sqlalchemy_ext import get_session
from .models import User, RefreshToken, ResetToken


# Type for account status
@dataclass
class AccountStatus:
    ok: bool
    code: Optional[str] = None
    message: Optional[str] = None


# Password hashing
def hash_password(plain: str) -> str:
    algo = current_app.config.get("AUTH_HASH_ALGO", "argon2")
    if algo == "argon2":
        # passlib argon2 uses reasonable defaults; we allow tuning via config
        return argon2.using(
            time_cost=current_app.config.get("AUTH_ARGON2_TIME_COST", 2),
            memory_cost=current_app.config.get("AUTH_ARGON2_MEMORY_COST", 102400),
            parallelism=current_app.config.get("AUTH_ARGON2_PARALLELISM", 4),
        ).hash(plain)
    else:
        # fallback to bcrypt
        # bcrypt (the underlying C library) has a 72-byte input limit; passlib tries to detect
        # features by hashing very long secrets which can raise a ValueError in some envs.
        # Truncate input to 72 bytes when using bcrypt and fall back to the bcrypt module
        # if passlib's handler raises an error.
        try:
            # try the passlib wrapper first (handles salt/cost config)
            return bcrypt.hash(plain)
        except Exception:
            # deterministic truncation to bcrypt's max 72 bytes (utf-8)
            b = plain.encode("utf-8")[:72]
            hashed = _bcrypt_module.hashpw(b, _bcrypt_module.gensalt())
            # bcrypt.hashpw returns bytes
            return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against a stored hash.

    Supports multiple hash formats:
    - Werkzeug (scrypt, pbkdf2_sha256) - used by generate_password_hash()
    - argon2 - modern algorithm
    - bcrypt - legacy but still common

    For development environments the runtime hashing backend may differ from
    whatever was available when a password hash was created (e.g. argon2
    backend missing). To make local logins resilient we attempt verification
    using multiple methods.
    """
    # Try Werkzeug first (handles scrypt:, pbkdf2:sha256:, etc.)
    # This is the most common format when using Flask/Werkzeug's generate_password_hash
    try:
        if check_password_hash(hashed, plain):
            return True
    except Exception:
        pass

    # Try argon2 (best/modern algorithm)
    try:
        if argon2.verify(plain, hashed):
            return True
    except Exception:
        pass

    # Try passlib bcrypt
    try:
        if bcrypt.verify(plain, hashed):
            return True
    except Exception:
        # passlib bcrypt failed — try low-level bcrypt.checkpw with truncation
        try:
            b = plain.encode("utf-8")[:72]
            return _bcrypt_module.checkpw(b, hashed.encode("utf-8"))
        except Exception:
            pass

    return False


# Password strength validation
def validate_password_strength(password: str) -> tuple[bool, str | None]:
    """Validate password meets minimum security requirements.

    Requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit

    Returns:
        Tuple of (is_valid, error_message)
    """
    import re

    if len(password) < 8:
        return False, "password_too_short"

    if not re.search(r"[A-Z]", password):
        return False, "password_missing_uppercase"

    if not re.search(r"[a-z]", password):
        return False, "password_missing_lowercase"

    if not re.search(r"\d", password):
        return False, "password_missing_digit"

    return True, None


# Access token creation
def create_access_token_for_user(user: User) -> str:
    expires_seconds = current_app.config.get("ACCESS_TOKEN_EXP", 900)
    expires_delta = timedelta(seconds=int(expires_seconds))
    claims = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "is_active": bool(user.is_active),
        "must_reset_password": bool(user.must_reset_password),
    }
    token = create_access_token(
        identity=str(user.id), additional_claims=claims, expires_delta=expires_delta
    )
    return token


# Refresh token handling
def _hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Return a timezone-aware datetime in UTC for naive datetimes (SQLite may return naive datetimes)."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def create_refresh_token_for_user(
    user: User, user_agent: Optional[str] = None, ip_address: Optional[str] = None
) -> Tuple[str, RefreshToken]:
    raw = secrets.token_urlsafe(64)
    token_hash = _hash_refresh_token(raw)
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=int(current_app.config.get("REFRESH_TOKEN_EXP", 2592000))
    )

    token_id = str(uuid.uuid4())
    rt = RefreshToken(
        token_id=token_id,
        user_id=str(user.id),
        token_hash=token_hash,
        created_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
    )

    with get_session() as session:
        session.add(rt)

    return raw, rt


def rotate_refresh_token(
    old_raw_token: str, user_agent: Optional[str], ip_address: Optional[str]
) -> Tuple[Optional[str], Optional[RefreshToken], str]:
    """Rotate an existing raw refresh token.

    Returns tuple (new_raw, new_model, status) where status is one of:
    - 'ok' (success)
    - 'invalid' (token not found/invalid)
    - 'expired' (token expired)
    - 'reused' (reuse detected)
    """
    # use module-level helper
    old_hash = _hash_refresh_token(old_raw_token)
    marker = f"rotating-{uuid.uuid4()}"
    now = datetime.now(timezone.utc)

    with get_session() as session:
        # Attempt to mark the row as rotating in a single atomic UPDATE so concurrent
        # rotations race against the DB and only one will win.
        update_count = (
            session.query(RefreshToken)
            .filter(
                RefreshToken.token_hash == old_hash,
                RefreshToken.replaced_by is None,
                RefreshToken.revoked_at is None,
                RefreshToken.expires_at >= now,
            )
            .update({RefreshToken.replaced_by: marker}, synchronize_session=False)
        )

        # If we couldn't mark the row, inspect why
        if update_count == 0:
            stmt = select(RefreshToken).where(RefreshToken.token_hash == old_hash)
            result = session.execute(stmt).scalars().first()
            if not result:
                return None, None, "invalid"
            token_row: RefreshToken = result

            if (
                _ensure_utc(token_row.expires_at) < datetime.now(timezone.utc)
                or token_row.revoked_at is not None
            ):
                return None, None, "expired"

            # If the token already had a replacement, treat as reuse
            if token_row.replaced_by is not None and token_row.replaced_by != marker:
                # detected reuse -> revoke all tokens for this user
                session.query(RefreshToken).filter(
                    RefreshToken.user_id == token_row.user_id
                ).update({RefreshToken.revoked_at: datetime.now(timezone.utc)})
                return None, None, "reused"

            # Fallback - unknown state
            return None, None, "invalid"

        # reload the token row we claimed
        stmt = select(RefreshToken).where(RefreshToken.token_hash == old_hash)
        token_row = session.execute(stmt).scalars().first()

        # create new token
        new_raw = secrets.token_urlsafe(64)
        new_hash = _hash_refresh_token(new_raw)
        new_id = str(uuid.uuid4())
        new_expires = datetime.now(timezone.utc) + timedelta(
            seconds=int(current_app.config.get("REFRESH_TOKEN_EXP", 2592000))
        )

        new_row = RefreshToken(
            token_id=new_id,
            user_id=token_row.user_id,
            token_hash=new_hash,
            created_at=datetime.now(timezone.utc),
            expires_at=new_expires,
            user_agent=user_agent,
            ip_address=ip_address,
            replaced_by=None,
        )

        # set replaced_by on old row and optionally set last_used_at
        token_row.replaced_by = new_id
        token_row.last_used_at = datetime.now(timezone.utc)

        session.add(new_row)

    return new_raw, new_row, "ok"


def revoke_all_refresh_tokens_for_user(user_id: str) -> None:
    with get_session() as session:
        session.query(RefreshToken).filter(
            RefreshToken.user_id == user_id, RefreshToken.revoked_at is None
        ).update({RefreshToken.revoked_at: datetime.now(timezone.utc)})


def revoke_refresh_token_by_raw(raw: str) -> bool:
    """Mark a single refresh token (by raw value) as revoked. Returns True if found."""
    h = _hash_refresh_token(raw)
    with get_session() as session:
        stmt = select(RefreshToken).where(RefreshToken.token_hash == h)
        r = session.execute(stmt).scalars().first()
        if not r:
            return False
        r.revoked_at = datetime.now(timezone.utc)
        return True


def anonymize_user(user_id: str) -> None:
    """Anonymize a soft-deleted user by removing PII and marking fields anonymous.

    This function implements the post-deletion pseudonymization step (e.g.
    after the configured retention window). It replaces username/email with a
    non-reversible placeholder and clears user-identifying fields.
    """
    with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        user = session.execute(stmt).scalars().first()
        if not user:
            raise KeyError("user_not_found")

        # ensure user was already soft-deleted
        if not user.deleted_at:
            raise ValueError("user_not_deleted")

        placeholder = f"deleted-{user_id}"
        user.username = placeholder
        user.email = f"{placeholder}@example.invalid"
        user.display_name = None
        # invalidate password (store a random hash)
        user.password_hash = hash_password(secrets.token_urlsafe(32))
        user.is_active = False
        # clear last login info
        user.last_login_at = None

        # revoke refresh/reset tokens for user
        session.query(RefreshToken).filter(RefreshToken.user_id == user_id).update(
            {RefreshToken.revoked_at: datetime.now(timezone.utc)}
        )
        session.query(ResetToken).filter(ResetToken.user_id == user_id).update(
            {ResetToken.used_at: datetime.now(timezone.utc)}
        )


def anonymize_soft_deleted_users_older_than(days: int) -> int:
    """Anonymize all users that were soft-deleted at least `days` days ago.

    Returns the number of users anonymized.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=int(days))
    anonymized = 0
    with get_session() as session:
        stmt = select(User).where(
            User.deleted_at is not None, User.deleted_at <= cutoff
        )
        rows = session.execute(stmt).scalars().all()
        for u in rows:
            anonymize_user(str(u.id))
            anonymized += 1
    return anonymized


# Account check
def check_account_status(user: User) -> AccountStatus:
    now = datetime.now(timezone.utc)
    if not user.is_active:
        return AccountStatus(False, "account_inactive", "Account is not active")
    if user.deleted_at is not None:
        return AccountStatus(False, "account_deleted", "Account deleted")
    if user.valid_from and _ensure_utc(user.valid_from) > now:
        return AccountStatus(False, "account_not_yet_valid", "Account is not valid yet")
    if user.access_expires_at and _ensure_utc(user.access_expires_at) < now:
        return AccountStatus(False, "account_expired", "Account access expired")
    if user.locked_until and _ensure_utc(user.locked_until) > now:
        return AccountStatus(False, "account_locked", "Account temporarily locked")
    return AccountStatus(True)


# Helper: lookup user by username/email
def find_user_by_username_or_email(identifier: str) -> Optional[User]:
    with get_session() as session:
        stmt = select(User).where(User.username == identifier.lower())
        user = session.execute(stmt).scalars().first()
        if user:
            return user
        stmt2 = select(User).where(User.email == identifier.lower())
        return session.execute(stmt2).scalars().first()


def get_user_by_id(user_id: str) -> Optional[User]:
    with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        return session.execute(stmt).scalars().first()


def update_user_password(user_id: str, new_hashed: str) -> None:
    with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        user = session.execute(stmt).scalars().first()
        if not user:
            raise KeyError("user_not_found")
        user.password_hash = new_hashed
        user.must_reset_password = False


def update_user_profile(
    user_id: str,
    username: Optional[str] = None,
    display_name: Optional[str] = None,
    email: Optional[str] = None,
) -> None:
    with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        user = session.execute(stmt).scalars().first()
        if not user:
            raise KeyError("user_not_found")
        # username update (if provided) — ensure uniqueness
        if username is not None:
            new_u = username.strip().lower()
            if new_u and new_u != user.username:
                # check whether another user already uses this username
                stmt2 = select(User).where(User.username == new_u)
                existing = session.execute(stmt2).scalars().first()
                if existing:
                    raise ValueError("username_exists")
                user.username = new_u
        if display_name is not None:
            setattr(user, "display_name", display_name)
        if email is not None:
            user.email = email.lower()


def mark_user_deleted(user_id: str) -> None:
    with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        user = session.execute(stmt).scalars().first()
        if not user:
            raise KeyError("user_not_found")
        user.deletion_requested_at = datetime.now(timezone.utc)
        user.deleted_at = datetime.now(timezone.utc)
        user.is_active = False


def create_reset_token_for_user(user: User) -> Tuple[str, ResetToken]:
    """Create a reset token for a user.

    Expiration is configurable via the Flask config key
    'AUTH_RESET_TOKEN_EXP_DAYS' (default: 7 days).
    Returns the raw token string and the created ResetToken row.
    """
    raw = secrets.token_urlsafe(48)
    token_hash = _hash_refresh_token(raw)
    rid = str(uuid.uuid4())
    # Default to 7 days unless overridden in app config
    days = int(current_app.config.get("AUTH_RESET_TOKEN_EXP_DAYS", 7))
    expires_at = datetime.now(timezone.utc) + timedelta(days=days)
    rt = ResetToken(
        id=rid,
        user_id=str(user.id),
        token_hash=token_hash,
        created_at=datetime.now(timezone.utc),
        expires_at=expires_at,
    )
    with get_session() as session:
        session.add(rt)
    return raw, rt


def verify_and_use_reset_token(raw: str) -> Tuple[Optional[ResetToken], str]:
    """Verify reset token and mark used if valid. Returns (row, status)."""
    h = _hash_refresh_token(raw)
    with get_session() as session:
        stmt = select(ResetToken).where(ResetToken.token_hash == h)
        r = session.execute(stmt).scalars().first()
        if not r:
            return None, "invalid"
        if r.used_at is not None:
            return None, "used"
        if _ensure_utc(r.expires_at) < datetime.now(timezone.utc):
            return None, "expired"
        r.used_at = datetime.now(timezone.utc)
        return r, "ok"


# Helper to mark login success/failure
def on_successful_login(user: User) -> None:
    with get_session() as session:
        stmt = select(User).where(User.id == user.id)
        dbu = session.execute(stmt).scalars().first()
        if dbu:
            dbu.login_failed_count = 0
            dbu.locked_until = None
            dbu.last_login_at = datetime.now(timezone.utc)


def on_failed_login(user: Optional[User]) -> None:
    if user is None:
        return
    with get_session() as session:
        stmt = select(User).where(User.id == user.id)
        dbu = session.execute(stmt).scalars().first()
        if dbu:
            dbu.login_failed_count = (dbu.login_failed_count or 0) + 1
            # Lockout policy: 5 failed attempts -> lock for 10 minutes
            if dbu.login_failed_count >= 5:
                dbu.locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
