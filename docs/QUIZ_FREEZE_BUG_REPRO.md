# Quiz UI Freeze Bug - Root Cause Analysis

**Date:** 2026-01-12  
**Status:** 🔴 CONFIRMED - Auth blocks anonymous users

---

## Symptoms

1. **UI Freeze:** Question 1 loads, but UI is completely frozen
   - Countdown does NOT run
   - Answer buttons NOT clickable
   - Explanation card shows immediately with "Drücke Weiter..."

2. **Browser Console:**
   ```
   [Auth] Not authenticated
   ```

3. **Network Tab (Expected Behavior):**
   - GET `/api/quiz/run/<run_id>/state` → **401 Unauthorized**
   - POST `/api/quiz/run/<run_id>/question/start` → **401 Unauthorized**

---

## Root Cause

### Auth Decorator Blocks Anonymous Access

**File:** `game_modules/quiz/routes.py`

**Problem:** All critical Quiz Play API endpoints require authentication via `@quiz_auth_required` decorator:

```python
def quiz_auth_required(f: Callable) -> Callable:
    """Decorator to require quiz player authentication."""
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        token = request.cookies.get(QUIZ_SESSION_COOKIE)
        if not token:
            return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401
        # ...
```

**Affected Endpoints:**
- ❌ `POST /api/quiz/<topic_id>/run/start` (Line 428-429)
- ❌ `POST /api/quiz/run/<run_id>/question/start` (Line 545-546)
- ❌ `GET /api/quiz/run/<run_id>/state` (Line 754-755)
- ❌ `POST /api/quiz/run/<run_id>/answer` (Line 595-596)
- ❌ `POST /api/quiz/run/<run_id>/joker` (Line 914-915)
- ❌ `POST /api/quiz/run/<run_id>/finish` (Line 964-965)

### Chain of Failures

1. **User opens Quiz page** (e.g., `/quiz/variation_aussprache`)
   - Page renders HTML template ✓
   - JavaScript `quiz-play.js` loads ✓

2. **Frontend tries to start Run:**
   - `POST /api/quiz/{topic}/run/start` → **401 Unauthorized**
   - No `run_id`, no state loaded
   - Frontend falls back to default state

3. **Frontend tries to load State:**
   - `GET /api/quiz/run/<id>/state` → **401 Unauthorized** (no run_id anyway)
   - `expires_at_ms` is NULL
   - `phase` defaults to wrong value

4. **Frontend tries to start Timer:**
   - `POST /api/quiz/run/<id>/question/start` → **401 Unauthorized**
   - Timer never starts
   - Countdown stuck at 30 (or 0)

5. **UI Renders:**
   - No timer → Countdown frozen
   - Answers default to locked state (defensive programming)
   - Explanation shows immediately (fallback UI)

---

## Why This Wasn't Caught

### Previous Deployment Worked

The **production server** likely has:
1. Anonymous Player auto-creation (handled server-side on first page load)
2. OR: Users always had a session from previous login

### Dev Environment Missing Setup

Local dev setup does NOT automatically create anonymous sessions for:
- Guest users
- First-time visitors
- Incognito/private browsing

---

## Expected Behavior

### Anonymous/Guest Flow SHOULD Work:

1. User opens Quiz page → Anonymous player created automatically
2. Session cookie `quiz_session` set (anonymous=true)
3. All API calls succeed with anonymous session
4. Quiz plays normally

### Current Behavior (BROKEN):

1. User opens Quiz page → No session
2. API calls → 401 Unauthorized
3. UI freezes (no timer, no interaction)

---

## Fix Strategy

### Option 1: Auto-Create Anonymous Session on Page Load ✅ RECOMMENDED

**Approach:** Quiz entry page (`/quiz/<topic_id>`) creates anonymous session if none exists

**Pros:**
- Minimal changes
- No security risk (anonymous session is read-only to own data)
- Works for all users (guest + logged-in)

**Cons:**
- None

### Option 2: Make API Endpoints Auth-Optional ❌ NOT RECOMMENDED

**Approach:** Change `@quiz_auth_required` → `@quiz_auth_optional`, create player on-demand

**Pros:**
- More "stateless"

**Cons:**
- Complex: need player_id tracking without session
- Security risk: harder to prevent abuse (multiple runs per IP, etc.)
- Race conditions (concurrent run creation)

---

## Implementation Plan

See: `QUIZ_FREEZE_BUG_FIX.md` (next step)
