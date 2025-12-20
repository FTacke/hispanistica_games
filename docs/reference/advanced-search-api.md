---
title: "Advanced Search API"
status: active
owner: backend-team
updated: "2025-05-20"
tags: [api, search, reference, backend]
links:
  - concepts/blacklab-pipeline.md
---

# Advanced Search API

Dokumentation der internen API für die erweiterte Suche (`/search/advanced/api/results`).

---

## Endpoint

`POST /search/advanced/api/results`

Dieser Endpoint wird vom DataTables-Frontend aufgerufen, um Suchergebnisse abzurufen. Er übersetzt die Anfrage in CQL, fragt BlackLab ab und formatiert die Antwort.

---

## Request Parameters (JSON)

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| `draw` | Int | DataTables Draw Counter (für Synchronisation) |
| `start` | Int | Offset für Pagination (0-basiert) |
| `length` | Int | Anzahl der Ergebnisse pro Seite |
| `search[value]` | String | Freitext-Suchbegriff (wird als CQL interpretiert) |
| `order[0][column]` | Int | Index der Sortierspalte |
| `order[0][dir]` | String | Sortierrichtung (`asc`, `desc`) |
| `columns[i][data]` | String | Name der Spalte (z.B. `hit:country_code`) |
| `filters` | Object | Zusätzliche Filter (z.B. `{country: ["ES", "MX"]}`) |

---

## Response Format (JSON)

```json
{
  "draw": 1,
  "recordsTotal": 150,
  "recordsFiltered": 25,
  "data": [
    {
      "left": "Das ist ein ",
      "match_word": "Beispiel",
      "right": " für die Suche.",
      "hit:country_code": "DE",
      "hit:year": 2023,
      "docId": "video_123",
      "start": 10.5,
      "end": 11.2
    },
    ...
  ],
  "stats": {
    "total_hits": 25,
    "total_docs": 5,
    "duration_ms": 120
  }
}
```

---

## Sortierung

Die Sortierung erfolgt serverseitig. Da DataTables Spaltenindizes sendet, mappt das Backend diese auf BlackLab-Felder.

- **Metadaten-Felder**: Müssen mit `hit:` präfigiert werden (z.B. `hit:year`), damit BlackLab sie korrekt sortiert.
- **Kontext**: Sortierung nach linkem/rechtem Kontext ist ebenfalls möglich.

---

## Fehlerbehandlung

Bei Fehlern (z.B. ungültiges CQL) gibt die API einen HTTP 400 oder 500 Status zurück, mit einer JSON-Fehlermeldung:

```json
{
  "error": "Invalid CQL syntax",
  "details": "..."
}
```

---

## Statistics Endpoint

`GET /search/advanced/api/stats`

Dieser Endpoint liefert aggregierte Statistiken für die Diagramme.

- **Parameter**: Identisch zu den Suchparametern (Query, Filter).
- **Funktionsweise**: Führt parallele `group`-Abfragen an BlackLab aus.
- **Details**: Siehe [Statistics Generation Documentation](../dev/statistics_generation.md).

**Response Format:**
```json
{
  "total_hits": 1500,
  "by_country": [{"key": "ES", "n": 1000}, ...],
  "by_speaker_type": [{"key": "native", "n": 1200}, ...]
}
```
