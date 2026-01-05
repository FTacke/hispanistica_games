# Inventory: game_modules/quiz

**Purpose:** Complete analysis of `game_modules/quiz` structure, ownership, references, and cleanup recommendations.

**Date:** 2026-01-05  
**Analyzed by:** Automated inventory script

---

## 1. Directory Tree Structure

```
game_modules/quiz/
├── __init__.py                          # Module entry point, exports quiz_blueprint
├── __pycache__/                         # Python bytecode cache (gitignored)
│   ├── __init__.cpython-312.pyc
│   ├── models.cpython-312.pyc
│   ├── routes.cpython-312.pyc
│   ├── seed.cpython-312.pyc
│   ├── services.cpython-312.pyc
│   └── validation.cpython-312.pyc
├── GOLD_STANDARD.md                     # Architecture & Gold Standard documentation
├── manifest.json                        # Module metadata (features, config, styling)
├── README.md                            # Module overview & API documentation
├── models.py                            # SQLAlchemy ORM models (PostgreSQL-only)
├── routes.py                            # Flask blueprint (web pages + REST API)
├── seed.py                              # Database seeding & media processing
├── services.py                          # Business logic (scoring, lifecycle, leaderboard)
├── validation.py                        # Content validation for JSON quiz units
├── migrations/                          # Manual SQL migration scripts
│   ├── README.md                        # Migration instructions
│   ├── 001_add_authors_to_topics.sql    # Add authors column to quiz_topics
│   └── 001_increase_question_id_length.sql  # Increase ID length for ULID support
├── quiz_units/                          # Quiz content files (JSON format)
│   ├── README.md                        # Content schema & management docs
│   ├── template/
│   │   └── quiz_template.json           # Template for new quiz units
│   └── topics/
│       ├── aussprache.json              # Quiz topic: Aussprache
│       ├── kreativitaet.json            # Quiz topic: Kreativität
│       ├── orthographie.json            # Quiz topic: Orthographie
│       └── variation_grammatik.json     # Quiz topic: Grammatik-Variation
└── styles/
    └── quiz.css                         # Module-scoped CSS styles
```

---

## 2. File Classification & Purpose

### Runtime Code (Required for application operation)

| File | Purpose | Import/Usage |
|------|---------|--------------|
| `__init__.py` | Module entry point | Imported by `src/app/__init__.py` to register blueprint |
| `models.py` | SQLAlchemy models (QuizTopic, QuizQuestion, QuizRun, etc.) | Imported by routes, services, tests, tools |
| `routes.py` | Flask blueprint + API endpoints | Imported via `__init__.py`, registered in app factory |
| `services.py` | Business logic (scoring, run lifecycle, player auth) | Imported by routes, tests |
| `seed.py` | DB seeding + media processing | Imported by `scripts/quiz_seed.py` and `scripts/init_quiz_db.py` |
| `validation.py` | JSON schema validation | Imported by seed.py, tests |
| `manifest.json` | Module metadata (features, config, styling) | Read by app at runtime for module discovery |
| `styles/quiz.css` | Scoped CSS styles | Loaded via manifest, served from static/ |

**Status:** ✅ All required for runtime

---

### Content Files (quiz_units/)

| File | Purpose | Usage Pattern | Status |
|------|---------|---------------|--------|
| `quiz_units/topics/*.json` | Quiz content (questions, answers, metadata) | Read by seed.py during import | ✅ Active content |
| `quiz_units/template/quiz_template.json` | Template for new units | Manual reference only | ✅ Dev tool |
| `quiz_units/README.md` | Content schema & authoring guide | Documentation only | ✅ Keep |

**Key Finding:**  
- `quiz_units/topics/` is the **source of truth** for quiz content
- Content is imported into DB via `seed.py` (called by `scripts/quiz_seed.py`)
- Files are **not** served directly at runtime (DB is runtime source)
- Content authors edit JSON files → run `quiz_seed.py` → content appears in app

**Content Pipeline:**
```
quiz_units/topics/*.json
    ↓ (edited by content authors)
scripts/quiz_units_normalize.py --write
    ↓ (generates IDs, statistics)
scripts/quiz_seed.py
    ↓ (imports to DB via seed.py)
Database (quiz_topics, quiz_questions)
    ↓ (queried at runtime)
Flask App (routes.py → services.py)
```

---

### Documentation Files

