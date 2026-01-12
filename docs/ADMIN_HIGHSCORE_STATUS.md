# Admin Highscore Fix – Status & Next Steps

**Datum:** 2026-01-12  
**Status:** 🟡 Auth Fixed → 🔴 **500 Error – TRACEBACK ERFORDERLICH**

---

## Current State

### ✅ PHASE 1 BEHOBEN: HTTP 503 Auth Error

**Problem:**
- `POST /api/quiz/admin/topics/<slug>/highscores/reset` → 503
- `DELETE /api/quiz/admin/topics/<slug>/highscores/<id>` → 503
- Fehlertext: "Admin auth not configured"

**Root Cause:**
- Custom `webapp_admin_required` Decorator mit ENV-Fallback
- `QUIZ_ADMIN_KEY` in Prod nicht gesetzt

**Fix (DEPLOYED):**
```python
@jwt_required()           # ✅ Standard Auth
@require_role(Role.ADMIN) # ✅ Standard RBAC
```

**Frontend:**
```javascript
credentials: 'same-origin'  // ✅ JWT-Cookies senden
```

**Result:** Auth funktioniert (401/403 korrekt)

---

### 🔴 PHASE 2 AKTUELL: HTTP 500 Internal Server Error

**Problem:**
- Nach Auth-Fix: Beide Endpoints liefern 500
- Auth-Check funktioniert (keine 401/403)
- Aber: Exception im Handler/DB-Layer

**Root Cause:** **UNBEKANNT** (kein Traceback verfügbar)

**Nächster Schritt:** **TRACEBACK ERFASSEN**

---

## KRITISCH: Kein Fix ohne Traceback!

**Warum wir den Traceback brauchen:**

| Was wir NICHT wissen | Mögliche Ursachen |
|---------------------|-------------------|
| Exception-Typ? | `StatementError`, `DataError`, `IntegrityError`, `AttributeError`, ... |
| Welche Zeile crasht? | `session.execute()`, `commit()`, `QuizScore.id == entry_id`, ... |
| Warum crasht es? | UUID-Casting, DB-Connection, Session-State, Model-Issue, ... |

**→ Spekulation ist gefährlich!**

Spekulatives Error-Handling (try-except ohne Root-Cause) versteckt den echten Fehler.

---

## Next Steps

### 1. Traceback erfassen

**Guide:** [ADMIN_HIGHSCORE_TRACEBACK_CAPTURE.md](ADMIN_HIGHSCORE_TRACEBACK_CAPTURE.md)

**Schnellstart:**
```bash
# SSH auf Prod
ssh root@games.hispanistica.com

# Live-Logs
docker logs games-webapp --tail=50 -f

# Im Browser: Reset/Delete klicken
# → Traceback im Terminal beobachten
```

### 2. Root Cause identifizieren

Nach Traceback-Analyse entscheiden:

**Scenario A: UUID-String-Mismatch** (sehr wahrscheinlich)
```
StatementError: badly formed hexadecimal UUID string
→ entry_id ist String, QuizScore.id ist UUID
→ Fix: UUID(entry_id) parsen
```

**Scenario B: Session Rollback fehlt**
```
InvalidRequestError: transaction has been rolled back
→ Exception rollbackt Session, nächster Request crasht
→ Fix: session.rollback() in except
```

**Scenario C: Anderes**
```
→ Siehe Traceback-Guide für weitere Szenarien
```

### 3. Minimalen Fix implementieren

**ERST NACH TRACEBACK:**
- Zielgerichteter Fix (z.B. UUID-Parse wenn nötig)
- Keine spekulativen try-except Blöcke
- Test dass 500 weg ist

---

## Wahrscheinliche Fixes (NACH Traceback-Bestätigung)

### Fix A: UUID-String-Mismatch

```python
from uuid import UUID

def parse_uuid_or_400(value: str):
    try:
        return UUID(value)
    except ValueError:
        abort(400, description="Invalid ID")

# Im DELETE-Endpoint:
entry_uuid = parse_uuid_or_400(entry_id)
stmt = delete(QuizScore).where(
    and_(
        QuizScore.id == entry_uuid,  # ✅
        QuizScore.topic_id == topic.id
    )
)
```

### Fix B: Session Rollback

```python
try:
    with get_session() as session:
        # ... operations
        session.commit()
except Exception:
    session.rollback()  # ✅
    raise
```

---

## Files Changed (Phase 1 only)

### Backend
- `game_modules/quiz/routes.py`
  - Custom `webapp_admin_required` entfernt
  - `@jwt_required()` + `@require_role(Role.ADMIN)` hinzugefügt
  - Minimales Logging (Warning bei 404, Info bei Success)

### Frontend
- `static/js/games/quiz-entry.js`
  - `credentials: 'same-origin'` zu fetch-Requests

---

## Deployment Status

**Phase 1 (Auth-Fix):**
- ✅ Code geändert
- ⏸️ Nicht deployed (warten auf vollständigen Fix)

**Phase 2 (500-Fix):**
- ⏸️ Warte auf Traceback
- ⏸️ Dann: Fix implementieren
- ⏸️ Dann: Deploy + Test

---

## Error-Status Matrix

| Szenario | Aktuell (Prod) | Nach Auth-Fix | Nach Vollständigem Fix |
|----------|----------------|---------------|------------------------|
| Nicht eingeloggt | 503 | 401 ✅ | 401 ✅ |
| Eingeloggt, kein Admin | 503 | 403 ✅ | 403 ✅ |
| Admin, alles OK | 503 | **500** ❌ | 200/204 (Ziel) |
| Admin, Topic fehlt | 503 | **500** ❌ | 404 (Ziel) |
| Admin, Entry fehlt | 503 | **500** ❌ | 404 (Ziel) |

---

## Related Docs

- 📋 [Traceback-Capture-Guide](ADMIN_HIGHSCORE_TRACEBACK_CAPTURE.md) - **START HERE**
- 🧪 [Smoke-Test-Guide](ADMIN_HIGHSCORE_FIX_SMOKE_TEST.md) - Nach vollständigem Fix
- 📝 [CHANGELOG](../CHANGELOG.md) - Wird nach Fix aktualisiert

---

**STATUS: Warte auf Traceback → Dann zielgerichteter Fix → Dann Deploy**
