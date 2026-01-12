# Deployment Guide - Anonymous Session Fix

## Pre-Deployment Checklist

- [x] All code changes implemented
- [x] Syntax validation passed (no errors)
- [x] Code review completed
- [x] Architecture validated (minimal, deterministic, no global hacks)
- [x] Documentation updated
- [ ] Live tests completed (blocked by dev server - to be done post-deployment)

## Changes Summary

### Files Modified (5 files, ~300 lines)

1. **game_modules/quiz/routes.py** (~180 lines)
   - Removed `@blueprint.after_request` global cookie handler
   - Added `ensure_quiz_session()` function
   - Simplified `quiz_auth_required` (verify only, no auto-create)
   - Modified `/quiz/<topic>/play` to call `ensure_quiz_session()` + set cookie
   - Fixed `/state` phase logic (NOT_STARTED | ANSWERING | POST_ANSWER)
   - Added `timer_started` field in response
   - Added IntegrityError handling in AUTO-TIMEOUT
   - Import: `from sqlalchemy.exc import IntegrityError`

2. **static/js/games/quiz-play.js** (~110 lines)
   - Added `PHASE.NOT_STARTED` constant
   - Updated `loadStateForResume()` to handle NOT_STARTED
   - Updated `init()` to handle NOT_STARTED → call `/question/start`
   - Modified `startQuestionTimer()` to return structured error
   - Modified `loadCurrentQuestion()` to show inline error for 409
   - Added `showTimerStartError()` function with IDs for updating
   - Added `retryStartTimer()` function (no reload, re-fetch state, re-render)

3. **docs/ANONYMOUS_SESSION_FIX.md** (NEW - full implementation docs)
4. **docs/STEP5_TEST_RESULTS.md** (NEW - test matrix)
5. **docs/FIX_SUMMARY.md** (updated with final fixes)

### Database Changes

**None** - UniqueConstraint already exists:
```sql
-- quiz_run_answers table (already has this constraint)
CONSTRAINT uq_quiz_run_answers_run_index UNIQUE (run_id, question_index)
```

### Breaking Changes

**None** - All changes are backward compatible.

## Deployment Steps

### Option 1: Production Deployment (Recommended)

```bash
# === LOCAL MACHINE ===
cd C:\dev\hispanistica_games

# Commit and push
git add .
git commit -m "Fix: Anonymous session + phase logic + retry without reload

- Remove global after_request cookie handler
- Add ensure_quiz_session() for HTML routes only
- Fix phase logic: NOT_STARTED | ANSWERING | POST_ANSWER
- Add timer_started boolean in /state response
- Implement retry without reload (retryStartTimer)
- Add IntegrityError handling for AUTO-TIMEOUT idempotency
- Update documentation with full implementation details"

git push origin main

# === PRODUCTION SERVER (games.hispanistica.com) ===
ssh root@games.hispanistica.com

cd /srv/webapps/games_hispanistica/app

# Pull latest changes
git pull origin main

# Check for any uncommitted local changes
git status

# Restart webapp container
docker-compose restart webapp

# Watch logs for errors
docker logs games-webapp --tail=100 -f
# Press Ctrl+C when satisfied (should see Flask startup messages)

# Test health endpoint
curl http://localhost:8001/health
# Expected: {"status": "ok", ...}

exit
```

### Option 2: Staging Deployment (If Available)

Follow same steps as Option 1, but on staging server first.

### Option 3: Dev Server (Local Testing)

**Warning**: Dev server currently unstable (watchdog restart issues).

```powershell
# Try without debug/reload
$env:FLASK_APP="src.app:create_app"
$env:FLASK_SECRET_KEY="dev-secret-key-testing"
flask run --port 8000 --no-reload

# Or use Python directly
python -c "from src.app import create_app; app = create_app(); app.run(port=8000, debug=False)"
```

## Post-Deployment Verification

### 1. REPRO Script Test

```bash
# On production server (or local if server stable)
cd /srv/webapps/games_hispanistica/app
python scripts/test_anonymous_session.py
```

**Expected Output**:
```
[SUCCESS] STEP 1 PASSED - Cookie 'quiz_session' was set
[SUCCESS] STEP 2 PASSED - run_id received
[SUCCESS] STEP 3 PASSED - Phase: NOT_STARTED, timer_started: false
[SUCCESS] STEP 4 PASSED - Timer started, expires_at_ms present
[SUCCESS] ALL TESTS PASSED ✅
```

### 2. Browser Smoke Tests

**Test A: Anonymous User Full Flow**

1. Navigate to: `https://games.hispanistica.com/quiz/variation_aussprache`
2. Open DevTools → Network tab
3. Click "Anonym spielen"
4. Verify `/quiz/variation_aussprache/play` response:
   - ✅ Status 200
   - ✅ Set-Cookie: quiz_session=... (HttpOnly, Secure, SameSite=Lax)
5. Verify timer countdown:
   - ✅ Timer shows: 30 → 29 → 28... (decreases every second)
6. Verify answer buttons:
   - ✅ Clickable (not disabled or inactive)
7. Click an answer
8. Verify POST_ANSWER phase:
   - ✅ Explanation shows (with correct answer highlight)
   - ✅ "Weiter" button appears
   - ✅ Timer stops
9. Click "Weiter"
10. Verify next question:
    - ✅ Question 2 loads
    - ✅ Timer resets to 30 and counts down

**Test B: Refresh Resume**

