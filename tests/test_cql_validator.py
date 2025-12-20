#!/usr/bin/env python3
"""Test CQL validator."""

from src.app.search.cql_validator import validate_cql_pattern, CQLValidationError

test_patterns = [
    '[lemma="casa"]',
    '[word="México"]',
    '[word="test" & pos="NOUN"]',
    '[lemma="ir"] [pos="VERB"]',
]

for pattern in test_patterns:
    try:
        result = validate_cql_pattern(pattern)
        print(f"✓ Valid: {pattern}")
    except CQLValidationError as e:
        print(f"✗ Invalid: {pattern}")
        print(f"  Error: {e}")
