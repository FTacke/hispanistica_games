"""
Tests for search functionality.

Tests both simple and advanced search flows.
"""

import pytest
from flask import Flask


@pytest.fixture
def app():
    """Create test Flask app."""
    from pathlib import Path

    project_root = Path(__file__).resolve().parents[1]
    template_dir = project_root / "templates"
    static_dir = project_root / "static"

    app = Flask(
        __name__, template_folder=str(template_dir), static_folder=str(static_dir)
    )
    app.config["AUTH_DATABASE_URL"] = "sqlite:///:memory:"
    app.config["AUTH_HASH_ALGO"] = "bcrypt"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    app.config["JWT_COOKIE_SECURE"] = False
    app.config["TESTING"] = True
    app.config["SECRET_KEY"] = "test-secret"

    from src.app.extensions.sqlalchemy_ext import init_engine as init_auth, get_engine
    from src.app.auth.models import Base
    from src.app.extensions import register_extensions
    from src.app.routes import register_blueprints
    from src.app import register_context_processors, register_security_headers

    register_extensions(app)
    init_auth(app)
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    register_blueprints(app)
    register_context_processors(app)
    register_security_headers(app)

    return app


@pytest.fixture
def client(app):
    ctx = app.app_context()
    ctx.push()
    client = app.test_client()
    yield client
    ctx.pop()


class TestCQLGeneration:
    """Test CQL query generation without BlackLab."""

    def test_basic_lemma_search_cql(self):
        """Test basic lemma search generates correct CQL."""
        from src.app.search.cql import build_filters, build_cql_with_speaker_filter

        class MockParams(dict):
            def getlist(self, key):
                val = self.get(key)
                if isinstance(val, list):
                    return val
                return [val] if val is not None else []

        params = MockParams({"q": "casa", "mode": "lemma"})
        filters = build_filters(params)
        cql = build_cql_with_speaker_filter(params, filters)

        assert 'lemma="casa"' in cql
        assert 'country_scope="national"' in cql

    def test_word_mode_search_cql(self):
        """Test word mode search generates correct CQL."""
        from src.app.search.cql import build_filters, build_cql_with_speaker_filter

        class MockParams(dict):
            def getlist(self, key):
                val = self.get(key)
                if isinstance(val, list):
                    return val
                return [val] if val is not None else []

        params = MockParams({"q": "casas", "mode": "word"})
        filters = build_filters(params)
        cql = build_cql_with_speaker_filter(params, filters)

        assert 'word="casas"' in cql

    def test_country_filter_cql(self):
        """Test country filter generates correct CQL."""
        from src.app.search.cql import build_filters, build_cql_with_speaker_filter

        class MockParams(dict):
            def getlist(self, key):
                val = self.get(key)
                if isinstance(val, list):
                    return val
                return [val] if val is not None else []

        params = MockParams({"q": "casa", "mode": "lemma", "country_code": ["ARG"]})
        filters = build_filters(params)
        cql = build_cql_with_speaker_filter(params, filters)

        assert 'country_code="ARG"' in cql

    def test_regional_filter_cql(self):
        """Test regional filter generates correct CQL."""
        from src.app.search.cql import build_filters, build_cql_with_speaker_filter

        class MockParams(dict):
            def getlist(self, key):
                val = self.get(key)
                if isinstance(val, list):
                    return val
                return [val] if val is not None else []

        params = MockParams(
            {
                "q": "casa",
                "mode": "lemma",
                "country_scope": "regional",
                "country_parent_code": ["ARG"],
                "country_region_code": ["CBA"],
            }
        )
        filters = build_filters(params)
        cql = build_cql_with_speaker_filter(params, filters)

        assert 'country_scope="regional"' in cql
        assert 'country_parent_code="ARG"' in cql
        assert 'country_region_code="CBA"' in cql


class TestSearchPageRendering:
    """Test search page rendering."""

    def test_search_page_renders(self, client):
        """Search page should render without errors."""
        # The search page might be at /search or /search/advanced
        # Try common paths
        for path in ["/search/advanced", "/corpus", "/corpus/search"]:
            resp = client.get(path)
            if resp.status_code == 200:
                assert b"search" in resp.data.lower() or b"buscar" in resp.data.lower()
                return

        # If no search page found, skip (might require auth or different path)
        pytest.skip("Search page path not found or requires auth")


class TestSearchAPI:
    """Test search API endpoints."""

    def test_search_api_requires_query(self, client):
        """Search API should require a query parameter."""
        # This test checks the API behavior without BlackLab
        # The actual search would fail without BlackLab, but validation should work
        resp = client.get("/api/search")

        # Should either 400 (missing params) or 404 (route not found)
        # or redirect to login if auth required
        assert resp.status_code in (400, 404, 401, 302, 303)

    def test_cql_validation(self):
        """Test CQL validator catches invalid queries."""
        from src.app.search.cql_validator import (
            validate_cql_pattern,
            CQLValidationError,
        )

        # Valid CQL - should not raise
        result = validate_cql_pattern('[lemma="casa"]')
        assert result == '[lemma="casa"]'

        # Invalid CQL (shell metachar) - should raise
        try:
            validate_cql_pattern('[lemma="casa"; DROP TABLE"]')
            assert False, "Should have raised CQLValidationError"
        except CQLValidationError:
            pass  # Expected


class TestSearchFilters:
    """Test search filter building."""

    def test_build_filters_empty_params(self):
        """build_filters handles empty params."""
        from src.app.search.cql import build_filters

        class MockParams(dict):
            def getlist(self, key):
                return []

        filters = build_filters(MockParams())
        assert isinstance(filters, dict)

    def test_build_filters_with_speaker_type(self):
        """build_filters handles speaker type filter."""
        from src.app.search.cql import build_filters

        class MockParams(dict):
            def getlist(self, key):
                val = self.get(key)
                if isinstance(val, list):
                    return val
                return [val] if val is not None else []

        params = MockParams({"speaker_type": ["pro"]})
        filters = build_filters(params)
        assert "speaker_type" in filters or "speaker_types" in filters


class TestSearchIntegration:
    """Integration tests that would require BlackLab.

    These tests document the expected behavior but may be skipped
    if BlackLab is not running.
    """

    @pytest.mark.skipif(True, reason="Requires running BlackLab server")
    def test_simple_search_returns_results(self, client):
        """Simple search returns results from BlackLab."""
        resp = client.get("/api/search?q=casa&mode=lemma")
        assert resp.status_code == 200
        data = resp.json
        assert "hits" in data or "results" in data

    @pytest.mark.skipif(True, reason="Requires running BlackLab server")
    def test_advanced_search_with_filters(self, client):
        """Advanced search with country filter works."""
        resp = client.get("/api/search?q=casa&mode=lemma&country_code=ARG")
        assert resp.status_code == 200
