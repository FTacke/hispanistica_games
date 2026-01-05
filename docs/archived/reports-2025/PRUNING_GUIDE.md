# Module Removal Guide (Pruning Guide)

> **Version:** 1.0  
> **Purpose:** Step-by-step instructions for removing unused modules from the template  
> **Last Updated:** 2025-12-19

This guide provides detailed, safe removal procedures for optional modules when adapting the CO.RA.PAN template for new projects.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [General Removal Process](#general-removal-process)
3. [Scenario A: Minimal Template (Auth + Admin Only)](#scenario-a-minimal-template-auth--admin-only)
4. [Scenario B: Remove Individual Modules](#scenario-b-remove-individual-modules)
5. [Verification Checklist](#verification-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before removing any modules:

1. ✅ **Backup:** Create a git branch or backup
   ```bash
   git checkout -b template-pruning
   ```

2. ✅ **Read MODULES.md:** Understand dependencies
   - See [MODULES.md](MODULES.md) for module relationships

3. ✅ **Run tests:** Establish baseline
   ```bash
   pytest
   python scripts/md3-lint.py
   ```

4. ✅ **Document:** Note which modules you're removing

---

## General Removal Process

For each module removal:

### Step 1: Identify Components

Use MODULES.md to find:
- Routes
- Templates
- Static files (CSS, JS)
- Database tables
- Environment variables
- External services (Docker)

### Step 2: Remove Code

1. **Routes:** Delete or comment out route handlers
2. **Templates:** Remove template files
3. **Static:** Remove CSS/JS files
4. **Migrations:** Drop database tables (if applicable)
5. **Navigation:** Remove menu items from templates/partials/navigation-drawer.html

### Step 3: Clean References

Search for remaining references:
```bash
# Search for route names
grep -r "/removed-route" .

# Search for template includes
grep -r "removed_template.html" templates/

# Search for JS/CSS imports
grep -r "removed-module.js" templates/
```

### Step 4: Update Configuration

- Remove environment variables from `.env.example`
- Remove Docker services from `docker-compose*.yml`
- Remove scripts from `scripts/` directory

### Step 5: Test

```bash
# Run tests
pytest

# Check structure
python scripts/check_structure.py

# Check MD3 compliance
python scripts/md3-lint.py

# Start app and verify
python -m src.app.main
```

### Step 6: Update Documentation

- Update README.md features list
- Remove module docs from docs/
- Update project_structure.md if needed

---

## Scenario A: Minimal Template (Auth + Admin Only)

**Goal:** Remove all corpus-specific features, keep only authentication and admin UI

**Removes:** Corpus Search, Audio Player, Analytics, Atlas, Statistics, Export  
**Keeps:** Auth, RBAC, Admin UI, MD3 Design System

### A.1 Remove Corpus Search Module

#### A.1.1 Remove Routes

**File:** `src/app/routes/public.py`

Remove these route handlers:
```python
@blueprint.get("/search")
@blueprint.post("/search")
@blueprint.get("/search/advanced")
@blueprint.get("/search/advanced/data")
@blueprint.post("/search/advanced/preflight")
@blueprint.get("/search/token/<token_id>")
@blueprint.get("/corpus")
@blueprint.get("/corpus/<country>")
```

**Keep:** Non-corpus routes (index, impressum, privacy, contact, etc.)

#### A.1.2 Remove Templates

**Directory:** `templates/search/`

```bash
# Remove search templates
rm -rf templates/search/
```

**Files:** `templates/pages/`
```bash
rm templates/pages/corpus.html
rm templates/pages/corpus_country.html
```

#### A.1.3 Remove Static Files

**CSS:**
```bash
rm static/css/md3/components/corpus.css
rm static/css/md3/components/advanced-search.css
```

**JavaScript:**
```bash
rm static/js/advanced-search.js
rm static/js/token-input.js
rm static/js/cql-builder.js  # if exists
```

#### A.1.4 Remove from Navigation

**File:** `templates/partials/navigation-drawer.html`

Remove:
```html
<a href="{{ url_for('public.search_basic') }}" class="md3-nav-drawer__item">
  <span class="material-symbols-rounded">search</span>
  <span>Suche</span>
</a>
<a href="{{ url_for('public.advanced_search_page') }}" class="md3-nav-drawer__item">
  <span class="material-symbols-rounded">code</span>
  <span>Erweiterte Suche</span>
</a>
<a href="{{ url_for('public.corpus_overview') }}" class="md3-nav-drawer__item">
  <span class="material-symbols-rounded">dataset</span>
  <span>Korpus</span>
</a>
```

#### A.1.5 Remove BlackLab Service

**File:** `docker-compose.dev-postgres.yml`

Remove the blacklab service:
```yaml
services:
  # Remove entire blacklab section
  # blacklab:
  #   image: ...
```

**File:** `docker-compose.yml` (production)

Same as above.

#### A.1.6 Remove Environment Variables

**File:** `.env.example`

Remove:
```bash
# Remove these lines
BLACKLAB_BASE_URL=http://localhost:8081/blacklab-server
```

#### A.1.7 Remove Scripts

```bash
rm -rf scripts/blacklab/
rm scripts/build_blacklab_index.ps1
rm scripts/advanced-search-preflight.sh
```

#### A.1.8 Remove Database Tables (Optional)

If you created search counter tables:
```sql
DROP TABLE IF EXISTS auth.search_counters;
```

#### A.1.9 Verify Removal

```bash
# Search for remaining references
grep -r "blacklab" . --exclude-dir={.venv,node_modules,.git,LOKAL}
grep -r "corpus" src/ --exclude-dir=__pycache__
grep -r "search_basic\|advanced_search" templates/

# Test
pytest
python -m src.app.main
```

---

### A.2 Remove Audio Player Module

#### A.2.1 Remove Routes

**File:** `src/app/routes/public.py`

Remove:
```python
@blueprint.get("/player")
@blueprint.get("/api/temp-audio-url/<token_id>")
```

#### A.2.2 Remove Templates

```bash
rm templates/pages/player.html
```

#### A.2.3 Remove Static Files

```bash
rm static/css/md3/components/audio-player.css
rm static/css/player-mobile.css
rm static/js/audio-player.js
```

#### A.2.4 Remove from Navigation

**File:** `templates/partials/navigation-drawer.html`

Remove player link (if exists).

#### A.2.5 Remove Environment Variables

**File:** `.env.example`

Remove:
```bash
ALLOW_PUBLIC_TEMP_AUDIO=false
```

#### A.2.6 Verify Removal

```bash
grep -r "audio-player\|temp-audio" . --exclude-dir={.venv,node_modules,.git}
```

---

### A.3 Remove Analytics Module

#### A.3.1 Remove Routes

**File:** `src/app/routes/admin.py`

Remove:
```python
@blueprint.get("/admin/analytics")
@blueprint.get("/admin/analytics/api/visits")
@blueprint.get("/admin/analytics/api/searches")
# ... other analytics routes
```

#### A.3.2 Remove Templates

```bash
rm templates/pages/admin_analytics.html
```

#### A.3.3 Remove Static Files

```bash
rm static/js/analytics.js
```

#### A.3.4 Remove Analytics Calls

**Search in templates:**
```bash
grep -r "trackVisit\|trackSearch\|trackAudio" templates/
```

Remove or comment out analytics tracking calls in:
- `templates/base.html`
- `templates/search/*.html`
- `templates/pages/player.html` (already removed)

#### A.3.5 Remove Database Tables

```sql
DROP TABLE IF EXISTS auth.analytics_pageviews;
DROP TABLE IF EXISTS auth.analytics_search_events;
DROP TABLE IF EXISTS auth.analytics_audio_events;
```

**File:** `migrations/0002_create_analytics_tables.sql`

Either delete this file or document it as "optional".

#### A.3.6 Remove from Admin Navigation

**File:** `templates/pages/admin_index.html` or navigation

Remove analytics link.

#### A.3.7 Verify Removal

```bash
grep -r "analytics" src/app/ --exclude-dir=__pycache__
grep -r "trackVisit" templates/
```

---

### A.4 Remove Atlas Module

#### A.4.1 Remove Routes

**File:** `src/app/routes/public.py`

Remove:
```python
@blueprint.get("/atlas")
@blueprint.get("/api/atlas/data")
```

#### A.4.2 Remove Templates

```bash
rm templates/pages/atlas.html
```

#### A.4.3 Remove Static Files

```bash
rm static/css/md3/components/atlas.css
rm static/js/atlas.js
```

**Leaflet Library (Optional):**
```bash
# If not used elsewhere
rm -rf static/vendor/leaflet/
```

#### A.4.4 Remove from Navigation

**File:** `templates/partials/navigation-drawer.html`

Remove atlas link.

#### A.4.5 Verify Removal

```bash
grep -r "atlas\|leaflet" . --exclude-dir={.venv,node_modules,.git,LOKAL,static/vendor}
```

---

### A.5 Remove Statistics Module

#### A.5.1 Remove Routes

**File:** `src/app/routes/public.py`

Remove:
```python
@blueprint.get("/statistics")
@blueprint.get("/api/stats/overview")
@blueprint.get("/api/stats/speakers")
# ... other stats routes
```

#### A.5.2 Remove Templates

```bash
rm templates/pages/statistics.html
```

#### A.5.3 Remove Static Files

```bash
rm static/css/md3/components/stats.css
rm static/js/statistics.js
```

**ECharts Library (Optional):**
```bash
# If not used elsewhere
rm -rf static/vendor/echarts/
```

#### A.5.4 Remove from Navigation

**File:** `templates/partials/navigation-drawer.html`

Remove statistics link.

#### A.5.5 Verify Removal

```bash
grep -r "statistics\|echarts" . --exclude-dir={.venv,node_modules,.git,LOKAL,static/vendor}
```

---

### A.6 Remove Export Module

#### A.6.1 Remove Routes

**File:** `src/app/routes/public.py`

Remove:
```python
@blueprint.get("/export/csv")
@blueprint.get("/export/tsv")
```

#### A.6.2 Remove Export Logic

**File:** `src/app/search/export.py`

Can remove entire file if not used elsewhere.

#### A.6.3 Remove Export Forms

Search and remove export UI from search result templates (already removed with search module).

#### A.6.4 Verify Removal

```bash
grep -r "export" src/app/routes/ --exclude-dir=__pycache__
```

---

### A.7 Update Documentation

#### A.7.1 Update README.md

Remove features from feature list:
- Corpus search
- Audio player
- Analytics
- Atlas
- Statistics

Update to:
```markdown
## Features

- **Authentication:** JWT-based login with refresh tokens
- **Admin Dashboard:** User management, role assignment, audit log
- **Material Design 3:** Complete component library
- **Production-Ready:** Docker, CI/CD, security hardening
```

#### A.7.2 Update docs/

Remove or archive:
```bash
mv docs/analytics/ docs/archived/
mv docs/reference/advanced-search-*.md docs/archived/
mv docs/reference/corpus-*.md docs/archived/
mv docs/reference/blacklab-*.md docs/archived/
# Keep auth and admin docs
```

#### A.7.3 Update Navigation Documentation

Update `docs/reference/project_structure.md` to reflect removed modules.

---

### A.8 Final Verification

#### A.8.1 Run All Tests

```bash
pytest -v
```

Expected: Auth and admin tests pass, corpus tests skipped/removed.

#### A.8.2 Run Quality Checks

```bash
python scripts/check_structure.py
python scripts/md3-lint.py
python scripts/md3-forms-auth-guard.py
ruff check src tests scripts
ruff format --check src tests scripts
```

#### A.8.3 Manual Testing

```bash
python -m src.app.main
```

Test:
- [ ] Login works
- [ ] Admin user management works
- [ ] No broken links in navigation
- [ ] No console errors
- [ ] Dark mode toggle works

#### A.8.4 Check for Dead Links

```bash
# Search for removed routes
grep -r "url_for('public.search" templates/
grep -r "url_for('public.corpus" templates/
grep -r "url_for('public.atlas" templates/
grep -r "url_for('public.statistics" templates/
grep -r "url_for('public.player" templates/
```

---

## Scenario B: Remove Individual Modules

Use the steps from Scenario A for specific modules:

### Remove Audio Only
Follow: [A.2 Remove Audio Player Module](#a2-remove-audio-player-module)

### Remove Analytics Only
Follow: [A.3 Remove Analytics Module](#a3-remove-analytics-module)

### Remove Atlas Only
Follow: [A.4 Remove Atlas Module](#a4-remove-atlas-module)

### Remove Statistics Only
Follow: [A.5 Remove Statistics Module](#a5-remove-statistics-module)

**Note:** If keeping corpus search, do not remove export module (it's used for CSV exports).

---

## Verification Checklist

After removing modules, verify:

### Code Quality
- [ ] `pytest` passes (or skips removed module tests)
- [ ] `ruff check .` passes
- [ ] `ruff format --check .` passes
- [ ] `python scripts/check_structure.py` passes
- [ ] `python scripts/md3-lint.py` has 0 errors

### Functionality
- [ ] App starts without errors
- [ ] Login/logout works
- [ ] Admin UI accessible
- [ ] Navigation has no broken links
- [ ] No console errors in browser
- [ ] No 404s on page load

### Documentation
- [ ] README.md updated
- [ ] Feature list accurate
- [ ] Environment variables documented
- [ ] Removed modules archived in docs/archived/

### Configuration
- [ ] `.env.example` cleaned up
- [ ] `docker-compose*.yml` updated
- [ ] Removed services don't auto-start
- [ ] CI workflows still pass

---

## Troubleshooting

### Error: "No module named 'src.app.search'"

**Cause:** Code still references removed module

**Fix:**
```bash
# Find references
grep -r "from src.app.search" src/

# Remove or update imports
```

### Error: "Template not found: search/results.html"

**Cause:** Route still trying to render removed template

**Fix:** Remove the route handler that renders this template

### Error: "jinja2.exceptions.UndefinedError: 'url_for' is undefined"

**Cause:** Template references removed route

**Fix:**
```bash
# Find template references
grep -r "url_for('public.removed_route" templates/

# Remove the links
```

### Error: "KeyError: 'BLACKLAB_BASE_URL'"

**Cause:** Code expects environment variable that was removed

**Fix:**
```python
# Make variable optional
BLACKLAB_URL = os.getenv('BLACKLAB_BASE_URL')  # Returns None if not set
if BLACKLAB_URL:
    # Only use if configured
```

### Warning: "752 warnings found" in md3-lint

**Status:** Expected

**Explanation:** MD3 lint warnings (CSS tokens, !important) are acceptable. Focus on 0 errors.

### Test Failure: "BlackLab server timeout"

**Status:** Expected after removing BlackLab

**Fix:** Remove or skip the test:
```python
@pytest.mark.skipif(not BLACKLAB_ENABLED, reason="BlackLab not configured")
def test_blacklab_integration():
    ...
```

---

## Best Practices

### 1. Remove in Order

Remove modules from least to most depended-upon:
1. Analytics (no dependencies)
2. Atlas (depends on corpus)
3. Statistics (depends on corpus)
4. Audio Player (depends on corpus)
5. Export (used by corpus)
6. Corpus Search (last, many dependencies)

### 2. Test After Each Removal

Don't remove multiple modules at once. Test between each removal.

### 3. Keep Git History Clean

```bash
git add -A
git commit -m "Remove analytics module"

# Then next module
git commit -m "Remove atlas module"
```

### 4. Document Removals

Update `docs/TEMPLATE_CHANGELOG.md` in your new project:
```markdown
## Template Customization

- ❌ Removed: Corpus Search (not needed)
- ❌ Removed: Audio Player (not needed)
- ✅ Kept: Auth + Admin + Analytics
```

### 5. Archive, Don't Delete Docs

Move docs to `docs/archived/` rather than deleting:
```bash
mkdir -p docs/archived/corpus-features
mv docs/reference/corpus-*.md docs/archived/corpus-features/
```

---

## See Also

- [MODULES.md](MODULES.md) - Module dependency matrix
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture overview
- [template/README.md](template/README.md) - Template overview
- [how-to/template-usage.md](how-to/template-usage.md) - Quick template checklist
