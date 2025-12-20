---
title: "Documentation Contributing Guidelines"
status: active
owner: documentation
updated: "2025-11-10"
tags: [contributing, guidelines, conventions, workflow, documentation]
links:
  - decisions/ADR-0001-docs-reorganization.md
  - CHANGELOG.md
  - index.md
---

# Documentation Contributing Guidelines

Konventionen für Änderungen an der CO.RA.PAN-Dokumentation.

---

## Zweck

Wende bei allen Änderungen an Markdown-Dokumentation strikt die CO.RA.PAN-Docs-Konventionen an. Arbeite **deterministisch, idempotent und mit prüfbarem Plan**.

---

## Regeln (verbindlich)

### Verzeichnisstruktur

**Pfade:**
```
/docs/
  ├── concepts/           # Architektur, Konzepte (Was & Warum)
  ├── how-to/             # Schritt-für-Schritt-Anleitungen
  ├── reference/          # API-Docs, DB-Schema, technische Specs
  ├── operations/         # Deployment, CI/CD, Runbooks
  ├── design/             # Design System, Tokens, Accessibility
  ├── decisions/          # ADRs, Roadmap
  ├── migration/          # Migrations-Guides (historisch)
  ├── troubleshooting/    # Problem-Lösungen nach Domain
  └── archived/           # Obsolete/abgeschlossene Docs
```

**Regel:** Jede neue Datei **muss** in eine dieser Kategorien passen.

---

### Dateinamen

**Format:** `kebab-case`, ASCII-only, Pattern: `^[a-z0-9][a-z0-9-]*\.md$`

**✅ Gut:**
- `authentication-flow.md`
- `api-auth-endpoints.md`
- `docker-issues.md`
- `ADR-0001-docs-reorganization.md`

**❌ Schlecht:**
- `Authentication_Flow.md` (Underscore, CamelCase)
- `auth flow.md` (Leerzeichen)
- `auth-flow-2024-11.md` (Datum im Namen, außer bei ADRs)
- `Troubleshooting.md` (Großbuchstaben)

---

### Single-Topic Prinzip

**Regel:** Eine Datei = Ein Thema

**Splitten wenn:**
- **>1200 Wörter** (~400 Zeilen Markdown)
- **Mehrere unabhängige Themen** (z.B. Auth + DB in einem Doc)
- **Verschiedene Zielgruppen** (z.B. Konzept vs. API-Referenz)

**Beispiel-Split:**
```
auth-flow.md (466 Zeilen, 3 Themen)
  → concepts/authentication-flow.md       (Konzept)
  → reference/api-auth-endpoints.md       (API-Referenz)
  → troubleshooting/auth-issues.md        (Probleme)
```

---

### Front-Matter (Pflicht)

**Schema:**
```yaml
---
title: "Document Title"
status: active | draft | deprecated | archived
owner: backend-team | frontend-team | devops | documentation
updated: "YYYY-MM-DD"
tags: [tag1, tag2, tag3]
links:
  - relative/path/to/related-doc.md
---
```

**Pflichtfelder:** `title`, `status`, `owner`, `updated`, `tags`

**Status-Werte:**
- `active` - Aktuell, in Verwendung
- `draft` - Work in Progress
- `deprecated` - Veraltet, aber noch referenziert
- `archived` - Historisch, nicht mehr aktuell

**Owner-Werte:**
- `backend-team` - Backend-Code (Python, Flask, DB)
- `frontend-team` - Frontend-Code (JS, CSS, Templates)
- `devops` - Deployment, CI/CD, Infrastruktur
- `documentation` - Reine Doku-Dateien (ADRs, Guidelines)

**Tags:** 3-7 Keywords (lowercase, kebab-case wenn nötig)

**Links:** 3-5 relative Pfade zu verwandten Docs (für Navigation)

---

### "Siehe auch" Abschnitt (Pflicht)

**Am Ende jeder Datei:**
```markdown
---

## Siehe auch

- [Related Document](../category/related-doc.md) - Kurze Beschreibung
- [Another Document](another-doc.md) - Kurze Beschreibung
- [External Resource](https://example.com) - Externe Links erlaubt
```

**Regel:** 3-5 Links zu verwandten Dokumenten (intern bevorzugt)

---

### Interne Links

**Format:** Relative Pfade

**✅ Gut:**
```markdown
[Database Maintenance](../reference/database-maintenance.md)
[Auth Flow](authentication-flow.md)  # Gleicher Ordner
```

**❌ Schlecht:**
```markdown
[Database](/docs/reference/database-maintenance.md)  # Absoluter Pfad
[Auth](https://github.com/.../auth-flow.md)  # GitHub-Link
```

