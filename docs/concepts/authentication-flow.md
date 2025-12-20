---
title: "Authentication Flow — CO.RA.PAN"
status: active
owner: backend-team
updated: "2025-11-18"
tags: [authentication, jwt, architecture, guide]
links:
  - ../reference/api-auth-endpoints.md
  - ../troubleshooting/auth-issues.md
  - ../reference/auth-access-matrix.md
---

# Authentication Flow — CO.RA.PAN (Simplified)

This document explains the simplified authentication architecture and operational client/server flows implemented in CO.RA.PAN. It documents the canonical server endpoints, how the client behaves (Corpus and Atlas), and how to debug authentication issues.

Goals:
- Single source of truth for auth state (server endpoint `/auth/session`).
- One clean 'intended target' mechanism: `next` param + server-side `session[RETURN_URL_SESSION_KEY]` fallback.
- Keep client logic minimal: clients should directly attempt snippet playback via `/media/play_audio` which is public; no pre-checks or save-redirect are required for snippet playback. Use `save-redirect` + login sheet only for protected paths (`/player`, `/editor`, `/admin`).
- Avoid ad-hoc client-side replay or sessionStorage-based post-login actions.

Terminology:
- Access token: JWT in cookie `access_token_cookie` (short-lived)
- Refresh token: JWT in cookie `refresh_token_cookie` (longer-lived)
- `allow_public_temp_audio` / `ALLOW_PUBLIC_TEMP_AUDIO`: server-side flag to make snippets available to anonymous users

---

## Architecture Summary

- Authentication is JWT-based; JWTs are set as HttpOnly cookies for security.
- The server is authoritative; the client uses `/auth/session` to confirm state.
- Routes fall into three categories: public (no JWT processing), optional-enhanced (features for auth users), and protected (requires JWT).
- Media snippet access (`/media/play_audio`) is public and does not require authentication; clients should fetch it directly for snippet playback. Other media endpoints such as `/media/temp` and `/media/snippet` can be controlled via `ALLOW_PUBLIC_TEMP_AUDIO`.

---

## Server-side Endpoints and Behavior

This section lists the main endpoints and their behavior.

- `GET /auth/session` — Report current session state in JSON:

  ```json
  { "authenticated": true|false, "user": "username"|null, "exp": 1234567890|null }
  ```

  - Always returns JSON and 200 OK to avoid HTML redirects from JWT error handlers; the client can decide how to interpret the result.

- `POST /auth/save-redirect` — Save redirect target in server session.
  - Input JSON: `{ "url": "/player?transcription=...&audio=..." }`.
  - The server validates and sanitizes the URL with `_safe_next()` before storing it in `session[RETURN_URL_SESSION_KEY]`.

- `GET /auth/login_sheet` — Return HTMX partial (login sheet) to render.
  - Accepts `?next=` to set the form hidden field and to pre-fill server-side session if needed.

- `GET /auth/login` — Router for full-page login; supports HTMX: returns `204` with `HX-Redirect` to login sheet or `303` redirect to a page with `?showlogin=1`.

- `POST /auth/login` — Validate credentials and set cookies.
  - Behavior after successful login:
    - If `next` param is present and safe, redirect to it.
    - Else, if `session[RETURN_URL_SESSION_KEY]` is present, use it as fallback.
    - Else, redirect to landing page.
  - For HTMX requests, returns a `204` with `HX-Redirect` header instead of an HTML body.

- `GET|POST /auth/logout` — Clears cookies and redirects.
  - No CSRF required here; the response redirects depending on referrer and route type.

- `@blueprint.before_app_request` — `load_user_dimensions()` sets `g.user` and `g.role`:
  - Only minimal infra/static routes (`/static/`, `/favicon`, `/robots.txt`, `/health`) bypass JWT processing.
  - Routes such as `/corpus`, `/search/advanced`, `/atlas`, and `/media/*` are "optional auth": the server runs `verify_jwt_in_request(optional=True)` and sets `g.user` if a valid token is present while still allowing unauthenticated access.
  - Protected routes (e.g. `/player`, `/editor`, `/admin`) verify JWTs and set `g.user` accordingly.

