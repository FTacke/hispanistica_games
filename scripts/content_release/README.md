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

**Destination Path:** Files are uploaded to:
```
/srv/webapps/games_hispanistica/media/releases/<release_id>/
```

**Using run_release_upload.ps1 (Recommended):**
```powershell
# Interactive - walks you through the process
.\scripts\content_release\run_release_upload.ps1

# Non-interactive
.\scripts\content_release\run_release_upload.ps1 `
  -ReleaseId "2026-01-06_1430" `
  -ServerUser "ftacke" `
  -ServerHost "marele.online.uni-marburg.de" `
  -NonInteractive `
  -Force
```

**Using sync_release.ps1 directly:**
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

**WSL rsync fallback:**
- Scripts automatically detect and use WSL rsync if native rsync is not available
- Windows paths (C:/) are converted to WSL format (/mnt/c/)
- No special configuration needed!

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

- `run_release_upload.ps1` - **New!** Interactive release upload wrapper (recommended)
- `sync_release.ps1` - Low-level rsync wrapper for content upload
- `Release-Upload-Helper.ps1` - PowerShell function for quick uploads
- `debug_release.ps1` - Debug helper
- `README.md` - This file

## Quickstart: run_release_upload.ps1

The **recommended** way to upload releases interactively with validation and safety checks.

### Interactive Mode (Default)

```powershell
# Navigate to repo root
cd C:\dev\hispanistica_games

# Run interactive upload
.\scripts\content_release\run_release_upload.ps1
```

This will:
1. **List available releases** from `content/quiz_releases/`
2. **Prompt you to select** by number (e.g., `[1]`) or name (e.g., `20260106_2200`)
3. **Validate** the release structure (units/, *.json files)
4. **Ask for server params** (defaults: root@games.hispanistica.com)
5. **Run dry-run first** (safe - shows what would be uploaded)
6. **Show the file list** from rsync
7. **Confirm before executing** real upload
8. **Display next steps** for server-side import/publish

### Non-Interactive Mode (CI/CD)

```powershell
.\scripts\content_release\run_release_upload.ps1 `
  -ReleaseId "20260106_2200" `
  -ServerUser "root" `
  -ServerHost "games.hispanistica.com" `
  -NonInteractive `
  -Force
```

Parameters:
- `-ReleaseId` - Release folder name (or index number as string)
- `-ReleaseRoot` - Root directory (default: `.\content\quiz_releases`)
- `-ServerUser` - SSH username (default: `root`)
- `-ServerHost` - Server hostname (default: `games.hispanistica.com`)
- `-ServerBasePath` - Server path (default: `/srv/webapps/games_hispanistica/media`)
- `-NonInteractive` - Skip all prompts (requires -ReleaseId)
- `-Force` - Auto-confirm all prompts (use with care!)
- `-Execute` - Execute immediately without interactive dry-run review
- `-ConfirmExecute` - Auto-confirm dry-run prompt

### Advanced: With Remote Execution

```powershell
.\scripts\content_release\run_release_upload.ps1 `
  -ReleaseId "20260106_2200" `
  -ServerHost "marele.online.uni-marburg.de" `
  -ServerUser "ftacke" `
  -RunRemote `
  -RemoteContainer "games-webapp"
```

Parameters:
- `-RunRemote` - Execute server-side steps via SSH (symlink, import, publish)
- `-RemoteAppPath` - Server app path (default: `/srv/webapps/games_hispanistica/app`)
- `-RemoteMediaPath` - Server media path (default: `/srv/webapps/games_hispanistica/media`)
- `-RemoteContainer` - Docker container name (if empty, no docker exec)

### Example: Single Release Upload

```powershell
# Assuming content at: C:\dev\hispanistica_games\content\quiz_releases\20260106_2200
# With: units/unit_*.json and optional audio/

# Just run it!
.\scripts\content_release\run_release_upload.ps1

# Select [1] for 20260106_2200
# Press Enter for defaults
# Review dry-run output
# Type 'y' to execute
```

## Quick Upload (using Helper Function)

**Load helper:**
```powershell
. .\scripts\content_release\Release-Upload-Helper.ps1
```

**Dry-run:**
```powershell
rupload -Id 20260106_2200 -DryRun
```

**Real upload:**
```powershell
rupload -Id 20260106_2200 -Execute
```

**Assumptions:**
- Content location: `C:\content\quiz_releases\release_20260106_2200\`
- Server user: `root`
- Server host: `games.hispanistica.com`

## Step-by-Step Example (Your Setup)

**Your release folder:**
```
C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200\
├── units\
│   ├── topic_001.json
│   └── ...
└── audio\
    ├── audio_001.mp3
    └── ...
```

### Using run_release_upload.ps1 (Recommended)

```powershell
# Interactive - just run it!
.\scripts\content_release\run_release_upload.ps1

# Or specify release
.\scripts\content_release\run_release_upload.ps1 -ReleaseId "20260106_2200"
```

### Using sync_release.ps1 (Low-Level)

**Step 1: Dry-run** (shows what will be uploaded)
```powershell
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "release_20260106_2200" `
  -LocalPath "C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200" `
  -ServerUser "root" `
  -ServerHost "games.hispanistica.com"
```

**Step 2: Real upload** (with -Execute flag)
```powershell
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "release_20260106_2200" `
  -LocalPath "C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200" `
  -ServerUser "root" `
  -ServerHost "games.hispanistica.com" `
  -Execute
```

