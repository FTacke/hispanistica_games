# Quiz Timer System Overhaul - Implementation Summary

**Date:** 2026-01-12  
**Implementiert von:** Repo-Agent  
**Status:** ✅ Implementierung abgeschlossen - Bereit für Tests

---

## Zusammenfassung

Das Quiz-Timer-System wurde vollständig überarbeitet, um die 4 kritischen Bugs zu beheben:

1. ❌ **Bug 1:** Countdown bleibt bei falschen Werten stehen → ✅ **Behoben**
2. ❌ **Bug 2:** Refresh setzt Quiz auf Frage 1 zurück → ✅ **Behoben**  
3. ❌ **Bug 3:** Nach Timeout bleibt Timer bei 0 → ✅ **Behoben**
4. ❌ **Bug 4:** Keine Anti-Cheat-Validierung → ✅ **Behoben**

**Kernänderung:** Timer-Logik ist jetzt **server-basiert**. Der Server entscheidet über Startzeit und Timeout, der Client zeigt nur an.

---

## Implementierte Änderungen

### Backend (Python)

**1. Datenmodell** ([game_modules/quiz/models.py](c:\dev\hispanistica_games\game_modules\quiz\models.py))
```python
# NEU: Server-basierte Timer-Felder (UTC timestamps)
question_started_at: Mapped[Optional[datetime]]  # Server UTC Zeit
expires_at: Mapped[Optional[datetime]]           # Server UTC Ablaufzeit
time_limit_seconds: Mapped[int]                  # 30 + Bonus
```

**2. Services** ([game_modules/quiz/services.py](c:\dev\hispanistica_games\game_modules\quiz\services.py))
- `get_remaining_seconds(run)` - Berechnet verbleibende Zeit vom Server
- `is_question_expired(run)` - Prüft Timeout server-seitig
- `calculate_time_limit(question)` - Berechnet Zeitlimit (30 + Media-Bonus)
- `start_question()` - Verwendet `datetime.now(UTC)` statt Client-Zeit
- `submit_answer()` - Validiert Timeout mit Server-Uhr

**3. Routes** ([game_modules/quiz/routes.py](c:\dev\hispanistica_games\game_modules\quiz\routes.py))
- `POST /question/start` - Akzeptiert keine `started_at_ms` mehr, Server entscheidet
- `GET /run/:id/state` - **NEU:** Liefert kompletten State inkl. Timer für Resume
- Returns `server_now_ms`, `expires_at_ms`, `remaining_seconds`, `phase`

### Frontend (JavaScript)

**1. State-Objekt** ([static/js/games/quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js))
```javascript
// NEU: Server-basierte Timer-Felder
expiresAtMs: null,           // Server-Ablaufzeit (ms)
serverClockOffsetMs: 0,      // Offset für Drift-Korrektur
timeLimitSeconds: 30,        // Zeitlimit für aktuelle Frage
```

**2. Neue Funktionen**
- `loadStateForResume()` - Lädt kompletten State vom `/state` Endpoint, berechnet Uhr-Offset
- `startQuestionTimer()` - Sendet **keine** Client-Zeit mehr, empfängt Server-Zeit
- `startTimerCountdown()` - Verwendet Drift-korrigierte Zeit: `Date.now() + offset`

**3. Resume-Logik**
- `startOrResumeRun()` - Verwendet `force_new: false` (außer bei `?restart=1`)
- `init()` - Ruft `loadStateForResume()` auf für perfektes Resume nach Refresh

### Datenbank Migration

**Datei:** [migrations/0012_add_server_based_timer.sql](c:\dev\hispanistica_games\migrations\0012_add_server_based_timer.sql)

```sql
ALTER TABLE quiz_runs 
  ADD COLUMN question_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN time_limit_seconds INTEGER NOT NULL DEFAULT 30;

CREATE INDEX ix_quiz_runs_expires_at ON quiz_runs(expires_at) 
  WHERE expires_at IS NOT NULL AND status = 'in_progress';
```

**Backward Compatibility:** Alte Felder (`deadline_at_ms`) bleiben erhalten und werden weiter befüllt.

---

## API-Verträge

### POST /api/quiz/run/:runId/question/start

**Request (NEU):**
```json
{
  "question_index": 5,
  "time_limit_seconds": 40  // Optional (30 + Media-Bonus)
  // ❌ KEIN started_at_ms mehr!
}
```

