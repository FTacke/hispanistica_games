from pathlib import Path

from src.scripts.blacklab_index_creation import export_to_tsv


def make_doc_with_token(
    past=None, future=None, past_in_morph=True, future_in_morph=True
):
    # Create minimal corpus doc with one segment and one token
    token = {
        "token_id": "t1",
        "start_ms": 0,
        "end_ms": 10,
        "lemma": "test",
        "pos": "VERB",
        "norm": "test",
        "sentence_id": "s1",
        "utterance_id": "u1",
        "text": "Test",
    }

    morph = {}
    if past is not None and past_in_morph:
        morph["PastType"] = past
    if future is not None and future_in_morph:
        morph["FutureType"] = future

    token["morph"] = morph

    # Optionally add top-level legacy fields
    if past is not None and not past_in_morph:
        token["past_type"] = past
    if future is not None and not future_in_morph:
        token["future_type"] = future

    doc = {
        "file_id": "file1",
        "segments": [{"speaker": {"code": "none"}, "words": [token]}],
    }

    return doc


def test_exporter_accepts_mixed_cases(tmp_path: Path):
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    skip_cache = {}

    # Case A: values in morph with canonical names
    docA = make_doc_with_token(past="simplePast", future="periphrasticFuture")
    ok, msg = export_to_tsv(docA, Path("fileA.json"), out_dir, skip_cache)
    assert ok, msg
    contentA = (out_dir / "fileA.tsv").read_text(encoding="utf-8")
    assert "simplePast" in contentA
    assert "periphrasticFuture" in contentA

    # Case B: values at top-level legacy fields
    docB = make_doc_with_token(
        past="legacyPast",
        future="legacyFuture",
        past_in_morph=False,
        future_in_morph=False,
    )
    ok, msg = export_to_tsv(docB, Path("fileB.json"), out_dir, skip_cache)
    assert ok, msg
    contentB = (out_dir / "fileB.tsv").read_text(encoding="utf-8")
    assert "legacyPast" in contentB
    assert "legacyFuture" in contentB

    # Case C: mixed variants (top-level past, morph future)
    docC = make_doc_with_token(
        past="pTop", future="fMorph", past_in_morph=False, future_in_morph=True
    )
    ok, msg = export_to_tsv(docC, Path("fileC.json"), out_dir, skip_cache)
    assert ok, msg
    contentC = (out_dir / "fileC.tsv").read_text(encoding="utf-8")
    assert "pTop" in contentC
    assert "fMorph" in contentC