---

## Client-side Behavior

Principle: The client avoids complex replays and only uses the server as the source of truth.

Core concepts:
- `allowTempMedia()` evaluates if playback is allowed by looking at: `window.__CORAPAN__?.allowPublicTempAudio`, `window.IS_AUTHENTICATED`, and DOM `authenticated` class.
- When a user performs an action that requires auth (e.g., Play / Download or Player link):
  1. If `allowTempMedia()` is true → proceed
  2. Else → call `POST /auth/save-redirect` with the intended target and open login sheet via `openLoginForTarget(next)`.
    - This is the only client-side record of intended target: the server stores it in session.
  3. The login sheet sets `next` on the form as a hidden field too, so full-page logins work.

No action replay via sessionStorage is performed; the client only relies on server redirect (and the user clicking again once logged in). This eliminates the fragile post-login action logic across tabs and race conditions.

Example: Play click handler (simplified logic):

```javascript
async function onPlayClick(filename, start, end) {
  if (allowTempMedia()) {
    // proceed to play via /media/play_audio
    playAudio(filename, start, end);
    return;
  }
  // Not allowed: save redirect and open login sheet
  await fetch('/auth/save-redirect', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: window.location.href }) });
  openLoginForTarget(window.location.href);
}
```

Notes:
- `openLoginForTarget(url)` uses HTMX to open the login sheet URL with `?next=` so the login sheet and server session agree on the target.
- Post-login flow is straightforward: the server uses `next` (or saved session `next`) to redirect the browser to the intended page.

---

## Media / Playback Rules

- `/media/play_audio` (play snippets) is a public endpoint and does not require authentication.
  - Client code should always fetch `/media/play_audio` for snippet playback and handle the audio stream directly.
  - The legacy config `ALLOW_PUBLIC_TEMP_AUDIO` continues to be relevant for other endpoints (`/media/temp`, `/media/snippet`) but does not affect `/media/play_audio`.

- Client behavior is simple: check `allowTempMedia()` before attempting a fetch/Audio playback. If not allowed, use `save-redirect` + login central flow.

---

## Debugging & Troubleshooting

If a logged-in user still sees a login sheet on playback or player navigation:

1. Confirm the browser includes the JWT cookie with requests:
   - Check `Application` → `Cookies` in DevTools for `access_token_cookie` and `refresh_token_cookie`.
2. Verify `/auth/session` (`fetch('/auth/session', { credentials: 'same-origin' })`) returns `authenticated: true`.
3. If `/auth/session` returns false despite cookies present: inspect tokens—expiry, invalid claims, or wrong cookie name.
4. For snippet access issues, check server logs for `play_audio` debug statements (contains `g.user` and cookies list) and ensure `g.user` is set.

Minimal steps to capture logs:
```bash
# In flask logs (terminal running dev server) - tail logs in real time
tail -f logs/corapan.log

# In browser DevTools: Network tab — watch for '/auth/session', '/auth/save-redirect', '/media/play_audio'
```

---

## Deprecated / Removed Behavior

- `sessionStorage._player_redirect_after_login` and `_post_login_action` event-based playback replays are deprecated and removed.
- The reason: those mechanisms caused race conditions, cross-tab inconsistency, and fragile client logic.

If re-play-after-login is a desired UX, please request a follow-up to implement a robust server-driven design (for example a `?play_after_login=1` flag on the `next` URL that the client uses only on the players page, i.e., not a general client-side `postLoginAction`).

---

## Developer Checklist

- Ensure templates set `data-auth` attribute for the top-app-bar. This is used for initial seeding of `IS_AUTHENTICATED`.
- Client: call `verifyAuth()` on load and after HTMX login events.
- Client: use `openLoginForTarget()` to open login and save redirect server-side.
- Avoid sessionStorage-based replay behavior. Keep playback and player navigation simple — rely on server redirect.

---

## See Also
- [API Auth Endpoints](../reference/api-auth-endpoints.md)
- [Auth Troubleshooting](../troubleshooting/auth-issues.md)
- [Auth Access Matrix](../reference/auth-access-matrix.md)
---
title: "Authentication Flow - CO.RA.PAN"
status: active
owner: backend-team
updated: "2025-11-18"
tags: [authentication, jwt, architecture, guide]
links:
  - ../reference/api-auth-endpoints.md
  - ../troubleshooting/auth-issues.md
  - ../reference/auth-access-matrix.md
