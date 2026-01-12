# Fix: Admin Highscore Reset/Delete (503 Error)

**Datum:** 2026-01-12  
**Typ:** Bugfix (Production Critical)  
**Issue:** Admin-Endpoints lieferten HTTP 503 "Admin auth not configured"

---

## Problem

Die Admin-Aktionen **Zurücksetzen** und **Eintrag löschen** in der Quiz-Rangliste lieferten in Produktion:

- **HTTP 503** 
- Fehlertext: *"Admin auth not configured"*
- Betroffen:
  - `POST /api/quiz/admin/topics/<topic_id>/highscores/reset`
  - `DELETE /api/quiz/admin/topics/<topic_id>/highscores/<entry_id>`

---

## Root Cause

Der custom Decorator `webapp_admin_required` in `game_modules/quiz/routes.py` hatte einen **Fallback-Mechanismus**:

1. Wenn `g.role` gesetzt ist (JWT-Auth funktioniert) → Admin-Check
2. Wenn `g.role` None ist → Fallback zu Header-basiertem `X-Admin-Key` + ENV `QUIZ_ADMIN_KEY`
3. **In Prod:** Middleware setzte `g.role` nicht korrekt **UND** `QUIZ_ADMIN_KEY` war nicht konfiguriert → **503 Error**

**Inkonsistenz:** Andere Admin-APIs (`/api/admin/*`, `/quiz-admin/*`) nutzen Standard-Decorators (`@jwt_required()` + `@require_role(Role.ADMIN)`), aber diese beiden Endpoints hatten einen separaten Auth-Layer.

---

## Lösung

### 1. Backend: Standard Auth-Decorators verwenden

**Geänderte Dateien:**
- [`game_modules/quiz/routes.py`](../game_modules/quiz/routes.py)

**Änderungen:**
1. **Imports hinzugefügt:**
   ```python
   from flask_jwt_extended import jwt_required
   from src.app.auth import Role
   from src.app.auth.decorators import require_role
   ```

2. **Custom Decorator entfernt:**
   ```python
   # VORHER: webapp_admin_required()
   # NACHHER: Standard-Pattern wie in allen anderen Admin-APIs
   ```

3. **Endpoints umgestellt:**
   ```python
   @blueprint.route("/api/quiz/admin/topics/<topic_id>/highscores/reset", methods=["POST"])
   @jwt_required()           # ✅ Standard JWT-Check
   @require_role(Role.ADMIN) # ✅ Standard Role-Check
   def api_admin_reset_highscores(topic_id: str):
       # ...
   
   @blueprint.route("/api/quiz/admin/topics/<topic_id>/highscores/<entry_id>", methods=["DELETE"])
   @jwt_required()
   @require_role(Role.ADMIN)
   def api_admin_delete_highscore(topic_id: str, entry_id: str):
       # ...
   ```

### 2. Frontend: JWT-Cookies sicherstellen

**Geänderte Dateien:**
- [`static/js/games/quiz-entry.js`](../static/js/games/quiz-entry.js)

**Änderungen:**
- `credentials: 'same-origin'` zu fetch-Requests hinzugefügt (stellt sicher, dass JWT-Cookies mitgesendet werden)

```javascript
// VORHER:
fetch(`${API_BASE}/admin/topics/${topicId}/highscores/reset`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

// NACHHER:
fetch(`${API_BASE}/admin/topics/${topicId}/highscores/reset`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'same-origin'  // ✅ JWT-Cookies werden mitgesendet
});
```

---

## Vorteile der Lösung

1. **Konsistenz:** Alle Admin-APIs nutzen das gleiche Auth-System
2. **Keine ENV-Abhängigkeiten:** Kein `QUIZ_ADMIN_KEY` mehr nötig
3. **Standard-Fehlerbehandlung:** 401/403 statt 503
4. **Bessere Sicherheit:** Zentrales RBAC über JWT-Claims
5. **Einfachere Wartung:** Ein Auth-Mechanismus statt zwei

---

## Error-Mapping (vorher → nachher)

| Szenario | Vorher | Nachher |
|----------|--------|---------|
| Nicht eingeloggt | 503 | **401** ✅ |
| Eingeloggt, aber kein Admin | 403 | **403** (gleich) |
| Admin | 503 (Bug!) | **200/204** ✅ |
| ENV fehlt | 503 | **N/A** (ENV nicht mehr nötig) |

---

## Testing

**Smoke-Test-Guide:** [`docs/ADMIN_HIGHSCORE_FIX_SMOKE_TEST.md`](ADMIN_HIGHSCORE_FIX_SMOKE_TEST.md)

**Minimaler Acceptance-Test:**
1. Als Admin einloggen
2. Zur Quiz-Rangliste navigieren
3. "Zurücksetzen" klicken → **200, Liste leer**
4. Einzelnen Eintrag löschen → **204, Eintrag weg**

**Security-Test:**
- Als Nicht-Admin: **403**
- Nicht eingeloggt: **401**

---

## Deployment-Hinweise

1. **Code deployen** (Git-Pull + Container-Restart)
2. **Kein ENV-Update nötig** (QUIZ_ADMIN_KEY kann entfernt werden, falls gesetzt)
3. **Keine DB-Migration nötig**
4. **Smoke-Test ausführen** (siehe Doku oben)

---

## Rollback-Plan

Falls Probleme auftreten:

```bash
# 1. Alten Commit identifizieren
git log --oneline | grep "highscore"

# 2. Rollback
git revert <commit-hash>
docker restart games-webapp

# 3. Verify
curl -i https://games.hispanistica.com/health
```

**ABER:** Fix ist minimal und sicher → Rollback sollte nicht nötig sein.

---

## Betroffene Komponenten

- ✅ Backend: `game_modules/quiz/routes.py` (Admin-Endpoints)
- ✅ Frontend: `static/js/games/quiz-entry.js` (fetch-Calls)
- ✅ Auth: Nutzt existierende `src/app/auth/*` Infrastruktur

---

## Related Docs

- [Auth Component](components/auth/README.md) - JWT + RBAC System
- [Admin API](components/admin-api/README.md) - Standard Admin-Endpoints
- [Quiz Admin](components/admin-api/admin_upload_plan.md) - Quiz-Content-Management

---

**Status:** ✅ Fix implementiert, bereit für Deploy