| File | Purpose | Target Audience | Redundancy Check |
|------|---------|-----------------|------------------|
| `README.md` | Module overview, API reference, setup guide | Developers integrating module | References older `content/` directory (obsolete path) |
| `GOLD_STANDARD.md` | Architecture & design decisions | Developers modifying module | Unique content, no redundancy |
| `quiz_units/README.md` | Content authoring guide (JSON schema, validation) | Content authors | Unique content, authoritative for schema |
| `migrations/README.md` | Migration instructions | DB admins | Unique content |

**Findings:**
- `README.md` references obsolete path `game_modules/quiz/content/topics/` (should be `quiz_units/topics/`)
- `GOLD_STANDARD.md` references correct backend paths but mentions old YAML format (now JSON)
- No major redundancy, but slight staleness

---

### Migrations (migrations/)

| File | Purpose | Usage | Status |
|------|---------|-------|--------|
| `001_add_authors_to_topics.sql` | Add `authors` column to `quiz_topics` | Manual execution (prod environments) | ✅ Historical migration |
| `001_increase_question_id_length.sql` | Increase `id` column to VARCHAR(100) for ULID support | Manual execution (prod environments) | ✅ Active migration (required for ULID IDs) |
| `README.md` | Migration execution instructions | DB admins | ✅ Keep |

**Key Finding:**  
- Migrations are **manual** (not automated via Alembic/Flask-Migrate)
- For **dev environments**: `init_quiz_db.py --drop` recreates schema from models (migrations not needed)
- For **production**: Migrations must be run manually before deploying code
- Both migrations are **idempotent** (safe to re-run)

**Migration Status:**  
- `001_add_authors_to_topics.sql` - Likely already applied in production
- `001_increase_question_id_length.sql` - **MUST BE APPLIED** before using ULID-based IDs (current format)

---

### Generated/Temporary Files (__pycache__)

| Directory | Purpose | Status |
|-----------|---------|--------|
| `__pycache__/` | Python bytecode cache | ❌ Should be gitignored (already in .gitignore) |

**Action:** Verify `.gitignore` includes `__pycache__/` (standard Python pattern)

---

## 3. Reference Analysis (Who imports what?)

### External References TO `game_modules/quiz`

**From Application Code:**

```python
# src/app/__init__.py (lines 199-214)
from game_modules.quiz import quiz_blueprint
app.register_blueprint(quiz_blueprint, url_prefix="/games/quiz")
```

**From Scripts:**

```python
# scripts/quiz_seed.py (line 224)
from game_modules.quiz.seed import seed_quiz_units, QUIZ_UNITS_TOPICS_DIR

# scripts/init_quiz_db.py (line 51)
from game_modules.quiz.models import QuizBase
from game_modules.quiz.seed import seed_quiz_units
```

**From Tests:** (20+ imports across multiple test files)

```python
# tests/test_quiz_module.py
from game_modules.quiz.models import QuizBase, QuizTopic, QuizQuestion, QuizRun, ...
from game_modules.quiz.routes import blueprint as quiz_blueprint
from game_modules.quiz.validation import validate_topic_content, ValidationError
from game_modules.quiz.services import calculate_answer_score, POINTS_PER_DIFFICULTY
from game_modules.quiz import services

# tests/test_quiz_gold.py
from game_modules.quiz import services
from game_modules.quiz.models import QuizRun, QuizScore, QuizTopic, QuizPlayer

# tests/test_quiz_admin_highscore.py
from game_modules.quiz.models import QuizScore, QuizPlayer, QuizRun, QuizTopic
from game_modules.quiz import services
```

**From Tools:**

```python
# tools/verify_contract.py
from game_modules.quiz.models import QuizBase, QuizTopic, QuizQuestion, QuizRun, QuizRunAnswer
```

**Summary:** All imports are from:
- `game_modules.quiz` (main module entry)
- `game_modules.quiz.models`
- `game_modules.quiz.routes`
- `game_modules.quiz.services`
- `game_modules.quiz.validation`
- `game_modules.quiz.seed`

**No imports from `quiz_units/` directly** (content is read as files, not imported as Python modules)

---

### Internal References WITHIN `game_modules/quiz`

```python
# seed.py imports from same module
from .models import QuizTopic, QuizQuestion
from .validation import validate_quiz_unit, ValidationError, QuizUnitSchema, UnitMediaSchema

# routes.py imports from same module
from .models import QuizTopic, QuizQuestion, QuizRun, QuizPlayer, QuizScore
from .services import create_or_get_player, start_or_resume_run, ...

# No circular dependencies detected
```

---