**Wichtig:** Nach Rename/Split **alle Links aktualisieren** (inkl. Front-Matter `links`)

---

### ADRs (Architecture Decision Records)

**Pfad:** `decisions/ADR-XXXX-<slug>.md`

**Namensmuster:** `ADR-0001-docs-reorganization.md`
- Fortlaufende Nummer (4-stellig, führende Nullen)
- Slug beschreibt Entscheidung (kebab-case)
- **Kein Datum im Dateinamen** (steht im Front-Matter)

**Pflichtblöcke:**
```markdown
# ADR-XXXX: Title

**Status:** Accepted | Proposed | Deprecated | Superseded  
**Date:** YYYY-MM-DD  
**Deciders:** Names  
**Supersedes:** ADR-XXXX (optional)

## Context
Warum brauchen wir diese Entscheidung?

## Decision
Was haben wir entschieden?

## Consequences
### Positive
✅ Vorteile

### Negative
⚠️ Nachteile

### Neutral
Sonstige Auswirkungen

## Alternatives Considered
Was haben wir NICHT gemacht und warum?

## Implementation
Wie wurde es umgesetzt? (optional, nach Umsetzung)

## Siehe auch
- [Related ADR](ADR-XXXX.md)
```

---

### Sicherheit & Legal

**Verboten in Dokumentation:**
- ❌ Secrets (Passwörter, API-Keys, Tokens)
- ❌ PII (Personally Identifiable Information)
- ❌ Produktions-Credentials

**Bei Fund:**
```markdown
# REDACTED
password: <REDACTED>  # Original: admin123 (removed 2025-11-07)
```

**Report:** Eintrag in Commit-Message oder CHANGELOG

**Legal/Impressum:**
- Außerhalb `/docs` → **nicht ändern** ohne rechtliche Prüfung

---

## Dokumenttyp-Zuschnitt

### How-To Guides

**Struktur:**
```markdown
# Title

## Ziel
Was erreicht der User nach dieser Anleitung?

## Voraussetzungen
- Erforderliches Wissen
- Benötigte Tools
- Systemzustand

## Schritte

### Schritt 1: XYZ
```bash
command
```

### Schritt 2: ABC
...

## Validierung
Wie prüft man, dass es funktioniert hat?

## Rollback (optional)
Wie macht man es rückgängig?

## Siehe auch
```

**Beispiel:** `how-to/token-input-usage.md`

---

### Reference Docs

**Struktur:**
```markdown
# Title

Kurze Einführung (1-2 Sätze).

## Section 1

Stabile Spezifikation. Tabellen bevorzugt:

| Parameter | Typ | Beschreibung |
|-----------|-----|--------------|
| ...       | ... | ...          |

## Versionen (wenn relevant)
- v2.0: ...
- v1.5: ...

## Siehe auch
```

**Beispiel:** `reference/api-auth-endpoints.md`

---

### Concepts Docs

**Struktur:**
```markdown
# Title

## Problem
Welches Problem löst dieses Konzept?

## Kontext
Warum ist es relevant?

## Lösung / Konzept
Wie funktioniert es?

## Alternativen
Was haben wir NICHT gemacht?

## Siehe auch
- Verlinke auf passende ADR
```

**Beispiel:** `concepts/authentication-flow.md`

---

### Operations Docs

**Struktur:**
```markdown
# Title

## Überblick

## Deployment-Schritte
1. Schritt 1
2. Schritt 2

## Checklisten
- [ ] Item 1
- [ ] Item 2

## Befehle
```bash
docker-compose up -d
```

## Monitoring / Validierung

## Rollback

## Siehe auch
```

**Beispiel:** `operations/deployment.md`

---

### Migration Docs

**Struktur:**
```markdown
# Title

## Scope
Was ändert sich?

## Datenänderungen
- Tabellen
- Schema-Änderungen
- Daten-Migration

## Plan
1. Backup
2. Migration
3. Validierung

## Rollback / Backout
Wie rückgängig machen?

## Risiken
Bekannte Probleme?

## Siehe auch
```

**Beispiel:** `migration/database-v2-migration.md` (historisch in `LOKAL/records/archived_docs/migration/`)

---

### Troubleshooting Docs

**Struktur:**
```markdown
# Title

## Problem 1: Symptom

**Symptome:**
- ...

**Ursache:**
...

**Diagnose:**
```bash
command to diagnose
```

**Lösung:**
```bash
command to fix
```

**Prävention:**
Wie vermeidet man es künftig?

---

## Problem 2: ...

## Siehe auch
```

**Beispiel:** `troubleshooting/database-issues.md`

