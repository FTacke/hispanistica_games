# MD3 Komponenten-Checklist (Definition of Done)

> **Version:** 1.0  
> **Stand:** 2025-01-27

Diese Checkliste MUSS für jede neue Komponente oder Template-Änderung abgearbeitet werden.

---

## 🔲 1. Token-Verwendung

- [ ] Nur kanonische Tokens verwendet (`--md-sys-color-*`, `--space-*`, `--radius-*`, `--elev-*`)
- [ ] Keine `--md3-*` Legacy-Tokens
- [ ] Keine hardcoded Farben (`#fff`, `rgb()`, etc.)
- [ ] Keine hardcoded Abstände (`16px`, `1rem`, etc.)
- [ ] Keine hardcoded Border-Radien

---

## 🔲 2. Typografie

- [ ] Alle Headlines verwenden MD3 Type-Scale (`.md3-headline-*`, `.md3-title-*`)
- [ ] Body-Text verwendet `.md3-body-large` oder `.md3-body-medium`
- [ ] Labels verwenden `.md3-label-*`
- [ ] Keine inline `font-size` Styles

---

## 🔲 3. Button-Konformität

- [ ] Nur kanonische Varianten: `--filled`, `--outlined`, `--text`, `--tonal`, `--danger`
- [ ] Keine Legacy: `--contained`, `--destructive`
- [ ] Keine Bootstrap: `.btn-*`
- [ ] Icon-Buttons haben `aria-label`
- [ ] Max. 1 `--filled` Button pro Action-Zone

---

## 🔲 4. Card-Struktur

- [ ] Card verwendet `.md3-card` mit Variante (`--outlined`, `--tonal`, `--elevated`)
- [ ] Header in `.md3-card__header`
- [ ] Content in `.md3-card__content`
- [ ] Actions in `.md3-card__actions` (nicht in content!)
- [ ] Keine direkte Verwendung von `<div class="card">`

---

## 🔲 5. Dialog-Struktur

- [ ] Native `<dialog>` Element verwendet
- [ ] Klasse `.md3-dialog` angewandt
- [ ] `role="dialog"` und `aria-modal="true"` gesetzt
- [ ] `aria-labelledby` zeigt auf Title-ID
- [ ] Actions in `.md3-dialog__actions`
- [ ] Cancel-Button ist `.md3-button--text`
- [ ] Confirm-Button ist `.md3-button--filled`

---

## 🔲 6. Table-Struktur

- [ ] Wrapper: `.md3-table-wrapper`
- [ ] Table: `.md3-data-table`
- [ ] Clickable Rows: `.md3-table__row--clickable`
- [ ] Empty State: `.md3-table-empty-state`
- [ ] Actions: `.md3-table__actions-zone`

---

## 🔲 7. Alerts & Feedback

- [ ] Inline-Alerts: `.md3-alert` mit Variante (`--info`, `--success`, `--warning`, `--error`)
- [ ] Snackbar für transiente Meldungen
- [ ] `role="alert"` für wichtige Meldungen
- [ ] Icon hat `aria-hidden="true"`

---

## 🔲 8. Spacing & Layout

- [ ] Abstände mit `--space-*` Tokens
- [ ] Container-Padding: `--space-6` (Standard)
- [ ] Section-Gap: `--space-8`
- [ ] Compact-Spacing: `--space-3` oder `--space-4`
- [ ] Keine Margin auf erste/letzte Kinder (`:first-child`, `:last-child`)

---

## 🔲 9. Elevation

- [ ] Cards: `--elev-1` (elevated) oder none (outlined)
- [ ] Dialogs: `--elev-3`
- [ ] Menus: `--elev-2`
- [ ] Hover-States erhöhen Elevation um 1 Stufe
- [ ] Keine hardcoded `box-shadow`

---

## 🔲 10. Motion & Transitions

- [ ] Transitions verwenden Motion-Tokens
- [ ] Standard: `--md-motion-duration-short4` + `--md-motion-easing-standard`
- [ ] Dialog-Entrance: `--md-motion-duration-medium2` + `--md-motion-easing-decelerate`
- [ ] Keine `transition: all`
- [ ] `prefers-reduced-motion` wird respektiert

---

## 🔲 11. Accessibility (PFLICHT!)

### Focus
- [ ] `:focus-visible` Outline sichtbar
- [ ] Outline: `2px solid var(--md-sys-color-primary)`
- [ ] `outline-offset: 2px`

### ARIA
- [ ] Icon-Buttons haben `aria-label`
- [ ] Dekorative Icons haben `aria-hidden="true"`
- [ ] Dialoge haben `aria-modal="true"`
- [ ] Tabs haben `role="tab"`, `role="tablist"`, `aria-selected`
- [ ] Alerts haben `role="alert"`
- [ ] Progress-Bars haben `role="progressbar"` + `aria-label`

### Kontrast
- [ ] Text-Kontrast ≥ 4.5:1 (AA)
- [ ] Large-Text-Kontrast ≥ 3:1
- [ ] Focus-Indicator-Kontrast ≥ 3:1

### Keyboard
- [ ] Alle interaktiven Elemente sind fokussierbar
- [ ] Tab-Reihenfolge ist logisch
- [ ] Escape schließt Dialoge
- [ ] Enter/Space aktiviert Buttons

---

## 🔲 12. Responsive Design

- [ ] Mobile-First oder zumindest Mobile-kompatibel
- [ ] Touch-Targets min. 44x44px
- [ ] Dialoge max-width auf Mobile: `calc(100vw - 2rem)`
- [ ] Cards volle Breite auf Mobile

---

## 🔲 13. Code-Qualität

- [ ] Keine `!important` (außer dokumentierte Ausnahmen)
- [ ] Keine inline Styles (`style="..."`)
- [ ] Keine inline Event-Handler (`onclick="..."`)
- [ ] CSS in korrekter Komponenten-Datei (nicht global)
- [ ] Keine unused CSS classes

---

## 🔲 14. Dokumentation

- [ ] Komponente in Styleguide dokumentiert (falls neu)
- [ ] Breaking Changes in CHANGELOG
- [ ] Falls Abweichung: Eintrag in `docs/ui-md3-deviations.md`

---

## Quick-Check (Minimum)

Für kleine Änderungen, mindestens diese Punkte prüfen:

```
✅ Tokens statt hardcoded Werte
✅ Kanonische Button-Klassen
✅ aria-label für Icon-Buttons  
✅ Kein !important
✅ Kein inline-style
```

---

## Abnahme-Signatur

| Geprüft von | Datum | Komponente | Status |
|-------------|-------|------------|--------|
| | | | ⬜ Pending / ✅ Passed / ❌ Failed |

---

**Referenz:** Siehe `docs/ui-md3-styleguide.md` für vollständige Token-Dokumentation.
