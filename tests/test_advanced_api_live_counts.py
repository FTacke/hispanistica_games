"""
Pytest integration test: verify advanced API returns counts when BL container is accessible.

This test will be skipped if either the BL API or Flask API is not reachable on the default ports.
"""

import os
import httpx
import pytest

BASE_FLASK = os.environ.get("FLASK_BASE_URL", "http://localhost:8000")
BASE_BLS = os.environ.get("BLS_BASE_URL", "http://localhost:8081/blacklab-server")
TIMEOUT = httpx.Timeout(connect=2.0, read=6.0, write=2.0, pool=2.0)


def bls_available():
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.get(
                f"{BASE_BLS}/corpora/corapan/hits", params={"first": 0, "number": 0}
            )
            return r.status_code == 200
    except Exception:
        return False


def flask_available():
    try:
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.get(f"{BASE_FLASK}/health/bls")
            if r.status_code != 200:
                return False
            content = r.json()
            return content.get("ok", False) or content.get("ok") == "true"
    except Exception:
        return False


@pytest.mark.live
def test_advanced_api_returns_counts_against_real_bls():
    if not bls_available():
        pytest.skip("BlackLab server (localhost:8081) is not reachable")
    if not flask_available():
        pytest.skip("Flask app (localhost:8000) is not running or health check fails")

    with httpx.Client(timeout=TIMEOUT) as client:
        # Query BL directly for a known token; using 'casa' as a frequent token
        bls_params = {"patt": '[lemma="casa"]', "first": 0, "number": 1}
        bls_resp = client.get(
            f"{BASE_BLS}/corpora/corapan/hits",
            params=bls_params,
            headers={"Accept": "application/json"},
        )
        bls_resp.raise_for_status()
        bls_data = bls_resp.json()
        bls_summary = bls_data.get("summary", {}) or bls_data.get("resultsStats", {})
        bls_hits = bls_summary.get("hits") or bls_summary.get("numberOfHits") or 0

        # Query Flask advanced API
        flask_params = {
            "draw": 1,
            "start": 0,
            "length": 10,
            "q": "casa",
            "mode": "lemma",
        }
        flask_resp = client.get(
            f"{BASE_FLASK}/search/advanced/data", params=flask_params
        )
        flask_resp.raise_for_status()
        flask_payload = flask_resp.json()
        records_total = int(flask_payload.get("recordsTotal") or 0)
        records_filtered = int(flask_payload.get("recordsFiltered") or 0)

        if bls_hits <= 0:
            pytest.skip(
                "BlackLab returned zero hits for this test token; skipping live assertion"
            )
        assert records_total > 0 or records_filtered > 0, (
            "Flask advanced API returned zero results when BL does have hits"
        )
        # Optionally, don't assert equality; but we assert that Flask doesn't return more than BL
        assert records_total <= bls_hits or records_total == 0, (
            "Flask reported more hits than BL (unexpected)"
        )
