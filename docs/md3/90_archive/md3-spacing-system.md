# MD3 Spacing System — Vertikale Abstände

> **Status**: Kanonische Referenz für CO.RA.PAN Webapp  
> **Version**: 1.1 • 2025-01-30

---

## Zusammenfassung

Dieses Dokument definiert das kanonische Spacing-System für MD3-Komponenten.
Die Werte basieren auf den offiziellen **Material Design 3 Guidelines**:

- **Baseline Grid**: 8dp für Layout, 4dp für Icons/Typo
- **Textfield Container**: 56dp Höhe (Standard)
- **Supporting Text**: 4dp Abstand oben
- **Formular-Felder**: 12px (--space-3) zwischen Textfields
- **Dialog-Sektionen**: 16px (--space-4) zwischen Inhaltsbereichen

---

## 1. Token-Übersicht

| Token | Wert | Verwendung |
|-------|------|------------|
| `--space-1` | 4px | Micro-spacing (Label-Padding, Icon-Gap) |
| `--space-2` | 8px | Tight spacing (kompakte Listen) |
| `--space-3` | 12px | **Form-Fields** (zwischen Textfields) |
| `--space-4` | 16px | **Dialog-Inhalte**, Card-Padding |
| `--space-6` | 24px | **Sections** innerhalb einer Seite |
| `--space-8` | 32px | **Page-Level** Sektions-Trennung |
| `--space-10` | 40px | Hero/Header-Bereich |

---

## 2. Stack-Klassen (Vertikaler Rhythmus)

### `.md3-stack--page`
**Gap**: `--space-8` (32px)  
**Verwendung**: Zwischen Top-Level-Sektionen einer Seite

```html
<div class="md3-page">
  <header class="md3-page__header">...</header>
  <main class="md3-stack--page">
    <section>Sektion 1</section>  <!-- 32px gap -->
    <section>Sektion 2</section>
  </main>
</div>
```

### `.md3-stack--section`
**Gap**: `--space-6` (24px)  
**Verwendung**: Innerhalb einer Sektion (Titel → Inhalt → Actions)

```html
<section class="md3-stack--section">
  <h2>Titel</h2>           <!-- 24px gap -->
  <p>Beschreibung</p>      <!-- 24px gap -->
  <div class="md3-actions">...</div>
</section>
```

### `.md3-stack--dialog`
**Gap**: `--space-4` (16px)  
**Verwendung**: Dialog-Inhalte (Intro-Text → Form → Actions)

```html
<div class="md3-dialog__content md3-stack--dialog">
  <p>Einleitungstext</p>   <!-- 16px gap -->
  <form class="md3-form">...</form>
</div>
```

### `.md3-form` / `.md3-auth-form`
**Gap**: `--space-3` (12px)  
**Verwendung**: Zwischen Formularfeldern

```html
<form class="md3-form">
  <div class="md3-outlined-textfield">...</div>  <!-- 12px gap -->
  <div class="md3-outlined-textfield">...</div>  <!-- 12px gap -->
  <div class="md3-actions">...</div>
</form>
```

---

## 3. Kanonische Dialog-Struktur

```
┌─────────────────────────────────────────┐
│  Dialog Surface (padding: --space-4)    │
│  ┌───────────────────────────────────┐  │
│  │ Title (md3-dialog__title)         │  │
│  │ padding: --space-2 0 --space-1    │  │
│  └───────────────────────────────────┘  │
│           ↓ gap: --space-4 (Header)     │
│  ┌───────────────────────────────────┐  │
│  │ Intro-Text (p.md3-body-medium)    │  │
│  └───────────────────────────────────┘  │
│           ↓ gap: --space-4 (Stack)      │
│  ┌───────────────────────────────────┐  │
│  │ Form (md3-form gap: --space-3)    │  │
│  │  ├─ Textfield 1                   │  │
│  │  │      ↓ 12px                    │  │
│  │  ├─ Textfield 2                   │  │
│  │  │      ↓ 12px                    │  │
│  │  └─ Textfield 3                   │  │
│  └───────────────────────────────────┘  │
│           ↓ gap: --space-4              │
│  ┌───────────────────────────────────┐  │
│  │ Actions (md3-dialog__actions)     │  │
│  │ padding-top: --space-4            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 4. Regeln für konsistente Abstände

### 4.1 Dialog-Formulare
- **Intro-Text → Form**: `--space-4` (16px) via `.md3-stack--dialog`
- **Zwischen Textfields**: `--space-3` (12px) via `.md3-form`
- **Form → Actions**: `--space-4` (16px) via `.md3-dialog__actions`

### 4.2 Card-Formulare
- **Card-Header → Content**: `--space-4` (16px) via Card-Gap
- **Zwischen Textfields**: `--space-3` (12px) via `.md3-auth-form`
- **Content → Actions**: `--space-4` (16px) via `.md3-card__actions`

### 4.3 Page-Formulare
- **Section-Header → Form**: `--space-6` (24px) via `.md3-stack--section`
- **Zwischen Textfields**: `--space-3` (12px) via `.md3-form`

---

## 5. Anti-Patterns (Vermeiden!)

### ❌ Verschachtelte Stacks
```html
<!-- FALSCH: Doppelte Gaps -->
<div class="md3-stack--dialog">
  <form class="md3-stack--dialog">  <!-- Nicht verschachteln! -->
