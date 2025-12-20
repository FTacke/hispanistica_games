# Bug Report: `/auth/session` Endpoint gibt 401 statt 200

**Datum:** November 2, 2025  
**Status:** 🔴 Aktiv  
**Betroffene Komponente:** Authentication / Token Refresh

---

## 📋 Executive Summary

Die `/auth/session` Endpoint ist mit `@jwt_required(optional=True)` dekoriert, sollte aber für unauthentifizierte Requests **200 OK** mit JSON zurückgeben. Stattdessen gibt sie **401 UNAUTHORIZED** zurück. Dies führt zu JavaScript-Fehlern beim Parsen der Response und verursacht, dass die `/corpus/` Seite in Firefox nicht lädt.

---

## 🔴 Symptome

### Browser-Abhängigkeit
| Browser | Status | Verhalten |
|---------|--------|-----------|
| **Chrome** | ✅ Funktioniert | `/corpus/` lädt normal, keine Fehler |
| **Firefox** | ❌ Funktioniert nicht | Fehler in Developer Console, Seite lädt nicht |

### Zugriffsmethode-Abhängigkeit
| Methode | Status | Verhalten |
|---------|--------|-----------|
| **localhost:8000** (Browser) | ✅ Funktioniert | Seite ist erreichbar |
| **python -m src.app.main** | ❌ Funktioniert nicht | Fehler treten auf |

---

## 🔍 Fehlerdiagnose

### Firefox-spezifische Fehlermeldungen

```javascript
[Turbo Accordion] Already in correct state, skipping
  → turbo-integration.js:112:13

[Auth] Could not setup proactive refresh: 
  SyntaxError: JSON.parse: unexpected character at line 1 column 1
  → token-refresh.js:214:13

XHR GET http://127.0.0.1:8000/auth/session
  → [HTTP/1.1 401 UNAUTHORIZED 10ms]
```

### Problem im Request-Response Flow

**Erwartung:**
```http
GET /auth/session HTTP/1.1
Accept: application/json
Cookie: access_token_cookie=<expired_or_missing>

HTTP/1.1 200 OK
Content-Type: application/json

{"authenticated": false, "exp": null}
```

**Tatsächliches Verhalten:**
```http
GET /auth/session HTTP/1.1
Accept: application/json
Cookie: access_token_cookie=<expired_or_missing>

HTTP/1.1 401 UNAUTHORIZED
Content-Type: application/json

{"error": "unauthorized", "code": "unauthorized", "message": "..."}
```

---

## 🔬 Root Cause Analysis

### 1. Flask-JWT-Extended Error Handler wird aufgerufen

**Datei:** `src/app/routes/auth.py`
```python
@blueprint.get("/session")
@jwt_required(optional=True)  # ← Problem hier
def check_session() -> Response:
    """Check if user has valid auth session."""
    user = getattr(g, "user", None)
    if user:
        token = get_jwt() or {}
        exp = token.get("exp")
        return jsonify({
            "authenticated": True,
            "user": user,
            "exp": exp
        }), 200
    else:
        return jsonify({"authenticated": False}), 401  # ← Gibt 401 zurück!
```

**Das Problem:**
- `@jwt_required(optional=True)` erlaubt keinen Token
- Aber wenn **kein Token vorhanden ist**, ruft Flask-JWT-Extended den `unauthorized_loader` Error Handler auf
- Dieser Handler ist in `src/app/extensions/__init__.py` definiert
- Der Handler gibt **401 UNAUTHORIZED** zurück

### 2. Error Handler gibt 401 JSON zurück

**Datei:** `src/app/extensions/__init__.py`
```python
@jwt.unauthorized_loader
def unauthorized_callback(error_string):
    """Handle requests without JWT token to @jwt_required() endpoints."""
    
    # Für API/Auth Endpoints
    if request.path.startswith('/api/') or request.path.startswith('/atlas/'):
        return jsonify({
            'error': 'unauthorized',
            'code': 'unauthorized',
            'message': error_string
        }), 401
    
    # ... Rest des Handlers
```

