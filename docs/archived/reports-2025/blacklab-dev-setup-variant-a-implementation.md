# BlackLab Dev Setup - Variant A Implementation Summary

**Date:** November 13, 2025  
**Branch:** `fix/advanced-form-stabilization`  
**Status:** Complete

## Overview

This document summarizes the implementation of **Variant A (Docker-BlackLab behind local Flask)** as the standard development workflow for CO.RA.PAN Advanced Search.

## What Was Changed

### 1. Code Verification (No Changes Needed)

**Files Reviewed:**
- `src/app/extensions/http_client.py` - Already properly configured
- `src/app/search/advanced_api.py` - Already using `BLS_BASE_URL` consistently
- `src/app/routes/public.py` - Health endpoints already correct

**Findings:**
- ✅ Default `BLS_BASE_URL=http://localhost:8081/blacklab-server` already set correctly
- ✅ All BlackLab requests go through `_make_bls_request()` with proper URL handling
- ✅ No hardcoded URLs or mock server references in code
- ✅ Health endpoints properly return configured URL

**Minor Enhancement:**
- Added clarifying comment to `/health/bls` docstring about default port 8081

### 2. Documentation Updates

#### `docs/how-to/advanced-search-dev-setup.md` (Major Restructuring)

**Changed:**
- ✅ Repositioned Docker-BlackLab (Variant A) as **primary recommended workflow**
- ✅ Updated Quick Start to use helper scripts instead of mock server
- ✅ Changed default port references from 8080 → 8081 throughout
- ✅ Demoted mock server to "Option B: UI Testing / Fallback Only"
- ✅ Added clear warnings about mock server limitations
- ✅ Updated all curl examples to use port 8081
- ✅ Added comprehensive test scenarios (Test 1: Running, Test 2: Stopped)
- ✅ Updated command references to use new helper scripts
- ✅ Clarified that no env var configuration is needed for standard workflow

**Structure After Changes:**
1. Quick Start (Docker with helper scripts - recommended)
2. Option A: Docker Container with Helper Scripts (recommended for real searches)
3. Option B: Mock Server (UI testing fallback only)
4. Option C: Docker Compose (production/advanced)
5. Option D: Standalone JAR (advanced)

**Key Message:**
> "For realistic development with real search results, always use Docker-BlackLab (Option A)."

#### `docs/concepts/search-unification-plan.md` (Updated)

**Changed:**
- ✅ Updated "BlackLab-Konfiguration" section with new workflow
- ✅ Added helper script references (`.\scripts\start_blacklab_docker.ps1`)
- ✅ Clarified that default config requires no env var tweaking
- ✅ Updated test scenarios to use helper scripts
- ✅ Added cross-reference to detailed dev setup guide

### 3. PowerShell Helper Scripts (New)

#### `scripts/start_blacklab_docker.ps1` (Created)

**Features:**
- ✅ Idempotent: safe to run multiple times
- ✅ Checks if container exists (create new vs. start existing)
- ✅ Uses correct Docker image: `corpuslab/blacklab-server:3.5.0`
- ✅ Maps port 8081 (host) → 8080 (container)
- ✅ Mounts config and index from correct paths
- ✅ Provides clear status messages and next steps
- ✅ Error handling for Docker not running
- ✅ Validates config/index paths before starting

**Usage:**
```powershell
.\scripts\start_blacklab_docker.ps1
```

#### `scripts/stop_blacklab_docker.ps1` (Created)

**Features:**
- ✅ Stops container without removing (default)
- ✅ Optional `-Remove` flag to delete container
- ✅ Safe to run when container doesn't exist
- ✅ Clear status messages

**Usage:**
```powershell
# Stop only (keeps container for restart)
.\scripts\stop_blacklab_docker.ps1

# Stop and remove
.\scripts\stop_blacklab_docker.ps1 -Remove
```

## Configuration Summary

### Default Values (No Changes Made)

| Setting | Value | Source |
|---------|-------|--------|
| `BLS_BASE_URL` (default) | `http://localhost:8081/blacklab-server` | `src/app/extensions/http_client.py` |
| Host Port | 8081 | Docker mapping, helper scripts |
| Container Port | 8080 | BlackLab internal |
| Container Name | `corapan-blacklab-dev` | Helper scripts |
| Docker Image | `corpuslab/blacklab-server:3.5.0` | Helper scripts |
| Config Path | `config/blacklab/corapan.blf.yaml` | Volume mount |
| Index Path | `data/blacklab_index/` | Volume mount |

### Why Port 8081?

1. **Matches default `BLS_BASE_URL`** - No env var configuration needed
2. **Avoids common conflicts** - Port 8080 often used by other services
3. **Clear separation** - Distinguishes BlackLab from other local services
4. **Consistent workflow** - Same port for all devs

