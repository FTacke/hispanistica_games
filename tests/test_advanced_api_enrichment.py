import json
from src.app.search.advanced_api import _DOCMETA_CACHE
from src.app.services.blacklab_search import _hit_to_canonical
from src.app.search.advanced_api import _enrich_hits_with_docmeta


def load_json_fixture(path: str) -> dict:
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def test_enrich_hits_with_docmeta_test_full_hit():
    # Load a sample full hit file (has docInfos and hits)
    import os

    resource_path = os.path.join(
        os.path.dirname(__file__), "resources", "test_full_hit.json"
    )
    data = load_json_fixture(resource_path)
    hits = data.get("hits", [])
    docinfos = data.get("docInfos", {})

    # Map to canonical items
    items = [_hit_to_canonical(h) for h in hits]

    # Try to enrich using DOCMETA_CACHE
    enriched = _enrich_hits_with_docmeta(items, hits, docinfos, _DOCMETA_CACHE)

    # First enriched item should have country_code populated (from docmeta)
    assert enriched[0].get("country_code")


def test_map_speaker_attributes_fills_speaker_fields():
    # Create a hit with speaker_code only
    hit = {
        "docPid": "0",
        "match": {"tokid": ["ven_sample"], "speaker_code": ["lib-pm"]},
    }
    item = _hit_to_canonical(hit)
    enriched = _enrich_hits_with_docmeta([item], [hit], {}, _DOCMETA_CACHE)
    # After enrichment, speaker_type and sex should be populated
    assert enriched[0].get("speaker_type") == "pro"
    assert enriched[0].get("sex") == "m"
