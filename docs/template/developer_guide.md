# Template Developer Guide

> **Audience:** Developers creating new pages or adapting the template  
> **Last Updated:** 2025-11-27

This guide explains how to use the CO.RA.PAN webapp as a reusable template for new projects.

---

## 1. Quick Start for New Projects

### 1.1 Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/corapan-webapp.git my-new-project
cd my-new-project

# Remove git history (start fresh)
rm -rf .git
git init

# Install dependencies
python -m pip install -r requirements.txt

# Initialize auth database
python scripts/apply_auth_migration.py --db data/db/auth.db --reset
python scripts/create_initial_admin.py --db data/db/auth.db --username admin --password change-me

# Start dev server
.\scripts\dev-start.ps1  # Windows
# or
python -m src.app.main   # Any platform
```

### 1.2 Rebrand the Project

1. **Update project name** in:
   - `pyproject.toml` → `name`
   - `package.json` → `name`
   - `README.md` → Title and description
   - `templates/base.html` → `<title>` default

2. **Update branding tokens** in `static/css/branding.css`:
   - Primary/secondary colors
   - Logo references
   - Project-specific colors

3. **Update content pages**:
   - `templates/pages/impressum.html`
   - `templates/pages/privacy.html`
   - `templates/pages/index.html` (landing page)

---

## 2. Creating New Pages

### 2.1 Choose the Right Skeleton

All new pages must start from a skeleton in `templates/_md3_skeletons/`:

| Skeleton | Use Case |
|----------|----------|
| `page_text_skeleton.html` | Content pages (About, Legal, Privacy) |
| `page_form_skeleton.html` | Single-form pages |
| `page_large_form_skeleton.html` | Complex multi-section forms |
| `page_admin_skeleton.html` | Admin dashboards and lists |
| `auth_login_skeleton.html` | Login/auth pages |
| `auth_profile_skeleton.html` | Profile/account pages |
| `auth_dialog_skeleton.html` | Modal dialogs |

### 2.2 Create a New Text Page

1. Copy the skeleton:
   ```bash
   cp templates/_md3_skeletons/page_text_skeleton.html templates/pages/about.html
   ```

2. Edit the page:
   ```html
   {% extends 'base.html' %}
   {% block page_title %}About - My Project{% endblock %}

   {% block content %}
   <div class="md3-page">
     <header class="md3-page__header">
       <div class="md3-hero md3-hero--card md3-hero__container">
         <div class="md3-hero__icon" aria-hidden="true">
           <span class="material-symbols-rounded">info</span>
         </div>
         <div class="md3-hero__content">
           <p class="md3-body-small md3-hero__eyebrow">Information</p>
           <h1 class="md3-headline-medium md3-hero__title">About Us</h1>
           <p class="md3-body-medium md3-hero__intro">Learn more about our project.</p>
         </div>
       </div>
     </header>

     <main class="md3-text-page">
       <section class="md3-text-section">
         <h2 class="md3-title-large md3-section-title">Our Mission</h2>
         <p class="md3-body-large">Content here...</p>
       </section>
     </main>
   </div>
   {% endblock %}
   ```

3. Add route in `src/app/routes/public.py`:
   ```python
   @blueprint.get("/about")
   def about_page():
       return render_template("pages/about.html")
   ```

4. Run MD3 lint to verify:
   ```bash
   python scripts/md3-lint.py
   ```

### 2.3 Create a Form Page

1. Copy form skeleton:
   ```bash
   cp templates/_md3_skeletons/page_form_skeleton.html templates/pages/contact.html
   ```

2. Customize form fields and add route

3. Ensure CSRF protection on POST handler

### 2.4 Create an Admin Page

1. Copy admin skeleton
2. Add route with `@jwt_required()` and `@require_role(Role.ADMIN)`
3. Test that non-admin users get 403

---

## 3. Customizing Branding

### 3.1 Design Tokens

The design system uses CSS custom properties (tokens). Key files:

| File | Purpose |
|------|---------|
| `static/css/md3/tokens.css` | Core MD3 tokens (don't modify) |
| `static/css/app-tokens.css` | App-specific overrides |
| `static/css/branding.css` | Brand-specific colors (create this) |

### 3.2 Brand Colors

Create `static/css/branding.css`:

```css
/* =================================================================
   BRANDING TOKENS
   
   Override these for each new project.
   These define the project's visual identity.
   ================================================================= */