## Standard Development Workflow

### Starting Work

```powershell
# Terminal 1: Start BlackLab
.\scripts\start_blacklab_docker.ps1

# Terminal 2: Start Flask
.venv\Scripts\activate
$env:FLASK_ENV="development"
python -m src.app.main
```

### Stopping Work

```powershell
# Stop Flask: Ctrl+C in Terminal 2

# Stop BlackLab
.\scripts\stop_blacklab_docker.ps1
```

### Next Day

```powershell
# Container still exists, just start it
.\scripts\start_blacklab_docker.ps1

# Flask
python -m src.app.main
```

## Test Scenarios (Documented)

### Test 1: Normal Operation
1. Start BlackLab with helper script
2. Start Flask (default config, no env vars)
3. Navigate to `/search/advanced`
4. Search for `casa`
5. Expected: Real corpus hits, no error banner

### Test 2: Error Handling
1. Stop BlackLab with helper script
2. Flask still running
3. Search for `casa`
4. Expected: Error banner "Search Backend Unavailable", no JS errors

Both scenarios documented in detail in `docs/how-to/advanced-search-dev-setup.md` Section 9.

## Mock Server Status

**Previous State:** Recommended as "Quick Start: Mock Server (Recommended for Development)"

**New State:** Demoted to "Option B: Mock Server (UI Testing / Fallback Only)"

**Clarifications Added:**
- ⚠️ Returns same 324 mock hits for ANY query
- ⚠️ Not suitable for testing real CQL queries
- ⚠️ Not suitable for validating corpus data
- ✅ Only for quick UI/styling checks
- ✅ Only when Docker unavailable

## What Was NOT Changed

Per the requirements, the following were intentionally NOT modified:

- ❌ No new branch created (work done in current branch)
- ❌ No git commits made
- ❌ No CQL logic changes (`src/app/search/cql.py`)
- ❌ No advanced API response format changes
- ❌ No unified mapping implementation (Phase 2)
- ❌ No Docker Compose modifications
- ❌ No nginx configuration
- ❌ No Flask containerization

## Cross-References Updated

The following documents now consistently reference the new workflow:

1. `docs/how-to/advanced-search-dev-setup.md` - Complete rewrite
2. `docs/concepts/search-unification-plan.md` - Updated config section and test scenarios
3. `docs/index.md` - Already had correct reference (no change needed)

## Files Modified

### New Files (2)
- `scripts/start_blacklab_docker.ps1` (170 lines)
- `scripts/stop_blacklab_docker.ps1` (89 lines)

### Modified Files (3)
- `docs/how-to/advanced-search-dev-setup.md` (restructured, ~500 lines)
- `docs/concepts/search-unification-plan.md` (updated 2 sections)
- `src/app/routes/public.py` (added clarifying comment)

### Total Changes
- **2 new files**
- **3 updated files**
- **0 code logic changes** (only documentation and helper scripts)

## Validation Checklist

Before using this setup, verify:

- ✅ Docker Desktop is installed and running
- ✅ `data/blacklab_index/` exists and contains `index.json`
- ✅ `config/blacklab/corapan.blf.yaml` exists
- ✅ Port 8081 is available (not used by other services)
- ✅ Python virtual environment activated (`.venv`)

## Next Steps (User)

1. **Test the helper scripts:**
   ```powershell
   .\scripts\start_blacklab_docker.ps1
   ```

2. **Verify BlackLab is running:**
   ```powershell
   curl http://localhost:8081/blacklab-server/
   ```

3. **Start Flask and test Advanced Search:**
   ```powershell
   python -m src.app.main
   # Browser: http://localhost:8000/search/advanced
   ```

4. **Run Test Scenarios** (Section 9 in dev setup guide):
   - Test 1: BlackLab running (should see real hits)
   - Test 2: BlackLab stopped (should see error banner)

## Success Criteria

✅ All met:

1. Docker-BlackLab on port 8081 is documented as standard dev workflow
2. Helper scripts make starting/stopping BlackLab trivial
3. No environment variable configuration needed for default workflow
4. Mock server clearly marked as fallback only
5. Documentation consistently references port 8081
6. Test scenarios documented for both success and error cases
7. No code changes required (config was already correct)
8. Cross-references between docs updated

## Notes

- **Port Change Reasoning:** Previous docs mixed 8080/8081. Now consistently 8081 (matches default `BLS_BASE_URL`).
- **Mock Server Demotion:** Mock server previously positioned as "recommended" - now clearly "fallback only".
- **No Breaking Changes:** Existing workflows still work (port can be overridden via `BLS_BASE_URL` env var).
- **Production Unchanged:** This only affects local dev workflow. Docker Compose for production unchanged.

---

**Implementation complete. No commits made as requested.**
