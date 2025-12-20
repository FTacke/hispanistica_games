---
title: "Build BlackLab Index"
status: active
owner: backend-team
.\scripts\blacklab\build_blacklab_index.ps1 -Force
tags: [blacklab, how-to, index, export]
links:
  - reference/blacklab-legacy-artifacts.md
---

# Build BlackLab Index (JSON → TSV → Index)

This guide documents the supported, recommended workflow to build the BlackLab index for CO.RA.PAN.

Notes:
- Current production pipeline uses BlackLab 5.x (Lucene 9) and Docker.
- We build the index from TSV exports (`data/blacklab_export/tsv`) and use `docmeta.jsonl` for metadata lookups.

## Prerequisites
- Docker Desktop running
- Python venv activated (`.venv`)
- PowerShell (Windows) or Bash (Linux/Mac)

---

## Full automated flow (recommended)
This runs the exporter and the index builder in sequence.

```powershell
# Run from repo root (recommended: central runner)
python scripts/blacklab/run_export.py
.\scripts\blacklab\build_blacklab_index.ps1 -Force
```

- The first command generates TSV files and `data/blacklab_export/docmeta.jsonl`.
- The second command builds the Lucene index inside Docker and performs an atomic swap into `data/blacklab_index`.

---

## Manual steps
If you prefer to run the stages separately:

1. JSON → TSV export

```powershell
python -m src.scripts.blacklab_index_creation --format tsv
```

2. Ensure metadata files exist (IndexTool expects a per-document metadata directory for linked-file-dir)

```powershell
python scripts/docmeta_to_metadata_dir.py  # creates data/blacklab_export/metadata from docmeta.jsonl
```

3. Build the index

```powershell
.\scripts\blacklab\build_blacklab_index.ps1 -Force
```

---

## Implementation notes / Troubleshooting ⚠️

- IndexTool expects "linked-file-dir" (a directory with per-document JSON metadata files). `docmeta.jsonl` (single-line-per-document) is used by our app at runtime, but IndexTool requires per-file JSONs — use `scripts/docmeta_to_metadata_dir.py` to convert `docmeta.jsonl` into `data/blacklab_export/metadata/`.

- Do NOT call IndexTool to write directly into `data/blacklab_index` on Windows-mounted folders. We write into `data/blacklab_index.new` inside the container and atomically swap into place to avoid Lucene file-write/merge collisions (FileAlreadyExistsException / MergePolicy$MergeAbortedException).

- If you see errors like `Error saving index metadata` or `Merge aborted`, try:
  1. Remove existing `data/blacklab_index` (if broken) and any stale `data/blacklab_index.new`.
  2. Ensure `data/blacklab_export/metadata` exists (or re-generate from `docmeta.jsonl`).
  3. Re-run `.\scripts\build_blacklab_index.ps1 -Force`.

- IndexTool CLI options vary by image version; the current script uses `--linked-file-dir` (not `--docmeta`). If you use a different image check supported args.

---

## See also
- [BlackLab Pipeline Architecture](../concepts/blacklab-pipeline.md)
- [BlackLab Configuration Reference](../reference/blacklab-configuration.md)
- [BlackLab Legacy Artifacts](../reference/blacklab-legacy-artifacts.md)
