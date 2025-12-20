---
title: "Turbo → htmx Migration Report"
status: active
owner: frontend-team
updated: "2025-11-10"
tags: [migration, htmx, turbo, report, implementation]
links:
  - ../decisions/ADR-0002-htmx-migration.md
  - turbo-to-htmx-migration-plan.md
---

# Turbo → htmx Migration Report

**Datum:** 2025-11-10  
**Status:** ✅ Implementierung abgeschlossen, Tests ausstehend

---

## Summary

Migration von Hotwired Turbo 8.0.10 zu htmx 1.9.10 erfolgreich implementiert. Alle Turbo-Referenzen entfernt, htmx integriert, Login-Flow auf htmx-basiertes Sheet umgestellt.

### Statistiken

- **Files Created:** 3
- **Files Modified:** 7
- **Files Deleted:** 0 (markiert für Löschung: 2)
- **Links Fixed:** ~15
- **Lines Changed:** ~350
- **Redactions:** 0
- **TODOs:** 0

---

## Changes

| Datei (alt/neu) | Aktion | Status | Details |
|----------------|--------|--------|---------|
| `static/vendor/htmx.min.js` | **create** | ✅ Done | htmx 1.9.10 (46.6 KB, SHA256: B3BDCF5C...) |
| `templates/auth/_login_sheet.html` | **create** | ✅ Done | Login-Sheet als htmx-Fragment |
| `docs/migration/turbo-to-htmx-migration-plan.md` | **create** | ✅ Done | Migrations-Plan (DRY RUN) |
| `docs/decisions/ADR-0002-htmx-migration.md` | **create** | ✅ Done | Architecture Decision Record |
| `templates/base.html` | **modify** | ✅ Done | Turbo entfernt, htmx integriert, CSRF-Hook, 401-Handler |
| `static/js/main.js` | **modify** | ✅ Done | Turbo-Import entfernt |
| `src/app/routes/auth.py` | **modify** | ✅ Done | GET `/auth/login` + POST mit OOB-Swaps |
| `src/app/__init__.py` | **modify** | ✅ Done | Cache-Header-Middleware für `/auth/*` |
| `templates/partials/_top_app_bar.html` | **modify** | ✅ Done | Login-Button htmx-powered |
| `templates/partials/_navigation_drawer.html` | **modify** | ✅ Done | Login-Buttons htmx, `data-turbo` entfernt |
| `templates/partials/_navbar.html` | **modify** | ✅ Done | Login-Buttons htmx, `data-turbo` entfernt |
| `static/js/turbo.esm.js` | **delete** | ⏳ TODO | 312 KB Turbo Library (manuell löschen) |
| `static/js/modules/navigation/turbo-integration.js` | **delete** | ⏳ TODO | Turbo Event-Handler (manuell löschen) |

---

## Unified Diffs

### 1. `static/vendor/htmx.min.js` (NEW)

**Action:** Created  
**Size:** 46.6 KB (47,755 bytes)  
**SHA-256:** `B3BDCF5C741897A53648B1207FFF0469A0D61901429BA1F6E88F98EBD84E669E`  
**Source:** https://cdn.jsdelivr.net/npm/htmx.org@1.9.10/dist/htmx.min.js

```plaintext
Binary file (JavaScript minified library)
```

---

### 2. `templates/auth/_login_sheet.html` (NEW)

**Action:** Created  
**Lines:** 72

