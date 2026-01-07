# CSRF Token Fix: 401 bei mutating Requests

**Datum:** 2026-01-07  
**Problem:** Trotz gültigem JWT Cookie 401 bei POST/PATCH/DELETE  
**Root Cause:** X-CSRF-TOKEN Header fehlt in Quiz Admin Requests

---

## Problem-Analyse

### Symptom

- ✅ Browser sendet `jwt_access_token` Cookie korrekt
- ✅ Browser sendet `csrf_access_token` Cookie korrekt
- ❌ Request-Headers enthalten **KEIN** `X-CSRF-TOKEN`
- ❌ Server antwortet mit 401 Unauthorized

**Betroffene Endpoints:**
- POST `/quiz-admin/api/releases/{id}/import`
- POST `/quiz-admin/api/releases/{id}/publish`
- POST `/quiz-admin/api/releases/{id}/unpublish`
- PATCH `/quiz-admin/api/units`
- DELETE `/quiz-admin/api/units/{slug}`
- POST `/quiz-admin/api/upload-unit`

### Root Cause

**flask-jwt-extended mit JWT-in-Cookies + CSRF-Protection:**

```python
# src/app/__init__.py (Production Config)
app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
app.config["JWT_COOKIE_CSRF_PROTECT"] = True  # ← Aktiviert Double Submit
```

**Double Submit Cookie Pattern:**
1. Server setzt 2 Cookies: `jwt_access_token` (HttpOnly) + `csrf_access_token` (readable)
2. Client MUSS für mutating Requests (POST/PATCH/PUT/DELETE):
   - Cookie `jwt_access_token` senden (automatisch via `credentials: 'same-origin'`) ✅
   - Header `X-CSRF-TOKEN` mit Wert von `csrf_access_token` Cookie senden ❌ **FEHLTE!**

**Warum admin_users.js funktionierte:**
- Hatte bereits `getCsrfToken()` Helper
- Nutzte `X-CSRF-TOKEN` in allen Requests

**Warum quiz_content.js NICHT funktionierte:**
- Kein CSRF-Token in Requests
- Server lehnte alle mutating Requests ab → 401

---

## Lösung

### 1. CSRF-Token Helper (quiz_content.js)

**Hinzugefügt:**

```javascript
/**
 * Get CSRF token from cookie.
 * Required for POST/PATCH/PUT/DELETE requests with JWT-in-cookies.
 */
function getCsrfToken() {
  const match = document.cookie.match(/csrf_access_token=([^;]+)/);
  return match ? match[1] : '';
}
```

### 2. X-CSRF-TOKEN Header zu allen mutating Requests

#### POST Requests

```javascript
// VORHER - FEHLER
async post(endpoint, data = {}) {
  const response = await fetch(`${this.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // ❌ Kein X-CSRF-TOKEN!
    },
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });
  return this._handleResponse(response);
}

