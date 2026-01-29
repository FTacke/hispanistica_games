# Quiz Mechanics Change Checklist

**Purpose:** Pre-flight checklist for any changes to game mechanics (scoring, timer, question selection, jokers)  
**When to Use:** Before implementing changes that affect gameplay, fairness, or leaderboard comparison

---

## Overview

Quiz mechanics are tightly coupled across multiple layers:
- **Services Layer** – Core logic (selection, scoring, timer)
- **Database Schema** – State storage (JSONB structures)
- **API Contracts** – Endpoints (request/response formats)
- **Frontend** – UI/UX (timer display, scoring animation)
- **Tests** – Validation (golden paths, edge cases)

**Any change to one layer likely requires changes to others.**

---

## Pre-Change Assessment

### 1. Impact Analysis

**Questions to Answer:**

- [ ] Does this change affect **historical runs**?
  - If yes: Can old runs be compared to new runs fairly?
  - If no: Are old runs still valid under new rules?

- [ ] Does this change affect **leaderboard ranking**?
  - If yes: Should old and new scores be in separate leaderboards?
  - If no: Are leaderboard ties still fair?

- [ ] Does this change affect **in-progress runs**?
  - If yes: Do we migrate state or invalidate runs?
  - If no: Is backward compatibility guaranteed?

- [ ] Does this change affect **content schema**?
  - If yes: Do we need to re-normalize all JSON units?
  - If no: Is existing content still valid?

**Risk Classification:**

| Change Type | Impact | Mitigation Required |
|-------------|--------|---------------------|
| **Change QUESTIONS_PER_DIFFICULTY** | 🔴 Critical | Separate leaderboards, migration script |
| **Change POINTS_PER_DIFFICULTY** | 🔴 Critical | Version scoring, separate leaderboards |
| **Change TIMER_SECONDS** | 🟠 High | Test timeout logic, update docs |
| **Change token rules** | 🟠 High | Version mechanics, document in changelog |
| **Add new question types** | 🟠 High | Schema migration, frontend update |
| **Change joker logic** | 🟡 Medium | Test fairness, document thoroughly |
| **Change time bonus formula** | 🟡 Medium | Version formula, update tests |
| **UI changes only** | 🟢 Low | Visual regression tests |

---

## Required Invariants (DO NOT BREAK)

These invariants must hold **before and after** any mechanics change:

### Database Integrity

- [ ] `quiz_runs.run_questions` is valid JSONB (parseable)
- [ ] Each run has exactly **10 questions** (unless changing QUESTIONS_PER_RUN)
- [ ] Each question has valid `question_id` (exists in `quiz_questions`)
- [ ] `quiz_run_answers.question_index` is 0-9 (unless changing run length)
- [ ] `quiz_scores.run_id` is unique (one leaderboard entry per run)

### Scoring Consistency

- [ ] Total score is **deterministic** (same inputs → same output)
- [ ] Total score is **monotonic** (more correct answers → higher score)
- [ ] Time bonus is **non-negative** (never penalizes fast answers)
- [ ] Token count is **0-15** (unless changing token rules)

### Timer Enforcement

- [ ] Server validates deadline (client timer is UI-only)
- [ ] Timeout answers count as **0 points** (never awarded)
- [ ] Timer starts only after question rendered (no premature expiry)

### Question Selection

- [ ] Each run has **2 questions per difficulty** (unless changing distribution)
- [ ] Questions are **randomized** (no predictable order)
- [ ] Weighted selection prefers **less-answered questions** (fairness)
- [ ] No question appears **twice in same run** (uniqueness)

---

## Database Schema Changes

### If Changing JSONB Fields

**Affected Fields:**
- `quiz_runs.run_questions` (most critical)
- `quiz_questions.answers`
- `quiz_questions.media`

**Required Steps:**

1. **Add Version Field**
   ```sql
   ALTER TABLE quiz_runs ADD COLUMN mechanics_version INTEGER DEFAULT 1;
   ```

2. **Write Migration Script**
   ```python
   # scripts/migrate_mechanics_v2.py
   def migrate_run_questions_v1_to_v2(old_data):
       # Transform JSONB structure
       return new_data
   ```

3. **Test Migration**
   - [ ] Run on staging with production snapshot
   - [ ] Verify 100% of runs migrated
   - [ ] Check random sample manually

