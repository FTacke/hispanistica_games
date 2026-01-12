# Admin Highscore Reset/Delete – Smoke Test Guide

**Datum:** 2026-01-12 (Updated)  
**Zweck:** Verifikation des Fixes für HTTP 503 → 500 → Final Fix

---

## Problem (behoben in 2 Phasen)

### Phase 1: HTTP 503 "Admin auth not configured"
Die Admin-Endpunkte für Highscore-Management lieferten in Produktion **HTTP 503** mit Fehlertext *"Admin auth not configured"*, obwohl der User als Admin eingeloggt war.

**Root Cause:** Custom `webapp_admin_required` Decorator hatte einen Fallback zu ENV-basiertem `QUIZ_ADMIN_KEY`, wenn `g.role` None war.

**Lösung:** Standard-Auth-Decorators (`@jwt_required()` + `@require_role(Role.ADMIN)`)

### Phase 2: HTTP 500 (Nach Auth-Fix)
Nach dem Auth-Fix kam **HTTP 500** bei DB-Operationen.

**Root Cause:** Fehlendes Error-Handling, keine try-except Blöcke um kritische Operationen.

**Lösung:** 
- Try-except Blöcke für robustes Error-Handling
- Konsistente FK-Verwendung (`topic.id` statt String-Parameter)
- Detailliertes Logging (Warning bei 404, Error bei 500)
- Korrekte Status-Codes: 404 für fehlende Resources, 500 nur bei echten Exceptions

---

## Betroffene Endpoints

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST   | `/api/quiz/admin/topics/<topic_id>/highscores/reset` | Alle Highscores für Topic löschen |
| DELETE | `/api/quiz/admin/topics/<topic_id>/highscores/<entry_id>` | Einzelnen Eintrag löschen |

---

## Smoke-Test-Ablauf

### Voraussetzungen

1. **Admin-Account:** Du brauchst einen User mit `role="admin"`
2. **Browser mit Dev-Tools offen** (Network Tab)
3. **Test-Topic mit Highscores:** z.B. `variation_aussprache` oder ein anderes Topic

---

## A) Browser-basierter Test (empfohlen)

### 1. Als Admin einloggen

1. Öffne `https://games.hispanistica.com/login`
2. Login mit Admin-Credentials
3. Verify: Navigationsmenü zeigt Admin-Links (z.B. "Quiz Content", "Benutzer")

### 2. Zur Rangliste navigieren

1. Gehe zu einem Quiz-Topic, z.B. `https://games.hispanistica.com/games/quiz/variation_aussprache`
2. Klick auf "Rangliste" Tab
3. **Verify:** Liste mit Highscores erscheint (wenn vorhanden)

### 3. Test: Einzelnen Eintrag löschen

1. Klick auf das **Trash-Icon** 🗑️ neben einem Eintrag
2. Bestätige im Dialog
3. **Erwartung:**
   - ✅ HTTP 204 (oder 200) in Network Tab
   - ✅ Toast-Nachricht: "Eintrag gelöscht"
   - ✅ Eintrag verschwindet aus Liste
   - ✅ Ranking rückt nach (z.B. Platz 2 wird zu Platz 1)

**Failure Indicators:**
- ❌ HTTP 503: Auth-Middleware nicht korrekt deployed (sollte nicht mehr vorkommen)
- ❌ HTTP 500: Unerwartete Exception (wird jetzt geloggt, check Server-Logs)
- ❌ HTTP 401: JWT-Cookie fehlt oder abgelaufen → neu einloggen
- ❌ HTTP 403: User hat keine Admin-Rolle → Check DB `users.role`
- ❌ HTTP 404: Topic oder Entry existiert nicht (erwartet, kein Bug)

### 4. Test: Alle Highscores zurücksetzen

1. Klick auf Button **"Zurücksetzen"** (oberhalb der Rangliste)
2. Bestätige im Dialog
3. **Erwartung:**
   - ✅ HTTP 200 in Network Tab
   - ✅ Response: `{"ok": true, "deleted_count": N}`
   - ✅ Toast-Nachricht: "N Einträge gelöscht"
   - ✅ Rangliste ist leer

**Failure Indicators:**
- ❌ HTTP 503: Auth-Middleware nicht korrekt deployed
- ❌ HTTP 401: JWT-Cookie fehlt
- ❌ HTTP 403: User ist kein Admin

---

## B) CLI-basierter Test (curl)

**Hinweis:** Du brauchst ein gültiges JWT-Cookie. Am einfachsten: Cookie aus Browser kopieren.

### 1. JWT-Cookie aus Browser extrahieren

1. In Dev-Tools → Application → Cookies → `access_token_cookie`
2. Wert kopieren (z.B. `eyJhbGciOiJIUzI1...`)

### 2. Test: Highscores zurücksetzen

```bash
curl -i -X POST \
  -H "Cookie: access_token_cookie=<TOKEN_HIER>" \
  https://games.hispanistica.com/api/quiz/admin/topics/variation_aussprache/highscores/reset
```

