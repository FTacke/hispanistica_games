"""
Integration tests for Advanced Search DataTables endpoint.

Tests the complete flow from /search/advanced/data through to BlackLab,
verifying:
- JSON contract (structure, required fields)
- KWIC context (left, hit, right)
- Metadata fields (país, speaker attributes)
- Case handling (display vs. internal codes)
- Filter combinations (country, include_regional, speaker filters)

Tests skip gracefully if BlackLab is not available (no mocks).
"""

import pytest
import logging
from urllib.parse import urlencode

# Try to import Flask test client
try:
    import sys
    import os

    # Add src directory to path (works for both CI and local dev)
    src_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src")
    if src_path not in sys.path:
        sys.path.insert(0, src_path)
    from app import create_app

    FLASK_AVAILABLE = True
except ImportError as e:
    FLASK_AVAILABLE = False
    pytest.skip(f"Flask app not available: {e}", allow_module_level=True)

logger = logging.getLogger(__name__)


@pytest.fixture(scope="module")
def app():
    """Create Flask app for testing."""
    if not FLASK_AVAILABLE:
        pytest.skip("Flask not available")

    app = create_app()
    app.config["TESTING"] = True
    return app


@pytest.fixture(scope="module")
def client(app):
    """Create test client."""
    return app.test_client()


def check_blacklab_available(client):
    """
    Check if BlackLab is available by making a test request.

    Returns:
        bool: True if BlackLab is available, False otherwise
    """
    try:
        # Try a simple query to see if BlackLab responds
        params = {
            "q": "casa",
            "mode": "lemma",
            "sensitive": "1",
            "draw": "1",
            "start": "0",
            "length": "1",
        }
        response = client.get(f"/search/advanced/data?{urlencode(params)}")

        # Check for connection error in response
        if response.status_code == 200:
            data = response.get_json()
            if data and data.get("error") == "upstream_unavailable":
                logger.warning("BlackLab not available: upstream_unavailable error")
                return False
            return True

        logger.warning(f"BlackLab check returned status {response.status_code}")
        return False
    except Exception as e:
        logger.warning(f"BlackLab availability check failed: {e}")
        return False


# Test 1: Structure & Completeness
def test_datatables_json_structure(client):
    """
    Test that DataTables endpoint returns properly structured JSON.

    Verifies:
    - Top-level keys: draw, recordsTotal, recordsFiltered, data
    - Response is 200 OK
    - data is a list
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "25",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    data = response.get_json()
    assert data is not None, "Response body is not JSON"

    # Check top-level structure
    assert "draw" in data, "Missing 'draw' field"
    assert "recordsTotal" in data, "Missing 'recordsTotal' field"
    assert "recordsFiltered" in data, "Missing 'recordsFiltered' field"
    assert "data" in data, "Missing 'data' field"

    # Check data is a list
    assert isinstance(data["data"], list), "'data' should be a list"

    # Check counts are integers >= 0
    assert isinstance(data["recordsTotal"], int), "recordsTotal should be int"
    assert isinstance(data["recordsFiltered"], int), "recordsFiltered should be int"
    assert data["recordsTotal"] >= 0, "recordsTotal should be >= 0"
    assert data["recordsFiltered"] >= 0, "recordsFiltered should be >= 0"

    logger.info(
        f"✓ JSON structure valid: {len(data['data'])} results, {data['recordsTotal']} total"
    )


def test_datatables_row_fields(client):
    """
    Test that each row in data array contains all required fields.

    Required fields:
    - token_id
    - filename
    - country_code
    - speaker_type, sex, mode, discourse (metadata)
    - text (KWIC match)
    - context_left, context_right (KWIC context)
    - start_ms, end_ms (audio timestamps)
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "mujer",
        "mode": "lemma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "10",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()
    assert len(data["data"]) > 0, "No results returned for test query"

    # Check first row for all required fields
    row = data["data"][0]

    required_fields = [
        "token_id",
        "filename",
        "country_code",
        "speaker_type",
        "sex",
        "mode",
        "discourse",
        "text",
        "context_left",
        "context_right",
        "start_ms",
        "end_ms",
    ]

    for field in required_fields:
        assert field in row, f"Missing required field: {field}"

    # Check that key fields are not None (empty strings are ok for context)
    assert row["token_id"], "token_id should not be empty"
    assert row["text"], "text (hit) should not be empty"

    logger.info(f"✓ All required fields present in row: {list(row.keys())}")


