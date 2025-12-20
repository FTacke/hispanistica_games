# Responsive Map Design: Atlas-Implementierung

## Übersicht

Die Atlas-Seite von CO.RA.PAN implementiert eine hochgradig responsive Leaflet-Karte mit interaktiven Tooltips, die sowohl auf Desktop- als auch auf mobilen Geräten einwandfrei funktioniert. Die Kernfunktionalität basiert auf einer sorgfältig abgestimmten Kombination aus:

1. **Leaflet.js** (v1.9.4) - JavaScript-Bibliothek für interaktive Karten
2. **Custom JavaScript** - Responsive Popup-Steuerung und Auto-Panning
3. **Material Design 3 CSS** - Styling und Layout-Definitionen
4. **Mobile-spezifische CSS-Overrides** - Z-Index-Management und Viewport-Anpassungen

## Dateienstruktur

### Beteiligte Dateien

```
templates/pages/atlas.html              # HTML-Template (Basis-Markup)
static/js/pages/atlas.js                # Lazy-Loading Initializer
static/js/modules/atlas/index.js        # Haupt-Modul (Map-Logik)
static/css/md3/components/atlas.css     # Basis-Styling (Desktop-first)
static/css/md3/components/mobile-responsive.css  # Mobile-Overrides
```

---

## 1. HTML-Struktur

### Template-Markup

```html
<!-- templates/pages/atlas.html -->
<div class="md3-page">
  <header class="md3-page__header">
    <div class="md3-hero md3-hero--card md3-hero__container">
      <div class="md3-hero__icon" aria-hidden="true">
        <span class="material-symbols-rounded">public</span>
      </div>
      <div class="md3-hero__content">
        <p class="md3-body-small md3-hero__eyebrow">Atlas</p>
        <h1 class="md3-headline-medium md3-hero__title">Atlas panhispánico</h1>
        <p class="md3-body-medium md3-hero__intro">
          Panorama geográfico del corpus: países, regiones y emisoras.
        </p>
      </div>
    </div>
  </header>

  <main class="md3-atlas-content">
    <section class="md3-atlas-layout">
      <div class="md3-atlas-map-container">
        <div id="atlas-map" class="md3-atlas-map" 
             role="region" 
             aria-label="Mapa panhispánico de emisoras"></div>
      </div>
    </section>
  </main>
</div>
```

**Wichtige Klassen:**
- `.md3-atlas-content` - Wrapper mit responsive Padding
- `.md3-atlas-map-container` - Container mit fester Höhe (500px/600px/700px)
- `.md3-atlas-map` - Leaflet-Map-Target (`#atlas-map`)

---

## 2. CSS-Architektur

### 2.1 Basis-Layout (Desktop-First)

```css
/* static/css/md3/components/atlas.css */

/* Content Wrapper mit responsive Edge-Padding */
.md3-atlas-content {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  padding: 0 var(--space-4) var(--space-12);  /* Mobile: 16px */
}

/* Tablet+: 24px Edge-Padding */
@media (min-width: 600px) {
  .md3-atlas-content {
    padding: 0 var(--space-6) var(--space-12);
  }
}

/* Desktop: 32px Edge-Padding */
@media (min-width: 1200px) {
  .md3-atlas-content {
    padding: 0 var(--space-8) var(--space-12);
  }
}
```

### 2.2 Map-Container (Responsive Heights)

```css
/* Mobile First: Größere Höhe für Map-only View */
.md3-atlas-map-container {
  width: 100%;
  height: 500px;  /* Mobile */
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--md-sys-color-surface-container);
  box-sizing: border-box;
}

/* Tablet+ */
@media (min-width: 600px) {
  .md3-atlas-map-container {
    height: 600px;
  }
}

/* Desktop */
@media (min-width: 900px) {
  .md3-atlas-map-container {
    height: 700px;
  }
}
```

**Kritisch:** `overflow: hidden` wird in `mobile-responsive.css` zu `overflow: visible` überschrieben, damit Popups über den Container-Rand hinausragen können!

### 2.3 Z-Index-Hierarchie (Leaflet Panes)

