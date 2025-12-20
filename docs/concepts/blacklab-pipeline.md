---
title: "BlackLab Pipeline Architecture"
status: active
owner: backend-team
updated: "2025-05-20"
tags: [blacklab, architecture, pipeline, search]
links:
  - how-to/manage-blacklab-index.md
  - reference/blacklab-index-structure.md
---

# BlackLab Pipeline Architecture

Überblick über die Architektur der BlackLab-Suchintegration in CO.RA.PAN.

---

## Übersicht

Die CO.RA.PAN-Suchfunktion basiert auf **BlackLab Server** (v5.x), einer Lucene-basierten Suchmaschine für korpuslinguistische Daten. Die Pipeline transformiert die rohen Transkriptionsdaten (JSON) in ein durchsuchbares Lucene-Index-Format.

### Datenfluss

```mermaid
graph TD
    A[Transkripte (JSON)] -->|LOKAL/.../03b_generate_blacklab_export.py| B[Export (TSV + JSONL)]
    B -->|scripts/blacklab/build_blacklab_index.ps1| C[BlackLab Index (Lucene)]
    C -->|Docker Volume| D[BlackLab Server (BLS)]
    D -->|REST API| E[Flask Backend (Advanced API)]
    E -->|JSON| F[Frontend (DataTables/ECharts)]
```

---

## Komponenten

### 1. Export (Python)
Das Skript `LOKAL/01 - Add New Transcriptions/03b_generate_blacklab_export.py` liest die normalisierten Transkripte aus der Datenbank oder dem Dateisystem und erzeugt zwei Artefakte:
- **TSV-Dateien**: Enthalten die Token-Daten (Wort, Lemma, POS, Zeitstempel).
- **DocMeta (JSONL)**: Enthält die Metadaten pro Dokument (Sprecher, Land, Video-ID).

### 2. Indexierung (Docker)
Das Skript `scripts/blacklab/build_blacklab_index.ps1` nutzt ein Docker-Image (`instituutnederlandsetaal/blacklab`), um die TSV-Dateien zu indexieren.
- **Input**: `data/blacklab_export/tsv`
- **Config**: `config/blacklab/corapan-tsv.blf.yaml`
- **Output**: `data/blacklab_index`

### 3. Suche (BlackLab Server)
Der BlackLab Server läuft als Docker-Container und stellt eine REST-API bereit.
- **Port**: 8081 (Standard)
- **Endpoint**: `/corapan/hits` (für Treffer), `/corapan/docs` (für Metadaten)

### 4. Backend Proxy (Flask)
Die Flask-Anwendung (`src/app/search/advanced_api.py`) fungiert als Proxy und Query-Builder.
- Übersetzt Frontend-Filter in CQL (Corpus Query Language).
- Angereichert die Suchergebnisse mit zusätzlichen Metadaten.
- Formatiert die Antwort für DataTables.

---

## Versionierung

- **BlackLab**: 5.x (Lucene 9)
- **Index-Format**: Integriert (Forward Index + Lucene Index)
- **Docker Image**: `instituutnederlandsetaal/blacklab:latest`
