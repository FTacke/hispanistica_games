# Tooling and CI

> **Guard Scripts, Linting, and CI Integration**  
> How to validate MD3 compliance locally and in CI.

---

## 1. Available Tools

| Script | Purpose | Exit Code |
|--------|---------|-----------|
| `scripts/md3-lint.py` | Comprehensive structural/CSS linter | 1 on errors |
| `scripts/md3-forms-auth-guard.py` | Form and auth template guard | 2 on issues |
| `scripts/md3-textpages-guard.py` | Text page structure guard | 1 on errors |

---

## 2. MD3 Lint (`md3-lint.py`)

The primary linting tool. Validates HTML templates and CSS files.

### Usage

```bash
# Full scan
python scripts/md3-lint.py

# Focus on specific files/folders
python scripts/md3-lint.py --focus templates/auth

# JSON output
python scripts/md3-lint.py --json-out reports/md3-lint.json

# Allow errors (for CI info-only)
python scripts/md3-lint.py --exit-zero
```

### What It Checks

#### HTML Templates

| Rule | Severity | Description |
|------|----------|-------------|
| `MD3-DIALOG-001` | ERROR | Dialog missing `md3-dialog__surface` |
| `MD3-DIALOG-002` | ERROR | Dialog missing `md3-dialog__content` |
| `MD3-DIALOG-003` | ERROR | Dialog missing `md3-dialog__actions` |
| `MD3-DIALOG-004` | ERROR | Dialog missing `md3-dialog__title` |
| `MD3-DIALOG-005` | ERROR | Dialog missing `aria-modal="true"` |
| `MD3-DIALOG-006` | ERROR | Dialog missing `aria-labelledby` |
| `MD3-CARD-001` | ERROR | Card missing `md3-card__content` |
| `MD3-HERO-001` | ERROR | Hero missing canonical structure |
| `MD3-HERO-002` | ERROR | Hero icon structure wrong |
| `MD3-LEGACY-001` | ERROR | Legacy card class usage |
| `MD3-LEGACY-002` | ERROR | Legacy `--md3-*` token |
| `MD3-LEGACY-003` | ERROR | Legacy `md3-button--contained` |
| `MD3-LEGACY-004` | ERROR | Legacy `md3-login-sheet` |
| `MD3-ALERT-001` | ERROR | `role="alert"` without MD3 class |
| `MD3-SPACING-002` | WARNING | Bootstrap spacing utility (`m-*`) |

#### CSS Files

| Rule | Severity | Description |
|------|----------|-------------|
| `MD3-CSS-001` | WARNING | Hex color in MD3 CSS |
| `MD3-CSS-002` | WARNING | `!important` usage |
| `MD3-CSS-003` | ERROR | Legacy selector |

### Excluded Areas

The linter ignores certain paths:

- `LOKAL/` – Local design previews (gitignored)
- `docs/` – Documentation
- `tests/e2e/` – E2E test outputs (gitignored)
- `.venv/`, `node_modules/` – Dependencies
- DataTables CSS (partial exceptions)
- Player/Editor pages (custom components)

### Output Format

```
[ERROR] templates/auth/login.html:45 MD3-DIALOG-005: Dialog missing aria-modal="true"
[WARNING] static/css/md3/components/auth.css:23 MD3-CSS-001: Hex color #ffffff (use tokens)
```

---

## 3. Forms/Auth Guard (`md3-forms-auth-guard.py`)

Quick validation for form and auth templates.

### Usage

```bash
python scripts/md3-forms-auth-guard.py
```

### What It Checks

| Check | Description |
|-------|-------------|
| `inline_style` | Inline `style="..."` attributes |
| `legacy_checkbox` | Checkbox without `md3-checkbox` pattern |
| `outlined_textfield_incomplete` | Missing input/label/outline in textfield |
| `dialog_incomplete` | Missing surface/title in dialog |
| `legacy_button` | `btn-*` or legacy button classes |

### Target Directories

- `templates/_md3_skeletons/`
- `templates/auth/`

### Exit Codes

- `0` – No issues
- `2` – Issues found

---

## 4. Text Pages Guard (`md3-textpages-guard.py`)

Validates text page structure.

### Usage

```bash
python scripts/md3-textpages-guard.py
```

### What It Checks

- Correct page structure (`md3-page`, `md3-text-page`)
- Hero in header only
- H2 sections with `.md3-section-title`
- H3 subsections with `.md3-subsection-title`
- No H4–H6 in main content
- Consistent divider usage

### Target Directories

- `templates/pages/`

---

## 5. Hard Rules (PR Blocking)

These rules cause CI to fail:

### Absolutely Blocking