// NACHHER - KORREKT
async post(endpoint, data = {}) {
  const response = await fetch(`${this.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-TOKEN': getCsrfToken(),  // ✅ CSRF-Token hinzugefügt
    },
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });
  return this._handleResponse(response);
}
```

#### PATCH Requests

```javascript
async patch(endpoint, data = {}) {
  const response = await fetch(`${this.baseUrl}${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-TOKEN': getCsrfToken(),  // ✅
    },
    credentials: 'same-origin',
    body: JSON.stringify(data),
  });
  return this._handleResponse(response);
}
```

#### DELETE Requests

```javascript
async delete(endpoint) {
  const response = await fetch(`${this.baseUrl}${endpoint}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      'X-CSRF-TOKEN': getCsrfToken(),  // ✅
    },
    credentials: 'same-origin',
  });
  return this._handleResponse(response);
}
```

#### FormData Upload (Spezialfall)

```javascript
async upload(formData) {
  const response = await fetch(`${this.baseUrl}/upload-unit`, {
    method: 'POST',
    headers: {
      'X-CSRF-TOKEN': getCsrfToken(),  // ✅
      // NOTE: Do NOT set Content-Type for FormData - browser sets it with boundary
    },
    credentials: 'same-origin',
    body: formData,
  });
  return this._handleResponse(response);
}
```

**Wichtig bei FormData:**
- ✅ **X-CSRF-TOKEN setzen**
- ❌ **Content-Type NICHT setzen** → Browser setzt automatisch `multipart/form-data; boundary=...`

---

## Tests

### Neue Test-Klasse: `TestCSRFProtection`

**4 Tests hinzugefügt:**

```python
class TestCSRFProtection:
    """Test CSRF token requirement for mutating requests with JWT-in-cookies."""

    @pytest.fixture
    def csrf_app(self):
        """Flask app with JWT_COOKIE_CSRF_PROTECT = True."""
        # ... config mit CSRF-Protection aktiviert
        app.config["JWT_COOKIE_CSRF_PROTECT"] = True

    def test_patch_units_without_csrf_fails(self, csrf_client, admin_csrf_tokens, seeded_units):
        """PATCH ohne X-CSRF-TOKEN → 401."""
        # JWT Cookie gesetzt, aber KEIN X-CSRF-TOKEN Header
        response = csrf_client.patch("/quiz-admin/api/units", json=...)
        assert response.status_code == 401

    def test_patch_units_with_csrf_succeeds(self, csrf_client, admin_csrf_tokens, seeded_units):
        """PATCH mit X-CSRF-TOKEN → 200."""
        # JWT Cookie + X-CSRF-TOKEN Header
        response = csrf_client.patch(
            "/quiz-admin/api/units",
            json=...,
            headers={"X-CSRF-TOKEN": admin_csrf_tokens["csrf_token"]}
        )
        assert response.status_code == 200

    def test_post_import_without_csrf_fails(self, csrf_client, admin_csrf_tokens, seeded_releases):
        """POST import ohne CSRF → 401."""
        assert response.status_code == 401

    def test_post_import_with_csrf_succeeds(self, csrf_client, admin_csrf_tokens, seeded_releases):
        """POST import mit CSRF → nicht 401 (darf 404/500 sein für fehlende Files)."""
        assert response.status_code != 401
```

**Test ausführen:**

```bash
# Alle CSRF-Tests
pytest tests/test_quiz_admin.py::TestCSRFProtection -v

# Einzelner Test
pytest tests/test_quiz_admin.py::TestCSRFProtection::test_patch_units_with_csrf_succeeds -v
```

**Erwartete Ausgabe:**
```
test_patch_units_without_csrf_fails PASSED
test_patch_units_with_csrf_succeeds PASSED
test_post_import_without_csrf_fails PASSED
test_post_import_with_csrf_succeeds PASSED
```

---

## Verifikation

### Lokale Entwicklung

#### 1. Server starten

```bash
# In .env oder Export
export FLASK_ENV=development
export JWT_COOKIE_CSRF_PROTECT=True  # CSRF aktivieren

python manage.py run
```

#### 2. Browser DevTools

```
1. Login als Admin: http://localhost:5000/auth/login
2. Quiz Admin öffnen: http://localhost:5000/quiz-admin/
3. DevTools → Network Tab öffnen
4. Release Import durchführen

Erwartete Request-Headers:
  Cookie: jwt_access_token=...; csrf_access_token=...
  X-CSRF-TOKEN: <csrf_access_token value>

Erwartete Response:
  Status: 200 OK (nicht 401!)
```

#### 3. Console-Test (manuell)

```javascript
// Browser Console
// 1. CSRF-Token lesen
function getCsrfToken() {
  const match = document.cookie.match(/csrf_access_token=([^;]+)/);
  return match ? match[1] : '';
}
console.log('CSRF Token:', getCsrfToken());

// 2. Request mit CSRF testen
fetch('/quiz-admin/api/units', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-TOKEN': getCsrfToken()
  },
  credentials: 'same-origin',
  body: JSON.stringify({updates: []})
})
.then(r => console.log('Status:', r.status))
// Erwartete Ausgabe: Status: 200
```

### Production

#### 1. Deployment

```bash
# Auf vhrz2184:
cd /srv/webapps/games_hispanistica/app
git pull origin main
bash scripts/deploy/deploy_prod.sh
```

#### 2. Browser-Test

```
1. https://games.hispanistica.com/auth/login → Anmelden als Admin
2. https://games.hispanistica.com/quiz-admin/ öffnen
3. DevTools → Network → Preserve log aktivieren

4. Release Import durchführen:
   - Release auswählen
   - "Import (Draft)" klicken
   - Network Tab prüfen:

POST /quiz-admin/api/releases/.../import
Request Headers:
  Cookie: jwt_access_token=...; csrf_access_token=...
  X-CSRF-TOKEN: eyJ0eXAiOiJKV1QiLCJh...  ← MUSS vorhanden sein!
  Content-Type: application/json

Response:
  Status: 200 OK
  Body: {"ok": true, "units_imported": 10, ...}

5. Units PATCH testen:
   - Checkbox in Units-Tabelle ändern
   - "Änderungen speichern" klicken

PATCH /quiz-admin/api/units
Request Headers:
  X-CSRF-TOKEN: ...  ← MUSS vorhanden sein!
Response:
  Status: 200 OK
  Body: {"ok": true, "updated_count": 1}
```

#### 3. Smoke Test (curl)

**NICHT möglich mit curl** (CSRF-Token aus Cookie lesen ist Browser-Feature).

**Alternative:** Python-Script mit requests + session:

```python
import requests

session = requests.Session()

# 1. Login
response = session.post(
    'https://games.hispanistica.com/auth/login',
    json={'username': 'admin', 'password': 'PASSWORD'}
)

# 2. CSRF-Token aus Cookie lesen
csrf_token = session.cookies.get('csrf_access_token')
print(f"CSRF Token: {csrf_token[:20]}...")

# 3. Import mit CSRF-Token
response = session.post(
    'https://games.hispanistica.com/quiz-admin/api/releases/test_release_001/import',
    headers={
        'X-CSRF-TOKEN': csrf_token,
        'Content-Type': 'application/json'
    },
    json={}
)
print(f"Status: {response.status_code}")  # Erwartete Ausgabe: 200 (oder 404/500 für fehlende Files)
```

---

## Troubleshooting

### Problem: Immer noch 401 trotz CSRF-Token

**Diagnose:**

1. **Prüfe Browser Console:**
   ```javascript
   console.log('CSRF Token:', document.cookie.match(/csrf_access_token=([^;]+)/)[1]);
   ```
   Falls undefined → Cookie fehlt (JWT nicht korrekt gesetzt)

2. **Prüfe DevTools → Network → Request Headers:**
   ```
   X-CSRF-TOKEN: eyJ0eXAiOiJKV1Qi...
   ```
   Falls Header fehlt → JS-Code nutzt getCsrfToken() nicht

3. **Prüfe Flask Config:**
   ```python
   # In app init oder config
   JWT_COOKIE_CSRF_PROTECT = True  # MUSS True sein in Prod
   ```

### Problem: Upload (FormData) schlägt fehl mit 400/415

**Ursache:** Content-Type manuell gesetzt (z.B. `application/json`)

**Lösung:** Content-Type für FormData **NICHT** setzen:

```javascript
// ✅ KORREKT
async upload(formData) {
  const response = await fetch(`${this.baseUrl}/upload-unit`, {
    method: 'POST',
    headers: {
      'X-CSRF-TOKEN': getCsrfToken(),
      // KEIN Content-Type!
    },
    credentials: 'same-origin',
    body: formData,
  });
}

// ❌ FALSCH
headers: {
  'Content-Type': 'application/json',  // ← Falsch für FormData!
  'X-CSRF-TOKEN': getCsrfToken(),
}
```

### Problem: CSRF-Token in DevTools sichtbar (Security-Concern?)

**Antwort:** Das ist **by design** (Double Submit Cookie Pattern):

- `jwt_access_token`: HttpOnly → Nicht in JS lesbar (sicher)
- `csrf_access_token`: **Nicht** HttpOnly → In JS lesbar (nötig!)

**Security:**
- CSRF-Token allein ist nutzlos (braucht auch jwt_access_token Cookie)
- XSS-Schutz durch CSP (Content-Security-Policy)
- CSRF-Schutz durch Double Submit (Cookie + Header müssen übereinstimmen)

---

## Geänderte Dateien

| Datei | Änderung | Zeilen |
|-------|----------|--------|
| `static/js/admin/quiz_content.js` | getCsrfToken() + X-CSRF-TOKEN in POST/PATCH/DELETE/upload | +15 |
| `tests/test_quiz_admin.py` | TestCSRFProtection (4 Tests + Fixtures) | +188 |

**Total:** 2 Dateien, ~203 Zeilen

---

## Related Docs

- [AUTH_FIX_401_FETCH.md](AUTH_FIX_401_FETCH.md) - JSON.parse Error Fix
- [AUTH_DEBUG_INSTRUMENTATION.md](AUTH_DEBUG_INSTRUMENTATION.md) - 401 Debug-Logging
- [server_admin_config.md](../server_admin_config.md) - Production Setup

---

## Commit Message

```
fix: Add CSRF token to quiz admin API requests

Problem: POST/PATCH/DELETE requests to /quiz-admin/api/* failed with 401
despite valid JWT cookie. Request headers missing X-CSRF-TOKEN.

Root Cause: flask-jwt-extended with JWT_COOKIE_CSRF_PROTECT=True requires
Double Submit Cookie pattern: both jwt_access_token cookie AND X-CSRF-TOKEN
header must be present for mutating requests.

Solution:
- Add getCsrfToken() helper to quiz_content.js
- Add X-CSRF-TOKEN header to all POST/PATCH/DELETE/upload requests
- Special handling for FormData: CSRF token but NO Content-Type header
- Tests: TestCSRFProtection (4 tests) verifying 401 without CSRF, 200 with CSRF

Files:
- static/js/admin/quiz_content.js (+15 lines)
- tests/test_quiz_admin.py (+188 lines)

Note: admin_users.js already had CSRF handling, this fix aligns quiz_content.js

Related: #401-fix, AUTH_FIX_401_FETCH.md
```

---

**Status:** ✅ Ready for Production  
**Tests:** ✅ 4 neue Tests (CSRF with/without token)  
**Breaking Changes:** ❌ Keine (abwärtskompatibel)  
**Security:** ✅ Erhöht (CSRF-Protection vollständig implementiert)

---

## Erfolgskriterien ✅

- [x] **PATCH /quiz-admin/api/units liefert 200** (nicht 401)
- [x] **POST /quiz-admin/api/releases/{id}/import liefert 200** (nicht 401)
- [x] **POST /quiz-admin/api/upload-unit funktioniert** (FormData + CSRF)
- [x] **Keine 401 mehr bei gültiger Session** (JWT + CSRF korrekt)
- [x] **Tests passieren** (4/4 CSRF-Tests grün)
- [x] **Konsistent mit admin_users.js** (beide nutzen gleichen Pattern)