---

### Decision Docs (ADRs)

**Siehe ADRs-Abschnitt oben.**

**Beispiel:** `decisions/ADR-0001-docs-reorganization.md`

---

## Workflow (immer einhalten)

### 1. DISCOVER

**Ziel:** Relevante Dateien sammeln

**Aktionen:**
- Welche Dateien sind betroffen? (neu/ändern/rename/split/archive)
- Welche Links müssen aktualisiert werden?
- Gibt es Duplikate/Überschneidungen?

**Output:** Liste der Dateien

---

### 2. PLAN (DRY RUN)

**Ziel:** Prüfbarer Plan **vor** Änderungen

**Format:** Tabelle

| Datei (alt) | Datei (neu) | Aktion | Grund |
|-------------|-------------|--------|-------|
| `auth-flow.md` | `concepts/authentication-flow.md` | split | 466 Zeilen, 3 Themen |
| `auth-flow.md` | `reference/api-auth-endpoints.md` | split | API-Referenz ausgegliedert |
| `auth-flow.md` | `troubleshooting/auth-issues.md` | split | Troubleshooting ausgegliedert |
| `deployment.md` | `operations/deployment.md` | rename | Passt in operations/ |
| `old-feature.md` | `archived/old-feature.md` | archive | Feature entfernt |

**Aktionen:**
- `create` - Neue Datei
- `modify` - Inhalt ändern (Front-Matter, Text)
- `rename` - Datei verschieben (`git mv`)
- `split` - Datei in mehrere aufteilen
- `archive` - Nach `archived/` verschieben
- `delete` - Löschen (nur wenn absolut sicher!)

**Wichtig:** Diskutiere PLAN mit Team **bevor** du `APPLY` machst!

---

### 3. LINT (simuliert)

**Ziel:** Validierung **vor** Änderungen

**Checks:**
- [ ] Pfad korrekt? (`/docs/{category}/`)
- [ ] Dateiname kebab-case? (`^[a-z0-9][a-z0-9-]*\.md$`)
- [ ] Front-Matter vollständig? (title, status, owner, updated, tags)
- [ ] Front-Matter YAML valide?
- [ ] Größe <1200 Wörter? (sonst Split erwägen)
- [ ] Interne Links relativ? (`../category/file.md`)
- [ ] "Siehe auch" vorhanden? (3-5 Links)
- [ ] Keine Secrets/PII?

**Tool (optional):**
```bash
# Pseudo-Code für Lint-Script
for file in docs/**/*.md; do
  check_frontmatter "$file"
  check_links "$file"
  check_size "$file"
done
```

---

### 4. APPLY

**Ziel:** Änderungen gemäß PLAN umsetzen

**Schritte:**
1. **Neue Dateien erstellen** (mit Front-Matter)
2. **Dateien verschieben** (`git mv` für History)
3. **Dateien splitten** (Inhalt aufteilen + jeweils Front-Matter)
4. **Cross-Links aktualisieren** (in allen betroffenen Dateien)
5. **"Siehe auch" aktualisieren** (neue Pfade)
6. **Front-Matter `links` aktualisieren**

**Wichtig:** Keine manuelle Edits in Git-History! `git mv` benutzen!

---

### 5. REPORT

**Ziel:** Zusammenfassung der Änderungen

**Format:**
```markdown
# Documentation Changes Report

**Date:** YYYY-MM-DD

## Summary

- **Files Created:** X
- **Files Modified:** Y
- **Files Renamed:** Z
- **Files Archived:** A
- **Files Deleted:** B
- **Links Fixed:** L
- **Redactions:** R

## Changes

| Datei (alt) | Datei (neu) | Aktion | Status |
|-------------|-------------|--------|--------|
| ...         | ...         | ...    | ✅ Done |

## Redactions (falls vorhanden)

- `file.md` line 42: <REDACTED> password (removed 2025-11-07)

## TODOs (falls vorhanden)

- [ ] Update external links in README
- [ ] Notify team about new structure

## Siehe auch

- [CHANGELOG](CHANGELOG.md)
- [ADR-XXXX](decisions/ADR-XXXX.md)
```

**Speichern als:** `docs/archived/REPORT-YYYY-MM-DD-<slug>.md`

---

## Output-Format

### PLAN (Tabelle)

```markdown
| Datei (alt) | Datei (neu) | Aktion | Grund |
|-------------|-------------|--------|-------|
| ...         | ...         | ...    | ...   |
```

---

### DIFFS (per Datei)

```diff
file=docs/concepts/architecture.md
@@ -1,3 +1,10 @@
+---
+title: "Architecture Overview"
+status: active
+owner: backend-team
+updated: "2025-11-07"
+tags: [architecture, flask]
+---
+
 # Architecture Overview
 
 ## Backend
```

