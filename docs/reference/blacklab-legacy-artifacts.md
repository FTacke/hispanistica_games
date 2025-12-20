---
title: "BlackLab Legacy Artifacts"
status: active
owner: backend-team
updated: "2025-05-20"
tags: [blacklab, legacy, deprecated, cleanup]
links:
  - reference/blacklab-configuration.md
---

# BlackLab Legacy Artifacts

Dieses Dokument listet Dateien und Skripte auf, die als **Legacy** oder **Deprecated** identifiziert wurden. Diese Dateien sollten nicht mehr für den produktiven Betrieb verwendet werden.

> **Wichtig:** Diese Dateien wurden nicht gelöscht, um die Historie zu bewahren, sollten aber bei zukünftigen Refactorings archiviert oder entfernt werden.

---

## 1. Skripte

### `scripts/start_blacklab_docker.ps1`
- **Status**: Deprecated
- **Grund**: Startet eine veraltete Version von BlackLab (v3.5).
- **Ersatz**: `scripts/start_blacklab_docker_v3.ps1` (Startet v5.x).

### `scripts/run_bls.sh`
- **Status**: Deprecated
- **Grund**: Versucht, BlackLab Server lokal (ohne Docker) als Java-Prozess zu starten. Die aktuelle Architektur setzt vollständig auf Docker.
- **Ersatz**: `scripts/start_blacklab_docker_v3.ps1` (oder Docker Compose).

---

## 2. Konfiguration

### `config/blacklab/corapan.blf.yaml`
- **Status**: Deprecated
- **Grund**: Alte Version (v2.0) der Index-Konfiguration.
- **Ersatz**: `config/blacklab/corapan-tsv.blf.yaml` (Aktuelle TSV-Konfiguration).

---

## 3. Verzeichnisse (Historisch)

### `data/blacklab-index` (Hyphenated)
- **Status**: Legacy
- **Grund**: Alter Pfad für den Index.
- **Aktuell**: `data/blacklab_index` (Underscore).

### `LOKAL/`
- **Status**: Legacy / Archiv
- **Grund**: Enthält alte Design-Dokumente und Skripte (`00 - Md3-design`, `03 - Analysis Scripts`), die nicht mehr Teil der aktiven CI/CD-Pipeline sind.

---

## Zusammenfassung der aktuellen Pipeline

Verwenden Sie **nur** diese Dateien für den Betrieb:

1.  **Export**: `LOKAL/01 - Add New Transcriptions/03b_generate_blacklab_export.py`
2.  **Build**: `scripts/blacklab/build_blacklab_index.ps1` (oder `.sh`)
3.  **Config**: `config/blacklab/corapan-tsv.blf.yaml`
4.  **Run**: `scripts/start_blacklab_docker_v3.ps1`