**Step 3: Server-side import** (SSH session)
```bash
ssh root@games.hispanistica.com
cd /srv/webapps/games_hispanistica/app

# Prepare
cd ../media && ln -sfn releases/release_20260106_2200 current && cd ../app

# Import (status: draft, not visible yet)
python manage.py import-content \
  --units-path media/current/units \
  --audio-path media/current/audio \
  --release release_20260106_2200

# Publish (status: published, now visible)
python manage.py publish-release --release release_20260106_2200
```

## Troubleshooting

### "rsync not found" Error

**Problem:** Script exits with "rsync not found. Please install rsync..."

**Solution:** Install rsync for Windows:
- **Option 1 (Recommended):** Use WSL (Windows Subsystem for Linux)
  ```powershell
  wsl apt install rsync
  ```
- **Option 2:** Use Cygwin and add to PATH
- **Option 3:** Install cwRsync (native Windows rsync)
  ```powershell
  # Requires chocolatey
  choco install cwrsync
  ```

### "Parser Error" with PowerShell 5.1

**Problem:** Script fails with syntax error in PowerShell 5.1

**Solution:** This is a known issue with PS7-only syntax. Our scripts are tested for PS5.1 compatibility.
- Check your PowerShell version: `$PSVersionTable.PSVersion`
- Use Windows PowerShell 5.1 (built-in) or upgrade to PowerShell 7+ if errors persist
- Report issues: check for `&&` operator outside strings (not PS5.1 compatible)

### "SSH key not found"

**Problem:** rsync prompts for password or fails with "Permission denied"

**Solution:** Set up SSH key authentication:
```powershell
# Generate key (if not exists)
ssh-keygen -t rsa -b 4096 -f $env:USERPROFILE\.ssh\id_rsa

# Copy to server
ssh-copy-id -i $env:USERPROFILE\.ssh\id_rsa.pub root@games.hispanistica.com

# Test
ssh root@games.hispanistica.com "echo OK"
```

### "units/ directory missing" Error

**Problem:** Release validation fails

**Solution:** Ensure release structure:
```
content/quiz_releases/20260106_2200/
├── units/
│   ├── unit_001.json  (at least one required)
│   └── unit_002.json  (optional, any count)
└── audio/  (optional, can be empty)
    └── ...
```

### "No *.json files found" Error

**Problem:** Release has units/ but no *.json files

**Solution:** 
- Verify JSON files are in `units/` subdirectory
- Check file extension is exactly `.json` (lowercase)
- Ensure files are not empty/corrupted

### Selection Not Working

**Problem:** Numbers don't correspond to release list

**Solution:** 
- Run without `-NonInteractive` for interactive selection
- Try entering release name directly instead of number
- Check for special characters in folder names (avoid spaces, special chars)

### Performance: Slow Upload

**Problem:** rsync takes a very long time

**Solution:**
- Check network latency: `ping games.hispanistica.com`
- Verify rsync compression: `-avz` flag is enabled (should help)
- Consider large audio files: rsync will upload all changes
- Monitor server SSH load: `ssh ... "top -b -n1"`

## Testing

Run Pester tests to validate scripts:

```powershell
# Install Pester (if not present)
Install-Module -Name Pester -Force -SkipPublisherCheck

# Run tests
Invoke-Pester -Path tests/powershell/RunReleaseUpload.Tests.ps1 -Verbose
```

Tests cover:
- Release listing and filtering (excludes EXAMPLE_RELEASE, .keep)
- Release validation (units/, *.json requirements)
- Selection by index and by name
- Dry-run as default
- Execute confirmation flow
- Server parameter handling

## Step-by-Step Example (Your Setup)

**Your release folder:**
```
C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200\
├── units\
│   ├── topic_001.json
│   └── ...
└── audio\
    ├── audio_001.mp3
    └── ...
```

**Step 1: Dry-run** (shows what will be uploaded)
```powershell
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "release_20260106_2200" `
  -LocalPath "C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200" `
  -ServerUser "root" `
  -ServerHost "games.hispanistica.com"
```

**Step 2: Real upload** (with -Execute flag)
```powershell
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "release_20260106_2200" `
  -LocalPath "C:\dev\games_hispanistica\content\quiz_releases\release_20260106_2200" `
  -ServerUser "root" `
  -ServerHost "games.hispanistica.com" `
  -Execute
```

**Step 3: Server-side import** (SSH session)
```bash
ssh root@games.hispanistica.com
cd /srv/webapps/games_hispanistica/app

# Prepare
cd ../media && ln -sfn releases/release_20260106_2200 current && cd ../app

# Import (status: draft, not visible yet)
python manage.py import-content \
  --units-path media/current/units \
  --audio-path media/current/audio \
  --release release_20260106_2200

# Publish (status: published, now visible)
python manage.py publish-release --release release_20260106_2200
```

## Checklist for Every Upload

See [RELEASE_UPLOAD_CHECKLIST.md](../../RELEASE_UPLOAD_CHECKLIST.md) for detailed checklist.

## Important Notes

- **Never** upload directly to `media/current/` - always use release folders
- **Never** use `--delete` flag unless you understand the implications
- **Always** run dry-run first (`-DryRun` or without `-Execute`)
- **Never** commit content files to Git - content stays outside repository

## See Also

- [games_hispanistica_production.md](../../games_hispanistica_production.md) - Full production documentation
- [startme.md](../../startme.md) - Local development setup (DEV-only)
