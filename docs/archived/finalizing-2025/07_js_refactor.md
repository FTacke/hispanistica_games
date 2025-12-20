# JavaScript Refactor Documentation

## Ziel des JS-Refactors
- Inline-JS und Inline-Event-Handler konsequent entfernen.
- JavaScript klar modularisieren (`static/js/modules/...`).
- Glue-Code aus Templates in saubere Module verlagern.
- Funktionalität und Optik der App unverändert lassen.

## Überblick über aktuelle JS-Struktur (Bestandsaufnahme)

### Existierende JS-Dateien
- `static/js/app.js`
- `static/js/auth-setup.js`
- `static/js/drawer-logo.js`
- `static/js/main.js`
- `static/js/morph_formatter.js`
- `static/js/nav_proyecto.js`
- `static/js/player-token-marker.js`
- `static/js/player_script.js`
- `static/js/test-transcript-fetch.js`
- `static/js/theme-toggle.js`
- `static/js/theme.js`
- `static/js/turbo.esm.js`
- `static/js/modules/` (Verzeichnis mit Untermodulen)
  - `admin/`
  - `advanced/`
  - `atlas/`
  - `auth/`
  - `navigation/`
  - `player/`
  - `search/`
  - `stats/`

### Inline-Skripte und Events in Templates

#### `templates/search/advanced.html`
- **Tab Switching Script**: Importiert `initTabs` und registriert EventListener.
- **Stats Tab Initialization**: Importiert `initStatsTabAdvanced` und `cleanupStats`, registriert EventListener.
- **Regional checkbox toggle logic**: Importiert `initRegionalToggle` und registriert EventListener.

#### `templates/base.html`
- **CSRF Token Hook**: Injiziert CSRF-Token in HTMX-Requests.
- **401 Handler**: Öffnet Login-Sheet bei 401-Fehlern.
- **Page Router**: Initialisiert seitenspezifische Module basierend auf `data-page`.
- **Preload Guard**: Entfernt `preload`-Klasse nach dem Laden.
- **Auto-trigger login sheet**: Öffnet Login-Sheet, wenn `?login=1` in URL.
- **Page Title & Scroll Logic**: Setzt Seitentitel und Scroll-Status.

## Geplante Zielstruktur (Module, Entry-Points)

### Module
- `static/js/modules/core/`: Globale Funktionalität (CSRF, Auth, Router, UI).
- `static/js/modules/search/`: Suchlogik (Advanced Search, Token Search).
- `static/js/modules/stats/`: Statistik-Visualisierung.
- `static/js/modules/player/`: Audio-Player und Transkript-Sync.
- `static/js/modules/auth/`: Authentifizierung.

### Entry-Points
- `static/js/modules/search/advanced_entry.js`: Für `advanced.html`.
- `static/js/modules/core/entry.js`: Für `base.html` (global).

## Liste der erledigten Refactors

### Templates
- **`templates/search/advanced.html`**: Inline-Skripte (Tabs, Stats, Regional Toggle) in `static/js/modules/search/advanced_entry.js` ausgelagert.
- **`templates/base.html`**: 
  - CSRF, Auth, Router, UI-Logik in `static/js/modules/core/` ausgelagert.
  - `window.__CORAPAN__` Config in `data-config` Attribut am Body verschoben.
  - Zentraler Entry-Point `static/js/modules/core/entry.js` erstellt.
- **`templates/pages/player.html`**: 
  - Config in `data-*` Attribute verschoben.
  - Inline-Import in `static/js/modules/player/entry.js` ausgelagert.
- **`templates/pages/proyecto_estadisticas.html`**: Zoom-Logik in `static/js/modules/stats/zoom.js` ausgelagert.
- **`templates/pages/editor.html`**: Editor-Init in `static/js/modules/editor/entry.js` ausgelagert.
- **`templates/pages/editor_overview.html`**: Tab-Logik in `static/js/modules/editor/overview.js` ausgelagert.
- **`templates/partials/_navigation_drawer.html`**: Inline-Script entfernt, Logik in `static/js/modules/core/ui.js` (via `entry.js`) integriert.

