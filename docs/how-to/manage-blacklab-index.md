---
title: "Manage BlackLab Index"
status: active
owner: devops
updated: "2025-05-20"
tags: [blacklab, operations, how-to, indexing]
links:
  - concepts/blacklab-pipeline.md
  - reference/blacklab-index-structure.md
---

# Manage BlackLab Index

Anleitung zum Erstellen, Aktualisieren und Verwalten des BlackLab-Suchindex.

---

## Voraussetzungen

- **Docker Desktop** muss laufen.
- **Python 3.10+** Umgebung aktiviert.
- Zugriff auf die Transkriptionsdaten (`media/transcripts`).

---

## Index neu erstellen (Full Rebuild)

Dieser Prozess exportiert alle Daten neu und erstellt den Index von Grund auf.

### 1. Daten exportieren

Konvertiert JSON-Transkripte in das TSV-Format für BlackLab.

```powershell
python scripts/blacklab/run_export.py
```
*Output: `data/blacklab_export/tsv/*.tsv` und `data/blacklab_export/docmeta.jsonl`*

### 2. Index bauen

Startet den Docker-Container, um die TSV-Dateien zu indexieren.

```powershell
.\scripts\blacklab\build_blacklab_index.ps1
```
*Dauer: ca. 2-5 Minuten je nach Datenmenge.*

### 3. Server neu starten

Damit der neue Index geladen wird, muss der BlackLab-Server neu gestartet werden.

```powershell
.\scripts\blacklab\stop_blacklab_docker.ps1
.\scripts\blacklab\start_blacklab_docker_v3.ps1
```

---

## Index überprüfen

### Status prüfen
Öffne `http://localhost:8081/blacklab-server/` im Browser. Der Status des Korpus `corapan` sollte "available" sein.

### Test-Suche
Führe eine einfache Suche aus:
`http://localhost:8081/blacklab-server/corapan/hits?patt="und"`

---

## Troubleshooting

### "Index locked" Fehler
Wenn der Build abbricht, kann eine Lock-Datei zurückbleiben.
**Lösung:** Lösche die Datei `write.lock` im Verzeichnis `data/blacklab_index`.

### Docker Mount Probleme
Stelle sicher, dass Docker Zugriff auf das Laufwerk `C:` hat (File Sharing in Docker Settings).

### Leere Suchergebnisse
Prüfe `data/blacklab_index/build.log` auf Fehler während der Indexierung.
