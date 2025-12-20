# MD3 Design System — Overview

> **5-Minute Introduction to the CO.RA.PAN MD3 Design System**

---

## What is MD3?

Material Design 3 (MD3) is Google's latest design system. This project implements a custom MD3-based design system with:

- **Token-driven theming** – all visual properties via CSS custom properties
- **Canonical components** – standardized HTML patterns for all UI elements
- **Accessibility built-in** – ARIA attributes, focus management, semantic HTML
- **Dark mode support** – automatic via `prefers-color-scheme`

---

## Token System

All visual properties come from tokens defined in `static/css/md3/tokens.css`:

| Category | Prefix | Example |
|----------|--------|---------|
| Colors | `--md-sys-color-*` | `--md-sys-color-primary` |
| Spacing | `--space-*` | `--space-4` (16px) |
| Radii | `--radius-*` | `--radius-md` (12px) |
| Elevation | `--elev-*` | `--elev-2` |
| Typography | `--md-sys-typescale-*` | `--md-sys-typescale-body-medium-font` |

**Rule:** Never use hex colors or pixel values directly. Always use tokens.

---

## Core Components

| Component | Class | Description |
|-----------|-------|-------------|
| Button | `.md3-button .md3-button--filled` | Primary actions |
| Textfield | `.md3-outlined-textfield` | Form inputs with floating labels |
| Card | `.md3-card .md3-card--outlined` | Content containers |
| Dialog | `.md3-dialog` | Modal overlays |
| Alert | `.md3-alert .md3-alert--error` | Feedback messages |
| Hero | `.md3-hero .md3-hero--card` | Page headers with icon/title |

See [10_md3_spec_core.md](./10_md3_spec_core.md) for complete specifications.

---

## Page Structure

Every page follows this structure:

```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- Hero component -->
  </header>
  <main class="md3-page__main">
    <section class="md3-page__section md3-stack--section">
      <!-- Content -->
    </section>
  </main>
</div>
```

---

## Skeleton Templates

Start new pages from skeletons in `templates/_md3_skeletons/`:

| Skeleton | Use Case |
|----------|----------|
| `page_text_skeleton.html` | Content/text pages (Impressum, About) |
| `page_form_skeleton.html` | Single-form pages |
| `auth_login_skeleton.html` | Login pages |
| `auth_profile_skeleton.html` | Profile/account pages |
| `auth_dialog_skeleton.html` | Modal dialogs |

See [30_patterns_and_skeletons.md](./30_patterns_and_skeletons.md) for details.

---

## Do / Don't

| ✅ Do | ❌ Don't |
|-------|---------|
| Use `--md-sys-color-primary` | Use `#0a5981` or hex colors |
| Use `--space-4` for padding | Use `16px` or inline styles |
| Use `.md3-button--filled` | Use `.btn-primary` or legacy classes |
| Use `.md3-card--outlined` | Use `.card` or Bootstrap classes |
| Start from skeleton templates | Create layouts from scratch |

---

## Tooling

Run before every commit:

```bash
python scripts/md3-lint.py
```

This checks for:
- Hex colors in CSS
- Legacy class usage
- Missing ARIA attributes
- Structural compliance

---

## Next Steps

1. **Core Spec:** [10_md3_spec_core.md](./10_md3_spec_core.md) – Complete component specifications
2. **App Spec:** [20_app_spec_corapan.md](./20_app_spec_corapan.md) – CO.RA.PAN-specific extensions
3. **Patterns:** [30_patterns_and_skeletons.md](./30_patterns_and_skeletons.md) – Skeleton usage guide
4. **Tooling:** [40_tooling_and_ci.md](./40_tooling_and_ci.md) – Lint and guard scripts
