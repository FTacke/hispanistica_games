# Refactoring Phase 3d – Dashboard UI (Content Pipeline)

Datum: 2026-01-30

## Ziel
Dashboard-UI für Upload Unit, Release-Handling, Units und Import-Log visuell konsolidieren und vollständig MD3/Token-konform umsetzen, ohne Funktionsänderungen.

## Vorher/Nachher (Screenshots)
> Hinweis: Bitte die Screenshots in docs/quiz/refactoring/assets/ ablegen und die Links aktualisieren.

### Upload Unit
- Vorher: ![Upload Unit – vorher](assets/phase3d_upload_before.png)
- Nachher: ![Upload Unit – nachher](assets/phase3d_upload_after.png)

### Releases
- Vorher: ![Releases – vorher](assets/phase3d_releases_before.png)
- Nachher: ![Releases – nachher](assets/phase3d_releases_after.png)

### Units
- Vorher: ![Units – vorher](assets/phase3d_units_before.png)
- Nachher: ![Units – nachher](assets/phase3d_units_after.png)

## Geänderte Dateien
- [docs/quiz/refactoring/refactoring_phase3d_dashboard_ui.md](refactoring_phase3d_dashboard_ui.md)
- [templates/admin/quiz_content.html](../../../templates/admin/quiz_content.html)
- [static/css/admin/quiz_content.css](../../../static/css/admin/quiz_content.css)
- [static/js/admin/quiz_content.js](../../../static/js/admin/quiz_content.js)
- [static/css/md3/tokens.css](../../../static/css/md3/tokens.css)
- [static/css/app-tokens.css](../../../static/css/app-tokens.css)
- [scripts/md3-lint.py](../../../scripts/md3-lint.py)

## MD3/Token-Compliance – Checkliste
- [x] Keine Inline-Styles im Dashboard-Template
- [x] Keine hardcoded Farben im Dashboard (Token-Guard aktiv)
- [x] Neue Tokens für Section Padding/Gap, Form-Field Heights, Table Row Height, Danger Container, Focus Ring
- [x] Einheitliche SectionCard/SectionToolbar/FormGrid Patterns
- [x] Danger Action mit Dialog, Label und Icon
- [x] Fokus-Ring sichtbar, ARIA-Labels gesetzt

### Lint/Guard Output
```
Running MD3 lint checks...
  Note: Full linting is done via md3-forms-auth-guard.py
✅ MD3 lint passed
```

## Funktionshinweis
Keine Funktionalität geändert – ausschließlich UI, Copy und Accessibility angepasst.

## Test-Plan (manuell)
1. Seite lädt ohne Layout-Regression.
2. Upload JSON + optional Audio weiterhin möglich.
3. Release auswählen/refresh/import/publish/unpublish weiterhin möglich.
4. Units: Suche, Filter, Aktiv Toggle, Reihenfolge ändern, Speichern weiterhin möglich.
5. Delete: Confirm Dialog, Abbrechen funktioniert, Löschen (Soft-Delete) funktioniert.
6. Token-Guard schlägt fehl, wenn Inline-Styles oder hardcoded Farben im Dashboard eingeführt werden.
