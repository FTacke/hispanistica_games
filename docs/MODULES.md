# CO.RA.PAN Module Architecture

> **Version:** 1.0  
> **Purpose:** Module dependency map for template customization  
> **Last Updated:** 2025-12-19

This document describes the modular architecture of the CO.RA.PAN webapp, enabling developers to understand dependencies and safely remove unused features when adapting the template for new projects.

---

## Table of Contents

1. [Module Overview](#module-overview)
2. [Core Modules (Required)](#core-modules-required)
3. [Optional Modules](#optional-modules)
4. [Module Dependency Matrix](#module-dependency-matrix)
5. [Removal Impact Analysis](#removal-impact-analysis)

---

## Module Overview

The application is structured as a collection of modules, each providing specific functionality. Modules can be:

- **Core:** Required for basic authentication and admin functionality (cannot remove)
- **Optional:** Feature modules that can be removed for minimal template (safe to remove)
- **Support:** Infrastructure modules used by multiple features (remove only if dependents removed)

---

## Core Modules (Required)

### 1. Authentication (Auth)
**Purpose:** User authentication, JWT token management, session handling

**Components:**
- **Routes:** `src/app/auth/routes.py`
- **Models:** `src/app/auth/models.py` (User, RefreshToken, AuditLog)
- **Middleware:** `src/app/auth/middleware.py` (jwt_required, require_role)
- **Templates:** `templates/auth/*.html` (login, profile, password-reset)
- **Static:** `static/js/auth.js`, `static/css/md3/components/auth.css`
- **Migrations:** `migrations/0001_create_auth_schema_*.sql`

**Database Tables:**
- `auth.users`
- `auth.refresh_tokens`
- `auth.audit_log`

**Environment Variables:**
```bash
FLASK_SECRET_KEY=<required>
JWT_SECRET_KEY=<required>
JWT_ALG=HS256
AUTH_DATABASE_URL=<required>
AUTH_HASH_ALGO=argon2
JWT_COOKIE_SECURE=true  # production only
```

**Dependencies:** None (core module)

**Removal Impact:** ❌ **Cannot remove** - Foundation for all access control

---

### 2. Role-Based Access Control (RBAC)
**Purpose:** User role management (User, Editor, Admin), permission checks

**Components:**
- **Roles:** Defined in `src/app/auth/models.py` (Role enum)
- **Decorators:** `@require_role()` in `src/app/auth/middleware.py`
- **Admin UI:** `templates/pages/admin_users.html`

**Database Tables:**
- `auth.users` (role column)

**Dependencies:**
- Auth module (required)

**Removal Impact:** ⚠️ **Not recommended** - Provides essential access control structure

---

### 3. Admin UI
**Purpose:** User management interface for administrators

**Components:**
- **Routes:** `src/app/routes/admin.py`
- **Templates:** `templates/pages/admin_*.html`
- **API:** `/api/admin/*` endpoints
- **Static:** `static/js/admin.js`

**Database Tables:**
- Uses auth tables (read/write)
- `auth.audit_log` (for action logging)

**Environment Variables:** None (uses auth env vars)

**Dependencies:**
- Auth module (required)
- RBAC (required)

**Removal Impact:** ⚠️ **Not recommended** - Essential for user management unless using external admin tool

---

### 4. MD3 Design System
**Purpose:** Material Design 3 component library and theming

**Components:**
- **Tokens:** `static/css/md3/tokens.css`, `static/css/app-tokens.css`
- **Components:** `static/css/md3/components/*.css`
- **Typography:** `static/css/md3/typography.css`
- **Layout:** `static/css/md3/layout.css`
- **JavaScript:** `static/js/theme.js` (dark mode toggle)
- **Skeletons:** `templates/_md3_skeletons/*.html`

**Dependencies:** None (foundation)

**Removal Impact:** ❌ **Cannot remove** - UI foundation for all pages

**Customization:** 
- Edit color tokens in `static/css/md3/tokens.css`
- Override in `static/css/app-tokens.css`
- See `docs/md3/` for component usage

---

## Optional Modules

### 5. Corpus Search (BlackLab Integration)
**Purpose:** Linguistic corpus search, CQL queries, KWIC display

**Components:**
- **Routes:** `src/app/routes/public.py` (search endpoints)
- **Search Logic:** `src/app/search/` (CQL parsing, BlackLab API)
- **Templates:** `templates/search/*.html`, `templates/pages/corpus_*.html`
- **Static:** 
  - `static/css/md3/components/corpus.css`
  - `static/css/md3/components/advanced-search.css`
  - `static/js/advanced-search.js`
  - `static/js/token-input.js`
- **Scripts:** `scripts/blacklab/*.py` (indexing tools)

**Database Tables:**
- `auth.search_counters` (search statistics, optional)

**Environment Variables:**
```bash
BLACKLAB_BASE_URL=http://localhost:8081/blacklab-server
```

**External Dependencies:**
- BlackLab Server (Docker container or standalone)
- Lucene index files in `data/blacklab_index/`

**Dependencies:**
- Auth module (for protected searches)
- Export module (for CSV export)

**Removal Impact:** ✅ **Safe to remove** - Completely independent feature
- Remove routes from `src/app/routes/public.py` (search, export)
- Remove search templates
- Remove BlackLab-related environment variables
- Remove Docker service from `docker-compose.yml`
- Remove scripts/blacklab/ directory
- See [PRUNING_GUIDE.md](PRUNING_GUIDE.md) for detailed steps

---

### 6. Audio Player
**Purpose:** MP3 playback with transcript synchronization

**Components:**
- **Routes:** `src/app/routes/public.py` (/player, /api/temp-audio-url)
- **Templates:** `templates/pages/player.html`
- **Static:**
  - `static/css/md3/components/audio-player.css`
  - `static/css/player-mobile.css`
  - `static/js/audio-player.js`
- **Media:** `media/mp3-split/*.mp3`, `media/transcripts/*.json`

**Database Tables:** None

**Environment Variables:**
```bash
ALLOW_PUBLIC_TEMP_AUDIO=false  # Security setting
```

**Dependencies:**
- Corpus module (player launched from search results)
- Auth module (optional, if ALLOW_PUBLIC_TEMP_AUDIO=false)

**Removal Impact:** ✅ **Safe to remove** if no audio playback needed
- Remove player route and template
- Remove audio-related CSS/JS
- Media files can remain (gitignored)
- See [PRUNING_GUIDE.md](PRUNING_GUIDE.md)

---

### 7. Analytics (DSGVO-compliant tracking)
**Purpose:** Anonymous usage tracking, visitor statistics, search metrics

**Components:**
- **Routes:** `src/app/routes/admin.py` (/admin/analytics)
- **Analytics Logic:** `src/app/analytics/tracker.py`, `src/app/analytics/reporter.py`
- **Templates:** `templates/pages/admin_analytics.html`
- **Static:** `static/js/analytics.js`
- **Migrations:** `migrations/0002_create_analytics_tables.sql`

**Database Tables:**
- `auth.analytics_pageviews`
- `auth.analytics_search_events`
- `auth.analytics_audio_events`

**Environment Variables:** None (uses main DB)

**Dependencies:**
- Auth module (admin-only access)
- RBAC (admin role required)

**Removal Impact:** ✅ **Safe to remove** - Completely optional
- Remove analytics routes
- Remove analytics templates
- Drop analytics tables from database
- Remove `static/js/analytics.js` and tracking calls
- See [PRUNING_GUIDE.md](PRUNING_GUIDE.md)

---

### 8. Atlas (Geolinguistic Map)
**Purpose:** Interactive map showing corpus geographic distribution

**Components:**
- **Routes:** `src/app/routes/public.py` (/atlas, /api/atlas/data)
- **Templates:** `templates/pages/atlas.html`
- **Static:**
  - `static/css/md3/components/atlas.css`
  - `static/js/atlas.js`
  - `static/vendor/leaflet/` (mapping library)
- **Data:** Embedded metadata (country coordinates, counts)

**Database Tables:** None (uses corpus metadata)

**Environment Variables:** None

**Dependencies:**
- Corpus module (displays corpus statistics)

**Removal Impact:** ✅ **Safe to remove**
- Remove atlas route and template
- Remove atlas CSS/JS
- Leaflet library can remain (may be used elsewhere) or remove if unused
- See [PRUNING_GUIDE.md](PRUNING_GUIDE.md)

---

### 9. Statistics Dashboard
**Purpose:** Corpus statistics visualizations (ECharts)

**Components:**
- **Routes:** `src/app/routes/public.py` (/statistics, /api/stats/*)
- **Templates:** `templates/pages/statistics.html`
- **Static:**
  - `static/css/md3/components/stats.css`
  - `static/js/statistics.js`
  - `static/vendor/echarts/` (charting library)

**Database Tables:** None (computes from corpus metadata)

**Environment Variables:** None

**Dependencies:**
- Corpus module (visualizes corpus data)

**Removal Impact:** ✅ **Safe to remove**
- Remove statistics route and template
- Remove stats CSS/JS
- ECharts library can remain or remove if unused
- See [PRUNING_GUIDE.md](PRUNING_GUIDE.md)

---

### 10. Export (CSV Streaming)
**Purpose:** Large dataset CSV/TSV export with streaming

**Components:**
- **Routes:** `src/app/routes/public.py` (/export/csv, /export/tsv)
- **Export Logic:** `src/app/search/export.py`
- **Templates:** Export forms in search pages

**Database Tables:** None

**Environment Variables:** None

**Dependencies:**
- Corpus module (exports search results)
- Auth module (access control)

**Removal Impact:** ✅ **Safe to remove** if no export needed
- Remove export routes
- Remove export forms from search templates
- See [PRUNING_GUIDE.md](PRUNING_GUIDE.md)

---

## Support Modules

### 11. DataTables Integration
**Purpose:** Enhanced HTML table display with sorting, pagination, search

**Components:**
- **Static:**
  - `static/vendor/datatables/`
  - `static/css/md3/components/datatables-theme-lock.css`
  - `static/js/datatables-init.js`
- **Used in:** Admin UI, corpus metadata pages

**Dependencies:**
- Admin module (user list)
- Corpus module (metadata tables)

**Removal Impact:** ⚠️ **Depends on usage**
- If keeping admin UI: **Keep** (used for user list)
- If removing corpus: Can remove if admin UI doesn't need tables
- Alternative: Replace with custom pagination

---

### 12. HTMX (Dynamic UI updates)
**Purpose:** AJAX-like interactions without full page reloads

**Components:**
- **Static:** `static/vendor/htmx/htmx.min.js`
- **Used in:** Various form submissions, dynamic updates

**Dependencies:**
- Used across multiple pages (auth, admin, search)

**Removal Impact:** ⚠️ **Depends on features**
- If keeping dynamic forms: **Keep**
- Alternative: Replace with vanilla JS fetch() calls
- See HTMX usage: `grep -r "hx-" templates/`

---

## Module Dependency Matrix

| Module | Depends On | Used By | Can Remove? |
|--------|-----------|---------|-------------|
| **Auth** | - | All modules | ❌ No |
| **RBAC** | Auth | Admin, protected pages | ⚠️ Not recommended |
| **Admin UI** | Auth, RBAC | - | ⚠️ Not recommended |
| **MD3 Design** | - | All pages | ❌ No |
| **Corpus Search** | Auth, Export | Audio, Atlas, Stats | ✅ Yes |
| **Audio Player** | Corpus, Auth (optional) | - | ✅ Yes |
| **Analytics** | Auth, RBAC | - | ✅ Yes |
| **Atlas** | Corpus | - | ✅ Yes |
| **Statistics** | Corpus | - | ✅ Yes |
| **Export** | Corpus, Auth | - | ✅ Yes |
| **DataTables** | - | Admin, Corpus | ⚠️ Conditional |
| **HTMX** | - | Forms, UI updates | ⚠️ Conditional |

---

## Removal Impact Analysis

### Scenario A: Minimal Template (Auth + Admin Only)

**Remove:** Corpus, Audio, Analytics, Atlas, Statistics, Export

**Keep:** Auth, RBAC, Admin UI, MD3 Design, DataTables (for admin), HTMX (for forms)

**Result:**
- Clean authentication system
- User management interface
- Ready for new features
- ~40% smaller codebase

**Steps:** See [PRUNING_GUIDE.md](PRUNING_GUIDE.md) - Scenario A

---

### Scenario B: Research Platform (Keep Corpus, Remove Audio/Maps)

**Remove:** Audio Player, Atlas, Statistics

**Keep:** Auth, RBAC, Admin, Corpus Search, Export, Analytics

**Result:**
- Text-only corpus research
- Export capabilities
- Usage tracking
- ~20% smaller codebase

**Steps:** See [PRUNING_GUIDE.md](PRUNING_GUIDE.md) - Scenario B

---

### Scenario C: Full Template (Keep Everything)

**Remove:** Nothing

**Keep:** All modules

**Result:**
- Feature-complete webapp
- All examples available
- Reference implementation

**Steps:** Just customize branding and content

---

## Environment Variable Summary by Module

### Core (Always Required)
```bash
FLASK_SECRET_KEY=<random-64-char>
JWT_SECRET_KEY=<random-64-char>
AUTH_DATABASE_URL=<sqlalchemy-url>
AUTH_HASH_ALGO=argon2
JWT_COOKIE_SECURE=true
```

### Optional (Module-Specific)
```bash
# Corpus Search
BLACKLAB_BASE_URL=http://localhost:8081/blacklab-server

# Audio Player
ALLOW_PUBLIC_TEMP_AUDIO=false
```

### Legacy/Deprecated
```bash
# Deprecated: Use JWT_SECRET_KEY instead
JWT_SECRET=<legacy>

# Deprecated: Use AUTH_DATABASE_URL instead
DATABASE_URL=<legacy>
```

---

## Next Steps

1. **Understand dependencies:** Review this document to understand what each module does
2. **Choose scenario:** Decide which modules to keep (A, B, or C)
3. **Follow pruning guide:** Use [PRUNING_GUIDE.md](PRUNING_GUIDE.md) for step-by-step removal
4. **Test thoroughly:** Run tests after each module removal
5. **Update docs:** Remove references to removed modules in your project docs

---

## See Also

- [PRUNING_GUIDE.md](PRUNING_GUIDE.md) - Step-by-step module removal
- [ARCHITECTURE.md](ARCHITECTURE.md) - Overall system architecture
- [template/README.md](template/README.md) - Template usage overview
- [how-to/template-usage.md](how-to/template-usage.md) - Quick template checklist
