# Refactoring Phase 3a.1

## Summary
- Öffentlich relevante Quiz-Dokumentation vollständig auf v2 angepasst.
- Legacy-Begriffe (5 Levels, Difficulty 1–5, Tokens, Time-Bonus) entfernt.
- Markdown-Regeln (bold/italic) konsistent verlinkt.

## Geänderte Dateien
- docs/quiz/README.md
- docs/quiz/CONTENT.md
- docs/quiz/ARCHITECTURE.md
- docs/quiz/OPERATIONS.md
- docs/quiz/refactoring/refactoring_plan.md
- docs/quiz/refactoring/refactoring_phase1.md
- docs/quiz/refactoring/refactoring_phase2b.md
- docs/quiz/refactoring/refactoring_phase3a.md
- docs/quiz/refactoring/refactoring_baseline.md

## Entfernte Legacy-Konzepte
- 5 Levels / Difficulty 1–5
- Tokens
- Time-Bonus

## v2-Stand (Kurz)
- 3 Levels: 4 / 4 / 2
- Difficulty: 1–3
- Scoring: Punkte pro Frage + Level-Bonus (nur bei perfektem Level)
- Markdown: **bold**, *italic* (keine Links/HTML)

## Ergebnis
- Docs sind jetzt vollständig v2-konform.
- Server/Admin-Prep ist als nächster Schritt sinnvoll.
