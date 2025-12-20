# Atlas & Metadaten Architektur

## Übersicht

Das CO.RA.PAN-Corpus verwendet eine dreiteilige Architektur für die Darstellung von geografischen und Metadaten:

| Seite | Route | Funktion |
|-------|-------|----------|
| **Atlas** | `/atlas` | Interaktive Karte mit Marker-Tooltips |
| **Metadatos** | `/corpus/metadata` | Länder-Tab-Dashboard mit Dateitabellen |
| **Estadísticas** | `/corpus/estadisticas` | Statistische Visualisierungen pro Land |

## Deep-Linking

Alle drei Seiten unterstützen Deep-Links via Query-Parameter:

```
/corpus/metadata?country=ARG
/corpus/estadisticas?country=ESP
```

### Implementierung

1. **Atlas → Metadatos/Estadísticas**:
   - Marker-Tooltips enthalten Links mit `?country=XXX`
   - Klick öffnet Zielseite mit vorselektiertem Land

2. **Metadatos**:
   - JavaScript liest `window.location.search` beim Laden
   - Aktiviert passenden Tab automatisch
   - Tab-Wechsel aktualisiert URL via `history.replaceState()`

3. **Estadísticas**:
   - Analog zu Metadatos
   - Wählt Land im Dropdown und lädt Statistik-Bild

## Datenfluss

```
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoints                            │
├─────────────────────────────────────────────────────────────┤
│  /api/v1/atlas/countries  → Länder-Statistiken (öffentlich) │
│  /api/v1/atlas/files      → Datei-Metadaten (auth optional) │
│  /api/v1/atlas/overview   → Gesamt-Statistiken (öffentlich) │
│  /api/v1/atlas/locations  → Standort-Koordinaten (öffentl.) │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Pages                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│     Atlas       │   Metadatos     │    Estadísticas         │
│  (Karte)        │  (Tab-Tabellen) │  (Visualisierungen)     │
├─────────────────┼─────────────────┼─────────────────────────┤
│ - Leaflet Map   │ - Country Tabs  │ - Country Selector      │
│ - Marker Icons  │ - File Tables   │ - Statistics Images     │
│ - Popups        │ - Stats Summary │ - Zoom Modal            │
│ - Deeplinks     │ - Deeplinks     │ - Deeplinks             │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Marker-Tooltip Inhalte

Jeder Marker auf der Atlas-Karte zeigt:

| Feld | Quelle | Beschreibung |
|------|--------|--------------|
| **Titel** | `CITY_LIST` | Länder-/Stadtname |
| **Emisoras** | `/api/v1/atlas/files` | Eindeutige Radiosender |
| **Duración total** | `/api/v1/atlas/countries` | Summe aller Audio-Sekunden |
| **Palabras transcritas** | `/api/v1/atlas/countries` | Summe aller Wörter |
| **Links** | Hardcoded | Deeplinks zu Metadatos + Estadísticas |

## Länder-Codes

Das System verwendet ISO-3166-1 Alpha-3 Codes für nationale Hauptstädte und erweiterte Codes für regionale Standorte:

```
Nationale:  ARG, BOL, CHL, COL, CRI, CUB, DOM, ECU, ESP, GTM, 
            HND, MEX, NIC, PAN, PER, PRY, SLV, URY, USA, VEN

Regionale:  ARG-CBA, ARG-CHU, ARG-SDE, ESP-CAN, ESP-SEV
```

Definition: `src/app/config/countries.py`

## Dateien

### Templates
- `templates/pages/atlas.html` - Karten-Template
- `templates/pages/corpus_metadata.html` - Metadaten-Dashboard
- `templates/pages/corpus_estadisticas.html` - Statistik-Seite

### JavaScript
- `static/js/modules/atlas/index.js` - Atlas-Kartenlogik
- `static/js/modules/corpus-metadata.js` - Metadaten-Tabs
- `static/js/modules/stats/zoom.js` - Statistik-Interaktionen

### CSS
- `static/css/md3/components/atlas.css` - Karten-Styles
- `static/css/md3/components/corpus-metadata.css` - Tab-Styles

### Backend
- `src/app/routes/atlas.py` - API-Endpunkte
- `src/app/services/atlas.py` - Datenabfragen
- `src/app/routes/corpus.py` - Template-Routes

## Caching

Die Atlas-API-Endpunkte sind mit 1-Stunden-Cache versehen:

```python
@blueprint.get("/countries")
@cache.cached(timeout=3600)  # 1 hour
def countries():
    ...
```

## Migration History

**Dezember 2025**: Atlas wurde auf reine Kartenansicht reduziert.

- Dropdowns/Tabs/Tabellen nach `corpus_metadata` migriert
- Marker-Tooltips mit Kennzahlen und Deeplinks erweitert
- Deep-Link-Unterstützung für alle drei Seiten implementiert
