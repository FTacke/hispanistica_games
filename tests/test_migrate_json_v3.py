import json
from pathlib import Path

import importlib.util

_mod_path = Path(__file__).resolve().parents[1] / "scripts" / "migrate_json_v3.py"
spec = importlib.util.spec_from_file_location("migrate_json_v3", str(_mod_path))
mig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mig)
migrate_file = mig.migrate_file


def test_migrate_moves_legacy_top_level(tmp_path: Path):
    p = tmp_path / "sample.json"
    doc = {
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
                        "past_type": "legacyPast",
                        "future_type": "legacyFuture",
                    }
                ],
            }
        ]
    }

    p.write_text(json.dumps(doc, ensure_ascii=False))

    migrate_file(p)

    data = json.loads(p.read_text(encoding="utf-8"))
    morph = data["segments"][0]["words"][0]["morph"]
    assert morph["PastType"] == "legacyPast"
    assert morph["FutureType"] == "legacyFuture"
