# Analytics System Documentation

> **Status:** Implementiert (Dezember 2025)  
> **Compliance:** DSGVO-konform, keine personenbezogenen Daten

## Übersicht

Das CO.RA.PAN Analytics-System erfasst anonyme Nutzungsstatistiken zur Verbesserung der Webapp. Es wurde als **vollständiger Ersatz** für das alte dateibasierte Counter-System implementiert.

### Datenschutz-Prinzipien

Das System speichert **keine personenbezogenen Daten**:

- ❌ Keine IP-Adressen
- ❌ Keine User-IDs oder Cookies
- ❌ Keine Browser-Fingerprints
- ❌ Keine Suchinhalte (nur Zähler)
- ✅ Nur aggregierte, anonyme Zähler pro Tag

→ **Kein Einwilligungsbanner erforderlich** (§25 TTDSG)

## Dokumentation

| Dokument | Beschreibung |
|----------|--------------|
| [Analytics Implementation](analytics-implementation.md) | Vollständige technische Dokumentation inkl. Architektur, Datenmodell, API-Endpoints, Frontend-Integration und Admin-Dashboard |

## Erfasste Metriken

| Metrik | Beschreibung | Speicherung |
|--------|--------------|-------------|
| `visitors` | Eindeutige Besuche (sessionStorage) | Aggregiert pro Tag |
| `mobile` / `desktop` | Gerätetyp-Verteilung | Aggregiert pro Tag |
| `searches` | Anzahl Suchanfragen (nur Zähler!) | Aggregiert pro Tag |
| `audio_plays` | Audio-Wiedergabe-Events | Aggregiert pro Tag |
| `errors` | HTTP 4xx/5xx Fehler | Aggregiert pro Tag |

## Architektur

```
Frontend (analytics.js)     →    Backend (analytics.py)    →    PostgreSQL
sessionStorage-basiert           POST /api/analytics/event      analytics_daily Tabelle
fire-and-forget                  GET  /api/analytics/stats      (nur Zähler!)
```

## API-Endpoints

### Öffentlich (kein Auth)
- `POST /api/analytics/event` - Event tracken (visit, search, audio_play, error)

### Admin-Only
- `GET /api/analytics/stats` - Aggregierte Statistiken für Dashboard

## Konfiguration

Das Analytics-System verwendet die bestehende Auth-Datenbank (`corapan_auth`). Keine zusätzliche Konfiguration erforderlich.

### Migration

Die Analytics-Tabellen werden mit der Migration `0002_create_analytics_tables.sql` angelegt:

```bash
# Wird automatisch durch dev-setup.ps1 ausgeführt
python scripts/apply_auth_migration.py
```

## Admin-Dashboard

Das Admin-Dashboard (`/admin/`) zeigt:
- Besucher pro Tag (letzte 30 Tage)
- Geräte-Verteilung (Mobile vs. Desktop)
- Suchaktivität
- Audio-Nutzung
- Fehler-Trends

## Weitere Dokumentation

- [Detaillierte Implementation](analytics-implementation.md) - Vollständige technische Spezifikation
- [Admin Dashboard](../concepts/webapp-status.md) - Webapp-Status und Features
