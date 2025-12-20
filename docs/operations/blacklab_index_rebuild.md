# BlackLab full rebuild and cleanup (JSON→TSV→IndexTool)

Summary of actions performed (2025-11-22):

- Cleaned repo so there's exactly ONE productive index directory the app uses: `data/blacklab_index`.
- Moved many test / intermediate index directories out of the repo root to backups under `data/blacklab_index_backup/<timestamp>/`.
  - Backup directories created: `data/blacklab_index_backup/2025-11-22_17-07-05`,
    `data/blacklab_index_backup/2025-11-22_17-07-45_prebuild`,
    `data/blacklab_index_backup/precreate_20251122-173707`,
    `data/blacklab_index_backup/precreate2_20251122-173857`

What I built:
- A fresh, full rebuild of the BlackLab index from the JSON corpus using the JSON-first pipeline (JSON → TSV → IndexTool).
  - TSV export path: `data/blacklab_export/tsv_json`
  - Index input (clean): `data/blacklab_export/tsv_json/tsv_for_index` (only non-*_min.tsv files)
  - Final active index: `data/blacklab_index` (created by IndexTool)

Quick size/status check:
- `data/blacklab_index` now contains the full BlackLab index (~290 MB in this run) and is the single productive index the app uses.

How to reproduce (commands)

PowerShell (Windows) — full JSON-first rebuild and start BLS + webapp:

```powershell
# Rebuild index (JSON -> TSV -> IndexTool)
.\scripts\blacklab\build_blacklab_index.ps1 -Format json -Force

# Start BlackLab server (detached)
.\scripts\blacklab\start_blacklab_docker_v3.ps1 -Detach

# Start Flask (in dev venv)
Set-Item -Path Env:FLASK_ENV -Value 'development'
python -m src.app.main
```

Bash / Linux (WSL) equivalent:

```bash
# Rebuild index (JSON -> TSV -> IndexTool)
./scripts/blacklab/build_blacklab_index.sh json 4

# Start BlackLab (detached) via provided script or docker-compose
./scripts/blacklab/start_blacklab_docker_v3.sh -d  # if you have a bash wrapper (PowerShell script exists for Windows)

# Start Flask
python -m src.app.main
```

Smoke tests performed (passed):
- BlackLab server reachable at: `http://localhost:8081/blacklab-server/` (200)
- Webapp UI reachable at: `http://localhost:8000/search/advanced` (200)
- Webapp search proxy: `GET /search/advanced/data?q=casa&mode=lemma&length=5&draw=1` → 200 + JSON result
- API stats: `GET /api/stats?q=casa&mode=lemma&pais=VEN` → 200 + JSON result

Notes / caveats
- I preserved all raw data (media/transcripts and audio files) and did not delete any original JSON transcripts.
- All non-production index directories were moved (not deleted) into `data/blacklab_index_backup/<timestamp>/` so you can recover them if needed.
- The repository still keeps `data/blacklab_export/tsv_json/` (the TSV export from JSON) — this can be kept for inspection or removed by operators if you want to save disk space.

If you want, I can:
- remove the TSV export after confirming the index is fully validated, or
- add a small GitHub Actions workflow that runs a smoke-check after an automated rebuild.

--
Generated automatically during the full JSON→TSV→IndexTool rebuild by the maintenance script run on 2025-11-22.