```

### ❌ Inline Margins
```html
<!-- FALSCH: Hardcoded Margins -->
<p style="margin-bottom: 24px">Text</p>
```

### ❌ Bootstrap Utilities in MD3-Kontexten
```html
<!-- FALSCH: Legacy Utilities -->
<div class="md3-form mt-4 mb-3">
```

### ✅ Richtig: Semantische Klassen
```html
<div class="md3-dialog__content md3-stack--dialog">
  <p class="md3-body-medium">Einleitung</p>
  <form class="md3-form">
    <!-- Fields ohne extra margins -->
  </form>
</div>
```

---

## 6. CSS-Implementierung

```css
/* Stack-Klassen */
.md3-stack--page > * + * { margin-top: var(--space-8); }
.md3-stack--section > * + * { margin-top: var(--space-6); }
.md3-stack--dialog > * + * { margin-top: var(--space-4); }

/* Form-Layouts */
.md3-form, .md3-auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);  /* 12px zwischen Fields */
}

/* Dialog-Header */
.md3-dialog__header {
  margin-bottom: var(--space-4);  /* 16px unter Header */
}

/* Dialog-Actions */
.md3-dialog__actions {
  margin-top: var(--space-4);  /* 16px über Actions */
}
```

---

## 7. Checkliste für Entwickler

Beim Erstellen von Formularen:

- [ ] Container verwendet `.md3-stack--dialog` (Dialoge) oder `.md3-stack--section` (Seiten)
- [ ] Form verwendet `.md3-form` oder `.md3-auth-form`
- [ ] Keine manuellen `margin-top`/`margin-bottom` auf Elementen
- [ ] Keine Bootstrap-Utilities (`mt-*`, `mb-*`) innerhalb MD3-Komponenten
- [ ] Actions am Ende, nicht zwischen Fields

---

## 8. Vertikale Abstände — MD3 Richtlinien

### 8.1 Offizielles MD3 Baseline Grid

Material Design 3 verwendet ein **8dp-Raster** für Layout und ein **4dp-Raster** für
feinere Elemente wie Icons und Typografie.

| Raster | Verwendung |
|--------|------------|
| **8dp** | Layout-Komponenten (App Bar, Cards, Buttons) |
| **4dp** | Icons, Typografie, kleinere Elemente |

> Quelle: [m2.material.io/design/layout/spacing-methods](https://m2.material.io/design/layout/spacing-methods.html)

### 8.2 Textfield-Spezifikationen

Gemäß [m3.material.io/components/text-fields/specs](https://m3.material.io/components/text-fields/specs):

| Element | Wert |
|---------|------|
| Container-Höhe | 56dp (Standard) |
| Left/Right Padding (ohne Icons) | 16dp |
| Left/Right Padding (mit Icons) | 12dp |
| Supporting Text Top Padding | 4dp |
| Label Position (fokussiert) | Am oberen Rand des Containers |

### 8.3 Empfohlene Abstände zwischen Text und Textfields

Wenn ein **Beschreibungstext** (z.B. `<p>`) vor einem Textfield steht:

| Kontext | Gap | Begründung |
|---------|-----|------------|
| **Dialog** | `--space-4` (16px) | Via `.md3-stack--dialog` — genug Abstand für den fokussierten Label |
| **Card** | `--space-4` (16px) | Via `.md3-card__content > * + *` |
| **Seite** | `--space-6` (24px) | Via `.md3-stack--section` — mehr Luft auf Seitenebene |

#### Warum 16px im Dialog optimal ist

1. **Outlined Textfield Labels** bewegen sich bei Fokus nach oben (~10px über Container)
2. Ein 16px-Abstand zwischen Text und Textfield lässt genug Raum für das animierte Label
3. Kompaktere Werte (8px, 12px) führen zu visueller Überlappung bei Focus-Animation
4. MD3 Guidelines empfehlen "sufficient padding to prevent multi-lined errors from bumping layout"

---

## 9. Label-Hintergrund (Outlined Textfield)

### 9.1 Warum Labels einen Hintergrund brauchen

Beim **Outlined Textfield** bewegt sich das Label bei Fokus/Befüllung nach oben und
positioniert sich **auf** der Border-Linie. Ohne Hintergrundfarbe würde die Border
durch das Label-Text hindurch sichtbar sein.

```
   Unfokussiert:               Fokussiert:
   ┌────────────────────┐       ╭ Label ╮
   │   Label            │      ┌┴───────┴───────┐
   │                    │  →   │                │
   └────────────────────┘      └────────────────┘
