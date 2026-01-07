# Auth Debug Instrumentation & 401 Root Cause Analysis

**Datum:** 2026-01-07  
**Phase:** Debug-Instrumentation (nach JSON.parse Fix)  
**Ziel:** Echte 401-Ursache diagnostizieren, nicht nur Symptome beheben

---

## Änderungen Übersicht

### 1. Response Handler Verbesserungen (JS)

#### a) 204 No Content Support

**Problem:** Einige API-Endpoints können 204 No Content zurückgeben (z.B. DELETE), was zu `response.json()` Fehler führt.

**Lösung:** Explizite Behandlung von 204 Status:

```javascript
// static/js/admin/quiz_content.js + static/js/auth/admin_users.js
async _handleResponse(response) {
  // Handle 204 No Content (successful empty response)
  if (response.status === 204) {
    return { ok: true };
  }
  
  // ... rest of error handling
}
```

#### b) Debug-Logging für 401-Diagnose

**Hinzugefügt:** Response body preview (limitiert 500 chars) bei non-JSON Antworten:

```javascript
if (!response.ok) {
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    // Debug: Log first 500 chars of response for diagnosis
    try {
      const text = await response.text();
      const preview = text.substring(0, 500);
      console.error(`[Auth Debug] HTTP ${response.status} non-JSON response preview:`, preview);
    } catch (e) {
      console.error(`[Auth Debug] HTTP ${response.status} - could not read response body`);
    }
    throw new Error(`HTTP ${response.status}: Server returned non-JSON response (likely authentication redirect)`);
  }
}
```

**Nutzen:**
- Bei 401 HTML-Redirect sieht man im Browser Console die ersten 500 Zeichen
- Hilft zu erkennen: Ist es Login-Redirect? Nginx-Fehler? Andere HTML-Seite?
- **Keine sensitiven Daten** geloggt (nur HTML-Structure, keine Tokens)

---

### 2. Server-seitige 401-Instrumentierung (Python)

#### a) JWT unauthorized_loader Instrumentation

**Datei:** `src/app/extensions/__init__.py`

**Hinzugefügt:** Sichere 401-Logging (nur in DEBUG-Modus):

```python
@jwt.unauthorized_loader
def unauthorized_callback(error_string):
    """Handle requests without JWT token to @jwt_required() endpoints."""
    
    # DEBUG: Log 401s for quiz-admin API routes (safe instrumentation)
    if app.debug and request.path.startswith("/quiz-admin/api/"):
        app.logger.warning(
            "[401 Auth Debug] Unauthorized request to %s %s | "
            "has_jwt_cookie=%s | has_auth_header=%s | error=%s",
            request.method,
            request.path,
            "jwt_access_token" in request.cookies,
            "Authorization" in request.headers,
            error_string
        )
    
    # ... existing error handling
```

**Was wird geloggt:**
- ✅ HTTP Method (POST, PATCH, etc.)
- ✅ Request Path (z.B. `/quiz-admin/api/releases/123/import`)
- ✅ **Boolean:** Hat Request jwt_access_token Cookie?
- ✅ **Boolean:** Hat Request Authorization Header?
- ✅ Error-String von flask-jwt-extended
- ❌ **KEINE** Token-Werte (nur Booleans!)

**Beispiel-Log:**
```
[401 Auth Debug] Unauthorized request to POST /quiz-admin/api/releases/test_release_001/import | 
has_jwt_cookie=False | has_auth_header=False | error=Missing JWT
```

#### b) Role Decorator Instrumentation

**Datei:** `src/app/auth/decorators.py`

**Hinzugefügt:** Logging bei role-basierten 401/403 Errors:

```python
def require_role(min_role: Role) -> Callable[[F], F]:
    """Ensure the current user has at least the given role."""
    
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            role = getattr(g, "role", None)
            user_id = getattr(g, "user_id", None)
            
            # DEBUG: Log role-based 401s for quiz-admin routes
            if current_app.debug and request.path.startswith("/quiz-admin/api/"):
                if role not in ROLE_ORDER:
                    current_app.logger.warning(
                        "[401 Role Debug] Invalid role on %s %s | "
                        "user_id=%s | role=%s | required=%s",
                        request.method,
                        request.path,
                        user_id,
                        role,
                        min_role
                    )
                elif ROLE_ORDER.index(role) > ROLE_ORDER.index(min_role):
                    current_app.logger.warning(
                        "[403 Role Debug] Insufficient permissions on %s %s | "
                        "user_id=%s | role=%s | required=%s",
                        request.method,
                        request.path,
                        user_id,
                        role,
                        min_role
                    )
            
            # ... existing authorization logic
```

**Was wird geloggt:**
- ✅ User-ID (UUID, keine persönlichen Daten)
- ✅ Aktuelle Role (z.B. "user", "admin")
- ✅ Erforderliche Role
- ✅ Unterscheidung 401 (keine gültige Role) vs 403 (zu niedrige Role)

