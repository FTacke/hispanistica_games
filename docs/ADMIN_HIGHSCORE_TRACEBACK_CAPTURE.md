# Admin Highscore 500 Error – Traceback Capture Guide

**CRITICAL:** Bevor irgendein Fix implementiert wird, MUSS der echte Traceback erfasst werden!

---

## Problem

Nach Auth-Fix (503 → 401/403) liefern beide Endpoints jetzt **HTTP 500**:
- `POST /api/quiz/admin/topics/<slug>/highscores/reset`
- `DELETE /api/quiz/admin/topics/<slug>/highscores/<id>`

**Grund unbekannt** → Traceback erfassen ist **Pflicht**!

---

## Phase 1: Traceback sichern (PFLICHT)

### Option A: Live-Monitoring via Docker Logs

**Auf Prod-Server:**

```bash
# SSH einloggen
ssh root@games.hispanistica.com

# Container-Logs live anzeigen (tail -f Modus)
docker logs games-webapp --tail=50 -f
```

**Im Browser (als Admin eingeloggt):**
1. Gehe zur Quiz-Rangliste: `/games/quiz/variation_aussprache`
2. Klick "Rangliste" Tab
3. Klick **"Zurücksetzen"** Button
4. **BEOBACHTE Terminal** → Python Traceback sollte erscheinen

**Erwartetes Output-Pattern:**
```
[2026-01-12 ...] ERROR in app: Exception on /api/quiz/admin/topics/variation_aussprache/highscores/reset [POST]
Traceback (most recent call last):
  File ".../site-packages/flask/app.py", line ..., in wsgi_app
    response = self.full_dispatch_request()
  File ".../game_modules/quiz/routes.py", line 1374, in api_admin_reset_highscores
    ...
  <HIER IST DIE KRITISCHE ZEILE UND EXCEPTION>
sqlalchemy.exc.StatementError: ...
OR
sqlalchemy.exc.DataError: ...
OR
AttributeError: ...
OR
...
```

**Wiederholen für DELETE:**
1. Klick Trash-Icon 🗑️ bei einem Eintrag
2. Beobachte Terminal für zweiten Traceback

### Option B: Logs nach dem Fehler holen

Wenn Live-Monitoring nicht möglich:

```bash
# Trigger Errors im Browser (Reset + Delete)
# Dann:
docker logs games-webapp --tail=300 > /tmp/highscore_error.log

# Download log
scp root@games.hispanistica.com:/tmp/highscore_error.log .

# Suche nach Traceback
grep -A30 "Exception on.*highscores" highscore_error.log
```

---

## Phase 2: Traceback analysieren

**Kritische Informationen extrahieren:**

1. **Exception-Typ:** (Erste Zeile nach "Traceback")
   - `StatementError` → SQL-Query-Problem (z.B. UUID vs String)
   - `DataError` → Datentyp-Mismatch (z.B. String kann nicht zu UUID gecastet werden)
   - `IntegrityError` → FK/Constraint-Verletzung
   - `AttributeError` → Objekt hat Property nicht (z.B. `topic` ist None)
   - `OperationalError` → DB-Connection-Problem

2. **Betroffene Zeile:** (In `routes.py`)
   - Welche Zeile crasht? (z.B. `line 1374`)
   - Welche Operation? (z.B. `session.execute(stmt)`, `session.commit()`, `QuizScore.id == entry_id`)

3. **Exception-Message:** (Letzten 1-2 Zeilen)
   - Enthält oft den konkreten Fehler (z.B. "can't adapt type 'str' to UUID")

---

## Wahrscheinliche Root Causes (basierend auf Traceback)

### Scenario A: UUID-String-Mismatch (sehr wahrscheinlich)

**Traceback enthält:**
```
sqlalchemy.exc.StatementError: (builtins.ValueError) badly formed hexadecimal UUID string
OR
psycopg2.errors.InvalidTextRepresentation: invalid input syntax for type uuid: "abc-123-..."
```

**Betroffene Zeile:** `QuizScore.id == entry_id`

