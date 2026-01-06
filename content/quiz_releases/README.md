# Quiz Content Releases

Version-controlled quiz content releases for production deployment.

## Release Structure

Each release is a timestamped snapshot of quiz content ready for deployment:

```
content/quiz_releases/
├── README.md                          # This file
├── YYYY-MM-DD_HHMM/                  # Release timestamp (ISO 8601)
│   ├── topics/                        # Quiz topics (JSON files)
│   │   ├── aussprache.json
│   │   ├── orthographie.json
│   │   └── ...
│   ├── media/                         # Media assets
│   │   ├── audio/                     # Audio snippets (.mp3, .ogg)
│   │   └── images/                    # Images (if needed)
│   └── RELEASE_NOTES.md               # Release metadata & changelog
└── latest -> YYYY-MM-DD_HHMM/        # Symlink to current release (local dev only)
```

## Release Naming Convention

Format: `YYYY-MM-DD_HHMM`

**Examples:**
- `2026-01-06_1430` - Released Jan 6, 2026 at 14:30
- `2026-02-15_0900` - Released Feb 15, 2026 at 09:00

**Rationale:** 
- Sortable chronologically
- Unambiguous timezone (use UTC or local + document)
- Minute precision sufficient for manual releases

## Creating a Release

### 1. Prepare Content

Ensure all content in `content/quiz/topics/` is:
- Normalized: `python scripts/quiz_units_normalize.py --check`
- Validated: `python scripts/quiz_units_normalize.py --write` (if needed)
- Tested locally: `python scripts/quiz_seed.py --seed`

### 2. Create Release Directory

```powershell
# Create release directory
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$releasePath = "content/quiz_releases/$timestamp"
New-Item -ItemType Directory -Path $releasePath

# Copy content
Copy-Item -Recurse content/quiz/topics $releasePath/
New-Item -ItemType Directory -Path $releasePath/media/audio
New-Item -ItemType Directory -Path $releasePath/media/images

# Copy media if exists
if (Test-Path static/quiz-media) {
    Copy-Item static/quiz-media/* $releasePath/media/audio/ -Recurse
}

# Create release notes
@"
# Release $timestamp

## Changes
- [Describe changes here]

## Topics Included
- [List topics or use: ls topics/*.json]

## Validation
- Normalized: ✅ / ❌
- Seeded locally: ✅ / ❌
- Tests passed: ✅ / ❌

## Deployment
- Target: production / staging
- Deployed by: [name]
- Deployed at: [timestamp]
"@ | Out-File $releasePath/RELEASE_NOTES.md

Write-Host "Release created: $releasePath"
```

### 3. Update Symlink (Local Dev)

```powershell
# Windows (requires admin or developer mode)
if (Test-Path content/quiz_releases/latest) {
    (Get-Item content/quiz_releases/latest).Delete()
}
New-Item -ItemType SymbolicLink -Path content/quiz_releases/latest -Target $timestamp
```

**Note:** Symlink is for local convenience only. Production uses explicit release paths.

## Deploying to Production

### One-Command Deployment (Recommended)

Use the automated deployment script for safe, atomic releases with automatic rollback:

```bash
# Standard deployment with soft pruning
python scripts/release_deploy.py \
  --release 2026-01-06_1430 \
  --ssh root@marele.online.uni-marburg.de \
  --media-root /srv/webapps/games_hispanistica/media \
  --container games-webapp \
  --prune soft

# Dry-run to preview changes
python scripts/release_deploy.py \
  --release 2026-01-06_1430 \
  --ssh root@marele.online.uni-marburg.de \
  --dry-run

# Deploy without import (only rsync + switch)
python scripts/release_deploy.py \
  --release 2026-01-06_1430 \
  --ssh root@marele.online.uni-marburg.de \
  --no-import
```

**What this does:**
1. ✅ Validates local release (topics exist, JSON valid)
2. 📤 Rsyncs release to server (`/media/releases/{release}/`)
3. 🔗 Switches `current` symlink atomically
4. 📦 Runs `quiz_seed.py` inside container
5. 🏥 Health check on app endpoint
6. 🔄 **Automatic rollback** if any step fails

**Exit codes:**
- `0` - Success
- `10` - Validation failed
- `20` - Rsync failed
- `30` - Symlink switch failed
- `40` - Import failed (after rollback)
- `50` - Health check failed (after rollback)

### Manual Deployment (Advanced)

If you need fine-grained control or custom workflow:

#### Option A: rsync (Direct to Server)

```bash
# Sync specific release to production server
rsync -avz --delete \
  content/quiz_releases/2026-01-06_1430/ \
  user@prod-server:/srv/webapps/games_hispanistica/media/releases/2026-01-06_1430/

# Switch current symlink
ssh user@prod-server \
  "cd /srv/webapps/games_hispanistica/media && ln -sfn releases/2026-01-06_1430 current"

# Import into database
ssh user@prod-server \
  "docker exec games-webapp python scripts/quiz_seed.py --prune-soft"
```

