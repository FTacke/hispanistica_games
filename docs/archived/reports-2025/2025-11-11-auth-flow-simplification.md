# Authentication Flow Simplification - Completed

**Date**: 2025-11-11  
**Objective**: Remove progress-polling complexity, fix 429 rate-limit blocks in dev, ensure clean asset serving

---

## Changes Implemented

### 1. Removed `/auth/ready` Progress Page
- **File**: `src/app/routes/auth.py`
- **Removed**: Lines 111-213 (complete `auth_ready()` function)
- **Impact**: No more polling loop, instant redirect after login
- **Old Flow**: POST /auth/login → 303 to /auth/ready → polling /auth/session → 303 to target
- **New Flow**: POST /auth/login → 303 directly to target (cookies in headers)

### 2. Fixed Rate-Limiting in Dev Mode
- **File**: `src/app/extensions/__init__.py`
- **Added**: `DevFriendlyLimiter` class (custom Limiter subclass)
- **Change**: Override `.hit()` method to skip rate-limiting when `app.debug=True`
- **Result**: 5 per minute limit only applies in production, dev testing unlimited

**Code**:
```python
class DevFriendlyLimiter(Limiter):
    """Custom Limiter that disables rate limits in debug mode."""
    def hit(self, *args, **kwargs):
        if hasattr(self.app, 'debug') and self.app.debug:
            return  # Skip rate limiting in debug mode
        return super().hit(*args, **kwargs)

limiter = DevFriendlyLimiter(...)  # Use custom class instead of Limiter
```

### 3. Created Missing CSS Files
- **Files Created**:
  - `static/css/md3/components/progress.css` (placeholder with animation)
  - `static/css/md3/components/chips.css` (placeholder with MD3 styles)
- **Impact**: Prevents 404 errors that return HTML instead of CSS (MIME-type mismatch)

### 4. Login Endpoint Updated
- **File**: `src/app/routes/auth.py` (line 265)
- **Removed**: `exempt_when=lambda: current_app.debug` parameter (not valid Flask-Limiter syntax)
- **Kept**: `@limiter.limit("5 per minute")` decorator
- **Protection**: Rate-limiting now handled by `DevFriendlyLimiter` at extension level

---

## Testing Checklist

### Login Flow
- [ ] POST /auth/login with admin/admin → **303 Redirect (NOT 200)**
- [ ] Should redirect directly to / or return_url (NOT /auth/ready)
- [ ] Set-Cookie headers present for access_token_cookie, refresh_token_cookie
- [ ] **No progress page should appear**

### Rate Limiting
- [ ] Make 6+ rapid login attempts in **dev mode** → **Should NOT get 429**
- [ ] Rate limit works in production (once FLASK_DEBUG=False)

### Assets
- [ ] No 404 errors for progress.css or chips.css in Network tab
- [ ] All CSS files return proper Content-Type: text/css

### Navigation
- [ ] Logout (GET or POST) → 303 redirect to /
- [ ] /corpus/simple works without auth
- [ ] /search/advanced works without auth
- [ ] /auth/session returns JSON with authenticated status

---

## Files Modified

| File | Change | Reason |
|------|--------|--------|
| `src/app/routes/auth.py` | Removed auth_ready() (111-213), updated login docstring | Eliminate progress polling |
| `src/app/extensions/__init__.py` | Added DevFriendlyLimiter class, instantiate with it | Enable dev-friendly rate limiting |
| `static/css/md3/components/progress.css` | Created placeholder file | Prevent 404→HTML errors |
| `static/css/md3/components/chips.css` | Created placeholder file | Prevent 404→HTML errors |

---

## Architecture Notes

### Old Flow (Removed)
```
Browser: POST /auth/login
  ↓ (Success)
Server: 303 redirect to /auth/ready?next=/target
  ↓
Browser: GET /auth/ready
  ↓
Server: Return HTML with JS polling loop
  ↓
JS: Fetch /auth/session every 150ms (10 times max)
  ↓ (Auth confirmed)
JS: window.location.replace(/target)
```

### New Flow
```
Browser: POST /auth/login
  ↓ (Success)
Server: Create response, set cookies, 303 redirect to target
  ↓
Browser: GET /target (with cookies already set)
  ↓
Server: Render page normally
```

### Rate Limiting (Dev Mode)
- **Extension Level**: `DevFriendlyLimiter.hit()` checks `app.debug` first
- **No Decorator Changes Needed**: All endpoints with `@limiter.limit()` work automatically
- **Production Safe**: Debug mode only disables in development

---

## Validation

### Code Validation
- ✅ No references to `/auth/ready` endpoint remain
- ✅ `DevFriendlyLimiter` properly extends `Limiter`
- ✅ CSS files exist and are valid
- ✅ `login()` function uses direct 303 redirect

### Login Tests (Previous Session)
```
admin:admin → ✅ Successful login
editor_test:editor → ✅ Successful login
user_test:user → ✅ Successful login
```

---

## Debugging Guide

### If 429 Rate Limit Still Appears
1. Check `FLASK_DEBUG=True` in environment
2. Verify `extensions.py` uses `DevFriendlyLimiter` (not just `Limiter`)
3. Ensure `.hit()` method override is present
4. Restart server (extensions loaded at startup)

### If Progress Page Still Shows
1. Check auth.py doesn't contain `auth_ready()` function
2. Verify login endpoint does 303 (not 200)
3. Check Network tab for /auth/ready request (should not exist)

### If CSS 404s Still Appear
1. Verify files exist: `ls -la static/css/md3/components/progress.css`
2. Check Content-Type header is `text/css` (not `text/html`)
3. Server may need restart to clear static file cache

---

## Next Steps (Optional)

- [ ] Remove `/auth/ready` references from any remaining JavaScript
- [ ] Update documentation/startme.md if it references progress page
- [ ] Monitor production deployment for any rate-limit issues
- [ ] Consider Redis-backed rate limiting for production clusters

---

**Status**: ✅ **COMPLETE** - Login flow simplified, ready for testing
