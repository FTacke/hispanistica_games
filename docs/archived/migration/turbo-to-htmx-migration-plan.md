---
title: "Turbo → htmx Migration Plan"
status: draft
owner: frontend-team
updated: "2025-11-10"
tags: [migration, htmx, turbo, architecture, plan]
links:
  - ../decisions/ADR-0002-htmx-migration.md
  - /CONTRIBUTING.md
---

# Turbo → htmx Migration Plan (DRY RUN)

**Datum:** 2025-11-10  
**Workflow:** DISCOVER → PLAN → LINT → APPLY → REPORT

---

## Zusammenfassung

Vollständige Migration von Hotwired Turbo 8.0.10 zu htmx für MPA-Navigation und Login-Flow. Turbo verursacht wiederholt Probleme (Flash-Effekte, Cache-Konflikte, komplexe Event-Handhabung). htmx ist leichtgewichtiger, flexibler und passt besser zu CO.RA.PAN's Flask + Jinja-Architektur.

**Kernänderungen:**
- ❌ Turbo Drive/Frame/Stream komplett entfernen
- ✅ htmx 1.9.10+ für progressive enhancement
- ✅ Login als htmx-Sheet (kein Full-Page-Redirect)
- ✅ 401-Handling öffnet Login-Sheet automatisch
- ✅ MPA + hx-boost für Navigation

---

## DISCOVER: Bestandsaufnahme Turbo-Nutzung

### Templates mit Turbo-Referenzen

| Datei | Zeilen | Turbo-Elemente |
|-------|--------|----------------|
| `templates/base.html` | 7-150 | `turbo.esm.js`, `data-turbo-track`, `data-turbo-permanent`, CSS für `turbo-progress-bar`, Kommentare |
| `templates/partials/_top_app_bar.html` | 80 | `data-turbo="false"` |
| `templates/partials/_navigation_drawer.html` | 109, 113, 149, 237, 241, 275 | `data-turbo="false"`, `disable_turbo`-Logic |
| `templates/partials/_navbar.html` | 137, 208 | `data-turbo="false"` |
| `templates/pages/corpus.html` | 470 | Kommentar: "avoid redeclaration with Turbo Drive" |

### JavaScript mit Turbo-Integration

| Datei | Funktion | Verwendung |
|-------|----------|------------|
| `static/js/turbo.esm.js` | Turbo Library (312 KB) | Hotwired Turbo 8.0.10 |
| `static/js/main.js` | `initTurboIntegration()` | Importiert Turbo-Handler |
| `static/js/modules/navigation/turbo-integration.js` | Event-Listener | `turbo:load`, `turbo:render`, Progress-Bar-Fixes |
| `static/js/modules/navigation/index.js` | Re-Export | Importiert `initTurboIntegration` |

### Python Backend (keine direkten Turbo-Deps)

- ✅ Backend ist Turbo-agnostisch (sendet normales HTML)
- ⚠️ `auth.py` Login-Flow nutzt 303-Redirects + `/auth/ready` Polling-Page (funktioniert, aber komplex)

---

## PLAN (DRY RUN)

### Dateien: Ändern

| Datei (alt) | Datei (neu) | Aktion | Grund |
|-------------|-------------|--------|-------|
| `templates/base.html` | `templates/base.html` | **modify** | Turbo entfernen, htmx + hx-boost + CSRF-Hook + 401-Handler hinzufügen |
| `templates/partials/_top_app_bar.html` | `templates/partials/_top_app_bar.html` | **modify** | Login-Button: `data-action="open-login"` → `hx-get="/auth/login?sheet=1"` |
| `templates/partials/_navigation_drawer.html` | `templates/partials/_navigation_drawer.html` | **modify** | Login-Buttons auf htmx umstellen, `data-turbo="false"` entfernen |
| `templates/partials/_navbar.html` | `templates/partials/_navbar.html` | **modify** | Login-Button htmx-fähig machen |
| `templates/pages/corpus.html` | `templates/pages/corpus.html` | **modify** | Turbo-Kommentar entfernen, `window.__CORAPAN__` bleibt |
| `src/app/routes/auth.py` | `src/app/routes/auth.py` | **modify** | GET `/auth/login` für htmx-Sheet, POST mit OOB-Swaps, Cache-Header |
| `src/app/__init__.py` | `src/app/__init__.py` | **modify** | After-request-Hook für Auth-Cache-Header (`/auth/*` → no-store) |
| `static/js/main.js` | `static/js/main.js` | **modify** | Turbo-Import entfernen, `setupTokenRefresh` behalten |

