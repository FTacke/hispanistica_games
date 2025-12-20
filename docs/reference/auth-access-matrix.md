---
title: "Authentication Access Matrix"
status: active
owner: backend-team
updated: "2025-11-11"
tags: [authentication, authorization, security, routes, csrf]
links:
  - ../concepts/authentication-flow.md
  - ../how-to/adding-protected-endpoints.md
  - ../troubleshooting/auth-issues.md
---

# Authentication Access Matrix

Vollständige Inventur aller Flask-Routen mit Auth-Policy, CSRF-Anforderungen und Methoden-Support.

---

## Legende

**Access Policy:**
- `PUBLIC` - Ohne Login zugänglich
- `PROTECTED` - Login erforderlich (JWT)
- `ADMIN` - Login + Admin-Rolle erforderlich

**CSRF Required:**
- `YES` - X-CSRF-TOKEN Header benötigt
- `NO` - Kein CSRF-Token erforderlich
- `N/A` - Gilt nur für GET-Requests (CSRF nicht anwendbar)

**Decorator:**
- `none` - Keine Auth-Decorators
- `@jwt_required(optional=True)` - Optional Auth (g.user gesetzt wenn Token vorhanden)
- `@jwt_required()` - Mandatory Auth
- `@require_role(Role.ADMIN)` - Admin-Only (impliziert @jwt_required)

---

## Routes Tabelle

### Public Routes (Blueprint: `public`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/` | GET | PUBLIC | N/A | none | Landing Page |
| `/health` | GET | PUBLIC | N/A | none | Health Check (Docker/K8s) |
| `/proyecto` | GET | PUBLIC | N/A | none | Proyecto Redirect |
| `/proyecto/overview` | GET | PUBLIC | N/A | none | Projekt-Übersicht |
| `/proyecto/diseno` | GET | PUBLIC | N/A | none | Design-Info |
| `/proyecto/estadisticas` | GET | PUBLIC | N/A | none | Statistiken |
| `/proyecto/quienes-somos` | GET | PUBLIC | N/A | none | Team-Info |
| `/proyecto/como-citar` | GET | PUBLIC | N/A | none | Zitationsinfo |
| `/atlas` | GET | PUBLIC (optional-auth) | N/A | `@jwt_required(optional=True)` | Atlas-Startseite |
| `/impressum` | GET | PUBLIC | N/A | none | Impressum |
| `/privacy` | GET | PUBLIC | N/A | none | Datenschutz |
| `/get_stats_all_from_db` | GET | PUBLIC | N/A | none | Statistik-JSON |
| `/get_stats_files_from_db` | GET | PROTECTED | N/A | @jwt_required() | File-Statistik (Legacy) |

---

### Corpus Routes (Blueprint: `corpus`, Prefix: `/corpus`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/corpus/` | GET | PUBLIC (optional-auth) | N/A | `@jwt_required(optional=True)` | Corpus-Startseite (DataTables) |
| `/corpus/search` | GET, POST | PUBLIC | NO (GET), YES (POST) | **~~@jwt_required(optional=True)~~** → **none** | Corpus-Suche |
| `/corpus/search/datatables` | GET | PUBLIC | N/A | none | DataTables Server-Side Endpoint |
| `/corpus/tokens` | GET | PUBLIC | N/A | none | Token-Detail-JSON |

**Änderung:** `@jwt_required(optional=True)` wird entfernt. Public Access ohne Auth-Hook.

---

### Advanced Search Routes (Blueprint: `advanced_search`, Prefix: `/search/advanced`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/search/advanced` | GET | PUBLIC (optional-auth) | N/A | `@jwt_required(optional=True)` | Advanced Search Form |
| `/search/advanced/results` | GET | PUBLIC | N/A | none | BlackLab KWIC Results Fragment |

---

### Advanced Search API (Blueprint: `advanced_api`, Prefix: `/search/advanced`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/search/advanced/data` | GET | PUBLIC (optional-auth) | N/A | `@jwt_required(optional=True)` | DataTables Server-Side (BlackLab) |
| `/search/advanced/export` | GET | PUBLIC | N/A | none | CSV/TSV Streaming Export |

**Hinweis:** Rate-Limited via `@limiter.limit("30 per minute")`.

---

### BlackLab Proxy (Blueprint: `bls`, Prefix: `/bls`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/bls/` | GET | PUBLIC | N/A | none | BlackLab Server Info |
| `/bls/<path:path>` | GET, POST, PUT, DELETE, PATCH | PUBLIC | **YES (POST/PUT/PATCH/DELETE)** | none | BlackLab API Proxy |

