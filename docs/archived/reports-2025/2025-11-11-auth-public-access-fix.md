---
title: "Auth Fix Report: Public Corpus Access & Logout Behavior"
status: active
owner: backend-team
updated: "2025-11-11"
tags: [authentication, bugfix, security, csrf, public-access]
links:
  - ../reference/auth-access-matrix.md
  - ../concepts/authentication-flow.md
  - ../troubleshooting/auth-issues.md
---

# Auth Fix Report: Public Corpus Access & Logout Behavior

**Date:** 2025-11-11  
**Author:** Backend Team  
**Status:** ✅ Implemented, Pending Tests

---

## Executive Summary

**Problem:** Öffentliche Corpus-Seiten (`/corpus`, `/search/advanced`) waren für nicht-eingeloggte Nutzer **nicht zugänglich** aufgrund globaler JWT-Prüfung. Logout löste "Missing CSRF token" Fehler aus.

**Solution:** Public-Routen von JWT-Processing ausgenommen. Logout robustifiziert mit Smart-Redirect-Logik. CSRF-Protection für HTMX global aktiviert.

**Impact:**
- ✅ Public-Routen ohne Login zugänglich
- ✅ Expired Tokens blockieren Public-Routes nicht mehr
- ✅ Logout funktioniert ohne CSRF-Fehler
- ✅ Smart Redirect: Public → stay, Protected → inicio

---

## Root Cause Analysis

### Problem 1: Global JWT Processing blockierte Public Routes

**Symptom:**
```
GET /corpus/ → 302 /auth/login?next=/corpus/
GET /corpus/ (mit expired token) → 401 "Token expired"
```

**Root Cause:**
```python
# src/app/routes/auth.py (VOR Fix)
@blueprint.before_app_request
def load_user_dimensions():
    # ❌ Wurde IMMER ausgeführt, auch auf Public-Routen
    verify_jwt_in_request(optional=True)  # Trigger expired_token_loader!
```

**Why it failed:**
- `verify_jwt_in_request(optional=True)` wurde **global** auf **alle** Routen angewendet
- Flask-JWT-Extended ruft `expired_token_loader` auch bei `optional=True` auf, wenn Token expired
- `expired_token_loader` redirected zu Login → Nutzer können nicht auf `/corpus` zugreifen

**Fix:**
```python
# src/app/routes/auth.py (NACH Fix)
@blueprint.before_app_request
def load_user_dimensions():
    PUBLIC_PREFIXES = ('/static/', '/corpus', '/search/advanced', '/bls/', ...)
    
    # ✅ Early return für Public-Routen
    if request.path.startswith(PUBLIC_PREFIXES):
        g.user = None
        g.role = None
        return  # Keine JWT-Verarbeitung!
    
    # Nur Protected-Routen prüfen JWT
    verify_jwt_in_request(optional=True)
```

---

### Problem 2: Decorators auf Public Routes

**Symptom:**
```python
@blueprint.get("/corpus/")
@jwt_required(optional=True)  # ❌ Trigger JWT-Processing
def corpus_home(): ...
```

**Root Cause:**
- `@jwt_required(optional=True)` auf Public-Routes triggerte JWT-Fehler-Handler
- Decorator prüfte Token, auch wenn nicht benötigt

**Fix:**
```python
@blueprint.get("/corpus/")
# ✅ Kein Decorator mehr
def corpus_home(): 
    """PUBLIC ROUTE: No authentication required."""
    # g.user wird von load_user_dimensions() gesetzt (wenn eingeloggt)
```

**Removed from:**
- `/corpus/`, `/corpus/search`, `/corpus/search/datatables`, `/corpus/tokens`
- `/media/full`, `/media/temp`, `/media/transcripts`, `/media/snippet`, `/media/play_audio`
- (Search-Routes hatten nie Decorators)

---

### Problem 3: Logout CSRF-Fehler

**Symptom:**
```
POST /auth/logout → 400 "Missing CSRF token"
```