---

# Authentication Flow — Simplified & Robust

This document describes the current authentication architecture and operational flow for CO.RA.PAN. It focuses on the simplified, deterministic approach implemented recently to avoid race conditions and client-side complexity.

High-level guidance
- Use a single authoritative endpoint for auth state: `/auth/session`.
- Persist redirect targets server-side via `/auth/save-redirect` (session fallback). Avoid client-side-based redirect replay (no sessionStorage-based post-login actions).
- Use consistent server-side login handling: `login_post` uses `next` param first, then session fallback.

This approach improves reliability across browsers and client code paths.

---

## Concepts & Goals

- Single source of truth: server-side `/auth/session` endpoint reports whether a user is authenticated.
- Single intended-target mechanism: `next` query param + server-side `session[RETURN_URL_SESSION_KEY]` fallback.
- Keep client logic simple: `allowTempMedia()` + `save-redirect` + `openLoginSheet` — no queueing or replaying actions in sessionStorage.

Benefits:
- Fewer race conditions on cookie propagation after `Set-Cookie`.
- Cleaner separation of concerns: server owns authentication state and redirection.
- Easier to debug and test.

---

## Server-side APIs / Endpoints (Overview)

---
title: "Authentication Flow Overview"
status: active
owner: backend-team
updated: "2025-11-07"
tags: [authentication, jwt, security, architecture]
links:
  - ../reference/api-auth-endpoints.md
  - ../troubleshooting/auth-issues.md
  - ../operations/deployment.md
---

# Authentication Flow Overview

## Übersicht

Die CO.RA.PAN Webapp verwendet **JWT-basierte Authentifizierung** mit Cookie-basierten Tokens und einer **deterministischen Auth-Ready-Seite** zur Vermeidung von Race Conditions.

### Authentifizierungsstufen

1. **Öffentlich (keine Auth erforderlich)**
   - Landing Page (`/`)
   - Projekt-Seiten (`/proyecto/*`)
   - Atlas-Übersicht (`/atlas`)
   - Impressum/Privacy

2. **Optional Auth (Enhanced für eingeloggte User)**
   - Corpus (`/corpus`) - Suche öffentlich, aber mehr Features für Auth-User
   - Media-Endpoints (`/media/full/*`, `/media/temp/*`) - Config-gesteuert

3. **Mandatory Auth (Login erforderlich)**
   - Player (`/player`) - **Immer Auth erforderlich**
   - Editor (`/editor/*`) - Nur für Editor/Admin
   - Admin (`/admin/*`) - Nur für Admin
   - Atlas File-Details (`/get_stats_files_from_db`) - Auth erforderlich

---

## Cookie-basierte Authentifizierung

### Cookie-Konfiguration

Die Webapp nutzt **HttpOnly-Cookies** für JWT-Tokens:

- **Access Token**: `access_token_cookie` (1 Stunde Gültigkeit)
- **Refresh Token**: `refresh_token_cookie` (7 Tage Gültigkeit)
- **Cookie-Eigenschaften**:
  - `HttpOnly=True` (nicht via JavaScript lesbar)
  - `Secure=True` (nur HTTPS in Production, HTTP in Dev)
  - `SameSite=Lax` (erlaubt Cookies bei same-site Redirects)
  - `Path=/` (Cookie wird mit **allen** Requests gesendet)

### Warum Cookie-basiert?

- **Automatisch**: Browser sendet Cookies mit jedem Request
- **Sicher**: HttpOnly verhindert XSS-Angriffe
- **Persistent**: Refresh-Token ermöglicht Auto-Login für 7 Tage

---

## Login-Flow mit Auth-Ready-Page

### Problem: Cookie-Timing Race Condition

Nach dem POST-Login-Request muss der Browser:
1. Die Response mit `Set-Cookie` verarbeiten
2. Cookies in den Cookie-Store schreiben
3. Zum Player redirecten
4. Player-Request mit Cookies senden

