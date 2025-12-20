# Advanced Search Dev Setup: BlackLab Configuration & Troubleshooting

**Date:** November 13, 2025  
**Author:** GitHub Copilot  
**Audience:** Developers working on the Advanced Search feature  
**Status:** Complete

## Overview

The Advanced Search feature requires a running **BlackLab Server** instance. This guide explains:

1. How BlackLab is configured in the app
2. How to start BlackLab locally for development (Docker recommended)
3. How to diagnose issues when BlackLab is unavailable
4. What happens in the UI when BlackLab goes offline

---

## 1. BlackLab Configuration

### Quick Start for Windows Development (Recommended)

**Standard development workflow with real search results:**

```powershell
# Terminal 1: Start BlackLab in Docker (real index, real searches)
.\scripts\blacklab\start_blacklab_docker_v3.ps1 -Detach

# Terminal 2: Start Flask (uses default BLS_BASE_URL)
.venv\Scripts\activate
$env:FLASK_ENV="development"
python -m src.app.main

# Test in browser: http://localhost:8000/search/advanced
# Search for real tokens like "casa" - returns actual corpus hits
```

**Why this is the recommended approach:**
- ✅ Uses the actual BlackLab index from `data/blacklab_index/`
- ✅ Returns real search results based on your queries
- ✅ Tests the full search pipeline with real CQL and metadata
- ✅ Works exactly like production (same Docker image)
- ✅ No environment variable configuration needed (uses default port 8081)

---

### Environment Variable

The app communicates with BlackLab via the `BLS_BASE_URL` environment variable:

```bash
# Default (if not set) - for local Docker-BlackLab on host port 8081
BLS_BASE_URL=http://localhost:8081/blacklab-server

# Override manually if needed (e.g., different port or remote server)
export BLS_BASE_URL=http://localhost:8080/blacklab-server

# Or in passwords.env (read on app startup)
BLS_BASE_URL=http://localhost:8080/blacklab-server
```

**Important:** The default value (`http://localhost:8081/blacklab-server`) is configured to work with the standard Docker setup (Option A below). If you use the recommended PowerShell scripts, no environment variable configuration is needed.

### Configuration Location

- **Environment variable:** `BLS_BASE_URL`
- **Default value:** `http://localhost:8081/blacklab-server` (Docker-BlackLab on local dev, port 8081)
- **Code location:** `src/app/extensions/http_client.py`
- **Setup method:** Uses default, or override via `passwords.env` / shell export

**Note:** The default is intentionally set to port `8081` to match the recommended Docker setup. This avoids conflicts with other services often running on port `8080` and provides a clean separation for development.

### What URL Should Point To?

BlackLab exposes two interfaces:

| Interface       | Purpose                              | Example URL                           |
|-----------------|--------------------------------------|---------------------------------------|
| **FCS** (Search)| REST API for search, exports, etc.  | `http://localhost:8081/blacklab-server` |
| **GUI**         | Web interface (optional)            | `http://localhost:8081/blacklab-server-gui` |

The app uses the **FCS interface** for CQL queries, metadata filtering, and hit retrieval.

---

## 2. Starting BlackLab Locally

### Option A (Recommended): Docker Container with Helper Scripts

**For Windows development, use the provided PowerShell scripts:**

```powershell
# Start BlackLab (creates container if needed, starts if stopped)
.\scripts\blacklab\start_blacklab_docker_v3.ps1 -Detach

# Stop BlackLab (keeps container for next start)
.\scripts\blacklab\stop_blacklab_docker.ps1
```

**What this does:**
- Creates/starts a Docker container named `corapan-blacklab-dev`
- Uses image: `instituutnederlandsetaal/blacklab:5.0.0` (official BlackLab Server, pinned)
- Maps host port **8081** to container port 8080
- Mounts `config/blacklab/` as `/etc/blacklab` (read-only config)
- Mounts `data/blacklab_index/` as `/data/index` (read-write index storage)
- URL: `http://localhost:8081/blacklab-server`

