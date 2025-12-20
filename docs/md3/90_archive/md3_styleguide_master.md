# MD3 Styleguide & Master-Template

*CO.RA.PAN Designsystem – Goldstandard*

## 1. Ziel & Scope

Ziele:

1. **Jede neue Seite** in diesem Projekt startet MD3-konform.
2. **Jedes neue Projekt**, das dieses Webdesign übernimmt, kann den Styleguide 1:1 verwenden.
3. Kein „Nachziehen“ mehr: Layout, Komponenten, Tokens und Patterns sind klar definiert und testbar.

Scope:

* Gilt für alle regulären Seiten, Formulare, Auth-Views, Admin-UIs, Suchseiten usw.
* **Ausgenommen (Custom Components):**

  * Datatables UI
  * Custom Audio Player
  * Editor-Funktionalität (inkl. Player-UI)
    → nur Sidebars werden MD3-harmonisiert (Farbe/Elevation/Spacing).

---

## 2. Tokens – Quelle der Wahrheit

Alle Farben, Abstände, Radii und Schatten kommen ausschließlich aus:

* `static/css/md3/tokens.css`
* `static/css/app-tokens.css` (kleine Overrides)

### 2.1 Farben

* Grundsätzlich: `--md-sys-color-*`

  * `--md-sys-color-surface`, `--md-sys-color-surface-container-*`
  * `--md-sys-color-primary`, `--md-sys-color-on-primary`
  * `--md-sys-color-error`, `--md-sys-color-on-error`
* App-spezifisch:

  * `--app-background` = Seitenhintergrund

**Verboten:**

* Hex-Codes in Komponenten/Templates (`#fff`, `#e0e0e0`, …).
* Eigene Farbvariablen außerhalb des Token-Files.

### 2.2 Spacing

* Basis: `--space-1` (4px) … `--space-12` (48px).
* Typische Verwendung:

  * `--space-6` (24px): Standard-Abstand in Sektionen.
  * `--space-8` (32px): Abstand zwischen großen Layoutblöcken.

### 2.3 Radii & Elevation

* Radii: `--radius-sm`, `--radius-md`, `--radius-lg`.
* Schatten: `--elev-1` bis `--elev-3`.

---

## 3. Layout-Patterns

### 3.1 Seiten-Layout

Jede Seite basiert auf:

```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- optional: Hero -->
  </header>

  <main class="md3-page__main">
    <section class="md3-page__section md3-stack--page">
      <!-- Page content -->
    </section>
  </main>
</div>
```

Regeln:

* Keine eigenen Top-Level-Wrappers (`.container`, `.page-wrapper` etc.) außerhalb dieses Patterns.
* Abstand zwischen Sektionen über `md3-stack--page`.

### 3.2 Text Pages

Verwenden:

```html
<main class="md3-text-page">
  <section class="md3-text-section">
    <h2 class="md3-title-large md3-section-title">H2</h2>
    <p class="md3-body-medium">Text …</p>
    <h3 class="md3-title-medium md3-subsection-title">H3</h3>
    <p class="md3-body-medium">Text …</p>
  </section>
</main>
```

* H1 → Hero-Title
* Unterhalb: H2/H3 mit `md3-section-title` / `md3-subsection-title`.

---

## 4. Hero

Canonical Hero:

```html
<header class="md3-page__header">
  <div class="md3-hero md3-hero--card md3-hero__container">
    <div class="md3-hero__icon" aria-hidden="true">
      <span class="material-symbols-rounded">icon_name</span>
    </div>
    <div class="md3-hero__content">
      <p class="md3-body-small md3-hero__eyebrow">Kontext</p>
      <h1 class="md3-headline-medium md3-hero__title">Titel</h1>
      <p class="md3-hero__intro">Kurzer Einleitungstext.</p>
    </div>
  </div>
</header>
```

Regeln:

* H1 lebt im Hero.
* Eyebrow optional.
* Hero nur im Header, nie mitten im Content.

---

## 5. Komponenten

### 5.1 Buttons

Markup:

```html
<button class="md3-button md3-button--filled">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">save</span>
  <span class="md3-button__label">Speichern</span>
</button>
```

Varianten:

* `md3-button--filled` (primär)
* `md3-button--tonal` (mittel)
* `md3-button--outlined` (sekundär)
* `md3-button--text` (low)

Regeln:

* Keine `btn-*` oder custom-Button-Klassen.
* Danger-Variante: `md3-button md3-button--filled md3-button--danger`.

### 5.2 Textfields (Outlined)

Canonical:

```html
<div class="md3-outlined-textfield md3-outlined-textfield--block">
  <input
    class="md3-outlined-textfield__input"
    id="FIELD"
    name="FIELD"
    type="text"
    required
  >
  <label class="md3-outlined-textfield__label" for="FIELD">Label</label>
  <span class="md3-outlined-textfield__outline">
    <span class="md3-outlined-textfield__outline-start"></span>
    <span class="md3-outlined-textfield__outline-notch"></span>
    <span class="md3-outlined-textfield__outline-end"></span>
  </span>
</div>
<div class="md3-field-error" id="FIELD-error" role="alert" aria-live="assertive">
  <p class="md3-body-small">Fehlermeldung.</p>
</div>
```

Regeln:

* Wrapper: `div`, nicht `label`.
* Reihenfolge: Input → Label → Outline.
* Full-width in Formularen: `md3-outlined-textfield--block`.
* JS setzt `.md3-outlined-textfield--focused` und `.md3-outlined-textfield--has-value`.

### 5.3 Checkbox

Canonical:

```html
<label class="md3-checkbox">
  <input type="checkbox" name="X">
  <span class="md3-checkbox__icon"></span>
  <span class="md3-checkbox__label">Ich akzeptiere …</span>
</label>
```

* Legacy-Checkboxen (`md3-checkbox-container`, alte Formen) sind verboten in neuen Templates.

### 5.4 Alerts

Inline:

```html
<div class="md3-alert md3-alert--error md3-alert--inline" role="alert" aria-live="assertive">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">error</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Fehler</p>
    <p class="md3-alert__text">Nachricht.</p>
  </div>
</div>
```

Banner:

```html
<div class="md3-alert md3-alert--success md3-alert--banner" role="status" aria-live="polite">
  <span class="material-symbols-rounded md3-alert__icon" aria-hidden="true">check_circle</span>
  <div class="md3-alert__content">
    <p class="md3-alert__title">Erfolg</p>
    <p class="md3-alert__text">Änderung gespeichert.</p>
  </div>
</div>
```

### 5.5 Cards

Canonical:

```html
<article class="md3-card md3-card--outlined">
  <header class="md3-card__header">
    <h2 class="md3-title-large md3-card__title">Titel</h2>
  </header>
  <div class="md3-card__content md3-stack--section">
    <!-- Inhalte -->
  </div>
  <footer class="md3-card__footer md3-card__actions">
    <button class="md3-button md3-button--text">Abbrechen</button>
    <button class="md3-button md3-button--filled">Speichern</button>
  </footer>
</article>
```

Varianten:

* `md3-card--outlined`
* `md3-card--elevated`
* `md3-card--filled`
* Projektspezifisch: `md3-card--landing` (Startseiten-Cards).

Legacy `.card-*` sind verboten.

### 5.6 Dialoge / Sheets

Dialog:

```html
<dialog class="md3-dialog" aria-modal="true" aria-labelledby="dialog-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <h2 id="dialog-title" class="md3-title-large md3-dialog__title">Titel</h2>
      </header>
      <div class="md3-dialog__content md3-stack--dialog">
        <!-- Inhalt -->
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text">Abbrechen</button>
        <button class="md3-button md3-button--filled">OK</button>
      </div>
    </div>
  </div>
</dialog>
```

Sheets:

* `div.md3-sheet` mit `md3-sheet__backdrop`, `md3-sheet__surface`, `md3-sheet__header`, `md3-sheet__content`, `md3-sheet__actions`.

Legacy `.md3-login-sheet` nur als Übergangsalias, nicht in neuen Templates.

### 5.7 Navigation (Top App Bar & Drawer)

* Top App Bar: `.md3-top-app-bar`, `.md3-top-app-bar__title`, `.md3-top-app-bar__actions`.
* Navigation Drawer: `.md3-navigation-drawer`, `.md3-navigation-drawer__item`, `aria-current="page"`.

Keine eigenen Navi-Implementierungen – alles baut auf diesen Komponenten.

---

## 6. Patterns

### 6.1 Auth-Seiten

Struktur:

```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- Hero für Profil/Admin; Login darf einen simpleren Header haben -->
  </header>

  <main class="md3-page__main">
    <section class="md3-page__section md3-auth-page md3-stack--section">
      <article class="md3-card md3-card--outlined md3-auth-card">
        <header class="md3-card__header">
          <h2 class="md3-title-large">Abschnittstitel</h2>
        </header>
        <div class="md3-card__content md3-stack--section">
          <!-- Formular -->
        </div>
      </article>
    </section>
  </main>
</div>
```

### 6.2 Suchseite / Advanced Search

* Page: `.md3-page`
* Header: Hero mit Suchkontext
* Form: `form.md3-form` mit `md3-outlined-textfield` + Chips/Tabs
* Dialoge: CQL-Hilfe als `md3-dialog--large`

### 6.3 Admin-Dashboard

* Hero mit Admin-Eyebrow
* Grid: `.md3-grid--responsive` für Cards
* Cards: `md3-card md3-card--elevated` für KPI-Boxen

---

## 7. Skeletons – Pflichtbasis für neue Seiten

Ordner: `templates/_md3_skeletons/`

Verfügbare Skeletons:

* `page_text_skeleton.html`
* `page_form_skeleton.html`
* `page_large_form_skeleton.html`
* `auth_form_skeleton.html`
* `admin_page_skeleton.html`
* `dialog_skeleton.html`
* `sheet_skeleton.html`

Regel:

> Neue Seiten dürfen **nur** auf Basis eines Skeletons angelegt werden.

---

## 8. Do / Don’t

**Do:**

* Nur Tokens verwenden (`--md-sys-*`, `--space-*`).
* Nur MD3-Komponenten-Klassen.
* Abstand über `md3-stack--*`.

**Don’t:**

* Keine Inline-Styles.
* Keine Hex-Farben.
* Keine `m-*` Utility-Klassen.
* Keine Legacy-Checkboxen / Cards / Buttons.

---

## 9. Checkliste für neue Seiten

Vor Merge:

1. Nutzt die Seite ein Skeleton?
2. Enthält sie `md3-page`, `md3-page__header`, `md3-page__main`, `md3-page__section`?
3. Sind alle Buttons MD3?
4. Sind alle Eingabefelder canonical Textfields?
5. Keine Inline-Styles?
6. Keine Hex-Farben?
7. Keine `m-*`, `mt-*`, `card-*`, `btn-*`?
8. Dialoge / Sheets canonical?
9. Alerts MD3?
10. Seite besteht md3-lint + Guards?

Wenn du diese Liste abhakst, ist die Seite Goldstandard.