**Problem**: Browser kann Player-Seite laden, bevor Cookies vollständig verfügbar sind → Player zeigt leere Seite → Manual Refresh erforderlich.

### Lösung: `/auth/ready` Intermediate Page

**1. Login setzt Cookies und redirected zu `/auth/ready`**

```python
@blueprint.post("/auth/login")
def login():
    # ... validate credentials ...
    
    # Create tokens
    access_token = issue_token(username, role)
    refresh_token = create_refresh_token(identity=username)
    
    # Redirect to /auth/ready with 303 (POST->GET)
    ready_url = url_for("auth.auth_ready", next=return_url)
    response = make_response(redirect(ready_url, 303))
    
    # Set cookies in this response
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    
    return response
```

**Wichtig**: `303 See Other` statt `302 Found` verhindert Cookie-Edge-Cases.

**2. `/auth/ready` pollt `/auth/session` bis Auth bestätigt**

Die Ready-Seite ist eine **minimale HTML-Seite mit JavaScript**:

```javascript
// /auth/ready page JavaScript
(async () => {
  for (let i = 0; i < 10; i++) {
    const response = await fetch('/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    
    if (response.ok) {
      // Auth confirmed - redirect to target page
      location.replace(nextUrl);
      return;
    }
    
    // Wait 150ms before retry
    await new Promise(r => setTimeout(r, 150));
  }
  
  // Failed after 10 attempts
  location.href = '/?showlogin=1&e=auth';
})();
```

**3. `/auth/session` verifiziert Token**

```python
@blueprint.get("/auth/session")
@jwt_required(optional=True)
def check_session():
    user = getattr(g, "user", None)
    if user:
        return jsonify({"authenticated": True, "user": user}), 200
    else:
        return jsonify({"authenticated": False}), 401
```

**Vorteile dieser Lösung:**

✅ **Deterministisch**: Kein Race-Condition mehr  
✅ **Kein Heuristik**: Polling statt feste Delays  
✅ **Robust**: Funktioniert über verschiedene Browser/Devices  
✅ **Transparent**: User sieht kurz "Autenticando..." (< 300ms meist)  

---

## Login-Szenarien

### Scenario 1: User klickt auf Player-Link vom Atlas aus (nicht eingeloggt)

1. **User klickt auf Player-Link**
   - JavaScript: `handlePlayerLinkClick()` in `atlas/index.js`
   - Prüft: `isUserAuthenticated()` → false
   - Speichert Ziel-URL: `sessionStorage.setItem('_player_redirect_after_login', playerUrl)`
   - Öffnet Login-Sheet: `openLoginSheet()`

2. **User loggt sich ein**
   - Login-Form submittet via `main.js`
   - Prüft: `sessionStorage.getItem('_player_redirect_after_login')`
   - **Falls vorhanden**: Login via Fetch-API, dann Client-Side-Redirect
   - **Falls nicht vorhanden**: Normaler Form-Submit, Backend redirected

3. **Backend-Login** (`/auth/login`)
   - Validiert Credentials
   - Erstellt JWT Access Token (1h) + Refresh Token (7 Tage)
   - Setzt Cookies: `access_token_cookie`, `refresh_token_cookie`
   - Redirected zu: Gespeicherte Return-URL **oder** Referrer **oder** Landing Page

4. **Nach Login**
   - Browser navigiert zu Player mit allen Query-Parametern
   - JWT-Cookie wird automatisch mitgeschickt
   - `@jwt_required()` prüft Token → OK → Player lädt

### Scenario 2: User versucht direkt auf Player zuzugreifen (nicht eingeloggt)

1. **User navigiert zu** `/player?transcription=...&audio=...`
   - Flask: `@jwt_required()` prüft Token → Keiner vorhanden
   - `unauthorized_callback` wird aufgerufen
   - **Return-URL wird gespeichert**: `save_return_url(request.url)`
   - Redirect zu Referrer mit `?showlogin=1`

2. **Browser wird redirected**
   - Zu: `/atlas?showlogin=1` (oder woher der User kam)
   - JavaScript: `main.js` erkennt `?showlogin=1` → öffnet Login-Sheet
   - Return-URL ist **bereits in Session gespeichert** (Server-Side)

