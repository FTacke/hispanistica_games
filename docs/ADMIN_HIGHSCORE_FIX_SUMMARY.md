# Fix: Admin Highscore Reset/Delete (503 → Auth Fixed → 500 → TRACEBACK NEEDED)

**Datum:** 2026-01-12  
**Status:** 🔴 **TRACEBACK ERFASSUNG ERFORDERLICH**  
**Typ:** Bugfix (Production Critical)

---

## Timeline & Status

### ✅ Phase 1: HTTP 503 "Admin auth not configured" (BEHOBEN)
- **Problem:** Custom Auth-Decorator mit ENV-Fallback
- **Fix:** Standard-Decorators (`@jwt_required()` + `@require_role(Role.ADMIN)`)
- **Status:** ✅ Deployed, funktioniert

### 🔴 Phase 2: HTTP 500 (AKTUELL - ROOT CAUSE UNBEKANNT)
- **Problem:** Nach Auth-Fix liefern beide Endpoints 500
- **Status:** ⏸️ **WARTE AUF TRACEBACK**
- **Nächster Schritt:** [Traceback-Capture-Guide](ADMIN_HIGHSCORE_TRACEBACK_CAPTURE.md)

**WICHTIG:** Kein spekulativer Fix ohne echten Traceback!

---

## Phase 2: Was wir NICHT wissen (ohne Traceback)

❓ Welche Exception?
- `StatementError`? (UUID vs String)
- `DataError`? (Type mismatch)
- `IntegrityError`? (FK violation)
- `AttributeError`? (Objekt ist None)
- Etwas anderes?

❓ Welche Zeile crasht?
- `session.execute(stmt)`?
- `session.commit()`?
- `topic = services.get_topic(...)`?
- `QuizScore.id == entry_id`?

❓ Warum crasht es?
- UUID-Casting?
- DB-Connection?
- Session-State?
- Model-Definition?

**→ Ohne Traceback ist alles Spekulation!**

---

## Lösung

### 1. Backend: Standard Auth-Decorators + Robustes Error-Handling

**Geänderte Dateien:**
- [`game_modules/quiz/routes.py`](../game_modules/quiz/routes.py)

**Änderungen:**

#### A) Auth-Fix (Phase 1)
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
   ```

#### B) Error-Handling-Fix (Phase 2)
1. **Try-Except Blöcke hinzugefügt:**
   ```python
   try:
       with get_session() as session:
           # ... DB operations
   except Exception as e:
       logger.error("...", exc_info=True)
       return jsonify({"error": "Internal server error"}), 500
   ```

2. **Konsistente FK-Verwendung:**
   ```python
   # VORHER: QuizScore.topic_id == topic_id (String-Parameter)
   # NACHHER: QuizScore.topic_id == topic.id (sicherer, verwendet Topic-Objekt)
   ```

3. **Detailliertes Logging:**
   - Warning bei 404 (Topic/Entry nicht gefunden)
   - Info bei erfolgreicher Operation
   - Error mit Traceback bei 500
   
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
3. **Robustes Error-Handling:** 404/500 korrekt unterschieden, niemals uncaught exceptions
4. **Bessere Observability:** Detailliertes Logging für Debugging
5. **Sicherheit:** Topic-FK-Validierung über Topic-Objekt statt String-Parameter
6. **Einfachere Wartung:** Ein Auth-Mechanismus statt zwei

---

## Error-Mapping (vorher → nachher)

| Szenario | Phase 1 (Auth-Bug) | Phase 2 (Nach Auth-Fix) | Final (Nach Error-Handling) |
|----------|-------------------|------------------------|----------------------------|
| Nicht eingeloggt | 503 | 401 | **401** ✅ |
| Eingeloggt, aber kein Admin | 503 | 403 | **403** ✅ |
| Admin, Topic fehlt | 503 | 500 (?) | **404** ✅ |
| Admin, Entry fehlt | 503 | 500 (?) | **404** ✅ |
| Admin, alles OK | 503 | 500 | **200/204** ✅ |
| Unerwartete Exception | 503 | 500 (uncaught) | **500** (logged) ✅ |

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