**Important:** This Docker setup only runs the BlackLab Server. The index must be pre-built using the canonical Docker-based index build script (`scripts/blacklab/build_blacklab_index.ps1`). The Docker image does NOT include indexing tools for exporting JSON→TSV.

**⚠️ Known Issue: Index Migration Required**

The existing index was built with Lucene 8.11.1, but the current BlackLab Docker image uses Lucene 9.x.  
**Symptoms:** Container starts, but queries return HTTP 500 errors.  
**Solution:** Rebuild the index using the JAR-based IndexTool script:

```powershell
# Rebuild BlackLab index from TSV sources (use the canonical Docker-based build)
.\scripts\blacklab\build_blacklab_index.ps1 -Force

# Then start BlackLab normally
.\scripts\blacklab\start_blacklab_docker_v3.ps1 -Detach
```

**For detailed information about the index migration and JAR setup, see:**  
📖 [BlackLab Index Lucene Migration Guide](../troubleshooting/blacklab-index-lucene-migration.md)  
📖 [Local Workflow README](../../LOKAL/01 - Add New Transcriptions/README.md)

---

**Manual Docker command (if you prefer):**

```bash
# Start BlackLab on port 8081 (maps to internal port 8080)
docker run -d \
  --name corapan-blacklab-dev \
  -p 8081:8080 \
  -v "$(pwd)/config/blacklab/corapan.blf.yaml:/etc/blacklab/corapan.blf.yaml:ro" \
  -v "$(pwd)/data/blacklab_index:/var/lib/blacklab/index:rw" \
  corpuslab/blacklab-server:3.5.0

# Verify it's running
curl -s http://localhost:8081/blacklab-server/ | head -20
# Should return XML/JSON with BlackLab server info
```

**Why port 8081?**
- Matches the default `BLS_BASE_URL` in the code
- Avoids conflicts with other services on port `8080`
- No environment variable setup needed for standard dev workflow

### Option B: Mock Server (UI Testing / Fallback Only)

**Use only for rapid UI testing or when Docker is not available.**

```powershell
# Windows PowerShell - Start mock server in separate window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; python scripts/mock_bls_server.py 8081"

# Or run directly in current terminal
python scripts/mock_bls_server.py 8081
```

**What the mock provides:**
- ✅ Realistic response structure matching real BlackLab API
- ✅ 324 mock hits with KWIC data (left, match, right)
- ✅ Pagination and metadata support
- ✅ Fast startup (no index building required)
- ⚠️ **Critical limitation:** Returns same 324 mock hits for ANY query (not real search results)

**When to use mock:**
- Quick UI/styling verification
- DataTables integration testing
- Error banner/handling development
- When Docker is unavailable

**When NOT to use mock:**
- Testing actual CQL queries
- Validating metadata filtering
- Verifying corpus data accuracy
- Any feature development requiring real search results

### Option C: Docker Compose (Production / Advanced)

If you want to manage BlackLab alongside the Flask app in production, add a service to `docker-compose.yml`:

```yaml
services:
  # ... existing web service ...
  
  blacklab:
    image: corpuslab/blacklab-server:3.5.0
    container_name: corapan-blacklab-dev
    ports:
      - "8081:8080"
    volumes:
      - ./config/blacklab/corapan.blf.yaml:/etc/blacklab/corapan.blf.yaml:ro
      - ./data/blacklab_index:/var/lib/blacklab/index:rw
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 10s

  web:
    # ... existing config ...
    environment:
      BLS_BASE_URL: "http://blacklab:8080/blacklab-server"
    depends_on:
      - blacklab
```

Then start with:
```bash
docker-compose up -d blacklab
docker-compose up -d web
```

### Option D: Standalone JAR (Advanced / If Available)

If you have a BlackLab JAR file locally:

```bash
# Start BlackLab Server from JAR
java -jar blacklab-server.jar \
  --port 8080 \
  --config config/blacklab/corapan.blf.yaml \
  --index data/blacklab_index/
```

**Note:** You would need to set `BLS_BASE_URL=http://localhost:8080/blacklab-server` in this case.