3. **User loggt sich ein**
   - Login-Form submittet **normal** (kein sessionStorage erforderlich)
   - Backend holt Return-URL aus Session: `session.pop(RETURN_URL_SESSION_KEY)`
   - Redirected zu: `/player?transcription=...&audio=...` (Original-URL)

### Scenario 3: Token ist abgelaufen

1. **User mit abgelaufenem Token navigiert zu Player**
   - Flask: `@jwt_required()` prüft Token → Abgelaufen
   - `expired_token_callback` wird aufgerufen
   - Return-URL wird gespeichert
   - Redirect mit `?showlogin=1` + Flash-Message: "Tu sesión ha expirado..."

2. **Rest wie Scenario 2**

---

## Logout-Flow

### Standard-Logout

1. **User klickt auf Logout-Button**
   - Form submittet POST zu `/auth/logout`
   - Backend: `unset_jwt_cookies()` löscht alle JWT-Cookies
   - Redirect zu Landing Page (`/`)

2. **Browser landet auf Landing Page**
   - Alle JWT-Cookies gelöscht
   - User ist ausgeloggt
   - Login-Buttons funktionieren

### Problem: Logout ohne Page-Reload

**NICHT IMPLEMENTIERT** - Logout macht immer Redirect zur Landing Page.
Wenn User auf gleicher Seite bleiben soll:
- Client-Side: Cookies manuell löschen + UI aktualisieren
- **ODER**: Page-Reload erzwingen

---

## DOM Data Attributes

### `[data-element="top-app-bar"]` → `data-auth="true/false"`
- **Zweck**: JavaScript kann Auth-Status prüfen
- **Gesetzt von**: Template `base.html` (Jinja)
- **Geprüft von**: `isUserAuthenticated()` in `atlas/index.js`, `corpus/audio.js`

### `[data-action="open-login"]`
- **Zweck**: Öffnet Login-Sheet
- **Event-Handler**: `main.js`

### `[data-action="close-login"]`
- **Zweck**: Schließt Login-Sheet
- **Event-Handler**: `main.js`

### `[data-action="open-player"]`
- **Zweck**: Player-Link mit Auth-Check (Atlas)
- **Event-Handler**: `handlePlayerLinkClick()` in `atlas/index.js`

---

## Session Storage Keys

### `_player_redirect_after_login`
- **Verwendet von**: Atlas, Corpus Player-Links
- **Zweck**: Client-Side-Redirect nach Login
- **Scope**: sessionStorage (nur aktueller Tab)
- **Cleanup**: Nach erfolgreichem Login automatisch gelöscht

### `_return_url_after_login` (Server-Side Session)
- **Verwendet von**: Flask-Backend (`auth.py`)
- **Zweck**: Server-Side-Redirect nach Login
- **Scope**: Flask-Session (Cookie-basiert)
- **Cleanup**: Nach Login automatisch `session.pop()`

---

## Code-Referenzen

### Backend
- **Auth-Routes**: `src/app/routes/auth.py`
- **JWT-Config**: `src/app/config/__init__.py`
- **JWT-Handlers**: `src/app/extensions/__init__.py`
- **Error-Handlers**: `src/app/__init__.py`

### Frontend
- **Login-Sheet**: `templates/partials/status_banner.html`
- **Main Login-Logic**: `static/js/main.js`
- **Atlas Player-Links**: `static/js/modules/atlas/index.js`
- **Corpus Player-Links**: `static/js/modules/corpus/audio.js`

### Templates
- **Auth-Status**: `templates/base.html` → `data-auth="{{ 'true' if g.user else 'false' }}"`
- **Login-Buttons**: `templates/partials/_navbar.html`, `_navigation_drawer.html`

---

## Siehe auch

- [API Auth Endpoints](../reference/api-auth-endpoints.md) - Technische API-Details
- [Auth Troubleshooting](../troubleshooting/auth-issues.md) - Bekannte Probleme & Lösungen
- [Deployment](../operations/deployment.md) - Production-Konfiguration