**Root Cause:** 
- `entry_id` ist String aus URL
- `QuizScore.id` ist UUID-Typ in DB
- PostgreSQL/psycopg2 kann String nicht implizit zu UUID konvertieren

**Fix:**
```python
from uuid import UUID

# In DELETE-Endpoint BEFORE delete statement:
try:
    entry_uuid = UUID(entry_id)
except ValueError:
    return jsonify({"error": "Invalid entry ID"}), 400

# Then use entry_uuid in query:
stmt = delete(QuizScore).where(
    and_(
        QuizScore.id == entry_uuid,  # ✅ UUID statt String
        QuizScore.topic_id == topic.id
    )
)
```

### Scenario B: Transaction Rollback fehlt

**Traceback enthält:**
```
sqlalchemy.exc.InvalidRequestError: This Session's transaction has been rolled back
```

**Root Cause:**
- Eine Exception in einem Request rollbackt die Session
- Nächster Request nutzt dieselbe Session → crash

**Fix:**
```python
try:
    # ... DB operations
    session.commit()
except Exception as e:
    session.rollback()  # ✅ Cleanup
    logger.exception("Error", extra={...})
    raise  # Re-raise für Flask error handler
```

### Scenario C: QuizScore.id ist falsch definiert

**Traceback enthält:**
```
AttributeError: type object 'QuizScore' has no attribute 'id'
```

**Root Cause:** Model-Definition hat Problem

**Fix:** Check `game_modules/quiz/models.py` → `QuizScore.id` muss existieren

---

## Phase 3: Fix implementieren (ERST NACH TRACEBACK!)

**Basierend auf Traceback-Analyse:**

### Wenn Scenario A (UUID-Mismatch):

1. Füge UUID-Parse-Helper hinzu:
   ```python
   from uuid import UUID
   
   def parse_uuid_or_400(value: str, field_name: str = "ID"):
       try:
           return UUID(value)
       except (ValueError, AttributeError):
           abort(400, description=f"Invalid {field_name} format")
   ```

2. Im DELETE-Endpoint:
   ```python
   entry_uuid = parse_uuid_or_400(entry_id, "entry ID")
   
   stmt = delete(QuizScore).where(
       and_(
           QuizScore.id == entry_uuid,  # ✅
           QuizScore.topic_id == topic.id
       )
   )
   ```

### Wenn Scenario B (Transaction):

Wrappe beide Endpoints:
```python
try:
    with get_session() as session:
        # ... operations
        session.commit()
except Exception as e:
    session.rollback()
    logger.exception("Admin op failed", extra={"topic_id": topic_id})
    return jsonify({"error": "Internal error"}), 500
```

---

## Phase 4: Verify Fix

Nach Deploy:

```bash
# Restart
docker restart games-webapp

# Test Reset
curl -i -X POST \
  -H "Cookie: access_token_cookie=<TOKEN>" \
  https://games.hispanistica.com/api/quiz/admin/topics/variation_aussprache/highscores/reset

# Expected: 200 (not 500!)

# Test Delete
curl -i -X DELETE \
  -H "Cookie: access_token_cookie=<TOKEN>" \
  https://games.hispanistica.com/api/quiz/admin/topics/variation_aussprache/highscores/<UUID>

# Expected: 204 or 404 (not 500!)
```

---

## Acceptance Criteria

- [ ] Traceback erfasst und dokumentiert
- [ ] Root Cause identifiziert (Scenario A/B/C oder anderes)
- [ ] Fix implementiert (minimal, basierend auf Traceback)
- [ ] Deployed + Restarted
- [ ] Smoke-Test: Keine 500er mehr
- [ ] Negative Test: 404 für ungültige IDs (nicht 500)

---

## WICHTIG

**KEIN FIX OHNE TRACEBACK!**

Spekulatives Error-Handling (try-except ohne Root-Cause-Analyse) versteckt den echten Fehler und macht Debugging schwieriger.

Erst Traceback → dann Fix → dann Deploy → dann Verify.