**Das Problem:**
- Der Handler prüft nur auf `/api/` und `/atlas/` Prefixes
- `/auth/` Endpoints sind nicht in dieser Liste
- Daher wird der HTML-Redirect-Handler benutzt (statt JSON)
- Für optional routes sollte es 200 zurückgeben, nicht 401

### 3. JavaScript kann Response nicht parsen

**Datei:** `static/js/modules/auth/token-refresh.js`
```javascript
async function setupProactiveRefresh() {
  try {
    const response = await originalFetch('/auth/session', {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    if (response.ok) {  // ← 401 ist NICHT ok!
      const data = await response.json();  // ← Aber Firefox versucht trotzdem zu parsen
      
      if (data.authenticated && data.exp) {
        // ... Timer setup
      }
    }
  } catch (error) {
    console.warn('[Auth] Could not setup proactive refresh:', error);
    // ← "JSON.parse: unexpected character" Fehler tritt hier auf
  }
}
```

**Das Problem:**
- `response.ok` ist `false` für 401 Status
- Aber Firefox versucht trotzdem `response.json()` zu parsen
- Die Response ist möglicherweise nicht valid JSON (HTML-Redirect?)
- Fehler: `JSON.parse: unexpected character at line 1 column 1`

---

## 🌐 Browser-Unterschiede

### Chrome ✅
- Cacht die alte JavaScript-Logik nicht
- Toleriert oder ignoriert die 401-Response
- Seite lädt trotzdem

### Firefox ❌
- Cacht aggressiver
- Kann die fehlerhafte Response nicht parsen
- Fehler beim `JSON.parse()`
- Seite bricht ab

---

## 💾 Zugriffsmethode-Unterschiede

### localhost:8000 (über Browser) ✅
- Nutzt möglicherweise gecachte Python-Bytecode oder Build-Artefakte
- Hot-Reload funktioniert konsistent
- Code-Änderungen werden zuverlässig geladen
- Oder: Browser-Cache wird verwendet

### python -m src.app.main ❌
- Lädt Python-Module frisch ohne Cache
- Code wird sofort angewendet
- Python-Bytecode ist unterschiedlich
- Service Worker / Browser-Cache nicht vorhanden

---

## 📊 Request Flow Vergleich

### ✅ Chrome (funktioniert):
```
1. Browser lädt /corpus/
2. JavaScript lädt /auth/session
3. Response: 401 UNAUTHORIZED (JSON)
   {"error": "unauthorized", "code": "unauthorized"}
4. JavaScript: response.ok === false
5. setupProactiveRefresh() skippt die Logik
6. Seite wird trotzdem angezeigt (graceful degradation)
```

### ❌ Firefox (funktioniert nicht):
```
1. Browser lädt /corpus/
2. JavaScript lädt /auth/session
3. Response: 401 UNAUTHORIZED (möglicherweise HTML/Redirect?)
4. JavaScript: try { await response.json() }
5. JSON.parse() schlägt fehl
6. setupProactiveRefresh() crasht
7. Fehler in Konsole: "JSON.parse: unexpected character"
8. Seite lädt nicht vollständig
```

---

## 🛠️ Technische Analyse

### Das Core Problem

**Endpoint ist deklariert als Optional:**
```python
@jwt_required(optional=True)  # ← "Optional" bedeutet:
                              # Erlaubt keinen Token
                              # Aber auch: Erlaubt kein Token?
```

**Aber verhält sich wie Mandatory:**
```python
else:
    return jsonify({"authenticated": False}), 401  # ← Gibt 401 zurück!
```

**Und Error Handler verhält sich wie HTML-Page:**
```python
# Wenn kein Token: Error Handler wird aufgerufen
# Error Handler gibt 401 oder HTML-Redirect zurück
# Nicht 200 JSON!
```

### Flask-JWT-Extended Behavior

Laut Flask-JWT-Extended Dokumentation:
> "If a JWT that is expired or not verifiable is in the request, an error will be still returned like normal"