**Wichtig:** 
- GET-Requests: Public ohne CSRF
- Schreibende Methoden (POST/PUT/DELETE): CSRF erforderlich (sofern implementiert)
- Keine JWT-Prüfung (BlackLab ist Public Search Tool)

---

### Auth Routes (Blueprint: `auth`, Prefix: `/auth`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/auth/save-redirect` | POST | PUBLIC | YES | none | Save Player Redirect URL (API) |
| `/auth/session` | GET | PUBLIC | N/A | none | Check Session State (always 200 JSON) |
| `/auth/ready` | GET | PUBLIC | N/A | none | Auth-Ready Check (für /player) |
| `/auth/login` | GET | PUBLIC | N/A | none | Login Form |
| `/auth/login` | POST | PUBLIC | YES | none | Login Submit |
| `/auth/logout` | **GET** | PUBLIC | **N/A** | **none** | **🔹 Logout (Primary Method) - Idempotent, No CSRF** |
| `/auth/logout` | POST | PUBLIC | **NO** | **none** | **🔹 Logout (Legacy) - Backward Compatibility** |
| `/auth/refresh` | POST | PUBLIC | YES | @jwt_required(refresh=True) | Refresh Access Token |

**✅ FINAL CHANGES (2025-11-11):**
- **`/auth/logout` GET**: Now **PRIMARY** method (idempotent, no CSRF required per HTTP spec)
- **`/auth/logout` POST**: Kept for backward compatibility, **NO CSRF** (logout is idempotent)
- **Templates**: All logout links converted from POST forms to simple `<a href="{{ url_for('auth.logout_get') }}">` links
- **Security**: GET logout is safe (idempotent, no state change beyond cookie clearing)
- **CSRF Exemption**: Flask-JWT-Extended does NOT enforce CSRF on routes without `@jwt_required` decorator

---

### Media Routes (Blueprint: `media`, Prefix: `/media`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/media/full/<filename>` | GET | PUBLIC* (optional-auth) | N/A | `@jwt_required(optional=True)` | Full MP3 Files |
| `/media/split/<filename>` | GET | PROTECTED | N/A | @jwt_required() | Split MP3 Segments |
| `/media/temp/<filename>` | GET | PUBLIC* (optional-auth) | N/A | `@jwt_required(optional=True)` | Temp Audio Snippets |
| `/media/snippet` | POST | PUBLIC* (optional-auth) | YES | `@jwt_required(optional=True)` | Generate Audio Snippet |
| `/media/transcripts/<filename>` | GET | PUBLIC | N/A | `@jwt_required(optional=True)` | Transcription JSON |
| `/media/toggle/temp` | POST | ADMIN | YES | @jwt_required() | Toggle Public Temp Audio |
| `/media/play_audio/<filename>` | GET | PUBLIC | N/A | none | Audio Playback (Legacy) |

**PUBLIC\*:** Abhängig von `ALLOW_PUBLIC_TEMP_AUDIO` Config (Default: `True`).

**Änderungen:** `@jwt_required(optional=True)` wird entfernt auf Public-Routes.

---

### Player Routes (Blueprint: `player`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/player` | GET | PROTECTED | N/A | @jwt_required() | Audio Player Page |

**Status:** Bleibt geschützt (erfordert Login).

---

### Editor Routes (Blueprint: `editor`, Prefix: `/editor`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/editor/` | GET | PROTECTED | N/A | @jwt_required() | Editor Dashboard |
| `/editor/edit` | GET | PROTECTED | N/A | @jwt_required() | Edit Transcription |
| `/editor/save-edits` | POST | PROTECTED | YES | @jwt_required() | Save Edits |
| `/editor/bookmarks/add` | POST | PROTECTED | YES | @jwt_required() | Add Bookmark |
| `/editor/bookmarks/remove` | POST | PROTECTED | YES | @jwt_required() | Remove Bookmark |
| `/editor/history/<country>/<filename>` | GET | PROTECTED | N/A | @jwt_required() | Edit History |
| `/editor/undo` | POST | PROTECTED | YES | @jwt_required() | Undo Last Edit |
| `/editor/bookmarks/<country>/<filename>` | GET | PROTECTED | N/A | @jwt_required() | Get Bookmarks |

**Status:** Alle Editor-Routen bleiben geschützt.

---