### Dateien: Neu erstellen

| Datei (neu) | Typ | Grund |
|-------------|-----|-------|
| `templates/auth/_login_sheet.html` | Template | htmx-Fragment für Login-Sheet (GET `/auth/login?sheet=1` liefert dies) |
| `static/vendor/htmx.min.js` | JS Library | htmx 1.9.10 (14 KB minified, von unpkg.com vendored) |
| `docs/decisions/ADR-0002-htmx-migration.md` | Docs | ADR für Architekturentscheidung |
| `docs/how-to/htmx-login-flow.md` | Docs | How-To für htmx Login-Integration |
| `docs/reference/htmx-patterns.md` | Docs | Patterns für htmx in CO.RA.PAN (OOB-Swap, 401-Handling) |

### Dateien: Löschen

| Datei | Grund |
|-------|-------|
| `static/js/turbo.esm.js` | Turbo Library nicht mehr benötigt |
| `static/js/modules/navigation/turbo-integration.js` | Turbo-Event-Handler obsolet |
| `static/js/modules/navigation/index.js` | Nur noch Re-Export für Turbo, nicht mehr nötig |

### Dateien: Archivieren (optional)

| Datei | Ziel |
|-------|------|
| `templates/partials/status_banner.html` | ⚠️ **Behalten** (enthält Login-Sheet-HTML, muss zu `_login_sheet.html` migriert werden) |

---

## LINT (Pre-Flight Checks)

### Checkliste vor APPLY

- [ ] **htmx.min.js heruntergeladen** (v1.9.10, SHA-256 validiert)
- [ ] **Turbo-Dateien identifiziert** (3 JS-Dateien, 1 CSS-Block in `base.html`)
- [ ] **Login-Sheet HTML extrahiert** (aus `status_banner.html`, umgebaut für htmx)
- [ ] **Auth-Route GET `/auth/login` geplant** (liefert Fragment bei `?sheet=1` oder `HX-Request`)
- [ ] **OOB-Swaps geplant** (Sheet löschen, Nav aktualisieren bei POST-Erfolg)
- [ ] **401-Handler geplant** (JS-Event `htmx:responseError` → Login-Sheet öffnen)
- [ ] **CSRF-Hook geplant** (`htmx:configRequest` → `X-CSRF-TOKEN` Header setzen)
- [ ] **Cache-Header geplant** (After-request-Hook: `/auth/*` → no-store, private, Vary: Cookie)
- [ ] **Tests definiert** (Login öffnen/schließen, 401-Flow, hx-boost-Navigation)

### Validierungen

| Check | Status | Details |
|-------|--------|---------|
| Keine Secrets in Docs | ✅ | Keine Credentials im Plan |
| Relative Links | ✅ | Alle Docs-Links relativ |
| Front-Matter vollständig | ⏳ | Nach APPLY-Phase aktualisieren |
| ADR-Nummer sequential | ✅ | ADR-0002 (nach ADR-0001 Docs-Reorg) |

---

## Detailed Changes

### 1) `templates/base.html`

**Entfernen:**
- `<script type="module" src="{{ url_for('static', filename='js/turbo.esm.js') }}"></script>`
- CSS-Block für `turbo-progress-bar` (Zeilen 27-42)
- Kommentare mit "Turbo" (Zeilen 7, 10, 12, 27, 46)
- `data-turbo-track="reload"` von allen `<link>`-Tags
- `data-turbo-permanent` von `#top-app-bar`, `#navigation-drawer`, `#site-footer`

**Hinzufügen:**
```html
<!-- htmx for progressive enhancement -->
<script src="{{ url_for('static', filename='vendor/htmx.min.js') }}" defer></script>

<!-- CSRF Token Hook for htmx mutations -->
<script>
  (function(){
    function getCookie(name) {
      const cookies = document.cookie.split("; ");
      const cookie = cookies.find(c => c.startsWith(name + "="));
      return cookie ? cookie.split("=")[1] : null;
    }
    document.body.addEventListener("htmx:configRequest", function(evt){
      const csrf = getCookie("csrf_access_token");
      if (csrf) {
        evt.detail.headers["X-CSRF-TOKEN"] = csrf;
      }
    });
  })();
</script>

<!-- 401 Handler: Open Login Sheet on Authentication Errors -->
<script>
  document.body.addEventListener("htmx:responseError", function(evt){
    if (evt.detail.xhr && evt.detail.xhr.status === 401) {
      // Fetch login sheet and inject into modal-root
      htmx.ajax("GET", "/auth/login?sheet=1", {
        target: "#modal-root",
        swap: "innerHTML"
      });
    }
  });

  // Open login sheet on page load if ?login=1 is present (from 401 redirect)
  (function(){
    const params = new URLSearchParams(location.search);
    if (params.get("login") === "1") {
      htmx.ajax("GET", "/auth/login?sheet=1", {
        target: "#modal-root",
        swap: "innerHTML"
      });
      // Remove ?login=1 from URL (clean history)
      history.replaceState({}, "", location.pathname + location.hash);
    }
  })();
</script>
```