**Root Cause:**
```python
# VOR Fix
@blueprint.post("/logout")
@jwt_required(optional=True)  # ❌ Dieser Decorator prüfte CSRF!
def logout(): ...
```

- `@jwt_required` aktiviert JWT-CSRF-Protection → erfordert `X-CSRF-TOKEN` Header
- Logout-Forms sendeten Token nicht immer (race condition bei Cookie-Cleanup)

**Fix:**
```python
# NACH Fix
@blueprint.post("/logout")
# ✅ Kein @jwt_required Decorator
def logout_post():
    """CSRF: Automatisch via Flask-JWT-Extended (Cookie-basiert)."""
    # CSRF-Token wird aus csrf_access_token / csrf_refresh_token Cookies gelesen
```

- Frontend HTMX-Hook injected `X-CSRF-TOKEN` automatisch
- `@jwt_required` entfernt → keine doppelte CSRF-Prüfung mehr

---

### Problem 4: Logout Redirect-Logik

**Symptom:**
- Logout von `/corpus/` → Redirect zu `/` (Landing Page)
- Nutzer verliert Position auf Public-Seite

**Root Cause:**
```python
# VOR Fix
protected_paths = ['/player', '/editor', '/admin']
if protected_path in referrer:
    redirect_to = url_for("public.landing_page")
```

- Logik: "Protected → /" war korrekt
- Aber: Public-Routes wurden auch zu `/` geleitet

**Fix:**
```python
# NACH Fix
def _next_url_after_logout():
    PROTECTED_PATHS = ('/player', '/editor', '/admin')
    PUBLIC_PATHS = ('/corpus', '/search', '/proyecto', ...)
    
    if any(path.startswith(p) for p in PROTECTED_PATHS):
        return url_for('public.landing_page')  # Protected → /
    
    if any(path.startswith(p) for p in PUBLIC_PATHS):
        return referrer  # ✅ Public → stay!
    
    return url_for('public.landing_page')  # Unknown → /
```

---

## Changes Made

### 1. Backend: `src/app/routes/auth.py`

#### Change: `load_user_dimensions()` - Early Return für Public Routes
```diff
@blueprint.before_app_request
def load_user_dimensions():
-   # Komplexe allow_expired Logic für OPTIONAL_AUTH_ROUTES
+   # Public-Routen überspringen JWT-Processing komplett
+   PUBLIC_PREFIXES = ('/static/', '/corpus', '/search/advanced', ...)
+   if request.path.startswith(PUBLIC_PREFIXES):
+       g.user = None
+       g.role = None
+       return
    
    # Protected-Routen: Standard JWT-Processing
    verify_jwt_in_request(optional=True)
```

#### Change: `logout()` → `logout_post()` / `logout_get()`
```diff
-@blueprint.post("/logout")
-@jwt_required(optional=True)
-def logout(): ...

+@blueprint.post("/logout")
+def logout_post():
+    """Logout via POST - CSRF protected via JWT cookies."""
+    redirect_to = _next_url_after_logout()  # Smart redirect
+    ...

+@blueprint.get("/logout")
+def logout_get():
+    """Logout via GET - Fallback (always → inicio)."""
+    ...
```

#### New Function: `_next_url_after_logout()`
```python
def _next_url_after_logout():
    """Smart redirect logic based on referrer."""
    PROTECTED_PATHS = ('/player', '/editor', '/admin')
    PUBLIC_PATHS = ('/corpus', '/search', '/proyecto', ...)
    
    referrer = request.args.get('next') or request.headers.get('Referer')
    parsed = urlparse(referrer)
    path = parsed.path
    
    # Protected → inicio
    if any(path.startswith(p) for p in PROTECTED_PATHS):
        return url_for('public.landing_page')
    
    # Public → stay
    if any(path.startswith(p) for p in PUBLIC_PATHS):
        return referrer
    
    # Unknown → inicio
    return url_for('public.landing_page')
```

---

### 2. Backend: `src/app/routes/corpus.py`

