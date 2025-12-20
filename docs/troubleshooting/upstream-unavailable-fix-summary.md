# upstream_unavailable Fix - Summary

**Date:** November 13, 2025  
**Status:** ✅ RESOLVED (Connection fixed, index migration pending)

## Problem

Advanced Search returned `upstream_unavailable` error:
```json
{
  "error": "upstream_unavailable",
  "message": "Search backend (BlackLab) is currently not reachable..."
}
```

UI showed Material Design 3 error banner: "Search Backend Unavailable".

## Root Causes Identified & Fixed

### 1. ✅ Docker Image Wrong

### 2. ✅ Volume Mounts Incorrect
  - Config dir: `config/blacklab/` → `/etc/blacklab` (includes `blacklab-server.yaml`)
  - Index dir: `data/blacklab_index/` → `/data/index` (matches BLS default)

**File:** `scripts/blacklab/start_blacklab_docker_v3.ps1`
 **Files:** `scripts/blacklab/start_blacklab_docker_v3.ps1`, `config/blacklab/blacklab-server.yaml`
- **Fix:** Created minimal config with `indexLocations: [/data/index]`
- **File:** `config/blacklab/blacklab-server.yaml`

### 4. ⚠️ Index Lucene Version Mismatch (Pending)
- **Problem:** Existing index uses Lucene 8.11.1, BLS 5.0 requires Lucene 9.x
- **Status:** **Index must be rebuilt** from TSV sources
- **Workaround:** System detects BLS as available but returns `upstream_error` (HTTP 500) instead of `upstream_unavailable`
- **Documentation:** See `docs/troubleshooting/blacklab-index-lucene-migration.md`

## Current State (After Fix)

### ✅ Connection Works

```powershell
PS> Invoke-WebRequest -Uri "http://localhost:8000/health/bls"
```
```json
{
  "ok": true,
  "url": "http://localhost:8081/blacklab-server",
  "status_code": 200,
  "error": null
}
```

**Before:** `"ok": false, "error": "Connection refused"`  
**After:** `"ok": true` (even with index issue, connection is established)

### ⚠️ Index Issue (Expected)

```powershell
PS> # Query for "casa"
```
```json
{
  "error": "upstream_error",
  "message": "BlackLab Server error: 500",
  ...
}
```

**This is correct behavior!** The error changed from:
- ❌ `upstream_unavailable` (connection problem)
- ✅ `upstream_error` (server-side problem - index)

## What Changed in Code

### Docker Start Script
- Image: `instituutnederlandsetaal/blacklab:latest`
- Port: Host 8081 → Container 8080
- Volumes:
  - Config: `config/blacklab:/etc/blacklab:ro`
  - Index: `data/blacklab_index:/data/index:rw`

### New Config File
Created `config/blacklab/blacklab-server.yaml`:
```yaml
indexLocations:
  - /data/index
allowCreateIndex: false
performance:
  maxConcurrentSearches: 4
```

### Documentation
- Updated `docs/how-to/advanced-search-dev-setup.md` with correct setup
- Created `docs/troubleshooting/blacklab-index-lucene-migration.md`
- Updated `startme.md` with complete workflow

## Next Steps (For Real Data)

1. **Rebuild Index** from TSV sources in `data/blacklab_index.backup/tsv/`
2. **Verify** with real query (e.g., "casa" should return hits)
3. **Test** full search pipeline with metadata filters

## Testing the Fix

### Test 1: Health Check
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/health/bls" -UseBasicParsing
```
Expected: `"ok": true` ✅

### Test 2: Flask → BLS Connection
```powershell
docker logs corapan-blacklab-dev --tail 10
```
Expected: No "Connection refused" in Flask logs ✅

### Test 3: Advanced Search (with index migration pending)
Open browser: `http://localhost:8000/search/advanced`  
Query: `casa`  
Expected: Error message changes from "Backend Unavailable" to "Server Error" ✅

## Conclusion

**✅ Primary Issue Resolved:** `upstream_unavailable` is fixed.  
**✅ Infrastructure Working:** Flask ↔ Docker ↔ BlackLab connection established.  
**⚠️ Index Migration Pending:** Requires manual rebuild for real search results.

The system is now correctly detecting the difference between:
1. **Connection failure** (`upstream_unavailable`) - **FIXED**
2. **Server error** (`upstream_error`) - Expected until index is rebuilt