| Pattern | Reason |
|---------|--------|
| Hex colors in CSS | Use `--md-sys-color-*` tokens |
| `--md3-*` tokens | Use `--md-sys-*` or `--space-*` |
| `md3-button--contained` | Use `md3-button--filled` |
| `md3-login-sheet` | Use `md3-sheet` |
| `.card-*` classes | Use `.md3-card--*` |
| `.btn-*` classes | Use `.md3-button--*` |
| Missing `aria-modal` on dialogs | Accessibility requirement |
| Missing `aria-labelledby` on dialogs | Accessibility requirement |

### Warning (Should Fix)

| Pattern | Reason |
|---------|--------|
| `m-*`, `mt-*`, `mb-*` utilities | Use `.md3-stack--*` |
| `!important` in CSS | Specificity issues |
| Inline styles | Use classes |

---

## 6. MD3 Lint in GitHub Actions

### Wann läuft der Workflow?

Der Workflow `.github/workflows/md3-lint.yml` läuft bei:

| Trigger | Bedingung |
|---------|-----------|
| **Pull Request** | Gegen `main`-Branch, wenn Änderungen in `templates/**`, `static/css/md3/components/**` oder `scripts/**` |
| **workflow_dispatch** | Manuelles Auslösen jederzeit über GitHub UI |

> **Hinweis:** Der Workflow läuft **nicht** bei jedem Push, um CI-Last zu reduzieren.
> Er dient als Qualitätsschranke vor dem Merge in `main`.

### Lokal nachstellen

```bash
# Genau wie in CI
python scripts/md3-lint.py
python scripts/md3-forms-auth-guard.py

# Mit JSON-Report
python scripts/md3-lint.py --json-out reports/md3-lint.json

# Nur Errors (Warnings ignorieren)
python scripts/md3-lint.py --errors-only
```

### Welche Regeln blockieren einen PR?

| Regel | Severity | Blockiert PR |
|-------|----------|--------------|
| `MD3-DIALOG-*` | ERROR | ✅ Ja |
| `MD3-CARD-001` | ERROR | ✅ Ja |
| `MD3-LEGACY-*` | ERROR | ✅ Ja |
| `MD3-ALERT-001` | ERROR | ✅ Ja |
| `MD3-CSS-003` | ERROR | ✅ Ja |
| `MD3-SPACING-002` | WARNING | ❌ Nein |
| `MD3-CSS-001/002` | WARNING | ❌ Nein |

Der Workflow schlägt fehl (Exit Code 2), wenn **mindestens ein ERROR** gefunden wird.
Warnings werden geloggt, blockieren aber nicht.

### Aktueller Workflow

```yaml
# .github/workflows/md3-lint.yml
name: MD3 Lint

on:
  pull_request:
    branches:
      - main
    paths:
      - 'templates/**'
      - 'static/css/md3/components/**'
      - 'scripts/**'
  workflow_dispatch:

jobs:
  md3-lint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install deps
        run: pip install --no-cache-dir -r requirements.txt || true

      - name: Run md3-forms/auth guard
        run: python scripts/md3-forms-auth-guard.py

      - name: Run md3-lint
        run: python scripts/md3-lint.py
```

### Pre-commit Hook (optional)

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: md3-lint
        name: MD3 Lint
        entry: python scripts/md3-lint.py --exit-zero
        language: system
        files: \.(html|css)$
        pass_filenames: false
```

---

## 7. Extending the Linter

### Adding a New Rule

1. Add rule definition to `RULES` dict in `md3-lint.py`:

```python
RULES = {
    # ... existing rules ...
    "MD3-NEW-001": ("ERROR", "Description of new rule"),
}
```

2. Add pattern to `PATTERNS` if needed:

```python
PATTERNS = {
    # ... existing patterns ...
    'new_pattern': re.compile(r'pattern-to-match'),
}
```

3. Add validation logic in appropriate function:

```python
def lint_new_component(content: str, rel_path: str) -> List[LintIssue]:
    issues = []
    for match in PATTERNS['new_pattern'].finditer(content):
        issues.append(LintIssue(
            rule_id="MD3-NEW-001",
            severity="ERROR",
            file=rel_path,
            line=get_line_number(content, match.start()),
            message="Issue description",
            match=match.group(0)
        ))
    return issues
```

### Adding Exceptions

To exclude paths from certain checks:

```python
# Add to exclusion sets
EXCLUDED_PAGES = {
    'templates/pages/player.html',
    'templates/pages/your_special_page.html',
}
```

---

## 8. Local Development Workflow

### Before Every Commit

```bash
# Quick check
python scripts/md3-lint.py --focus templates/

# Full check with JSON
python scripts/md3-lint.py --json-out reports/md3-lint.json