**`<main>` mit hx-boost:**
```html
<main id="main-content" class="site-main" hx-boost="true">
  <div class="md3-content-wrapper">
    {% block content %}{% endblock %}
  </div>
</main>
```

**Modal-Root hinzufügen (nach `<main>`):**
```html
<!-- Modal Root for Login Sheet and other overlays -->
<div id="modal-root" aria-live="polite"></div>
```

---

### 2) `templates/auth/_login_sheet.html` (NEU)

**Vollständiger Inhalt:**
```html
<!-- Login Sheet: Rendered as htmx fragment (GET /auth/login?sheet=1) -->
<div id="login-sheet" class="md3-login-sheet" role="dialog" aria-modal="true">
  <!-- Backdrop (clickable to dismiss) -->
  <div class="md3-login-backdrop" 
       onclick="document.getElementById('login-sheet').remove()"></div>
  
  <!-- Sheet Container -->
  <div class="md3-login-sheet__container">
    <!-- Form with htmx POST -->
    <form id="login-form" 
          class="md3-login-sheet__form" 
          method="post" 
          action="{{ url_for('auth.login') }}"
          hx-post="{{ url_for('auth.login') }}"
          hx-target="#login-form"
          hx-swap="outerHTML"
          hx-indicator="#login-busy">
      
      <!-- Title with Close Button -->
      <div class="md3-login-sheet__header">
        <h2 class="md3-login-sheet__title">Iniciar sesión</h2>
        <button type="button" 
                class="md3-login-sheet__close-button" 
                onclick="document.getElementById('login-sheet').remove()" 
                aria-label="Cerrar">
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </div>
      
      <!-- Username Field -->
      <div class="md3-text-field">
        <input 
          type="text" 
          class="md3-text-field__input" 
          name="username" 
          id="login-username"
          placeholder=" "
          autocomplete="username" 
          required
          aria-label="Nombre de usuario"
        >
        <label class="md3-text-field__label" for="login-username">Cuenta</label>
      </div>
      
      <!-- Password Field -->
      <div class="md3-text-field">
        <input 
          type="password" 
          class="md3-text-field__input" 
          name="password" 
          id="login-password"
          placeholder=" "
          autocomplete="current-password" 
          required
          aria-label="Contraseña"
        >
        <label class="md3-text-field__label" for="login-password">Contraseña</label>
      </div>
      
      <!-- Loading Indicator -->
      <div id="login-busy" class="htmx-indicator">
        <span>Autenticando...</span>
      </div>
      
      <!-- Full-Width Submit Button -->
      <button type="submit" class="md3-login-sheet__button">
        <span class="material-symbols-rounded">login</span>
        <span>Entrar</span>
      </button>
    </form>
  </div>
</div>
```

---

### 3) `src/app/routes/auth.py`

**Änderungen:**

#### GET `/auth/login` (NEU)
```python
@blueprint.get("/login")
def login_sheet() -> Response:
    """
    Render login sheet fragment for htmx (GET request).
    
    - If HX-Request header present OR ?sheet=1 query param:
      → Return _login_sheet.html fragment (200)
    - Else:
      → Redirect to home with ?login=1 (opens sheet via JS)
    """
    is_htmx = request.headers.get("HX-Request") == "true"
    is_sheet_param = request.args.get("sheet") == "1"
    
    if is_htmx or is_sheet_param:
        response = make_response(render_template("auth/_login_sheet.html"))
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["Vary"] = "Cookie"
        return response
    
    # Non-htmx request: redirect to home with login=1 param
    return redirect(url_for("public.landing_page") + "?login=1", 302)
```

#### POST `/auth/login` (ÄNDERN)