### Neue Module
- `static/js/modules/core/entry.js`: Globaler Entry-Point.
- `static/js/modules/core/csrf.js`: CSRF-Schutz.
- `static/js/modules/core/auth_handler.js`: Auth-Logik.
- `static/js/modules/core/router.js`: Page Router.
- `static/js/modules/core/ui.js`: UI-Utilities (Preload, Title, Scroll, Drawer).
- `static/js/modules/core/config.js`: Global Config Reader.
- `static/js/modules/search/advanced_entry.js`: Advanced Search Entry-Point.
- `static/js/modules/player/entry.js`: Player Entry-Point.
- `static/js/modules/stats/zoom.js`: Stats Page Logic.
- `static/js/modules/editor/entry.js`: Editor Entry-Point.
- `static/js/modules/editor/overview.js`: Editor Overview Logic.

## Template/Entry-Mapping

Die folgende Tabelle zeigt, wie Templates mit JavaScript-Modulen verknüpft sind. Es gibt zwei Mechanismen:
1.  **Router-basiert**: `data-page` Attribut am `<body>` triggert `static/js/modules/core/router.js`.
2.  **Direkt-Import**: `<script type="module">` direkt im Template.

| Template / Seite                       | Kennzeichnung (z.B. data-page) | Entry-Point / Modul                         | Mechanismus |
|----------------------------------------|---------------------------------|---------------------------------------------|-------------|
| `templates/pages/atlas.html`           | `data-page="atlas"`            | `static/js/pages/atlas.js`                  | Router      |
| `templates/search/advanced.html`       | (kein data-page)               | `static/js/modules/search/advanced_entry.js`| Direkt      |
| `templates/pages/player.html`          | `data-page="player"`           | `static/js/modules/player/entry.js`         | Direkt      |
| `templates/pages/editor.html`          | `data-page="editor"`           | `static/js/modules/editor/entry.js`         | Direkt      |
| `templates/pages/editor_overview.html` | `data-page="editor_overview"`  | `static/js/modules/editor/overview.js`      | Direkt      |
| `templates/pages/proyecto_estadisticas.html` | (kein data-page)         | `static/js/modules/stats/zoom.js`           | Direkt      |
| `templates/base.html` (Global)         | -                               | `static/js/modules/core/entry.js`           | Direkt      |

## Router-Verhalten

Das Modul `static/js/modules/core/router.js` wird vom globalen Entry-Point (`core/entry.js`) aufgerufen.
Es prüft das `data-page` Attribut am `<body>` Tag.
Wenn ein passender Key in der internen `pageInits` Map gefunden wird (z.B. `atlas`), wird das entsprechende Modul dynamisch importiert und dessen `init()` Funktion aufgerufen.

Dies ermöglicht Lazy-Loading von seitenspezifischem Code, ohne dass jedes Template eigene Skript-Tags benötigt. Aktuell wird dies primär für den Atlas genutzt. Andere Seiten nutzen (noch) direkte Imports, was ebenfalls valide ist (Standard ES Modules).

## Legacy-Code Einstufung

### `static/js/main.js`
- **Status**: Legacy / Deprecated.
- **Inhalt**: Enthält noch Polyfills, globale Event-Listener (z.B. für Accordions, Drawer-Logik, Token-Refresh) und Importe alter Module.
- **Strategie**: Funktionalität wurde teilweise bereits in `modules/core/` (z.B. `ui.js`, `auth_handler.js`) migriert. Der Rest sollte schrittweise extrahiert werden. Für neue Features nicht mehr erweitern.

### `static/js/app.js`
- **Status**: Legacy / Turbo-Adapter.
- **Inhalt**: Handelt Turbo Drive Events und Atlas-Lifecycle.
- **Strategie**: Beibehalten, solange Turbo Drive genutzt wird.

## Regression & Tests

Da die JavaScript-Architektur stark umgebaut wurde, sind folgende manuelle Tests essenziell:

1.  **Navigation**: Funktioniert der Drawer und die Top-Bar auf allen Seiten? (Mobile & Desktop)
2.  **Advanced Search**:
    - Laden die Tabs (Simple/Advanced/Stats)?
    - Funktionieren die Filter und die Suche?
    - Werden Statistiken (ECharts) korrekt gerendert?
3.  **Player**:
    - Lädt der Audio-Player?
    - Funktioniert die Synchronisation mit dem Transkript (Klick auf Wort -> Audio springt)?
    - Werden Metadaten angezeigt?
4.  **Editor**:
    - Können Änderungen vorgenommen und gespeichert werden?
    - Funktioniert Undo/Redo?
5.  **Atlas**:
    - Lädt die Karte? (Prüfung der Router-Funktionalität)

## Offene Punkte
- `static/js/main.js` ist noch ein monolithisches Legacy-Skript, das in `core/entry.js` importiert wird. Es sollte langfristig weiter zerlegt werden.
- Manuelle Regressionstests durchführen.