4. **Backward Compatibility Layer**
   ```python
   def load_run_questions(run):
       if run.mechanics_version == 1:
           return load_v1(run.run_questions)
       else:
           return load_v2(run.run_questions)
   ```

5. **Deploy Sequence**
   - [ ] Deploy backward-compat code first
   - [ ] Run migration script
   - [ ] Remove backward-compat after full migration

### If Adding New Fields

**Example: Add `bonus_multiplier` to questions**

1. **Add Column**
   ```sql
   ALTER TABLE quiz_questions ADD COLUMN bonus_multiplier DECIMAL(3,2) DEFAULT 1.0;
   ```

2. **Update Content Schema**
   - Update `validation.py` to accept new field
   - Update `CONTENT.md` with field documentation

3. **Update Seeding/Import**
   - `seed.py` – Read new field from JSON
   - `import_service.py` – Validate and upsert

4. **Update Services**
   - `services.py` – Use new field in scoring

5. **Update Tests**
   - Add test cases with/without new field

---

## Service Layer Changes

### Files to Check/Update

| File | Lines | What to Check |
|------|-------|---------------|
| `game_modules/quiz/services.py` | 1366 | Core logic, constants |
| `game_modules/quiz/routes.py` | 1467 | API contracts |
| `game_modules/quiz/validation.py` | 712 | Schema validation |
| `game_modules/quiz/models.py` | 232 | ORM models |

### Critical Functions

#### `start_or_resume_run()` (Line 565)

**Depends on:**
- `QUESTIONS_PER_DIFFICULTY` (2)
- `QUESTIONS_PER_RUN` (10)
- `_select_questions_weighted()`

**Changes Required If:**
- Changing run length → Update question selection logic
- Changing difficulty distribution → Update selection algorithm

**Tests to Update:**
- `test_quiz_module.py::test_start_run`
- `test_quiz_gold.py::test_complete_run`

#### `_select_questions_weighted()` (Line 642)

**Depends on:**
- `QUESTIONS_PER_DIFFICULTY` (2)
- `HISTORY_RUNS_COUNT` (3)
- `MAX_HISTORY_QUESTIONS_PER_RUN` (2)

**Changes Required If:**
- Changing selection algorithm → Rewrite weighting logic
- Changing history tracking → Update query

**Tests to Update:**
- `test_quiz_module.py::test_question_selection_fairness`

#### `start_question()` (Line 795)

**Depends on:**
- `TIMER_SECONDS` (30)
- `MEDIA_BONUS_SECONDS` (10)

**Changes Required If:**
- Changing timer duration → Update time_limit_seconds calculation
- Adding new timer modes → Add conditional logic

**Tests to Update:**
- `test_quiz_gold.py::test_timer_enforcement`
- `test_quiz_module.py::test_timeout_behavior`

#### `submit_answer()` (Line 851)

**Depends on:**
- `POINTS_PER_DIFFICULTY` (dict)
- Time bonus formula
- Token calculation (in `_calculate_level_tokens()`)

**Changes Required If:**
- Changing scoring → Update formula, add versioning
- Changing time bonus → Update calculation, document

**Tests to Update:**
- `test_quiz_gold_scoring.py::test_scoring_correctness`
- `test_quiz_module.py::test_time_bonus`

#### `use_joker()` (Line 1029)

**Depends on:**
- `JOKERS_PER_RUN` (2)
- `run_questions.joker_disabled` array

**Changes Required If:**
- Changing joker count → Update validation
- Changing joker logic (e.g., 75:25) → Update elimination logic

**Tests to Update:**
- `test_quiz_module.py::test_joker_usage`
- `test_quiz_module.py::test_joker_edge_cases`

#### `finish_run()` (Line 1201)

**Depends on:**
- Token calculation
- Leaderboard insertion

**Changes Required If:**
- Changing final score calculation → Update formula
- Changing leaderboard rules → Update SQL query

**Tests to Update:**
- `test_quiz_gold.py::test_leaderboard_insertion`
- `test_quiz_module.py::test_finish_run_idempotency`

---

## API Contract Changes

### Affected Endpoints

