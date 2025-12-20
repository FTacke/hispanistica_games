---
title: "Estadísticas-Feature mit ECharts implementiert"
date: 2025-11-06
author: "GitHub Copilot"
component: frontend
type: recommendation
status: ready
related_branch: "feature/stats-api"
tags: [echarts, stats, api, md3, visualization]
---

## Befund

Die einfache Suche („Búsqueda simple") benötigte eine aggregierte Statistik-Ansicht mit dynamischen Balkendiagrammen für:
- País (Land)
- Tipo de hablante (Sprechertyp)
- Sexo (Geschlecht)
- Registro (Register/Modus)

## Implementierung

### Backend (Python/Flask)

**Neuer Blueprint**: `src/app/routes/stats.py`
- Endpunkt: `GET /api/stats`
- Öffentlich lesend (keine Auth erforderlich)
- Rate Limit: 60 req/min pro IP
- File-Cache: 120s TTL unter `/data/stats_temp/`
- ETag-Support für konditionierte Requests

**Aggregationslogik**: `src/app/services/stats_aggregator.py`
- CTE `hits` mit WHERE-Filtern aus Suchparametern
- GROUP BY für `country_code`, `speaker_type`, `sex`, `mode`
- Berechnet `n` (absolute Anzahl) und `p` (Proportion 0-1)
- Zählt distinct filenames (Dokumente), nicht Tokens

**DB-Migration**: `LOKAL/01 - Add New Transcriptions/03 update DB/migrate_add_stats_indexes.py`
- Erstellt Indizes: `idx_docs_country`, `idx_docs_speaker`, `idx_docs_sexo`, `idx_docs_modo`
- Optimiert GROUP BY Performance

### Frontend (JavaScript/ECharts)

**Module**:
- `static/js/modules/stats/theme/corapanTheme.js`: MD3-Farbpalette für ECharts
- `static/js/modules/stats/renderBar.js`: Bar-Chart-Renderer mit ResizeObserver, automatische Label-Rotation bei >20 Kategorien
- `static/js/modules/stats/initStatsTab.js`: Controller für Fetch, Rendering, Fehlerbehandlung

**Integration**:
- Sub-Tabs in „Búsqueda simple": **Resultados | Estadísticas**
- Deep-Link: `?tab=simple&view=stats` öffnet Statistik direkt
- Lazy Loading: Stats werden nur geladen, wenn Tab aktiv
- Theme-Support: Dark/Light Mode Kompatibilität

### Template-Änderungen

**`templates/pages/corpus.html`**:
- Sub-Tab-Navigation ergänzt
- Vier Chart-Karten mit Export-Buttons (disabled, Platzhalter für spätere Features)
- Inline-Styles minimiert, nutzt vorhandene MD3-Klassen (`card-elevated`, `card-title`, etc.)

**CSS**: `static/css/md3/components/tabs.css`
- `.md3-sub-tabs` und `.md3-sub-tab` für Sub-Navigation
- `.md3-view-content` für View-Switching mit Fade-In-Animation
- `.chart-host`, `.chart-empty`, `.chart-skeleton` für Chart-Container

### Sicherheit

- **Öffentlicher API-Endpunkt**: Lesezugriff ohne Auth, Rate Limiting pro IP
- **DB Read-Only**: Nur SELECT-Operationen
- **Parametrisierte SQL**: Kein SQL-Injection-Risiko
- **Statement Timeout**: 5s per Query
- **CORS**: Nur eigene Origin

### Caching

- **TTL**: 120 Sekunden
- **Key**: SHA256-Hash der normalisierten Query-Parameter (16 Zeichen)
- **Storage**: `/data/stats_temp/*.json`
- **Cleanup**: Empfohlen täglich via Cron (findet alte Files automatisch)

## Testing

1. **Backend**:
   ```bash
   python LOKAL/01\ -\ Add\ New\ Transcriptions/03\ update\ DB/migrate_add_stats_indexes.py
   curl "http://localhost:5000/api/stats?q=hola&pais=ARG"
   ```

2. **Frontend**:
   ```bash
   npm run build
   # Öffne: http://localhost:5000/corpus/?tab=simple&view=stats
   ```

3. **Manuelle Checks**:
   - Sub-Tab-Wechsel funktioniert
   - Charts rendern korrekt
   - Tooltips zeigen `n` und `%`
   - Dark/Light Theme-Wechsel aktualisiert Charts
   - Leere Ergebnisse zeigen "Sin datos..."
   - Fehlerfall zeigt "No se pudieron cargar..."

## Performance

- **Erwartete Response-Zeit**: 50-300ms (ohne Cache)
- **Cache Hit**: <10ms
- **Kategorien**: <30 pro Dimension (keine Pagination nötig)
- **DB-Größe**: Optimiert für ~10k-100k Dokumente

## Dokumentation

- **`README_stats.md`**: Vollständige API-Dokumentation, Sicherheitshinweise, Frontend-Integration, Troubleshooting

## Zukünftige Erweiterungen

- [ ] Export-Buttons aktivieren (PNG/SVG Download)
- [ ] Zeit-Serien-Statistiken (nach Jahr aggregieren)
- [ ] Integration mit „Búsqueda avanzada"
- [ ] Redis-Cache für Multi-Instance-Deployments

## Verifikation

- [x] Blueprint registriert in `src/app/routes/__init__.py`
- [x] `/data/stats_temp/` erstellt und in `.gitignore`
- [x] ECharts via npm installiert
- [x] Vite Build erfolgreich
- [x] MD3-Design konsistent
- [x] Spanische UI-Labels
- [x] Rate Limiting aktiv
- [x] File-Cache funktional

## Fundstellen

- API: `src/app/routes/stats.py:90-150`
- Aggregation: `src/app/services/stats_aggregator.py:50-200`
- Frontend: `static/js/modules/stats/initStatsTab.js:100-200`
- Template: `templates/pages/corpus.html:250-350`

---

**Status**: Ready for testing and review.
**Empfehlung**: Nach manuellem Test in Dev-Umgebung kann dieses Feature in Production deployt werden.