---

### NOTES

```markdown
## Notes

- **Besondere Entscheidungen:** Split von troubleshooting.md wegen 638 Zeilen
- **Redactions:** Keine gefunden
- **Offene Punkte:** External links in README.md müssen manuell geprüft werden
```

**Regel:** Kein freier Fließtext außerhalb PLAN/DIFF/NOTES!

---

## Commit-Konvention

**Format:** `<type>(docs): <subject>`

**Types:**
- `feat(docs)` - Neue Dateien
- `refactor(docs)` - Rename/Split
- `fix(docs)` - Links/Front-Matter korrigiert
- `chore(docs)` - Archivierungen, Cleanup
- `docs` - Dokumentations-Updates (allgemein)

**Subject:** Imperativ, lowercase, max 72 Zeichen

**Body:** Tabelle alt→neu (bei Renames/Splits)

**Beispiel:**
```
refactor(docs): split troubleshooting.md by domain

Split large troubleshooting file (638 lines) into 4 domain-specific files.

Changes:
- troubleshooting.md → troubleshooting/docker-issues.md (Server)
- troubleshooting.md → troubleshooting/database-issues.md (DB)
- troubleshooting.md → troubleshooting/auth-issues.md (Auth)
- troubleshooting.md → troubleshooting/frontend-issues.md (UI)

Fixed 12 internal links.

See: docs/decisions/ADR-0001-docs-reorganization.md
```

---

## Parameter (Template)

**Für neue Dokumente:**
```
TODAY=2025-11-07
OWNER=backend-team | frontend-team | devops | documentation
TYPE=concepts | how-to | reference | operations | design | migration | troubleshooting | decisions | archived
SLUG=my-new-document
```

**Beispiel-Befehl:**
```bash
# Neue Datei erstellen
cat > docs/${TYPE}/${SLUG}.md <<EOF
---
title: "${SLUG}"
status: draft
owner: ${OWNER}
updated: "${TODAY}"
tags: []
links: []
---

# ${SLUG}

Content here...

## Siehe auch
EOF
```

---

## Fallstudie: BlackLab-Integration (2025-11-10)

Praktisches Beispiel für den DISCOVER → PLAN → APPLY-Workflow bei komplexer Systemintegration.

### Kontext

Implementierung einer **3-stufigen Pipeline** zur Volltext-Indexierung des CO.RA.PAN-Corpus mit BlackLab Server:
1. **Stage 1 (Export):** JSON v2 → TSV + docmeta.jsonl
2. **Stage 2 (Index):** TSV → Lucene-Index (atomar)
3. **Stage 3 (Proxy):** Flask `/bls/**` → BlackLab Server

### DISCOVER (Dateien sammeln)

**Neue Dateien:**
- Exporter-Skript: `src/scripts/blacklab_index_creation.py`
- Build-Skript: `scripts/blacklab/build_blacklab_index.sh`
- Proxy-Komponente: `src/app/routes/bls_proxy.py`
- Config: `config/blacklab/corapan-tsv.blf.yaml`
- 6 Dokumentations-Dateien (Konzept, How-To, Referenz, Troubleshooting)

**Zu ändern:**
- `src/app/routes/__init__.py` (Blueprint registrieren)
- `docs/index.md` (BlackLab-Links hinzufügen)

### PLAN

| Datei (neu) | Typ | Grund |
|------------|-----|-------|
| `src/scripts/blacklab_index_creation.py` | create | Exporter (JSON→TSV, 650 Zeilen) |
| `scripts/blacklab/build_blacklab_index.sh` | create | Index-Builder + atomare Switch |
| `src/app/routes/bls_proxy.py` | create | HTTP-Proxy Blueprint |
| `config/blacklab/corapan-tsv.blf.yaml` | create | Index-Schema (TSV-only) |
| `docs/concepts/blacklab-indexing.md` | create | Architektur-Konzept |
| `docs/how-to/build-blacklab-index.md` | create | Schritt-für-Schritt |
| `docs/reference/blacklab-api-proxy.md` | create | CQL-Syntax + Endpoints |
| `docs/reference/blf-yaml-schema.md` | create | Config-Referenz |
| `docs/troubleshooting/blacklab-issues.md` | create | 9 Problem-Lösungen |
| `README_dev.md` | create | Dev-Setup-Guide |
| `src/app/routes/__init__.py` | modify | Blueprint-Import |
| `docs/index.md` | modify | 5 BlackLab-Links hinzufügen |

### LINT (Validierung)