| Endpoint | Method | Impact | Backward Compat Required |
|----------|--------|--------|--------------------------|
| `/api/quiz/<topic_id>/run/start` | POST | Response format (run state) | ⚠️ Yes (old clients) |
| `/api/quiz/run/<run_id>/question/start` | POST | Timer logic, response | ⚠️ Yes |
| `/api/quiz/run/<run_id>/answer` | POST | Scoring, response | ⚠️ Yes |
| `/api/quiz/run/<run_id>/joker` | POST | Joker logic, response | ⚠️ Yes |
| `/api/quiz/run/<run_id>/finish` | POST | Final score, response | ⚠️ Yes |

**Backward Compatibility Strategy:**

1. **Add Version Header**
   ```http
   X-Quiz-Mechanics-Version: 2
   ```

2. **Version Response**
   ```json
   {
     "mechanics_version": 2,
     "total_score": 245,
     ...
   }
   ```

3. **Deprecation Period**
   - Support old + new versions for 2 weeks
   - Log usage of old version
   - Remove after 100% client migration

---

## Frontend Changes

### Files to Check/Update

| File | Lines | What to Check |
|------|-------|---------------|
| `static/js/games/quiz-play.js` | ? | State machine, timer, scoring display |
| `static/css/games/quiz.css` | ? | Styles (if UI changes) |
| `templates/games/quiz/play.html` | ? | Template (if structure changes) |

### State Machine (quiz-play.js)

**States:**
1. **QUESTION** – Display question, start timer
2. **LEVEL_UP** – Show bonus, animate score
3. **FINISH** – Final score, leaderboard

**Changes Required If:**
- Changing timer display → Update countdown logic
- Changing score animation → Update Level-Up screen
- Adding new states → Extend state machine

**Tests to Update:**
- `test_quiz_animations_ui.py` (if exists)
- Manual QA: Play through full run

---

## Test Coverage

### Required Tests (Must Pass)

**Unit Tests:**
- [ ] Question selection algorithm (weighted)
- [ ] Scoring calculation (all difficulty levels)
- [ ] Time bonus formula (various timings)
- [ ] Token calculation (all combinations)
- [ ] Joker elimination (edge cases)
- [ ] Timer validation (timeout, premature submit)

**Integration Tests:**
- [ ] Full run lifecycle (start → answer 10 → finish)
- [ ] Leaderboard insertion (duplicate runs, ties)
- [ ] Resume run (in-progress state)
- [ ] Multiple players (concurrency)

**Contract Tests:**
- [ ] API request/response formats
- [ ] Error cases (invalid input, timeouts)
- [ ] Auth (player token, admin token)

**E2E Tests (Manual):**
- [ ] Play through 3 full runs (different topics)
- [ ] Test joker usage (both jokers)
- [ ] Test timeout behavior (let timer expire)
- [ ] Check leaderboard (correct ranking)

### New Tests Required

**If changing mechanics, add:**

1. **Regression Test (Golden Master)**
   ```python
   def test_scoring_v1_vs_v2_compatibility():
       # Same inputs → same or comparable outputs
       assert score_v1(run) == score_v2(run)
   ```

2. **Edge Case Tests**
   ```python
   def test_new_mechanic_edge_cases():
       # All correct with joker
       # All wrong without joker
       # Timeout on final question
       # etc.
   ```

3. **Performance Test**
   ```python
   def test_question_selection_performance():
       # Large question bank (1000+ questions)
       # Multiple runs (100+)
       # Assert: < 100ms selection time
   ```

---

## Migration Strategy

### Staging Environment

1. **Snapshot Production DB**
   ```bash
   pg_dump production_db > snapshot.sql
   psql staging_db < snapshot.sql
   ```

2. **Deploy New Code to Staging**
   - Include migration scripts
   - Include backward compat layer

3. **Run Migration**
   ```bash
   python scripts/migrate_mechanics_v2.py --dry-run
   python scripts/migrate_mechanics_v2.py --execute
   ```

4. **Validate Migration**
   ```sql
   SELECT COUNT(*) FROM quiz_runs WHERE mechanics_version IS NULL;
   -- Should be 0
   ```

5. **Test on Staging**
   - Play 10 full runs
   - Check leaderboard
   - Verify old runs still load

### Production Deployment

**Option A: Blue-Green Deployment**

1. Deploy new version to "green" environment
2. Migrate database (both versions can read)
3. Switch traffic to "green"
4. Monitor for 24 hours
5. Decommission "blue"

