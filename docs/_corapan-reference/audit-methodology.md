# Audit Guide: games_hispanistica vs. corapan-webapp
## Step-by-Step Comparison Methodology

---

## Overview

This guide helps you systematically audit the games_hispanistica repository against corapan-webapp to:
1. Identify what code was inherited from the parent template
2. Determine which code is still needed
3. Find code that can be safely removed or consolidated
4. Understand modifications made for games-specific features

---

## Phase 1: Macro-Level Comparison (High-Level Structure)

### Task 1.1: Compare Directory Trees

**Compare these key directories:**

```bash
# Generate tree of both repos
tree -L 2 --dirsfirst /path/to/corapan-webapp/src/app/ > corapan_tree.txt
tree -L 2 --dirsfirst /path/to/games_hispanistica/src/app/ > games_tree.txt
diff corapan_tree.txt games_tree.txt
```

**Look For:**
- ✅ Same subdirectories = Likely inherited
- ❌ Missing subdirectories = May have been pruned (intentional)
- 🆕 New subdirectories = Game-specific modules

**Expected Matches:**
- `auth/` - Should be identical or very similar
- `routes/` - Similar structure, may have game-specific routes
- `extensions/` - Should be identical
- `config/` - May differ in environment variables
- `services/` - Some shared (auth, database), some game-specific

### Task 1.2: Compare Root Configuration Files

**Check These Files:**

| File | Action | Expected |
|------|--------|----------|
| `pyproject.toml` | Compare dependencies | Some new deps for games features |
| `requirements.txt` | Compare packages | Additions for game modules (quiz, etc.) |
| `.env.example` | Compare env vars | New vars for game-specific features |
| `Dockerfile` | Compare build steps | Minor changes for new dependencies |
| `docker-compose.yml` | Compare services | May add Redis, additional services |
| `README.md` | Compare content | Customized for games project |
| `Makefile` | Compare targets | May have game-specific tasks |

**Command:**
```bash
diff corapan-webapp/pyproject.toml games_hispanistica/pyproject.toml
```

### Task 1.3: Blueprint Comparison

**File to Compare:**
- `src/app/routes/__init__.py`

**Expected Findings:**

**Inherited Blueprints:**
```python
# Should be present in games_hispanistica
public, auth, media, admin, admin_users, stats, bls_proxy
```

