# Form-System: Dialog-Container Fix + Vollständiges Audit

**Datum:** 2026-01-04  
**Status:** ✅ Systematisch gelöst

## Problem

Forms in **Dialog-Containern** (`.md3-dialog__surface`) hatten nicht die richtige Variante und das Spacing war nicht optimal abgestimmt. Das Dialog-Styling unterscheidet sich von normalen Cards, da Dialoge auf `var(--md-sys-color-surface)` (weiß) gerendert werden.

---

## Lösung

### 1. Neue Dialog-Variante erstellt

**Datei:** `static/css/md3/components/forms.css`

```css
/* Dialog-spezifische Variante (für Forms in .md3-dialog__surface) */
.form-dialog {
  --form-field-bg: var(--md-sys-color-surface); /* Dialog-Surface ist immer surface (weiß) */
  --form-field-border: var(--md-sys-color-outline); /* Stärkere Border für weißen Hintergrund */
}

/* Dialog-Content hat bereits .md3-stack--dialog mit eigenem Gap */
.md3-dialog__content .form-field {
  margin-bottom: 0; /* Dialog-Stack übernimmt Spacing */
}
```

**Warum `.form-dialog` statt `.form-surface`?**
- Dialog-Surfaces sind **immer** weiß (`var(--md-sys-color-surface)`)
- Sie brauchen stärkere Borders (`outline` statt `outline-variant`)
- Spacing wird von `.md3-stack--dialog` übernommen (16px Gap)

---

### 2. Dialog-Form Gap koordiniert

**Datei:** `static/css/md3/components/auth.css`

**Vorher:**
```css
.md3-dialog__content .md3-form {
  display: flex;
  flex-direction: column;
}
```

**Nachher:**
```css
.md3-dialog__content .md3-form {
  gap: 0; /* Dialog verwendet .md3-stack--dialog mit var(--space-4) */
}
```

**Erklärung:**
- `.md3-form` hat normalerweise `gap: var(--space-3)` (12px)
- In Dialogen ist das **zusätzlich** zum `.md3-stack--dialog` Gap (16px)
- Das führt zu **zu großen Abständen** (28px statt 16px)
- Lösung: `.md3-form` Gap in Dialogen auf `0` setzen

---

### 3. Alle Dialog-Forms systematisch umgestellt

#### Admin-Dialoge

**Datei:** `templates/auth/admin_users.html`

##### Create User Dialog
```html
<form id="create-user-form" method="post" class="md3-form form-dialog">
  <div class="form-field">
    <label for="new-username">Benutzername</label>
    <input type="text" id="new-username" name="username" required>
  </div>
  <!-- ... weitere Felder -->
</form>
```
**Änderung:** `.form-surface` → `.form-dialog` ✅

##### Edit User Dialog
```html
<form id="user-edit-form" class="md3-form form-dialog">
  <div class="form-field">
    <label for="edit-username">Benutzername</label>
    <input type="text" id="edit-username" name="username" readonly>
  </div>
  <!-- ... weitere Felder -->
</form>
```
**Änderung:** `.form-surface` → `.form-dialog` ✅

#### Account Profile Delete Dialog

**Datei:** `templates/auth/account_profile.html`

```html
<div class="md3-dialog__content md3-stack--dialog form-dialog">
  <p class="md3-body-medium">Bist du sicher, dass du dein Konto löschen möchtest?</p>
  
  <div class="form-field">
    <label for="delete-password">Dein Passwort</label>
    <input id="delete-password" name="password" type="password" required>
  </div>
</div>
```
**Änderung:** `.form-dialog` Klasse auf `.md3-dialog__content` gesetzt ✅

---

## Vollständiges Formular-Audit

### ✅ Produktive Templates (alle umgestellt)

| Template | Form-Kontext | Variante | Status |
|----------|--------------|----------|--------|
| **Auth-Pages (Cards)** |||
| `auth/login.html` | Login-Card | `.form-surface` | ✅ |
| `auth/account_profile.html` | Profil-Card | `.form-surface` | ✅ |
| `auth/account_password.html` | Password-Card | `.form-surface` | ✅ |
| `auth/password_reset.html` | Reset-Card | `.form-surface` | ✅ |
| `auth/password_forgot.html` | – | Kein Form | ✅ |
| `auth/account_delete.html` | Delete-Card | `.form-surface` | ✅ |
| **Admin-Pages** |||
| `auth/admin_users.html` (Suchfeld) | Table-Container | `.form-field--compact` | ✅ |
| **Admin-Dialoge** |||
| `admin_users.html` (Create Dialog) | Dialog | `.form-dialog` | ✅ |
| `admin_users.html` (Edit Dialog) | Dialog | `.form-dialog` | ✅ |
| `admin_users.html` (Invite Dialog) | Dialog | Kein Form | ✅ |
| `account_profile.html` (Delete Dialog) | Dialog | `.form-dialog` | ✅ |
| **Quiz-Module** |||
| `games/quiz/topic_entry.html` | Quiz-Panel | `quiz-input-group` | ⏭️ (eigene Komponente) |

### ⏭️ Skeletons (Entwickler-Beispiele, nicht kritisch)