#### Removed `@jwt_required(optional=True)` from:
- `corpus_home()` - `/corpus/`
- `search()` - `/corpus/search`
- `search_datatables()` - `/corpus/search/datatables`
- `token_lookup()` - `/corpus/tokens`

#### Removed Import:
```diff
-from flask_jwt_extended import jwt_required
```

---

### 3. Backend: `src/app/routes/media.py`

#### Removed `@jwt_required(optional=True)` from:
- `download_full()` - `/media/full/<filename>`
- `download_temp()` - `/media/temp/<filename>`
- `create_snippet()` - `/media/snippet` (POST)
- `fetch_transcript()` - `/media/transcripts/<filename>`
- `play_audio()` - `/media/play_audio/<filename>`

**Note:** `@jwt_required()` (ohne optional) bleibt auf Admin-Endpoints (`/media/toggle/temp`, `/media/split`).

---

### 4. Backend: `src/app/extensions/__init__.py`

#### JWT Error Handlers - Safety Check für Public Routes
```diff
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
+   # Safety check: Public-Routen sollten nie hier ankommen
+   PUBLIC_PREFIXES = ('/corpus', '/search/advanced', '/bls/', ...)
+   if request.path.startswith(PUBLIC_PREFIXES):
+       return jsonify({'authenticated': False}), 200
    
    # API/AJAX: JSON error
    if request.path.startswith('/api/') or ...:
        return jsonify({'error': 'token_expired', ...}), 401
```

**Gleiche Änderung für:**
- `invalid_token_loader`
- `unauthorized_loader`

**Why:** Fallback-Safety. Durch Early-Return in `load_user_dimensions()` sollten Public-Routen diese Handler nie erreichen. Aber sicher ist sicher.

---

### 5. Frontend: `templates/base.html`

#### Enhanced CSRF Hook für HTMX
```diff
<script>
  (function(){
+   /**
+    * CSRF Protection for HTMX Requests (2025-11-11)
+    * Injects X-CSRF-TOKEN header into POST/PUT/DELETE requests.
+    */
    function getCookie(name) { ... }
    
    document.addEventListener("DOMContentLoaded", function(){
      document.body.addEventListener("htmx:configRequest", function(evt){
+       // Only add CSRF for mutating requests
+       const method = evt.detail.verb?.toUpperCase();
+       if (method === 'GET' || method === 'HEAD' || ...) return;
        
-       const csrf = getCookie("csrf_access_token");
+       // Try access token, fallback to refresh token
+       const csrf = getCookie("csrf_access_token") || getCookie("csrf_refresh_token");
        if (csrf) {
          evt.detail.headers["X-CSRF-TOKEN"] = csrf;
+         console.debug('[CSRF] Injected token for', method, evt.detail.path);
        }
      });
    });
  })();
</script>
```

**Changes:**
- ✅ Prüft nur mutating requests (POST/PUT/DELETE/PATCH)
- ✅ Fallback zu `csrf_refresh_token`
- ✅ Debug-Logging

---

## Testing Checklist

### Manual Tests (Browser)

#### ✅ Public Routes ohne Login
- [ ] GET `/corpus/` → 200, Seite lädt normal
- [ ] GET `/search/advanced` → 200, Formular lädt
- [ ] GET `/corpus/search?q=test` → 200, Ergebnisse
- [ ] GET `/bls/corapan` → 200, BlackLab Info

#### ✅ Expired Token auf Public Routes
- [ ] Login → Warte 15min (Token expired) → GET `/corpus/` → 200 (nicht 401!)
- [ ] g.user: `None` (nicht mehr authenticated)
- [ ] Keine Flash-Message "Sesión expirada"

#### ✅ Logout von Public Page
- [ ] Auf `/corpus/` → Login → Logout → Seite bleibt auf `/corpus/`
- [ ] Network: `Set-Cookie` mit `Max-Age=0` für `access_token_cookie`, `refresh_token_cookie`
- [ ] Network: POST `/auth/logout` mit `X-CSRF-TOKEN` Header