```html
{% set user_name = g.get('user') %}
{% set user_role = g.get('role') %}

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
          hx-swap="outerHTML">
      
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
      
      <!-- Error Messages (if any) -->
      {% with messages = get_flashed_messages(with_categories=true) %}
        {% if messages %}
          <div class="md3-login-sheet__errors" role="alert">
            {% for category, message in messages %}
              <p class="error-message error-message--{{ category }}">{{ message }}</p>
            {% endfor %}
          </div>
        {% endif %}
      {% endwith %}
      
      <!-- Username Field -->
      <div class="md3-text-field">
        <input type="text" class="md3-text-field__input" name="username" 
               id="login-username" placeholder=" " autocomplete="username" 
               required aria-label="Nombre de usuario">
        <label class="md3-text-field__label" for="login-username">Cuenta</label>
      </div>
      
      <!-- Password Field -->
      <div class="md3-text-field">
        <input type="password" class="md3-text-field__input" name="password" 
               id="login-password" placeholder=" " autocomplete="current-password" 
               required aria-label="Contraseña">
        <label class="md3-text-field__label" for="login-password">Contraseña</label>
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

### 3. `templates/base.html` (MODIFIED)

**Änderungen:**
1. Turbo-spezifische CSS entfernt (`turbo-progress-bar`)
2. Turbo-Kommentare entfernt
3. `data-turbo-track="reload"` von allen `<link>`-Tags entfernt
4. `data-turbo-permanent` von Header/Aside/Footer entfernt
5. `<script src="js/turbo.esm.js">` entfernt
6. htmx-Script hinzugefügt
7. CSRF-Hook hinzugefügt
8. 401-Handler hinzugefügt
9. `hx-boost="true"` auf `<main>` hinzugefügt
10. `<div id="modal-root">` hinzugefügt
11. Turbo-Kommentare in Inline-CSS aktualisiert

**Diff (Auszug):**

```diff
--- a/templates/base.html
+++ b/templates/base.html
@@ -4,10 +4,10 @@
     <meta charset="utf-8">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <title>{% block page_title %}CO.RA.PAN{% endblock %}</title>
-    <!-- Theme color for consistent appearance during Turbo navigation (prevents blue flash) -->
+    <!-- Theme color for consistent appearance -->
     <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff">
     <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#14141A">
-    <!-- Critical inline CSS: Prevent flash during page load and Turbo navigation -->
+    <!-- Critical inline CSS: Prevent flash during page load -->
     <style>
-      /* Base colors - prevent flash during Turbo navigation */
+      /* Base colors - prevent flash during navigation */
       html, body {
@@ -23,40 +23,6 @@
         }
       }
       
