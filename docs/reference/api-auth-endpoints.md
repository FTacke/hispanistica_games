---
title: "API Authentication Endpoints Reference"
status: active
owner: backend-team
updated: "2025-11-07"
tags: [api, jwt, flask, security, reference]
links:
  - ../concepts/authentication-flow.md
  - ../troubleshooting/auth-issues.md
---

# API Authentication Endpoints Reference

Technische Dokumentation der JWT-basierten Authentifizierungs-Endpunkte.

---

## Flask Decorators

### `@jwt_required()` (Mandatory Auth)

```python
@blueprint.get("/player")
@jwt_required()
def player_page():
    """Player requires authentication"""
    # Code here only runs if user is authenticated
```

**Verhalten:**
- Kein Token → `unauthorized_callback` → Redirect zu Login
- Abgelaufener Token → `expired_token_callback` → Redirect zu Login
- Route wird **nie** ohne gültigen Token ausgeführt

---

### `@jwt_required(optional=True)` (Optional Auth)

```python
@blueprint.get("/corpus")
@jwt_required(optional=True)
def corpus_home():
    """Corpus is public, but enhanced for authenticated users"""
    if getattr(g, "user", None):
        # User is authenticated - show more features
    else:
        # User is not authenticated - public mode
```

**Verhalten:**
- Kein Token → Route läuft, `g.user = None`
- Abgelaufener Token → **Wird ignoriert** (wie kein Token), Route läuft
- Gültiger Token → `g.user` wird gesetzt
- **Nie** ein Error, Route entscheidet selbst

**CRITICAL BEHAVIOR (Nov 2024):**
Laut Flask-JWT-Extended Dokumentation: **"If a JWT that is expired or not verifiable is in the request, an error will be still returned like normal."**

Das bedeutet: **Auch bei `optional=True` werden expired/invalid tokens als Fehler behandelt!**

Die Error-Callbacks (`expired_token_loader`, `invalid_token_loader`) werden AUCH für optional-Routes aufgerufen. Um Redirect-Loops zu vermeiden, müssen diese Callbacks optional-Routes explizit erkennen und `None` zurückgeben (siehe `src/app/extensions/__init__.py`).

**Liste der Optional-Auth-Routes:**
- `/corpus/` (alle Corpus-Endpoints)
- `/media/` (alle Media-Endpoints, config-abhängig)
- `/auth/session` (Session-Check)
- `/auth/logout` (Logout)

Diese Routes sind in `OPTIONAL_AUTH_ROUTES` definiert (siehe `src/app/extensions/__init__.py`).

---

## JWT Error Handlers

Alle Error-Handler sind in `src/app/extensions/__init__.py` definiert:

### 1. `expired_token_loader` (Token abgelaufen)
- **API/AJAX**: JSON-Response mit 401
- **HTML-Pages**: Redirect zu Referrer mit `?showlogin=1` + Flash-Message

### 2. `invalid_token_loader` (Token ungültig/korrupt)
- **API/AJAX**: JSON-Response mit 401
- **HTML-Pages**: Redirect zu Referrer mit `?showlogin=1` + Flash-Message

### 3. `unauthorized_loader` (Kein Token bei mandatory auth)
- **API/AJAX**: JSON-Response mit 401
- **HTML-Pages**: Redirect zu Referrer mit `?showlogin=1` + Flash-Message

**WICHTIG**: Alle Handler geben direkt eine Response zurück, **nicht** `abort(401)`, um Werkzeug Exceptions zu vermeiden.

---

## Cache-Control & Cookie-Headers

### Problem: Gecachte "nicht eingeloggt" Seiten

Browser können HTML/JSON-Responses cachen. Wenn ein User sich einloggt, aber der Browser eine gecachte Version der Seite lädt, sieht er noch den "logged out" Zustand.

### Lösung: Cache-Control Header

**Alle auth-abhängigen Seiten und APIs** müssen diese Header setzen:

```python
response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
response.headers['Pragma'] = 'no-cache'
response.headers['Vary'] = 'Cookie'
```

**Wo implementiert:**
- `/player` (HTML-Seite)
- `/get_stats_files_from_db` (JSON-API)
- `/auth/ready` (Intermediate Page)
- `/auth/login` (Login-Response)

