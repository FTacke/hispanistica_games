# Patterns and Skeletons

> **Template Reference for New Pages**  
> All new pages must start from one of these skeleton templates.

---

## 1. Available Skeletons

Location: `templates/_md3_skeletons/`

| Skeleton | Use Case |
|----------|----------|
| `page_text_skeleton.html` | Content pages (Impressum, About, Privacy) |
| `page_form_skeleton.html` | Single-form pages |
| `page_large_form_skeleton.html` | Multi-section form pages |
| `page_admin_skeleton.html` | Admin dashboards and lists |
| `auth_login_skeleton.html` | Login pages (no Hero) |
| `auth_profile_skeleton.html` | Profile/account pages |
| `auth_dialog_skeleton.html` | Auth-specific modal dialogs |
| `dialog_skeleton.html` | General confirmation/alert dialogs |
| `sheet_skeleton.html` | Bottom/side sheets for filters, menus |

---

## 2. Text Page Skeleton

**File:** `page_text_skeleton.html`

**When to use:**
- Content-heavy pages (legal, about, project information)
- Pages with sections of text and headings

**Structure:**
```html
{% extends 'base.html' %}

{% block content %}
<div class="md3-page">
  <header class="md3-page__header">
    <div class="md3-hero md3-hero--card md3-hero__container">
      <div class="md3-hero__icon" aria-hidden="true">
        <span class="material-symbols-rounded">description</span>
      </div>
      <div class="md3-hero__content">
        <p class="md3-body-small md3-hero__eyebrow">Category</p>
        <h1 class="md3-headline-medium md3-hero__title">Page Title</h1>
        <p class="md3-body-medium md3-hero__intro">Brief introduction.</p>
      </div>
    </div>
  </header>

  <main class="md3-text-page">
    <section class="md3-text-section">
      <h2 class="md3-title-large md3-section-title">Section Title</h2>
      <p class="md3-body-large">Content paragraph.</p>
      
      <h3 class="md3-title-medium md3-subsection-title">Subsection</h3>
      <p class="md3-body-medium">Subsection content.</p>
    </section>
  </main>
</div>
{% endblock %}
```

**Key points:**
- H1 only in Hero
- Sections use H2 with `.md3-section-title`
- Subsections use H3 with `.md3-subsection-title`
- Never use H4–H6

---

## 3. Form Page Skeleton

**File:** `page_form_skeleton.html`

**When to use:**
- Pages with a single form
- Settings pages
- Simple data entry

**Structure:**
```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- Hero -->
  </header>

  <main class="md3-page__main">
    <section class="md3-page__section md3-stack--section">
      <article class="md3-card md3-card--outlined">
        <header class="md3-card__header">
          <h2 class="md3-title-large">Form Title</h2>
        </header>
        <div class="md3-card__content">
          <form class="md3-form">
            <div class="md3-outlined-textfield md3-outlined-textfield--block">
              <input class="md3-outlined-textfield__input" id="field" name="field" type="text">
              <label class="md3-outlined-textfield__label" for="field">Label</label>
              <span class="md3-outlined-textfield__outline">
                <span class="md3-outlined-textfield__outline-start"></span>
                <span class="md3-outlined-textfield__outline-notch"></span>
                <span class="md3-outlined-textfield__outline-end"></span>
              </span>
            </div>
            
            <div class="md3-actions">
              <button type="button" class="md3-button md3-button--text">Cancel</button>
              <button type="submit" class="md3-button md3-button--filled">Save</button>
            </div>
          </form>
        </div>
      </article>
    </section>
  </main>
</div>
```

---

## 4. Auth Login Skeleton

**File:** `auth_login_skeleton.html`

**When to use:**
- Login pages
- Simple authentication forms

**Special behavior:**
- No Hero header (design decision)
- Centered card layout

**Structure:**
```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- No Hero for login -->
  </header>

  <main class="md3-page__main md3-stack--page">
    <section class="md3-page__section md3-stack--section">
      <div class="md3-card md3-card--outlined md3-auth-card">
        <div class="md3-card__content md3-form">
          <h1 class="md3-title-large md3-card__title">Login</h1>
          <p class="md3-body-medium">Enter your credentials.</p>

          <!-- Username field -->
          <div class="md3-outlined-textfield md3-outlined-textfield--block">
            <input id="username" name="username" class="md3-outlined-textfield__input" type="text">
            <label class="md3-outlined-textfield__label" for="username">Username</label>
            <!-- outline -->
          </div>

          <!-- Password field -->
          <div class="md3-outlined-textfield md3-outlined-textfield--block">
            <input id="password" name="password" class="md3-outlined-textfield__input" type="password">
            <label class="md3-outlined-textfield__label" for="password">Password</label>
            <!-- outline -->
          </div>

          <div class="md3-actions">
            <button class="md3-button md3-button--text">Forgot password</button>
            <div class="md3-actions__spacer" aria-hidden="true"></div>
            <button class="md3-button md3-button--filled">Login</button>
          </div>
        </div>
      </div>
    </section>
  </main>
</div>
```

---

## 5. Auth Profile Skeleton

**File:** `auth_profile_skeleton.html`

**When to use:**
- Profile pages
- Account settings
- Multi-section account pages