**Beispiel-Logs:**
```
# Fall 1: JWT vorhanden, aber Role ist "user" (sollte "admin" sein)
[403 Role Debug] Insufficient permissions on POST /quiz-admin/api/releases/test/import | 
user_id=f02b5633-9831-4aa2-927e-3c45e244ef90 | role=user | required=admin

# Fall 2: JWT vorhanden, aber Role ist None (korrupt/ungültig)
[401 Role Debug] Invalid role on POST /quiz-admin/api/releases/test/import | 
user_id=f02b5633-9831-4aa2-927e-3c45e244ef90 | role=None | required=admin
```

**Sicherheit:**
- Nur in `app.debug` aktiv (Production: debug=False → KEIN Logging)
- User-ID ist UUID (keine Email, Username, etc.)
- Keine Token-Werte, keine Passwörter
- Nur für `/quiz-admin/api/*` (nicht für alle Requests)

---

### 3. Integration-Test für Authenticated Import

**Datei:** `tests/test_quiz_admin.py`

**Neue Test-Klasse:** `TestReleaseImportAuth`

```python
class TestReleaseImportAuth:
    """Test authenticated release import endpoint."""

    def test_import_requires_admin_auth(self, admin_client):
        """Import endpoint requires admin authentication."""
        response = admin_client.post(
            "/quiz-admin/api/releases/test_release_001/import",
            headers={"Accept": "application/json"}
        )
        assert response.status_code == 401
        data = response.get_json()
        assert data["error"] == "unauthorized"

    def test_import_requires_admin_role(self, admin_client, user_token):
        """Import endpoint requires admin role."""
        response = admin_client.post(
            "/quiz-admin/api/releases/test_release_001/import",
            headers={
                "Authorization": f"Bearer {user_token}",
                "Accept": "application/json"
            }
        )
        assert response.status_code == 403

    def test_import_with_valid_admin_token(self, admin_client, admin_token, seeded_releases):
        """Import with valid admin token should succeed (or return non-auth error)."""
        response = admin_client.post(
            "/quiz-admin/api/releases/test_release_001/import",
            headers={
                "Authorization": f"Bearer {admin_token}",
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        )
        
        # Should NOT be 401 (unauthorized) or 403 (forbidden)
        assert response.status_code not in [401, 403]

    def test_import_with_cookie_auth(self, admin_client, admin_token, seeded_releases):
        """Import with JWT cookie should work (same-origin credentials)."""
        admin_client.set_cookie(
            server_name="localhost",
            key="jwt_access_token",
            value=admin_token
        )
        
        response = admin_client.post(
            "/quiz-admin/api/releases/test_release_001/import",
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        )
        
        # Should NOT be 401/403
        assert response.status_code not in [401, 403]
```

**Was wird getestet:**
1. ✅ Ohne Auth → 401
2. ✅ Mit User-Role (nicht Admin) → 403
3. ✅ Mit Admin-Token (Bearer Header) → KEIN 401/403
4. ✅ Mit Admin-Token (Cookie) → KEIN 401/403 (simuliert Browser-Verhalten)

---

## Nutzung der Debug-Instrumentation

### Lokale Entwicklung

#### 1. Debug-Modus aktivieren

```bash
# In .env oder Export
export FLASK_ENV=development
export FLASK_DEBUG=1

# Flask starten
python manage.py run
```

#### 2. 401-Fehler reproduzieren

**Im Browser:**
1. DevTools → Console öffnen
2. Login als Admin durchführen
3. Quiz Admin Dashboard öffnen
4. Release Import durchführen

**Falls 401 auftritt, sehen Sie:**

**In Browser Console:**
```
[Auth Debug] HTTP 401 non-JSON response preview: <!DOCTYPE html>
<html>
<head><title>Login Required</title></head>
<body>
<h1>Please log in to access this resource</h1>
...
```

**In Flask Logs (Terminal):**
```
WARNING [401 Auth Debug] Unauthorized request to POST /quiz-admin/api/releases/test_release_001/import | 
has_jwt_cookie=False | has_auth_header=False | error=Missing JWT
```

**Oder bei Role-Problem:**
```
WARNING [403 Role Debug] Insufficient permissions on POST /quiz-admin/api/releases/test_release_001/import | 
user_id=abc123 | role=user | required=admin
```

#### 3. Diagnose

**Szenario A: `has_jwt_cookie=False`**
- **Problem:** Cookie wird nicht gesendet
- **Mögliche Ursachen:**
  - `credentials: 'same-origin'` fehlt im fetch()
  - Cookie expired/invalid
  - Domain/Path mismatch (Cookie auf *.com, Request zu localhost)
  - Browser blockiert Third-Party Cookies

**Szenario B: `has_jwt_cookie=True` aber trotzdem 401**
- **Problem:** JWT ist vorhanden aber ungültig
- **Mögliche Ursachen:**
  - JWT ist expired (TTL abgelaufen)
  - JWT Signature invalid (SECRET_KEY geändert?)
  - JWT Format korrupt