**IndexTool Usage:**  
The same JAR contains the IndexTool for building indices. See:  
📖 [tools/blacklab/README.md](../../tools/blacklab/README.md) for download instructions  
📖 [scripts/blacklab/build_blacklab_index.ps1](../../scripts/blacklab/build_blacklab_index.ps1) for usage examples

---

## 3. Checking BlackLab Status

### Quick Health Check

```bash
# Check if BlackLab is responding (from host)
curl -s http://localhost:8081/blacklab-server/ | head -5

# Check via the app's health endpoint (shows what Flask sees)
curl -s http://localhost:8000/health/bls | jq .
# Response:
# {
#   "ok": true,
#   "url": "http://localhost:8081/blacklab-server",
#   "status_code": 200,
#   "error": null
# }
```

**Note:** The default setup uses port `8081` (not `8080`) to match the default `BLS_BASE_URL`. All examples below use port `8081`.

### Using the App's Health Endpoints

**Check overall app + BlackLab:**
```bash
curl -s http://localhost:8000/health | jq .

# Response (BlackLab healthy):
# {
#   "status": "healthy",
#   "service": "corapan-web",
#   "checks": {
#     "flask": {"ok": true},
#     "blacklab": {"ok": true, "url": "http://localhost:8081/blacklab-server", "error": null}
#   }
# }

# Response (BlackLab unavailable):
# {
#   "status": "degraded",
#   "service": "corapan-web",
#   "checks": {
#     "flask": {"ok": true},
#     "blacklab": {"ok": false, "url": "http://localhost:8081/blacklab-server", 
#                  "error": "Connection refused (check if BlackLab is running at ...)"}
#   }
# }
```

**Check BlackLab only:**
```bash
curl -s http://localhost:8000/health/bls | jq .

# Response (healthy):
# {"ok": true, "url": "http://localhost:8081/blacklab-server", "status_code": 200, "error": null}

# Response (not running):
# {"ok": false, "url": "http://localhost:8081/blacklab-server", "status_code": null, 
#  "error": "Connection refused (check if BlackLab is running at http://localhost:8081/blacklab-server)"}
```

**Note:** The health endpoint returns the currently configured `BLS_BASE_URL`, which in local dev is normally `http://localhost:8081/blacklab-server` (Docker-BlackLab on port 8081).

---

## 4. Troubleshooting: BlackLab Not Running

### Symptoms

1. **In Flask logs:**
   ```
   ERROR in advanced_api: BLS request failed on /corapan/hits: ConnectError: [WinError 10061] 
   Es konnte keine Verbindung hergestellt werden...
   ```

2. **In the browser (Advanced Search):**
   - Form works normally
   - Click "Search" → empty table appears
   - **Error banner above table:**
     > ☁️ **Search Backend Unavailable**
     > The search backend (BlackLab) is currently not reachable. Please check that the 
     > BlackLab server is running at `http://localhost:8081/blacklab-server`.

3. **Health check returns degraded:**
   ```bash
   curl -s http://localhost:8000/health | jq .checks.blacklab.ok
   # false
   ```

### Solutions

**Step 1: Verify BlackLab is running**

```bash
# Check if Docker container is running
docker ps | grep blacklab
# Or
docker logs corapan-blacklab-dev

# Check if process is listening on port 8080/8081
netstat -an | grep 8080  # Windows: use netstat -ano or Get-NetTCPConnection
```

**Step 2: Verify the configured URL**

```bash
# Check what URL is configured
echo $BLS_BASE_URL

# Or check in the app
curl -s http://localhost:8000/health/bls | jq .url
```

**Step 3: Test connectivity directly**

```bash
# From host machine (default port 8081)
curl -v http://localhost:8081/blacklab-server/

# If you configured a different port (8080)
curl -v http://localhost:8080/blacklab-server/

# From inside Docker app container (if using compose)
docker exec corapan-container curl -v http://blacklab:8080/blacklab-server/
```

**Step 4: Check Docker network (if using compose)**