**Structure:**
```html
<div class="md3-page">
  <header class="md3-page__header">
    <div class="md3-hero md3-hero--card md3-hero__container">
      <div class="md3-hero__icon" aria-hidden="true">
        <span class="material-symbols-rounded">account_circle</span>
      </div>
      <div class="md3-hero__content">
        <p class="md3-body-small md3-hero__eyebrow">Account</p>
        <h1 class="md3-headline-medium md3-hero__title">Profile</h1>
      </div>
    </div>
  </header>

  <main class="md3-page__main">
    <section class="md3-page__section md3-auth-page md3-stack--section">
      <!-- Card 1: Basic Info -->
      <article class="md3-card md3-card--outlined md3-auth-card">
        <header class="md3-card__header">
          <h2 class="md3-title-large">Basic Information</h2>
        </header>
        <div class="md3-card__content">
          <!-- Form content -->
        </div>
      </article>

      <!-- Card 2: Security -->
      <article class="md3-card md3-card--outlined md3-auth-card">
        <header class="md3-card__header">
          <h2 class="md3-title-large">Security</h2>
        </header>
        <div class="md3-card__content">
          <!-- Security options -->
        </div>
      </article>
    </section>
  </main>
</div>
```

---

## 6. Dialog Skeleton

**File:** `auth_dialog_skeleton.html`

**When to use:**
- Confirmation dialogs
- Modal forms
- Action confirmations

**Structure:**
```html
<dialog class="md3-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <div class="md3-dialog__container">
    <div class="md3-dialog__surface">
      <header class="md3-dialog__header">
        <h2 id="dialog-title" class="md3-title-large md3-dialog__title">Confirm Action</h2>
      </header>
      <div class="md3-dialog__content md3-stack--dialog">
        <p class="md3-body-medium">Are you sure? This cannot be undone.</p>
      </div>
      <div class="md3-dialog__actions">
        <button class="md3-button md3-button--text" data-md3-dialog-action="cancel">Cancel</button>
        <button class="md3-button md3-button--filled" data-md3-dialog-action="confirm">Confirm</button>
      </div>
    </div>
  </div>
</dialog>
```

**Required attributes:**
- `aria-modal="true"`
- `aria-labelledby` pointing to title

---

## 7. Admin Page Skeleton

**File:** `page_admin_skeleton.html`

**When to use:**
- Admin dashboards
- User management
- Data tables

**Structure:**
```html
<div class="md3-page">
  <header class="md3-page__header">
    <div class="md3-hero md3-hero--card md3-hero__container">
      <div class="md3-hero__icon" aria-hidden="true">
        <span class="material-symbols-rounded">admin_panel_settings</span>
      </div>
      <div class="md3-hero__content">
        <p class="md3-body-small md3-hero__eyebrow">Admin</p>
        <h1 class="md3-headline-medium md3-hero__title">Dashboard</h1>
      </div>
    </div>
  </header>

  <main class="md3-page__main">
    <section class="md3-page__section md3-stack--section">
      <!-- Stats cards -->
      <div class="md3-grid--responsive">
        <article class="md3-card md3-card--elevated">
          <div class="md3-card__content">
            <p class="md3-label-medium">Users</p>
            <p class="md3-headline-medium">1,234</p>
          </div>
        </article>
        <!-- More cards -->
      </div>

      <!-- Data table -->
      <article class="md3-card md3-card--outlined">
        <header class="md3-card__header">
          <h2 class="md3-title-large">Recent Activity</h2>
        </header>
        <div class="md3-card__content">
          <table class="md3-table">
            <!-- Table content -->
          </table>
        </div>
      </article>
    </section>
  </main>
</div>
```

---

## 8. Workflow: Creating a New Page

### Step 1: Choose the Right Skeleton

| Page Type | Skeleton |
|-----------|----------|
| Text/content page | `page_text_skeleton.html` |
| Simple form | `page_form_skeleton.html` |
| Complex form | `page_large_form_skeleton.html` |
| Login | `auth_login_skeleton.html` |
| Profile/account | `auth_profile_skeleton.html` |
| Admin list/dashboard | `page_admin_skeleton.html` |
| Modal dialog | `auth_dialog_skeleton.html` |

### Step 2: Copy and Customize

```bash
cp templates/_md3_skeletons/page_text_skeleton.html templates/pages/your_page.html
```

### Step 3: Update Content

1. Change the Hero icon and title
2. Update the eyebrow category
3. Add your content sections
4. Adjust headings (H2 for sections, H3 for subsections)

### Step 4: Validate

```bash
python scripts/md3-lint.py --focus templates/pages/your_page.html
```

### Step 5: Review Checklist

- [ ] Uses correct skeleton as base
- [ ] H1 only in Hero (or none for login)
- [ ] Sections use H2 with `.md3-section-title`
- [ ] Subsections use H3 with `.md3-subsection-title`
- [ ] No H4–H6 in main content
- [ ] All buttons use `.md3-button--*`
- [ ] All inputs use `.md3-outlined-textfield`
- [ ] No inline styles
- [ ] Passes lint check

---

## 9. Common Modifications

### Adding a Form to a Text Page

```html
<section class="md3-text-section">
  <h2 class="md3-title-large md3-section-title">Contact</h2>
  
  <article class="md3-card md3-card--outlined">
    <div class="md3-card__content">
      <form class="md3-form">
        <!-- Form fields -->
      </form>
    </div>
  </article>
</section>
```

### Adding Multiple Cards

```html
<section class="md3-page__section md3-stack--section">
  <article class="md3-card md3-card--outlined">
    <!-- Card 1 -->
  </article>
  
  <article class="md3-card md3-card--outlined">
    <!-- Card 2 -->
  </article>
</section>
```

### Adding a Dialog to a Page

```html
<!-- At end of template, before closing block -->
<dialog id="my-dialog" class="md3-dialog" aria-modal="true" aria-labelledby="my-dialog-title">
  <!-- Dialog structure from skeleton -->
</dialog>

<script>
  // Dialog open/close logic
</script>
```
