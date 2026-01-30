# Server Agent Prompt (Read-Only)

You are a server-side agent operating on the production-like host. **Do not change system state**. Read-only actions only. **No secrets** must be disclosed in output.

## ⚠️ Scope & Safety (verbindlich)

Dieser Auftrag gilt **ausschließlich** für die Webapp:

    games_hispanistica

Der Server betreibt weitere Webapps.
Diese dürfen **unter keinen Umständen** betrachtet werden.

### Erlaubt
- Dateien, ENV, Logs, Prozesse, DBs,
  **die eindeutig zu games_hispanistica gehören**

### Verboten
- Lesen von ENV anderer Apps
- Scannen übergeordneter Verzeichnisse
- Abfragen fremder Datenbanken
- Lesen fremder Logs
- “Zur Sicherheit alles prüfen”

Wenn etwas nicht eindeutig games_hispanistica ist:
→ **nicht erfassen**, sondern im Bericht vermerken.

## Goals
Produce a report at:
`docs/quiz/refactoring/quiz_refactoring_server.md`

The report must include sections with commands executed and short output excerpts (redacting sensitive data).

## 1) Environment data (no secrets, games_hispanistica only)
- List relevant environment variable **names only** (values must be redacted). Examples:
  - QUIZ_*, CONTENT_*, RELEASE_*, MEDIA_*, DB_*, STORAGE_*, IMPORT_*
- If using systemd/env files, show keys only (no values).
- Only include keys that are **clearly scoped to games_hispanistica**.

## 2) Release/Import/Publish pipeline (games_hispanistica only)
Document:
- Where releases live on disk **for games_hispanistica**.
- How “current” is selected (symlink, db flag, config) **for games_hispanistica**.
- Commands/services used for:
  - rsync upload
  - import
  - publish

## 3) Database facts (read-only, games_hispanistica DB only)
Run read-only queries for:
- `quiz_topics`
- `quiz_questions`
- `quiz_content_releases`
- `quiz_runs`
- `quiz_scores`

Collect counts and active release id (if available). Include commands and short outputs.
Only query the database **used by games_hispanistica**. No cross-DB queries.

## 4) Logs / error patterns (games_hispanistica only)
- Capture recent import-related errors (snippets only, no sensitive data).
- Identify recurring error patterns if present.
- Only use logs from services belonging to games_hispanistica.

## 5) Health / permissions (games_hispanistica only)
- Check read/write permissions for release/media directories (use `stat`/`ls -l` or equivalent).
- Only check paths that **clearly belong to games_hispanistica**.
- **Do not create or modify files** unless explicitly allowed. If a touch-test is not allowed, skip it.

## Output format
Write a clear, sectioned report in:
`docs/quiz/refactoring/quiz_refactoring_server.md`

The report must contain **only** games_hispanistica data. If a source is ambiguous, explicitly note it and skip.

Each section should include:
- Command(s) run
- Short output excerpts
- Notes/observations

## Constraints
- No deploys.
- No config changes.
- No secrets or credentials.
- Read-only operations only.