```css
/* Leaflet Controls - unter Top App Bar (z-index: 1000) */
.md3-atlas-map .leaflet-top,
.md3-atlas-map .leaflet-bottom,
.md3-atlas-map .leaflet-control,
.md3-atlas-map .leaflet-control-container {
  z-index: 400 !important;
}

/* Popup Pane - erhöht für Mobile */
.md3-atlas-map .leaflet-popup-pane {
  z-index: 800 !important;
}

/* Popups selbst - noch höher für Mobile-Sicherheit */
.md3-atlas-map .leaflet-popup {
  z-index: 850 !important;
}

/* Marker Pane */
.md3-atlas-map .leaflet-marker-pane {
  z-index: 600 !important;
}

/* Tile Pane - niedrig halten */
.md3-atlas-map .leaflet-tile-pane {
  z-index: 200 !important;
}
```

**Hierarchie:**
1. Tiles (200) - Hintergrund
2. Controls (400) - Zoom-Buttons
3. Markers (600) - Marker-Icons
4. Popup Pane (800) - Container für Popups
5. Popups (850) - Tooltip-Overlays

### 2.4 Popup/Tooltip-Styling

```css
/* Custom Popup Styling */
.atlas-popup .leaflet-popup-content-wrapper {
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--elev-3);
  padding: 0;
}

.atlas-popup .leaflet-popup-content {
  margin: 0;
  padding: 0;
}

.atlas-popup .leaflet-popup-tip {
  background: var(--md-sys-color-surface);
}

/* Close Button */
.atlas-popup .leaflet-popup-close-button {
  color: var(--md-sys-color-on-surface-variant);
  font-size: 20px;
  padding: 8px;
  top: 4px;
  right: 4px;
}

.atlas-popup .leaflet-popup-close-button:hover {
  color: var(--md-sys-color-on-surface);
}
```

### 2.5 Tooltip-Content-Struktur

```css
/* Tooltip Inner Content */
.atlas-tooltip {
  padding: var(--space-4);
  min-width: 200px;
  max-width: 320px;
}

.atlas-tooltip-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--md-sys-color-primary);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--md-sys-color-outline-variant);
}

.atlas-tooltip-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-2);
}

.atlas-tooltip-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--md-sys-color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.atlas-tooltip-value {
  font-size: 0.875rem;
  color: var(--md-sys-color-on-surface);
  line-height: 1.4;
}
```

### 2.6 Mobile-Overrides (Kritisch!)

```css
/* static/css/md3/components/mobile-responsive.css */

/* Map Container - overflow visible für Popups! */
.md3-atlas-map-container {
  position: relative;
  z-index: auto;  /* Verhindert eigenen Stacking Context */
  overflow: visible;  /* KRITISCH: Popups dürfen über Rand hinausragen */
}

/* Mobile: Popup-Breite begrenzen */
@media (max-width: 599px) {
  .md3-atlas-map .leaflet-popup-content-wrapper {
    max-width: calc(100vw - 48px);
  }
  
  .md3-atlas-map .leaflet-popup {
    max-width: 90vw;  /* Popups sollen vollständig sichtbar sein */
  }
  
  .atlas-tooltip {
    min-width: 160px;
    max-width: calc(100vw - 60px);
  }
}
```

**Warum `overflow: visible`?**
- Leaflet positioniert Popups absolut außerhalb des Map-Containers
- Mit `overflow: hidden` würden Popups abgeschnitten
- `z-index: auto` verhindert einen neuen Stacking Context, der Popups verdecken würde

### 2.7 Mobile-spezifische Tooltip-Anpassungen

```css
/* Mobile: Popup besser positionieren (in atlas.css) */
@media (max-width: 599px) {
  .atlas-popup .leaflet-popup-content-wrapper {
    max-width: calc(100vw - 48px);
  }
  
  .atlas-tooltip {
    min-width: 180px;
    max-width: 280px;
  }
  
  /* Links untereinander statt nebeneinander */
  .atlas-tooltip-links {
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .atlas-tooltip-link {
    justify-content: center;
    width: 100%;
  }
}
```

---

## 3. JavaScript-Implementierung

### 3.1 Lazy-Loading (atlas.js)