**May Be Removed (if games doesn't use corpus):**
```python
# May be absent
advanced, atlas, player, editor, corpus
```

**New Game-Specific Blueprints:**
```python
# Likely added for games
# Examples: quiz, leaderboard, progress, achievements
```

---

## Phase 2: Authentication System Deep Dive

### Task 2.1: Compare Auth Module

**Compare these files line-by-line:**

```bash
# Check if auth modules are identical or modified
diff corapan-webapp/src/app/auth/models.py games_hispanistica/src/app/auth/models.py
diff corapan-webapp/src/app/auth/services.py games_hispanistica/src/app/auth/services.py
diff corapan-webapp/src/app/routes/auth.py games_hispanistica/src/app/routes/auth.py
```

**Expected Findings:**

**Likely Unchanged:**
- `src/app/auth/models.py` - User, RefreshToken, AuditLog should be identical
- `src/app/auth/services.py` - Core password/token operations unchanged
- `src/app/extensions/__init__.py` - JWT setup likely unchanged

**Likely Modified:**
- `src/app/routes/auth.py` - May have game-specific redirects after login
- Template paths in auth routes may point to different location
- Error messages may be translated (Spanish)

### Task 2.2: Database Schema Comparison

**Compare migration files:**

```bash
# Check if migrations are identical
diff corapan-webapp/migrations/0001_create_auth_schema_postgres.sql \
     games_hispanistica/migrations/0001_create_auth_schema_postgres.sql

diff corapan-webapp/migrations/0001_create_auth_schema_sqlite.sql \
     games_hispanistica/migrations/0001_create_auth_schema_sqlite.sql
```

**Expected Findings:**

- ✅ Core auth tables (`users`, `refresh_tokens`, `audit_log`) should be identical
- 🆕 Additional tables for game-specific data (quiz, progress, scores, leaderboards)
- ✅ May have `2002_create_quiz_tables.sql` or similar

### Task 2.3: JWT Configuration

**Check environment variable handling:**

```bash
# In games_hispanistica/src/app/config/
# Look for any changes to JWT setup
grep -n "JWT_" games_hispanistica/src/app/config/*.py
grep -n "JWT_" corapan-webapp/src/app/config/*.py
```

**Expected:**
- Same JWT algorithm (HS256)
- Same cookie configuration (secure, HTTP-only, SameSite)
- Possibly different secret key names (unlikely)

---

## Phase 3: Route & Blueprint Analysis

### Task 3.1: List All Routes in games_hispanistica

**Generate route map:**

```bash
# Using grep to find all route definitions
grep -r "@blueprint\.\|@.*\.route" games_hispanistica/src/app/routes/ | \
  sed 's/:.*@/@/' > games_routes.txt

grep -r "@blueprint\.\|@.*\.route" corapan-webapp/src/app/routes/ | \
  sed 's/:.*@/@/' > corapan_routes.txt
```

**Compare the two lists:**
```bash
diff corapan_routes.txt games_routes.txt
```

### Task 3.2: Identify Game-Specific Routes

**Look for routes that are unique to games_hispanistica:**

```
/quiz/*              → Quiz gameplay
/leaderboard/*       → Leaderboard display
/progress/*          → User progress tracking
/game/*              → Game-specific pages
/achievements/*      → Achievement tracking
```

**Verify these are game modules, not modifications to inherited code.**

### Task 3.3: Check for Corpus/Search Routes

**Determine if games kept or removed corpus features:**

```bash
# Check for BlackLab integration
grep -r "BLACKLAB" games_hispanistica/

# Check for advanced search
grep -r "advanced_search\|bls_proxy" games_hispanistica/src/app/routes/

# Check for audio player
grep -r "player\|audio_snippets" games_hispanistica/src/app/routes/
```

**Expected:**
- If games is pure education (no corpus): These should be absent or minimal
- If games includes linguistic content: Some may be retained

---

## Phase 4: Template System Analysis

### Task 4.1: Compare Base Template

**Compare master layout:**

```bash
diff corapan-webapp/templates/base.html \
     games_hispanistica/templates/base.html
```

**Expected Differences:**
- Different branding (logo, title, colors)
- Different navigation menu (game-specific sections)
- Same structure (MD3 shell, top app bar, nav drawer)

**Check For:**
- ✅ Same `{% block content %}` structure
- ✅ Same Flask-JWT-extended integration
- 🆕 New game-specific navigation items

### Task 4.2: List All Templates

**Generate template inventory:**

```bash
find games_hispanistica/templates -name "*.html" -type f | sort > games_templates.txt
find corapan-webapp/templates -name "*.html" -type f | sort > corapan_templates.txt
```

**Compare:**
```bash
# Templates only in games
comm -23 games_templates.txt corapan_templates.txt

# Templates only in corapan (may be pruned)
comm -13 games_templates.txt corapan_templates.txt
```

**Analyze:**
- `templates/auth/*` - Should be identical or minimally modified
- `templates/pages/` - Likely has game-specific pages (quiz, leaderboard, etc.)
- `templates/search/` - If present, check if from corapan or heavily modified

### Task 4.3: Auth Template Comparison

**Compare critical auth pages:**

```bash
diff corapan-webapp/templates/auth/login.html \
     games_hispanistica/templates/auth/login.html
```

**Expected:**
- Same login form structure
- Possibly different styling/branding
- Possibly Spanish translation

---

## Phase 5: Static Assets Analysis

### Task 5.1: CSS Framework Comparison

**Check Material Design 3 tokens:**

```bash
# Compare color tokens
diff corapan-webapp/static/css/md3/tokens.css \
     games_hispanistica/static/css/md3/tokens.css
```

**Expected:**
- Different colors (project-specific branding)
- Same structure and variable names
- If completely different: May have switched design systems

### Task 5.2: JavaScript Module Inventory

**List all JS modules:**

```bash
find games_hispanistica/static/js -type f -name "*.js" | sort > games_js.txt
find corapan-webapp/static/js -type f -name "*.js" | sort > corapan_js.txt

# Unique to games
comm -23 games_js.txt corapan_js.txt
```

**Analyze Game-Specific Modules:**
```
static/js/modules/quiz/          → Quiz game logic
static/js/modules/timer/         → Game timer
static/js/modules/leaderboard/   → Leaderboard display
static/js/modules/progress/      → Progress tracking
```

### Task 5.3: Vendor Libraries Check

**Compare third-party libraries:**

```bash
ls corapan-webapp/static/vendor/
ls games_hispanistica/static/vendor/

# Diff the listings
ls corapan-webapp/static/vendor/ | sort > corapan_vendor.txt
ls games_hispanistica/static/vendor/ | sort > games_vendor.txt
diff corapan_vendor.txt games_vendor.txt
```

**Expected Changes:**
- If games doesn't use Leaflet/ECharts, those may be removed
- New libraries for game mechanics (if any)

---

## Phase 6: Services & Business Logic

### Task 6.1: Compare Core Services

**Check inherited services:**

```bash
# Auth services should be identical
diff corapan-webapp/src/app/services/database.py \
     games_hispanistica/src/app/services/database.py

# Check for modifications to auth
grep -A 10 "class User" corapan-webapp/src/app/services/database.py
grep -A 10 "class User" games_hispanistica/src/app/services/database.py
```

**Expected:**
- `database.py` - Identical or minimal changes
- `auth/services.py` - Identical

**Look For:**
- Additional columns in User model (game-specific fields)
- New models for quiz, progress, leaderboard

### Task 6.2: Identify Game-Specific Services

**Search for new service modules:**

```bash
ls corapan-webapp/src/app/services/
ls games_hispanistica/src/app/services/

# New services unique to games
ls games_hispanistica/src/app/services/ | \
  grep -v "^$(ls corapan-webapp/src/app/services/)"
```

**Expected Game Services:**
- `quiz_manager.py` - Quiz logic & scoring
- `leaderboard.py` - Score tracking & ranking
- `progress_tracker.py` - User progress
- `game_state.py` - Game session management

---

## Phase 7: Tests Comparison

### Task 7.1: Test Suite Analysis

**List test files:**

```bash
ls corapan-webapp/tests/test_*.py | sort > corapan_tests.txt
ls games_hispanistica/tests/test_*.py | sort > games_tests.txt

# New tests in games
comm -23 games_tests.txt corapan_tests.txt
```

**Expected:**
- All auth tests inherited
- New game-specific tests (quiz, leaderboard, etc.)

### Task 7.2: Test Fixtures Comparison

**Check if fixtures are shared:**

```bash
# Compare conftest.py (if exists)
diff corapan-webapp/tests/conftest.py \
     games_hispanistica/tests/conftest.py
```

**Expected:**
- Same Flask app fixture setup
- Same database fixture pattern
- Game-specific fixtures added

---

## Phase 8: Configuration & Deployment

### Task 8.1: Environment Variable Analysis

**Compare .env.example files:**

```bash
diff corapan-webapp/.env.example \
     games_hispanistica/.env.example
```

**Categorize differences:**

**Inherited (Should Match):**
```bash
FLASK_SECRET_KEY=
JWT_SECRET_KEY=
AUTH_DATABASE_URL=
FLASK_ENV=
```

**Removed (if not using corpus):**
```bash
BLACKLAB_BASE_URL=
ALLOW_PUBLIC_TEMP_AUDIO=
```

**New (Game-Specific):**
```bash
# Look for new variables
QUIZ_TIME_LIMIT=
LEADERBOARD_ENABLED=
```

### Task 8.2: Docker Configuration

**Compare Dockerfile:**

```bash
diff corapan-webapp/Dockerfile \
     games_hispanistica/Dockerfile
```

**Expected:**
- Same base image (Python 3.12)
- Same dependencies installation
- Possibly different EXPOSE ports (if game adds services)

**Compare docker-compose.yml:**

```bash
diff corapan-webapp/docker-compose.yml \
     games_hispanistica/docker-compose.yml
```

**Look For:**
- Same services (web, db)
- Removed services (blacklab, if not used)
- New services (if game adds Redis, etc.)

### Task 8.3: Deployment Scripts

**List deployment scripts:**

```bash
ls corapan-webapp/scripts/
ls games_hispanistica/scripts/
```

**Inherited scripts** (likely identical):
- `create_initial_admin.py`
- `deploy_*.sh`
- `start_*.ps1`

**Game-specific scripts** (if any):
- Database seeding for quiz data
- Game balance/difficulty adjustment tools

---

## Phase 9: Documentation Review

### Task 9.1: Check for Inherited Documentation

**Compare documentation structure:**

```bash
ls corapan-webapp/docs/
ls games_hispanistica/docs/

# Check if MODULES.md, ARCHITECTURE.md are present
ls games_hispanistica/docs/MODULES.md
ls games_hispanistica/docs/ARCHITECTURE.md
```

**If present:**
- May be tailored to game-specific modules
- Compare for differences

**If absent:**
- May have been intentionally removed (minimal documentation)

### Task 9.2: README Comparison

```bash
diff corapan-webapp/README.md \
     games_hispanistica/README.md
```

**Expected:**
- Different project title and description
- Same setup/installation steps
- Different feature list

---

## Phase 10: Consolidated Analysis

### Summary Worksheet

Create a file: `audit_summary.txt`

```
INHERITED COMPONENTS (From corapan-webapp):
============================================
[ ] Application Factory (src/app/__init__.py)
[ ] JWT Authentication (src/app/auth/)
[ ] Role-Based Access Control
[ ] Admin User Management (src/app/routes/admin.py)
[ ] Material Design 3 (static/css/md3/)
[ ] Auth Templates (templates/auth/)
[ ] Base Layout (templates/base.html)
[ ] Database ORM (src/app/services/database.py)
[ ] Flask Extensions (src/app/extensions/)
[ ] Test Fixtures (tests/conftest.py)
[ ] Docker Setup (Dockerfile, docker-compose.yml)

REMOVED/PRUNED COMPONENTS:
===========================
[ ] BlackLab Corpus Search (src/app/search/)
[ ] Audio Player (src/app/routes/player.py)
[ ] Atlas/Mapping (src/app/routes/atlas.py)
[ ] Statistics Dashboard (src/app/routes/stats.py)
[ ] Export Functionality (search/export.py)
[ ] Leaflet Map Library (static/vendor/leaflet/)
[ ] ECharts Library (static/vendor/echarts/)

GAME-SPECIFIC COMPONENTS (New):
================================
[ ] Quiz Engine (src/app/routes/quiz.py)
[ ] Leaderboard (src/app/routes/leaderboard.py)
[ ] Progress Tracking (src/app/services/progress.py)
[ ] Achievement System (src/app/services/achievements.py)
[ ] Game Timer (static/js/modules/timer/)
[ ] Quiz Templates (templates/pages/quiz*.html)

MODIFIED COMPONENTS (Inherited but Changed):
==============================================
[ ] Login Redirect (src/app/routes/auth.py - redirects to game)
[ ] User Model (src/app/auth/models.py - added game fields?)
[ ] Database Migrations (migrations/ - added quiz tables?)
[ ] Environment Variables (.env.example - new game vars?)
[ ] Navigation (templates/base.html - game menu items)
[ ] CSS Tokens (static/css/md3/tokens.css - different colors)

DEPENDENCY CHANGES:
===================
Added Packages:
- (list any new packages in requirements.txt)

Removed Packages:
- (any packages from corapan not in games)

VERDICT:
========
[ ] Reusable Template: Yes / No
[ ] Major Deviations: Yes / No
[ ] Ready for Cleanup: Yes / No
[ ] Recommended Actions:
    -
    -
    -
```

---

## Quick Audit Checklist

Use this checklist to guide your comparison:

```
PHASE 1: Structure
- [ ] Directory trees match (src/app/ structure)
- [ ] Same blueprints registered
- [ ] Same extensions configured

PHASE 2: Authentication
- [ ] Auth models identical
- [ ] Auth routes similar (may have redirects)
- [ ] Database schema same
- [ ] JWT configuration unchanged

PHASE 3: Routes
- [ ] Inherited routes documented
- [ ] Game-specific routes identified
- [ ] Corpus routes status (kept/removed)

PHASE 4: Templates
- [ ] Base layout structure same
- [ ] Auth templates minimal changes
- [ ] Game pages clearly separated

PHASE 5: Static Assets
- [ ] MD3 tokens modified for branding
- [ ] Game-specific JS modules identified
- [ ] Vendor libraries appropriate

PHASE 6: Services
- [ ] Database service unchanged
- [ ] Game services documented
- [ ] No code duplication

PHASE 7: Tests
- [ ] Auth tests inherited
- [ ] Game tests comprehensive
- [ ] Fixtures reused

PHASE 8: Configuration
- [ ] Env vars appropriate
- [ ] Docker setup functional
- [ ] Deployment scripts working

PHASE 9: Documentation
- [ ] README updated
- [ ] Game-specific docs clear
- [ ] Architecture documented

PHASE 10: Final Review
- [ ] Cleanup recommendations noted
- [ ] Unused code identified
- [ ] Optimization opportunities found
```

---

## Output: Creating Your Audit Report

### Recommended Report Structure

```markdown
# games_hispanistica Audit Report
## Comparison with corapan-webapp v1.0.0

### Executive Summary
- Inheritance level: X%
- Modified components: X
- New components: X
- Code to remove: X

### Key Findings
1. Inherited components (verified identical)
2. Modified components (with changes documented)
3. Game-specific additions (with purpose)
4. Redundant/unused code (for removal)

### Component-by-Component Analysis
[For each major component]

### Removal Opportunities
- [Component name] - [Reason]
- [Component name] - [Reason]

### Optimization Recommendations
1. [Action items]
2. [Action items]

### Conclusion & Next Steps
```

---

**Audit Guide for:** games_hispanistica team  
**Reference Repository:** FTacke/corapan-webapp v1.0.0  
**Created:** January 5, 2026
