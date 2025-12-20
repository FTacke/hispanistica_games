# MD3 Repair Report – 2025-12-05

## Summary

Systematische MD3-Reparaturrunde durchgeführt, um die MD3-Preflight-Tests beim nächsten Deploy zu bestehen.

**Ausgangslage:** 10 Lint-Fehler, 752 Warnungen  
**Endstand:** 0 Fehler, 752 Warnungen (akzeptable Patterns)

---

## 1. Drawer-Elevation

### Analyse

Der Navigation-Drawer verwendet korrekte MD3-konforme Elevation-Tokens:

```css
/* navigation-drawer.css */
:root {
  --drawer-elevation-open: var(--elev-3);
  --drawer-elevation-closed: none;
}

.drawer__panel {
  box-shadow: var(--drawer-elevation-open, var(--elev-3));
}
```

**Kein Fix erforderlich** – Die Drawer-Elevation ist bereits korrekt implementiert mit:
- Level 3 Elevation während und nach der Animation
- Konsistenter Schatten in allen Zuständen (öffnend, offen, schließend)
- Kein Schatten-Wechsel zwischen Zuständen

---

## 2. Elevation Token Fixes

### Problem

Einige Komponenten verwendeten invalide `--md-sys-elevation-N` Tokens statt der kanonischen `--elev-N` Tokens.

### Fixes

| Datei | Zeile | Alt | Neu |
|-------|-------|-----|-----|
| `atlas.css` | 139 | `--md-sys-elevation-3` | `--elev-3` |
| `menu.css` | 32 | `--md-sys-elevation-2` | `--elev-2` |
| `menu.css` | 120 | `--md-sys-elevation-1` | `--elev-1` |
| `login.css` | 133 | `--md-sys-elevation-1, fallback` | `--elev-1` |
| `login.css` | 234 | `--md-sys-elevation-3, fallback` | `--elev-3` |

---

## 3. Breakpoint Standardisierung

### Problem

Mehrere CSS-Dateien verwendeten non-MD3 Breakpoints (768px) statt der offiziellen MD3 Window-Class Grenzen.

### MD3 Breakpoints

| Window Class | Breakpoint | Verwendung |
|--------------|------------|------------|
| Compact | 0-599px | Mobile |
| Medium | 600-839px | Tablet |
| Expanded | ≥840px | Desktop |

### Fixes

Folgende Dateien wurden von `768px` auf `839px` geändert:

- `auth.css` – Admin Toolbar Mobile Styles
- `mobile-responsive.css` – DataTables Wrapper
- `search-ui.css` – Filters Grid, Responsive Adjustments
- `transcription-shared.css` – Mobile Responsive
- `token-chips.css` – Responsive Anpassungen
- `hero.css` – Medium/Tablet → Expanded Breakpoints (1024px/1025px → 839px/840px)

### Bewusste Ausnahmen

Einige Breakpoints bleiben als **Custom Content Breakpoints**:

- `992px` in `player.css`, `audio-player.css`, `editor.css` – Content-spezifische Layout-Anpassungen für Transkriptions-Container
- `1120px` – Content-Width Breakpoints (nicht Window-Class)
- `1200px` – Extra-Large Content Breakpoints

---

## 4. Alert/Dialog Strukturfixes

### admin_users.html

**Problem:** Error-Alert fehlte `role="alert"`

```html
<!-- Vorher -->
<div id="user-edit-error" class="md3-alert md3-alert--error" hidden>

<!-- Nachher -->
<div id="user-edit-error" class="md3-alert md3-alert--error" role="alert" hidden>
```

### admin_dashboard.html

**Problem:** `role="alert"` war auf Wrapper statt auf Alert-Element

```html
<!-- Vorher -->
<div class="md3-error-banner" id="error-banner" hidden role="alert">
  <article class="md3-card md3-card--outlined md3-error-card">

<!-- Nachher -->
<div class="md3-error-banner" id="error-banner" hidden>
  <article class="md3-card md3-card--outlined md3-error-card md3-alert" role="alert">
```

### cql_guide_dialog.html

**Problem:** Dialog fehlte korrekte MD3-Struktur

**Fixes:**
1. `<div>` → `<dialog>` Element
2. `md3-dialog__surface` Wrapper hinzugefügt
3. `md3-dialog__content` korrekt geschlossen
4. `md3-dialog__actions` innerhalb von `md3-dialog__surface` platziert

---

## 5. MD3-Lint Script Fixes

### Regex-Bug

**Problem:** Das Regex `\bmd3-dialog\b` matchte auch `md3-dialog__container`, `md3-dialog__surface`, etc.

**Fix:** Regex geändert zu:
```python
# Nur exakte md3-dialog Klasse matchen (nicht md3-dialog__* oder md3-dialog-*)
dialog_pattern = re.compile(r'<(?:dialog|div)[^>]*class\s*=\s*"[^"]*\bmd3-dialog(?:\s|"|$)[^"]*"[^>]*>', re.I)
```

### Search Window

**Problem:** Such-Fenster von 5000 Zeichen zu klein für große Dialoge

**Fix:** Erhöht auf 8000 Zeichen

---

## 6. Verbleibende Warnungen (752)

### Akzeptierte Patterns

| Regel | Anzahl | Begründung |
|-------|--------|------------|
| MD3-CSS-001 (Hex Colors) | 165 | Meist Fallback-Werte in `var()` |
| MD3-CSS-002 (!important) | 493 | Notwendig für 3rd-Party Overrides |
| MD3-SPACING-002 (Bootstrap Utils) | 92 | Legacy, graduelle Migration |

### Hex-Farben ohne Token

Spezielle semantische Farben für:
- Token-Chips (Pink für Diskurs-Tokens)
- Highlight-Farben für Transkriptions-Bearbeitung
- Dark-Mode-spezifische Farben

**Empfehlung:** Diese sollten langfristig als Custom Properties definiert werden.

---

## 7. Verifizierung

```bash
# MD3 Lint ausführen
python scripts/md3-lint.py

# Erwartet:
# Errors:   0
# Warnings: 752
# Info:     18
```

---

## 8. Nächste Schritte

1. **Hex-Farben tokenisieren** – Custom Properties für semantische Farben definieren
2. **Bootstrap Spacing entfernen** – `m-*` Klassen durch `--space-*` ersetzen
3. **!important reduzieren** – Wo möglich durch höhere Spezifizität ersetzen
4. **DataTables Legacy Cards** – `card` → `md3-card` Migration

---

## Betroffene Dateien

### CSS
- `static/css/md3/components/atlas.css`
- `static/css/md3/components/auth.css`
- `static/css/md3/components/hero.css`
- `static/css/md3/components/login.css`
- `static/css/md3/components/menu.css`
- `static/css/md3/components/mobile-responsive.css`
- `static/css/md3/components/search-ui.css`
- `static/css/md3/components/token-chips.css`
- `static/css/md3/components/transcription-shared.css`

### HTML Templates
- `templates/auth/admin_users.html`
- `templates/pages/admin_dashboard.html`
- `templates/search/partials/cql_guide_dialog.html`

### Scripts
- `scripts/md3-lint.py`
