# QA Checklist

> **Version:** 1.0  
> **Last Updated:** 2025-11-27

Quality assurance checklist for accessibility, visual consistency, and UI/UX.

---

## 1. Accessibility Audit

### 1.1 Contrast (WCAG AA)

| Component | Status | Notes |
|-----------|--------|-------|
| Primary buttons | ✅ | MD3 tokens ensure 4.5:1 |
| Secondary buttons | ✅ | |
| Text on surface | ✅ | |
| Links | ✅ | |
| Error messages | ✅ | Red on surface |
| Alerts (info/warning/error) | ✅ | |
| Input labels | ✅ | |
| Navigation items | ✅ | |
| Footer links | ✅ | |

**Tool:** Use browser DevTools or axe-core extension to verify.

### 1.2 Focus & Keyboard Navigation

| Test | Status | How to Verify |
|------|--------|---------------|
| All interactive elements tab-focusable | ✅ | Tab through page |
| Focus rings visible | ✅ | No `outline: none` without replacement |
| Dialog focus trap | ✅ | Focus stays in dialog until closed |
| Sheet focus trap | ✅ | Same as dialog |
| Skip link (optional) | ❌ | Not implemented |

**Keyboard Flow Tests:**
- [ ] Login form: Tab to username → password → submit, Enter submits
- [ ] Search: Tab to input, Enter searches
- [ ] Dialogs: Tab cycles within, Escape closes
- [ ] Navigation drawer: Opens with menu button, Tab navigates, Escape closes

### 1.3 Screenreader Basics

| Element | Requirement | Status |
|---------|-------------|--------|
| Page headings | H1 → H2 → H3 hierarchy | ✅ |
| Dialogs | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | ✅ |
| Alerts | `role="alert"` or `role="status"`, `aria-live` | ✅ |
| Form errors | `role="alert"`, `aria-describedby` on input | ✅ |
| Icon buttons | `aria-label` or visible text | ✅ |
| Player controls | Labels/titles on buttons | ✅ |

### 1.4 Error Feedback

- [ ] Form validation errors announced to screenreader
- [ ] Error messages have `role="alert"`
- [ ] Invalid inputs have `aria-invalid="true"`
- [ ] Error text linked via `aria-describedby`

---

## 2. Visual Consistency

### 2.1 Key Screens for Visual Regression

| Screen | URL | Priority |
|--------|-----|----------|
| Landing/Index | `/` | High |
| Login | `/login` | High |
| Advanced Search | `/search/advanced` | High |
| Admin Users | `/admin/users` | High |
| Profile | `/auth/account/profile/page` | Medium |
| Impressum | `/impressum` | Low |
| 404 Error | `/nonexistent` | Low |
| Privacy | `/privacy` | Low |

**Screenshot Tool:** Playwright can capture screenshots for comparison.

```javascript
// Example Playwright visual test
await page.goto('/login');
await expect(page).toHaveScreenshot('login.png');
```

### 2.2 Component Consistency

#### Buttons
- [ ] Primary: Filled, prominent color
- [ ] Secondary: Outlined or tonal
- [ ] Labels: Sentence case ("Save changes" not "SAVE CHANGES")

#### Alerts/Banners
- [ ] Info: Blue/teal tones
- [ ] Warning: Yellow/amber
- [ ] Error: Red
- [ ] Success: Green
- [ ] Consistent title style ("Error:", "Hinweis:", etc.)

#### Spacing
- [ ] Cards use `md3-stack` patterns
- [ ] Dialogs have consistent padding
- [ ] Forms have consistent gap between fields

#### Typography
- [ ] Headlines use MD3 type scale
- [ ] Body text readable size
- [ ] No font size < 14px for body

---

## 3. Browser Testing

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ✅ |
| Firefox | Latest | ✅ |
| Safari | Latest | ⚠️ Test on macOS |
| Edge | Latest | ✅ |
| Mobile Chrome | Latest | ✅ |
| Mobile Safari | Latest | ⚠️ Test on iOS |

---

## 4. Performance Checks

### Lighthouse Targets

| Metric | Target | How to Check |
|--------|--------|--------------|
| Performance | > 80 | Chrome DevTools → Lighthouse |
| Accessibility | > 90 | |
| Best Practices | > 90 | |
| SEO | > 80 | |

### Key Metrics

| Metric | Target |
|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s |
| CLS (Cumulative Layout Shift) | < 0.1 |
| FID (First Input Delay) | < 100ms |
| JS Bundle Size | Monitor for growth |

---

## 5. Tools & Commands

### Accessibility Testing

```bash
# Install axe-core CLI
npm install -g @axe-core/cli

# Run accessibility audit
axe http://localhost:8000/
axe http://localhost:8000/login
axe http://localhost:8000/search/advanced
```

### Visual Regression

```bash
# Generate baseline screenshots
npx playwright test --update-snapshots

# Compare against baseline
npx playwright test
```

### Lighthouse

```bash
# Install lighthouse
npm install -g lighthouse

# Run audit
lighthouse http://localhost:8000/ --output html --output-path ./reports/lighthouse.html
```

---

## 6. Known Issues / Exceptions

| Issue | Status | Reason |
|-------|--------|--------|
| `'unsafe-inline'` in style-src CSP | Accepted | Required for current DataTables/jQuery |
| Skip link missing | Planned | Low priority, navigation drawer accessible |

---

## 7. Sign-Off

| Check | Date | Reviewer |
|-------|------|----------|
| Accessibility Audit | | |
| Visual Regression | | |
| Browser Testing | | |
| Performance Check | | |
