"""
Quick test script for Advanced Search API endpoint.

Tests:
1. Health check (if BLS is reachable)
2. Simple lemma search without filters
3. Search with country filter
4. Search with speaker filters
5. POS mode search
"""

import requests
import json
import sys


BLS_BASE_URL = "http://localhost:8081/blacklab-server"
FLASK_BASE_URL = "http://localhost:8000"


def test_health():
    """Test BLS health check."""
    print("\n" + "=" * 80)
    print("TEST 1: Health Check")
    print("=" * 80)

    try:
        response = requests.get(f"{FLASK_BASE_URL}/health/bls", timeout=5)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def test_simple_search():
    """Test simple lemma search."""
    print("\n" + "=" * 80)
    print("TEST 2: Simple Lemma Search (q=casa, mode=lemma)")
    print("=" * 80)

    try:
        params = {
            "q": "casa",
            "mode": "lemma",
            "draw": "1",
            "start": "0",
            "length": "5",
        }
        response = requests.get(
            f"{FLASK_BASE_URL}/search/advanced/data", params=params, timeout=10
        )
        print(f"Status: {response.status_code}")

        data = response.json()
        print(f"recordsTotal: {data.get('recordsTotal')}")
        print(f"recordsFiltered: {data.get('recordsFiltered')}")
        print(f"data length: {len(data.get('data', []))}")

        if data.get("data"):
            print("\nFirst hit:")
            first_hit = data["data"][0]
            print(json.dumps(first_hit, indent=2, ensure_ascii=False))

        return data.get("recordsTotal", 0) > 0
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def test_country_filter():
    """Test search with country filter."""
    print("\n" + "=" * 80)
    print("TEST 3: Lemma Search with Country Filter (q=casa, country=VEN)")
    print("=" * 80)

    try:
        params = {
            "q": "casa",
            "mode": "lemma",
            "country_code": "VEN",
            "draw": "1",
            "start": "0",
            "length": "5",
        }
        response = requests.get(
            f"{FLASK_BASE_URL}/search/advanced/data", params=params, timeout=10
        )
        print(f"Status: {response.status_code}")

        data = response.json()
        print(f"recordsTotal: {data.get('recordsTotal')}")
        print(f"recordsFiltered: {data.get('recordsFiltered')}")

        if data.get("data"):
            print("\nFirst hit country:", data["data"][0].get("country_code"))

        return data.get("recordsTotal", 0) > 0
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def test_speaker_filters():
    """Test search with speaker attribute filters."""
    print("\n" + "=" * 80)
    print("TEST 4: Search with Speaker Filters (sex=f)")
    print("=" * 80)

    try:
        params = {
            "q": "casa",
            "mode": "lemma",
            "sex": "f",
            "draw": "1",
            "start": "0",
            "length": "5",
        }
        response = requests.get(
            f"{FLASK_BASE_URL}/search/advanced/data", params=params, timeout=10
        )
        print(f"Status: {response.status_code}")

        data = response.json()
        print(f"recordsTotal: {data.get('recordsTotal')}")
        print(f"recordsFiltered: {data.get('recordsFiltered')}")

        if data.get("data"):
            print("\nFirst hit sex:", data["data"][0].get("sex"))
            print("First hit speaker_type:", data["data"][0].get("speaker_type"))

        return data.get("recordsTotal", 0) > 0
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def test_pos_mode():
    """Test POS mode search."""
    print("\n" + "=" * 80)
    print("TEST 5: POS Mode Search (q=VERB, mode=pos)")
    print("=" * 80)

    try:
        params = {"q": "VERB", "mode": "pos", "draw": "1", "start": "0", "length": "5"}
        response = requests.get(
            f"{FLASK_BASE_URL}/search/advanced/data", params=params, timeout=10
        )
        print(f"Status: {response.status_code}")

        data = response.json()
        print(f"recordsTotal: {data.get('recordsTotal')}")
        print(f"recordsFiltered: {data.get('recordsFiltered')}")

        if data.get("data"):
            print("\nFirst hit match:", data["data"][0].get("text"))

        return data.get("recordsTotal", 0) > 0
    except Exception as e:
        print(f"ERROR: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("ADVANCED SEARCH API TEST SUITE")
    print("=" * 80)

    results = {
        "Health Check": test_health(),
        "Simple Search": test_simple_search(),
        "Country Filter": test_country_filter(),
        "Speaker Filters": test_speaker_filters(),
        "POS Mode": test_pos_mode(),
    }

    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status:8s} {test_name}")

    all_passed = all(results.values())
    print("\n" + "=" * 80)
    print(f"Overall: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print("=" * 80)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
