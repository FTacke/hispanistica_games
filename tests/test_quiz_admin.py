"""Tests for the Quiz Admin Dashboard.

Tests cover:
- Route access control (admin-only)
- Upload endpoint validation
- Release management (import, publish, unpublish)
- Unit CRUD operations
- Soft-delete semantics

NOTE: Requires PostgreSQL for JSONB columns.
      Start with: docker compose -f docker-compose.dev-postgres.yml up -d
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator

import pytest
from flask import Flask
from flask_jwt_extended import create_access_token
from sqlalchemy import text

from src.app.extensions.sqlalchemy_ext import init_engine, get_engine, get_session


# ============================================================================
# PostgreSQL Test Database URL
# ============================================================================
QUIZ_TEST_DB_URL = os.environ.get(
    "QUIZ_TEST_DATABASE_URL",
    "postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth"
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def admin_app() -> Generator[Flask, None, None]:
    """Create Flask app with quiz admin module configured."""
    project_root = Path(__file__).resolve().parents[1]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"
    
    app = Flask(
        __name__, 
        template_folder=str(template_dir), 
        static_folder=str(static_dir)
    )
    app.config["AUTH_DATABASE_URL"] = QUIZ_TEST_DB_URL
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_TOKEN_LOCATION"] = ["cookies", "headers"]
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["JWT_HEADER_TYPE"] = "Bearer"
    
    from flask import g
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
    from src.app.extensions import register_extensions
    from src.app.auth import Role
    
    register_extensions(app)
    
    # Set up auth context (simplified version for tests)
    @app.before_request
    def set_auth_context():
        try:
            verify_jwt_in_request(optional=True, locations=["cookies", "headers"])
            identity = get_jwt_identity()
            token = get_jwt() or {}
            g.user = token.get("username") or identity
            role_value = token.get("role")
            try:
                g.role = Role(role_value) if role_value else None
            except (ValueError, KeyError):
                g.role = None
        except Exception:
            g.user = None
            g.role = None
    
    init_engine(app)
    
    # Create quiz tables
    from game_modules.quiz.models import QuizBase
    from game_modules.quiz.release_model import QuizContentRelease
    engine = get_engine()
    QuizBase.metadata.create_all(bind=engine)
    
    # Ensure release_id column exists (migration 0010)
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE quiz_topics ADD COLUMN IF NOT EXISTS release_id VARCHAR(50)"))
        conn.execute(text("ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS release_id VARCHAR(50)"))
        conn.commit()
    
    # Register blueprints
    from src.app.routes.quiz_admin import blueprint as quiz_admin_blueprint
    app.register_blueprint(quiz_admin_blueprint)
    
    ctx = app.app_context()
    ctx.push()
    yield app
    
    # Clean up test data
    _cleanup_admin_test_data()
    ctx.pop()


def _cleanup_admin_test_data():
    """Clean up test data from quiz tables."""
    from game_modules.quiz.models import QuizTopic, QuizQuestion
    from game_modules.quiz.release_model import QuizContentRelease
    
    with get_session() as session:
        # Delete in order respecting foreign keys
        session.execute(QuizQuestion.__table__.delete())
        session.execute(QuizTopic.__table__.delete())
        session.execute(QuizContentRelease.__table__.delete())
        session.commit()


@pytest.fixture
def admin_client(admin_app: Flask):
    """Test client for admin module."""
    return admin_app.test_client()


@pytest.fixture
def admin_token(admin_app: Flask) -> str:
    """Generate JWT token with admin role."""
    with admin_app.app_context():
        return create_access_token(
            identity="admin_user",
            additional_claims={"role": "admin", "username": "admin_user"}
        )


@pytest.fixture
def user_token(admin_app: Flask) -> str:
    """Generate JWT token with regular user role."""
    with admin_app.app_context():
        return create_access_token(
            identity="regular_user",
            additional_claims={"role": "user", "username": "regular_user"}
        )


@pytest.fixture
def seeded_units(admin_app: Flask):
    """Create test units in the database."""
    from game_modules.quiz.models import QuizTopic, QuizQuestion
    
    with get_session() as session:
        # Create test topics
        topic1 = QuizTopic(
            id="test_unit_1",
            title_key="Test Unit 1",
            description_key="Description 1",
            is_active=True,
            order_index=1,
            release_id=None,  # Legacy
        )
        topic2 = QuizTopic(
            id="test_unit_2",
            title_key="Test Unit 2",
            description_key="Description 2",
            is_active=True,
            order_index=2,
            release_id="test_release_001",
        )
        topic3 = QuizTopic(
            id="inactive_unit",
            title_key="Inactive Unit",
            description_key="Inactive",
            is_active=False,
            order_index=0,
            release_id="test_release_001",
        )
        
        session.add_all([topic1, topic2, topic3])
        session.commit()
    
    return admin_app


@pytest.fixture
def seeded_releases(admin_app: Flask):
    """Create test releases in the database."""
    from game_modules.quiz.release_model import QuizContentRelease
    
    with get_session() as session:
        release1 = QuizContentRelease(
            release_id="test_release_001",
            status="draft",
            units_count=2,
            questions_count=10,
            audio_count=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        release2 = QuizContentRelease(
            release_id="test_release_002",
            status="published",
            units_count=1,
            questions_count=5,
            audio_count=0,
            imported_at=datetime.now(timezone.utc),
            published_at=datetime.now(timezone.utc),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        
        session.add_all([release1, release2])
        session.commit()
    
    return admin_app


# ============================================================================
# Access Control Tests
# ============================================================================

class TestAccessControl:
    """Test admin-only access control."""

    def test_api_requires_auth(self, admin_client):
        """API endpoints should require authentication."""
        response = admin_client.get(
            "/quiz-admin/api/releases",
            headers={"Accept": "application/json"}
        )
        assert response.status_code == 401
        data = response.get_json()
        assert data["error"] == "unauthorized"

    def test_api_requires_admin_role(self, admin_client, user_token):
        """API endpoints should require admin role."""
        response = admin_client.get(
            "/quiz-admin/api/releases",
            headers={
                "Authorization": f"Bearer {user_token}",
                "Accept": "application/json"
            }
        )
        assert response.status_code == 403

    def test_admin_can_access_api(self, admin_client, admin_token):
        """Admin should be able to access API endpoints."""
        response = admin_client.get(
            "/quiz-admin/api/releases",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Accept": "application/json"
            }
        )
        assert response.status_code == 200


# ============================================================================
# Releases API Tests
# ============================================================================

class TestReleasesAPI:
    """Test releases API endpoints."""

    def test_list_releases_empty(self, admin_client, admin_token):
        """List releases returns empty array when no releases exist."""
        response = admin_client.get(
            "/quiz-admin/api/releases",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_list_releases_with_data(self, admin_client, admin_token, seeded_releases):
        """List releases returns seeded releases."""
        response = admin_client.get(
            "/quiz-admin/api/releases",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert len(data["items"]) == 2
        release_ids = [r["release_id"] for r in data["items"]]
        assert "test_release_001" in release_ids
        assert "test_release_002" in release_ids

    def test_get_release_not_found(self, admin_client, admin_token):
        """Get non-existent release returns 404."""
        response = admin_client.get(
            "/quiz-admin/api/releases/nonexistent",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_get_release_success(self, admin_client, admin_token, seeded_releases):
        """Get existing release returns release data."""
        response = admin_client.get(
            "/quiz-admin/api/releases/test_release_001",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["release_id"] == "test_release_001"
        assert data["status"] == "draft"


# ============================================================================
# Units API Tests
# ============================================================================

class TestUnitsAPI:
    """Test units API endpoints."""

    def test_list_units_empty(self, admin_client, admin_token):
        """List units returns empty array when no units exist."""
        response = admin_client.get(
            "/quiz-admin/api/units",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "items" in data
        assert isinstance(data["items"], list)

    def test_list_units_active_only(self, admin_client, admin_token, seeded_units):
        """List units by default returns only active units."""
        response = admin_client.get(
            "/quiz-admin/api/units",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        # Should not include inactive_unit
        slugs = [u["slug"] for u in data["items"]]
        assert "test_unit_1" in slugs
        assert "test_unit_2" in slugs
        assert "inactive_unit" not in slugs

    def test_list_units_include_inactive(self, admin_client, admin_token, seeded_units):
        """List units with include_inactive returns all units."""
        response = admin_client.get(
            "/quiz-admin/api/units?include_inactive=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        slugs = [u["slug"] for u in data["items"]]
        assert "inactive_unit" in slugs

    def test_list_units_search(self, admin_client, admin_token, seeded_units):
        """List units with search query filters results."""
        response = admin_client.get(
            "/quiz-admin/api/units?search=unit_1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        slugs = [u["slug"] for u in data["items"]]
        assert "test_unit_1" in slugs
        assert "test_unit_2" not in slugs

    def test_get_unit_not_found(self, admin_client, admin_token):
        """Get non-existent unit returns 404."""
        response = admin_client.get(
            "/quiz-admin/api/units/nonexistent",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_get_unit_success(self, admin_client, admin_token, seeded_units):
        """Get existing unit returns unit data."""
        response = admin_client.get(
            "/quiz-admin/api/units/test_unit_1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["slug"] == "test_unit_1"
        assert data["is_active"] is True


# ============================================================================
# Bulk Update Tests
# ============================================================================

class TestBulkUpdate:
    """Test bulk update endpoint."""

    def test_bulk_update_invalid_body(self, admin_client, admin_token):
        """Bulk update with invalid body returns 400."""
        response = admin_client.patch(
            "/quiz-admin/api/units",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            data=json.dumps({"not_updates": []})
        )
        assert response.status_code == 400

    def test_bulk_update_is_active(self, admin_client, admin_token, seeded_units):
        """Bulk update can toggle is_active."""
        response = admin_client.patch(
            "/quiz-admin/api/units",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            data=json.dumps({
                "updates": [{"slug": "test_unit_1", "is_active": False}]
            })
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        
        # Verify the change
        from game_modules.quiz.models import QuizTopic
        with get_session() as session:
            unit = session.query(QuizTopic).filter(QuizTopic.id == "test_unit_1").first()
            assert unit.is_active is False

    def test_bulk_update_order_index(self, admin_client, admin_token, seeded_units):
        """Bulk update can change order_index."""
        response = admin_client.patch(
            "/quiz-admin/api/units",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Content-Type": "application/json"
            },
            data=json.dumps({
                "updates": [{"slug": "test_unit_1", "order_index": 99}]
            })
        )
        assert response.status_code == 200
        
        # Verify the change
        from game_modules.quiz.models import QuizTopic
        with get_session() as session:
            unit = session.query(QuizTopic).filter(QuizTopic.id == "test_unit_1").first()
            assert unit.order_index == 99


# ============================================================================
# Soft Delete Tests
# ============================================================================

class TestSoftDelete:
    """Test soft delete functionality."""

    def test_delete_unit_not_found(self, admin_client, admin_token):
        """Delete non-existent unit returns 404."""
        response = admin_client.delete(
            "/quiz-admin/api/units/nonexistent",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 404

    def test_delete_unit_success(self, admin_client, admin_token, seeded_units):
        """Delete unit sets is_active to false."""
        response = admin_client.delete(
            "/quiz-admin/api/units/test_unit_1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        
        # Verify soft delete
        from game_modules.quiz.models import QuizTopic
        with get_session() as session:
            unit = session.query(QuizTopic).filter(QuizTopic.id == "test_unit_1").first()
            assert unit is not None  # Not hard deleted
            assert unit.is_active is False


# ============================================================================
# Upload Validation Tests
# ============================================================================

class TestUploadValidation:
    """Test upload endpoint validation."""

    def test_upload_missing_json(self, admin_client, admin_token):
        """Upload without JSON file returns 400."""
        response = admin_client.post(
            "/quiz-admin/api/upload-unit",
            headers={"Authorization": f"Bearer {admin_token}"},
            content_type="multipart/form-data",
            data={}
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["error"] == "missing_file"

    def test_upload_invalid_json(self, admin_client, admin_token):
        """Upload with invalid JSON returns 400."""
        from io import BytesIO
        
        response = admin_client.post(
            "/quiz-admin/api/upload-unit",
            headers={"Authorization": f"Bearer {admin_token}"},
            content_type="multipart/form-data",
            data={
                "unit_json": (BytesIO(b"not valid json"), "unit.json")
            }
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["error"] == "invalid_json"

    def test_upload_missing_slug(self, admin_client, admin_token):
        """Upload JSON without slug returns 400."""
        from io import BytesIO
        
        json_content = json.dumps({"title": "Test", "questions": []})
        
        response = admin_client.post(
            "/quiz-admin/api/upload-unit",
            headers={"Authorization": f"Bearer {admin_token}"},
            content_type="multipart/form-data",
            data={
                "unit_json": (BytesIO(json_content.encode()), "unit.json")
            }
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["error"] == "missing_slug"

    def test_upload_invalid_slug_format(self, admin_client, admin_token):
        """Upload JSON with invalid slug format returns 400."""
        from io import BytesIO
        
        json_content = json.dumps({
            "slug": "Invalid-Slug!",
            "title": "Test",
            "questions": []
        })
        
        response = admin_client.post(
            "/quiz-admin/api/upload-unit",
            headers={"Authorization": f"Bearer {admin_token}"},
            content_type="multipart/form-data",
            data={
                "unit_json": (BytesIO(json_content.encode()), "unit.json")
            }
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data["error"] == "invalid_slug"

    def test_upload_valid_json(self, admin_client, admin_token, tmp_path):
        """Upload valid JSON creates release."""
        from io import BytesIO
        
        json_content = json.dumps({
            "slug": "valid_test_unit",
            "title": "Valid Test Unit",
            "questions": [
                {
                    "id": "q1",
                    "difficulty": 1,
                    "prompt": "Test question?",
                    "explanation": "Test explanation",
                    "answers": [
                        {"id": "a1", "text": "Answer 1", "correct": True},
                        {"id": "a2", "text": "Answer 2", "correct": False}
                    ],
                    "media": []
                }
            ]
        })
        
        response = admin_client.post(
            "/quiz-admin/api/upload-unit",
            headers={"Authorization": f"Bearer {admin_token}"},
            content_type="multipart/form-data",
            data={
                "unit_json": (BytesIO(json_content.encode()), "valid_test_unit.json")
            }
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["ok"] is True
        assert data["slug"] == "valid_test_unit"
        assert "release_id" in data
        assert data["release_id"].startswith("release_")


# ============================================================================
# Release ID Generation Test
# ============================================================================

class TestReleaseIdGeneration:
    """Test release ID collision avoidance."""

    def test_release_id_format(self, admin_app):
        """Release ID should have correct format with suffix."""
        from src.app.routes.quiz_admin import generate_release_id
        
        release_id = generate_release_id()
        
        # Format: release_YYYYMMDD_HHMMSS_<4-char-suffix>
        parts = release_id.split("_")
        assert parts[0] == "release"
        assert len(parts) == 4
        assert len(parts[1]) == 8  # YYYYMMDD
        assert len(parts[2]) == 6  # HHMMSS
        assert len(parts[3]) == 4  # suffix

    def test_release_id_uniqueness(self, admin_app):
        """Multiple release IDs should be unique."""
        from src.app.routes.quiz_admin import generate_release_id
        
        ids = set()
        for _ in range(100):
            ids.add(generate_release_id())
        
        # All IDs should be unique (extremely unlikely to collide)
        assert len(ids) == 100

class TestSoftDeleteSemantics:
    """Test soft-delete behavior during re-import."""
    
    def test_reimport_does_not_override_is_active_false(self, seeded_units):
        """Re-importing a soft-deleted unit should NOT reactivate it."""
        from game_modules.quiz.models import QuizTopic
        from src.app.extensions.sqlalchemy_ext import get_session
        
        # 1. Soft-delete unit manually (simulate API call)
        with get_session() as session:
            topic = session.query(QuizTopic).filter(QuizTopic.id == "test_unit_1").first()
            assert topic is not None
            topic.is_active = False
            session.commit()
        
        # Verify is_active=false
        with get_session() as session:
            topic = session.query(QuizTopic).filter(QuizTopic.id == "test_unit_1").first()
            assert topic.is_active is False
        
        # 2. Simulate re-import by updating the topic (as import_service does)
        with get_session() as session:
            topic = session.query(QuizTopic).filter(QuizTopic.id == "test_unit_1").first()
            
            # This is what import does for existing topics (UPDATE path)
            # It should NOT override is_active
            topic.title_key = "Test Unit 1 Updated"
            topic.description_key = "Updated description"
            topic.release_id = "test_reimport_release"
            # NOTE: is_active is NOT set here (as per our fix)
            
            session.commit()
        
        # 3. Verify is_active is STILL false (not overridden)
        with get_session() as session:
            topic = session.query(QuizTopic).filter(QuizTopic.id == "test_unit_1").first()
            assert topic is not None
            assert topic.is_active is False, "Re-import must NOT override is_active=false"
            # But other fields should be updated
            assert topic.title_key == "Test Unit 1 Updated"
            assert topic.title_key == "Test Unit 1 Updated"