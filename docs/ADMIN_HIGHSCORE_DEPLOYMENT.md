# Admin Highscore Fix – Deployment Guide

**Datum:** 2026-01-12  
**Status:** Ready for Deploy  
**Fixes:** 3 Root Causes identifiziert und behoben

---

## Fixes Implemented

### 1. ✅ CSRF-Token in Admin-Fetches

**Problem:** JWT-geschützte Endpoints erwarten CSRF-Token, aber Frontend sendete keinen
- POST `/api/quiz/admin/topics/<slug>/highscores/reset` → 401/422
- DELETE `/api/quiz/admin/topics/<slug>/highscores/<id>` → 401/422

**Root Cause:** Flask-JWT-Extended mit Cookie-based Auth benötigt CSRF-Protection

**Fix:** [static/js/games/quiz-entry.js](../static/js/games/quiz-entry.js)
```javascript
// Added getCsrfToken() helper
// Both resetAllHighscores() and deleteHighscoreEntry() now send:
headers['X-CSRF-TOKEN'] = csrfToken;
```

---

### 2. ✅ NameError in unauthorized_callback

**Problem:** `NameError: name 'app' is not defined` in JWT callback
- Traceback: `src/app/extensions/__init__.py`, line 178

**Root Cause:** `app.debug` statt `current_app.debug`

**Fix:** [src/app/extensions/__init__.py](../src/app/extensions/__init__.py)
```python
# Import hinzugefügt:
from flask import Flask, jsonify, request, current_app

# Line 178: app.debug → current_app.debug
if current_app.debug and request.path.startswith("/quiz-admin/api/"):
    current_app.logger.warning(...)
```

---

### 3. ✅ RefreshToken.replaced_by VARCHAR Truncation

**Problem:** `StringDataRightTruncation` on `/auth/refresh`
- Token-Rotation-Marker überschreitet 36 Zeichen
- Z.B. `"concurrent_refresh_detected_abc123-xyz-..."`

**Root Cause:** `replaced_by` definiert als `String(36)`, aber Marker sind länger

**Fix:** 
- **Model:** [src/app/auth/models.py](../src/app/auth/models.py)
  ```python
  replaced_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
  ```
- **Migration:** [migrations/0013_increase_refresh_token_replaced_by_limit.sql](../migrations/0013_increase_refresh_token_replaced_by_limit.sql)
  ```sql
  ALTER TABLE refresh_tokens 
  ALTER COLUMN replaced_by TYPE varchar(64);
  ```

---

## Deployment Steps

### 1. Backup (Empfohlen)

```bash
# SSH auf Prod
ssh root@games.hispanistica.com

# DB Backup
docker exec games-postgres pg_dump -U postgres hispanistica_games > /tmp/backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Code Deploy

```bash
cd /srv/webapps/games_hispanistica/app

# Pull changes
git pull origin main  # oder dein Branch-Name

# Verify changes
git log -1 --oneline
git diff HEAD~1 HEAD --stat
```

### 3. Run Migration

```bash
# Check Migration existiert
ls migrations/0013_increase_refresh_token_replaced_by_limit.sql

# Run Migration
docker exec -i games-postgres psql -U postgres -d hispanistica_games < migrations/0013_increase_refresh_token_replaced_by_limit.sql

# Verify
docker exec games-postgres psql -U postgres -d hispanistica_games -c "\d refresh_tokens" | grep replaced_by
# Expected: replaced_by | character varying(64) |
```

### 4. Restart App

```bash
docker restart games-webapp

# Wait for startup
sleep 5

# Check health
curl -s https://games.hispanistica.com/health | jq .

# Check logs for errors
docker logs games-webapp --tail=50
```

---

## Smoke-Test (After Deploy)

### A) Admin Highscore Reset/Delete

**1. Als Admin einloggen:**
- Browser: `https://games.hispanistica.com/login`
- Username: `<admin-user>`, Password: `<admin-pass>`

**2. Zur Rangliste navigieren:**
- URL: `https://games.hispanistica.com/games/quiz/variation_aussprache`
- Tab: "Rangliste"

**3. DevTools öffnen:**
- F12 → Network Tab
- Filter: "highscores"

