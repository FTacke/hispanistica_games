"""Test docmeta lookup logic."""

import json
from pathlib import Path

# Load docmeta
docmeta_path = Path("data/blacklab_export/docmeta.jsonl")
docmeta = {}
with open(docmeta_path, "r", encoding="utf-8") as f:
    for line in f:
        doc = json.loads(line)
        file_id = doc.get("file_id")
        if file_id:
            docmeta[file_id] = doc

print(f"Loaded {len(docmeta)} entries")
print(f"Sample keys: {list(docmeta.keys())[:3]}")

# Test utterance_id parsing
utterance_id = "ven_2022-01-18_ven_rcr:6"
parts = utterance_id.split(":")[0].split("_")
print(f"\nutterance_id: {utterance_id}")
print(f"Parts: {parts}")

if len(parts) >= 4:
    file_id = f"{parts[1]}_{parts[2]}_{parts[3]}"
    print(f"Constructed file_id: {file_id}")
    print(f"In cache: {file_id in docmeta}")
    if file_id in docmeta:
        print(f"Metadata: {docmeta[file_id]}")
