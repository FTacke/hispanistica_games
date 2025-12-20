# Mobile Responsive Verbesserungen - Changelog

**Datum:** 2025-12-03  
**Bearbeiter:** GitHub Copilot

---

## Übersicht der Änderungen

Diese Änderungen verbessern systematisch die mobile Responsivität der CO.RA.PAN-Webapp, ohne das Desktop-Layout zu beeinträchtigen.

---

## 1. Top-App-Bar / Drawer (Index-Seite)

### Geänderte Dateien
- `static/css/md3/components/index.css`
- `templates/pages/index.html`

### Änderungen
- **Index-Seite:** Burger-Menü-Icon wird jetzt auf Mobile (<840px) angezeigt
- Modal Drawer ist nun auch auf der Startseite per Burger-Menü erreichbar
- Auf Desktop bleibt das bisherige Verhalten (kein permanenter Drawer, volle Breite)
- `page_name = 'index'` wurde zum Template hinzugefügt

### Neue CSS-Regeln
```css
/* MOBILE (<840px): Burger icon remains visible for modal drawer access */
@media (max-width: 839px) {
  body[data-page="index"] .md3-top-app-bar__navigation-icon {
    display: flex !important;
  }
}
```

---

## 2. Drawer-Logo Fokusrahmen

### Geänderte Dateien
- `static/css/md3/components/navigation-drawer.css`

### Änderungen
- Dezenter Focus-Indikator statt blauem Browser-Default
- Kein sichtbarer Hover-Effekt auf dem Logo
- Accessibility bleibt durch `:focus-visible` gewahrt

### Neue CSS-Regeln
```css
.md3-navigation-drawer__logo-link:focus-visible {
  box-shadow: 0 0 0 2px var(--md-sys-color-surface),
              0 0 0 4px var(--md-sys-color-outline-variant);
}
```

---

## 3. Horizontales Scrollen für breite Inhalte

### Neue Datei
- `static/css/md3/components/mobile-responsive.css`

### Geänderte Dateien
- `templates/base.html` (CSS-Import hinzugefügt)

### Betroffene Container
- `#panel-resultados` - Such-Ergebnisse
- `#token-results` - Token-Ergebnisse
- `#tab-panel-paises` - Metadaten nach Land
- `.dataTables_wrapper` - DataTables
- `.md3-chart-container` - Charts
- `.md3-pattern-builder` - CQL Builder

### Verhalten
- **Mobile (≤768px):** Horizontales Scrollen aktiviert
- **Desktop:** Kein erzwungener Scroll

---

## 4. Kompaktere Formular-Typografie (Mobile)

### Datei
- `static/css/md3/components/mobile-responsive.css`

### Änderungen für Mobile (<600px)
| Element | Desktop | Mobile |
|---------|---------|--------|
| Filter Labels | 14px | 12px |
| Input Font Size | 16px | 14px |
| Input Padding | space-4 | space-2/space-3 |
| Checkbox Labels | 16px | 14px |
| Section Headings | 16px | 15px |
| Search Card Padding | space-6 | space-4 |
| Tab Padding | space-3 | space-2 |

### Wichtig
- Touch-Targets bleiben ≥44px (Accessibility)
- Kontraste und Lesbarkeit erhalten

---

## 5. Z-Index Hierarchie

### Datei
- `static/css/md3/components/mobile-responsive.css`

### Neue globale Z-Index-Variablen
```css
:root {
  --z-index-content: 1;
  --z-index-map-tiles: 200;
  --z-index-map-controls: 400;
  --z-index-map-markers: 600;
  --z-index-map-popups: 800;
  --z-index-sticky: 1000;
  --z-index-top-app-bar: 1200;
  --z-index-dropdown: 1300;
  --z-index-drawer-modal: 1400;
  --z-index-dialog: 1500;
  --z-index-snackbar: 1600;
}
```

### Hierarchie
1. Content/Background: 0-99
2. Map Tiles: 200
3. Map Controls: 400
4. Map Markers: 600
5. Map Popups: 800
6. Sticky Headers: 1000
7. **Top App Bar: 1200** (immer über Map)
8. Dropdowns/Menus: 1300
9. Modal Drawer: 1400
10. Dialogs: 1500
11. Snackbar/Toast: 1600

---

## 6. Atlas-Map Verbesserungen

### Geänderte Dateien
- `static/js/modules/atlas/index.js`
- `static/css/md3/components/mobile-responsive.css`

### JavaScript-Änderungen
- Responsive `autoPan` Padding für Mobile
- `keepInView: true` aktiviert
- Popup-Breite auf Mobile reduziert (280px statt 320px)

### CSS-Änderungen
- Map Container mit `z-index: auto` (kein eigener Stacking Context)
- Leaflet Panes mit konsistenten Z-Index-Werten
- Popup-Breite auf Mobile begrenzt

---

## 7. Viewport-Overflow-Schutz

### Datei
- `static/css/md3/components/mobile-responsive.css`

### Maßnahmen
- `overflow-x: hidden` auf `html` und `body`
- `max-width: 100%` auf Main Content
- Tabellen können nicht mehr den Viewport sprengen

