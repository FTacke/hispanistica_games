---
title: "BlackLab Index Structure"
status: active
owner: backend-team
updated: "2025-05-20"
tags: [blacklab, reference, schema, configuration]
links:
  - concepts/blacklab-pipeline.md
---

# BlackLab Index Structure

Technische Referenz der Index-Struktur, Felder und Konfiguration.

---

## Konfiguration

Die Index-Struktur wird durch `config/blacklab/corapan-tsv.blf.yaml` definiert.

- **Format**: TSV (Tab Separated Values)
- **Annotated Fields**: Token-Ebene
- **Metadata**: Dokument-Ebene (via `docmeta.jsonl`)

---

## Annotations (Token-Ebene)

Diese Felder sind für jedes Wort im Korpus verfügbar und können via CQL abgefragt werden.

| Feld | Beschreibung | Beispiel |
|------|--------------|----------|
| `word` | Das gesprochene Wort (Original) | `habe` |
| `lemma` | Grundform des Wortes | `haben` |
| `pos` | Part-of-Speech Tag (UD) | `VERB` |
| `start` | Startzeit (Sekunden) | `12.5` |
| `end` | Endzeit (Sekunden) | `13.1` |
| `id` | Token-ID | `1` |

**Beispiel CQL:**
`[lemma="haben" & pos="VERB"]`

---

## Metadata (Dokument-Ebene)

Diese Felder beschreiben das gesamte Dokument (Video/Transkript) und werden zum Filtern verwendet.

| Feld | Beschreibung | Typ |
|------|--------------|-----|
| `id` | Eindeutige Video-ID | String |
| `title` | Titel des Videos | String |
| `country_code` | Ländercode (ISO) | String (z.B. `ES`, `MX`) |
| `year` | Aufnahmejahr | Integer |
| `duration` | Dauer in Sekunden | Integer |
| `speaker_count` | Anzahl Sprecher | Integer |

**Beispiel Filter:**
`doc.country_code:ES AND doc.year:2020`

---

## Dateiformate

### TSV (Input)
```tsv
word    lemma   pos     start   end     id
Hola    hola    INTJ    0.0     0.5     1
mundo   mundo   NOUN    0.5     1.0     2
```

### DocMeta (Input)
```json
{"id": "video1", "title": "Interview 1", "country_code": "ES", "year": 2022}
{"id": "video2", "title": "Interview 2", "country_code": "MX", "year": 2021}
```