## 4. Ownership & Lifecycle Analysis

### Who calls `seed.py`?

**Primary Caller:** `scripts/quiz_seed.py` (CLI wrapper)
- Called manually: `python scripts/quiz_seed.py [--prune-soft|--prune-hard]`
- Called automatically: `dev-start.ps1` (line 88-99) runs quiz_seed.py before starting dev server

**Secondary Caller:** `scripts/init_quiz_db.py` (initial DB setup)
- Called manually during first setup: `python scripts/init_quiz_db.py --seed`

**Functionality:**
- Reads JSON files from `quiz_units/topics/`
- Validates content via `validation.py`
- Upserts into DB (idempotent)
- Copies media files from `seed_src` paths to `static/quiz-media/`
- Uses PostgreSQL advisory locks to prevent parallel execution

**Seeding is:**
- ✅ Automated in dev workflow (`dev-start.ps1`)
- ⚠️ Manual in production (run `quiz_seed.py` after deploying new content)
- ✅ Idempotent (safe to re-run)

---

### Who uses `quiz_units/`?

**Content Authors:**
- Edit `quiz_units/topics/*.json` to add/modify quiz content
- Run `scripts/quiz_units_normalize.py --write` to generate IDs and statistics
- Commit changes to git

**Deployment Pipeline:**
- `dev-start.ps1` → `quiz_seed.py` → `seed.py` reads JSON files → imports to DB
- Production: Same process, but manual trigger

**Runtime:** 
- ❌ Files are **NOT** read at runtime
- ✅ Content is loaded from database (already imported via seed)

**Key Insight:**  
`quiz_units/` is **build-time content**, not runtime. Analogous to:
- Static site generator: Markdown sources → HTML output
- Quiz module: JSON sources → PostgreSQL database

---

### Are migrations actively used?

**Development:** ❌ No
- `init_quiz_db.py --drop` recreates schema from models
- Migrations not needed (schema is always fresh)

**Production:** ⚠️ Manual
- No automated migration framework (Alembic/Flask-Migrate)
- Schema changes require:
  1. Write SQL migration in `migrations/`
  2. Run manually via psql or docker exec
  3. Deploy code with updated models
  
**Current Migration Status:**
- `001_add_authors_to_topics.sql` - Historical (likely applied)
- `001_increase_question_id_length.sql` - **Critical** for ULID support (must be applied before using current JSON format)

**Recommendation:** Consider adding migration tracking table (manual or via Alembic) to track applied migrations

---

## 5. Unused/Dead Code Analysis

### Files with NO direct imports:

✅ **Not dead code:**
- `manifest.json` - Read by app at runtime for module discovery
- `README.md`, `GOLD_STANDARD.md`, `quiz_units/README.md`, `migrations/README.md` - Documentation
- `migrations/*.sql` - Manual execution files
- `quiz_units/topics/*.json` - Read as data files by seed.py
- `quiz_units/template/quiz_template.json` - Developer reference
- `styles/quiz.css` - Loaded via manifest

### Potential Legacy/Dead Code:

❌ **None detected via import analysis**

All Python files in `game_modules/quiz/` are actively imported:
- `__init__.py` → imported by app factory
- `models.py` → imported by routes, services, tests, tools
- `routes.py` → imported via __init__.py
- `services.py` → imported by routes, tests
- `seed.py` → imported by scripts
- `validation.py` → imported by seed, tests

---

## 6. Dockerfile & Deployment

**Dockerfile Analysis:**

```dockerfile
# Line 55-56: Copies entire application
COPY . .
RUN chown -R gamesapp:gamesapp /app
```