**Wichtig**: `Vary: Cookie` signalisiert dem Browser, dass die Response vom Cookie-Wert abhängt.

---

### Cookie-Header bei fetch()

**Alle fetch-Requests müssen explizit Cookies mitsenden:**

```javascript
const response = await fetch('/api/endpoint', {
  credentials: 'same-origin',  // ← WICHTIG!
  cache: 'no-store'             // ← Verhindert Browser-Cache
});
```

**Standard**: `credentials: 'same-origin'` ist zwar default, aber explizit verhindert Fehlkonfigurationen.

---

### URL-Konsistenz: Same-Origin Requests

**Problem**: Absolute URLs mit verschiedenen Hosts/Ports triggern CORS:
- `http://127.0.0.1:8000` vs `http://localhost:8000` = **Cross-Origin**
- Cookies werden nicht gesendet!

**Lösung**: Immer relative URLs oder `new URL(path, location.origin)`:

```javascript
// ✅ RICHTIG
await fetch('/media/transcripts/file.json', {
  credentials: 'same-origin',
  cache: 'no-store'
});

// ✅ AUCH RICHTIG
const url = new URL('/media/transcripts/file.json', location.origin);
await fetch(url, {
  credentials: 'same-origin',
  cache: 'no-store'
});

// ❌ FALSCH (Cross-Origin wenn Host unterschiedlich)
await fetch('http://127.0.0.1:8000/media/transcripts/file.json');
```

---

## API Endpoints

### POST `/auth/login`

**Request:**
```http
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=secret
```

**Response (303 Redirect):**
```http
HTTP/1.1 303 See Other
Location: /auth/ready?next=%2Fplayer
Set-Cookie: access_token_cookie=...; HttpOnly; SameSite=Lax; Path=/
Set-Cookie: refresh_token_cookie=...; HttpOnly; SameSite=Lax; Path=/
```

---

### GET `/auth/session`

**Request:**
```http
GET /auth/session
Cookie: access_token_cookie=...
```

**Response (Authenticated):**
```json
{
  "authenticated": true,
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

**Response (Not Authenticated):**
```json
{
  "authenticated": false
}
```

---

### POST `/auth/logout`

**Request:**
```http
POST /auth/logout
Cookie: access_token_cookie=...
```

**Response (302 Redirect):**
```http
HTTP/1.1 302 Found
Location: /
Set-Cookie: access_token_cookie=; Max-Age=0; Path=/
Set-Cookie: refresh_token_cookie=; Max-Age=0; Path=/
```

---

### GET `/auth/ready`

**Query Parameters:**
- `next` (optional): URL to redirect after auth confirmation

**Behavior:**
1. Loads minimal HTML page
2. Polls `/auth/session` until authenticated
3. Redirects to `next` URL or landing page

---

## Bekannte Probleme

### Problem 1: "Token has expired" auf öffentlichen Seiten
**Ursache**: `@jwt_required(optional=True)` triggerte Error statt Silent-Ignore  
**Lösung**: JWT-Error-Handler geben direkt Response zurück (nicht `abort()`)

### Problem 2: 401 Unauthorized statt Login-Redirect
**Ursache**: `abort(401)` in JWT-Handler warf Werkzeug Exception  
**Lösung**: Handler geben `redirect()` direkt zurück

### Problem 3: Return-URL geht verloren bei Client-Side-Navigation
**Ursache**: `sessionStorage` wird nicht konsistent verwendet  
**Lösung**: Server-Side-Session (`save_return_url()`) als Fallback

---

## Testing-Checkliste

- [ ] Corpus ohne Login → funktioniert
- [ ] Player-Link vom Atlas ohne Login → Login öffnet sich
- [ ] Nach Login → zurück zum Player mit Parametern
- [ ] Direkter Player-Zugriff ohne Login → Login öffnet sich → zurück zu Player
- [ ] Token abgelaufen auf Player → Login öffnet sich mit Message
- [ ] Logout → bleibt auf Seite → Login-Button funktioniert
- [ ] `?showlogin=1` wird aus URL entfernt (clean URL)

---

## Siehe auch

- [Authentication Flow Overview](../concepts/authentication-flow.md) - Konzeptuelle Übersicht
- [Auth Troubleshooting](../troubleshooting/auth-issues.md) - Bekannte Probleme