```

### 9.2 Systematische Lösung: CSS Custom Property Inheritance

Ab Version 1.1 verwendet das System eine **vererbte CSS Custom Property**
`--md3-textfield-label-bg`, die automatisch den Label-Hintergrund an den
Container anpasst:

```
┌─────────────────────────────────────────────────────┐
│  .md3-page                                          │
│  --md3-textfield-label-bg: var(--md-sys-color-surface)
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  .md3-card--tonal                            │   │
│  │  --md3-textfield-label-bg:                   │   │
│  │       var(--md-sys-color-surface-container)  │   │
│  │                                              │   │
│  │  ┌────────────────────────────────────┐     │   │
│  │  │  .md3-outlined-textfield__label    │     │   │
│  │  │  background: var(--md3-textfield-  │     │   │
│  │  │              label-bg)   ← erbt!   │     │   │
│  │  └────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 9.3 Container-Konfiguration

Die folgenden Container setzen automatisch `--md3-textfield-label-bg`:

| Container | Datei | Background Token |
|-----------|-------|------------------|
| `.md3-page` | `layout.css` | `--md-sys-color-surface` |
| `.md3-dialog__surface` | `dialog.css` | `--md-sys-color-surface` |
| `.md3-dialog--tonal .md3-dialog__surface` | `dialog.css` | `--md-sys-color-surface-container-high` |
| `.md3-auth-card` | `auth.css` | `--md-sys-color-surface-container-high` |
| `.md3-card--tonal` | `cards.css` | `--md-sys-color-surface-container` |
| `.md3-card--outlined` | `cards.css` | `--md-sys-color-surface-container-low` |
| `.md3-sheet__surface` | `login.css` | `--md-sys-color-surface` |

### 9.4 Label-CSS-Implementierung

```css
/* textfields.css — Label verwendet vererbte Property */
.md3-outlined-textfield__label {
  /* SYSTEMATIC LABEL BACKGROUND:
     Uses inherited --md3-textfield-label-bg from container, with fallback
     to page surface. */
  background: var(--md3-textfield-label-bg, var(--md-sys-color-surface, #fff));
}

/* Fokussiertes/Befülltes Label — gleiche Property */
.md3-outlined-textfield__input:focus ~ .md3-outlined-textfield__label,
.md3-outlined-textfield__input:not(:placeholder-shown) ~ .md3-outlined-textfield__label {
  background: var(--md3-textfield-label-bg, var(--md-sys-color-surface, #fff));
}
```

### 9.5 Eigene Container hinzufügen

Um einen neuen Container mit korrektem Label-Hintergrund zu erstellen:

```css
.my-custom-panel {
  background: var(--md-sys-color-surface-variant);
  /* Setze die Label-BG-Property auf den gleichen Wert */
  --md3-textfield-label-bg: var(--md-sys-color-surface-variant);
}
```

### 9.6 Label-Hintergrund deaktivieren (NICHT EMPFOHLEN)

```css
/* ⚠️ WARNUNG: Bricht den MD3 Notch-Effekt! */
.my-transparent-field .md3-outlined-textfield__label {
  background: transparent !important;
}
```

> Ein transparenter Label-Hintergrund führt dazu, dass die Border durch den
> Label-Text sichtbar ist. Das entspricht **nicht** den MD3-Richtlinien.

---

## 10. Häufige Fragen

### Q: Warum erscheint das Label zu nah am vorherigen Textfield?

**A**: Prüfe folgende Punkte:
1. Verwendet das Formular `.md3-form` (gap: 12px)?
2. Ist ein Text-Element (`<p>`) zwischen den Textfields? → Nutze `.md3-stack--dialog`
3. Sind verschachtelte Stack-Klassen vorhanden? → Entfernen!

### Q: Kann ich den Abstand zwischen Textfields vergrößern?

**A**: Ja, verwende `.md3-auth-form` mit `gap: var(--space-4)` (16px) statt `.md3-form`:

```css
.md3-auth-form {
  gap: var(--space-4); /* 16px statt 12px */
}
```

### Q: Wie ändere ich die Label-Hintergrundfarbe nur für eine Seite?

**A**: Definiere einen spezifischen Selektor:

```css
.my-page .md3-outlined-textfield__label {
  background: var(--md-sys-color-surface-container);
}
```