### Admin Routes (Blueprint: `admin`, Prefix: `/admin`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/admin/dashboard` | GET | ADMIN | N/A | @jwt_required() + @require_role(ADMIN) | Admin Dashboard |
| `/admin/metrics` | GET | ADMIN | N/A | @jwt_required() + @require_role(ADMIN) | Counter Metrics JSON |

**Status:** Admin-Only, bleibt geschützt.

---

### Atlas API (Blueprint: `atlas`, Prefix: `/atlas`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/atlas/overview` | GET | PUBLIC | N/A | none | Atlas Overview JSON |
| `/atlas/countries` | GET | PUBLIC | N/A | none | Country List JSON |
| `/atlas/files` | GET | PUBLIC | N/A | none | Files JSON |
| `/atlas/locations` | GET | PUBLIC | N/A | none | Location Coordinates JSON |

**Status:** Public API, keine Auth.

---

### Stats Routes (Blueprint: `stats`)

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/stats` | GET | PUBLIC | N/A | none | Statistik-Dashboard |

---

### Static Assets

| Path | Methods | Access | CSRF | Decorator | Beschreibung |
|------|---------|--------|------|-----------|--------------|
| `/static/*` | GET | PUBLIC | N/A | none | CSS, JS, Images, Fonts |
| `/favicon.ico` | GET | PUBLIC | N/A | none | Favicon |
| `/robots.txt` | GET | PUBLIC | N/A | none | Robots.txt |

---

## Before-Request Hooks

### Global Hooks (alle Blueprints)

**`auth.load_user_dimensions()` (Blueprint: `auth`, @before_app_request)**
- **Funktion:** Lädt JWT aus Cookie → setzt `g.user` und `g.role`
- **PROBLEM (aktuell):** Ruft `verify_jwt_in_request(optional=True)` global auf → Expired Tokens triggern `expired_token_loader` auch auf Public-Routen
- **LÖSUNG:** Public-Routen früh returnen **bevor** JWT-Prüfung:

```python
PUBLIC_PREFIXES = ('/static/', '/favicon', '/robots.txt', '/health')

@blueprint.before_app_request
def load_user_dimensions():
    # Skip JWT processing for public routes
    if request.path.startswith(PUBLIC_PREFIXES):
        g.user = None
        g.role = None
        return  # CRITICAL: Early return prevents expired_token_loader
    
    # Protected routes: normal JWT processing
    try:
        verify_jwt_in_request(optional=True)
        token = get_jwt() or {}
        g.user = token.get("sub")
        g.role = Role(token.get("role")) if token.get("role") else None
    except Exception:
        g.user = None
        g.role = None
```

**`public.track_visits()` (Blueprint: `public`, @before_app_request)**
- **Funktion:** Zählt Besuche (Counter)
- **Status:** Bleibt unverändert, kein Auth-Einfluss

---

## JWT Error Handlers (extensions/__init__.py)

### `@jwt.expired_token_loader`
**Aktuelles Verhalten:** Wird auch auf `@jwt_required(optional=True)` getriggert wenn Token expired.

**Neue Policy:**
- **Public-Routen:** Niemals 401/302, keine Flash-Messages
- **Protected-Routen (AJAX):** JSON `{"error": "token_expired", "code": "access_expired"}` mit 401
- **Protected-Routen (Browser):** Redirect zu Login mit `?showlogin=1`, Flash-Message

**Path-Check erweitern:**
```python
PUBLIC_PREFIXES = ('/corpus', '/search/advanced', '/bls/', '/atlas/', '/static/', '/')

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    # PUBLIC ROUTES: Never trigger error handler
    if request.path.startswith(PUBLIC_PREFIXES):
        return jsonify({"authenticated": False}), 200  # or abort processing
    
    # API/AJAX: JSON error
    if request.path.startswith('/api/') or request.accept_mimetypes.best == 'application/json':
        return jsonify({'error': 'token_expired', 'code': 'access_expired'}), 401
    
    # Browser: Redirect to login
    save_return_url()
    flash("Tu sesión ha expirado. Por favor inicia sesión nuevamente.", "info")
    return redirect(f"{request.referrer}?showlogin=1")
```

**WICHTIG:** Durch Early-Return in `load_user_dimensions()` wird dieser Handler für Public-Routen **gar nicht mehr erreicht**.

---

## CSRF Protection

### WTForms CSRF (Flask-WTF)
**Status:** Nicht verwendet in diesem Projekt (Custom JWT-CSRF).

### JWT-CSRF (Flask-JWT-Extended)
**Config:**
```python
JWT_COOKIE_CSRF_PROTECT = True
JWT_CSRF_IN_COOKIES = True
JWT_CSRF_CHECK_FORM = True
```

**CSRF-Token-Quellen (geprüft in dieser Reihenfolge):**
1. `X-CSRF-TOKEN` HTTP-Header (bevorzugt für AJAX/HTMX)
2. `csrf_token` Form-Field (für klassische POST-Forms)
3. `csrf_access_token` / `csrf_refresh_token` Cookies (automatisch gesetzt mit JWT)

**Frontend-Implementation (HTMX):**
```javascript
// Read CSRF token from cookie
function readCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

// Inject CSRF token into HTMX requests
document.addEventListener('htmx:configRequest', (event) => {
  const csrfToken = readCookie('csrf_access_token') || readCookie('csrf_refresh_token');
  if (csrfToken) {
    event.detail.headers['X-CSRF-TOKEN'] = csrfToken;
  }
});
```

**Logout-Form (POST mit CSRF):**
```html
<form method="post" action="/auth/logout">
  <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
  <button type="submit">Logout</button>
</form>
```

**Alternative (HTMX-Button):**
```html
<button 
  hx-post="/auth/logout" 
  hx-target="body" 
  hx-swap="outerHTML">
  Logout
</button>
```
→ CSRF-Token wird automatisch via `htmx:configRequest` injected.

---

## Redirect-Logik nach Logout

### Anforderungen
1. **Von Public-Seite:** Auf derselben Seite bleiben (kein Redirect zu `/`)
2. **Von Protected-Seite:** Redirect zu `/` (Inicio)
3. **Fallback:** Wenn Referrer ungültig/extern → `/`

### Implementation
```python
PUBLIC_CHECK_PREFIXES = ('/corpus', '/', '/search/advanced', '/proyecto', '/atlas', '/stats', '/impressum', '/privacy')
PROTECTED_PATHS = ('/player', '/editor', '/admin')

def next_url_after_logout():
    """Determine redirect target after logout."""
    referrer = request.args.get('next') or request.headers.get('Referer')
    
    # No referrer or external → fallback to inicio
    if not referrer or not is_same_origin(referrer):
        return url_for('public.landing_page')
    
    # Parse path from referrer
    parsed = urlparse(referrer)
    path = parsed.path
    
    # Protected route → redirect to inicio
    if any(path.startswith(p) for p in PROTECTED_PATHS):
        return url_for('public.landing_page')
    
    # Public route → stay on same page
    if any(path.startswith(p) for p in PUBLIC_CHECK_PREFIXES):
        return referrer
    
    # Unknown → fallback to inicio
    return url_for('public.landing_page')

def is_same_origin(url):
    """Check if URL is same origin as current request."""
    parsed = urlparse(url)
    return parsed.netloc == '' or parsed.netloc == request.host

@blueprint.post('/logout')
def logout():
    redirect_to = next_url_after_logout()
    resp = make_response(redirect(redirect_to, 303))
    unset_jwt_cookies(resp)
    return resp
```

---

## Testing Matrix

### Unit Tests (pytest)

#### Public Routes (ohne Token)
```python
def test_corpus_home_no_auth(client):
    """GET /corpus/ ohne Token → 200"""
    resp = client.get('/corpus/')
    assert resp.status_code == 200

def test_corpus_search_no_auth(client):
    """GET /corpus/search ohne Token → 200"""
    resp = client.get('/corpus/search?q=test')
    assert resp.status_code == 200

def test_advanced_search_no_auth(client):
    """GET /search/advanced ohne Token → 200"""
    resp = client.get('/search/advanced')
    assert resp.status_code == 200

def test_advanced_data_no_auth(client):
    """GET /search/advanced/data ohne Token → 200 JSON"""
    resp = client.get('/search/advanced/data?q=test')
    assert resp.status_code == 200
    assert resp.json
```

#### Public Routes (mit Expired Token)
```python
def test_corpus_with_expired_token(client, expired_token_cookie):
    """GET /corpus/ mit abgelaufenem Token → 200 (nicht 401)"""
    client.set_cookie('access_token_cookie', expired_token_cookie)
    resp = client.get('/corpus/')
    assert resp.status_code == 200  # NOT 401!
```

#### Protected Routes (ohne Token)
```python
def test_player_no_auth_ajax(client):
    """XHR zu /player ohne Token → 401 JSON"""
    resp = client.get('/player', headers={'Accept': 'application/json'})
    assert resp.status_code == 401
    assert resp.json['code'] == 'unauthorized'

def test_player_no_auth_browser(client):
    """Browser-GET zu /player ohne Token → 302 zu Login"""
    resp = client.get('/player?transcription=x&audio=y')
    assert resp.status_code == 302
    assert '?showlogin=1' in resp.location
```

#### Logout (CSRF)
```python
def test_logout_post_with_csrf(client, auth_cookies, csrf_token):
    """POST /auth/logout mit CSRF → 303 Redirect, Cookies gelöscht"""
    client.set_cookie('access_token_cookie', auth_cookies['access'])
    resp = client.post('/auth/logout', headers={'X-CSRF-TOKEN': csrf_token})
    assert resp.status_code == 303
    assert 'access_token_cookie' in resp.headers.get('Set-Cookie', '')
    assert 'Max-Age=0' in resp.headers.get('Set-Cookie', '')

def test_logout_post_no_csrf(client, auth_cookies):
    """POST /auth/logout ohne CSRF → 401 (CSRF-Error)"""
    client.set_cookie('access_token_cookie', auth_cookies['access'])
    resp = client.post('/auth/logout')
    assert resp.status_code == 401  # CSRF protection kicks in
```

#### Logout Redirect Logic
```python
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

### Manual Checks

#### Browser DevTools
1. **Öffne /corpus/ ohne Login**
   - Network-Tab: Keine 401/302 auf `/corpus/`
   - Network-Tab: Keine 401 auf `/static/*` Assets
   - Console: Keine JWT-Fehler

2. **Logout von Public-Seite**
   - Auf `/corpus/` navigieren → Login → Logout klicken
   - Erwartung: Seite bleibt auf `/corpus/`, keine Reload
   - Network: `Set-Cookie` Header mit `Max-Age=0` für `access_token_cookie`

3. **Logout von Protected-Seite**
   - Auf `/player` navigieren → Logout klicken
   - Erwartung: Redirect zu `/` (Inicio)
   - Network: `Set-Cookie` mit `Max-Age=0`

4. **Expired Token auf Public**
   - Login → Warte bis Token abläuft (15min) → Navigiere zu `/corpus/`
   - Erwartung: Seite lädt normal, keine Flash-Message
   - g.user: `None` (nicht mehr authenticated)

---

## Akzeptanzkriterien (Checkliste)

- [ ] **Public-Routen ohne Login zugänglich**
  - `/corpus/`, `/search/advanced`, `/bls/*`, `/atlas/*` → 200 ohne Token
  - Keine 401/302 Redirects auf Assets (`/static/*`, `/favicon.ico`)

- [ ] **Expired Tokens auf Public-Routen ignoriert**
  - GET `/corpus/` mit expired Token → 200 (nicht 401)
  - Kein Trigger von `expired_token_loader` auf Public-Routen

- [ ] **Logout funktioniert ohne "Missing CSRF token"**
  - POST `/auth/logout` mit X-CSRF-TOKEN Header → 303 Redirect
  - GET `/auth/logout` Fallback → 303 zu `/`

- [ ] **Smart Redirect nach Logout**
  - Von `/corpus/` logout → bleibt auf `/corpus/`
  - Von `/player` logout → redirect zu `/`

- [ ] **Protected Routes verlangen Login**
  - GET `/player` ohne Token (Browser) → 302 zu Login
  - GET `/player` ohne Token (AJAX) → 401 JSON

- [ ] **CSRF-Protection aktiv auf schreibenden Endpoints**
  - POST `/auth/logout` ohne CSRF → 401
  - POST `/editor/save-edits` ohne CSRF → 401

- [ ] **Set-Cookie Header korrekt nach Logout**
  - `access_token_cookie` mit `Max-Age=0`, `HttpOnly`, `Secure`, `SameSite=Lax`
  - `refresh_token_cookie` mit `Max-Age=0`

- [ ] **Frontend CSRF-Header global gesetzt**
  - HTMX-Requests haben `X-CSRF-TOKEN` Header (wenn Cookie vorhanden)
  - Logout-Button sendet CSRF-Token

---

## Siehe auch

- [Authentication Flow Concept](../concepts/authentication-flow.md) - Architektur-Überblick
- [How-To: Adding Protected Endpoints](../how-to/adding-protected-endpoints.md) - Developer Guide
- [Troubleshooting: Auth Issues](../troubleshooting/auth-issues.md) - Häufige Probleme
- [ADR-XXXX: Public Corpus Access](../decisions/ADR-XXXX-public-corpus-access.md) - Design-Rationale (TODO)
