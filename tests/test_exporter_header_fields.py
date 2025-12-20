from src.scripts.blacklab_index_creation import export_to_tsv
from pathlib import Path


def test_header_contains_required_fields(tmp_path: Path):
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    skip_cache = {}

    doc = {
        "file_id": "fileX",
        "segments": [
            {
                "speaker": {"code": "none"},
                "words": [
                    {
                        "token_id": "t1",
                        "start_ms": 0,
                        "end_ms": 10,
                        "lemma": "x",
                        "pos": "VERB",
                        "norm": "x",
                        "sentence_id": "s1",
                        "utterance_id": "u1",
                        "text": "X",
                        "morph": {"PastType": "a", "FutureType": "b"},
                    }
                ],
            }
        ],
    }

    ok, msg = export_to_tsv(doc, Path("fileX.json"), out_dir, skip_cache)
    assert ok, msg
    header = (out_dir / "fileX.tsv").read_text(encoding="utf-8").splitlines()[0]
    # Must include these canonical columns expected by BLF
    for col in (
        "word",
        "lemma",
        "pos",
        "PastType",
        "FutureType",
        "tokid",
        "file_id",
        "date",
        "audio_path",
    ):
        assert col in header