```bash
# Verify services are on the same network
docker network inspect corapan-network

# Restart both services
docker-compose restart blacklab web
```

---

## 5. UI Behavior When BlackLab is Unavailable

### Advanced Search Form

- ✅ Form inputs and filters work normally
- ✅ Submit button can be clicked
- ✅ Validation still happens (CQL syntax, required fields)

### Search Results

When BlackLab is offline and you click "Search":

1. **Error Banner appears** (MD3-styled, persistent):
   - **Icon:** ☁️ (cloud_off)
   - **Title:** "Search Backend Unavailable"
   - **Message:** Explains that BlackLab is not reachable and how to fix it

2. **Results table:**
   - Empty (no data shown)
   - No JavaScript errors in the console
   - DataTables initializes but shows 0 records

3. **Export buttons:**
   - Visible but will fail if clicked (with appropriate error)

### Example Error Flow

```
User → Enters "casa" in search field → Clicks "Search"
  ↓
Flask `/search/advanced/data` endpoint is called
  ↓
Backend tries to connect to BlackLab → ConnectError
  ↓
Flask returns 200 OK with JSON:
{
  "draw": 1,
  "recordsTotal": 0,
  "recordsFiltered": 0,
  "data": [],
  "error": "upstream_unavailable",
  "message": "Search backend (BlackLab) is currently not reachable..."
}
  ↓
Frontend JS (initTable.js) checks for `error` field
  ↓
Displays MD3 Alert banner with user-friendly message
  ↓
DataTables shows empty table (normal "no results" state)
```

### Error Types in Frontend

The Advanced Search shows different error messages based on the error code:

| Error Code | UI Banner Title | Message |
|---|---|---|
| `upstream_unavailable` | Search Backend Unavailable | ☁️ BLS not reachable |
| `upstream_timeout` | Search Timeout | ⏰ BLS took too long |
| `upstream_error` | Backend Error | ⚠️ BLS returned an error |
| `invalid_cql` | CQL Syntax Error | ❌ User's CQL is invalid |
| `invalid_filter` | Invalid Filter | 🔍 Filter values invalid |

---

## 6. Configuration for Different Environments

### Development (Local)

```bash
# Set BLS to local Docker or JAR
export BLS_BASE_URL=http://localhost:8080/blacklab-server

# Or in passwords.env
BLS_BASE_URL=http://localhost:8080/blacklab-server
FLASK_ENV=development
```

### Development (Windows/WSL2)

If BlackLab is on Windows host but Flask is in WSL container:

```bash
# In WSL, point to Windows host
export BLS_BASE_URL=http://host.docker.internal:8080/blacklab-server

# Or in docker-compose for wsl2
services:
  web:
    environment:
      BLS_BASE_URL: "http://host.docker.internal:8080/blacklab-server"
```

### Production

```bash
# Use internal Docker network
BLS_BASE_URL=http://blacklab-service:8080/blacklab-server

# Or use DNS/external URL
BLS_BASE_URL=http://blacklab.example.com:8080/blacklab-server

# Set in systemd service or docker-compose.yml
```

---

## 7. Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| `WinError 10061: Connection refused` | BlackLab not running or wrong port | Start BlackLab with `.\\scripts\\blacklab\\start_blacklab_docker_v3.ps1 -Detach`, verify port matches `BLS_BASE_URL` |
| `Connection refused on localhost:8081` | BlackLab not running on expected port | Run `docker ps` to check, use helper script to start |
| `404 Not Found on /blacklab-server/` | BlackLab running but path is wrong | Verify BlackLab is exposing `/blacklab-server` (not `/blacklab`) |
| `Timeout (no response from BLS)` | BlackLab slow or indexing | Wait for index to finish, or increase timeouts in code |
| `Invalid CQL parameter accepted` | BlackLab version mismatch (patt vs cql) | Code auto-detects; check logs for which parameter was used |
| Search works but very slow | BLS returning large result sets | Implement pagination, reduce result limit, or optimize index |
| Port 8081 already in use | Another service using port 8081 | Stop other service, or change Docker port mapping and set `BLS_BASE_URL` accordingly |

