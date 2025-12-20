"""Test CQL build logic."""

from src.app.search.cql import build_cql


def test_single_token_forma():
    """Test single token 'forma' mode (case-insensitive)."""
    params = {"q": "Casa", "mode": "forma", "sensitive": "0"}
    assert build_cql(params) == '[norm="casa"]'


def test_single_token_forma_sensitive():
    """Test single token 'forma' mode (case-sensitive)."""
    params = {"q": "Casa", "mode": "forma", "sensitive": "1"}
    assert build_cql(params) == '[word="Casa"]'


def test_single_token_lemma():
    """Test single token 'lemma' mode."""
    params = {"q": "Blanco", "mode": "lemma"}
    assert build_cql(params) == '[lemma="blanco"]'


def test_single_token_pos():
    """Test single token 'pos' mode."""
    params = {"q": "VERB", "mode": "pos"}
    assert build_cql(params) == '[pos="VERB"]'


def test_multi_token_sequence_forma():
    """Test multi-token sequence in 'forma' mode."""
    params = {"q": "casa blanca", "mode": "forma", "sensitive": "0"}
    assert build_cql(params) == '[norm="casa"] [norm="blanca"]'


def test_multi_token_sequence_lemma():
    """Test multi-token sequence in 'lemma' mode."""
    params = {"q": "casa blanco", "mode": "lemma"}
    assert build_cql(params) == '[lemma="casa"] [lemma="blanco"]'


def test_whitespace_robustness():
    """Test that extra whitespace is handled correctly."""
    params = {"q": "  casa   blanca  ", "mode": "forma", "sensitive": "0"}
    assert build_cql(params) == '[norm="casa"] [norm="blanca"]'


def test_cql_mode_passthrough():
    """Test that 'cql' mode passes the query through unchanged."""
    raw_cql = '[word="casa"] [] [lemma="blanco" & pos="ADJ"]'
    params = {"q": raw_cql, "mode": "cql"}
    # In CQL mode, build_cql returns the token as-is.
    # The tokenizer will split it, but build_token_cql will just return the parts.
    assert build_cql(params) == raw_cql


def test_empty_query():
    """Test that an empty query returns a wildcard token."""
    params = {"q": " ", "mode": "forma"}
    assert build_cql(params) == "[]"


def test_query_with_pos_constraints():
    """Test a query with associated POS tag constraints."""
    params = {"q": "la casa", "mode": "forma", "pos": "ART,NOUN"}
    assert build_cql(params) == '[norm="la" & pos="ART"] [norm="casa" & pos="NOUN"]'


def test_query_with_fewer_pos_constraints():
    """Test query where there are fewer POS tags than tokens."""
    params = {"q": "la casa blanca", "mode": "forma", "pos": "ART,NOUN"}
    assert (
        build_cql(params)
        == '[norm="la" & pos="ART"] [norm="casa" & pos="NOUN"] [norm="blanca"]'
    )
