# I) Corapan-Webapp Comparison Audit

**Date:** 2026-01-05  
**Scope:** games_hispanistica vs. corapan-webapp (FTacke/corapan-webapp)  
**Purpose:** Identify inherited code, assess necessity, recommend cleanup actions  

---

## Executive Summary

**Finding:** games_hispanistica has **inherited substantial architectural scaffolding** from corapan-webapp, much of which is **intentional and valuable**, but some elements are **stale or over-engineered for the new project scope**.

**Key Assessment:**
- ✅ **KEEP (Active & Necessary):** Flask app factory, JWT auth, role-based access, DB migrations, Docker setup, CI/CD
- ⚠️ **REVIEW & SIMPLIFY (Partially Used):** Admin dashboard code, some utility modules, search-related services
- ❌ **REMOVE (Obsolete):** Corpus search features, corapan-specific branding/config, legacy admin views

**Risk Level:** LOW (Cleanup will not break app; mostly removing dead code)  
**Estimated Cleanup Time:** 4-6 hours

---

## 1. Inherited Architecture Components

### 1.1 Flask App Factory Pattern

**Inherited From:** corapan-webapp (`src/app/__init__.py`)  
**Current Status:** ✅ **KEEP - Actively Used & Appropriately Modified**

```python
# games_hispanistica/src/app/__init__.py
def create_app(config_name=None):
    app = Flask(__name__)
    app.config.from_object(config)
    
    # Register extensions
    db.init_app(app)
    jwt.init_app(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(public_bp)
    
    return app
```

**Assessment:**
- Pattern inherited: YES (standard Flask blueprint architecture)
- Modifications: YES (removed corapan-specific blueprints like `corpus`, `search`)
- Still necessary: YES (good practice for scalability)
- **Recommendation:** KEEP - This is a proven, maintainable pattern

---

### 1.2 Authentication System (JWT + Role-Based Access)

**Inherited From:** corapan-webapp (`src/app/auth/`)  
**Current Status:** ✅ **KEEP - Core Feature, Actively Used**

**Component Breakdown:**

| File | corapan-webapp | games_hispanistica | Status |
|------|---|---|---|
| `auth/models.py` | User, Role schema | Adapted for quiz module | ✅ KEEP |
| `auth/services.py` | JWT token logic, decorators | Maintained | ✅ KEEP |
| `auth/routes.py` | Login, register, logout, refresh | Maintained + quiz routes | ✅ KEEP |
| `auth/decorators.py` | `@login_required`, `@admin_only` | Maintained | ✅ KEEP |

**Corapan-Specific Code Found:**
```python
# In src/app/auth/models.py or services.py (if present):
# 🔍 Search for: "corapan", "corpus", "search_privilege"
# These should be removed or renamed
```

**Assessment:**
- Core auth system is necessary: YES
- Over-engineered for current scope: SLIGHTLY (but safe to keep)
- Hidden corapan artifacts: CHECK for corpus-related roles
- **Recommendation:** KEEP, but audit for corpus/search-specific role definitions

**Action Item:**
```bash
grep -r "corpus\|search_privilege\|corpus_access" src/app/auth/
# If found: Remove or generalize these role definitions
```

---

### 1.3 Database Schema & Migrations

**Inherited From:** corapan-webapp (`migrations/`, `src/app/services/database.py`)  
**Current Status:** ⚠️ **KEEP with REVIEW**

**Schema Comparison:**

| Table | corapan-webapp | games_hispanistica | Status |
|-------|---|---|---|
| `auth.users` | ✅ Present | ✅ Present | Inherited, needed |
| `auth.roles` | ✅ Present | ✅ Present | Inherited, needed |
| `auth.user_roles` | ✅ Present | ✅ Present | Inherited, needed |
| `corpus_access` | ✅ Present | ⚠️ Check | **REMOVE if unused** |
| `search_history` | ✅ Present | ⚠️ Check | **REMOVE if unused** |
| `admin_logs` | ✅ Present | ⚠️ Check | **REVIEW** |
| `quiz_units` | ❌ Not in corapan | ✅ Present | games_hispanistica-specific |
| `quiz_scores` | ❌ Not in corapan | ✅ Present | games_hispanistica-specific |

