# QUIZ UI FREEZE - BEWEIS & ROOT CAUSE

**Datum:** 2026-01-12  
**Status:** 🔴 BESTÄTIGT - `@quiz_auth_required` blockiert Anonymous-Zugriff

---

## SCHRITT 1: BEWEIS / ROOT CAUSE

### 1.3 Code-Review (da lokaler Server instabil)

**File:** `game_modules/quiz/routes.py`

#### Auth Decorator (Zeile 77-91):
```python
def quiz_auth_required(f: Callable) -> Callable:
    """Decorator to require quiz player authentication."""
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        token = request.cookies.get(QUIZ_SESSION_COOKIE)
        if not token:
            return jsonify({"error": "Authentication required", "code": "AUTH_REQUIRED"}), 401
        # ...
```

**Problem:** Kein Session-Cookie → **401 Unauthorized**

#### Betroffene Endpoints (alle haben `@quiz_auth_required`):

1. **POST /api/quiz/<topic_id>/run/start** (Zeile 428-429)
   ```python
   @blueprint.route("/api/quiz/<topic_id>/run/start", methods=["POST"])
   @quiz_auth_required  # ❌ BLOCKS ANONYMOUS
   ```
   **Erwartete Response OHNE Cookie:** `401 {"error": "Authentication required", "code": "AUTH_REQUIRED"}`

2. **GET /api/quiz/run/<run_id>/state** (Zeile 754-755)
   ```python
   @blueprint.route("/api/quiz/run/<run_id>/state", methods=["GET"])
   @quiz_auth_required  # ❌ BLOCKS ANONYMOUS
   ```
   **Erwartete Response OHNE Cookie:** `401 {"error": "Authentication required", "code": "AUTH_REQUIRED"}`

3. **POST /api/quiz/run/<run_id>/question/start** (Zeile 545-546)
   ```python
   @blueprint.route("/api/quiz/run/<run_id>/question/start", methods=["POST"])
   @quiz_auth_required  # ❌ BLOCKS ANONYMOUS
   ```
   **Erwartete Response OHNE Cookie:** `401 {"error": "Authentication required", "code": "AUTH_REQUIRED"}`

4. **POST /api/quiz/run/<run_id>/answer** (Zeile 595-596)
5. **POST /api/quiz/run/<run_id>/joker** (Zeile 914-915)
6. **POST /api/quiz/run/<run_id>/finish** (Zeile 964-965)

### 1.4 Frontend-Konsequenzen

**File:** `static/js/games/quiz-play.js`

Wenn API-Calls 401 zurückgeben:

1. **Run Start fehlschlägt:**
   - Kein `run_id` → kein State
   - Frontend fällt zurück auf Default-State

2. **State Load fehlschlägt:**
   - `expires_at_ms` bleibt `null`
   - `phase` hat falschen Wert

3. **Timer Start fehlschlägt:**
   - `startQuestionTimer()` (Zeile 1372) → 401
   - Timer wird NIE gestartet
   - Countdown bleibt bei 30 (oder 0)

4. **UI Rendering:**
   - Kein Timer → Countdown frozen ❌
   - Answers locked (defensive programming) ❌
   - Explanation zeigt sofort (Fallback-UI) ❌

---

## ROOT CAUSE ZUSAMMENFASSUNG

**Problem:** `@quiz_auth_required` fordert Session-Cookie für ALLE Quiz-Play API-Endpoints.

**Fehlererkette:**
1. Anonymous User öffnet `/quiz/<topic>` → Kein Session-Cookie
2. Frontend: `POST /run/start` → **401 Unauthorized**
3. Frontend: `GET /state` → **401 Unauthorized**
4. Frontend: `POST /question/start` → **401 Unauthorized**
5. **UI friert ein:** Kein Timer, keine Interaktion, Explanation sofort sichtbar

**Warum nicht früher aufgefallen:**
- Prod-Server hatte evtl. bereits Sessions für alle User
- Dev-Setup mit Admin-Login maskierte das Problem
- Anonym-Modus wurde nicht getestet

---

## NÄCHSTER SCHRITT

Siehe FIX-Strategie in nächster Datei.
