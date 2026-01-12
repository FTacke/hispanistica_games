# Quick Verification Commands

## Prerequisites

```powershell
# Ensure you're in the project root
cd C:\dev\hispanistica_games

# Activate virtual environment
.\.venv\Scripts\Activate.ps1
```

## Start Dev Server

```powershell
$env:FLASK_APP="src.app:create_app"
$env:FLASK_ENV="development"
$env:FLASK_SECRET_KEY="dev-secret-key-testing"
flask run --port 8000 --debug
```

## Run REPRO Script (in new terminal)

```powershell
cd C:\dev\hispanistica_games
.\.venv\Scripts\Activate.ps1
python scripts/test_anonymous_session.py
```

**Expected Output**:
```
[SUCCESS] STEP 1 PASSED - Status 200
[SUCCESS] ✅ Cookie 'quiz_session' was set
[SUCCESS] STEP 2 PASSED - Status 200
[SUCCESS] ✅ run_id: <uuid>
[SUCCESS] STEP 3 PASSED - Status 200
[SUCCESS] phase: NOT_STARTED
[SUCCESS] timer_started: false
[SUCCESS] STEP 4 PASSED - Status 200
[SUCCESS] ✅ Timer started successfully
[SUCCESS] ALL TESTS PASSED ✅
```

## Manual Browser Tests

### Test 1: Anonymous User Flow
1. Open browser: `http://localhost:8000/quiz/variation_aussprache`
2. Click "Anonym spielen"
3. ✅ Timer should countdown: 30 → 29 → 28...
4. ✅ Answer buttons clickable (no disabled state)
5. Click an answer
6. ✅ Explanation shows ONLY after answer
7. Click "Weiter"
8. ✅ Next question loads

### Test 2: Refresh Resume
1. Start question
2. Wait 10 seconds
3. Refresh page (F5)
4. ✅ Timer shows ~20 seconds remaining
5. ✅ Can still answer
6. ✅ Explanation hidden

### Test 3: Timeout
1. Start question
2. Wait full 30 seconds (don't answer)
3. ✅ Answers lock automatically
4. ✅ Explanation shows
5. Click "Weiter"
6. ✅ Next question loads

## Check for Errors

```powershell
# After manual tests, check server logs for errors
# Should see NO "401 Unauthorized" for anonymous users
# Should see phase transitions: NOT_STARTED → ANSWERING → POST_ANSWER
```

## PASS/FAIL Checklist

- [ ] REPRO script passes all 4 steps
- [ ] Anonymous user can start quiz
- [ ] Timer counts down correctly
- [ ] Answers are clickable during ANSWERING
- [ ] Explanation shows ONLY in POST_ANSWER
- [ ] Refresh resumes with correct timer
- [ ] Timeout triggers AUTO-ADVANCE
- [ ] No 401 errors in server logs for anonymous users

## Files Modified

```
✅ game_modules/quiz/routes.py (Backend auth + phase logic)
✅ static/js/games/quiz-play.js (Frontend phase handling)
✅ scripts/test_anonymous_session.py (REPRO script)
✅ docs/ANONYMOUS_SESSION_FIX.md (Full documentation)
```