```javascript
// static/js/pages/atlas.js
export async function init() {
  const mapEl = document.getElementById("atlas-map");
  if (!mapEl) {
    console.warn("[atlas] Map container not found (#atlas-map)");
    return;
  }

  try {
    // 1) Load Leaflet CSS + JS
    ensureStyles("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    ensureStyles("/static/css/md3/components/atlas.css");
    await ensureScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");

    // 2) Dynamically import Atlas module
    const atlasModule = await import("/static/js/modules/atlas/index.js");

    // 3) Initialize Atlas
    if (atlasModule?.init) {
      const mapInstance = atlasModule.init();
      console.log("[atlas] Initialized successfully");
    }
  } catch (error) {
    console.error("[atlas] Initialization failed:", error);
  }
}
```

### 3.2 Responsive Map-Initialisierung

```javascript
// static/js/modules/atlas/index.js

/* Get map container width for responsive calculations */
function getMapWidth() {
  return MAP_CONTAINER ? MAP_CONTAINER.offsetWidth : window.innerWidth;
}

/* Calculate initial zoom based on viewport */
function getInitialZoom() {
  const width = getMapWidth();
  if (width <= 480) return 2.6;  // Mobile
  if (width <= 900) return 2.8;  // Tablet
  return 3;                       // Desktop
}

/* Calculate initial map center based on viewport */
function getInitialCenter() {
  const width = getMapWidth();
  if (width <= 480) return [-6, -60];   // Mobile
  if (width <= 900) return [-2, -55];   // Tablet
  return [1, -50];                      // Desktop
}
```

**Warum verschiedene Zoom/Center-Werte?**
- Mobile Screens zeigen weniger Fläche → niedrigerer Zoom + anderer Center-Point
- Desktop-Screens können mehr Kontext zeigen → höherer Zoom

### 3.3 Popup-Binding mit Auto-Pan (Kernstück!)

```javascript
// static/js/modules/atlas/index.js

function addCityMarkers() {
  if (!window.L || !MAP_CONTAINER) return;

  CITY_LIST.forEach((city) => {
    const config = MARKER_ICONS[city.tier] || MARKER_ICONS.primary;
    const icon = window.L.icon({
      iconUrl: `${config.path}${config.file}`,
      iconSize: config.iconSize,
      iconAnchor: config.iconAnchor,
      popupAnchor: [0, -config.iconAnchor[1]],
    });

    const marker = window.L.marker([city.lat, city.lng], { icon })
      .addTo(mapInstance);

    // Build Tooltip-Content
    const tooltipContent = buildTooltipContent(city);
    
    // ============================================
    // RESPONSIVE AUTO-PAN PADDING (KRITISCH!)
    // ============================================
    const isMobile = window.innerWidth < 600;
    const autoPanPaddingTop = isMobile ? [20, 80] : [50, 100]; 
    const autoPanPaddingBottom = isMobile ? [20, 20] : [50, 50];
    
    marker.bindPopup(tooltipContent, {
      className: "atlas-popup",
      maxWidth: isMobile ? 280 : 320,
      minWidth: isMobile ? 180 : 200,
      autoPan: true,  // KRITISCH: Aktiviert automatisches Panning
      autoPanPaddingTopLeft: autoPanPaddingTop,      // [left, top]
      autoPanPaddingBottomRight: autoPanPaddingBottom, // [right, bottom]
      keepInView: true,  // Popup bleibt im sichtbaren Bereich
    });

    // Click handler
    marker.on("click", function (e) {
      const currentZoom = mapInstance.getZoom();
      const targetZoom = Math.min(Math.max(currentZoom, 4), 6);

      // Smooth centering
      mapInstance.panTo(e.latlng, {
        animate: true,
        duration: 0.3,
      });
    });

    cityMarkers.set(city.code, marker);
  });
}
```

---

## 4. Auto-Pan-Mechanismus (Mobile-Zentrierung)

### 4.1 Leaflet's `autoPan`-Optionen

Leaflet bietet eingebaute Auto-Pan-Funktionalität:

```javascript
marker.bindPopup(content, {
  autoPan: true,                      // Aktiviert Auto-Panning
  autoPanPaddingTopLeft: [left, top], // Padding von oben-links
  autoPanPaddingBottomRight: [right, bottom], // Padding von unten-rechts
  keepInView: true,                   // Popup im Viewport halten
});
```

### 4.2 Responsive Padding-Werte

```javascript
const isMobile = window.innerWidth < 600;

// Mobile: Mehr Top-Padding wegen Top App Bar (64px + extra Raum)
const autoPanPaddingTop = isMobile ? [20, 80] : [50, 100]; 

// Mobile: Weniger Bottom-Padding
const autoPanPaddingBottom = isMobile ? [20, 20] : [50, 50];
```