---

## 8. Useful Commands

```bash
# View Flask logs
docker logs corapan-container --follow

# View BlackLab logs (if using Docker)
docker logs corapan-blacklab-dev --follow

# Check health in loop (useful for debugging)
watch -n 1 'curl -s http://localhost:8000/health/bls | jq .ok'

# Restart BlackLab (using helper scripts)
.\\scripts\\blacklab\\stop_blacklab_docker.ps1
.\\scripts\\blacklab\\start_blacklab_docker_v3.ps1 -Detach

# Remove and recreate BlackLab container
docker stop corapan-blacklab-dev
docker rm corapan-blacklab-dev
.\\scripts\\blacklab\\start_blacklab_docker_v3.ps1 -Detach

# Connect to BlackLab web UI (if available)
# http://localhost:8081/blacklab-server-gui/
```

---

## 9. Test Scenarios

### Test 1: BlackLab Running (Standard Dev Workflow)

1. **Start BlackLab:**
   ```powershell
   .\\scripts\\blacklab\\start_blacklab_docker_v3.ps1 -Detach
   ```
   Expected output: `BlackLab is now running on http://localhost:8081/blacklab-server (Container: corapan-blacklab-dev)`

2. **Start Flask:**
   ```powershell
   .venv\Scripts\activate
   $env:FLASK_ENV="development"
   python -m src.app.main
   ```

3. **Test in Browser:**
   - Navigate to `http://localhost:8000/search/advanced`
   - Enter a search query (e.g., `casa`)
   - Click "Search"

   **Expected:**
   - ✅ No error banner
   - ✅ Results appear in DataTable
   - ✅ Real corpus hits (not always 324 results)
   - ✅ Metadata columns populated correctly

4. **Verify Health Check:**
   ```bash
   curl -s http://localhost:8000/health/bls | jq .
   ```
   **Expected:**
   ```json
   {
     "ok": true,
     "url": "http://localhost:8081/blacklab-server",
     "status_code": 200,
     "error": null
   }
   ```

### Test 2: BlackLab Stopped (Error Handling)

1. **Stop BlackLab:**
   ```powershell
   .\\scripts\\blacklab\\stop_blacklab_docker.ps1
   ```

2. **Flask still running, attempt search:**
   - Go to `http://localhost:8000/search/advanced`
   - Enter query `casa`
   - Click "Search"

   **Expected:**
   - ✅ Error banner appears: "Search Backend Unavailable"
   - ✅ Banner message: "...check that BlackLab is running at http://localhost:8081/blacklab-server"
   - ✅ Empty table (0 results)
   - ✅ No JavaScript console errors

3. **Verify Health Check:**
   ```bash
   curl -s http://localhost:8000/health/bls | jq .
   ```
   **Expected:**
   ```json
   {
     "ok": false,
     "url": "http://localhost:8081/blacklab-server",
     "status_code": null,
     "error": "Connection refused (check if BlackLab is running at http://localhost:8081/blacklab-server)"
   }
   ```

---

## 10. References

- **BlackLab Documentation:** https://inl.github.io/BlackLab/
- **CQL Query Language:** https://inl.github.io/BlackLab/corpus-query-language.html
- **App Configuration:** `src/app/extensions/http_client.py`
- **Search Endpoints:** `src/app/search/advanced_api.py`
- **Frontend Handler:** `static/js/modules/advanced/initTable.js`
- **Health Check:** `src/app/routes/public.py` (`/health`, `/health/bls`)
- **Helper Scripts:** `scripts/blacklab/start_blacklab_docker_v3.ps1`, `scripts/blacklab/stop_blacklab_docker.ps1`

---

## 11. Related Documentation

- [Advanced Search (UI/UX)](./advanced-search-ui-finalization.md)
- [Advanced Search (CQL)](./advanced-search.md)
- [Build BlackLab Index](./build-blacklab-index.md)
- [Production Deployment](../operations/production-deployment.md)
