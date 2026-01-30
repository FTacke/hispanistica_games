# Refactoring Phase 1b (Content-Migration + DEV Hard-Prune + Single Import)

Stand: 2026-01-29

## Summary
- DEV Hard-Prune Script hinzugefügt (sicherheitsgegate).
- Content-Migration auf Difficulty 1–3 erweitert: erstellt *_v2.json ohne Originals zu ändern, mit Mindest-Check 4/4/2.
- Single-Seed Script hinzugefügt: importiert exakt eine Unit.

## Geänderte Dateien
- scripts/quiz_dev_prune.py (neu)
- scripts/quiz_content_migrate_difficulty_1_3.py (Mapping + *_v2 Output + Min-Check)
- scripts/quiz_seed_single.py (neu)
- docs/quiz/refactoring/refactoring_phase1b.md (neu)

## DEV Hard-Prune (nur DEV!)
### Guard-Regeln
- **Erlaubt** wenn DB-Host `localhost` oder `127.0.0.1`.
- **Erlaubt** wenn DB-Host nicht lokal **und** `ENV=dev` gesetzt **und** `--i-know-what-im-doing` übergeben.
- Sonst **Abbruch**.

### Gelöschte Tabellen (Reihenfolge)
- `quiz_run_answers`
- `quiz_runs`
- `quiz_scores`
- `quiz_questions`
- `quiz_topics`
- `quiz_content_releases`
- `quiz_question_stats`
- `quiz_sessions`
- `quiz_players`

### Output
- Script loggt Vorher-/Nachher-Counts pro Tabelle.

## Content-Migration (Difficulty 1–5 → 1–3)
### Mapping
- 1→1, 2→1, 3→2, 4→2, 5→3

### Verhalten
- Input: content/quiz/topics/*.json (ohne *_v2.json)
- Output: neue Dateien `<basename>_v2.json` im selben Ordner
- Originaldateien bleiben unverändert
- Validierung: `validate_quiz_unit` + **Mindest-Check 4/4/2**
  - Wenn Mindest-Counts nicht erreicht: **Fehler + Exit-Code ≠ 0**
  - `--patch-to-min` existiert, führt aber **nicht** zur Auto-Duplizierung (nur Hinweis)

### Erwartete *_v2.json Dateien
- aussprache_v2.json
- kreativitaet_v2.json
- orthographie_v2.json
- test_quiz_v2.json
- variation_aussprache_v2.json
- variation_grammatik_v2.json
- variation_test_quiz_v2.json

## Single-Import (nur variation_aussprache_v2)
- Script: `scripts/quiz_seed_single.py`
- Importiert und validiert **genau eine** Unit.

## Ablauf (DEV)
1. Hard prune:
   - `python scripts/quiz_dev_prune.py --i-know-what-im-doing`
2. Migration:
   - `python scripts/quiz_content_migrate_difficulty_1_3.py`
3. Single seed:
   - `python scripts/quiz_seed_single.py --file content/quiz/topics/variation_aussprache_v2.json`
4. Browser-Test:
   - `/games/quiz`

## Verifikation (SQL)
- Topics:
  - `SELECT id, is_active FROM quiz_topics;`
- Questions (Difficulty 1–3):
  - `SELECT difficulty, COUNT(*) FROM quiz_questions GROUP BY difficulty ORDER BY difficulty;`
- Sicherstellen, dass **nur** `variation_aussprache` aktiv ist.

## Sicherheits-Gates (Prod-Schutz)
- Hard-Prune Script mit Host/ENV Guard.
- Single-Seed benötigt explizite Datei.
- Keine automatische Ausführung in dev-start.
