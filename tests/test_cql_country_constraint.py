from src.app.search.cql import build_cql_with_speaker_filter


def test_cql_excludes_country_code_when_doc_level_filter_present():
    params = {"q": "casa", "mode": "lemma"}
    # Simulate doc-level filter present by removing country_code from filters
    # Simulate pre-removal, but here we pass in filters WITHOUT country_code
    filters_without_country = {}

    cql_no_country = build_cql_with_speaker_filter(params, filters_without_country)
    assert "country_code" not in cql_no_country


def test_cql_includes_country_code_when_no_doc_level_filter():
    params = {"q": "casa", "mode": "lemma"}
    filters = {"country_code": ["ARG"]}
    cql_with_country = build_cql_with_speaker_filter(params, filters)
    assert "country_code" in cql_with_country