# Test 2: KWIC + Metadata
def test_kwic_context_present(client):
    """
    Test that KWIC fields (context_left, text, context_right) contain actual content.

    Verifies:
    - text field contains the search term (or lemma form)
    - context_left and context_right are strings (may be empty but should exist)
    - No fields are None
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    # Test with a common word to ensure hits
    params = {
        "q": "alcalde",
        "mode": "lemma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "5",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()
    if len(data["data"]) == 0:
        pytest.skip("No results for 'alcalde' - index may be empty")

    for idx, row in enumerate(data["data"]):
        # Check KWIC fields exist and are strings
        assert isinstance(row["text"], str), f"Row {idx}: 'text' should be string"
        assert isinstance(row["context_left"], str), (
            f"Row {idx}: 'context_left' should be string"
        )
        assert isinstance(row["context_right"], str), (
            f"Row {idx}: 'context_right' should be string"
        )

        # Check text field is not empty
        assert row["text"], f"Row {idx}: 'text' should not be empty"

        # Context may be empty for edge cases, but should be strings
        # (no assertion on content, just type)

    logger.info(f"✓ KWIC fields validated for {len(data['data'])} hits")


def test_metadata_fields_populated(client):
    """
    Test that metadata fields (país, speaker attributes) contain expected values.

    Verifies:
    - country_code is not empty
    - speaker_type, sex, mode, discourse are populated
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "mujer",
        "mode": "forma",
        "sensitive": "0",
        "draw": "1",
        "start": "0",
        "length": "10",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()
    if len(data["data"]) == 0:
        pytest.skip("No results for metadata test")

    for idx, row in enumerate(data["data"]):
        # Country code should be present and non-empty
        assert row.get("country_code"), f"Row {idx}: country_code should not be empty"

        # Metadata fields should exist (may be empty string, but not None)
        assert row.get("speaker_type") is not None, (
            f"Row {idx}: speaker_type should not be None"
        )
        assert row.get("sex") is not None, f"Row {idx}: sex should not be None"
        assert row.get("mode") is not None, f"Row {idx}: mode should not be None"
        assert row.get("discourse") is not None, (
            f"Row {idx}: discourse should not be None"
        )

    logger.info(f"✓ Metadata fields validated for {len(data['data'])} hits")


# Test 3: Filter Tests
def test_country_filter_esp(client):
    """
    Test that country filter (pais=ESP) returns only ESP results.

    Verifies:
    - When country_code=ESP is specified, all results have country_code matching ESP
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "country_code": "ESP",  # Single country filter
        "include_regional": "0",
        "draw": "1",
        "start": "0",
        "length": "25",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()

    if len(data["data"]) == 0:
        # May have no ESP results in test index
        logger.warning("No ESP results found - may be expected for test data")
        return

    # All results should have country_code=esp (lowercase in data)
    for idx, row in enumerate(data["data"]):
        country = row.get("country_code", "").upper()
        assert country == "ESP", f"Row {idx}: Expected ESP, got {country}"

    logger.info(f"✓ Country filter validated: {len(data['data'])} ESP results")


def test_include_regional_logic(client):
    """
    Test include_regional logic:
    - include_regional=0 (unchecked): should exclude regional codes
    - include_regional=1 (checked): should include regional codes
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    # Test 1: No country, include_regional=0 (default: national only)
    params_national = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "include_regional": "0",
        "draw": "1",
        "start": "0",
        "length": "100",
    }

    response_national = client.get(
        f"/search/advanced/data?{urlencode(params_national)}"
    )
    assert response_national.status_code == 200
    data_national = response_national.get_json()

    # Regional codes to check against
    regional_codes = ["ARG-CHU", "ARG-CBA", "ARG-SDE", "ESP-CAN", "ESP-SEV"]

    if len(data_national["data"]) > 0:
        # Check no regional codes in results
        for row in data_national["data"]:
            country = row.get("country_code", "").upper()
            assert country not in regional_codes, (
                f"Found regional code {country} when include_regional=0"
            )

        logger.info(
            f"✓ include_regional=0: No regional codes found in {len(data_national['data'])} results"
        )

    # Test 2: No country, include_regional=1 (should include all)
    params_regional = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "include_regional": "1",
        "draw": "1",
        "start": "0",
        "length": "100",
    }

    response_regional = client.get(
        f"/search/advanced/data?{urlencode(params_regional)}"
    )
    assert response_regional.status_code == 200
    data_regional = response_regional.get_json()

    # With include_regional=1, we should get at least as many results (or equal if no regional data)
    assert data_regional["recordsTotal"] >= data_national["recordsTotal"], (
        "include_regional=1 should have >= results than include_regional=0"
    )

    logger.info(
        f"✓ include_regional logic validated: national={data_national['recordsTotal']}, regional={data_regional['recordsTotal']}"
    )


# Test 4: Case Handling
def test_case_preservation_in_tokens(client):
    """
    Test that token text preserves original case from BlackLab index.

    Verifies:
    - Token text (text, context_left, context_right) is not forced to lowercase
    - Original case from source is preserved
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    # Search for a term that's likely to have capital letters in context
    params = {
        "q": "alcalde",
        "mode": "lemma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "10",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()
    if len(data["data"]) == 0:
        pytest.skip("No results for case preservation test")

    # Check that at least one result has uppercase letters
    has_uppercase = False
    for row in data["data"]:
        # Check all text fields
        all_text = " ".join(
            [
                row.get("text", ""),
                row.get("context_left", ""),
                row.get("context_right", ""),
            ]
        )

        if any(c.isupper() for c in all_text):
            has_uppercase = True
            break

    # We expect at least some uppercase in Spanish text (proper nouns, sentence starts)
    # If all lowercase, that would indicate forced lowercasing
    assert has_uppercase, (
        "Expected at least some uppercase letters in token text (original case should be preserved)"
    )

    logger.info("✓ Token text preserves original case")


def test_internal_codes_lowercase(client):
    """
    Test that internal codes (country_code, etc.) are lowercase.

    Verifies:
    - country_code is lowercase (internal representation)
    - This is expected for filtering/CQL
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "10",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()
    if len(data["data"]) == 0:
        pytest.skip("No results for case test")

    for row in data["data"]:
        country_code = row.get("country_code", "")
        if country_code:
            # Internal codes should be lowercase
            assert country_code == country_code.lower(), (
                f"country_code should be lowercase, got: {country_code}"
            )

    logger.info("✓ Internal codes (country_code) are lowercase")