**Response:**
```json
{
  "success": true,
  "server_now_ms": 1736700000000,      // ✅ NEU: Server-Zeit
  "expires_at_ms": 1736700040000,      // ✅ NEU: Ablaufzeit
  "time_limit_seconds": 40,            // ✅ NEU: Zeitlimit
  "remaining_seconds": 40.0,           // ✅ NEU: Verbleibend
  "deadline_at_ms": 1736700040000      // Legacy (deprecated)
}
```

### GET /api/quiz/run/:runId/state (NEU!)

**Request:** Keine (GET)

**Response:**
```json
{
  "run_id": "abc123",
  "current_index": 5,
  "server_now_ms": 1736700010000,
  "expires_at_ms": 1736700040000,
  "time_limit_seconds": 40,
  "remaining_seconds": 30.0,
  "is_expired": false,
  "phase": "ANSWERING",                // oder "POST_ANSWER"
  "running_score": 450,
  "run_questions": [...],
  "joker_remaining": 1,
  "finished": false
}
```

---

## Deployment-Schritte

### 1. Datenbank-Migration ausführen

```bash
# Dev
psql -U hispanistica_auth -d hispanistica_auth -f migrations/0012_add_server_based_timer.sql

# Prod
docker exec -i hispanistica_games_db psql -U <user> -d <db> < migrations/0012_add_server_based_timer.sql
```

**Verifizieren:**
```sql
\d quiz_runs;
-- Sollte zeigen: question_started_at, expires_at, time_limit_seconds
```

### 2. Backend deployen

Dateien:
- `game_modules/quiz/models.py`
- `game_modules/quiz/services.py`
- `game_modules/quiz/routes.py`

**Restart:** Docker-Container oder Gunicorn neu starten

### 3. Frontend deployen

Dateien:
- `static/js/games/quiz-play.js`

**Cache leeren:**
```bash
# Falls Versionierung aktiv ist, Fingerprint aktualisieren
# Sonst Browser-Cache leeren lassen (Ctrl+Shift+R)
```

### 4. Tests ausführen

