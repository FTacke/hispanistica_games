#!/usr/bin/env python
"""
Test script for Advanced Search with new field structure.
Tests CQL generation with country_scope, country_parent_code, speaker filters, etc.
"""

import sys
from src.app.search.cql import (
    build_filters,
    build_cql_with_speaker_filter,
)


class MockParams(dict):
    """Mock request params object with getlist support."""

    def getlist(self, key):
        val = self.get(key)
        if isinstance(val, list):
            return val
        return [val] if val is not None else []


def test_basic_lemma_search():
    """Test 1: Basic lemma search without filters."""
    print("\n=== Test 1: Basic Lemma Search ===")
    params = MockParams({"q": "casa", "mode": "lemma"})
    filters = build_filters(params)
    cql = build_cql_with_speaker_filter(params, filters)
    print(f"CQL: {cql}")
    assert '[lemma="casa" & country_scope="national"]' in cql, (
        "Basic lemma search failed"
    )
    print("✓ PASS")


def test_national_country_filter():
    """Test 2: National country filter (ARG)."""
    print("\n=== Test 2: National Country Filter ===")
    params = MockParams(
        {
            "q": "casa",
            "mode": "lemma",
            "country_code": ["ARG"],
        }
    )
    filters = build_filters(params)
    cql = build_cql_with_speaker_filter(params, filters)
    print(f"Filters: {filters}")
    print(f"CQL: {cql}")
    assert 'country_code="ARG"' in cql, "Country filter failed"
    print("✓ PASS")


def test_regional_country_filter():
    """Test 3: Regional country filter (ARG-CBA)."""
    print("\n=== Test 3: Regional Country Filter ===")
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
    print(f"Filters: {filters}")
    print(f"CQL: {cql}")
    assert 'country_scope="regional"' in cql, "Country scope filter failed"
    assert 'country_parent_code="ARG"' in cql, "Parent code filter failed"
    assert 'country_region_code="CBA"' in cql, "Region code filter failed"
    print("✓ PASS")


def test_speaker_filter():
    """Test 4: Speaker filter (pro + female)."""
    print("\n=== Test 4: Speaker Filter ===")
    params = MockParams(
        {
            "q": "casa",
            "mode": "lemma",
            "speaker_type": ["pro"],
            "sex": ["f"],
        }
    )
    filters = build_filters(params)
    cql = build_cql_with_speaker_filter(params, filters)
    print(f"Filters: {filters}")
    print(f"CQL: {cql}")
    # Should include speaker_code constraint with all pro+female codes
    assert "speaker_code=" in cql, "Speaker code filter failed"
    print("✓ PASS")


def test_combined_filters():
    """Test 5: Combined country + speaker filters."""
    print("\n=== Test 5: Combined Filters ===")
    params = MockParams(
        {
            "q": "casa",
            "mode": "lemma",
            "country_code": ["ARG"],
            "speaker_type": ["pro"],
            "speech_mode": ["libre"],
        }
    )
    filters = build_filters(params)
    cql = build_cql_with_speaker_filter(params, filters)
    print(f"Filters: {filters}")
    print(f"CQL: {cql}")
    assert 'country_code="ARG"' in cql, "Country filter failed"
    assert "speaker_code=" in cql, "Speaker filter failed"
    print("✓ PASS")


def test_multiple_countries():
    """Test 6: Multiple countries (ARG + ESP)."""
    print("\n=== Test 6: Multiple Countries ===")
    params = MockParams(
        {
            "q": "casa",
            "mode": "lemma",
            "country_code": ["ARG", "ESP"],
        }
    )
    filters = build_filters(params)
    cql = build_cql_with_speaker_filter(params, filters)
    print(f"Filters: {filters}")
    print(f"CQL: {cql}")
    # Should use regex alternation for multiple countries
    assert 'country_code="(ARG|ESP)"' in cql, "Country filter failed"
    print("✓ PASS")


def main():
    """Run all tests."""
    print("=" * 60)
    print("Advanced Search CQL Generation Tests")
    print("=" * 60)

    try:
        test_basic_lemma_search()
        test_national_country_filter()
        test_regional_country_filter()
        test_speaker_filter()
        test_combined_filters()
        test_multiple_countries()

        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
