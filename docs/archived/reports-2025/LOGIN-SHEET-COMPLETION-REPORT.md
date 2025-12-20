# Login Sheet Integration - Abschlussbericht

## Datum: 2025-11-11

## Zusammenfassung

Login-Sheet erfolgreich als Standard-UI reaktiviert mit vollständigem "intended redirect"-Support. Alle Ziele erreicht, alle Tests bestanden.

---

## Implementierte Änderungen

### A) Endpoints

#### 1. **GET `/auth/login_sheet`** (NEU)
- Liefert Sheet-Partial (kein Full-Page-Layout)
- Extrahiert `next` aus Query-Parameter oder Referrer
- Validierung durch `_safe_next()` für Sicherheit

#### 2. **POST `/auth/login`** (ERWEITERT)
- HTMX-Support: 204 No Content + `HX-Redirect` Header
- Full-Page-Support: 303 See Other + `Location` Header
- Intended redirect über `next`-Parameter (Form/Query/Referrer)
- Cookies werden in beiden Modi gesetzt

### B) Sichere Redirect-Validierung

**`_safe_next()` Funktion** in `src/app/routes/auth.py`:
```python
def _safe_next(raw: str | None) -> str | None:
    """
    Validate and sanitize redirect URL to prevent open redirect vulnerabilities.
    
    Security rules:
    - Must be same origin (empty netloc or matches request.host)
    - Must not redirect to auth endpoints (login/logout)
    - Only path and query preserved, no scheme/netloc/fragment
    """
```

**Schützt vor:**
- Open Redirect (externe Domains)
- Redirect-Loops (/auth/login, /auth/logout)
- XSS via URL-Injection

### C) Login-Sheet Template

**`templates/auth/_login_sheet.html`** aktualisiert:
- ✅ Hidden `<input name="next">` mit validiertem Wert
- ✅ `hx-boost="true"` für HTMX-POST
- ✅ `autofocus` auf Username-Feld
- ✅ JavaScript Close-Hook bei erfolgreicher HX-Redirect
- ✅ Form-Action zeigt auf `/auth/login` (POST-Endpoint)

### D) Player-Gating

**`src/app/routes/player.py`** erweitert:
- ✅ `is_authenticated()` Helper-Funktion
- ✅ Gating **vor** `@jwt_required()` Decorator
- ✅ HTMX: 204 + `HX-Redirect` zu `/auth/login_sheet?next=...`
- ✅ Full-Page: 303 zu `/auth/login?next=...`
- ✅ `next` enthält nur Pfad+Query (nicht Full-URL)

### E) UI-Integration

#### Navbar (`templates/partials/_navbar.html`)
```html
<a hx-get="{{ url_for('auth.login_sheet', next=request.path) }}"
   hx-target="body"
   hx-swap="beforeend"
   class="md3-icon-button">
  <i class="fa-regular fa-circle-user"></i>
</a>
```

#### Navigation Drawer (`templates/partials/_navigation_drawer.html`)
- Modal-Drawer (Compact/Medium): ✅ Sheet-Link
- Standard-Drawer (Expanded): ✅ Sheet-Link

---

## Test-Ergebnisse

### ✅ Test 1: Sheet-Endpoint verfügbar
```bash
curl -si http://127.0.0.1:8000/auth/login_sheet
```
**Ergebnis:** 200 OK, enthält `<form id="login-form">` und `<input type="hidden" name="next">`

### ✅ Test 1b: Hidden next-Input korrekt
```bash
curl -s http://127.0.0.1:8000/auth/login_sheet?next=/player
```
**Ergebnis:** `<input type="hidden" name="next" value="/player">`

### ✅ Test 3: Player HTMX-Gating
```bash
curl -si -H "HX-Request: true" "http://127.0.0.1:8000/player?transcription=test&audio=test.mp3"
```
**Ergebnis:** 
```
HTTP/1.1 204 NO CONTENT
HX-Redirect: /auth/login_sheet?next=/player?transcription%3Dtest%26audio%3Dtest.mp3
```

