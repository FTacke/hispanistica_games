---
title: "BlackLab Configuration Reference"
status: active
owner: backend-team
updated: "2025-05-20"
tags: [blacklab, configuration, reference, tsv]
links:
  - concepts/blacklab-pipeline.md
  - how-to/build-blacklab-index.md
---

# BlackLab Configuration Reference

Diese Referenz beschreibt die Konfigurationsdateien, die für die Erstellung und den Betrieb des BlackLab-Index in CO.RA.PAN verwendet werden.

---

## 1. Index-Format (`corapan-tsv.blf.yaml`)

Die zentrale Konfigurationsdatei für das Indexieren der TSV-Exporte ist `config/blacklab/corapan-tsv.blf.yaml`. Sie definiert, wie BlackLab die Spalten der TSV-Dateien interpretiert und welche Annotationen erstellt werden.

### Speicherort
`config/blacklab/corapan-tsv.blf.yaml`

### Struktur

#### Metadaten
- **displayName**: "CO.RA.PAN Corpus (TSV)"
- **fileType**: `tabular` (TSV)
- **pidField**: `fromInputFile` (Eindeutige ID pro Dokument basierend auf dem Dateinamen)

#### Annotations (Token-Ebene)
Die folgenden Felder werden für jedes Token indexiert:

| Feld | Beschreibung | Sensitivity | UI Type |
|------|--------------|-------------|---------|
| `word` | Originalwort | sensitive | text |
| `norm` | Normalisierte Form (für Suche) | insensitive | text |
| `lemma` | Grundform | sensitive | lemma |
| `pos` | Part-of-Speech Tag | - | pos |
| `tense` | Tempus (spaCy) | - | select |
| `mood` | Modus (spaCy) | - | select |
| `person` | Person (spaCy) | - | select |
| `number` | Numerus (spaCy) | - | select |
| `aspect` | Aspekt (spaCy) | - | select |
| `start_ms` | Startzeit (ms) | - | - |
| `end_ms` | Endzeit (ms) | - | - |
| `speaker_code` | Sprecher-ID | - | - |

#### Metadaten (Dokument-Ebene)
Metadaten werden aus verknüpften JSON-Dateien importiert (`--linked-file-dir`). Wichtige Felder:
- `title` (Dateiname)
- `author` (Sprecher)
- `date` (Aufnahmedatum)
- `country` (Land)
- `duration` (Dauer)

---

## 2. Docker Konfiguration

Die Laufzeitumgebung für BlackLab wird über Docker Compose und Umgebungsvariablen gesteuert.

### `docker-compose.yml`
Der Service `blacklab` definiert die Server-Instanz.

- **Image**: `instituutnederlandsetaal/blacklab:latest`
- **Ports**: `8081:8080`
- **Volumes**:
  - `./data/blacklab_index:/data/index`: Der erstellte Index.
  - `./config/blacklab:/config`: Konfigurationsdateien.

### Build-Skripte

#### `scripts/blacklab/build_blacklab_index.ps1`
Das Hauptskript für den Index-Build unter Windows.
- Startet einen temporären Container.
- Führt `IndexTool` aus.
- Nutzt `corapan-tsv.blf.yaml` als Format-Definition.

#### `scripts/start_blacklab_docker_v3.ps1`
Startet den BlackLab Server für die Entwicklung/Produktion.
- Setzt `BLACKLAB_CONFIG_DIR` auf `/config`.
- Mountet den Index read-write (oder read-only in Prod).

---

## 3. Legacy vs. Aktuell

| Komponente | Aktuell (v5.x) | Legacy (v3.x) |
|------------|----------------|---------------|
| **Format** | `corapan-tsv.blf.yaml` | `corapan.blf.yaml` |
| **Input** | TSV + JSONL | TEI / XML |
| **Start-Skript** | `start_blacklab_docker_v3.ps1` | `start_blacklab_docker.ps1` |
| **Index-Pfad** | `data/blacklab_index` | `data/blacklab-index` (alt) |

Siehe [Legacy Artifacts](blacklab-legacy-artifacts.md) für Details zu veralteten Dateien.