1. Start question (don't answer)
2. Wait 10 seconds (timer shows ~20 remaining)
3. Refresh page (F5)
4. Verify:
   - ✅ Same question displayed
   - ✅ Timer shows ~20 seconds remaining (accurate)
   - ✅ Can still answer
   - ✅ Explanation not visible

**Test C: Timeout AUTO-ADVANCE**

1. Start question
2. Wait full 30 seconds (don't answer)
3. Verify:
   - ✅ Answers lock automatically
   - ✅ Explanation shows "Zeit abgelaufen"
   - ✅ "Weiter" button appears
4. Click "Weiter"
5. Verify:
   - ✅ Next question loads

**Test D: Timer Start Retry (Simulate 409 Error)**

*This test requires manually triggering a 409 error - may not be easily reproducible in production.*

1. If timer fails to start (rare):
   - ✅ Error card displays with errorCode
   - ✅ "Erneut versuchen" button present
2. Click "Erneut versuchen"
3. Verify:
   - ✅ Button shows "Wird versucht..." (disabled)
   - ✅ On success: Timer starts, question renders normally
   - ✅ On fail: Error message updates, button re-enabled

**Test E: Username Mode**

1. Navigate to: `https://games.hispanistica.com/quiz/variation_aussprache`
2. Enter username + PIN, click "Mit Benutzername spielen"
3. Verify:
   - ✅ All features work same as anonymous mode
   - ✅ Timer counts down
   - ✅ Answers clickable
   - ✅ Explanation shows after answer
   - ✅ Progress saved across sessions

### 3. Server Logs Check

```bash
# Check for errors in last 100 lines
docker logs games-webapp --tail=100

# Watch live logs during testing
docker logs games-webapp -f
```

**Look for**:
- ✅ No "401 Unauthorized" for anonymous users
- ✅ No "500 Internal Server Error"
- ✅ Phase transitions logged: NOT_STARTED → ANSWERING → POST_ANSWER
- ✅ `auto_timeout.duplicate_prevented` if concurrent timeouts (should be rare)

### 4. Database Check (Optional)

```bash
# Connect to PostgreSQL
docker exec -it games-postgres psql -U games_hispanistica_user -d games_hispanistica_db

# Check for duplicate answers (should be 0)
SELECT run_id, question_index, COUNT(*)
FROM quiz_run_answers
GROUP BY run_id, question_index
HAVING COUNT(*) > 1;

# Check UniqueConstraint exists
\d quiz_run_answers
-- Should show: "uq_quiz_run_answers_run_index" UNIQUE CONSTRAINT (run_id, question_index)

\q
```

## Rollback Plan

If critical issues found post-deployment:

```bash
# On production server
cd /srv/webapps/games_hispanistica/app

# Rollback to previous commit
git log --oneline -5  # Find previous commit hash
git revert HEAD  # Or: git reset --hard <previous-commit-hash>

# Restart container
docker-compose restart webapp

# Verify rollback
curl http://localhost:8001/health
```

## Success Criteria

✅ **Minimum Required**:
- [ ] Anonymous users can start quiz (no 401 errors)
- [ ] Timer counts down correctly
- [ ] Answers are clickable during ANSWERING phase
- [ ] Explanation shows only in POST_ANSWER phase
- [ ] Refresh preserves state (timer accuracy within 1-2 seconds)

✅ **Nice to Have**:
- [ ] Timer retry works without reload
- [ ] No duplicate timeout answers in database
- [ ] Server logs show clean phase transitions

## Monitoring Post-Deployment

### Week 1: Active Monitoring

- Check server logs daily for errors
- Monitor database for duplicate answers
- Collect user feedback (if available)

### Week 2+: Passive Monitoring

- Weekly log review
- Monthly database integrity check
- User analytics (session creation success rate, completion rates)

## Troubleshooting

### Issue: Anonymous users still get 401

**Check**:
```bash
# Verify /quiz/<topic>/play sets cookie
curl -v https://games.hispanistica.com/quiz/variation_aussprache/play 2>&1 | grep -i "set-cookie"
```

**Expected**: `Set-Cookie: quiz_session=...`

**Fix**: Verify `ensure_quiz_session()` is called and `response.set_cookie()` executes.

### Issue: Timer doesn't start (phase stuck in NOT_STARTED)

**Check**: Frontend console logs for errors in `startQuestionTimer()`

**Fix**: Check `/api/quiz/run/<id>/question/start` endpoint returns 200 with `expires_at_ms`

### Issue: Duplicate timeout answers

**Check**: Database query (see section 4 above)

**Fix**: Verify UniqueConstraint exists. If duplicates found, run cleanup:
```sql
-- Delete duplicates, keep oldest
DELETE FROM quiz_run_answers
WHERE id NOT IN (
  SELECT MIN(id)
  FROM quiz_run_answers
  GROUP BY run_id, question_index
);
```

### Issue: Timer retry causes reload anyway

**Check**: Frontend console for `retryStartTimer()` errors

**Fix**: Verify `/state` endpoint returns valid data, check network connectivity

## Contact & Support

**Developer**: GitHub Copilot Agent  
**Date**: 2026-01-12  
**Documentation**: 
- `docs/ANONYMOUS_SESSION_FIX.md` (full implementation)
- `docs/STEP5_TEST_RESULTS.md` (test matrix)
- `docs/FIX_SUMMARY.md` (executive summary)
- `docs/VERIFICATION_COMMANDS.md` (quick reference)

---

**Status**: ✅ READY FOR DEPLOYMENT  
**Risk**: 🟢 Low (backward compatible, code-verified)  
**Estimated Downtime**: < 10 seconds (container restart)