**Warum unterschiedliche Werte?**

| Device  | TopLeft Padding | Grund                                          |
|---------|-----------------|------------------------------------------------|
| Mobile  | `[20, 80]`      | Top App Bar (64px) + Extra-Raum (16px) = 80px |
| Desktop | `[50, 100]`     | Mehr Raum für bessere Zentrierung              |

| Device  | BottomRight Padding | Grund                               |
|---------|---------------------|-------------------------------------|
| Mobile  | `[20, 20]`          | Weniger Platz verfügbar             |
| Desktop | `[50, 50]`          | Mehr Raum für symmetrische Ansicht  |

### 4.3 Wie funktioniert die Zentrierung?

**Ablauf beim Marker-Klick:**

1. **User klickt auf Marker**
2. **Leaflet öffnet Popup** (via `bindPopup`)
3. **Leaflet prüft:** Passt Popup in aktuellen Viewport?
4. **Falls NEIN:** 
   - Berechne benötigten Platz (Popup-Größe + Padding)
   - **Pan die Karte**, sodass Popup zentriert ist
   - Respektiere `autoPanPadding`-Werte
5. **Falls JA:** Popup sofort anzeigen (kein Panning)

**Code-Visualisierung:**

```
┌──────────────────────────────────────┐
│ Top App Bar (64px)                   │ ← autoPanPaddingTopLeft[1] = 80px
├──────────────────────────────────────┤
│                                      │
│          ┌──────────────┐            │
│          │   POPUP      │            │ ← Leaflet zentriert hier
│          │              │            │
│          └──────────────┘            │
│                                      │
│                                      │ ← autoPanPaddingBottomRight[1] = 20px
└──────────────────────────────────────┘
```

---

## 5. Tooltip-Content-Generierung

### 5.1 buildTooltipContent()

```javascript
function buildTooltipContent(city) {
  const code = city.code;
  const emisoras = getEmisorasForCode(code);
  const stats = getStatsForCode(code);

  // Emisoras-Liste
  const emisorasHtml = emisoras.length > 0
    ? emisoras.join(", ")
    : '<span class="atlas-tooltip-empty">Sin datos</span>';

  // Stats
  const durationHtml = stats
    ? formatDuration(stats.total_duration || 0)
    : '<span class="atlas-tooltip-empty">—</span>';
    
  const wordsHtml = stats
    ? formatNumber(stats.total_word_count || 0)
    : '<span class="atlas-tooltip-empty">—</span>';

  // Auth-Check für Player-Link
  const isAuthenticated = window.IS_AUTHENTICATED === "true" || 
                          window.IS_AUTHENTICATED === true;

  let linksHtml = `
    <a href="/corpus/metadata?view=paises&country=${code}" 
       class="atlas-tooltip-link">
      <span class="material-symbols-rounded" aria-hidden="true">dataset</span>
      Metadatos
    </a>
  `;

  if (isAuthenticated) {
    linksHtml += `
      <a href="/corpus/player?country=${code}" 
         class="atlas-tooltip-link">
        <span class="material-symbols-rounded" aria-hidden="true">play_circle</span>
        Player
      </a>
    `;
  }

  return `
    <div class="atlas-tooltip">
      <div class="atlas-tooltip-title">${city.label}</div>
      <div class="atlas-tooltip-row">
        <span class="atlas-tooltip-label">Emisoras:</span>
        <span class="atlas-tooltip-value">${emisorasHtml}</span>
      </div>
      <div class="atlas-tooltip-row">
        <span class="atlas-tooltip-label">Duración total:</span>
        <span class="atlas-tooltip-value">${durationHtml}</span>
      </div>
      <div class="atlas-tooltip-row">
        <span class="atlas-tooltip-label">Palabras transcritas:</span>
        <span class="atlas-tooltip-value">${wordsHtml}</span>
      </div>
      <div class="atlas-tooltip-links">
        ${linksHtml}
      </div>
    </div>
  `;
}
```

---

## 6. Resize-Handling