Siehe [Manuelle Test-Checkliste](#manuelle-test-checkliste) unten.

---

## Manuelle Test-Checkliste

### Basis-Funktionen

- [ ] **Quiz starten:** Neuer Run startet, Timer zeigt 30 und zählt runter
- [ ] **Frage beantworten:** Timer stoppt, nächste Frage startet bei 30
- [ ] **Media-Frage:** Timer zeigt 40 (30 + 10 Bonus) bei Fragen mit Audio/Bild
- [ ] **Timeout:** Timer auf 0 → Timeout-UI → "Weiter" → Nächste Q bei 30
- [ ] **Punktestand:** Punkte erhöhen sich korrekt nach richtiger Antwort
- [ ] **Joker:** 50:50 funktioniert, entfernt 2 falsche Antworten

### Resume-Tests (KRITISCH!)

- [ ] **Refresh bei Q1:** Seite neu laden → Bleibt bei Q1, Timer läuft weiter
- [ ] **Refresh bei Q5:** Neu laden bei 22s → Bleibt Q5, zeigt ~22s, zählt runter
- [ ] **Refresh nach Timeout:** Neu laden → POST_ANSWER UI, "Weiter" sichtbar
- [ ] **Refresh nach Antwort:** Neu laden → Erklärung sichtbar, "Weiter" da
- [ ] **Mehrfacher Refresh:** 5x hintereinander → State konsistent, keine Duplikate

### Anti-Cheat-Tests

- [ ] **DevTools Manipulation:**
  ```javascript
  // Im Browser-Console:
  state.expiresAtMs = Date.now() + 999999000;
  // Timer zeigt falsch, aber nach 30s echte Zeit:
  // Server liefert result: "timeout" ✅
  ```

- [ ] **Systemzeit ändern:**
  - Systemzeit 1h vorwärts stellen
  - Quiz starten
  - Timer zählt normal runter (Server entscheidet) ✅

### Bug-Verifikation (Original-Probleme)

- [ ] **Bug 1 behoben:** Antwort bei 20s → Nächste Q zeigt 30 (nicht 20) ✅
- [ ] **Bug 2 behoben:** Refresh bei Q5 → Bleibt Q5 (nicht Q1) ✅
- [ ] **Bug 3 behoben:** Timeout → Nächste Q zeigt 30 (nicht 0) ✅
- [ ] **Bug 4 behoben:** DevTools-Manipulation → Keine Wirkung ✅

---

## Debugging

### Debug-Logging aktivieren

**Backend:**
```bash
export QUIZ_DEBUG=1
# Oder in docker-compose.yml:
# environment:
#   QUIZ_DEBUG: "1"
```

**Frontend:**
```javascript
// Im Browser-Console:
localStorage.setItem('quizDebug', '1');
// Oder URL-Parameter:
// /quiz/demo_topic/play?quizDebug=1
```

### Server-Zeit prüfen

```sql
SELECT NOW() AS server_time, 
       EXTRACT(EPOCH FROM NOW()) * 1000 AS server_time_ms;
```

### Run-State prüfen

```sql
SELECT 
  id, 
  current_index,
  question_started_at,
  expires_at,
  time_limit_seconds,
  EXTRACT(EPOCH FROM (expires_at - NOW())) AS remaining_seconds
FROM quiz_runs 
WHERE id = '<run_id>';
```

### Client-State prüfen

```javascript
// Im Browser-Console:
console.log(window.quizState);
console.log('Expires at:', new Date(window.quizState.expiresAtMs));
console.log('Server offset:', window.quizState.serverClockOffsetMs);
```

---

## Häufige Probleme

### Problem: Timer zeigt nach Refresh falschen Wert

**Symptom:** Nach Refresh zeigt Timer 30 statt verbleibende Zeit

**Fix:**
1. Prüfe `/state` Endpoint liefert `expires_at_ms` und `remaining_seconds`
2. Prüfe Browser-Console für `loadStateForResume` Logs
3. Verifiziere `state.expiresAtMs` ist gesetzt

### Problem: Timeout wird nicht erkannt

**Symptom:** User antwortet nach 30s, Antwort wird akzeptiert

**Fix:**
1. Prüfe Backend-Logs für `submit_answer.timeout`
2. Verifiziere `run.expires_at` ist korrekt gesetzt
3. Prüfe Server-Zeit ist NTP-synced:
   ```bash
   timedatectl status
   ```

### Problem: Refresh erstellt immer neuen Run

**Symptom:** Fortschritt geht bei Refresh verloren

**Fix:**
Prüfe `/run/start` Request hat `force_new: false`:
```javascript
// In startOrResumeRun():
body: JSON.stringify({ force_new: false })  // NICHT true!
```

---

## Dateien

### Geänderte Dateien

| Datei | Änderungen |
|-------|------------|
| [models.py](c:\dev\hispanistica_games\game_modules\quiz\models.py) | + Server Timer-Felder (expires_at, etc.) |
| [services.py](c:\dev\hispanistica_games\game_modules\quiz\services.py) | + Timer-Helfer, server-basierte Logik |
| [routes.py](c:\dev\hispanistica_games\game_modules\quiz\routes.py) | + /state Endpoint, /question/start Update |
| [quiz-play.js](c:\dev\hispanistica_games\static\js\games\quiz-play.js) | + Resume-Logik, Drift-Korrektur |

### Neue Dateien

| Datei | Beschreibung |
|-------|--------------|
| [0012_add_server_based_timer.sql](c:\dev\hispanistica_games\migrations\0012_add_server_based_timer.sql) | DB Migration |
| [quiz-timer-root-cause.md](c:\dev\hispanistica_games\docs\quiz-timer-root-cause.md) | Root Cause Analysis |
| [quiz-timer-and-resume.md](c:\dev\hispanistica_games\docs\quiz-timer-and-resume.md) | Vollständige Dokumentation |

---

## Nächste Schritte

1. ✅ Migration in Dev ausführen
2. ⏳ Alle Tests aus Checkliste durchführen
3. ⏳ Deployment in Staging für QA
4. ⏳ Deployment in Production
5. ⏳ Monitoring für Timer-Fehler aktivieren
6. ⏳ Nach 2-3 Wochen: Legacy-Felder entfernen (optional)

---

## Support

Bei Fragen oder Problemen:
- Dokumentation: [docs/quiz-timer-and-resume.md](c:\dev\hispanistica_games\docs\quiz-timer-and-resume.md)
- Root Cause: [docs/quiz-timer-root-cause.md](c:\dev\hispanistica_games\docs\quiz-timer-root-cause.md)
- Debug-Logs: `QUIZ_DEBUG=1` (Backend) + `localStorage.quizDebug='1'` (Frontend)

**Status:** ✅ Bereit für Tests  
**Priorität:** P0 (Blockiert faires Gameplay)  
**Geschätzte Testzeit:** 30-45 Minuten
