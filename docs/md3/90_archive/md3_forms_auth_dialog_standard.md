# MD3 Forms / Auth / Dialog Standard

Dieses Dokument definiert die verbindlichen HTML- und CSS-Patterns für alle Formulare, Auth-Seiten und Dialoge der CO.RA.PAN-Webapp.  
Es ergänzt die bestehenden Standards:

- `md3_textpages_standard.md`
- `md3_auth_pages_standard.md`
- `md3_forms_auth_dialog_audit.md`
- MD3-Tokens (`static/css/md3/tokens.css` / `app-tokens.css`)

Ziel: Einheitliches, tokens-basiertes MD3-Design, frei von Legacy-Markup, Hex-Farben und unkontrollierten CSS-Abweichungen.  
Alle neuen oder migrierten Templates müssen diese Vorgaben erfüllen.

---

## 1. Formular-Komponenten

### 1.1 Canonical MD3 Outlined Textfield

Wir verwenden ausschließlich **Outlined Textfields** mit dem folgenden Pattern.  
Keine Alternativ-Varianten, keine verkürzten Markups, keine Inline-Styles.

```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input
    class="md3-outlined-textfield__input"
    type="text"
    name=""
    required
  >
  <label class="md3-outlined-textfield__label">Label</label>
  <span class="md3-outlined-textfield__outline">
    <span class="md3-outlined-textfield__outline-start"></span>
    <span class="md3-outlined-textfield__outline-notch"></span>
    <span class="md3-outlined-textfield__outline-end"></span>
  </span>
</div>
```

**Hinweise:**

* `md3-outlined-textfield--block` erzwingt 100 % Breite im Formkontext.
* Das Label hat einen **transluzenten** Hintergrund (mit `--md-sys-color-surface`) → dadurch wird das „Floating“-Label korrekt dargestellt.
  Die Hintergrundfarbe ist *gewollt* in MD3.
* Kein direktes Ändern der Label-Surface-Farbe in den Komponenten, keine eigenen Rahmen, kein Box-Shadow.
* Vorhandenes JS muss Zustandsklassen setzen: `.md3-outlined-textfield--focused` beim Fokus und `.md3-outlined-textfield--has-value` bei vorhandenem Inhalt — so funktioniert das Floating-Label zuverlässig ohne Hacks.

### 1.2 Required Field Indicator

Nur via `required` + CSS Pseudo-Selector, kein Sternchen im Label.

### 1.3 Fehlermeldungen

```html
<div class="md3-field-error">
  Bitte gültigen Wert eingeben.
</div>
```

### 1.4 Checkbox

Keine Legacy-Checkbox mehr.
Neu: `<label class="md3-checkbox">`. Das Muster:

```html
<label class="md3-checkbox">
  <input type="checkbox">
  <span class="md3-checkbox__icon"></span>
  <span class="md3-checkbox__label">Einverstanden</span>
</label>
```

### 1.5 Buttons

Nur MD3-Typen:

* `.md3-button`
* `.md3-button--filled`
* `.md3-button--outlined`
* `.md3-button--text`

---

## 2. Auth-Seiten

### 2.1 Struktur (verbindlich)

```html
<div class="md3-page">
  <header class="md3-page__header">
    <h1 class="md3-title-large">Seitentitel</h1>
  </header>

  <main class="md3-page__main">
    <section class="md3-auth-card">
      <h2 class="md3-headline-small">Abschnittstitel</h2>
      <!-- Formular / Content -->
    </section>
  </main>
</div>
```

**Regeln:**

* Überschriften-Hierarchie wie in `md3_textpages_standard.md`
* Keine eigenen Seitengrids oder Wrapper außerhalb von `md3-page`

---

## 3. Dialoge

### 3.1 Canonical Dialog

```html
<dialog class="md3-dialog">
  <div class="md3-dialog__surface">
    <h2 class="md3-title-large md3-dialog__title">Titel</h2>

    <div class="md3-dialog__content">
      …
    </div>

    <div class="md3-dialog__actions">
      <button class="md3-button md3-button--text">Abbrechen</button>
      <button class="md3-button md3-button--filled">OK</button>
    </div>
  </div>
</dialog>
```

### 3.2 Sheets

Alias `.md3-login-sheet` ist nur Legacy.
Neu: ausschließlich `.md3-sheet`.

---

## 4. CSS-Regeln (verbindlich)

### 4.1 Token-only

* Alle Farben: ausschließlich `--md-sys-*`
* Keine Hex-Farben (#…)
* Keine Inline-Styles
* Keine „Sonder“-Komponenten-Overrides außerhalb `static/css/md3/components/`

### 4.2 Komponenten-Kapselung

* Textfields → `components/textfields.css`
* Checkbox → `components/checkbox.css`
* Dialog → `components/dialog.css`
* Auth-spezifische Layouts → `components/auth.css` + `components/login.css`

### 4.3 Legacy-Klassen isolieren

* `.md3-login-sheet` bleibt nur als abgetrennter Compatibility-Block mit Dokumentation.

---

## 5. Guard & CI

### 5.1 Guard (HTML)

Ein Guard-Skript (`scripts/md3-forms-auth-guard.py`) prüft:

* Canonical Textfield-Markup
* Canonical Dialog-Markup
* Keine Inline-Styles bei Buttons, Inputs, Dialogs
* Keine Alternativ-Textfields
* Keine Legacy-Checkbox
* Nur erlaubte MD3-Buttontypen

### 5.2 Linting (CSS)

Erweitertes `scripts/md3-lint.py` prüft:

* Hex-Farben → verboten
* Unzulässige Selektoren in Komponenten
* !important nur erlaubt, wenn whitelisted

---

## 6. Skeletons

Unter `templates/_md3_skeletons/` müssen gepflegt werden:

* `page_form_skeleton.html`
* `page_large_form_skeleton.html` — Skeleton für umfangreiche 1–2-spaltige Formularseiten
* `auth_form_skeleton.html`
* `dialog_skeleton.html`
* `sheet_skeleton.html`

Diese sind die einzige Quelle der Wahrheit.

---

## 7. Änderungen dokumentieren

* Jedes refactoring bekommt Block-Kommentare, die beschreiben, ob eine migrierte Stelle Legacy entfernt, Vereinheitlichung durchsetzt oder canonical Pattern ersetzt.
* Dokumentation wird laufend aktualisiert.