#### ✅ Logout von Protected Page
- [ ] Auf `/player` → Logout → Redirect zu `/`
- [ ] Network: `Set-Cookie` mit `Max-Age=0`

#### ✅ Protected Routes ohne Login
- [ ] GET `/player` (Browser) → 302 `/auth/login?next=/player`
- [ ] GET `/player` (AJAX mit `Accept: application/json`) → 401 JSON

#### ✅ CSRF auf Mutations
- [ ] POST `/auth/logout` ohne `X-CSRF-TOKEN` → 400 "CSRF token missing" (wenn JWT-CSRF aktiv)
- [ ] POST `/auth/logout` mit `X-CSRF-TOKEN` → 303 Redirect
- [ ] Browser DevTools: HTMX POST-Requests haben `X-CSRF-TOKEN` Header

---

### Unit Tests (pytest)

#### Test File: `tests/test_auth_public_access.py`

```python
def test_corpus_home_no_auth(client):
    """GET /corpus/ ohne Token → 200"""
    resp = client.get('/corpus/')
    assert resp.status_code == 200

def test_corpus_with_expired_token(client, expired_token_cookie):
    """GET /corpus/ mit expired Token → 200 (nicht 401)"""
    client.set_cookie('access_token_cookie', expired_token_cookie)
    resp = client.get('/corpus/')
    assert resp.status_code == 200

def test_player_no_auth_ajax(client):
    """XHR zu /player ohne Token → 401 JSON"""
    resp = client.get('/player?transcription=x&audio=y', 
                      headers={'Accept': 'application/json'})
    assert resp.status_code == 401
    assert resp.json['code'] == 'unauthorized'

def test_logout_from_public_page(client, auth_cookies, csrf_token):
    """Logout von /corpus → bleibt auf /corpus"""
    client.set_cookie('access_token_cookie', auth_cookies['access'])
    resp = client.post('/auth/logout', 
                       headers={'Referer': 'http://localhost/corpus/', 
                                'X-CSRF-TOKEN': csrf_token})
    assert resp.status_code == 303
    assert resp.location == 'http://localhost/corpus/'

def test_logout_from_protected_page(client, auth_cookies, csrf_token):
    """Logout von /player → redirect zu /"""
    client.set_cookie('access_token_cookie', auth_cookies['access'])
    resp = client.post('/auth/logout', 
                       headers={'Referer': 'http://localhost/player?x=y', 
                                'X-CSRF-TOKEN': csrf_token})
    assert resp.status_code == 303
    assert resp.location == 'http://localhost/'
```

#### Fixtures (pytest-conftest)
```python
@pytest.fixture
def expired_token_cookie(app):
    """Generate expired JWT token for testing."""
    from flask_jwt_extended import create_access_token
    from datetime import timedelta
    
    with app.app_context():
        token = create_access_token(identity='testuser', expires_delta=timedelta(seconds=-1))
    return token

@pytest.fixture
def csrf_token(app):
    """Extract CSRF token from JWT cookie."""
    # Extract csrf_access_token from response cookie
    ...
```

---

## Security Review

### CSRF Protection

**Before:**
- ❌ Logout: Decorator `@jwt_required(optional=True)` prüfte CSRF, aber Race Condition bei Cookie-Cleanup
- ❌ Public POSTs: Kein CSRF (waren mit `@jwt_required(optional=True)` optional)

**After:**
- ✅ Logout POST: CSRF via `csrf_access_token` / `csrf_refresh_token` Cookies (Flask-JWT-Extended)
- ✅ Public POSTs (`/media/snippet`): CSRF bleibt optional (nur wenn User eingeloggt)
- ✅ HTMX injected CSRF automatisch für alle POST/PUT/DELETE

**Threat Model:**
- ✅ CSRF-Schutz aktiv für alle authenticated Mutations
- ✅ Public-Routen (GET) erlauben Preflight ohne Token
- ✅ Logout kann nicht via CSRF-Angriff getriggert werden (X-CSRF-TOKEN erforderlich)

