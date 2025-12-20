from src.app.search.advanced_api import _enrich_hits_with_docmeta
from src.app.services.blacklab_search import _hit_to_canonical


def test_enrich_with_docmeta_prefers_docInfos_mapping():
    # Fake hit with docPid numeric and no filename in match
    hit = {
        "docPid": "12",
        "match": {
            "word": ["casa"],
            "tokid": ["vtest"],
            "start_ms": ["1000"],
            "end_ms": ["1100"],
        },
    }
    item = _hit_to_canonical(hit)
    # docInfos provides mapping docPid -> metadata with file_id
    docInfos = {"12": {"metadata": {"file_id": "2022-01-18_VEN_RCR"}}}
    docmeta_cache = {
        "2022-01-18_VEN_RCR": {"file_id": "2022-01-18_VEN_RCR", "country_code": "VEN"}
    }

    enriched = _enrich_hits_with_docmeta([item], [hit], docInfos, docmeta_cache)
    assert enriched[0]["filename"] == "2022-01-18_VEN_RCR"
    assert enriched[0]["country_code"] == "ven"
