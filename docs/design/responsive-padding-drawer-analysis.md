---
title: "Responsive Padding und Drawer Integration - Analyse"
status: active
owner: frontend-team
updated: "2025-11-08"
tags: [css, responsive, padding, drawer, breakpoints, material-design-3]
links:
  - design-system-overview.md
  - material-design-3.md
---

# Responsive Padding & Drawer-Integration

**Datum:** 1. November 2025  
**Status:** ✅ IMPLEMENTED

---

## Executive Summary

**Probleme identifiziert & behoben:**
1. ✅ **Hero-Container Doppeltes Padding** – Systematisch auf eine Ebene reduziert
2. ✅ **Atlas-Seite Inkonsistenz** – Padding-Strategie angeglichen an text-pages/corpus
3. ✅ **Breakpoint-Inkonsistenz** – Vereinheitlicht auf 599px (MD3 Spec), 1120px (drawer-aware)
4. ⚠️ **Top-App-Bar Avatar-Problem** – KEIN CSS-Fehler gefunden (mögliches JS-Problem)

**Systematische Lösung implementiert:**
- **Einheitliche Padding-Ebene:** Content-Container haben Padding, äußere Wrapper nicht
- **Konsistente Breakpoints:** 599px (mobile), 1120px (drawer-aware), 840px (drawer-switch)
- **Dokumentierte Strategie:** Kommentare in CSS erklären Padding-Hierarchie

---

## Container-Struktur

### Base Layout (`templates/base.html`)

```html
<body class="app-shell">
  <header id="top-app-bar" data-turbo-permanent>
    {% include 'partials/_top_app_bar.html' %}
  </header>
  
  <aside id="navigation-drawer" data-turbo-permanent>
    {% include 'partials/_navigation_drawer.html' %}
  </aside>
  
  <main id="main-content" class="site-main">
    {% block content %}{% endblock %}
  </main>
  
  <footer id="site-footer" data-turbo-permanent>
    {% include 'partials/footer.html' %}
  </footer>
</body>
```

**Grid Layout:**
- **< 840px (Mobile/Tablet):** Grid: `appbar | main | footer` (1 Spalte)
- **≥ 840px (Desktop):** Grid: `drawer appbar | drawer main | drawer footer` (280px + 1fr)

---

## Padding-Strategie

### Regel 1: Padding auf Content-Container

```css
/* ✅ RICHTIG: Padding auf dem inneren Container */
.md3-hero__container {
  max-width: 900px;
  padding: var(--md3-space-4) var(--md3-space-6);  /* 16px / 24px */
  margin: 0 auto;
}

/* ❌ FALSCH: Doppeltes Padding */
.md3-hero {
  padding: var(--md3-space-4);
}
.md3-hero__container {
  padding: var(--md3-space-4);  /* Doppelt! */
}
```

### Regel 2: Responsive Padding-Werte

```css
/* Mobile: 16px seitlich */
@media (max-width: 599px) {
  .md3-hero__container {
    padding-left: var(--md3-space-4);   /* 16px */
    padding-right: var(--md3-space-4);  /* 16px */
  }
}

/* Tablet+: 24px seitlich */
@media (min-width: 600px) {
  .md3-hero__container {
    padding-left: var(--md3-space-6);   /* 24px */
    padding-right: var(--md3-space-6);  /* 24px */
  }
}

/* Desktop mit Drawer: Drawer nimmt Platz weg */
@media (min-width: 840px) {
  main {
    margin-left: 280px;  /* Drawer-Breite */
  }
}
```

---

## Breakpoints (einheitlich)

| Breakpoint | Anwendung | Grid-Layout |
|-----------|-----------|------------|
| **< 599px** | Mobile | Full-width, einzelne Spalte |
| **600-839px** | Tablet | Full-width, 2 Spalten möglich |
| **≥ 840px** | Desktop | Drawer permanent, content rechts |
| **≥ 1120px** | Large Desktop | Drawer + Hero mit max-width |

---

## Drawer Elevation (Desktop)

**Selector:** `.md3-navigation-drawer.md3-navigation-drawer--standard`  
**CSS File:** `static/css/md3/components/navigation-drawer.css`

Der Desktop-Drawer hat einen permanenten, nach rechts orientierten Schatten (Level 1):

```css
box-shadow:
  1px 0 3px rgba(0, 0, 0, 0.08),
  4px 0 8px rgba(0, 0, 0, 0.06);
```

**Layout-Voraussetzung:** `body.app-shell` verwendet `overflow: clip` (nicht `overflow: hidden`), damit der Schatten außerhalb der Drawer-Grid-Zelle sichtbar ist.

---

## Siehe auch

- [Design System Übersicht](design-system-overview.md) - Container und Layout-Patterns
- [Material Design 3](material-design-3.md) - Offizielle MD3 Spezifikation