**Implication:**  
- Entire `game_modules/quiz/` directory is copied to Docker image
- This includes:
  - ✅ Runtime code (models.py, routes.py, etc.)
  - ✅ Content files (quiz_units/topics/*.json) - needed for seeding
  - ✅ Migrations (migrations/*.sql) - may be needed for manual prod migrations
  - ❌ Docs (README.md, GOLD_STANDARD.md) - not strictly needed in runtime image
  - ❌ Template (quiz_units/template/) - not needed in runtime image
  - ❌ `__pycache__/` - should be excluded via .dockerignore

**No explicit COPY for `game_modules/` in Dockerfile** - relies on `COPY . .` pattern

---

## 7. Proposed Cleanup Plan

### Phase 1: Safe Cleanup (No Moves, High Confidence)

#### 1.1. Remove `__pycache__` from git tracking (if present)

**Action:**
```powershell
git rm -r --cached game_modules/quiz/__pycache__/
```

**Verification:**
```powershell
rg -n "__pycache__" .gitignore
```

**Expected:** Already in `.gitignore` (standard Python pattern)

---

#### 1.2. Update stale documentation references

**File:** `game_modules/quiz/README.md`

**Change:** Line 31 (and similar)
```diff
-| `game_modules/quiz/content/topics/` | Topic YAML files |
+| `game_modules/quiz/quiz_units/topics/` | Topic JSON files |
```

**Change:** Line 138
```diff
-**Location:** `game_modules/quiz/content/topics/<topic_id>.yml`
+**Location:** `game_modules/quiz/quiz_units/topics/<topic_id>.json`
```

**Change:** Line 202
```diff
-python scripts/init_quiz_db.py --topic-file game_modules/quiz/content/topics/my_topic.yml
+python scripts/init_quiz_db.py --seed
```

**Verification:**
```powershell
rg -n "content/topics|\.yml|\.yaml" game_modules/quiz/README.md
```

---

#### 1.3. Update GOLD_STANDARD.md for JSON format

**File:** `game_modules/quiz/GOLD_STANDARD.md`

**Change:** Add note about current format
```markdown
### Content Format (Updated 2026-01)
- **Current:** JSON format (quiz_unit_v1/v2 schema) in `quiz_units/topics/`
- **Legacy:** YAML format (deprecated, no longer used)
```

---

### Phase 2: Structural Cleanup (Moves, Requires Testing)

⚠️ **CAUTION:** These changes require verification that all references are updated

#### 2.1. Move documentation out of `game_modules/quiz/`

**Goal:** Keep runtime code lean, move docs to `docs/components/quiz/`

**Proposed Moves:**

| Source | Destination | Reason |
|--------|-------------|--------|
| `game_modules/quiz/README.md` | `docs/components/quiz/MODULE_README.md` | Module-specific docs |
| `game_modules/quiz/GOLD_STANDARD.md` | `docs/components/quiz/ARCHITECTURE.md` | Architecture docs |
| `game_modules/quiz/quiz_units/README.md` | `docs/components/quiz/CONTENT_AUTHORING.md` | Content authoring guide |

**Leave in place:**
- `game_modules/quiz/migrations/README.md` (keep close to migration scripts)

**Actions After Move:**
1. Update all references to moved files:
   ```powershell
   rg -n "game_modules/quiz/README\.md|game_modules/quiz/GOLD_STANDARD\.md|quiz_units/README\.md" -S .
   ```

2. Add redirect stubs in original locations:
   ```markdown
   # README.md
   > **Note:** This documentation has been moved to [`docs/components/quiz/MODULE_README.md`](../../../docs/components/quiz/MODULE_README.md)
   ```

3. Update `docs/components/quiz/README.md` to reference new files

**Verification:**
```powershell
pytest tests/ -k quiz -v
rg -n "game_modules/quiz/README|GOLD_STANDARD" docs/ startme.md scripts/
```

---

#### 2.2. Restructure `quiz_units/` for clarity

**Current Structure:**
```
quiz_units/
├── README.md
├── template/
│   └── quiz_template.json
└── topics/
    ├── aussprache.json
    ├── kreativitaet.json
    ├── orthographie.json
    └── variation_grammatik.json
```

**Proposed Alternative (OPTIONAL, for discussion):**

```
content/
├── schema/
│   ├── quiz_unit_schema.json      # JSON schema (for validation)
│   └── template.json               # Template for new units
├── topics/
│   ├── aussprache.json
│   ├── kreativitaet.json
│   ├── orthographie.json
│   └── variation_grammatik.json
└── README.md                       # Authoring guide
```

**Goal:** Separate schema/tooling from actual content

**Impact Analysis Required:**
- `seed.py` hardcodes path: `QUIZ_UNITS_DIR = Path(__file__).parent / "quiz_units"`
- `scripts/quiz_units_normalize.py` defaults to: `game_modules/quiz/quiz_units/topics`
- `scripts/quiz_seed.py` imports: `from game_modules.quiz.seed import QUIZ_UNITS_TOPICS_DIR`

**Decision:** ⚠️ **DEFER** to Phase 3 (requires changing multiple constants)

---

#### 2.3. Clarify template location

**Current:** `quiz_units/template/quiz_template.json`  
**Alternative:** Move to `docs/components/quiz/examples/quiz_template.json`

**Rationale:**
- Template is a developer tool, not runtime content
- Reduces confusion: `quiz_units/topics/` only contains actual quiz content

**Impact:**
- Update `quiz_units/README.md` references to template

**Decision:** ✅ **Safe to move** (template is only a reference, no code imports it)

---

### Phase 3: Advanced Restructuring (Requires Refactoring)

⚠️ **NOT RECOMMENDED for initial cleanup** (too invasive)

#### 3.1. Separate content from code

**Goal:** Move all content out of `game_modules/quiz/`

**Proposed Structure:**
```
game_modules/quiz/           # Runtime code only
├── __init__.py
├── models.py
├── routes.py
├── services.py
├── validation.py
├── seed.py                  # Still here, but parameterized
├── manifest.json
└── styles/

content/quiz/                # Content only (new top-level dir)
├── schema/
│   ├── quiz_unit_v1.schema.json
│   ├── quiz_unit_v2.schema.json
│   └── template.json
├── topics/
│   ├── aussprache.json
│   ├── kreativitaet.json
│   ├── orthographie.json
│   └── variation_grammatik.json
└── README.md

docs/components/quiz/        # Documentation
├── MODULE_README.md
├── ARCHITECTURE.md
├── CONTENT_AUTHORING.md
└── MIGRATION_GUIDE.md
```

**Required Changes:**
1. Update `seed.py` constant: `QUIZ_UNITS_DIR` → parameterize or move to config
2. Update `scripts/quiz_units_normalize.py` default path
3. Update `scripts/quiz_seed.py` imports and paths
4. Update `dev-start.ps1` and `dev-setup.ps1` paths
5. Update Dockerfile (if content is separate, may need explicit COPY)
6. Update all documentation references

**Benefits:**
- Clear separation: code vs. content vs. docs
- Easier to version content separately (future: content repo?)
- Cleaner `game_modules/quiz/` (runtime code only)

**Risks:**
- High impact change (10+ files affected)
- Requires coordinated update across scripts, app code, and CI/CD
- May break deployment scripts if paths are hardcoded

**Decision:** ❌ **DEFER** - Too invasive for initial cleanup

---

### Phase 4: Migration Strategy

#### 4.1. Add migration tracking

**Current State:**
- Migrations are manual SQL files
- No tracking of which migrations have been applied
- Risk of running migrations out of order or twice

**Recommendation:** Add lightweight tracking

**Option 1: Manual tracking table**
```sql
CREATE TABLE IF NOT EXISTS quiz_schema_migrations (
    migration_name VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Option 2: Adopt Alembic/Flask-Migrate**
- More robust (autogeneration, rollback, etc.)
- Requires refactoring existing migrations

**Decision:** ⚠️ **Out of scope** for cleanup (functional change)

---

## 8. Summary: What Stays, What Moves, What Deletes

### ✅ Stays in `game_modules/quiz/` (No changes)

**Runtime Code:**
- `__init__.py`
- `models.py`
- `routes.py`
- `services.py`
- `seed.py`
- `validation.py`
- `manifest.json`
- `styles/quiz.css`

**Migrations:**
- `migrations/*.sql`
- `migrations/README.md`

**Content (for now):**
- `quiz_units/topics/*.json`
- `quiz_units/README.md` (authoring guide)

---

### 📝 Updates in Place (Documentation fixes)

| File | Change | Priority |
|------|--------|----------|
| `game_modules/quiz/README.md` | Fix `content/topics/` → `quiz_units/topics/`, YAML → JSON | High |
| `game_modules/quiz/GOLD_STANDARD.md` | Add note about JSON format | Medium |
| `docs/README.md` | Verify links to quiz docs are current | Low |

---

### 🚚 Proposed Moves (Phase 2, Optional)

| Source | Destination | Reason | Risk |
|--------|-------------|--------|------|
| `game_modules/quiz/quiz_units/template/quiz_template.json` | `docs/components/quiz/examples/quiz_template.json` | Dev tool, not runtime content | Low |
| `game_modules/quiz/README.md` | `docs/components/quiz/MODULE_README.md` | Keep docs centralized | Medium |
| `game_modules/quiz/GOLD_STANDARD.md` | `docs/components/quiz/ARCHITECTURE.md` | Keep docs centralized | Medium |

**Note:** Moves require updating references and leaving redirect stubs

---

### ❌ Deletes (None)

**No files are candidates for deletion:**
- All Python files are actively imported
- All docs provide unique value
- All content files are active quiz topics
- Migrations are needed for production deployments

**Only cleanup:**
- Ensure `__pycache__/` is gitignored (should already be)

---

## 9. Blockers & Open Questions

### 🔴 Blockers (Must resolve before major restructuring)

**None for Phase 1 (safe cleanup)**

**For Phase 2 (moves):**
1. Confirm all documentation links are updated (run rg search after moves)
2. Verify tests still pass after doc moves: `pytest tests/test_quiz*.py -v`

**For Phase 3 (content separation):**
1. Agreement on content directory structure (`content/quiz/` vs. `game_modules/quiz/content/`)
2. Update seed.py path resolution (parameterize vs. hardcode)
3. CI/CD pipeline updates (if content is versioned separately)
4. Docker build verification (ensure content files are copied)

---

### 🟡 Open Questions (Need stakeholder input)

1. **Content Versioning:** Should quiz content live in a separate repo/directory for independent versioning?
   - Pro: Content authors don't need full dev environment
   - Con: More complexity in build/deploy pipeline

2. **Migration Framework:** Should we adopt Alembic for automated migrations?
   - Pro: Safer, trackable, rollback support
   - Con: Learning curve, refactoring existing migrations

3. **Template Location:** Keep template in `quiz_units/` or move to `docs/`?
   - Current: `quiz_units/template/quiz_template.json`
   - Proposed: `docs/components/quiz/examples/quiz_template.json`
   - Decision: Defer to content authors

4. **Documentation Consolidation:** Should `game_modules/quiz/README.md` be the source of truth, or should `docs/components/quiz/README.md`?
   - Current: Two separate READMEs with overlapping content
   - Proposed: One authoritative source in `docs/`, stub in `game_modules/quiz/`

---

## 10. Recommended Actions (Prioritized)

### ✅ Phase 1: Safe Cleanup (Execute now, low risk)

1. **Verify `.gitignore` excludes `__pycache__/`**
   ```powershell
   rg -n "__pycache__" .gitignore
   ```

2. **Update README.md references (content/topics → quiz_units/topics)**
   - File: `game_modules/quiz/README.md`
   - Lines: 31, 138, 202

3. **Add format note to GOLD_STANDARD.md**
   - File: `game_modules/quiz/GOLD_STANDARD.md`
   - Add section on JSON format vs. legacy YAML

4. **Run tests to establish baseline**
   ```powershell
   pytest tests/test_quiz*.py -v
   ```

---

### ⚠️ Phase 2: Structural Cleanup (Requires approval, medium risk)

**Wait for stakeholder approval before executing**

1. **Move template to docs/**
   ```powershell
   mkdir docs/components/quiz/examples/
   mv game_modules/quiz/quiz_units/template/quiz_template.json docs/components/quiz/examples/
   rmdir game_modules/quiz/quiz_units/template/
   ```

2. **Update references to template**
   - File: `game_modules/quiz/quiz_units/README.md`
   - Update path to template

3. **Move docs to `docs/components/quiz/`** (optional)
   - Requires updating all references and leaving redirect stubs

4. **Re-run tests**
   ```powershell
   pytest tests/test_quiz*.py -v
   ```

---

### 🔵 Phase 3: Advanced Restructuring (Defer, high risk)

**Do NOT execute without full design review**

- Content separation (`content/quiz/` top-level directory)
- Migration framework adoption (Alembic)
- Path refactoring in seed.py and scripts

**Requires:**
- Design document with full impact analysis
- Coordination with CI/CD team
- Phased rollout with feature flags

---

## 11. Conclusion

**Current State:**  
`game_modules/quiz` is well-structured with clear separation of concerns:
- Runtime code (models, routes, services) ✅
- Content pipeline (seed.py, validation.py) ✅
- Content files (quiz_units/topics/*.json) ✅
- Documentation (READMEs, GOLD_STANDARD.md) ✅
- Migrations (manual SQL files) ✅

**No dead code detected.** All files serve active purposes.

**Recommended Cleanup:**
- **High Priority:** Fix stale documentation references (content/topics → quiz_units/topics)
- **Medium Priority:** Move template to docs/examples/
- **Low Priority:** Consider doc consolidation in future refactor

**Avoid:**
- Major restructuring without stakeholder buy-in
- Moving content files without thorough path analysis
- Adopting new migration framework without migration plan

**Next Steps:**
1. Execute Phase 1 (safe cleanup)
2. Get approval for Phase 2 (moves)
3. Defer Phase 3 (advanced restructuring) to future sprint

---

**End of Inventory**
