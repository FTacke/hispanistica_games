# MD3 Background Color Standard – games.hispanistica

## Übersicht

Dieses Dokument definiert den kanonischen Standard für Background-Farben im games.hispanistica Projekt nach Material Design 3 (MD3) Best Practices.

**Stand:** 2025-12-20  
**Projekt:** games.hispanistica  
**MD3 Version:** Material Design 3  

---

## Kanonische Token-Hierarchie

### 1. System-Level Tokens (MD3 Core)

```css
/* Definiert in: static/css/md3/tokens.css */
--md-sys-color-background        /* Haupthintergrund der App */
--md-sys-color-surface           /* Für Cards, Panels, Sheets */
--md-sys-color-surface-container /* Container auf Background */
```

### 2. Brand-Level Tokens (Projekt-spezifisch)

```css
/* Definiert in: static/css/branding.css */
--brand-background               /* Projektfarbe für Background */
--brand-surface                  /* Projektfarbe für Surface */
```

### 3. App-Level Tokens (Anwendungs-Ebene)

```css
/* Definiert in: static/css/app-tokens.css */
--app-background                 /* Wird von branding.css überschrieben */
```

---

## Background-Anwendung nach Komponenten-Typ

### Root-Ebene: Body & Main Content

**Regel:** Der Body und Main-Content verwenden `--md-sys-color-background`

```css
/* static/css/layout.css */
body.app-shell {
  background: var(--app-background);
}

main.site-main,
.site-main {
  background: var(--md-sys-color-background);
}
```

**Werte (games.hispanistica):**
- Light Mode: `#F3F6F7` (helles Blau-Grau)
- Dark Mode: `#041317` (dunkles Blau-Grau)

---

### Content-Container: Pages & Sections

**Regel:** Seiten-Container verwenden keinen expliziten Background (erben von Main)

```css
/* static/css/md3/layout.css */
.md3-page {
  /* Kein expliziter Background - erbt von .site-main */
  --_page-bg: var(--md-sys-color-surface);
}
```

**Ausnahme:** Text-Pages können optional `var(--app-background)` verwenden:

```css
/* static/css/md3/components/text-pages.css */
.md3-text-page {
  background: var(--app-background); /* Optional für visuelle Konsistenz */
}
```

---

### Surface-Komponenten: Cards, Dialogs, Sheets

**Regel:** Alle Surface-Komponenten verwenden `--md-sys-color-surface`

```css
/* Beispiel: Cards */
.md3-card {
  background: var(--md-sys-color-surface);
}

/* Beispiel: Dialogs */
.md3-dialog {
  background: var(--md-sys-color-surface);
}

/* Beispiel: Login Card */
.md3-login-card {
  background: var(--md-sys-color-surface);
}
```

**Werte (games.hispanistica):**
- Light Mode: `#EEF2F4` (heller als Background)
- Dark Mode: `#041317` (gleich wie Background in diesem Fall)

---

### Container-Komponenten: Surface Containers

**Regel:** Container auf Background verwenden Surface-Container-Token

```css
/* Für erhöhte Bereiche auf Background */
.component {
  background: var(--md-sys-color-surface-container);
}

/* Für sehr subtile Erhöhung */
.component-low {
  background: var(--md-sys-color-surface-container-low);
}

/* Für starke Erhöhung */
.component-high {
  background: var(--md-sys-color-surface-container-high);
}
```

**Surface Container Hierarchie (Light Mode):**
```
surface-container-lowest: #FFFFFF
surface-container-low:    #F7FAFB
surface-container-mid:    #F0F5F6
surface-container:        #F0F5F6  (Standard)
surface-container-high:   #E8EFF1
surface-container-highest:#E1EAEC
```

---

### Spezial-Komponenten: Navigation Drawer

**Regel:** Navigation Drawer hat eigenen Surface-Background

```css
/* static/css/md3/components/navigation-drawer.css */
.md3-navigation-drawer {
  background: var(--md-sys-color-surface-container-low);
}
```

**Begründung:** Der Drawer ist eine separate Ebene und nutzt einen subtil anderen Ton für visuelle Trennung vom Main Content.

---

## Best Practices & Richtlinien

### ✅ DO: Verwende kanonische Token

```css
/* RICHTIG */
.my-component {
  background: var(--md-sys-color-background);
}

.my-card {
  background: var(--md-sys-color-surface);
}
```

### ❌ DON'T: Verwende hardcodierte Hex-Werte

```css
/* FALSCH */
.my-component {
  background: #F3F6F7; /* Hardcoded! */
}
```

### ✅ DO: Verwende semantische Token-Namen

```css
/* RICHTIG - Semantisch klar */
background: var(--md-sys-color-surface);

/* AKZEPTABEL - App-Level */
background: var(--app-background);
```

### ❌ DON'T: Verwende `transparent` für Hauptbereiche

```css
/* FALSCH - Führt zu Farbproblemen */
main {
  background: transparent; /* Zeigt Body-Background durch */
}
```

---

## Template-Implementierung