**4. Test Reset:**
- Klick "Zurücksetzen" Button
- **Verify Network Tab:**
  - Request Headers enthalten: `X-CSRF-TOKEN: <token>`
  - Status: **200** (nicht 401/422/500!)
  - Response: `{"ok": true, "deleted_count": N}`
- **Verify UI:** Rangliste ist leer

**5. Test Delete:**
- (Erst neue Scores erzeugen durch Quiz spielen)
- Klick Trash-Icon 🗑️ bei einem Eintrag
- **Verify Network Tab:**
  - Request Headers enthalten: `X-CSRF-TOKEN: <token>`
  - Status: **204** (nicht 401/422/500!)
- **Verify UI:** Eintrag verschwindet

---

### B) Token Refresh Stability

**1. Monitor Logs:**
```bash
docker logs games-webapp --tail=100 -f | grep -i "refresh\|replaced_by\|truncation"
```

**2. Trigger Refresh:**
- Warte 30+ Minuten (oder force-expire JWT in Dev)
- Reload Seite oder mache API-Call
- Backend sollte automatisch Token refreshen

**3. Verify:**
- **Keine Errors** in Logs
- **Kein** `StringDataRightTruncation`
- **Kein** `NameError: name 'app'`

---

### C) Negative Tests

**1. Ohne CSRF (manuell):**
- DevTools → Network
- Rechtsklick auf `/highscores/reset` Request → "Edit and Resend"
- Entferne `X-CSRF-TOKEN` Header
- Send
- **Expected:** 401 oder 422 (nicht 500!)

**2. Nicht-Admin:**
- Logout, Login als User (nicht Admin)
- Versuche Reset/Delete
- **Expected:** 403 Forbidden

**3. Nicht eingeloggt:**
- Logout
- Versuche direkt `curl -X POST https://games.hispanistica.com/api/quiz/admin/topics/.../highscores/reset`
- **Expected:** 401 Unauthorized

---

## Verification Evidence

### Required Screenshots/Logs

**1. Request Headers (DevTools):**
```
POST /api/quiz/admin/topics/variation_aussprache/highscores/reset
Headers:
  Content-Type: application/json
  Cookie: access_token_cookie=eyJ...
  X-CSRF-TOKEN: eyJ...  ✅ MUSS VORHANDEN SEIN
```

**2. Successful Response:**
```json
HTTP 200
{
  "ok": true,
  "deleted_count": 5
}
```

**3. DB Migration Verified:**
```bash
docker exec games-postgres psql -U postgres -d hispanistica_games -c "\d refresh_tokens"

# Output should show:
# replaced_by | character varying(64) | (not 36!)
```

**4. No Errors in Logs:**
```bash
docker logs games-webapp --tail=200 | grep -E "ERROR|CRITICAL|Traceback"
# Should be empty (or unrelated errors only)
```

---

## Rollback Plan (if needed)

### If Migration Fails:

```bash
# Rollback Migration
docker exec -i games-postgres psql -U postgres -d hispanistica_games <<EOF
BEGIN;
ALTER TABLE refresh_tokens ALTER COLUMN replaced_by TYPE varchar(36);
COMMIT;
EOF

# Restart App
docker restart games-webapp
```

### If Code Issues:

```bash
cd /srv/webapps/games_hispanistica/app

# Revert to previous commit
git log --oneline -5  # Find previous commit hash
git reset --hard <previous-commit-hash>

# Restart
docker restart games-webapp
```

---

## Success Criteria

- ✅ Admin kann Highscores zurücksetzen (200)
- ✅ Admin kann einzelne Einträge löschen (204)
- ✅ Request Headers enthalten `X-CSRF-TOKEN`
- ✅ Keine 401/422/500 Fehler bei korrektem Auth
- ✅ Token Refresh funktioniert ohne Truncation-Errors
- ✅ Keine `NameError` in Logs
- ✅ DB-Migration erfolgreich (`replaced_by` = varchar(64))

---

## Related Docs

- [Traceback Capture](ADMIN_HIGHSCORE_TRACEBACK_CAPTURE.md) - Wie wir Root Cause fanden
- [Status](ADMIN_HIGHSCORE_STATUS.md) - Fix-Timeline
- [Smoke Test](ADMIN_HIGHSCORE_FIX_SMOKE_TEST.md) - Detaillierte Test-Szenarien

---

**Ready for Deployment!** 🚀