# Forms check
python scripts/md3-forms-auth-guard.py
```

### When Creating New Pages

```bash
# 1. Copy skeleton
cp templates/_md3_skeletons/page_text_skeleton.html templates/pages/new_page.html

# 2. Edit content

# 3. Validate
python scripts/md3-lint.py --focus templates/pages/new_page.html

# 4. Fix any issues

# 5. Commit
git add templates/pages/new_page.html
git commit -m "Add new_page with MD3 compliance"
```

### Debugging Lint Failures

```bash
# Get detailed JSON output
python scripts/md3-lint.py --focus path/to/file.html --json-out debug.json

# Check specific rule
cat debug.json | jq '.issues[] | select(.rule_id == "MD3-DIALOG-005")'
```

---

## 9. Report Files

Lint reports are generated on-demand and stored in a local `reports/` folder (gitignored).
These files are temporary and can be regenerated at any time.

### Generating Reports

```bash
# Generate JSON reports locally
python scripts/md3-lint.py --json-out reports/md3-lint.json

# Other lint reports are generated by respective scripts
```

### Report Structure

```json
{
  "generated": "2025-11-26T12:00:00",
  "summary": {
    "total": 10,
    "errors": 2,
    "warnings": 8,
    "info": 0
  },
  "by_rule": {
    "MD3-CSS-002": {
      "count": 8,
      "severity": "WARNING",
      "description": "!important in md3 components CSS"
    }
  },
  "issues": [
    {
      "rule_id": "MD3-CSS-002",
      "severity": "WARNING",
      "file": "static/css/md3/components/datatables.css",
      "line": 45,
      "message": "!important usage (remove)",
      "match": "!important"
    }
  ]
}
```

---

## 10. Troubleshooting

### "Too many !important warnings"

DataTables requires `!important` to override third-party styles. These are documented with `NEEDS_IMPORTANT` comments and can be ignored.

### "Legacy token in my CSS"

Replace `--md3-*` with the correct token:

| Legacy | Replacement |
|--------|-------------|
| `--md3-textfield-label-bg` | `--app-textfield-label-bg` |
| `--md3-space-4` | `--space-4` |
| `--md3-color-*` | `--md-sys-color-*` |

### "Dialog structure incomplete"

Ensure your dialog has all required parts:

```html
<dialog class="md3-dialog" aria-modal="true" aria-labelledby="title-id">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <h2 id="title-id" class="md3-dialog__title">...</h2>
      </header>
      <div class="md3-dialog__content">...</div>
      <div class="md3-dialog__actions">...</div>
    </div>
  </div>
</dialog>
```

---

## 11. App Tokens (`app-tokens.css`)

### CSS-Ladekette

Die Reihenfolge in `templates/base.html` ist kritisch:

```
1. layout.css          ← Grundlayout, nutzt --app-background
2. tokens.css          ← MD3 Core Tokens (--md-sys-color-*)
3. app-tokens.css      ← App-spezifische Overrides (--app-*)
4. tokens-legacy-shim  ← Legacy-Mappings
5. typography.css      ← Schriften
6. layout.css (md3)    ← MD3 Layout
7. Components...
```

**WICHTIG:** `app-tokens.css` muss **nach** `tokens.css` geladen werden, damit Overrides greifen!

### Verfügbare App-Tokens

```css
:root {
  /* Seitenhintergrund - kann angepasst werden */
  --app-background: var(--md-sys-color-surface-container-low);
  
  /* Login-spezifischer Hintergrund */
  --app-color-login-bg: #f0f2f5;
  
  /* Textfield Label Background für Floating Labels */
  --app-textfield-label-bg: var(--md-sys-color-surface);
  
  /* Mobile Menu Animationsdauer */
  --app-mobile-menu-duration: 250ms;
}
```

### Wie `--app-background` wirkt

1. **FOUC-Prevention** in `base.html` (Inline-Style):
   ```css
   :root { --app-background: #ffffff; }
   @media (prefers-color-scheme: dark) {
     :root { --app-background: #14141A; }
   }
   ```
   → Verhindert weißen Flash beim Laden

2. **Body-Styling** in `layout.css`:
   ```css
   body.app-shell {
     background: var(--app-background);
   }
   ```

3. **Finale Definition** in `app-tokens.css`:
   ```css
   :root {
     --app-background: var(--md-sys-color-surface-container-low);
   }
   ```
   → Überschreibt den FOUC-Fallback mit dem gewünschten Token

### Debugging

Falls Änderungen nicht greifen:

1. Browser DevTools → `body` selektieren → Computed Styles
2. Prüfen, welche Datei `--app-background` definiert
3. Falls `tokens.css` angezeigt wird: Ladereihenfolge in `base.html` prüfen
4. Test: `--app-background: hotpink` in `app-tokens.css` → Seite muss pink werden