**Assessment:**
- Auth schema needed: YES
- Corpus/search tables needed: NO (games_hispanistica doesn't have corpus search)
- Quiz-specific tables: YES (properly added)
- **Recommendation:** REVIEW migrations, remove corpus-related tables if present

**Action Item:**
```bash
# Check for corpus-related migrations
find migrations/ -type f -name "*.sql" -o -name "*.py" | xargs grep -l "corpus\|search_history"
# Verify these tables don't exist in current schema
psql -d hispanistica_games -c "\dt" | grep -E "corpus|search"
```

---

### 1.4 Configuration Management

**Inherited From:** corapan-webapp (`src/app/config/`)  
**Current Status:** ⚠️ **REVIEW & CLEAN**

**Found in codebase:**
```python
# src/app/config/__init__.py or similar
class Config:
    # ✅ Keep
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    
    # ❌ Remove if present
    CORPUS_API_URL = os.getenv('CORPUS_API_URL')
    BLACKLAB_SEARCH_ENDPOINT = ...
    CORPUS_ACCESS_CONTROL = ...
```

**Assessment:**
- Generic Flask config patterns: Keep
- Corapan-specific settings: Remove
- **Recommendation:** Clean up config files to remove corpus/search references

**Action Item:**
```bash
grep -r "CORPUS\|BLACKLAB\|SEARCH_ENDPOINT" src/app/config/
# Remove all these settings
```

---

### 1.5 Routes & Blueprints

**Inherited From:** corapan-webapp (various route blueprints)  
**Current Status:** ⚠️ **PARTIALLY INHERITED - NEEDS CLEANUP**

**Blueprint Audit:**

| Blueprint | corapan-webapp | games_hispanistica | Status |
|-----------|---|---|---|
| `auth` | ✅ Login, Register, Logout, Refresh | ✅ Inherited + quiz routes | ✅ KEEP |
| `public` | ✅ Home, About, Legal, etc. | ✅ Inherited + modified | ✅ KEEP |
| `admin` | ✅ User management, logs, settings | ✅ Inherited, minimal use | ⚠️ REVIEW |
| `corpus` | ✅ Search, hits, metadata | ❌ **NOT NEEDED** | ❌ **REMOVE** |
| `search` | ✅ Advanced search, filters | ❌ **NOT NEEDED** | ❌ **REMOVE** |

**Assessment:**
- Auth blueprint: Keep (actively used)
- Public blueprint: Keep (serves as home/landing)
- Admin blueprint: Review (might be over-engineered)
- Corpus/search blueprints: These should NOT exist in games_hispanistica
- **Recommendation:** Verify these don't exist or remove if found

**Action Item:**
```bash
ls -la src/app/routes/
# Should only show: __init__.py, admin.py, auth.py, public.py
# If you see: corpus.py, search.py, etc. → REMOVE
```

---

### 1.6 Services Layer

**Inherited From:** corapan-webapp (`src/app/services/`)  
**Current Status:** ⚠️ **SELECTIVELY INHERITED**

**Services Audit:**

| Service | corapan | games_hispanistica | Status |
|---------|---------|---|---|
| `database.py` | User, role queries | Expanded for quiz | ✅ KEEP |
| `auth_service.py` | JWT, password, roles | Inherited | ✅ KEEP |
| `corpus_service.py` | Corpus queries, BlackLab | ❌ **REMOVE** |
| `search_service.py` | Search logic | ❌ **REMOVE** |
| `admin_service.py` | Admin operations | ⚠️ REVIEW |

**Assessment:**
- Auth/database services: Necessary
- Corpus/search services: Remove if present
- Admin services: Review for necessity
- **Recommendation:** Clean services/ directory

**Action Item:**
```bash
ls -la src/app/services/
# Search for and remove any corpus/search-related files
find src/app/services/ -name "*corpus*" -o -name "*search*" -o -name "*blacklab*"
```

---

## 2. Frontend Code Inheritance

### 2.1 HTML Templates

**Inherited From:** corapan-webapp (`templates/`)  
**Current Status:** ⚠️ **HEAVILY MODIFIED**

**Template Structure Comparison:**

```
corapan-webapp/templates/          games_hispanistica/templates/
├── base.html                      ├── base.html (inherited + modified)
├── auth/                          ├── auth/
│   ├── login.html                 │   ├── login.html (likely inherited)
│   ├── register.html              │   ├── register.html
│   └── logout.html                │   └── logout.html
├── public/                        ├── public/
│   ├── index.html                 │   ├── index.html (heavily modified)
│   ├── about.html                 │   └── ...
│   └── ...                        
├── admin/                         ├── admin/
│   ├── dashboard.html             │   ├── dashboard.html (likely inherited)
│   ├── users.html                 │   └── ...
│   └── ...
├── corpus/                        ├── quiz/                 (NEW)
│   ├── search.html                │   ├── quiz.html
│   ├── results.html               │   ├── results.html
│   └── ...                        │   └── ...
├── includes/                      ├── includes/
│   ├── navbar.html                │   ├── navbar.html (inherited + modified)
│   ├── footer.html                │   ├── footer.html
│   └── ...                        │   └── ...
└── components/                    └── components/
    └── ...                            └── ... (MD3 design system)
```

**Assessment:**
- Base template structure: Inherited (good practice)
- Auth templates: Likely inherited with minor modifications
- Public templates: Heavily customized for games_hispanistica
- Admin templates: Inherited, might be unused
- Corpus templates: **SHOULD NOT EXIST** in games_hispanistica
- Quiz templates: New, games_hispanistica-specific
- **Recommendation:** Verify no corpus templates exist

**Action Item:**
```bash
find templates/ -type d -name "*corpus*" -o -name "*search*"
# If found: REMOVE
ls -la templates/
# Verify structure matches: auth/, public/, admin/, quiz/, includes/, components/
```

---

### 2.2 Static CSS (MD3 Design System)

**Inherited From:** corapan-webapp (`static/css/`)  
**Current Status:** ✅ **KEPT & ENHANCED**

**CSS Architecture:**

```
static/css/
├── base.css                    (Inherited from corapan, modified)
├── md3/                        (Inherited MD3 tokens + components)
│   ├── tokens.css              (Inherited color system)
│   ├── typography.css          (Inherited)
│   ├── components/             (Inherited components)
│   │   ├── buttons.css
│   │   ├── cards.css
│   │   └── ...
│   └── (Games-hispanistica enhancements)
├── quiz/                       (NEW: Quiz-specific styles)
│   ├── quiz.css
│   └── animations.css
└── ...
```

**Assessment:**
- MD3 design system: INHERITED, valuable, keep
- Token customization: Games-hispanistica-specific, keep
- Corpus/search styles: Should be removed if present
- Quiz styles: New, appropriate
- **Recommendation:** KEEP MD3 system, verify no corpus-specific CSS exists

**Action Item:**
```bash
grep -r "corapan\|corpus\|search" static/css/
# Should mostly be in comments or old files
find static/css/ -name "*corpus*" -o -name "*search*"
```

---

### 2.3 Static JavaScript

**Inherited From:** corapan-webapp (`static/js/`)  
**Current Status:** ⚠️ **SELECTIVELY INHERITED**

**JS Modules Audit:**

| Module | corapan-webapp | games_hispanistica | Status |
|--------|---|---|---|
| `utils.js` | Utilities, helpers | Inherited | ✅ KEEP |
| `auth.js` | JWT token handling | Inherited | ✅ KEEP |
| `ui.js` | UI interactions | Inherited/modified | ✅ KEEP |
| `search.js` | Corpus search logic | ❌ **REMOVE** |
| `corpus.js` | Corpus-specific | ❌ **REMOVE** |
| `quiz.js` | Quiz logic | NEW | ✅ KEEP |

**Assessment:**
- Generic utilities: Keep
- Auth-related: Keep
- Corpus/search modules: Remove if present
- Quiz modules: New, appropriate
- **Recommendation:** Audit js/ directory for corpus code

**Action Item:**
```bash
ls -la static/js/
find static/js/ -name "*corpus*" -o -name "*search*" -o -name "*blacklab*"
# REMOVE all matches
```

---

## 3. Documentation Inheritance

### 3.1 Architecture Documentation

**Inherited From:** corapan-webapp (`docs/concepts/`, `docs/reference/`)  
**Current Status:** ⚠️ **HEAVILY MODIFIED, PARTIALLY OBSOLETE**

**Documentation Files Analysis:**

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/concepts/architecture.md` | System design | ⚠️ Inherited, needs update |
| `docs/concepts/authentication-flow.md` | Auth system | ✅ Mostly valid |
| `docs/concepts/search-architecture.md` | Corpus search | ❌ **REMOVE** |
| `docs/concepts/atlas-metadata-architecture.md` | Metadata handling | ⚠️ **CHECK** |
| `docs/concepts/blacklab-pipeline.md` | BlackLab setup | ⚠️ **KEEP if quiz uses audio** |
| `docs/concepts/webapp-status.md` | Project status | ❌ **REMOVE** |
| `docs/reference/api-auth-endpoints.md` | API docs | ✅ KEEP (updated) |
| `docs/reference/corpus-search-diagrams.md` | Search diagrams | ❌ **REMOVE** |
| `docs/reference/blacklab-configuration.md` | BlackLab config | ⚠️ **KEEP if relevant** |

**Assessment:**
- Auth documentation: Keep (relevant)
- Corpus/search documentation: Remove (not applicable)
- BlackLab docs: Keep only if quiz module uses audio features
- Architecture docs: Update to remove corapan references
- **Recommendation:** Archive corpus/search docs to `docs/_archive/`

**Action Item:**
```bash
# Move obsolete documentation to archive
mv docs/concepts/search-architecture.md docs/_archive/
mv docs/concepts/webapp-status.md docs/_archive/
mv docs/reference/corpus-search-diagrams.md docs/_archive/
# UPDATE: Remove corapan references from architecture.md
```

---

## 4. Configuration Files (Deployment, CI/CD)

### 4.1 Docker Setup

**Inherited From:** corapan-webapp (`Dockerfile`, `docker-compose.yml`)  
**Current Status:** ✅ **KEPT & MODIFIED**

**Current Docker Configuration:**
```yaml
# docker-compose.yml (games_hispanistica)
services:
  app:                           # Inherited from corapan
    build: .
    environment:
      DATABASE_URL: postgresql://...
      JWT_SECRET_KEY: ...
  db:                            # Inherited
    image: postgres:15
  redis:                         # Inherited (if present)
    image: redis:latest
  # Additional: blacklab (if quiz uses audio)
```

**Assessment:**
- Multi-service Docker setup: INHERITED, good practice
- Service names: Check for "corapan" references
- Necessary services: app, db, redis (if used), blacklab (if needed)
- **Recommendation:** KEEP, but verify no corapan-specific service names

**Action Item:**
```bash
grep -r "corapan" docker-compose.yml Dockerfile infra/
# Should only find comments or paths like /srv/webapps/corapan/
# If service names: update them
```

---

### 4.2 CI/CD Workflows

**Inherited From:** corapan-webapp (`.github/workflows/`)  
**Current Status:** ⚠️ **INHERITED WITH NAMING ISSUES**

**Workflow Analysis:**

```yaml
# .github/workflows/ci.yml
env:
  POSTGRES_DB: corapan_auth         # ⚠️ Should be hispanistica_games_auth
  POSTGRES_USER: corapan_auth       # ⚠️ Should be updated
  
# .github/workflows/deploy.yml
- name: Deploy corapan-webapp       # ❌ Wrong name
  script: cd /srv/webapps/corapan   # ⚠️ Outdated paths
```

**Assessment:**
- CI/CD structure: Inherited (good)
- Database names: Still reference "corapan"
- Deployment paths: Still reference "/srv/webapps/corapan"
- Container names: Check for "corapan-webapp"
- **Recommendation:** Update all database names and paths to games_hispanistica

**Action Items:**
```bash
sed -i 's/corapan_auth/hispanistica_games_auth/g' .github/workflows/*.yml
sed -i 's|/srv/webapps/corapan|/srv/webapps/hispanistica_games|g' .github/workflows/*.yml
sed -i 's/corapan-webapp/hispanistica-games/g' .github/workflows/*.yml
```

---

### 4.3 Deployment Scripts

**Inherited From:** corapan-webapp (`scripts/`, `ops/`)  
**Current Status:** ⚠️ **INHERITED, NEEDS REVIEW**

**Scripts Audit:**

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/deploy.sh` | Deployment automation | ⚠️ Update paths |
| `scripts/backup.sh` | Backup script | ✅ KEEP |
| `scripts/db_migrate.py` | Database migrations | ✅ KEEP |
| `ops/corapan-gunicorn.service` | Systemd unit | ⚠️ Rename |
| `ops/blacklab-server.service` | BlackLab service | ⚠️ CHECK if needed |

**Assessment:**
- Generic deployment scripts: Keep
- Backup/maintenance scripts: Keep
- Service files: Update names and paths
- **Recommendation:** Update all naming and paths

**Action Items:**
```bash
# Rename systemd service
mv ops/corapan-gunicorn.service ops/hispanistica-games-gunicorn.service
# Update content
sed -i 's/corapan/hispanistica-games/g' ops/hispanistica-games-gunicorn.service
```

---

## 5. Corapan-Specific Code to REMOVE

### 5.1 Features/Modules Not Needed in games_hispanistica

| Component | Location | Action |
|-----------|----------|--------|
| Corpus search | `src/app/routes/corpus.py` | DELETE if exists |
| Advanced search | `src/app/routes/search.py` | DELETE if exists |
| Corpus service | `src/app/services/corpus_service.py` | DELETE if exists |
| Search service | `src/app/services/search_service.py` | DELETE if exists |
| BlackLab integration | `src/app/services/blacklab.py` | DELETE if unused |
| Corpus models | `src/app/models/corpus.py` | DELETE if exists |
| Search history | DB tables, code | DELETE if unused |
| Admin corpus tools | `src/app/routes/admin.py` (corpus sections) | REMOVE if present |

**Action Commands:**
```bash
# Find and list potentially unused files
find src/ -name "*corpus*" -o -name "*search*" -o -name "*blacklab*"

# Example removals
rm -f src/app/routes/corpus.py
rm -f src/app/routes/search.py
rm -f src/app/services/corpus_service.py
rm -f src/app/services/search_service.py

# Remove corpus templates
find templates/ -name "*corpus*" -o -name "*search*" | xargs rm -f

# Remove corpus/search CSS
find static/css/ -name "*corpus*" -o -name "*search*" | xargs rm -f

# Remove corpus/search JS
find static/js/ -name "*corpus*" -o -name "*search*" | xargs rm -f
```

---

### 5.2 Database Tables to REMOVE (if present)

```sql
-- After verifying these tables are NOT used:
DROP TABLE IF EXISTS corpus_access CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS corpus_files CASCADE;
DROP TABLE IF EXISTS corpus_metadata CASCADE;

-- Commands to check if safe to drop:
SELECT * FROM corpus_access LIMIT 1;           -- If empty, safe to drop
SELECT COUNT(*) FROM search_history;           -- If 0, safe to drop
```

**Action:**
```bash
# Create migration to drop unused tables
cat > migrations/drop_corpus_tables.sql << 'EOF'
-- Remove corpus-related tables not used in games_hispanistica
DROP TABLE IF EXISTS corpus_access CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS corpus_files CASCADE;
DROP TABLE IF EXISTS corpus_metadata CASCADE;
EOF

# Apply migration (after backup!)
psql -d hispanistica_games < migrations/drop_corpus_tables.sql
```

---

### 5.3 Configuration to REMOVE

**Files/Settings to Delete:**
```python
# src/app/config/__init__.py
# REMOVE:
CORPUS_API_URL
BLACKLAB_SEARCH_ENDPOINT
BLACKLAB_LEMMA_ENDPOINT
CORPUS_ACCESS_CONTROL
SEARCH_FILTER_DEFAULTS
CORPUS_INDEXING_PATH
```

**Action:**
```bash
# Search and remove from all config files
grep -r "CORPUS\|BLACKLAB\|SEARCH" src/app/config/
# Manually edit and remove these lines
```

---

### 5.4 Documentation to ARCHIVE

**Files to move to `docs/_archive/`:**
```
docs/concepts/search-architecture.md
docs/concepts/corpus-advanced-search-planning.md
docs/concepts/atlas-metadata-architecture.md (check if relevant)
docs/concepts/blacklab-pipeline.md (check if relevant)
docs/concepts/webapp-status.md
docs/reference/corpus-api-canonical-columns.md
docs/reference/corpus-search-diagrams.md
docs/reference/corpus-search-quick-reference.md
docs/reference/blacklab-configuration.md (if not needed)
docs/reference/blacklab-index-structure.md (if not needed)
docs/reference/blacklab-legacy-artifacts.md
docs/how-to/advanced-search*.md (all)
docs/how-to/manage-blacklab-index.md
docs/how-to/build-blacklab-index.md
docs/how-to/execute-blacklab-stage-2-3.md
```

**Action:**
```bash
mkdir -p docs/_archive/inherited-from-corapan
mv docs/concepts/search-architecture.md docs/_archive/inherited-from-corapan/
mv docs/concepts/webapp-status.md docs/_archive/inherited-from-corapan/
# ... etc
```

---

## 6. Cleanup Checklist

### Phase 1: Code Removal (HIGH PRIORITY)
- [ ] Delete unused blueprint files (`corpus.py`, `search.py`)
- [ ] Delete unused service files
- [ ] Delete unused model files
- [ ] Remove corpus-related configuration
- [ ] Verify no import errors after deletions

### Phase 2: Database Cleanup (MEDIUM PRIORITY)
- [ ] Create migration to drop unused corpus tables
- [ ] Verify no data loss
- [ ] Test database startup

### Phase 3: Frontend Cleanup (MEDIUM PRIORITY)
- [ ] Remove corpus/search templates
- [ ] Remove corpus/search CSS
- [ ] Remove corpus/search JS
- [ ] Verify no broken links in navbar/routing

### Phase 4: CI/CD & Deployment (HIGH PRIORITY)
- [ ] Update database names in `.github/workflows/`
- [ ] Update deployment paths in workflows
- [ ] Update systemd service files
- [ ] Update deployment scripts

### Phase 5: Documentation (LOW PRIORITY)
- [ ] Archive corpus-related docs
- [ ] Update architecture documentation
- [ ] Remove corapan references from headers/intro
- [ ] Verify links still work

### Phase 6: Verification
- [ ] App starts cleanly
- [ ] No import errors
- [ ] Tests pass
- [ ] Git diff shows expected changes
- [ ] No broken links in documentation

---

## 7. Risk Assessment

**Low Risk - Safe to Remove:**
- Corpus search routes & services (NOT used in quiz module)
- Corpus API documentation (NOT relevant)
- Corpus database tables (verify empty first)
- Old systemd service names (redeploy to production with new names)

**Medium Risk - Review Carefully:**
- BlackLab integration (keep if quiz uses audio, otherwise remove)
- Admin dashboard code (may have been customized)
- Search-related configuration (verify no hidden dependencies)

**No Risk - Safe Operations:**
- Database name updates in CI/CD
- Deployment path updates
- Documentation archival
- Naming convention fixes

---

## 8. Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Code Removal | 1-2 hours | LOW |
| Database Cleanup | 30 minutes | MEDIUM |
| Frontend Cleanup | 1 hour | LOW |
| CI/CD Updates | 30 minutes | LOW |
| Documentation | 1 hour | VERY LOW |
| **Total** | **4-5 hours** | **LOW** |

---

## 9. Summary & Recommendations

### What to KEEP (Inherited & Necessary):
1. **Flask app factory architecture** - Proven pattern
2. **JWT authentication system** - Core feature
3. **Role-based access control** - Needed for admin/user distinction
4. **Database migration system** - Essential for schema management
5. **Docker multi-service setup** - Scalable deployment
6. **MD3 design system** - Modern, customized UI framework
7. **Deployment automation scripts** - Operational necessity
8. **Generic utility functions** - Code reuse

### What to REMOVE (Corapan-Specific):
1. **Corpus search routes & services** - Not applicable to games_hispanistica
2. **Corpus API documentation** - Misleading/irrelevant
3. **Unused database tables** - Data bloat, confusion
4. **BlackLab integration** - Only keep if quiz audio features use it
5. **Advanced search UI components** - Not relevant
6. **Corpus-specific configuration** - Technical debt

### What to UPDATE (Naming/Paths):
1. **Database names** - From `corapan_auth` to `hispanistica_games_auth`
2. **Service names** - From `corapan-gunicorn` to `hispanistica-games`
3. **Deployment paths** - From `/srv/webapps/corapan` to `/srv/webapps/hispanistica_games`
4. **CI/CD references** - All deployment targets

---

## 10. Next Steps

1. **Commit Current State:** Branch `chore/public-repo-cleanup` (if not already done)
2. **Execute Phase 1:** Remove unused code (commits: `chore: remove corpus search modules`)
3. **Execute Phase 2-3:** Database & frontend cleanup (commits: `chore: remove corpus-related schema/templates`)
4. **Execute Phase 4:** CI/CD updates (commits: `chore: update deployment names and paths`)
5. **Execute Phase 5:** Documentation archival (commits: `chore: archive inherited documentation`)
6. **Testing:** Run full test suite, verify app startup
7. **Final Commit:** `docs: add REPO_CLEANUP_REPORT.md with corapan audit`

---

**Prepared by:** Repository Audit  
**Date:** 2026-01-05  
**Referenced:** FTacke/corapan-webapp (v1.0.0 estimate)  
**Status:** Ready for implementation