```javascript
// Handle window resize
window.addEventListener("resize", () => {
  setTimeout(() => {
    mapInstance.invalidateSize();  // Leaflet neu berechnen
    
    // Re-center nur wenn KEIN Popup offen
    if (!document.querySelector(".leaflet-popup")) {
      mapInstance.flyTo(getInitialCenter(), getInitialZoom());
    }
  }, 200);
});
```

**Warum `invalidateSize()`?**
- Leaflet cached interne Dimensionen
- Bei Resize muss Leaflet neu berechnen (Tiles, Marker-Positionen)

**Warum Re-Center prüfen?**
- Wenn Popup offen ist, soll die Karte NICHT zurückspringen
- User könnte gerade Popup lesen

---

## 7. Zusammenfassung: Warum funktioniert das so gut auf Mobile?

### 7.1 CSS-Ebene

✅ **`overflow: visible` auf Container**
- Popups können über Map-Container-Rand hinausragen
- Verhindert Abschneiden auf kleinen Screens

✅ **Z-Index-Hierarchie optimiert**
- Popups (850) > Controls (400) > Markers (600)
- Kein Stacking Context durch `z-index: auto` auf Container

✅ **Responsive Popup-Breiten**
```css
@media (max-width: 599px) {
  .atlas-tooltip {
    min-width: 160px;
    max-width: calc(100vw - 60px);  /* Viewport-basiert */
  }
}
```

✅ **Flexible Links auf Mobile**
```css
.atlas-tooltip-links {
  flex-direction: column;  /* Untereinander statt nebeneinander */
  gap: var(--space-2);
}
```

### 7.2 JavaScript-Ebene

✅ **Responsive Auto-Pan-Padding**
```javascript
const autoPanPaddingTop = isMobile ? [20, 80] : [50, 100];
```
- Mobile: 80px Top-Padding (Top App Bar + Extra-Raum)
- Desktop: 100px Top-Padding (mehr Platz verfügbar)

✅ **`keepInView: true`**
- Leaflet garantiert, dass Popup im Viewport bleibt
- Kombiniert mit Auto-Pan für perfekte Zentrierung

✅ **Responsive Popup-Größen**
```javascript
maxWidth: isMobile ? 280 : 320,
minWidth: isMobile ? 180 : 200,
```

✅ **Smooth Panning statt Zoom**
```javascript
mapInstance.panTo(e.latlng, {
  animate: true,
  duration: 0.3,
});
```
- Kein aggressives Zooming → bessere UX auf Mobile

### 7.3 Leaflet-Konfiguration

✅ **`autoPan: true`**
- Aktiviert automatisches Panning beim Popup-Öffnen
- Berücksichtigt `autoPanPadding`-Werte

✅ **`autoPanPaddingTopLeft` / `autoPanPaddingBottomRight`**
- Definiert "sichere Zone" für Popup-Zentrierung
- Mobile: Mehr Top-Padding wegen App Bar

---

## 8. Best Practices & Learnings

### 8.1 Kritische Erfolgsfaktoren

1. **`overflow: visible` auf Map-Container**
   - Ohne dies werden Popups abgeschnitten
   - Muss in `mobile-responsive.css` überschrieben werden

2. **Responsive Auto-Pan-Padding**
   - Mobile braucht mehr Top-Padding (Top App Bar)
   - Desktop kann symmetrischer sein

3. **`keepInView: true`**
   - Leaflet garantiert Sichtbarkeit
   - Kombiniert mit Auto-Pan

4. **Z-Index-Hierarchie**
   - Popups > Markers > Controls > Tiles
   - Kein eigener Stacking Context auf Container

5. **Viewport-basierte Breiten**
   - `calc(100vw - 60px)` statt feste Pixel
   - Passt sich an jede Bildschirmgröße an

### 8.2 Häufige Fallstricke

❌ **`overflow: hidden` auf Container**
- Schneidet Popups ab
- Leaflet positioniert absolut außerhalb

❌ **Zu kleine `autoPanPadding`-Werte**
- Popups kollidieren mit Top App Bar
- Mobile braucht mindestens 64px + 16px = 80px

❌ **Feste Pixel-Breiten auf Popups**
- Funktioniert nicht auf allen Geräten
- Besser: `calc(100vw - Xpx)`

❌ **Zu hoher Z-Index auf Container**
- Erstellt eigenen Stacking Context
- Popups erscheinen hinter anderen Elementen

### 8.3 Performance-Optimierungen

