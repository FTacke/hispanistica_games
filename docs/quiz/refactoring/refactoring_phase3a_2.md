# Refactoring Phase 3a.2

## Summary
- Server-Agent-Prompt strikt auf die Webapp `games_hispanistica` begrenzt.
- Explizite Verbote ergänzt (keine anderen Apps, keine Parent-Dirs, keine Cross-DB).
- Abschnittsweise Klarstellung: ENV/DB/Logs/Paths nur für `games_hispanistica`.

## Why
- Multi-App-Server: selbst read-only Scans dürfen keine fremden Apps berühren.
- Verhindert versehentlichen Zugriff auf ENV/DB/Logs anderer Services.

## Ergebnis
- Scope ist jetzt sicher begrenzt.
- Phase 3b (Server-Audit) ist freigegeben.

## Dateien
- docs/quiz/refactoring/server_agent_prompt.md