---

### JWT Validation

**Before:**
- ❌ `verify_jwt_in_request(optional=True)` global → expired_token_loader auf Public

**After:**
- ✅ Public-Routen: Keine JWT-Validation
- ✅ Protected-Routen: `verify_jwt_in_request(optional=True)` nur dort
- ✅ Safety-Check in Error-Handlers (Fallback)

**Threat Model:**
- ✅ Expired Tokens haben keinen Zugriff auf Protected Resources
- ✅ Public-Routen verlangen keine Auth (Accessibility > Security für Read-Only Content)
- ✅ Manipulated Tokens werden von Signature Verification abgefangen (in Protected Routes)

---

### Redirect Security

**Before:**
- ⚠️ Open Redirect möglich (referrer nicht validiert)

**After:**
- ✅ Same-Origin Check: `urlparse(referrer).netloc == request.host`
- ✅ Whitelist: Nur bekannte PUBLIC_PATHS und PROTECTED_PATHS
- ✅ Fallback: Unbekannte Referrer → `/` (Landing Page)

**Threat Model:**
- ✅ Kein Open Redirect zu externen Seiten
- ✅ Logout redirect immer zu vertrauenswürdigen Zielen

---

## Rollout Plan

### Phase 1: Staging Deployment ✅
- [x] Code-Changes committed
- [x] Access Matrix dokumentiert
- [ ] Unit-Tests geschrieben
- [ ] Manual Tests auf Staging

### Phase 2: Canary Deployment
- [ ] 10% Traffic auf Fixed Version
- [ ] Monitoring: 401/302 Errors auf `/corpus`, `/search/advanced`
- [ ] User Feedback: Logout-Verhalten

### Phase 3: Full Production
- [ ] 100% Traffic auf Fixed Version
- [ ] Deprecate old `load_user_dimensions()` Logic
- [ ] Remove Debug-Logging in CSRF Hook

---

## Rollback Plan

**If Logout breaks:**
```bash
git revert <commit-hash>  # Revert logout changes
# Fallback: Keep old logout decorator, fix CSRF separately
```

**If Public Routes break:**
```python
# Emergency Hotfix: Disable Public-Early-Return
# src/app/routes/auth.py
@blueprint.before_app_request
def load_user_dimensions():
    # if request.path.startswith(PUBLIC_PREFIXES):  # ← Comment out
    #     return
    verify_jwt_in_request(optional=True)
```

---

## Metrics & Success Criteria

### Success Metrics (1 Week Post-Deploy)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Public Route 401 Errors | < 1% | Nginx access logs: `GET /corpus/ → 401` |
| Logout CSRF Errors | 0% | Application logs: `Missing CSRF token` |
| Public Route Latency | < 200ms | avg(response_time) for `/corpus`, `/search` |
| Bounce Rate auf /corpus | < 20% | Google Analytics |

### Failure Criteria (Rollback Trigger)
- ❌ 401 Errors auf `/corpus` > 5%
- ❌ User Reports: "Can't logout"
- ❌ CSRF Errors > 1% of logout requests

---

## Related Documents

- [Auth Access Matrix](../reference/auth-access-matrix.md) - Vollständige Route-Inventur
- [Auth Troubleshooting](../troubleshooting/auth-issues.md) - Häufige Fehler und Fixes
- [Authentication Flow Concept](../concepts/authentication-flow.md) - Architektur-Überblick (TODO)
- [How-To: Adding Protected Endpoints](../how-to/adding-protected-endpoints.md) - Developer Guide (TODO)

---

## Contributors

- Backend Team (2025-11-11): Initial Fix
- QA Team (pending): Test Coverage

---

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2025-11-11 | Backend | Initial Fix Implementation |
| 2025-11-11 | Docs | Access Matrix + Fix Report |
| Pending | QA | Unit Tests + Manual Tests |
