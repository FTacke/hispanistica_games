# Refactoring Phase 3a

## Summary
- Refactoring plan reordered: Phase 3a = Markdown finalisieren, Phase 3b = Server/Admin/Import/Prod-Prep.
- Markdown renderer hardened to allow only **bold** and *italic* with HTML escaping and no nested emphasis.
- Markdown rules documented for content authors.

## Reihenfolge-Änderung (Plan)
- Phase 2 bleibt abgeschlossen (Timer/HUD/Layout).
- Phase 3a ist jetzt der nächste Schritt (Markdown finalisieren).
- Phase 3b (Server/Admin/Import/Prod-Prep) startet **erst nach 3a**.
- Phase 4 = Stabilität & Bugfixes, Phase 5 = Cleanup & Merge.

## Markdown – Technische Anpassungen
- Renderer escapt HTML zuerst, ersetzt danach nur die Marker:
  - `**bold**` → `<strong>`
  - `*italic*` → `<em>`
- Nested Markdown wird unterbunden (Bold wird vor Italic markiert).
- Einheitlich angewendet in Prompt, Antworten, Erklärung.

## Markdown-Regeln (Kurzfassung)
- Erlaubt: **bold**, *italic*
- Nicht erlaubt: HTML, Links, Nested Markdown, Listen, Headings, Code

## Warum Server/Prod-Prep erst nach 3a?
- Erst wenn Markdown final und dokumentiert ist, lohnt sich die Baseline für Import/Release/Prod.
- So vermeiden wir doppelte Server-Audits.

## Dateien
- static/js/games/quiz-play.js
- docs/quiz/CONTENT_MARKDOWN.md
- docs/quiz/CONTENT.md
- docs/quiz/README.md
- docs/quiz/refactoring/refactoring_plan.md

## How to Verify
1. Quiz öffnen und Prompt/Antwort/Erklärung mit `**bold**` und `*italic*` prüfen.
2. Teste verschachtelte Marker (`**bold *italic***`) – darf **nicht** verschachtelt rendern.
3. Prüfe, dass HTML im Content als Text erscheint (escaped).