# Test 5: Example Sentence Tests (from search_ui_tests.md)
def test_example_sentence_lemma_alcalde(client):
    """
    Test Case 1 from search_ui_tests.md:
    Simple Search - Lema: alcalde

    Expected to match example sentence containing "alcalde"
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "alcalde",
        "mode": "lemma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "25",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()

    # Should find at least one result
    assert data["recordsTotal"] > 0, "Expected to find results for 'alcalde' lemma"

    # Check that hits contain the lemma in some form
    if len(data["data"]) > 0:
        first_hit = data["data"][0]
        assert first_hit["text"], "Hit text should not be empty"
        logger.info(f"✓ Found {data['recordsTotal']} results for lemma 'alcalde'")


def test_example_sentence_forma_mujer_insensitive(client):
    """
    Test Case 7 from search_ui_tests.md:
    Opciones - Ignore accents/case: mujer with sensitive=0

    Should match variants like 'Mujer', 'mujér' etc.
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "mujer",
        "mode": "forma",
        "sensitive": "0",  # Case/accent insensitive
        "draw": "1",
        "start": "0",
        "length": "25",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()

    # Should find results
    assert data["recordsTotal"] > 0, (
        "Expected to find results for 'mujer' (insensitive)"
    )

    logger.info(
        f"✓ Found {data['recordsTotal']} results for 'mujer' (case-insensitive)"
    )


# Test 6: Audio Metadata
def test_audio_metadata_present(client):
    """
    Test that audio metadata (start_ms, end_ms, filename) is present.

    Required for audio player functionality.
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "10",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")
    assert response.status_code == 200

    data = response.get_json()
    if len(data["data"]) == 0:
        pytest.skip("No results for audio metadata test")

    for idx, row in enumerate(data["data"]):
        # Audio fields should exist (may be 0 or empty, but not None)
        assert "start_ms" in row, f"Row {idx}: Missing start_ms"
        assert "end_ms" in row, f"Row {idx}: Missing end_ms"
        assert "filename" in row, f"Row {idx}: Missing filename"

        # If filename is present, start_ms should be >= 0
        if row.get("filename"):
            assert isinstance(row["start_ms"], (int, float)), (
                f"Row {idx}: start_ms should be numeric"
            )
            assert row["start_ms"] >= 0, f"Row {idx}: start_ms should be >= 0"

    logger.info(f"✓ Audio metadata present in {len(data['data'])} hits")


# Test 7: Error Handling
def test_empty_query_error(client):
    """
    Test that empty query returns proper error.
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    params = {
        "q": "",  # Empty query
        "mode": "forma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "25",
    }

    response = client.get(f"/search/advanced/data?{urlencode(params)}")

    # Should return 200 with error in JSON (DataTables compatibility)
    assert response.status_code == 200

    data = response.get_json()
    assert "error" in data or data["recordsTotal"] == 0, (
        "Empty query should return error or 0 results"
    )

    logger.info("✓ Empty query handled correctly")


# Test 8: Pagination
def test_pagination_parameters(client):
    """
    Test that pagination parameters (start, length) work correctly.
    """
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")

    # Request first page
    params_page1 = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "draw": "1",
        "start": "0",
        "length": "5",
    }

    response_page1 = client.get(f"/search/advanced/data?{urlencode(params_page1)}")
    assert response_page1.status_code == 200
    data_page1 = response_page1.get_json()

    if data_page1["recordsTotal"] < 10:
        pytest.skip("Not enough results to test pagination")

    # Request second page
    params_page2 = {
        "q": "casa",
        "mode": "forma",
        "sensitive": "1",
        "draw": "2",
        "start": "5",
        "length": "5",
    }

    response_page2 = client.get(f"/search/advanced/data?{urlencode(params_page2)}")
    assert response_page2.status_code == 200
    data_page2 = response_page2.get_json()

    # Both should have same total
    assert data_page1["recordsTotal"] == data_page2["recordsTotal"], (
        "recordsTotal should be same across pages"
    )

    # Page 2 should return different data (check first token_id)
    if len(data_page1["data"]) > 0 and len(data_page2["data"]) > 0:
        token1 = data_page1["data"][0].get("token_id")
        token2 = data_page2["data"][0].get("token_id")
        assert token1 != token2, "Page 2 should return different results than page 1"

    logger.info("✓ Pagination validated: page 1 and page 2 return different results")


if __name__ == "__main__":
    # Allow running tests directly with pytest
    pytest.main([__file__, "-v", "-s"])
