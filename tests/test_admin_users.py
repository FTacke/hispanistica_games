import secrets
from datetime import datetime, timedelta, timezone

import pytest

from flask import Flask

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session
from src.app.auth.models import Base, User, ResetToken


@pytest.fixture
def client():
    app = Flask(__name__)
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["TESTING"] = True
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["SECRET_KEY"] = "test-secret"

    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints

    register_extensions(app)
    init_engine(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    register_blueprints(app)

    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


def create_user(username: str = "alice", role: str = "user") -> User:
    from src.app.auth import services

    with get_session() as session:
        u = User(
            id=str(secrets.token_hex(8)),
            username=username,
            email=f"{username}@example.org",
            password_hash=services.hash_password("password123"),
            role=role,
            is_active=True,
            must_reset_password=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(u)
    return u


def login_user(client, username="alice", password="password123"):
    resp = client.post("/auth/login", json={"username": username, "password": password})
    for s in resp.headers.getlist("Set-Cookie"):
        try:
            name = s.split("=", 1)[0]
            val = s.split("=", 1)[1].split(";", 1)[0]
            client.set_cookie(name, val, path="/")
        except Exception:
            continue
    try:
        from src.app.auth import services

        uobj = services.find_user_by_username_or_email(username)
        if uobj:
            tok = services.create_access_token_for_user(uobj)
            client.set_cookie("access_token_cookie", tok, path="/")
    except Exception:
        pass
    return resp


def make_admin_and_login(client, username="admin"):
    admin = create_user(username, role="admin")
    r = login_user(client, username)
    assert r.status_code in (200, 303, 204)
    return admin


def test_admin_list_and_get_detail(client):
    make_admin_and_login(client)
    # create some users
    u1 = create_user("u1")
    create_user("u2")

    r = client.get("/api/admin/users")
    assert r.status_code == 200
    assert "items" in r.json

    r2 = client.get(f"/api/admin/users/{u1.id}")
    assert r2.status_code == 200
    assert r2.json.get("username") == "u1"


def test_admin_create_invite_and_no_plaintext(client):
    make_admin_and_login(client)

    r = client.post(
        "/api/admin/users", json={"username": "invited", "email": "invite@example.org"}
    )
    assert r.status_code == 201
    assert r.json.get("inviteSent") is True

    # verify reset token exists in DB for created user
    uid = r.json.get("userId")
    with get_session() as session:
        user = session.query(User).filter(User.id == uid).first()
        assert user is not None
        # there should be a reset token for the user
        rt = session.query(ResetToken).filter(ResetToken.user_id == uid).first()
        assert rt is not None


def test_admin_create_invite_has_metadata(client):
    make_admin_and_login(client)
    r = client.post(
        "/api/admin/users", json={"username": "invited2", "email": "invite2@example.org"}
    )
    assert r.status_code == 201
    assert r.json.get("inviteSent") is True
    # response should include token id and expiry
    assert r.json.get("inviteId")
    assert r.json.get("inviteExpiresAt")
    # DB token should match
    uid = r.json.get("userId")
    with get_session() as session:
        rt = session.query(ResetToken).filter(ResetToken.user_id == uid).first()
        assert rt is not None
        assert rt.id == r.json.get("inviteId")


def test_admin_reset_returns_invite_link(client):
    make_admin_and_login(client)
    target = create_user("targ2")
    r = client.post(f"/api/admin/users/{target.id}/reset-password")
    assert r.status_code == 200
    # should contain invite link and metadata
    assert r.json.get("ok") is True
    assert r.json.get("inviteLink")
    assert r.json.get("inviteExpiresAt")


def test_admin_patch_lock_unlock_invalidate_delete(client):
    make_admin_and_login(client)
    target = create_user("targ")

    # patch role and must_reset
    p = client.patch(
        f"/api/admin/users/{target.id}",
        json={"role": "editor", "must_reset_password": True},
    )
    assert p.status_code == 200

    # admin reset password (should create reset token)
    r = client.post(f"/api/admin/users/{target.id}/reset-password")
    assert r.status_code == 200

    # lock user
    lock_resp = client.post(
        f"/api/admin/users/{target.id}/lock",
        json={"until": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()},
    )
    assert lock_resp.status_code == 200

    # unlock
    u = client.post(f"/api/admin/users/{target.id}/unlock")
    assert u.status_code == 200

    # create refresh token and then invalidate sessions
    from src.app.auth import services

    raw, rt = services.create_refresh_token_for_user(target)
    assert rt is not None
    inv = client.post(f"/api/admin/users/{target.id}/invalidate-sessions")
    assert inv.status_code == 200

    # delete (soft-delete)
    d = client.delete(f"/api/admin/users/{target.id}")
    assert d.status_code == 200

    with get_session() as session:
        t = session.query(User).filter(User.id == target.id).first()
        assert t.deleted_at is not None and t.deletion_requested_at is not None


def test_rbac_enforced_for_non_admin(client):
    # create non-admin and login
    create_user("normal", role="user")
    r = login_user(client, "normal")
    assert r.status_code in (200, 303, 204)

    # non-admin should be forbidden to access admin endpoints
    r = client.get("/api/admin/users")
    assert r.status_code in (401, 403)


def test_list_users_default_active_only(client):
    """Test that by default only active users are listed."""
    make_admin_and_login(client)

    # Create active and inactive users
    create_user("active_user", role="user")
    create_user("inactive_user", role="user")

    # Deactivate the inactive user
    with get_session() as session:
        u = session.query(User).filter(User.username == "inactive_user").first()
        u.is_active = False

    # Default list should only show active users
    r = client.get("/api/admin/users")
    assert r.status_code == 200
    usernames = [u["username"] for u in r.json["items"]]
    assert "active_user" in usernames
    assert "inactive_user" not in usernames


def test_list_users_with_include_inactive(client):
    """Test that include_inactive=1 shows all users."""
    make_admin_and_login(client)

    # Create active and inactive users
    create_user("active2", role="user")
    create_user("inactive2", role="user")

    # Deactivate the inactive user
    with get_session() as session:
        u = session.query(User).filter(User.username == "inactive2").first()
        u.is_active = False

    # With include_inactive, both should be visible
    r = client.get("/api/admin/users?include_inactive=1")
    assert r.status_code == 200
    usernames = [u["username"] for u in r.json["items"]]
    assert "active2" in usernames
    assert "inactive2" in usernames


def test_patch_user_email(client):
    """Test updating a user's email."""
    make_admin_and_login(client)
    target = create_user("target_email", role="user")

    # Update email
    r = client.patch(f"/api/admin/users/{target.id}", json={"email": "new@example.org"})
    assert r.status_code == 200
    assert r.json.get("ok") is True

    # Verify the update
    with get_session() as session:
        u = session.query(User).filter(User.id == target.id).first()
        assert u.email == "new@example.org"


def test_patch_user_invalid_email(client):
    """Test that invalid email format is rejected."""
    make_admin_and_login(client)
    target = create_user("target_email_invalid", role="user")

    # Try to set invalid email
    r = client.patch(f"/api/admin/users/{target.id}", json={"email": "not-an-email"})
    assert r.status_code == 400
    assert r.json.get("error") == "invalid_email"


def test_patch_user_invalid_role(client):
    """Test that invalid role is rejected."""
    make_admin_and_login(client)
    target = create_user("target_role_invalid", role="user")

    # Try to set invalid role
    r = client.patch(f"/api/admin/users/{target.id}", json={"role": "superadmin"})
    assert r.status_code == 400
    assert r.json.get("error") == "invalid_role"


def test_last_admin_protection_role_change(client):
    """Test that the last active admin cannot be demoted."""
    admin = make_admin_and_login(client)

    # Ensure admin is the only active admin
    # (the fixture creates only one admin)

    # Try to demote the last admin
    r = client.patch(f"/api/admin/users/{admin.id}", json={"role": "user"})
    assert r.status_code == 400
    assert r.json.get("error") == "last_admin"


def test_last_admin_protection_deactivate(client):
    """Test that the last active admin cannot be deactivated."""
    admin = make_admin_and_login(client)

    # Try to deactivate the last admin
    r = client.patch(f"/api/admin/users/{admin.id}", json={"is_active": False})
    assert r.status_code == 400
    assert r.json.get("error") == "last_admin"


def test_admin_can_be_demoted_if_others_exist(client):
    """Test that an admin can be demoted if other active admins exist."""
    admin = make_admin_and_login(client)

    # Create a second admin
    create_user("admin2", role="admin")

    # Now the first admin can be demoted
    r = client.patch(f"/api/admin/users/{admin.id}", json={"role": "editor"})
    assert r.status_code == 200
    assert r.json.get("ok") is True

    # Verify the change
    with get_session() as session:
        u = session.query(User).filter(User.id == admin.id).first()
        assert u.role == "editor"

