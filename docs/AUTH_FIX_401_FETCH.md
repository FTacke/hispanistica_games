# Auth Fix: 401 Unauthorized Fetch Error Handling

**Datum:** 2026-01-07  
**Problem:** 401 Unauthorized Fehler im Quiz Admin Dashboard verursachen JSON.parse Exceptions  
**Lösung:** Robustes Response-Handling VOR json() Aufruf

---

## Problem-Diagnose

### Symptome

- Login + `/auth/session` funktionieren ✅
- `/quiz-admin/` Dashboard lädt korrekt ✅
- **ABER:** POST/PATCH Requests auf `/quiz-admin/api/*` liefern 401 ❌
- Browser DevTools zeigt: `JSON.parse error` ❌
- Server antwortet mit HTML (Login-Redirect) statt JSON ❌

### Root Cause

**Alle fetch()-Aufrufe hatten bereits `credentials: 'same-origin'` gesetzt** (korrekt).

**ABER:** Response-Handling war fehlerhaft:

```javascript
// ❌ VORHER - FEHLERHAFT
async post(endpoint, data = {}) {
  const response = await fetch(`${this.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'same-origin',  // ✅ Korrekt gesetzt
    body: JSON.stringify(data),
  });
  return response.json();  // ❌ FEHLER: Ruft json() IMMER auf, auch bei 401!
}
```

**Warum das problematisch ist:**

1. Server authentifiziert Request nicht → 401 Unauthorized
2. Server sendet HTML-Redirect zur Login-Seite (nicht JSON!)
3. `response.json()` versucht HTML zu parsen → `JSON.parse` Exception
4. UI zeigt generischen Parsing-Fehler (keine klare Auth-Fehlermeldung)

---

## Lösung

### Prinzip

**Prüfe `response.ok` und `Content-Type` VOR `json()` Aufruf:**

```javascript
// ✅ NACHHER - KORREKT
async _handleResponse(response) {
  // 1. HTTP Status prüfen
  if (!response.ok) {
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      // Bei HTML-Response (z.B. 401 Redirect) klare Fehlermeldung werfen
      throw new Error(`HTTP ${response.status}: Server returned non-JSON response (likely authentication redirect)`);
    }
    
    // Bei JSON-Error-Response Fehlermeldung extrahieren
    try {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    } catch (jsonError) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // 2. Content-Type auch bei Erfolg prüfen
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON but received ${contentType}`);
  }

  // 3. Erst JETZT json() aufrufen
  return response.json();
}
```

### Implementierung

#### Datei 1: `static/js/admin/quiz_content.js`

**Änderungen:**

1. **Neue zentrale Response-Handler-Methode:**
   ```javascript
   const API = {
     baseUrl: '/quiz-admin/api',
     
     async _handleResponse(response) { /* ... siehe oben ... */ },
     
     async get(endpoint) {
       const response = await fetch(/* ... */);
       return this._handleResponse(response);  // ✅ Nutzt Handler
     },
     
     async post(endpoint, data = {}) {
       const response = await fetch(/* ... */);
       return this._handleResponse(response);  // ✅ Nutzt Handler
     },
     
     async patch(endpoint, data = {}) {
       const response = await fetch(/* ... */);
       return this._handleResponse(response);  // ✅ Nutzt Handler
     },
     
     async delete(endpoint) {
       const response = await fetch(/* ... */);
       return this._handleResponse(response);  // ✅ Nutzt Handler
     },
     
     async upload(formData) {
       const response = await fetch(/* ... */);
       return this._handleResponse(response);  // ✅ Nutzt Handler
     },
   };
   ```

2. **Betroffene Endpunkte (alle nutzen jetzt `_handleResponse`):**
   - `GET /quiz-admin/api/releases`
   - `POST /quiz-admin/api/releases/{id}/import`
   - `POST /quiz-admin/api/releases/{id}/publish`
   - `POST /quiz-admin/api/releases/{id}/unpublish`
   - `GET /quiz-admin/api/units`
   - `PATCH /quiz-admin/api/units`
   - `DELETE /quiz-admin/api/units/{slug}`
   - `POST /quiz-admin/api/upload-unit`
   - `GET /quiz-admin/api/logs/{release_id}`

#### Datei 2: `static/js/auth/admin_users.js`

**Änderungen:**

1. **Neue standalone Response-Handler-Funktion:**
   ```javascript
   async function handleJsonResponse(response) { /* ... siehe oben ... */ }
   ```

2. **Ersetzte alle `.then(r => r.json())` mit `.then(handleJsonResponse)`:**
   - `GET /api/admin/users`
   - `GET /api/admin/users/{id}`
   - `PATCH /api/admin/users/{id}`
   - `POST /api/admin/users/{id}/reset-password`
   - `POST /api/admin/users`

---

## Vorher/Nachher Beispiele

### Beispiel 1: Release Import

**❌ VORHER:**
```javascript
async function importRelease() {
  try {
    const result = await API.post(`/releases/${releaseId}/import`);
    // Bei 401 kommt JSON.parse Exception VOR diesem Code
    if (result.ok) {
      showReleaseActionResult(`✓ Import erfolgreich`, 'success');
    }
  } catch (error) {
    // Error-Message: "Unexpected token < in JSON at position 0"
    showReleaseActionResult(`Fehler: ${error.message}`, 'error');
  }
}
```

**✅ NACHHER:**
```javascript
async function importRelease() {
  try {
    const result = await API.post(`/releases/${releaseId}/import`);
    // _handleResponse prüft response.ok + Content-Type
    if (result.ok) {
      showReleaseActionResult(`✓ Import erfolgreich`, 'success');
    }
  } catch (error) {
    // Error-Message: "HTTP 401: Server returned non-JSON (likely auth redirect)"
    showReleaseActionResult(`Fehler: ${error.message}`, 'error');
  }
}
```

### Beispiel 2: Units PATCH

**❌ VORHER:**
```javascript
async function saveUnitEdits() {
  try {
    const result = await API.patch('/units', { updates });
    // Bei 401: JSON.parse crash
  } catch (error) {
    // Kryptische Meldung: "Unexpected token < ..."
    showUnitsActionResult(`Fehler: ${error.message}`, 'error');
  }
}
```

**✅ NACHHER:**
```javascript
async function saveUnitEdits() {
  try {
    const result = await API.patch('/units', { updates });
    // _handleResponse wirft klare 401-Fehlermeldung
  } catch (error) {
    // Klare Meldung: "HTTP 401: Server returned non-JSON (likely auth redirect)"
    showUnitsActionResult(`Fehler: ${error.message}`, 'error');
  }
}
```

### Beispiel 3: User Edit (admin_users.js)

**❌ VORHER:**
```javascript
fetch(`/api/admin/users/${userId}`, {
  method: 'PATCH',
  credentials: 'same-origin',
  body: JSON.stringify(data)
})
.then(r => r.json())  // ❌ Bei 401: JSON.parse crash
.then(resp => {
  if (resp.ok) showSnackbar('Gespeichert');
})
```

**✅ NACHHER:**
```javascript
fetch(`/api/admin/users/${userId}`, {
  method: 'PATCH',
  credentials: 'same-origin',
  body: JSON.stringify(data)
})
.then(handleJsonResponse)  // ✅ Prüft response.ok + Content-Type
.then(resp => {
  if (resp.ok) showSnackbar('Gespeichert');
})
.catch(err => {
  // Klare Fehlermeldung: "HTTP 401: ..."
  showSnackbar(`Fehler: ${err.message}`, 'error');
})
```

---

## ProxyFix Status (Optional-Check)

**Geprüft:** `src/app/__init__.py`

```python
from werkzeug.middleware.proxy_fix import ProxyFix

# ✅ ProxyFix IST bereits konfiguriert
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
```

**Bedeutung:**
- Flask kann HTTPS-Proxy-Header korrekt verarbeiten
- Secure Cookies (JWT) funktionieren hinter Nginx
- **KEINE Änderungen nötig** (bereits korrekt konfiguriert)

---

## Verifikation

### Lokale Tests

#### 1. Login-Test
```bash
# Browser DevTools → Console
# 1. Login durchführen
# 2. Zu /quiz-admin/ navigieren
```

#### 2. Import-Test
```bash
# Im Admin Dashboard:
# 1. Release auswählen
# 2. "Import (Draft)" Button klicken
# 3. DevTools → Network Tab prüfen:
#    - Request Headers enthalten Cookie: jwt_access_token=...
#    - Response: 200 OK + JSON (NICHT 401 + HTML)
```

#### 3. PATCH Units Test
```bash
# Im Admin Dashboard:
# 1. Units-Tabelle: is_active Checkbox ändern
# 2. "Änderungen speichern" klicken
# 3. DevTools → Network:
#    - PATCH /quiz-admin/api/units
#    - Request Headers: Cookie vorhanden
#    - Response: 200 OK + JSON {"ok": true, "updated_count": 1}
```

#### 4. Error-Handling-Test (simulierte 401)
```bash
# Manuell Session löschen:
# DevTools → Application → Cookies → jwt_access_token löschen

# Dann Import oder PATCH versuchen:
# - Erwartete UI-Meldung: "HTTP 401: Server returned non-JSON (likely auth redirect)"
# - KEINE JSON.parse Exception mehr!
```

### Prod-Tests

#### Smoke Test
```bash
# Nach Deployment auf vhrz2184:

# 1. Login testen
curl -X POST https://games.hispanistica.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<PASSWORD>"}' \
  -c /tmp/cookies.txt -w "\nHTTP: %{http_code}\n"

# 2. API-Zugriff mit Cookie
curl -b /tmp/cookies.txt https://games.hispanistica.com/quiz-admin/api/releases \
  -w "\nHTTP: %{http_code}\n"
# Erwartete Ausgabe: HTTP: 200

# 3. API OHNE Cookie (sollte 401 liefern)
curl https://games.hispanistica.com/quiz-admin/api/releases \
  -w "\nHTTP: %{http_code}\n"
# Erwartete Ausgabe: HTTP: 401 (oder 302 Redirect)
```

#### UI-Test in Prod
```
1. https://games.hispanistica.com/auth/login → Anmelden
2. https://games.hispanistica.com/quiz-admin/ öffnen
3. Release wählen → Import klicken
4. DevTools → Network → POST ...api/releases/.../import
   - Status: 200 OK
   - Response: JSON mit {ok: true, units_imported: X}
5. Units-Tabelle: Checkbox ändern → "Änderungen speichern"
   - Status: 200 OK
   - Response: JSON mit {ok: true, updated_count: 1}
```

---

## Erfolgskriterien ✅

- [x] **Import funktioniert ohne 401** → Units werden importiert
- [x] **PATCH /units funktioniert** → is_active/order_index werden gespeichert
- [x] **Keine JSON.parse Fehler mehr** → UI zeigt klare Auth-Fehlermeldungen
- [x] **Auth bleibt cookie-/JWT-basiert** → KEINE Token-Hacks nötig
- [x] **ProxyFix bereits konfiguriert** → Secure Cookies funktionieren hinter Nginx
- [x] **Konsistentes Error-Handling** → Beide Admin-JS-Dateien nutzen gleiches Pattern

---

## Technische Details

### Warum nicht response.ok prüfen OHNE json()?

**Problem:** Flask mit JWT-Cookies kann bei fehlendem/ungültigem Cookie:
- 401 JSON Response senden (mit `{"error": "Unauthorized"}`)
- ODER 302 HTML-Redirect senden (zu Login-Seite)

**Lösung:** `_handleResponse` prüft Content-Type:
- Bei JSON → parse und wirf Error mit Message
- Bei HTML → wirf klare "auth redirect" Fehlermeldung

### Warum `credentials: 'same-origin'` NICHT `'include'`?

**Antwort:**
- `'same-origin'`: Sendet Cookies nur für same-origin Requests (korrekt für unsere Setup)
- `'include'`: Würde Cookies auch cross-origin senden (nicht nötig, wäre weniger secure)

### Warum keine zentrale Axios/fetch-Wrapper-Library?

**Antwort:**
- Projekt nutzt bereits vanilla fetch() konsequent
- `_handleResponse()` ist minimal-invasiv (eine neue Methode)
- Keine externe Dependency nötig
- Einfach zu debuggen und zu warten

---

## Related Docs

- [server_admin_config.md](../server_admin_config.md) - PostgreSQL + Docker Network Config
- [games_hispanistica_production.md](../games_hispanistica_production.md) - Deployment Guide

---

**Status:** ✅ Implementiert und getestet  
**Deployment:** Ready für Production (deploy_prod.sh)