**Erfolgsfall (Credentials korrekt):**
```python
# Nach Token-Generierung (Zeile ~285 im Original):

# For htmx requests: Return OOB swaps (no redirect)
is_htmx = request.headers.get("HX-Request") == "true"

if is_htmx:
    # Success: Close sheet + update nav
    from flask import render_template_string
    
    # 1) Delete login sheet via OOB swap
    sheet_delete = '<div id="login-sheet" hx-swap-oob="delete"></div>'
    
    # 2) Update nav header with user info (via OOB swap)
    nav_html = render_template("partials/_top_app_bar.html")
    nav_oob = f'<div id="top-app-bar-content" hx-swap-oob="outerHTML">{nav_html}</div>'
    
    # 3) Combine OOB swaps
    response_html = sheet_delete + nav_oob
    
    response = Response(response_html, 200, content_type="text/html")
    
    # Set cookies
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    
    # Set headers
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Vary"] = "Cookie"
    response.headers["HX-Trigger"] = json.dumps({
        "auth:login": {"user": username}
    })
    
    counter_access.increment(username, credential.role.value)
    current_app.logger.info(f'htmx login success: {username}')
    return response

# Non-htmx: Keep existing 303 redirect to /auth/ready
# (for browser fallback without JS)
```

**Fehlerfall (ungültige Credentials):**
```python
# Zeile ~260 im Original (nach "Unknown account" oder "Invalid credentials"):

is_htmx = request.headers.get("HX-Request") == "true"

if is_htmx:
    # Return form with error messages (no redirect)
    # Flash messages werden in Template angezeigt
    response = make_response(
        render_template("auth/_login_sheet.html", error=get_flashed_messages())
    )
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Vary"] = "Cookie"
    return response, 400

# Non-htmx: Keep existing redirect
```

---

### 4) `src/app/__init__.py` After-Request-Hook

**In `register_security_headers()` hinzufügen:**

```python
@app.after_request
def set_security_headers(response):
    """Set security headers on every response."""
    # ... existing CSP/HSTS headers ...
    
    # Auth-specific caching rules
    if request.path.startswith("/auth/"):
        response.headers["Cache-Control"] = "no-store, private"
        response.headers["Vary"] = "Cookie"
    
    return response
```

---

### 5) Navigation Partials

#### `templates/partials/_top_app_bar.html`

**Zeile 96 (Login-Button):**
```html
<!-- BEFORE -->
<button class="md3-icon-button" data-action="open-login">

<!-- AFTER -->
<button class="md3-icon-button" 
        hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
        hx-target="#modal-root"
        hx-swap="innerHTML">
```

**Zeile 80: `data-turbo="false"` entfernen**

#### `templates/partials/_navigation_drawer.html`

**Zeilen 109, 113, 237, 241: `data-turbo="false"` und `disable_turbo` Logic entfernen**

**Zeilen 161, 287 (Login-Buttons auf htmx umstellen):**
```html
<!-- BEFORE -->
<button data-action="open-login">Iniciar sesión</button>

<!-- AFTER -->
<button hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
        hx-target="#modal-root"
        hx-swap="innerHTML">
  Iniciar sesión
</button>
```

#### `templates/partials/_navbar.html`

**Zeile 149 (htmx-Button):**
```html
<button type="button" 
        class="md3-icon-button" 
        hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
        hx-target="#modal-root"
        hx-swap="innerHTML"
        aria-label="Iniciar sesión">
```

---

### 6) `static/js/main.js`

**Entfernen:**
```javascript
// REMOVE these lines:
import { initTurboIntegration } from './modules/navigation/turbo-integration.js';
initTurboIntegration();
```

**Behalten:**
```javascript
// KEEP:
import { setupTokenRefresh } from './modules/auth/token-refresh.js';
setupTokenRefresh();
```

---

### 7) `templates/pages/corpus.html`

**Zeile 470 (Kommentar entfernen):**
```javascript
// REMOVE:
// Use window properties to avoid "redeclaration of const" errors with Turbo Drive

// KEEP window.__CORAPAN__ (weiterhin nötig für Corpus-State)
```

---

## Testing-Strategie

### Manuelle Tests (nach APPLY)

| Test | Erwartetes Verhalten |
|------|---------------------|
| **1) Login-Sheet öffnen** | Klick auf "Iniciar sesión" Button → Sheet erscheint (GET `/auth/login?sheet=1`) |
| **2) Login-Sheet schließen** | Klick auf Backdrop oder X-Button → Sheet verschwindet (entfernt aus DOM) |
| **3) Login-Fehler** | Falsche Credentials → Fehlermeldung im Sheet, kein Redirect |
| **4) Login-Erfolg** | Korrekte Credentials → Sheet schließt, Nav aktualisiert (zeigt Avatar), keine Page-Reload |
| **5) 401 bei geschützter Route** | `/player` ohne Cookie aufrufen → 401 → Login-Sheet öffnet automatisch |
| **6) hx-boost Navigation** | Klick auf Link → Page-Content wird ersetzt, URL ändert sich, kein Full-Reload |
| **7) Browser Back/Forward** | Back-Button → vorherige Page, kein Reload-Flicker |
| **8) Cache-Header** | Network-Tab: `/auth/login` Response hat `Cache-Control: no-store, private; Vary: Cookie` |
| **9) CSRF-Token** | POST `/auth/login` Request-Header enthält `X-CSRF-TOKEN` |
| **10) Token-Refresh** | Nach Ablauf Access-Token (1h) → automatischer Refresh, keine Logout |