#### Option B: Docker Volume (Docker-based Deployment)

```bash
# Copy release into running container
docker cp content/quiz_releases/2026-01-06_1430/topics/. \
  hispanistica_web:/app/content/quiz/topics/

docker cp content/quiz_releases/2026-01-06_1430/media/audio/. \
  hispanistica_web:/app/static/quiz-media/
```

## Release Workflow Summary

1. **Develop** → Edit `content/quiz/topics/*.json` locally
2. **Validate** → `python scripts/quiz_units_normalize.py --write`
3. **Test** → `python scripts/quiz_seed.py --seed` + manual testing
4. **Release** → Create timestamped directory in `quiz_releases/`
5. **Deploy** → `python scripts/release_deploy.py --release YYYY-MM-DD_HHMM --ssh user@host`
6. **Verify** → Health check passes automatically, or manual smoke test

**One-liner for production deployment:**
```bash
python scripts/release_deploy.py --release 2026-01-06_1430 --ssh root@marele.online.uni-marburg.de
```

## Production Deployment Checklist

- [ ] All topics normalized (`python scripts/quiz_units_normalize.py --check`)
- [ ] Release directory created with timestamp
- [ ] RELEASE_NOTES.md filled out
- [ ] Media files included (if changed)
- [ ] Tested locally with `quiz_seed.py --seed`
- [ ] Production backup created (optional, data preserved during rollback)
- [ ] **Run deployment:** `python scripts/release_deploy.py --release YYYY-MM-DD_HHMM --ssh user@host`
- [ ] Verify health check passes (automatic in deploy script)
- [ ] Manual smoke test on production (open quiz, play through)
- [ ] Release directory tagged in git (optional)

## Git Integration (Optional)

Release directories can be:
- **Committed** (recommended for small content, full history)
- **Gitignored** (if content is large, managed separately)

Current approach: **Content is gitignored**, releases managed via rsync/deployment scripts.

If committing releases:
```bash
git add content/quiz_releases/2026-01-06_1430/
git commit -m "Release quiz content 2026-01-06_1430"
git tag quiz-release-2026-01-06_1430
```

## Rollback Procedure

**Automatic rollback:** The deployment script automatically rolls back on failure.

**Manual rollback:**

```bash
# List available releases on server
ssh user@prod-server "ls /srv/webapps/games_hispanistica/media/releases/"

# Deploy older release
python scripts/release_deploy.py \
  --release 2026-01-05_1200 \
  --ssh root@marele.online.uni-marburg.de

# Or manually switch current symlink
ssh user@prod-server \
  "cd /srv/webapps/games_hispanistica/media && ln -sfn releases/2026-01-05_1200 current"

# Re-seed database
ssh user@prod-server \
  "docker exec games-webapp python scripts/quiz_seed.py --prune-soft"
```

**What gets rolled back:**
- ✅ Current symlink (points to previous release)
- ✅ Quiz content served by app
- ✅ Database import (previous topics re-activated)

**What is NOT rolled back:**
- ❌ Player data (runs, scores) - **never deleted**
- ❌ Uploaded release files (kept in `releases/` directory)

## Architecture Notes

**Release Directory Structure on Server:**
```
/srv/webapps/games_hispanistica/media/
├── releases/
│   ├── 2026-01-05_1200/    # Previous release
│   ├── 2026-01-06_1430/    # Current release
│   └── 2026-01-10_0900/    # Future release
└── current -> releases/2026-01-06_1430  # Symlink (atomic switch)
```

**Container Mount:**
- Host: `/srv/webapps/games_hispanistica/media`
- Container: `/app/media`
- Topics path in container: `/app/media/current/topics/*.json`

**Atomic Deployment:**
1. New release synced to `releases/{name}/`
2. Symlink switched: `current -> releases/{name}` (atomic via `ln -sfn`)
3. Container reads from `/app/media/current/topics/` (no restart needed)
4. If failure: symlink reverted, old content immediately active

## Notes

- Releases are **immutable** - never modify a deployed release directory
- Use new timestamp for any content changes
- Media files are **versioned per release** (no shared media pool yet)
- Consider cleanup policy: keep last N releases, archive older ones
- Symlink `latest/` is local-only, not deployed to production

## Future Enhancements

- [ ] Automated release script (`scripts/create_quiz_release.py`)
- [ ] Shared media pool (deduplicate audio files across releases)
- [ ] Release diff tool (compare two releases)
- [ ] Automated deployment via CI/CD
- [ ] Release signing/verification