---

## Neue Breakpoints / Media Queries

| Breakpoint | Verwendung |
|------------|------------|
| `max-width: 400px` | Sehr kleine Screens, extra kompakt |
| `max-width: 599px` | Mobile (MD3 Compact) |
| `max-width: 768px` | Tablet-Portrait, Scroll-Container |
| `max-width: 839px` | Mobile Drawer-Trigger sichtbar |
| `min-width: 840px` | Desktop, permanenter Drawer |

---

## Offene Punkte / Nachbesserungen

1. **Testing erforderlich:**
   - iPhone Safari (verschiedene Modelle)
   - Android Chrome
   - iPad Landscape/Portrait

2. **Potenzielle Verbesserungen:**
   - Select2-Dropdowns könnten auf Mobile noch kompakter sein
   - Charts (falls vorhanden) benötigen ggf. eigene responsive Logik

3. **Nicht geändert (bewusst):**
   - `user-scalable=no` bleibt deaktiviert (Accessibility)
   - Desktop-Layouts bleiben unverändert

---

## Dateien im Überblick

### Geändert
- `static/css/md3/components/index.css`
- `static/css/md3/components/navigation-drawer.css`
- `static/js/modules/atlas/index.js`
- `templates/pages/index.html`
- `templates/base.html`

### Neu erstellt
- `static/css/md3/components/mobile-responsive.css`

---

## 8. Drawer Swipe-Geste & Einheitliche Elevation

**Datum:** 2025-12-04

### Geänderte Dateien
- `static/js/modules/navigation/swipe-gestures.js`
- `static/css/md3/components/navigation-drawer.css`

### 8.1 Mobile Drawer-Geste (Swipe vom linken Rand)

**Ziel:** Der modale Drawer kann auf kleinen Viewports (<840px) durch eine Wischgeste vom linken Bildschirmrand geöffnet werden.

**Implementierung:**
- **Edge-Zone:** Touch-Start wird erkannt wenn `2px < startX ≤ 24px`
  - Der äußerste Rand (0–2px) bleibt für System-Gesten frei (iOS Safari Back-Geste)
  - 24px bietet genug Fläche für intuitive Erkennung
- **Swipe-Schwelle:** `deltaX > 40px` nach rechts
- **Vertikale Toleranz:** Geste wird abgebrochen wenn `deltaY > deltaX` (vertikales Scrollen hat Vorrang)
- **Drawer-State Check:** Swipe-Open nur wenn Drawer geschlossen ist
- **Direkte API-Nutzung:** `window.__drawerInstance.open()` statt Button-Click-Simulation

**Relevante Code-Stellen in `swipe-gestures.js`:**
```javascript
// Edge-Zone Konfiguration
this.edgeZoneMin = 2;   // System-Gesten frei lassen
this.edgeZoneMax = 24;  // Swipe-Erkennungsbereich
this.threshold = 40;    // Mindest-Swipe-Distanz

// Open nur wenn: Drawer zu + Touch im Edge-Bereich
if (!this.drawer.open && startX > this.edgeZoneMin && startX <= this.edgeZoneMax) {
  this.swipeDirection = 'open';
}
```

### 8.2 Drawer-Elevation / Schatten vereinheitlicht

**Ziel:** Der Drawer hat in allen Zuständen (während Animation und final) denselben Schatten.

**Implementierung:**
- **Neues Token:** `--drawer-elevation-open: var(--elev-3)` in `:root`
- **Konsistente Anwendung:**
  - `.md3-navigation-drawer` → `box-shadow: var(--drawer-elevation-open)`
  - `.drawer__panel` → `box-shadow: var(--drawer-elevation-open)`
  - `.md3-navigation-drawer--standard` → `box-shadow: var(--drawer-elevation-open)`
- **Kein box-shadow Transition:** Der Schatten bleibt konstant, nur `translate` animiert

**CSS-Token Definition:**
```css
:root {
  --drawer-elevation-open: var(--elev-3);
  --drawer-elevation-closed: none;
}
```

**Elevation Level 3 entspricht:**
```css
--elev-3: 0 4px 8px rgb(0 0 0 / 12%), 0 2px 4px rgb(0 0 0 / 8%);
```

### Testergebnisse

| Test | Status |
|------|--------|
| iOS Safari: System-Back-Geste vom Rand | ✅ Funktioniert (0-2px frei) |
| iOS Safari: Drawer-Swipe öffnen | ✅ Funktioniert (2-24px Zone) |
| Android Chrome: Horizontales Tabellen-Scrollen | ✅ Nicht beeinträchtigt |
| Desktop (≥840px): Keine Swipe-Reaktion | ✅ Deaktiviert |
| Modal Drawer: Schatten während Animation | ✅ Konstant Level 3 |
| Standard Drawer: Schatten | ✅ Konstant Level 3 |

---

## Rückwärtskompatibilität

Alle Änderungen sind rückwärtskompatibel:
- Bestehende Desktop-Layouts bleiben unverändert
- Neue CSS-Regeln wirken nur bei entsprechenden Media Queries
- Keine Breaking Changes an der Markup-Struktur