### Standard Page Template

```html
<div class="md3-page">
  <header class="md3-page__header">
    <!-- Hero-Bereich: Nutzt Surface -->
  </header>
  
  <main class="md3-page__main">
    <section class="md3-page__section">
      <!-- Content-Bereich: Erbt Background von .site-main -->
      
      <article class="md3-card">
        <!-- Card: Nutzt Surface -->
      </article>
    </section>
  </main>
</div>
```

### Text Page Template

```html
<article class="md3-text-page">
  <!-- Expliziter Background: var(--app-background) -->
  
  <div class="md3-text-content">
    <!-- Content-Wrapper: Kein Background -->
    
    <section class="md3-text-section">
      <!-- Section: Kein Background -->
    </section>
  </div>
</article>
```

---

## Farb-Token Mapping

### Light Mode

| Token | Wert | Verwendung |
|-------|------|------------|
| `--md-sys-color-background` | `#F3F6F7` | Body, Main Content |
| `--md-sys-color-surface` | `#EEF2F4` | Cards, Dialogs, Sheets |
| `--md-sys-color-surface-container` | `#F0F5F6` | Container auf Background |
| `--md-sys-color-surface-container-low` | `#F7FAFB` | Drawer, subtile Container |

### Dark Mode

| Token | Wert | Verwendung |
|-------|------|------------|
| `--md-sys-color-background` | `#041317` | Body, Main Content |
| `--md-sys-color-surface` | `#041317` | Cards, Dialogs, Sheets |
| `--md-sys-color-surface-container` | `#081F26` | Container auf Background |
| `--md-sys-color-surface-container-low` | `#061A1F` | Drawer, subtile Container |

---

## Überprüfung & Wartung

### Validierung

Um sicherzustellen, dass keine hardcodierten Background-Farben verwendet werden:

```powershell
# Suche nach hardcodierten Hex-Farben in CSS
Get-ChildItem -Path static/css -Recurse -Filter *.css | 
  Select-String -Pattern "background:\s*#[0-9A-Fa-f]{6}"

# Suche nach hardcodierten Farben in Templates
Get-ChildItem -Path templates -Recurse -Filter *.html | 
  Select-String -Pattern "background.*#[0-9A-Fa-f]{6}"
```

### Migration bestehender Components

Wenn eine Komponente noch `transparent` oder hardcodierte Werte verwendet:

1. Identifiziere den Komponenten-Typ (Background/Surface/Container)
2. Wähle das passende kanonische Token
3. Ersetze den Wert durch das Token
4. Teste in Light & Dark Mode

---

## Changelog

**2025-12-20**: Initial standardization + Light Mode Default
- Definiert kanonische Token-Hierarchie
- `main.site-main` Background von `transparent` auf `var(--md-sys-color-background)` geändert
- `--app-background` in `app-tokens.css` von `surface-container` auf `background` geändert
- Dark Mode `--app-background` Override in `branding.css` hinzugefügt
- **KRITISCH**: Dual-Selector für Dark Mode implementiert:
  - `@media (prefers-color-scheme: dark)` für System-Preference
  - `:root[data-theme="dark"]` und `:root[data-theme="auto"][data-system-dark="true"]` für JS-Theme-System
  - Beide Selektoren sind notwendig für vollständige Theme-Unterstützung
- **App-Default**: `data-theme="light"` - App startet IMMER im Light Mode, unabhängig vom System-Theme
- Dokumentation erstellt

---

## Kritische Implementation-Details

### Warum zwei Dark-Mode-Selektoren?

Die App verwendet ein **JS-gesteuertes Theme-System** mit drei Modi:
- `data-theme="light"` - Erzwungener Light Mode
- `data-theme="dark"` - Erzwungener Dark Mode
- `data-theme="auto"` - Folgt System-Preference (Default)

**Problem:** Wenn nur `@media (prefers-color-scheme: dark)` verwendet wird, greift der Override nicht, wenn das Theme via JavaScript auf `data-theme="auto"` gesetzt ist.

**Lösung:** Beide Selektoren müssen definiert werden:

```css
/* Für Browser-basiertes System-Preference-Matching */
@media (prefers-color-scheme: dark) {
  :root {
    --brand-background: #041317;
    /* ... weitere Tokens ... */
  }
}

/* Für JS-gesteuertes Theme-System */
:root[data-theme="dark"],
:root[data-theme="auto"][data-system-dark="true"] {
  --brand-background: #041317;
  /* ... gleiche Tokens ... */
}
```

Beide Blöcke enthalten **identische Token-Definitionen** und müssen synchron gehalten werden.

---

## Referenzen

- **MD3 Farbsystem**: [Material Design 3 Color System](https://m3.material.io/styles/color/system/overview)
- **Token-Definition**: `static/css/md3/tokens.css`
- **Brand-Override**: `static/css/branding.css`
- **App-Tokens**: `static/css/app-tokens.css`
- **Farb-Spec**: `docs_migration/md3-color-tokens_games-hispanistica.md`