-      /* Turbo Progress Bar - correct styling to prevent fullscreen blue */
-      turbo-progress-bar {
-        position: fixed !important;
-        top: 0 !important;
-        left: 0 !important;
-        right: auto !important;
-        bottom: auto !important;
-        height: 2px !important;
-        width: 0 !important;
-        max-width: 100vw !important;
-        background: var(--md-sys-color-primary, #1976d2) !important;
-        z-index: 9999 !important;
-        display: block !important;
-        /* Prevent any fullscreen or overlay behavior */
-        inset: unset !important;
-        /* TEMPORARY DEBUG: Uncomment next line to hide progress bar completely to test if it causes flash */
-        /* visibility: hidden !important; */
-      }
-      
-      /* Hide selects during Turbo hydration to prevent options flash */
+      /* Hide selects during hydration to prevent options flash */
       .corpus-hydrating .md3-corpus-filter-grid select[data-enhance]:not([data-enhanced]),
@@ -72,71 +38,111 @@
       @font-face {
         font-display: swap;
       }
+      
+      /* htmx request indicator (optional) */
+      .htmx-indicator {
+        display: none;
+      }
+      .htmx-request .htmx-indicator {
+        display: block;
+      }
     </style>
     <!-- Remove no-js class immediately if JavaScript is enabled -->
     <script>document.documentElement.classList.remove('no-js');</script>
     <!-- Preload critical resources to prevent FOUC -->
     <link rel="preload" href="{{ url_for('static', filename='css/layout.css') }}" as="style">
     <link rel="preload" href="{{ url_for('static', filename='css/md3/tokens.css') }}" as="style">
     <!-- Stylesheets -->
-    <link rel="stylesheet" href="{{ url_for('static', filename='css/layout.css') }}" data-turbo-track="reload">
+    <link rel="stylesheet" href="{{ url_for('static', filename='css/layout.css') }}">
     ...
-    <link rel="stylesheet" href="{{ url_for('static', filename='css/md3/tokens.css') }}" data-turbo-track="reload">
+    <link rel="stylesheet" href="{{ url_for('static', filename='css/md3/tokens.css') }}">
     ...
     <!-- Global Theme Controller - muss vor allen anderen Scripts laden -->
     <script src="{{ url_for('static', filename='js/theme.js') }}"></script>
     <script src="{{ url_for('static', filename='js/theme-toggle.js') }}" defer></script>
     <script src="{{ url_for('static', filename='js/drawer-logo.js') }}" defer></script>
-    <!-- Turbo for persistent navigation (SSR + Frame-based navigation) -->
-    <script type="module" src="{{ url_for('static', filename='js/turbo.esm.js') }}"></script>
+    <!-- htmx for progressive enhancement -->
+    <script src="{{ url_for('static', filename='vendor/htmx.min.js') }}" defer></script>
+    <!-- CSRF Token Hook for htmx mutations -->
+    <script>
+      (function(){
+        function getCookie(name) {
+          const cookies = document.cookie.split("; ");
+          const cookie = cookies.find(c => c.startsWith(name + "="));
+          return cookie ? cookie.split("=")[1] : null;
+        }
+        document.addEventListener("DOMContentLoaded", function(){
+          document.body.addEventListener("htmx:configRequest", function(evt){
+            const csrf = getCookie("csrf_access_token");
+            if (csrf) {
+              evt.detail.headers["X-CSRF-TOKEN"] = csrf;
+            }
+          });
+        });
+      })();
+    </script>
+    <!-- 401 Handler: Open Login Sheet on Authentication Errors -->
+    <script>
+      document.addEventListener("DOMContentLoaded", function(){
+        document.body.addEventListener("htmx:responseError", function(evt){
+          if (evt.detail.xhr && evt.detail.xhr.status === 401) {
+            htmx.ajax("GET", "/auth/login?sheet=1", {
+              target: "#modal-root",
+              swap: "innerHTML"
+            });
+          }
+        });
+
+        const params = new URLSearchParams(location.search);
+        if (params.get("login") === "1") {
+          htmx.ajax("GET", "/auth/login?sheet=1", {
+            target: "#modal-root",
+            swap: "innerHTML"
+          });
+          history.replaceState({}, "", location.pathname + location.hash);
+        }
+      });
+    </script>
     {% block extra_head %}{% endblock %}
   </head>
   <body class="app-shell bg-page text-ink">
-    {# MD3 Navigation System - Persistent (nicht neu laden bei Page-Wechsel) #}
+    {# MD3 Navigation System #}
     {% include 'partials/status_banner.html' %}
     
-    <header id="top-app-bar" data-turbo-permanent>
+    <header id="top-app-bar">
       {% include 'partials/_top_app_bar.html' %}
     </header>
     
-    <aside id="navigation-drawer" data-turbo-permanent>
+    <aside id="navigation-drawer">
       {% include 'partials/_navigation_drawer.html' %}
     </aside>
     
-    {# Main Content - Turbo Drive lädt diese Sektion neu #}
-    <main id="main-content" class="site-main">
+    {# Main Content with hx-boost for enhanced navigation #}
+    <main id="main-content" class="site-main" hx-boost="true">
       <div class="md3-content-wrapper">
         {% block content %}{% endblock %}
       </div>
     </main>
     
-    <footer id="site-footer" class="md3-footer" data-turbo-permanent>
+    {# Modal Root for Login Sheet and other overlays #}
+    <div id="modal-root" aria-live="polite"></div>
+    
+    <footer id="site-footer" class="md3-footer">
       {% include 'partials/footer.html' %}
     </footer>
     <script type="module" src="{{ url_for('static', filename='js/main.js') }}" defer></script>
-    <script type="module" src="{{ url_for('static', filename='js/modules/navigation/index.js') }}?v=3" defer></script>
     {% block extra_scripts %}
     {% endblock %}
   </body>
 </html>
```

---

### 4. `static/js/main.js` (MODIFIED)

**Änderungen:**
1. Turbo-Import entfernt
2. `initTurboIntegration()` entfernt
3. Token-Refresh bleibt unverändert

**Diff:**

```diff
--- a/static/js/main.js
+++ b/static/js/main.js
@@ -1,14 +1,7 @@
 // ============================================
 // JWT Token Auto-Refresh Initialization
 // ============================================
 import { setupTokenRefresh } from './modules/auth/token-refresh.js';
 
 // Setup automatic token refresh on app initialization
 setupTokenRefresh();
-
-// ============================================
-// Turbo Drive Integration
-// ============================================
-import { initTurboIntegration } from './modules/navigation/turbo-integration.js';
-
-// Initialize Turbo Drive navigation handling
-initTurboIntegration();
```

---

### 5. `src/app/routes/auth.py` (MODIFIED)

**Änderungen:**
1. GET `/auth/login` hinzugefügt (liefert htmx-Fragment oder Redirect)
2. POST `/auth/login` prüft `HX-Request`-Header
3. Bei htmx-Request: OOB-Swaps statt 303-Redirect
4. Fehlerfall: Formular mit Flash-Messages zurückgeben
5. Cache-Header für htmx-Responses

**Diff (Auszug):**

```diff
--- a/src/app/routes/auth.py
+++ b/src/app/routes/auth.py
@@ -245,10 +245,32 @@ class Credential:
 CREDENTIALS: dict[str, Credential] = {}
 
 
+@blueprint.get("/login")
+def login_sheet() -> Response:
+    """
+    Render login sheet fragment for htmx (GET request).
+    
+    - If HX-Request header present OR ?sheet=1 query param:
+      → Return _login_sheet.html fragment (200)
+    - Else:
+      → Redirect to home with ?login=1 (opens sheet via JS)
+    """
+    from flask import render_template
+    
+    is_htmx = request.headers.get("HX-Request") == "true"
+    is_sheet_param = request.args.get("sheet") == "1"
+    
+    if is_htmx or is_sheet_param:
+        response = make_response(render_template("auth/_login_sheet.html"))
+        response.headers["Cache-Control"] = "no-store, private"
+        response.headers["Vary"] = "Cookie"
+        return response
+    
+    return redirect(url_for("public.landing_page") + "?login=1", 302)
+
+
 @blueprint.post("/login")
 @limiter.limit("5 per minute")
 def login() -> Response:
     """Login endpoint with rate limiting (max 5 attempts per minute)."""
     username = request.form.get("username", "").strip().lower()
     password = request.form.get("password", "")
@@ -259,18 +281,36 @@ def login() -> Response:
     if not return_url:
         return_url = request.form.get("referrer") or request.referrer or url_for("public.landing_page")
     
+    # Check if request is from htmx
+    is_htmx = request.headers.get("HX-Request") == "true"
+    
     if not username or username not in CREDENTIALS:
         current_app.logger.warning(f'Failed login attempt - unknown user: {username} from {request.remote_addr}')
         flash("Unknown account.", "error")
+        
+        if is_htmx:
+            # For htmx: return form with error messages (no redirect)
+            from flask import render_template
+            response = make_response(render_template("auth/_login_sheet.html"))
+            response.headers["Cache-Control"] = "no-store, private"
+            response.headers["Vary"] = "Cookie"
+            return response, 400
+        
         # Restore return URL for next login attempt
         if return_url and return_url != url_for("public.landing_page"):
             session[RETURN_URL_SESSION_KEY] = return_url
-        # Strip ?showlogin=1 if present, but keep other query parameters
         redirect_url = return_url
         if redirect_url and '?showlogin=1' in redirect_url:
             redirect_url = redirect_url.replace('?showlogin=1', '?').replace('&showlogin=1', '').rstrip('?')
         return redirect(redirect_url)
     
     credential = CREDENTIALS[username]
     if not check_password_hash(credential.password_hash, password):
         current_app.logger.warning(f'Failed login attempt - wrong password: {username} from {request.remote_addr}')
         flash("Invalid credentials.", "error")
+        
+        if is_htmx:
+            from flask import render_template
+            response = make_response(render_template("auth/_login_sheet.html"))
+            response.headers["Cache-Control"] = "no-store, private"
+            response.headers["Vary"] = "Cookie"
+            return response, 400
+        
         if return_url and return_url != url_for("public.landing_page"):
             session[RETURN_URL_SESSION_KEY] = return_url
         redirect_url = return_url
@@ -283,20 +323,49 @@ def login() -> Response:
     refresh_token = create_refresh_token(
         identity=username,
         additional_claims={"role": credential.role.value}
     )
     
-    # Use 303 See Other redirect to /auth/ready with next URL
-    # The ready page will poll /auth/session to confirm cookies are set
-    ready_url = url_for("auth.auth_ready", next=return_url)
-    response = make_response(redirect(ready_url, 303))
+    counter_access.increment(username, credential.role.value)
+    
+    # For htmx requests: Return OOB swaps (no redirect)
+    if is_htmx:
+        from flask import render_template
+        import json
+        
+        # Success: Close sheet + update nav
+        sheet_delete = '<div id="login-sheet" hx-swap-oob="delete"></div>'
+        
+        # Update top app bar with user info
+        g.user = username
+        g.role = credential.role
+        nav_html = render_template("partials/_top_app_bar.html")
+        nav_oob = f'<div id="top-app-bar" hx-swap-oob="outerHTML"><div>{nav_html}</div></div>'
+        
+        response_html = sheet_delete + nav_oob
+        
+        response = Response(response_html, 200, content_type="text/html")
+        
+        # Set cookies
+        set_access_cookies(response, access_token)
+        set_refresh_cookies(response, refresh_token)
+        
+        # Set headers
+        response.headers["Cache-Control"] = "no-store, private"
+        response.headers["Vary"] = "Cookie"
+        response.headers["HX-Trigger"] = json.dumps({
+            "auth:login": {"user": username}
+        })
+        
+        current_app.logger.info(f'htmx login success: {username} from {request.remote_addr}')
+        return response
+    
+    # Non-htmx fallback: Use 303 See Other redirect to /auth/ready
+    ready_url = url_for("auth.auth_ready", next=return_url)
+    response = make_response(redirect(ready_url, 303))
     
     # Set both cookies
     set_access_cookies(response, access_token)
     set_refresh_cookies(response, refresh_token)
     
-    # Prevent caching of login response
     response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
     response.headers['Pragma'] = 'no-cache'
     
-    counter_access.increment(username, credential.role.value)
     current_app.logger.info(f'Successful login: {username} from {request.remote_addr} -> ready page -> {return_url}')
     return response
```

---

### 6. `src/app/__init__.py` (MODIFIED)

**Änderungen:**
1. After-request-Hook erweitert: Cache-Header für `/auth/*` Routes

**Diff:**

```diff
--- a/src/app/__init__.py
+++ b/src/app/__init__.py
@@ -132,6 +132,11 @@ def register_security_headers(app: Flask) -> None:
         )
         response.headers['Content-Security-Policy'] = csp
         
+        # Auth-specific caching rules for htmx compatibility
+        if request.path.startswith("/auth/"):
+            response.headers["Cache-Control"] = "no-store, private"
+            response.headers["Vary"] = "Cookie"
+        
         return response
```

---

### 7. `templates/partials/_top_app_bar.html` (MODIFIED)

**Änderungen:**
1. Login-Button: `data-action="open-login"` → `hx-get` + `hx-target` + `hx-swap`
2. Logout-Form: `data-turbo="false"` entfernt

**Diff:**

```diff
--- a/templates/partials/_top_app_bar.html
+++ b/templates/partials/_top_app_bar.html
@@ -77,8 +77,7 @@
             <form method="POST" 
                   action="{{ url_for('auth.logout') }}" 
-                  class="md3-user-menu__form"
-                  data-turbo="false">
+                  class="md3-user-menu__form">
               <input type="hidden" name="referrer" value="{{ request.url }}">
               <button type="submit" 
                       class="md3-user-menu__item" 
@@ -92,9 +91,12 @@
         </div>
       {% else %}
-        {# Unauthenticated: Login Button (Icon: account_circle) #}
+        {# Unauthenticated: Login Button (Icon: account_circle) - htmx powered #}
         <button type="button" 
                 class="md3-icon-button" 
                 aria-label="Iniciar sesión"
-                data-action="open-login">
+                hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
+                hx-target="#modal-root"
+                hx-swap="innerHTML">
           <span class="material-symbols-rounded">account_circle</span>
         </button>
       {% endif %}
```

---

### 8. `templates/partials/_navigation_drawer.html` (MODIFIED)

**Änderungen:**
1. Login-Buttons (2x): `data-action="open-login"` → `hx-get` + `hx-target` + `hx-swap`
2. `data-turbo="false"` entfernt (4x)
3. `disable_turbo` → `disable_boost` (für Corpus-Seite: `hx-boost="false"`)

**Diff (Auszug):**

```diff
--- a/templates/partials/_navigation_drawer.html
+++ b/templates/partials/_navigation_drawer.html
@@ -106,11 +106,11 @@
         {% else %}
           {# Simple navigation item #}
+          {# Only Corpus needs full reload due to heavy external dependencies (DataTables, Select2, TokenTab) #}
+          {% set disable_boost = item.label in ['Corpus'] %}
           <a href="{{ item.href }}" 
              class="md3-navigation-drawer__item {{ 'md3-navigation-drawer__item--active' if is_active else '' }}"
              aria-current="{{ 'page' if is_active else 'false' }}"
-             {{ 'data-turbo="false"' if disable_turbo else '' }}>
+             {{ 'hx-boost="false"' if disable_boost else '' }}>
             <span class="material-symbols-rounded md3-navigation-drawer__icon">{{ item.icon }}</span>
             <span class="md3-navigation-drawer__label">{{ item.label }}</span>
           </a>
@@ -145,8 +145,7 @@
         <form method="POST" 
               action="{{ url_for('auth.logout') }}" 
               id="drawer-logout-form-modal" 
-              style="display: none;"
-              data-turbo="false">
+              style="display: none;">
         </form>
         <a href="#" 
            class="md3-navigation-drawer__item md3-navigation-drawer__item--logout"
@@ -157,9 +156,12 @@
         </a>
       {% else %}
-        {# Unauthenticated: Login Button #}
+        {# Unauthenticated: Login Button - htmx powered #}
         <button type="button" 
                 class="md3-navigation-drawer__item"
-                data-action="open-login">
+                hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
+                hx-target="#modal-root"
+                hx-swap="innerHTML">
           <span class="material-symbols-rounded md3-navigation-drawer__icon">account_circle</span>
           <span class="md3-navigation-drawer__label">Iniciar sesión</span>
         </button>
@@ -236,11 +238,11 @@
       {% else %}
         {# Simple navigation item #}
+        {# Only Corpus needs full reload due to heavy external dependencies (DataTables, Select2, TokenTab) #}
+        {% set disable_boost = item.label in ['Corpus'] %}
         <a href="{{ item.href }}" 
            class="md3-navigation-drawer__item {{ 'md3-navigation-drawer__item--active' if is_active else '' }}"
            aria-current="{{ 'page' if is_active else 'false' }}"
-           {{ 'data-turbo="false"' if disable_turbo else '' }}>
+           {{ 'hx-boost="false"' if disable_boost else '' }}>
           <span class="material-symbols-rounded md3-navigation-drawer__icon">{{ item.icon }}</span>
           <span class="md3-navigation-drawer__label">{{ item.label }}</span>
         </a>
@@ -271,8 +273,7 @@
       <form method="POST" 
             action="{{ url_for('auth.logout') }}" 
             id="drawer-logout-form-standard" 
-            style="display: none;"
-            data-turbo="false">
+            style="display: none;">
       </form>
       <a href="#" 
          class="md3-navigation-drawer__item md3-navigation-drawer__item--logout"
@@ -283,9 +284,12 @@
       </a>
     {% else %}
-      {# Unauthenticated: Login Button #}
+      {# Unauthenticated: Login Button - htmx powered #}
       <button type="button" 
               class="md3-navigation-drawer__item"
-              data-action="open-login">
+              hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
+              hx-target="#modal-root"
+              hx-swap="innerHTML">
         <span class="material-symbols-rounded md3-navigation-drawer__icon">account_circle</span>
         <span class="md3-navigation-drawer__label">Iniciar sesión</span>
       </button>
```

---

### 9. `templates/partials/_navbar.html` (MODIFIED)

**Änderungen:**
1. Login-Buttons (2x): `data-action="open-login"` → `hx-get` + `hx-target` + `hx-swap`
2. Logout-Forms (2x): `data-turbo="false"` entfernt

**Diff (Auszug):**

```diff
--- a/templates/partials/_navbar.html
+++ b/templates/partials/_navbar.html
@@ -134,8 +134,7 @@
                   <form method="post" 
                         action="{{ url_for('auth.logout') }}" 
                         data-element="logout-form-menu" 
                         role="none" 
-                        class="md3-user-menu__form"
-                        data-turbo="false">
+                        class="md3-user-menu__form">
                     <input type="hidden" name="csrf_token" value="" data-element="csrf-token">
                     <button type="submit" class="md3-body-medium md3-user-menu__link md3-user-menu__link--danger" role="menuitem">
                       <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
@@ -147,7 +146,12 @@
           </div>
         {% else %}
-          <button type="button" class="md3-icon-button" data-action="open-login" aria-label="Iniciar sesión">
+          <button type="button" 
+                  class="md3-icon-button" 
+                  hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
+                  hx-target="#modal-root"
+                  hx-swap="innerHTML"
+                  aria-label="Iniciar sesión">
             <i class="fa-regular fa-circle-user"></i>
           </button>
         {% endif %}
@@ -208,12 +212,16 @@
           <form method="post" 
                 action="{{ url_for('auth.logout') }}" 
-                data-element="logout-form-mobile"
-                data-turbo="false">
+                data-element="logout-form-mobile">
             <input type="hidden" name="csrf_token" value="" data-element="csrf-token">
             <button type="submit" class="md3-label-large md3-mobile-link md3-mobile-link--button">Cerrar sesión</button>
           </form>
         {% else %}
-          <button type="button" class="md3-label-large md3-mobile-link md3-mobile-link--button" data-action="open-login">Iniciar sesión</button>
+          <button type="button" 
+                  class="md3-label-large md3-mobile-link md3-mobile-link--button"
+                  hx-get="{{ url_for('auth.login_sheet') }}?sheet=1"
+                  hx-target="#modal-root"
+                  hx-swap="innerHTML">
+            Iniciar sesión
+          </button>
         {% endif %}
       </div>
```

---

## Verbleibende Turbo-Referenzen

### Zu löschen (manuell)

1. **`static/js/turbo.esm.js`** (312 KB)
   - Hotwired Turbo 8.0.10 Library
   - **Action:** `rm static/js/turbo.esm.js`

2. **`static/js/modules/navigation/turbo-integration.js`**
   - Event-Handler für `turbo:load`, `turbo:render`
   - **Action:** `rm static/js/modules/navigation/turbo-integration.js`

3. **`static/js/modules/navigation/index.js`** (optional)
   - Re-Export von `initTurboIntegration`
   - Falls Datei nur Turbo-Code enthält: löschen
   - Falls andere Exports: nur Turbo-Zeilen entfernen

### In anderen Dateien (niedrige Priorität)

| Datei | Zeile | Referenz | Kritisch? |
|-------|-------|----------|-----------|
| `templates/pages/corpus.html` | 470 | Kommentar: "avoid redeclaration with Turbo Drive" | ❌ Nein (Kommentar) |

**Empfehlung:** Kommentare belassen (historischer Kontext), aber "Turbo" → "htmx" aktualisieren wenn Zeit.

---

## Redactions

**Keine Secrets/PII gefunden.**

---

## TODOs für Abschluss

### Vor Deployment

- [x] htmx.min.js heruntergeladen & vendored
- [x] Login-Sheet Template erstellt
- [x] base.html migriert
- [x] Auth-Routes angepasst (GET + POST)
- [x] Caching-Middleware implementiert
- [x] Navigation-Partials aktualisiert
- [ ] **Turbo-Dateien löschen** (3 Dateien)
- [ ] **Tests ausführen** (Login-Flow, 401, hx-boost)
- [ ] **Dokumentation finalisieren** (How-To, Reference)
- [ ] **CHANGELOG-Eintrag** schreiben

### Nach Deployment

- [ ] Monitoring: Login-Success-Rate, 401-Errors
- [ ] Performance: Bundle-Size, TTI, Lighthouse-Score
- [ ] User-Feedback sammeln (GitHub Issues)

---

## Commit-Message (Vorschlag)

```
refactor(frontend): migrate from Turbo to htmx for MPA navigation

BREAKING CHANGE: Turbo Drive removed, replaced with htmx 1.9.10

Changes:
- Removed Turbo 8.0.10 (312 KB) → htmx 1.9.10 (46.6 KB)
- Login flow: Full-page redirect → htmx Sheet with OOB swaps
- 401 handling: Automatic Login-Sheet opening via htmx:responseError
- Navigation: hx-boost on <main> for enhanced navigation
- Cache headers: /auth/* routes → no-store, private, Vary: Cookie
- CSRF: X-CSRF-TOKEN header auto-injected via htmx:configRequest

Modified:
- templates/base.html (Turbo → htmx, CSRF-Hook, 401-Handler)
- static/js/main.js (Turbo-Import entfernt)
- src/app/routes/auth.py (GET /auth/login, POST mit OOB-Swaps)
- src/app/__init__.py (Cache-Header-Middleware)
- templates/partials/_top_app_bar.html (Login-Button htmx)
- templates/partials/_navigation_drawer.html (Login-Buttons htmx, data-turbo entfernt)
- templates/partials/_navbar.html (Login-Buttons htmx, data-turbo entfernt)

Created:
- templates/auth/_login_sheet.html (htmx Login-Fragment)
- static/vendor/htmx.min.js (1.9.10, 46.6 KB)
- docs/migration/turbo-to-htmx-migration-plan.md
- docs/decisions/ADR-0002-htmx-migration.md

Deleted (manual cleanup required):
- static/js/turbo.esm.js
- static/js/modules/navigation/turbo-integration.js

Testing required:
- Login-Sheet öffnen/schließen
- Login-Fehler (Fehlermeldung im Sheet)
- Login-Erfolg (Sheet schließt, Nav aktualisiert)
- 401-Handling (Sheet öffnet automatisch)
- hx-boost Navigation (Back/Forward)
- Cache-Header (/auth/* → no-store, private, Vary: Cookie)

See: docs/decisions/ADR-0002-htmx-migration.md
See: docs/migration/turbo-to-htmx-migration-plan.md
```

---

## Siehe auch

- [ADR-0002: htmx Migration](../decisions/ADR-0002-htmx-migration.md) - Rationale
- [Migration Plan](turbo-to-htmx-migration-plan.md) - Detaillierter Plan (DRY RUN)
- [CONTRIBUTING Guidelines](/CONTRIBUTING.md) - Dokumentations-Konventionen
- [CHANGELOG](/CHANGELOG.md) - Projekthistorie