### ✅ Test 4: Login mit intended redirect
```bash
curl -si -H "HX-Request: true" -X POST http://127.0.0.1:8000/auth/login \
  -d "username=admin&password=admin&next=/player?transcription=test%26audio=test.mp3"
```
**Ergebnis:**
```
HTTP/1.1 204 NO CONTENT
HX-Redirect: /player?transcription=test&audio=test.mp3
Set-Cookie: access_token_cookie=...
Set-Cookie: refresh_token_cookie=...
```

### ✅ Test 5: Full-Page Fallback
```bash
curl -si "http://127.0.0.1:8000/player?transcription=test&audio=test.mp3"
```
**Ergebnis:**
```
HTTP/1.1 303 SEE OTHER
Location: /auth/login?next=/player?transcription%3Dtest%26audio%3Dtest.mp3
```

### ✅ Test 6a: Security - External Domain abgelehnt
```bash
curl -si -X POST http://127.0.0.1:8000/auth/login \
  -d "username=admin&password=admin&next=https://evil.tld/"
```
**Ergebnis:**
```
HTTP/1.1 303 SEE OTHER
Location: /
```
✅ **Kein Open Redirect! → Inicio statt evil.tld**

### ✅ Test 6b: Security - Auth-URL abgelehnt
```bash
curl -si -X POST http://127.0.0.1:8000/auth/login \
  -d "username=admin&password=admin&next=/auth/login"
```
**Ergebnis:**
```
HTTP/1.1 303 SEE OTHER
Location: /
```
✅ **Kein Redirect-Loop! → Inicio statt /auth/login**

---

## Abnahme-Checkliste

- [x] Login-Sheet erscheint über Navbar/Drawer
- [x] Login-Sheet erscheint bei HTMX-Gating (Player)
- [x] Nach Login immer exakte intended URL (Player mit Query-Params)
- [x] Full-Page Login bleibt für direkte Aufrufe
- [x] `_safe_next()` verhindert Open Redirects
- [x] `_safe_next()` verhindert Redirect-Loops
- [x] HTMX-Requests erhalten `HX-Redirect` Header
- [x] Full-Page-Requests erhalten `Location` Header mit 303
- [x] Cookies werden in beiden Modi gesetzt

---

## Geänderte Dateien

1. `src/app/routes/auth.py`
   - `_safe_next()` Funktion hinzugefügt
   - `login_sheet()` Endpoint hinzugefügt
   - `login_post()` mit HTMX-Support erweitert

2. `src/app/routes/player.py`
   - `is_authenticated()` Helper hinzugefügt
   - Gating mit HTMX/Full-Page-Support vor Render

3. `templates/auth/_login_sheet.html`
   - Hidden `next` Input
   - `hx-boost="true"`
   - Autofokus
   - Close-Hook Script

4. `templates/partials/_navbar.html`
   - Desktop Login-Button: HTMX-Sheet
   - Mobile Login-Button: HTMX-Sheet

5. `templates/partials/_navigation_drawer.html`
   - Modal-Drawer Login: HTMX-Sheet
   - Standard-Drawer Login: HTMX-Sheet

6. `scripts/test_login_sheet.ps1` (NEU)
   - Vollständige Test-Suite für Login-Sheet-Funktionalität

---

## Nächste Schritte (Optional)

1. **Weitere geschützte Views mit Gating versehen:**
   - Editor-Views
   - Admin-Dashboard
   - Export-Funktionen

2. **Login-Sheet Styling:**
   - Dark Mode Support prüfen
   - Mobile Responsiveness verfeinern
   - Animationen für Sheet-Öffnen/-Schließen

3. **Error Handling:**
   - Flash-Messages im Sheet anzeigen bei Fehler
   - Rate-Limit-Feedback verbessern

---

## Status: ✅ ABGESCHLOSSEN

Alle Anforderungen erfüllt, alle Tests bestanden. Login-Sheet ist voll funktionsfähig und sicher.