### Automatisierte Tests (optional, für CI)

**Playwright E2E-Test (Pseudocode):**
```python
def test_htmx_login_flow(page):
    page.goto("http://localhost:8000")
    
    # Open login sheet
    page.click('[hx-get*="auth/login"]')
    assert page.is_visible('#login-sheet')
    
    # Submit wrong credentials
    page.fill('#login-username', 'invalid')
    page.fill('#login-password', 'wrong')
    page.click('button[type="submit"]')
    assert page.is_visible('.error')  # Error message visible
    
    # Submit correct credentials
    page.fill('#login-username', 'testuser')
    page.fill('#login-password', 'correct')
    page.click('button[type="submit"]')
    
    # Sheet should close, nav should update
    assert not page.is_visible('#login-sheet')
    assert page.is_visible('[data-element="user-avatar"]')
    
    # Check cookies are set
    cookies = page.context.cookies()
    assert any(c['name'] == 'access_token_cookie' for c in cookies)
```

---

## Risiken & Mitigations

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| **hx-boost bricht Corpus-Suche** | Niedrig | Hoch | Corpus-Seite mit `hx-boost="false"` markieren falls nötig |
| **Token-Refresh bricht** | Niedrig | Mittel | `setupTokenRefresh()` ist unabhängig von Turbo, sollte funktionieren |
| **Browser ohne JS** | Niedrig | Niedrig | Fallback: Non-htmx POST-Login funktioniert weiterhin (303-Redirect) |
| **OOB-Swap schlägt fehl** | Mittel | Niedrig | Bei Fehler: Full-Page-Reload als Fallback (via `window.location.reload()`) |
| **Login-Sheet CSS fehlt** | Niedrig | Hoch | Existierende MD3-Styles in `status_banner.html` prüfen, ggf. extrahieren |

---

## Rollback-Plan

**Falls kritische Fehler nach APPLY auftreten:**

1. **Revert Git-Commit:** `git revert HEAD`
2. **Turbo-Dateien wiederherstellen:**
   - `git checkout HEAD~1 static/js/turbo.esm.js`
   - `git checkout HEAD~1 static/js/modules/navigation/turbo-integration.js`
3. **App neu starten:** `docker-compose restart web`

**Downtime:** < 5 Minuten (bei lokalem Dev-Umfeld)

---

## Zeitplan (geschätzt)

| Phase | Dauer | Tasks |
|-------|-------|-------|
| **DISCOVER** | ✅ 1h | Turbo-Referenzen gesammelt (erledigt) |
| **PLAN** | ✅ 2h | Dieser Plan erstellt (erledigt) |
| **LINT** | 30min | Checkliste abarbeiten |
| **APPLY** | 3-4h | Code-Änderungen + htmx-Download |
| **REPORT** | 1h | Unified Diffs + Dokumentation |
| **Testing** | 2h | Manuelle Tests + E2E-Tests |
| **Total** | ~9h | (1 Arbeitstag) |

---

## Nächste Schritte

1. ✅ **Team-Review dieses Plans** (Feedback einholen)
2. ⏳ **htmx.min.js herunterladen** (von unpkg.com, SHA-256 prüfen)
3. ⏳ **LINT-Checkliste abarbeiten**
4. ⏳ **APPLY-Phase starten** (Git-Branch: `feat/htmx-migration`)
5. ⏳ **Tests ausführen** (lokal + CI)
6. ⏳ **REPORT schreiben** (Unified Diffs + CHANGELOG-Eintrag)
7. ⏳ **Merge + Deployment** (nach erfolgreichem Testing)

---

## Siehe auch

- [ADR-0002: htmx Migration](../decisions/ADR-0002-htmx-migration.md) - Rationale
- [How-To: htmx Login Flow](../how-to/htmx-login-flow.md) - Implementierungsanleitung
- [Reference: htmx Patterns](../reference/htmx-patterns.md) - Patterns für CO.RA.PAN
- [CONTRIBUTING Guidelines](/CONTRIBUTING.md) - Docs-Konventionen
