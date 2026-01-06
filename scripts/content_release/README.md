# Content Release Scripts

⚠️  **REPO-ONLY SCRIPTS - NO SERVER EXECUTION**

This directory contains scripts for preparing and uploading content releases.
These scripts run on the local development machine, **not on the production server**.

## Purpose

- **rsync-Wrapper**: Encapsulates rsync commands for content upload
- **Validation**: Pre-upload checks (structure, required files)
- **Documentation**: Best practices for content releases

## Production Content Pipeline

### 1. Prepare Content (Local, outside Repo)

```
C:\content\games_hispanistica\2026-01-06_1430\
├── units\
│   ├── unit_001.json
│   └── unit_002.json
└── audio\
    ├── intro.mp3
    └── question_001_a.mp3
```

**Important:**
- Content lives OUTSIDE the Git repository
- Release-ID format: `YYYY-MM-DD_HHMM`
- All JSON files must contain stable IDs (unit_id, question_id, answer_id)

### 2. Normalize Content (Pre-Upload)

```powershell
# Ensure IDs and statistics are correct
python scripts/quiz_units_normalize.py --write `
  --topics-dir C:\content\games_hispanistica\2026-01-06_1430\units
```

### 3. Upload via rsync

```powershell
# Dry-run (recommended first)
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "2026-01-06_1430" `
  -LocalPath "C:\content\games_hispanistica\2026-01-06_1430" `
  -ServerUser "ftacke" `
  -ServerHost "marele.online.uni-marburg.de"

# Real upload (with -Execute flag)
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "2026-01-06_1430" `
  -LocalPath "C:\content\games_hispanistica\2026-01-06_1430" `
  -ServerUser "ftacke" `
  -ServerHost "marele.online.uni-marburg.de" `
  -Execute
```

### 4. Activate & Import (Server)

**SSH into server:**
```bash
# Set symlink to new release
cd /srv/webapps/games_hispanistica/media
ln -sfn releases/2026-01-06_1430 current

# Import content
./manage import-content \
  --units-path media/current/units \
  --audio-path media/current/audio \
  --release 2026-01-06_1430

# Publish (make live)
./manage publish-release --release 2026-01-06_1430
```

**Or via Admin Dashboard:**
- Navigate to "System → Content-Releases"
- Select release `2026-01-06_1430`
- Click "Import" → Wait for completion
- Click "Publish"

## Files in this Directory

- `sync_release.ps1` - rsync wrapper for content upload
- `README.md` - This file

## Important Notes

- **Never** upload directly to `media/current/` - always use release folders
- **Never** use `--delete` flag unless you understand the implications
- **Always** run dry-run first (`-DryRun` or without `-Execute`)
- **Never** commit content files to Git - content stays outside repository

## See Also

- [games_hispanistica_production.md](../../games_hispanistica_production.md) - Full production documentation
- [startme.md](../../startme.md) - Local development setup (DEV-only)