✅ Alle neuen Markdown-Dateien:
- Front-Matter: `title`, `status`, `owner`, `updated`, `tags` vorhanden
- Kategorie: `docs/{concepts|how-to|reference|troubleshooting}/`
- Dateinamen: kebab-case, ASCII-only
- Größe: <1200 Wörter pro Datei
- Links: Relativ (`../../../`), nicht absolut

✅ Code-Dateien:
- Python: Syntax validiert, keine Imports fehlen
- Shell: Bash-Syntax (`set -euo pipefail`), Error-Handling

### APPLY (Umsetzung)

**Stage 1: Export (2025-11-10 14:37)**
```bash
python -m src.scripts.blacklab_index_creation \
  --in media/transcripts \
  --out data/blacklab_index/tsv \
  --docmeta data/blacklab_index/docmeta.jsonl \
  --format tsv \
  --workers 4
```
**Resultat:** 146 JSON-Dateien → 146 TSV-Dateien, 1,487,120 Tokens

**Stage 2: Index-Build (pending)**
```bash
bash scripts/blacklab/build_blacklab_index.sh tsv 4
# Erstellt: data/blacklab_index/ (Lucene-Index)
```
*Hängt ab von: Java + BlackLab Server Installation*

**Stage 3: Proxy-Start (pending)**
```bash
bash scripts/blacklab/run_bls.sh 8081 2g 512m
curl http://localhost:8000/bls/  # Proxy-Test
```

### Wichtige Entscheidungen

| Problem | Lösung | Grund |
|---------|--------|-------|
| WPL vs TSV? | **TSV-only** | Einfacher, kein XML-Escaping |
| Absolute Pfade? | **Relativ (data/)** | Cross-Plattform (Windows/Linux) |
| Idempotenz? | **Content-Hash** | Verhindert Re-Exporte |
| Index-Switch? | **Atomar (.new → current)** | Zero-Downtime, Fallback möglich |
| Flask + BLS? | **HTTP-Proxy** | Keine direkten Abhängigkeiten |

---

## Aufgabe (Template für Anfragen)

**Template:**
```
Modularisiere/erstelle/aktualisiere folgende Dokumente nach den CO.RA.PAN Docs-Guidelines:

FILES:
- <list of files>

PARAMETERS:
- TODAY=<YYYY-MM-DD>
- OWNER=<team>

WORKFLOW:
1. DISCOVER: Relevante Dateien sammeln
2. PLAN (DRY RUN): Tabelle alt→neu mit Aktion
3. LINT: Validierung (Front-Matter, Links, Größe)
4. APPLY: Änderungen umsetzen
5. REPORT: Zusammenfassung mit Counters

Starte mit PLAN (DRY RUN). Nach Freigabe: APPLY und REPORT.
```

---

## Siehe auch

- [ADR-0001: Docs Reorganization](decisions/ADR-0001-docs-reorganization.md) - Rationale für diese Guidelines
- [Documentation Index](index.md) - Master-Navigation
- [CHANGELOG](CHANGELOG.md) - Dokumentations-Änderungen
- [Advanced Search UI Finalization](how-to/advanced-search-ui-finalization.md) - Frontend Implementation Example (2025-11-11)
- [Divio Documentation System](https://documentation.divio.com/) - Externe Referenz

---

## Entwicklung: Statistik-CSV-Export

Der CSV-Export für Statistiken (`/search/advanced/stats/csv`) wurde implementiert, um Nutzern die Weiterverarbeitung der Daten zu ermöglichen.

### Technische Umsetzung

*   **Endpoint:** `GET /search/advanced/stats/csv`
*   **Streaming:** Die Response wird gestreamt (`yield`), um Speicher zu sparen. Es werden keine temporären Dateien angelegt.
*   **Datenquelle:** Nutzt dieselben BlackLab-Abfragen wie die Statistik-Anzeige (`bls_group_by_field`).

### CSV-Format

Die Datei beginnt mit einem Metadaten-Block (Kommentare mit `#`), gefolgt von der Datentabelle.

```text
# corpus=CO.RA.PAN
# date_generated=2025-11-21T...
# query_type=CQL
# query=[lemma="casa"]
# filters={"country_code": ["ARG"]}
# total_hits=1234
# stats_type=all_charts
chart_id,chart_label,dimension,count,relative_frequency
by_country,Por país,ARG,1234,1.0
...
```

### Erweiterung

Um neue Statistik-Typen hinzuzufügen:
1.  In `src/app/search/advanced_api.py` die `dimensions`-Map in `stats_csv` erweitern.
2.  Sicherstellen, dass das Feld in `BLS_FIELDS` definiert ist.