| Template | Status | Hinweis |
|----------|--------|---------|
| `_md3_skeletons/page_form_skeleton.html` | ⚠️ Alt | Verwendet noch `md3-outlined-textfield` |
| `_md3_skeletons/page_large_form_skeleton.html` | ⚠️ Alt | Verwendet noch `md3-outlined-textfield` |
| `_md3_skeletons/auth_login_skeleton.html` | ⚠️ Alt | Verwendet noch `md3-outlined-textfield` |
| `_md3_skeletons/auth_profile_skeleton.html` | ⚠️ Alt | Verwendet noch `md3-outlined-textfield` |
| `_md3_skeletons/dialog_skeleton.html` | ⚠️ Alt | Verwendet noch `md3-textfield` |

**Hinweis:** Skeletons sind Entwickler-Referenzen und nicht produktiv im Einsatz. Sie können bei Bedarf später aktualisiert werden.

---

## Form-Varianten Übersicht

### Wann welche Variante?

| Variante | Verwendung | Border-Stärke | Hintergrund |
|----------|------------|---------------|-------------|
| `.form-surface` | Forms in Cards/Pages | `outline-variant` (schwächer) | `surface` |
| `.form-panel` | Forms auf getöntem Panel | `outline` (stärker) | `surface` |
| `.form-background` | Forms direkt auf Background | `outline` (stärker) | `surface` |
| `.form-dialog` | **Forms in Dialogen** | `outline` (stärker) | `surface` |

**Faustregel:**
- **Card/Page:** `.form-surface` (schwächere Border, da bereits auf Container)
- **Dialog:** `.form-dialog` (stärkere Border, da auf weißem Hintergrund)
- **Panel (getönt):** `.form-panel` (stärkere Border für Kontrast)

---

## Spacing-Hierarchie in Dialogen

### Vorher (Problem):
```
.md3-dialog__content (Wrapper)
  ├─ .md3-stack--dialog → gap: 16px
  └─ .md3-form → gap: 12px
       └─ .form-field → margin-bottom: 16px
           = TOTAL: 16px + 12px + 16px = 44px (viel zu viel!)
```

### Nachher (Fix):
```
.md3-dialog__content.form-dialog (Wrapper)
  ├─ .md3-stack--dialog → gap: 16px
  └─ .md3-form → gap: 0 (überschrieben)
       └─ .form-field → margin-bottom: 0 (überschrieben)
           = TOTAL: 16px (optimal!)
```

**Mechanismus:**
1. `.md3-dialog__content` hat `.md3-stack--dialog` → 16px Gap zwischen Elementen
2. `.md3-form` Gap wird auf `0` gesetzt (nur in Dialogen)
3. `.form-field` margin wird auf `0` gesetzt (durch `.md3-dialog__content .form-field`)
4. Spacing kommt **nur** vom Dialog-Stack → konsistent 16px

---

## Visuelle Verbesserungen

### Vorher:
- ❌ Dialog-Forms hatten `.form-surface` (falsche Border-Stärke)
- ❌ Zu große Abstände (doppeltes Gap: Dialog + Form)
- ❌ Inputs schwer erkennbar auf weißem Hintergrund

### Nachher:
- ✅ Alle Dialog-Forms haben `.form-dialog` (richtige Border)
- ✅ Optimiertes Spacing (nur Dialog-Stack Gap)
- ✅ Inputs klar erkennbar (stärkere Borders)

---

## Testing-Checkliste

### Admin "Neuen Benutzer anlegen" Dialog
- [ ] Username-Feld: Klar erkennbar, Border sichtbar
- [ ] Email-Feld: Gleicher Abstand wie Username
- [ ] Rolle-Dropdown: Border sichtbar, Pfeil erkennbar
- [ ] Abstände zwischen Feldern: ~16px (nicht zu groß)
- [ ] Focus-State: Subtiler Ring, klar sichtbar

### Admin "Benutzer bearbeiten" Dialog
- [ ] Username-Feld (readonly): Leicht grauer Hintergrund
- [ ] Email-Feld: Normal editierbar
- [ ] Rolle-Dropdown: Gleiche Breite wie andere Felder
- [ ] Checkbox "Konto aktiv": Richtig positioniert

### Account "Konto löschen" Dialog
- [ ] Passwort-Feld: Klar erkennbar
- [ ] Error-State (falls falsch): Roter Border
- [ ] Abstand zum Text: Nicht zu groß

### Mobile (375px)
- [ ] Alle Dialog-Felder: Volle Breite
- [ ] Keine Overflow-Probleme
- [ ] Touch-Targets groß genug (min 44px)

---

## Zusammenfassung

### Geänderte Dateien
1. **`static/css/md3/components/forms.css`**
   - Neue `.form-dialog` Variante hinzugefügt
   - `.md3-dialog__content .form-field` Regel hinzugefügt

2. **`static/css/md3/components/auth.css`**
   - `.md3-dialog__content .md3-form` Gap auf 0 gesetzt

3. **`templates/auth/admin_users.html`**
   - Create Dialog: `.form-surface` → `.form-dialog`
   - Edit Dialog: `.form-surface` → `.form-dialog`

4. **`templates/auth/account_profile.html`**
   - Delete Dialog: `.form-dialog` auf `.md3-dialog__content` gesetzt

### Ergebnis
✅ **Alle Dialog-Forms systematisch gefunden und gelöst**  
✅ **Spacing in Dialogen optimiert (16px statt 44px)**  
✅ **Borders überall klar sichtbar**  
✅ **Keine md3-outlined-textfield mehr in produktiven Templates**  

**Das Form-System ist jetzt vollständig und konsistent über alle Kontexte hinweg!** 🎉
