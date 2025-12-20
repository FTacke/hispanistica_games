# MD3 Auth Pages Standard

This document defines the standard for Authentication pages (Login, Profile, User Management, etc.) in the CO.RA.PAN webapp, ensuring consistency with the global MD3 design system.

## 1. Buttons

Auth pages must use the canonical MD3 button classes defined in `static/css/md3/components/buttons.css`. Do not use custom `auth-btn-*` classes or inline styles to modify button appearance.

### Primary Action
Used for the main action on a page or card (e.g., "Login", "Save", "Create User").

```html
<button class="md3-button md3-button--filled">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">save</span>
  Speichern
</button>
```

### Secondary Action
Used for alternative actions (e.g., "Cancel", "Back", "Forgot Password").

```html
<!-- Text Button (Low Emphasis) -->
<button class="md3-button md3-button--text">Abbrechen</button>

<!-- Outlined Button (Medium Emphasis) -->
<button class="md3-button md3-button--outlined">Aktualisieren</button>
```

### Destructive Action
Used for dangerous actions (e.g., "Delete Account").

```html
<button class="md3-button md3-button--filled md3-button--danger">
  <span class="material-symbols-rounded md3-button__icon" aria-hidden="true">delete_forever</span>
  Konto löschen
</button>
```

## 2. Page Layout

Full-page Auth views (Profile, User Management, Password Reset) must follow the standard Page Shell structure used by Text Pages (e.g., Impressum).

### Structure

```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- Standard Hero Card -->
    <div class="md3-hero md3-hero--card md3-hero__container">
      <div class="md3-hero__icon" aria-hidden="true">
        <span class="material-symbols-rounded">account_circle</span>
      </div>
      <div class="md3-hero__content">
        <p class="md3-body-small md3-hero__eyebrow">Kategorie</p>
        <h1 class="md3-headline-medium md3-hero__title">Seitentitel</h1>
        <p class="md3-hero__intro">Kurze Beschreibung der Seite.</p>
      </div>
    </div>
  </header>

  <main class="md3-page__main">
    <section class="md3-page__section md3-auth-page md3-stack--section">
      <!-- Content (Cards, Forms, Tables) -->
      <article class="md3-card md3-card--outlined md3-auth-card">
        <header class="md3-card__header">
          <h2 class="md3-title-large">Abschnittstitel</h2>
        </header>
        <div class="md3-card__content">
          <!-- Form Content -->
        </div>
      </article>
    </section>
  </main>
</div>
```

### Simple Auth Pages (Login, Forgot Password)
For simple pages that focus on a single card, the Hero header can be omitted if appropriate, but the `.md3-page` wrapper and `.md3-page__main` should still be used.

## 3. Dialogs

Auth dialogs (e.g., Confirmation, Create User) must use the standard MD3 dialog structure.

```html
<dialog id="my-dialog" class="md3-dialog">
  <div class="md3-dialog__surface">
    <h2 class="md3-title-large md3-dialog__title">Titel</h2>
    <div class="md3-dialog__content">
      <p class="md3-body-medium">Inhalt...</p>
    </div>
    <div class="md3-dialog__actions">
      <button class="md3-button md3-button--text">Abbrechen</button>
      <button class="md3-button md3-button--filled">Bestätigen</button>
    </div>
  </div>
</dialog>
```

## 4. CSS Guidelines

-   **Do not override button styles** in `auth.css`.
-   Use `md3-auth-card` for layout specific to auth cards (width, centering), but rely on global classes for component styling.
-   Ensure `md3-actions` uses flexbox for proper button alignment.