**Erwartung:**
```
HTTP/2 200
Content-Type: application/json

{"ok": true, "deleted_count": 5}
```

**Error Cases:**
- `401 Unauthorized` → JWT fehlt oder abgelaufen
- `403 Forbidden` → User ist kein Admin
- `404 Not Found` → Topic existiert nicht
- `503 Service Unavailable` → **BUG NICHT BEHOBEN** (sollte nicht mehr auftreten!)

### 3. Test: Einzelnen Eintrag löschen

```bash
curl -i -X DELETE \
  -H "Cookie: access_token_cookie=<TOKEN_HIER>" \
  https://games.hispanistica.com/api/quiz/admin/topics/variation_aussprache/highscores/<ENTRY_ID>
```

**Erwartung:**
```
HTTP/2 204
```

---

## C) Negative Tests (Security)

### 1. Nicht-eingeloggt → 401

```bash
curl -i -X POST https://games.hispanistica.com/api/quiz/admin/topics/test/highscores/reset
```

**Erwartung:** `401 Unauthorized`

### 2. Nicht-Admin → 403

1. Einloggen mit **User**-Account (role != "admin")
2. Cookie extrahieren
3. Request ausführen

**Erwartung:** `403 Forbidden`

---

## Acceptance Criteria (✅ = behoben)

| Kriterium | Status |
|-----------|--------|
| Keine 503 "Admin auth not configured" mehr | ✅ |
| Als Admin: Reset funktioniert (200) | ✅ |
| Als Admin: Delete funktioniert (204) | ✅ |
| Als Nicht-Admin: 403 | ✅ |
| Als Nicht-eingeloggt: 401 | ✅ |
| Kein Sicherheitsloch (öffentlich erreichbar) | ✅ |

---

## Troubleshooting

### Problem: Immer noch 500 in Prod

**Mögliche Ursachen:**
1. **Code nicht deployed:** Verify Git-Commit auf Prod-Server
2. **App nicht neu gestartet:** `docker restart games-webapp`
3. **Topic existiert nicht:** Check `quiz_topics` Tabelle für `variation_aussprache`
4. **DB-Connection-Issue:** Check Logs für SQLAlchemy-Errors

**Debug-Commands:**

```bash
# SSH auf Prod-Server
ssh root@games.hispanistica.com

# Check deployed code
cd /srv/webapps/games_hispanistica/app
git log -1 --oneline
grep -A5 "def api_admin_reset_highscores" game_modules/quiz/routes.py

# Restart app
docker restart games-webapp
docker logs games-webapp --tail=50

# Check for new error logs (look for "Admin highscore" messages)
docker logs games-webapp --tail=200 | grep -i "highscore"
```

**Wichtig:** Neue Logs sollten jetzt erscheinen:
- `Admin highscore reset error` → Check Traceback
- `Admin highscore delete error` → Check Traceback
- `topic not found` → Verify Topic-ID in Request

### Problem: 401 obwohl eingeloggt

**Ursachen:**
1. JWT-Cookie abgelaufen (Standard: 3h)
2. Cookie nicht mitgesendet (CORS-Issue, falsche Domain)

**Lösung:** Neu einloggen

### Problem: 403 obwohl Admin

**Ursachen:**
1. User-Rolle in DB ist nicht "admin"
2. JWT-Claims haben falschen Role-Wert

**Check:**
```bash
# SSH auf Prod
docker exec -it games-postgres psql -U postgres -d hispanistica_games

SELECT id, username, role FROM users WHERE username = '<dein_username>';
-- Erwartung: role = 'admin'
```

---

## Logs & Monitoring

Nach erfolgreichem Fix sollten folgende Logs erscheinen:

**Bei erfolgreichem Reset:**
```
INFO Admin reset highscores topic_id=variation_aussprache topic_slug=variation_aussprache deleted_count=5 admin_role=admin
```

**Bei erfolgreichem Delete:**
```
INFO Admin deleted highscore entry topic_id=variation_aussprache topic_slug=variation_aussprache entry_id=abc-123-... admin_role=admin
```

**Bei 404 (Topic nicht gefunden):**
```
WARNING Admin highscore reset failed: topic not found topic_id=invalid_slug admin_role=admin
```

**Bei 404 (Entry nicht gefunden):**
```
WARNING Admin highscore delete failed: entry not found topic_id=variation_aussprache entry_id=invalid-uuid admin_role=admin
```

**Bei 500 (Exception):**
```
ERROR Admin highscore reset error topic_id=variation_aussprache error=... error_type=... admin_role=admin
Traceback (most recent call last):
  ...
```

**Bei 403 (kein Admin):**
```
WARNING [403 Role Debug] Insufficient permissions on POST /api/quiz/admin/topics/.../highscores/reset
```

---

## Abschluss

Nach erfolgreichem Smoke-Test sollte die Funktion in Prod stabil laufen. Bei Problemen:

1. Logs checken: `docker logs games-webapp --tail=100`
2. DB-State verifizieren (User-Rolle, Topic existiert)
3. JWT-Cookie prüfen (Dev-Tools)

**Fertig!** 🎉
