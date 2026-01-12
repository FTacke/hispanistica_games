# Deploy Checklist: UTC-Timer Implementation
**Date:** 2026-01-12
**Branch:** Current working branch (same as prod issue)
**Type:** Bug fix + Feature enhancement

---

## PHASE A ✅ COMPLETED - Repo Changes

### Änderungen

#### 1. Backend: AUTO-TIMEOUT in `/state` Endpoint
**File:** `game_modules/quiz/routes.py`

**Change:** Idempotente Server-seitige Timeout-Erstellung beim `/state` API call
- Wenn `is_expired` und kein Answer-Record existiert → automatisch Timeout-Answer erstellen
- `current_index` erhöhen, Timer-Felder clearen
- Dadurch: Refresh nach Timeout zeigt korrekt POST_ANSWER phase

**Zeilen:** ca. 779-825 (neuer AUTO-TIMEOUT Block)

**Warum:** Verhindert, dass User durch Refresh den Timer "umgehen" kann. Server entscheidet autoritativ über Timeout.

#### 2. Docs: AUTO-TIMEOUT dokumentiert
**File:** `docs/quiz-timer-and-resume.md`

**Change:** Pseudo-Code für AUTO-TIMEOUT im `/state` Endpoint hinzugefügt (Zeile ~245)

**Warum:** Entwickler-Dokumentation auf dem neuesten Stand halten.

### Was NICHT geändert wurde

- Migration `0012_add_server_based_timer.sql` existiert bereits ✅
- Models haben UTC-Felder bereits ✅
- Services nutzen UTC als Source of Truth bereits ✅
- Frontend respektiert `server_now_ms` / `expires_at_ms` bereits ✅
- Timeout-UI (keine correct-reveal) existiert bereits ✅

### Code-Qualität

- ✅ No linting errors
- ✅ No type errors
- ✅ Idempotent (mehrfache Calls safe)
- ✅ Verwendet bestehende Service-Funktionen

---

## PHASE B - Server Deploy

### B1: Pre-Flight Backup ⚠️ PFLICHT

```powershell
# SSH zum Server
ssh user@games.hispanistica.com

# DB Backup
pg_dump -h localhost -U postgres -d hispanistica_games --schema-only > /tmp/schema_backup_$(date +%Y%m%d_%H%M%S).sql
```

### B2: Migration Status prüfen

```powershell
# Im Container oder auf Server
psql $DATABASE_URL -c "\d quiz_runs"
```

**Erwartete Spalten:**
- `question_started_at` (timestamptz)
- `expires_at` (timestamptz)
- `time_limit_seconds` (integer)

**Falls NICHT vorhanden:**
```powershell
psql $DATABASE_URL -f migrations/0012_add_server_based_timer.sql
```

**Falls BEREITS vorhanden:** ✅ Weiter zu B3

### B3: Code Deploy

```powershell
# Im Projekt-Root auf Server
git fetch origin
git status  # Verify clean state
git pull origin <BRANCH_NAME>  # Same branch as prod issue

# Build & Restart (je nach Setup)
docker-compose build web
docker-compose up -d web

# ODER ohne Docker:
systemctl restart hispanistica_games
```

### B4: Verifikation (PFLICHT) ✅

#### Test 1: Health Check
```powershell
curl -i http://localhost:7000/health
# Expected: 200 OK
```

#### Test 2: Quiz Start
```powershell
curl -i https://games.hispanistica.com/quiz/variation_aussprache
# Expected: 200 OK, renders page
```

#### Test 3: API State Endpoint
```powershell
# Browser DevTools: Start Quiz, inspect /state response
```

**Expected payload:**
```json
{
  "server_now_ms": 1234567890123,
  "expires_at_ms": 1234567920123,
  "remaining_seconds": 28,
  "phase": "ANSWERING",
  "is_expired": false
}
```

#### Test 4: Anti-Cheat (Refresh Resume)
1. Start Quiz
2. Warte ~17 Sekunden
3. **Refresh (F5)**
4. ✅ Expected: Gleiche Frage, Timer bei ~17s (nicht reset zu 30s)

#### Test 5: Server-Side Timeout
1. Start Quiz
2. Warte volle 30+ Sekunden (NICHT beantworten)
3. **Refresh (F5)**
4. ✅ Expected:
   - `phase: "POST_ANSWER"`
   - Alle Antworten locked+inactive
   - Keine correct-reveal
   - "Weiter" Button visible
   - Next question available

#### Test 6: Normal Answer Flow
1. Start Quiz
2. Beantworte innerhalb von 30s
3. Check: Score update, Explanation, Weiter → Next Question

---

## Rollback Plan (Falls Probleme)

### Wenn 500-Error nach Deploy:

```powershell
# 1. Check Logs
docker-compose logs web --tail=100

# 2. Falls ORM-Error wegen fehlender Spalten:
# -> Migration laufen lassen (B2)

# 3. Falls andere Errors:
# -> Rollback zu vorherigem Commit
git reset --hard HEAD~1
docker-compose build web
docker-compose up -d web
```

### Wenn Migration fehlschlägt:

```powershell
# Check ob Spalten teilweise existieren:
psql $DATABASE_URL -c "\d quiz_runs"

# Falls ja: Migration hat "IF NOT EXISTS" → safe to re-run
psql $DATABASE_URL -f migrations/0012_add_server_based_timer.sql
```

---

## Success Criteria ✅

- [ ] Health endpoint: 200 OK
- [ ] Quiz page renders without errors
- [ ] `/state` API returns `server_now_ms`, `expires_at_ms`, `phase`
- [ ] Refresh während Timer: Timer läuft weiter (kein Reset)
- [ ] Timeout: Server erstellt timeout-record automatisch
- [ ] Nach Timeout: POST_ANSWER phase, locked UI, Weiter-Button
- [ ] Score wird korrekt berechnet und angezeigt
- [ ] Keine Console-Errors im Browser

---

## Bekannte Nicht-Issues

- Legacy Felder (`question_started_at_ms`, `deadline_at_ms`) bleiben für Backward-Compatibility
- Frontend zeigt "Keine Erklärung verfügbar" bei Resume nach Timeout → Normal (keine explanation auf refresh)
- Timer kann 1-2s Drift haben bei schlechter Connection → Akzeptabel, da Server entscheidet

---

## Root Cause des Original-500

**Original Issue:** ORM referenzierte `quiz_runs.question_started_at`, aber DB hatte nur `question_started_at_ms`

**Root Cause:** Migration wurde nicht ausgeführt, aber Code-Deploy erfolgte

**Fix:** Sicherstellen dass Migration VOR Code-Deploy läuft (siehe B2)

---

## Commit Message (Vorlage)

```
fix: Add server-side auto-timeout for quiz timer on /state endpoint

- AUTO-TIMEOUT: /state endpoint creates timeout record if expired and no answer exists
- Prevents refresh-cheat: server advances run state automatically on timeout
- Idempotent: safe to call multiple times
- Uses existing UTC timer infrastructure (migration 0012)

Resolves: #XXX (500 error after container hotfix)
Related: UTC timer implementation, anti-cheat measures

Files changed:
- game_modules/quiz/routes.py (AUTO-TIMEOUT logic)
- docs/quiz-timer-and-resume.md (documentation)
```

---

**WICHTIG:** Alle Änderungen sind im Branch. Kein "Container-Hotfix" mehr! Alles reproduzierbar via Git.