✅ **Lazy-Loading von Leaflet**
```javascript
await ensureScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
```
- Nur laden wenn Atlas-Seite geöffnet wird

✅ **`invalidateSize()` mit Timeout**
```javascript
setTimeout(() => mapInstance.invalidateSize(), 200);
```
- Warte bis Layout stabil ist

✅ **Data-Loading parallel**
```javascript
const [countriesRes, filesRes] = await Promise.all([
  loadCountryStats(),
  loadFileMetadata(),
]);
```

---

## 9. Code-Snippets für eigene Implementierung

### 9.1 Minimale Leaflet-Popup-Konfiguration (Responsive)

```javascript
const isMobile = window.innerWidth < 600;

marker.bindPopup(content, {
  className: "custom-popup",
  maxWidth: isMobile ? 280 : 320,
  minWidth: isMobile ? 180 : 200,
  autoPan: true,
  autoPanPaddingTopLeft: isMobile ? [20, 80] : [50, 100],
  autoPanPaddingBottomRight: isMobile ? [20, 20] : [50, 50],
  keepInView: true,
});
```

### 9.2 CSS-Template für responsive Popups

```css
/* Map Container - overflow visible! */
.map-container {
  position: relative;
  z-index: auto;
  overflow: visible;  /* KRITISCH */
}

/* Z-Index-Hierarchie */
.map .leaflet-tile-pane { z-index: 200 !important; }
.map .leaflet-control-container { z-index: 400 !important; }
.map .leaflet-marker-pane { z-index: 600 !important; }
.map .leaflet-popup-pane { z-index: 800 !important; }
.map .leaflet-popup { z-index: 850 !important; }

/* Popup Styling */
.custom-popup .leaflet-popup-content-wrapper {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  padding: 0;
}

/* Mobile Overrides */
@media (max-width: 599px) {
  .custom-popup .leaflet-popup-content-wrapper {
    max-width: calc(100vw - 48px);
  }
  
  .custom-popup .leaflet-popup {
    max-width: 90vw;
  }
}
```

### 9.3 Resize-Handler

```javascript
window.addEventListener("resize", () => {
  setTimeout(() => {
    mapInstance.invalidateSize();
    
    // Re-center nur wenn kein Popup offen
    if (!document.querySelector(".leaflet-popup")) {
      mapInstance.setView(initialCenter, initialZoom);
    }
  }, 200);
});
```

---

## 10. Debugging-Tipps

### 10.1 Popup erscheint nicht

**Prüfe:**
1. `overflow: visible` auf Container
2. Z-Index-Hierarchie (Popup > Controls)
3. Kein eigener Stacking Context (`z-index: auto`)

### 10.2 Popup wird abgeschnitten

**Prüfe:**
1. `overflow: visible` auf Container
2. `max-width` auf Mobile (nicht zu breit)
3. `autoPan: true` aktiviert

### 10.3 Popup nicht zentriert auf Mobile

**Prüfe:**
1. `autoPanPadding`-Werte (Top: 80px für Mobile)
2. `keepInView: true` gesetzt
3. Viewport-Meta-Tag korrekt

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

### 10.4 Dev-Tools-Inspektion

**Z-Index prüfen:**
```javascript
// In Browser-Console
const popup = document.querySelector('.leaflet-popup');
console.log(window.getComputedStyle(popup).zIndex);
```

**Padding-Werte prüfen:**
```javascript
// In map-click handler
console.log({
  isMobile: window.innerWidth < 600,
  autoPanPaddingTop,
  autoPanPaddingBottom
});
```

---

## 11. Referenzen

- **Leaflet Docs:** https://leafletjs.com/reference.html
- **Popup Options:** https://leafletjs.com/reference.html#popup-option
- **autoPan Behavior:** https://leafletjs.com/reference.html#popup-autopan

---

## Schlusswort

Die Atlas-Implementierung zeigt, wie durch die richtige Kombination von:
- **CSS** (Z-Index, Overflow, responsive Breiten)
- **JavaScript** (Auto-Pan-Padding, Resize-Handling)
- **Leaflet-Konfiguration** (`keepInView`, `autoPan`)

eine perfekte Mobile-Experience erreicht werden kann. Der Schlüssel liegt in den **responsiven Auto-Pan-Padding-Werten** und dem **`overflow: visible`** auf dem Map-Container.
