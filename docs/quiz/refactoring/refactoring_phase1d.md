# Refactoring Phase 1d (DEV Start stabil machen: ENV + Seed-Mode)

Stand: 2026-01-29

## Summary
- dev-start setzt jetzt `ENV=dev` nur im Script-Prozess (keine globalen Änderungen).
- Neues DEV Seed-Mode Routing über `QUIZ_DEV_SEED_MODE` (all/single/none) mit Default-Logik für v2/strict.
- Optionaler Content-Migration-Hook via `QUIZ_DEV_MIGRATE_CONTENT=1`.
- Neuer Helper: `scripts/quiz_dev_reset_v2.ps1` (Prune → Migrate → Single Seed).

## Was war broken (Logauszug)
```
ERROR: Validation failed for aussprache.json: ['Difficulty 1: need at least 4 questions in aussprache.json, got 1', ...]
ERROR: Validation failed for variation_aussprache.json: ["Field 'difficulty' must be 1-3 in variation_aussprache.json Question #13, got 4", ...]
ERROR: Seeding failed: ['aussprache.json: Quiz unit validation failed in aussprache.json - Difficulty 1: need at least 4 questions in aussprache.json, got 1; ...']
```
Ursache: dev-start seedet *alle* Units; viele JSONs sind nicht v2-konform.

**Aktueller Hinweis (aus Support-Check):** Wenn `QUIZ_DEV_SEED_MODE` nicht gesetzt ist
und `QUIZ_MECHANICS_VERSION` nicht auf `v2` steht, fällt dev-start wieder auf `all` zurück
und der Seed schlägt wegen strikter Validatoren fehl. Lösung: `QUIZ_DEV_SEED_MODE=single`
setzen (oder `QUIZ_MECHANICS_VERSION=v2`).

## Fix (ENV handling + Seed-Mode)
### Variante gewählt: A
- dev-start setzt **nur lokal im Prozess** `$env:ENV = 'dev'` wenn nicht gesetzt.
- Prod bleibt unberührt, da nur PowerShell-DEV-Script angepasst.

### Seed-Mode (DEV-only)
- `QUIZ_DEV_SEED_MODE` steuert das Verhalten:
  - `all`: `scripts/quiz_seed.py --prune-soft`
  - `single`: `scripts/quiz_seed_single.py --file content/quiz/topics/variation_aussprache_v2.json`
  - `none`: Seed überspringen
- Default:
  - `single`, wenn `QUIZ_MECHANICS_VERSION=v2` **oder** `QUIZ_STRICT_VALIDATION=1`
  - sonst `all`
- Fehler, wenn `variation_aussprache_v2.json` fehlt → Hinweis: Migration ausführen.

### Optional: Migration vor Seed
- `QUIZ_DEV_MIGRATE_CONTENT=1` führt `scripts/quiz_content_migrate_difficulty_1_3.py` aus.
- Default: aus (keine unerwarteten Files).

## Nutzung (konkret)
### Standard (v2, single seed)
```powershell
$env:QUIZ_MECHANICS_VERSION = 'v2'
$env:QUIZ_DEV_SEED_MODE = 'single'
.\scripts\dev-start.ps1 -UsePostgres
```

**Run-Log (excerpt):**
```
127.0.0.1 - - [29/Jan/2026 19:40:55] "POST /api/quiz/variation_aussprache/run/start HTTP/1.1" 200 -
127.0.0.1 - - [29/Jan/2026 19:41:01] "POST /api/quiz/run/0079254f-b9b7-4701-9c30-beb6dbee9a1b/answer HTTP/1.1" 200 -
```

### Seed all (legacy)
```powershell
$env:QUIZ_DEV_SEED_MODE = 'all'
.\scripts\dev-start.ps1 -UsePostgres
```

### Skip seed
```powershell
$env:QUIZ_DEV_SEED_MODE = 'none'
.\scripts\dev-start.ps1 -UsePostgres
```

### Optional content migration in dev-start
```powershell
$env:QUIZ_DEV_MIGRATE_CONTENT = '1'
.\scripts\dev-start.ps1 -UsePostgres
```

## Helper Script (Reset v2)
```powershell
.\scripts\quiz_dev_reset_v2.ps1
```
Optional mit Server-Start:
```powershell
.\scripts\quiz_dev_reset_v2.ps1 -StartServer
```

## Warum Prod nicht tangiert wird
- Änderungen beschränken sich auf DEV-Skripte (`scripts/dev-start.ps1`, `scripts/quiz_dev_reset_v2.ps1`).
- Keine Änderungen an Import-/Release-Flows oder Produktions-CLIs.