:root {
  /* BRAND: Primary color - main accent color for the project */
  --brand-primary: #6750A4;
  --brand-on-primary: #FFFFFF;
  --brand-primary-container: #EADDFF;
  --brand-on-primary-container: #21005D;

  /* BRAND: Secondary color - supporting accent */
  --brand-secondary: #625B71;
  --brand-on-secondary: #FFFFFF;
  --brand-secondary-container: #E8DEF8;
  --brand-on-secondary-container: #1D192B;

  /* BRAND: Tertiary color - contrast accent */
  --brand-tertiary: #7D5260;
  --brand-on-tertiary: #FFFFFF;
  
  /* Map brand tokens to MD3 system tokens */
  --md-sys-color-primary: var(--brand-primary);
  --md-sys-color-on-primary: var(--brand-on-primary);
  --md-sys-color-primary-container: var(--brand-primary-container);
  --md-sys-color-on-primary-container: var(--brand-on-primary-container);
  --md-sys-color-secondary: var(--brand-secondary);
  --md-sys-color-on-secondary: var(--brand-on-secondary);
  --md-sys-color-secondary-container: var(--brand-secondary-container);
  --md-sys-color-on-secondary-container: var(--brand-on-secondary-container);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark mode brand overrides */
    --brand-primary: #D0BCFF;
    --brand-on-primary: #381E72;
    --brand-primary-container: #4F378B;
    --brand-on-primary-container: #EADDFF;
  }
}
```

Add to `base.html` after `app-tokens.css`:
```html
<link rel="stylesheet" href="{{ url_for('static', filename='css/branding.css') }}">
```

### 3.3 Logo and Favicon

1. Replace files in `static/img/`:
   - `favicon.ico`
   - `logo.svg` (if used)
   - `logo-dark.svg` (if used)

2. Update references in templates

### 3.4 Footer and Legal

Update these files for your project:
- `templates/partials/footer.html`
- `templates/pages/impressum.html`
- `templates/pages/privacy.html`

---

## 4. Adding New Routes

### 4.1 Public Route

```python
# In src/app/routes/public.py
@blueprint.get("/my-page")
def my_page():
    return render_template("pages/my_page.html")
```

### 4.2 Protected Route (Any User)

```python
from flask_jwt_extended import jwt_required

@blueprint.get("/dashboard")
@jwt_required()
def dashboard():
    return render_template("pages/dashboard.html")
```

### 4.3 Admin-Only Route

```python
from flask_jwt_extended import jwt_required
from ..auth import Role
from ..auth.decorators import require_role

@blueprint.get("/admin/settings")
@jwt_required()
@require_role(Role.ADMIN)
def admin_settings():
    return render_template("pages/admin_settings.html")
```

---

## 5. Testing Your Changes

### 5.1 Run MD3 Lint

```bash
python scripts/md3-lint.py
```

This checks:
- Proper skeleton usage
- Heading hierarchy
- MD3 class naming
- Accessibility basics

### 5.2 Run Unit Tests

```bash
pytest tests/
```

### 5.3 Run E2E Tests

```bash
npm run test:e2e
```

### 5.4 Manual Checklist

- [ ] Page renders without errors
- [ ] Navigation works (links, back button)
- [ ] Forms submit correctly
- [ ] Auth protection works (if applicable)
- [ ] Mobile responsive
- [ ] Dark mode works

---

## 6. Common Patterns

### 6.1 Flash Messages

```python
from flask import flash
flash("Operation successful!", "success")
flash("Something went wrong.", "error")
```

Messages display automatically via MD3 alert components.

### 6.2 Form Validation

Use server-side validation and return errors:

```python
if not form_data.get("email"):
    flash("Email is required", "error")
    return render_template("pages/form.html", errors=["Email is required"])
```

### 6.3 API Endpoints

```python
from flask import jsonify

@blueprint.get("/api/data")
@jwt_required()
def get_data():
    return jsonify({"items": [...], "total": 42})
```

---

## 7. Deployment

See `docs/operations/release_checklist.md` for deployment steps.

Key environment variables:
- `FLASK_SECRET_KEY` - Session encryption
- `JWT_SECRET_KEY` - Token signing
- `AUTH_DATABASE_URL` - Auth database
- `JWT_COOKIE_SECURE=true` - HTTPS cookies

---

## 8. Getting Help

- **MD3 Docs:** `docs/md3/` - Design system documentation
- **Patterns:** `docs/md3/30_patterns_and_skeletons.md` - Component patterns
- **Troubleshooting:** `docs/troubleshooting/` - Common issues