Das bedeutet:
- `@jwt_required(optional=True)` erlaubt **keine Token** (aber auch keine Errors bei fehlenden Tokens)
- **ABER:** Der Error Handler wird trotzdem aufgerufen bei fehlenden/ungültigen Tokens
- Dies ist undokumentiertes / unintuitivesVerhalten

---

## 💡 Lösungsansatz

### Lösung: Manueller Token-Check statt Decorator

**Statt:**
```python
@blueprint.get("/session")
@jwt_required(optional=True)  # ← Problem
def check_session() -> Response:
    # ...
    return jsonify({"authenticated": False}), 401  # ← Gibt 401 zurück!
```

**Sollte sein:**
```python
@blueprint.get("/session")
def check_session() -> Response:  # ← Kein Decorator!
    """Check session - ALWAYS returns 200 with JSON"""
    try:
        # Manueller Token-Check ohne Decorator
        from flask_jwt_extended import verify_jwt_in_request, get_jwt
        from datetime import datetime, timezone
        
        verify_jwt_in_request(optional=True)
        token = get_jwt() or {}
        user = token.get("sub")
        exp = token.get("exp")
        
        # IMMER 200 zurückgeben, egal ob authentifiziert
        return jsonify({
            "authenticated": bool(user),
            "user": user if user else None,
            "exp": exp
        }), 200  # ← 200, nicht 401!
    
    except Exception as e:
        # Fallback für Error Cases
        return jsonify({
            "authenticated": False,
            "user": None,
            "exp": None
        }), 200  # ← Auch hier 200!
```

**Vorteile:**
- ✅ Immer 200 OK Status (egal ob Token vorhanden)
- ✅ Immer gültiges JSON (keine HTML-Redirects)
- ✅ Optionale Authentication funktioniert korrekt
- ✅ Kein Error Handler wird aufgerufen
- ✅ Firefox kann `response.json()` korrekt parsen
- ✅ setupProactiveRefresh() funktioniert

---

## 📋 Checkliste zur Fehlersuche

- [ ] `/auth/session` Endpoint aufrufen: `curl http://localhost:8000/auth/session`
- [ ] Response Status-Code checken (sollte 200 sein)
- [ ] Response-Body checken (sollte JSON sein)
- [ ] Firefox Developer Tools öffnen (F12)
- [ ] Network Tab prüfen, `/auth/session` Request suchen
- [ ] Response Header und Body inspizieren
- [ ] Console Errors checken
- [ ] Hard Refresh in Firefox: `Ctrl+Shift+R`
- [ ] Browser-Cache leeren (Firefox: `Ctrl+Shift+Delete`)

---

## 📚 Referenzen

- **Flask-JWT-Extended Docs:** https://flask-jwt-extended.readthedocs.io/
- **Optional Authentication:** Section "Optional Authentication"
- **Error Handlers:** Section "Error Handling"

---

## 🔗 Betroffene Dateien

| Datei | Problem | Status |
|-------|---------|--------|
| `src/app/routes/auth.py` | `check_session()` gibt 401 statt 200 | 🔴 Zu fixen |
| `src/app/extensions/__init__.py` | Error Handler ruft auf, selbst bei optional=True | 🟡 Sekundär |
| `static/js/modules/auth/token-refresh.js` | Kann 401 nicht parsen | 🟡 Folgeeffekt |

---

## ✅ Erfolgs-Kriterien

Nach der Behebung sollte Folgendes gelten:

- [ ] `/auth/session` gibt **immer 200 OK** zurück
- [ ] Response ist **immer gültiges JSON**
- [ ] `token-refresh.js` zeigt keine Fehler in Konsole
- [ ] `/corpus/` lädt in **Chrome** ohne Fehler
- [ ] `/corpus/` lädt in **Firefox** ohne Fehler
- [ ] Funktioniert mit `python -m src.app.main`
- [ ] Funktioniert mit localhost Browser-Aufruf