**Szenario C: Keine 401, aber 403 mit `role=user`**
- **Problem:** User ist authentifiziert, aber nicht Admin
- **Lösung:** User-Role in DB auf "admin" setzen

**Szenario D: 403 mit `role=None`**
- **Problem:** JWT hat keine Role oder Role ist invalid
- **Mögliche Ursachen:**
  - JWT wurde erstellt ohne `role` Claim
  - Role-Value ist nicht in ROLE_ORDER (z.B. Typo: "admim")

### Prod-Diagnose

**Production läuft OHNE Debug-Logging** (app.debug=False für Security).

**Wenn 401 in Prod reproduziert werden muss:**

1. **TEMP:** Debug-Modus in prod aktivieren (NUR für kurze Diagnose!):
   ```bash
   # In /srv/webapps/games_hispanistica/config/passwords.env
   FLASK_ENV=production
   FLASK_DEBUG=1  # TEMPORÄR!
   
   # Container neu starten
   docker restart games-webapp
   ```

2. **Logs live verfolgen:**
   ```bash
   docker logs -f games-webapp | grep "\[401\|403"
   ```

3. **Import reproduzieren** (als Admin im Browser)

4. **Debug-Modus SOFORT deaktivieren:**
   ```bash
   # passwords.env
   FLASK_DEBUG=0
   
   docker restart games-webapp
   ```

**Wichtig:** Debug-Logging sollte NIEMALS dauerhaft in Production laufen (Security + Performance).

---

## Tests ausführen

```bash
# Alle Quiz-Admin-Tests
pytest tests/test_quiz_admin.py -v

# Nur Auth-Tests
pytest tests/test_quiz_admin.py::TestReleaseImportAuth -v

# Einzelner Test
pytest tests/test_quiz_admin.py::TestReleaseImportAuth::test_import_with_cookie_auth -v
```

**Erwartete Ausgabe:**
```
tests/test_quiz_admin.py::TestReleaseImportAuth::test_import_requires_admin_auth PASSED
tests/test_quiz_admin.py::TestReleaseImportAuth::test_import_requires_admin_role PASSED
tests/test_quiz_admin.py::TestReleaseImportAuth::test_import_with_valid_admin_token PASSED
tests/test_quiz_admin.py::TestReleaseImportAuth::test_import_with_cookie_auth PASSED
```

---

## Geänderte Dateien

### JavaScript (Client-Side)
1. `static/js/admin/quiz_content.js`
   - `_handleResponse()`: 204 Support + Debug-Logging
2. `static/js/auth/admin_users.js`
   - `handleJsonResponse()`: 204 Support + Debug-Logging

### Python (Server-Side)
3. `src/app/extensions/__init__.py`
   - `unauthorized_loader()`: 401 Debug-Logging (nur in DEBUG)
4. `src/app/auth/decorators.py`
   - `require_role()`: 401/403 Debug-Logging (nur in DEBUG)

### Tests
5. `tests/test_quiz_admin.py`
   - Neue Klasse: `TestReleaseImportAuth` (4 Tests)

---

## Nächste Schritte (nach Diagnose)

**Wenn echte 401-Ursache gefunden:**

1. **Cookie-Problem:**
   - Prüfe Cookie-Settings (Secure, SameSite, Domain, Path)
   - Prüfe Browser-DevTools → Application → Cookies

2. **JWT-Expiry:**
   - Erhöhe JWT_ACCESS_TOKEN_EXPIRES (z.B. von 15min auf 1h)
   - Implementiere Auto-Refresh-Logik

3. **Role-Problem:**
   - Prüfe User-Role in DB (`SELECT role FROM users WHERE username='admin'`)
   - Prüfe JWT-Creation (enthält JWT-Token `role` Claim?)

4. **ProxyFix/Headers:**
   - Bereits korrekt konfiguriert (siehe `server_admin_config.md`)
   - Falls Custom-Header nötig: Nginx-Config + ProxyFix erweitern

---

## Commit Message

```
feat: Add 401 auth debug instrumentation + 204 response handling

Changes:
- JS: Add 204 No Content support in response handlers
- JS: Add debug logging for non-JSON responses (limited 500 chars)
- Python: Add safe 401/403 logging for /quiz-admin/api/* (DEBUG only)
  - Log: method, path, has_cookie (bool), has_auth_header (bool), user_id, role
  - No token values logged (security)
- Tests: Add TestReleaseImportAuth with 4 test cases
  - Test auth requirement, role requirement, bearer token, cookie auth

Purpose: Diagnose root cause of 401 errors (not just JSON.parse symptoms)

Related: AUTH_FIX_401_FETCH.md
```

---

**Status:** Ready for commit and testing  
**Production-Safety:** Debug-Logging nur in DEBUG-Modus (app.debug=True)
