"""Unit tests for BlackLab hit -> canonical mapping.

These tests assert that the `_hit_to_canonical` helper maps various BlackLab
hit JSON shapes (v4/v5) to the canonical keys expected by the rest of the app.
"""

from src.app.services.blacklab_search import _hit_to_canonical


SAMPLE_HIT_V5 = {
    "docPid": "35",
    "start": 1136,
    "end": 1137,
    "before": {"word": ["palabra1", "palabra2"], "start_ms": ["407340", "408060"]},
    "match": {
        "word": ["casa"],
        "tokid": ["ven32e61a3eb"],
        "start_ms": ["408390"],
        "end_ms": ["408690"],
    },
    "after": {"word": ["como", "ejemplo"], "start_ms": ["408690", "409050"]},
    "docInfo": {"country": "VEN"},
}


def test_v5_hit_mapping_contains_canonical_keys():
    mapped = _hit_to_canonical(SAMPLE_HIT_V5)
    assert mapped.get("token_id") == "ven32e61a3eb"
    assert mapped.get("text") == "casa"
    assert mapped.get("context_left")
    assert mapped.get("context_right")
    assert "start_ms" in mapped and isinstance(mapped.get("start_ms"), int)
    assert mapped.get("country_code") == "ven"


SAMPLE_HIT_LEGACY = {
    "docPid": "0",
    "start": 4760,
    "left": {"word": ["en", "el"]},
    "match": {
        "word": ["casa"],
        "tokid": ["ven2252d1579"],
        "start_ms": ["1641470"],
        "end_ms": ["1641650"],
    },
    "right": {"word": ["sector", "tronco"]},
}


def test_legacy_hit_mapping_contains_canonical_keys():
    mapped = _hit_to_canonical(SAMPLE_HIT_LEGACY)
    assert mapped.get("token_id") == "ven2252d1579"
    assert mapped.get("text") == "casa"
    assert mapped.get("context_left") == "en el"
    assert mapped.get("context_right") == "sector tronco"
    assert mapped.get("start_ms") == 1641470


SAMPLE_HIT_DOCINFO_LIST = {
    "docPid": "1",
    "start": 1000,
    "before": {"word": ["un", "ejemplo"]},
    "match": {
        "word": ["casa"],
        "tokid": ["arg123"],
        "start_ms": ["1000"],
        "end_ms": ["1500"],
    },
    "after": {"word": ["en", "el"]},
    "docInfo": [{"country": "ARG", "speaker_type": "pro"}],
}


def test_docinfo_list_mapping_handles_list():
    mapped = _hit_to_canonical(SAMPLE_HIT_DOCINFO_LIST)
    assert mapped.get("country_code") == "arg"
    assert mapped.get("speaker_type") == "pro"


def test_context_start_end_extraction_v5_with_end_ms():
    SAMPLE = {
        "docPid": "100",
        "before": {"word": ["uno", "dos"], "start_ms": ["1000", "2000"]},
        "match": {
            "word": ["casa"],
            "tokid": ["argx1"],
            "start_ms": ["3000"],
            "end_ms": ["3100"],
        },
        "after": {"word": ["tres", "cuatro"], "end_ms": ["3200", "3300"]},
    }
    mapped = _hit_to_canonical(SAMPLE)
    assert mapped.get("context_start") == 1000
    assert mapped.get("context_end") == 3300


def test_context_start_end_extraction_list_of_dicts():
    SAMPLE = {
        "docPid": "200",
        "before": [
            {"word": ["en"], "start_ms": ["5000"]},
            {"word": ["la"], "start_ms": ["5100"]},
        ],
        "match": {
            "word": ["casa"],
            "tokid": ["argx2"],
            "start_ms": ["5200"],
            "end_ms": ["5300"],
        },
        "after": [
            {"word": ["algo"], "end_ms": ["5400"]},
            {"word": ["mas"], "end_ms": ["5500"]},
        ],
    }
    mapped = _hit_to_canonical(SAMPLE)
    assert mapped.get("context_start") == 5000
    assert mapped.get("context_end") == 5500


SAMPLE_HIT_WITH_SENTENCE_ID = {
    "docPid": "42",
    "start": 1,
    "end": 2,
    "left": {
        "word": ["Frase", "anterior.", "Palabra"],
        "sentence_id": ["s1", "s1", "s2"],
        "start_ms": ["100", "200", "300"],
        "end_ms": ["150", "250", "350"],
    },
    "match": {
        "word": ["clave"],
        "sentence_id": ["s2"],
        "start_ms": ["400"],
        "end_ms": ["450"],
    },
    "right": {
        "word": ["en", "contexto.", "Siguiente", "frase."],
        "sentence_id": ["s2", "s2", "s3", "s3"],
        "start_ms": ["500", "600", "700", "800"],
        "end_ms": ["550", "650", "750", "850"],
    },
    "docInfo": {"country": "TEST"},
}


def test_sentence_context_logic():
    """Test that sentence-based context is correctly extracted."""
    mapped = _hit_to_canonical(SAMPLE_HIT_WITH_SENTENCE_ID)

    # Check that context is limited to the sentence
    assert mapped.get("context_left") == "Palabra"
    assert mapped.get("context_right") == "en contexto."

    # Check that hit timing is correct
    assert mapped.get("start_ms") == 400
    assert mapped.get("end_ms") == 450

    # Check that context timing spans the whole sentence
    assert mapped.get("context_start") == 300
    assert mapped.get("context_end") == 650


def test_sentence_context_fallback_if_no_sentence_id():
    """Test that it falls back to legacy context if sentence_id is missing."""
    hit_no_sentence_id = SAMPLE_HIT_WITH_SENTENCE_ID.copy()
    del hit_no_sentence_id["left"]["sentence_id"]
    del hit_no_sentence_id["match"]["sentence_id"]
    del hit_no_sentence_id["right"]["sentence_id"]

    mapped = _hit_to_canonical(hit_no_sentence_id)

    # Should revert to full left/right context
    assert mapped.get("context_left") == "Frase anterior. Palabra"
    assert mapped.get("context_right") == "en contexto. Siguiente frase."