**Option B: Rolling Deployment**

1. Deploy backward-compat version (reads v1 + v2)
2. Run migration script (convert v1 → v2)
3. Deploy v2-only version
4. Remove backward-compat code

**Rollback Plan:**

- Keep previous version binary/container
- Revert database migration (if possible)
- Restore from backup (if migration irreversible)

---

## Documentation Updates

### Required Documentation

- [ ] **CHANGELOG.md** – User-facing changes
- [ ] **ARCHITECTURE.md** – Updated mechanics description
- [ ] **AUDIT_REPORT.md** – New risk register entry
- [ ] **API docs** – Updated endpoint specs (if contract changed)
- [ ] **Content guide** – New schema fields (if content changed)

### Changelog Template

```markdown
## [Version X.Y.Z] - 2026-MM-DD

### Changed
- **Scoring:** Changed time bonus formula from X to Y
- **Impact:** Old scores not directly comparable to new scores
- **Mitigation:** Separate leaderboards for pre/post-change runs

### Migration
- Database migration required: `scripts/migrate_mechanics_vX.py`
- Backward compatibility: Supported for 2 weeks (until 2026-MM-DD)
```

---

## Feature Flags (Optional)

**If deploying incrementally:**

```python
# config.py
QUIZ_MECHANICS_VERSION = os.environ.get("QUIZ_MECHANICS_VERSION", "1")

# services.py
if QUIZ_MECHANICS_VERSION == "2":
    score = calculate_score_v2(run)
else:
    score = calculate_score_v1(run)
```

**Advantages:**
- Gradual rollout (A/B testing)
- Easy rollback (flip flag)
- Monitor both versions in parallel

**Disadvantages:**
- Code complexity (two paths)
- Must maintain both versions temporarily

---

## Monitoring & Telemetry

### Metrics to Track

- [ ] **Run completion rate** (before/after change)
- [ ] **Average score** (distribution shift)
- [ ] **Token distribution** (fairness)
- [ ] **Timer expiry rate** (timeout frequency)
- [ ] **Joker usage rate** (player behavior)
- [ ] **API latency** (performance regression)

### Alerts

- [ ] **Error rate spike** (> 1% of requests)
- [ ] **Score anomaly** (> 300 points or < 0)
- [ ] **DB migration failure** (rollback triggered)

---

## Checklist Summary

### Before Implementation

- [ ] Impact analysis complete
- [ ] Risk classification assigned
- [ ] Invariants documented
- [ ] Migration strategy defined
- [ ] Test plan written
- [ ] Backward compat plan (if needed)

### During Implementation

- [ ] Code changes complete
- [ ] Unit tests pass (100% coverage)
- [ ] Integration tests pass
- [ ] Migration script tested (staging)
- [ ] Backward compat verified

### Before Deployment

- [ ] Staging validation complete (10+ runs)
- [ ] Documentation updated
- [ ] Changelog written
- [ ] Rollback plan tested
- [ ] Monitoring dashboards ready

### After Deployment

- [ ] Monitor metrics for 24 hours
- [ ] Check error logs (no regressions)
- [ ] Verify leaderboard integrity
- [ ] Collect user feedback (if visible change)
- [ ] Remove backward compat (after grace period)

---

## Emergency Rollback

**If something goes wrong:**

1. **Stop Traffic** (if critical)
   ```bash
   # Nginx: disable quiz routes
   sudo systemctl reload nginx
   ```

2. **Revert Code**
   ```bash
   git revert <commit>
   # OR
   docker pull <previous_version>
   ```

3. **Revert Database** (if migration ran)
   ```bash
   psql production_db < backup_pre_migration.sql
   ```

4. **Restore from Backup** (last resort)
   ```bash
   pg_restore -d production_db backup.dump
   ```

5. **Verify Rollback**
   - Play 1 test run
   - Check leaderboard loads
   - Monitor error rate

6. **Post-Mortem**
   - Document what went wrong
   - Update checklist with lessons learned

---

## Related Documentation

- [AUDIT_REPORT.md](AUDIT_REPORT.md) – Current architecture and risks
- [ARCHITECTURE.md](ARCHITECTURE.md) – System design
- [OPERATIONS.md](OPERATIONS.md) – Deployment workflows
- [GLOSSARY.md](GLOSSARY.md) – Term definitions
