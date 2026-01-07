# Admin Upload Plan (Quiz Content)

> **Status:** Implementierungsreif – Phase A (Repo-only MVP)  
> **Version:** 1.0.0  
> **Letzte Aktualisierung:** 2026-01-07

---

## 1. Ziel & Scope

Ein Admin-Dashboard soll Quiz-Content **unit-weise** verwalten. Admin lädt **immer genau 1 Quiz-Unit pro Upload** hoch (1 JSON + dazugehörige Media-Dateien). Das Dashboard speichert serverseitig weiterhin in der bestehenden Production-Ordnerlogik (**Release-Ordner + Import/Publish**), so dass der aktuelle Production-Workflow erhalten bleibt.

**Nicht-Ziele (spätere Versionen):**
- Nutzer-Statistiken / Analytics (aber UI-Platzhalter/Tab wird vorgesehen)
- Bulk-Upload mehrerer Units in einem Schritt
- Automatisches Publish ohne expliziten Admin-Klick
- Drag & Drop für Reihenfolge (MVP: Number Input)
- Live Import Progress (MVP: Loading-Spinner + Poll)

---

## 2. Begriffe & Grundannahmen

### Fachliche Begriffe
- **Unit**: Eine Quiz-Unit (ein JSON-Dokument) mit optionalen Media-Dateien (z.B. mp3).
- **Release**: Serverseitiger Container für Content in `media/releases/<release_id>/...`.
- **Draft**: Importiert, aber nicht veröffentlicht (`status='draft'`).
- **Published**: Aktiv veröffentlicht (`status='published'`); nur Published-Releases sind in der App sichtbar (zusätzlich zu Legacy/DEV-Daten ohne `release_id`).

### Technische Annahmen
- **Repo-only**: Keine Server-seitigen Änderungen außerhalb des Repos
- **Idempotenz**: Gleicher slug → Update, neuer slug → Insert (UPSERT-Logik)
- **Atomarität**: Publish setzt alte Releases automatisch auf `unpublished`
- **Soft-Delete bevorzugt**: `is_active=false` statt Hard-Delete (MVP)

---

## 3. Verbindliche technische Entscheidungen (Repo-verifiziert)

### 3.1 JSON Schema & Unit ID ✅

**Feldname:** `slug` (String, eindeutiger Identifier)  
**Natural Key:** Unit-ID = `slug` Feld im JSON  
**Format:** `[a-z0-9_]+` (lowercase, alphanumeric + underscore)  
**Verwendung:** UPSERT Key beim Import (gleicher slug → Update, neuer slug → Insert)

**Repo Evidence:**
- [`game_modules/quiz/validation.py:117`](../../game_modules/quiz/validation.py#L117) - `QuizUnitSchema` definiert `slug: str`
- [`docs/components/quiz/CONTENT.md:56`](../quiz/CONTENT.md#L56) - Dokumentiert: "slug: Eindeutiger Identifier (lowercase, [a-z0-9_]+)"
- [`game_modules/quiz/seed.py:346`](../../game_modules/quiz/seed.py#L346) - Import nutzt `unit.slug` als Primary Key für UPSERT
- [`game_modules/quiz/models.py:86`](../../game_modules/quiz/models.py#L86) - DB: `QuizTopic.id` (String(50), Primary Key)

**MVP Policy:**
- Upload-JSON MUSS `slug` Feld enthalten
- Validierung prüft: vorhanden, nicht leer, lowercase, nur `[a-z0-9_]`
- Fehlende `slug` → Upload rejected mit Fehler: "Missing required field: slug"

---

### 3.2 DB Models & Felder ✅

#### QuizTopic (quiz_topics table)
```python
id: String(50), Primary Key              # = slug aus JSON
title_key: String(100)                   # Anzeige-Titel (Plaintext, kein i18n)
description_key: String(100), nullable   # Beschreibung
authors: ARRAY(String), nullable         # ["AB", "CD"]
based_on: JSONB, nullable                # Source reference
is_active: Boolean, default=True         # ✅ Admin-steuerbar
order_index: Integer, default=0          # ✅ Admin-steuerbar (Reihenfolge)
release_id: String(50), nullable         # Tracking für Releases
created_at: DateTime(timezone=True)
```

#### QuizQuestion (quiz_questions table)
```python
id: String(100), Primary Key             # z.B. "topic_slug_q_<ULID>"
topic_id: String(50), ForeignKey         # → quiz_topics.id
difficulty: Integer                      # 1-5
type: String(20), default="single_choice"
prompt_key: String(100)                  # Frage-Text (Plaintext)
explanation_key: String(100)             # Erklärung (Plaintext)
answers: JSONB                           # [{"id": "a1", "text": "...", "correct": true}]
media: JSONB, nullable                   # [{"type": "audio", "src": "/static/..."}]
sources: JSONB, nullable
meta: JSONB, nullable
is_active: Boolean, default=True         # Frage-Level active/inactive
release_id: String(50), nullable
created_at: DateTime(timezone=True)
```

#### QuizContentRelease (quiz_content_releases table)
```python
release_id: String(50), Primary Key      # z.B. "release_20260106_2200"
status: String(20), default="draft"      # draft | published | unpublished
imported_at: DateTime(timezone=True), nullable
units_path: Text, nullable               # Import-Pfad
audio_path: Text, nullable               # Import-Pfad
units_count: Integer, default=0
questions_count: Integer, default=0
audio_count: Integer, default=0
published_at: DateTime(timezone=True), nullable
unpublished_at: DateTime(timezone=True), nullable
created_at: DateTime(timezone=True)
updated_at: DateTime(timezone=True)
checksum_manifest: Text, nullable
```

**Repo Evidence:**
- [`game_modules/quiz/models.py:84-120`](../../game_modules/quiz/models.py#L84-L120) - QuizTopic + QuizQuestion Models
- [`game_modules/quiz/release_model.py:15-50`](../../game_modules/quiz/release_model.py#L15-L50) - QuizContentRelease Model
- [`migrations/0010_create_content_releases.sql`](../../migrations/0010_create_content_releases.sql) - Schema-Definition

**Was Admin-UI direkt patcht (ohne Re-Import):**
- `QuizTopic.is_active` (Boolean)
- `QuizTopic.order_index` (Integer)

**Was NICHT direkt geändert wird:**
- `release_id` (wird nur bei Import gesetzt)
- `created_at` (Audit)
- JSON-Inhalte (title, description, questions) → nur über Re-Import

---

### 3.3 Publish-Mechanik ✅

**Filter-Regel in App (Frontend sichtbar):**
- Topics mit `is_active=true` UND (`release_id IN (published releases)` ODER `release_id IS NULL`)
- Legacy-Support: `release_id=NULL` Topics bleiben sichtbar (DEV-Daten / vor Release-System)

**⚠️ Legacy Exit-Strategie:**
> Der `release_id IS NULL` Fallback ist ein **temporärer Legacy-Support** für:
> - DEV-Daten ohne Release-System
> - Content aus Seed-Scripten vor Einführung des Release-Trackings
>
> **Nach vollständiger Migration:**
> - Alle produktiven Units haben ein `release_id`
> - Filter kann auf `release_id IN (published releases)` vereinfacht werden
> - `OR release_id IS NULL` Klausel kann dann entfernt werden
> - Migration-Skript: `UPDATE quiz_topics SET is_active=false WHERE release_id IS NULL`

**Nur 1 Published Release gleichzeitig:**
- Publish setzt alle anderen Releases auf `status='unpublished'`
- Atomare Operation (Transaction)

**Repo Evidence:**
- [`game_modules/quiz/services.py:467`](../../game_modules/quiz/services.py#L467) - `get_active_topics()` implementiert Filter
- [`tests/test_quiz_release_filtering.py`](../../tests/test_quiz_release_filtering.py) - Tests für Visibility-Logik
- [`game_modules/quiz/import_service.py:481`](../../game_modules/quiz/import_service.py#L481) - Publish setzt old releases auf unpublished

---

### 3.4 Media-Handling & Audio-Referenzen ✅

#### File Storage Structure
**Erwartete Ordnerstruktur im Release:**
```
media/releases/<release_id>/
├── units/
│   ├── aussprache.json
│   └── orthographie.json
└── audio/
    ├── audio_01.mp3
    ├── audio_02.mp3
    └── ...
```

**Audio-Referenzen im JSON:**
- Media wird in `questions[].media[]` oder `questions[].answers[].media[]` referenziert
- Format: `{"type": "audio", "seed_src": "relative/path/to/file.mp3", "src": null}`
- `seed_src`: Pfad relativ zum JSON (zur Seed-Zeit)
- `src`: Finale URL (wird beim Import gesetzt, z.B. `/static/quiz-media/<slug>/...`)

**Repo Evidence:**
- [`game_modules/quiz/validation.py:62`](../../game_modules/quiz/validation.py#L62) - `UnitMediaSchema` definiert `seed_src` + `src`
- [`game_modules/quiz/seed.py:98-145`](../../game_modules/quiz/seed.py#L98-L145) - `copy_media_file()` verarbeitet Audio
- [`game_modules/quiz/seed.py:39`](../../game_modules/quiz/seed.py#L39) - `ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.ogg', '.wav'}`

#### SHA256 Hash Validation
**Verwendung:** Audio-Dateien werden per SHA256-Hash verifiziert
- Import berechnet Hash jeder Audio-Datei
- Stored in `QuizContentRelease.checksum_manifest` (JSON)
- Ermöglicht Deduplizierung und Integrität-Checks

**Repo Evidence:**
- [`game_modules/quiz/import_service.py:105-117`](../../game_modules/quiz/import_service.py#L105-L117) - `_compute_audio_hash()` Methode
- [`game_modules/quiz/seed.py:73`](../../game_modules/quiz/seed.py#L73) - `compute_file_hash()` für Media

#### Validation Rules
**Missing Media Policy (MVP):**
- Upload erlaubt, aber Warning anzeigen
- Import schlägt **nicht** fehl bei missing audio (nur Warning in Log)
- UI zeigt: "Referenced audio files not found: [list]"

**Später (hardening):**
- Optional: Strict Mode (Import fails bei missing media)
- Auto-Match: UI zeigt erwartete Dateinamen aus JSON

**Repo Evidence:**
- [`game_modules/quiz/import_service.py:240-270`](../../game_modules/quiz/import_service.py#L240-L270) - Audio validation im Import
- [`manage.py:113`](../../manage.py#L113) - `--dry-run` Flag für Validation ohne DB-Write

---

### 3.5 Service Integration (NICHT CLI!) ✅

#### ✅ EMPFOHLEN: Direkte Service-Integration
**NICHT subprocess/CLI aufrufen**, sondern **direkt Service-Funktionen** nutzen:

```python
from game_modules.quiz.import_service import QuizImportService
from src.app.extensions.sqlalchemy_ext import get_session

# Service initialisieren
service = QuizImportService()

# Import (mit Error Handling)
try:
    with get_session() as session:
        result = service.import_release(
            session=session,
            units_path=units_path,
            audio_path=audio_path,
            release_id=release_id,
            dry_run=False
        )
    
    if result.success:
        return {
            "ok": True,
            "units_imported": result.units_imported,
            "questions_imported": result.questions_imported,
            "warnings": result.warnings
        }
    else:
        return {
            "ok": False,
            "errors": result.errors
        }, 400
        
except Exception as e:
    return {"ok": False, "error": str(e)}, 500
```

**Repo Evidence:**
- [`manage.py:73-85`](../../manage.py#L73-L85) - CLI ruft direkt `service.import_release()` auf
- [`game_modules/quiz/import_service.py:172`](../../game_modules/quiz/import_service.py#L172) - Service-Signatur + Dokumentation
- [`tests/test_import_service.py`](../../tests/test_import_service.py) - Unit-Tests zeigen Service-Verwendung

---

### 3.6 Logs & Error Structure ✅

#### Logfile Location
**Pfad:** `data/import_logs/<timestamp>_<command>_<release_id>.log`  
**Format:** `[YYYY-MM-DD HH:MM:SS] LEVEL: message`  
**Auto-Created:** Service erstellt Verzeichnis automatisch

**Repo Evidence:**
- [`game_modules/quiz/import_service.py:81-103`](../../game_modules/quiz/import_service.py#L81-L103) - `_setup_log_file()` erstellt Logfiles
- [`data/import_logs/`](../../data/import_logs/) - Logfile-Verzeichnis

#### Structured Errors für UI
**ImportResult Dataclass:**
```python
@dataclass
class ImportResult:
    success: bool
    release_id: str
    units_imported: int = 0
    questions_imported: int = 0
    audio_files_processed: int = 0
    errors: List[str] = []            # ← Error messages
    warnings: List[str] = []          # ← Warning messages
    skipped: bool = False
    dry_run: bool = False
```

**Repo Evidence:**
- [`game_modules/quiz/import_service.py:35-55`](../../game_modules/quiz/import_service.py#L35-L55) - `ImportResult` + `PublishResult` dataclasses

---

### 3.7 Auth & Admin-Gating ✅

**Bestehende Auth-Struktur:**
- JWT-basierte Auth mit Role Enum
- Roles: `admin`, `editor`, `user`
- Middleware setzt `g.role` in jedem Request

**Route Protection Pattern:**
```python
from flask import Blueprint
from flask_jwt_extended import jwt_required
from src.app.auth import Role
from src.app.auth.decorators import require_role

blueprint = Blueprint("quiz_admin", __name__, url_prefix="/api/quiz-admin")

@blueprint.post("/upload-unit")
@jwt_required()                    # Schritt 1: JWT valid?
@require_role(Role.ADMIN)         # Schritt 2: Admin-Role?
def upload_unit():
    pass
```

**Repo Evidence:**
- [`src/app/auth/__init__.py:1-14`](../../src/app/auth/__init__.py#L1-L14) - `Role` Enum
- [`src/app/auth/decorators.py:1-32`](../../src/app/auth/decorators.py) - `@require_role(Role.ADMIN)`
- [`templates/partials/_navigation_drawer.html:243-258`](../../templates/partials/_navigation_drawer.html#L243-L258) - Admin-only Menu

---

## 4. Admin-Funktionen (fachlich)

### 4.1 Upload einer Unit

**Was passiert:**
1. Admin wählt 1 JSON-Datei (required) + 0-n Audio-Dateien (optional)
2. Client validiert JSON lokal (slug vorhanden, Schema-konform)
3. Upload → Server generiert `release_id` (siehe Format unten)
4. Server speichert:
   - JSON → `media/releases/<release_id>/units/<slug>.json`
   - Audio → `media/releases/<release_id>/audio/*.mp3`
5. Server extrahiert Audio-Refs aus JSON, vergleicht mit hochgeladenen Files
6. Response: release_id, detected_refs, uploaded_files, missing_files

#### Release-ID Format (Kollisionsvermeidung)
**Format:** `release_YYYYMMDD_HHMMSS_<suffix>`  
**Suffix:** 4-stelliger alphanumerischer Zufallswert (`[a-z0-9]{4}`)  
**Beispiele:**
- `release_20260107_1430_a7x2`
- `release_20260107_1430_9bkm`

**Implementierung:**
```python
import secrets
from datetime import datetime

def generate_release_id() -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = secrets.token_hex(2)  # 4 hex chars
    return f"release_{timestamp}_{suffix}"
```

**Rationale:**
- Timestamp allein kann bei schnellen Uploads (< 1s Abstand) kollidieren
- 4-char Suffix: 65536 mögliche Kombinationen pro Sekunde
- Lesbarkeit bleibt erhalten (Datum erkennbar)

**Warum Einzel-Unit Upload?**
- Eindeutige Zuordnung JSON ↔ Media
- Weniger Fehler durch unvollständige Bundles
- UI kann sofort validieren und fehlende Media anzeigen

---

### 4.2 Release-Handling

#### Import (Draft)
**Aktion:** `POST /api/quiz-admin/releases/<release_id>/import`  
**Was passiert:**
- Ruft `service.import_release()` direkt auf (NICHT CLI subprocess)
- UPSERT Logic: gleicher slug → Update, neuer slug → Insert
- Setzt `QuizTopic.release_id`, `QuizQuestion.release_id`
- Status: `draft` (noch nicht sichtbar in App)

#### Publish
**Aktion:** `POST /api/quiz-admin/releases/<release_id>/publish`  
**Was passiert:**
- Atomare Transaction:
  - Setzt alle anderen Releases auf `status='unpublished'`
  - Setzt gewähltes Release auf `status='published'`
- Units mit diesem `release_id` werden jetzt sichtbar in App

#### Unpublish (optional MVP)
**Aktion:** `POST /api/quiz-admin/releases/<release_id>/unpublish`  
**Was passiert:**
- Setzt Release auf `status='unpublished'`
- Units mit diesem `release_id` werden unsichtbar in App

---

### 4.3 Unit-Verwaltung (DB Patches)

#### Aktiv/Deaktiv + Reihenfolge
**Was Admin ändern kann (OHNE Re-Import):**
- `is_active`: Boolean Checkbox (pro Unit)
- `order_index`: Number Input (Sortierung in App)

**Bulk Update:**
```json
{
    "updates": [
        {"slug": "aussprache", "is_active": false},
        {"slug": "orthographie", "order_index": 5}
    ]
}
```

#### Delete (Soft-Delete MVP)
**Aktion:** `DELETE /api/quiz-admin/units/<slug>`  
**Was passiert:**
- MVP: set `is_active=false` (Soft-Delete)
- UI Confirmation: "Unit X wirklich löschen? (Soft-Delete: is_active=false)"

**⚠️ Soft-Delete Semantik bei Re-Import:**
> Wenn eine Unit per Soft-Delete deaktiviert wurde (`is_active=false`),
> bleibt sie **auch nach einem Re-Import deaktiviert**.
>
> **Import-Verhalten:**
> - UPSERT prüft: `is_active` bereits vorhanden?
> - Falls `is_active=false` (manuell gesetzt): **nicht überschreiben**
> - Falls `is_active=true` oder neuer Eintrag: normal setzen
>
> **Rationale:**
> - Admin-Entscheidung hat Vorrang vor Import
> - Verhindert versehentliches Reaktivieren deaktivierter Units
> - Explizite Reaktivierung nur über UI möglich
>
> **Reaktivierung:**
> - Admin muss `is_active` manuell auf `true` setzen
> - Dann kann Re-Import die Unit aktualisieren

---

## 5. UI / Layout / Style-Vorschlag

> **Design-Prinzipien:**  
> 1. **Konsistenz:** Wiederverwendung vorhandener Admin-UI-Patterns  
> 2. **MD3-Konformität:** Strikte Nutzung von `--md-sys-color-*` Tokens  
> 3. **Erweiterbarkeit:** Klare Trennung MVP vs. Platzhalter  
> 4. **Accessibility:** ARIA-Labels, keyboard navigation

---

### 5.1 Seitenaufbau (Wireframe)

**Pattern:** Folgt [`page_admin_skeleton.html`](../../templates/_md3_skeletons/page_admin_skeleton.html)

**Konzeptionelle Trennung:**
> Die UI gliedert sich in zwei Bereiche mit unterschiedlicher Funktion:
>
> **A) Content Pipeline** (Sections 1 + 2)
> - Upload → Import → Publish
> - Ändert den **Content** (JSON, Media)
> - Schreibt in DB **und** Filesystem
> - Atomare Operationen (Transaction)
>
> **B) Runtime Configuration** (Section 3)
> - is_active, order_index
> - Ändert nur **DB-Metadaten**
> - Kein Re-Import nötig
> - Schnelle Anpassungen ohne Content-Änderung

```
┌────────────────────────────────────────────────────┐
│ Header: .md3-hero--card (Admin Quiz Content)      │
├────────────────────────────────────────────────────┤
│ Tabs: [Quiz Content] [Statistics (disabled)]      │
├────────────────────────────────────────────────────┤
│ ═══════════════ CONTENT PIPELINE ═══════════════ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Section 1: Upload Unit (.md3-card--outlined) │ │
│ │ - File inputs (JSON + Audio)                 │ │
│ │ - Preview (slug, title, media refs)          │ │
│ │ - Button: Save Upload                        │ │
│ └──────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Section 2: Release Actions                   │ │
│ │ - Select Release (Dropdown)                  │ │
│ │ - Status Badge (Draft/Published)             │ │
│ │ - Buttons: Import | Publish                  │ │
│ │ - Log Preview (expandable)                   │ │
│ └──────────────────────────────────────────────┘ │
│ ═══════════ RUNTIME CONFIGURATION ═════════════ │
│ ┌──────────────────────────────────────────────┐ │
│ │ Section 3: Units List                        │ │
│ │ - Search + Filter Chips                      │ │
│ │ - Table (slug, title, status, actions)       │ │
│ │ - Inline edit (is_active, order_index)       │ │
│ │ - Toolbar: Save Changes | Refresh            │ │
│ └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**Rationale:**
- **Vertical Stacking:** Einfacher zu scannen, responsive-friendly
- **Cards mit Outline:** Klare Trennung, weniger visuelles Gewicht
- **Tabs:** Ermöglicht Erweiterung (Statistics später)

---

### 5.2 Upload-Bereich (Section 1)

**Verwendete Komponenten:**
- `.md3-card--outlined` ([cards.css:39-48](../../static/css/md3/components/cards.css))
- `.form-field` ([forms.css:47-100](../../static/css/md3/components/forms.css))
- `.md3-button--filled` (Primary Upload Button)
- `.md3-info-card` (Preview Box mit erkanntem slug/title)
- `.md3-badge--small` + `--success/--warning` (Media Matching Status)

**Preview-Logik:**
- JSON wird client-side geparsed
- UI zeigt: `slug`, `title`, `questions.length`
- Audio-Refs werden extrahiert → Matching mit hochgeladenen Files
- Badge: ✓ grün (uploaded) / ⚠ orange (missing)

**Validation-Fehler:**
```html
<div class="md3-alert md3-alert--error" role="alert">
  <span class="material-symbols-rounded">error</span>
  <div class="md3-alert__content">
    <strong>JSON ungültig:</strong> Missing required field: slug
  </div>
</div>
```

**Rationale:**
- **Inline Preview:** Sofortiges Feedback, kein Modal
- **Media-Matching visuell:** Badges sind schnell erfassbar
- **Disabled Save Button:** Erst aktiv nach erfolgreicher Validierung

---

### 5.3 Release Actions (Section 2)

**Verwendete Komponenten:**
- `.md3-select` (Release Dropdown)
- `.md3-badge` Status-Varianten:
  - Draft: `--status-draft` (Warning-Farbe, orange)
  - Published: `--status-published` (Success-Farbe, grün)
  - Error: `--status-error` (Error-Farbe, rot)
- `.md3-button--tonal` (Import = Medium Emphasis)
- `.md3-button--filled` (Publish = High Emphasis)
- `<details>` (Expandable Log, native HTML)

**Button-Hierarchie:**
1. **Import:** Tonal (Medium) – wiederholbar, niedrigeres Risiko
2. **Publish:** Filled (High) – kritische Aktion, Primary
3. **Unpublish:** Outlined (Low) – Rollback, selten genutzt

**Publish-Button Warnung:**
```html
<div class="md3-helper-text md3-helper-text--warning">
  <span class="material-symbols-rounded">warning</span>
  Ersetzt den aktuell veröffentlichten Content.
</div>
```

**Status Badge CSS (NEU):**
```css
.md3-badge--status-draft {
  background: color-mix(in srgb, var(--md-sys-color-warning) 16%, transparent);
  color: var(--md-sys-color-on-warning-container);
}

.md3-badge--status-published {
  background: color-mix(in srgb, var(--md-sys-color-success) 16%, transparent);
  color: var(--md-sys-color-success);
}
```

**Rationale:**
- **Status Badges:** Visuell schnell erfassbar (Farbe + Icon)
- **Expandable Log:** Spart Platz, optional für Power-User
- **Inline Feedback:** Alerts bleiben im Kontext

---

### 5.4 Units-Liste (Section 3)

**Verwendete Komponenten:**
- `.md3-table` ([admin_users.html:56-75](../../templates/auth/admin_users.html) als Pattern)
- `.md3-filter-chips` (Draft/Published/Inactive Filter)
- `.md3-button--danger` (Delete Button)
- Inline Inputs: Checkboxen (`is_active`) + Number (`order_index`)

**Table Structure:**
| Spalte | Typ | Editierbar |
|--------|-----|------------|
| slug | readonly | ✗ |
| title | readonly | ✗ |
| status | badge | ✗ |
| is_active | checkbox | ✓ |
| order_index | number input | ✓ |
| updated_at | readonly | ✗ |
| actions | button | ✗ |

**Inactive Rows Styling:**
```css
.md3-table__row--inactive {
  opacity: 0.6;
  color: var(--md-sys-color-on-surface-variant);
}
```

**Delete Confirmation (MVP):**
```javascript
if (confirm(`Unit "${slug}" wirklich löschen? (Soft-Delete)`)) {
  // DELETE request
}
```

**Rationale:**
- **Inline Edit:** Schnellste UX, kein Modal nötig
- **Bulk Save:** Änderungen sammeln, 1× Save = weniger Requests
- **Delete = Danger:** Visuell klar als destruktive Aktion

---

### 5.5 Skeletons & Loading States

#### Page Load (Initial)
```html
<div class="md3-skeleton md3-skeleton--table">
  <div class="md3-skeleton__row"></div>
  <div class="md3-skeleton__row"></div>
</div>
```

#### Upload Processing (Button State)
```html
<button class="md3-button md3-button--filled" disabled aria-busy="true">
  <span class="material-symbols-rounded md3-spinner">progress_activity</span>
  Wird hochgeladen...
</button>
```

#### Import/Publish Running
```html
<div class="md3-loading-indicator" role="status" aria-live="polite">
  <span class="material-symbols-rounded">progress_activity</span>
  <span>Import läuft... (3/5 Units)</span>
</div>
```

**Rationale:**
- **Keine Custom Skeletons:** Bestehende Button-States reichen
- **Inline Feedback:** Loading-State bleibt im Kontext
- **Accessibility:** ARIA live regions für Screenreader

---

### 5.6 Tabs & Navigation

**Tab Structure:**
```html
<nav class="md3-tabs" role="tablist">
  <button role="tab" aria-selected="true" class="md3-tab md3-tab--active">
    <span class="material-symbols-rounded">quiz</span>
    Quiz Content
  </button>
  <button role="tab" class="md3-tab" disabled aria-disabled="true">
    <span class="material-symbols-rounded">bar_chart</span>
    Statistics
    <span class="md3-badge md3-badge--small md3-badge--info">Coming Soon</span>
  </button>
</nav>
```

**Rationale:**
- **Tabs statt Sidebar:** Weniger visuelles Gewicht
- **Disabled Tab sichtbar:** Zeigt geplante Features
- **ARIA-konform:** role, aria-selected, aria-controls

---

### 5.7 Responsive Verhalten

**Mobile Anpassungen (< 840px):**
```css
@media (max-width: 840px) {
  .md3-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  
  .md3-hide-mobile {
    display: none;
  }
  
  .md3-card {
    margin-inline: 0;
  }
}
```

**Rationale:**
- **Folgt bestehendem Pattern:** `.md3-hide-mobile` aus [admin_users.html](../../templates/auth/admin_users.html)
- **Touch-friendly:** Buttons min-height: 48px

---

## 6. UX-Begründungen

### 6.1 Warum Vertical Stacking statt Multi-Column?
**Begründung:**
- Klarheit: Ein Scroll-Pfad, einfacher zu scannen
- Responsive: Funktioniert auf kleineren Screens
- Konsistenz: Folgt bestehender Admin-Page

### 6.2 Warum Cards mit Outline statt Elevated?
**Begründung:**
- Weniger visuelles Gewicht (Elevation für Landing-Pages)
- Klarere Trennung (Outline-Border subtiler als Shadow)
- Konsistenz: Folgt admin_users.html Pattern

### 6.3 Warum Inline Edit statt Edit Modal?
**Begründung:**
- Geschwindigkeit: Kein Kontext-Wechsel
- Bulk Operations: Mehrere Units gleichzeitig änderbar
- Familiarität: Pattern aus Spreadsheet-UIs bekannt

### 6.4 Warum Status Badges statt nur Text?
**Begründung:**
- Visuelle Hierarchie: Farbe + Icon = schneller erfassbar
- MD3-konform: Verwendet bestehende Badge-Varianten
- Accessibility: Icon + Text (Redundanz für Farbenblinde)

### 6.5 Warum Expandable Log statt Modal?
**Begründung:**
- Kontexterhalt: Log bleibt auf Seite, kein Focus-Verlust
- Optional: Power-User können Log einsehen
- Native HTML: `<details>` benötigt kein JavaScript

---

## 7. Backend-Endpunkte (MVP)

### Upload Endpoint
**`POST /api/quiz-admin/upload-unit`**

**Request:** multipart/form-data
- `unit_json`: File (required)
- `media_files[]`: Files (optional, multiple)

**Response:**
```json
{
    "ok": true,
    "release_id": "release_20260107_1430",
    "slug": "aussprache",
    "detected_refs": ["audio_01.mp3"],
    "uploaded_files": ["audio_01.mp3"],
    "missing_files": []
}
```

### Release Actions
**`POST /api/quiz-admin/releases/<release_id>/import`**
- Calls: `service.import_release()`
- Returns: `ImportResult` as JSON

**`POST /api/quiz-admin/releases/<release_id>/publish`**
- Calls: `service.publish_release()`
- Returns: `PublishResult` as JSON

**`GET /api/quiz-admin/releases`**
- Calls: `service.list_releases()`
- Returns: List of releases with metadata

### Units CRUD
**`GET /api/quiz-admin/units`**
- Query params: `search`, `status_filter`, `include_inactive`
- Returns: List of units with metadata

**`PATCH /api/quiz-admin/units`**
- Body: `{"updates": [{"slug": "x", "is_active": false}]}`
- Returns: `{"ok": true, "updated_count": N}`

**`DELETE /api/quiz-admin/units/<slug>`**
- MVP: Soft-delete (`is_active=false`)
- Returns: `{"ok": true}`

---

## 8. Nicht-Ziele & spätere Erweiterungen

### Bewusst NICHT im MVP

1. **Drag & Drop für Reihenfolge**
   - MVP: Number Input
   - Später: Drag-Handle + Sortable.js

2. **Advanced Filtering**
   - MVP: Simple Chips (Draft/Published/Inactive)
   - Später: Filter-Dialog mit Date Range, Author, etc.

3. **Bulk Actions**
   - MVP: Einzelne Delete-Buttons
   - Später: Checkboxen + Bulk-Delete

4. **Live Import Progress**
   - MVP: Loading-Spinner + Poll
   - Später: Server-Sent Events

5. **Log Syntax Highlighting**
   - MVP: Plain `<pre>` Text
   - Später: Farbige Error-Zeilen

6. **Unit Preview**
   - MVP: Keine JSON-Vorschau
   - Später: Expandable Row mit Monaco Editor

### Erweiterungsstrategie

**Statistics Tab:**
- Bereits vorbereitet (disabled)
- Aktivierung: `disabled` Attribut entfernen

**Zusätzliche Sections:**
- Neue Cards unter Section 3 anhängen
- Vertical Stack bleibt stabil

**Inline Actions erweitern:**
- Dropdown-Menü statt einzelner Buttons (Platz sparend)

---

## 9. Fehlende Komponenten (neu erstellen)

**Diese UI-Elemente existieren noch NICHT und müssen ergänzt werden:**

1. **`.md3-media-ref`** (Media Matching Status)
   - Layout: Flex, Icon links, Badge rechts
   - CSS: `display: flex; gap: var(--space-2);`

2. **`.md3-release-status`** (Release Meta Display)
   - Header mit Release-ID + Badge
   - Meta-Zeile mit Counts

3. **`.md3-log-viewer`** (Expandable Log)
   - `<details>` Wrapper
   - `<pre>` mit Monospace-Font
   - CSS: `max-height: 400px; overflow-y: auto;`

4. **`.md3-input--small`** (Compact Number Input)
   - Width: `60px`
   - Font-size: `0.875rem`

5. **`.md3-action-result`** (Feedback Container)
   - Wrapper für Success/Error Alerts
   - CSS: `margin-block: var(--space-4);`

---

## 10. Accessibility Checkliste

**Sicherstellen:**
- ✅ Alle interaktiven Elemente haben `aria-label`
- ✅ Buttons mit Icon + Text (keine Icon-Only ohne Label)
- ✅ `role="status"` + `aria-live="polite"` für dynamische Updates
- ✅ `disabled` Buttons haben `aria-disabled="true"`
- ✅ Tables haben `<thead>` mit `<th>`
- ✅ Form Fields haben `<label>` mit `for`
- ✅ Tabs haben `role="tablist/tab/tabpanel"`
- ✅ Checkboxen haben individuelle `aria-label`

---

## 11. Implementierungsfahrplan

### Phase A: Repo-only MVP
1. ✅ Blueprint + Routes (`src/app/routes/quiz_admin.py`)
2. ✅ Upload Handler (file storage + release_id generation)
3. ✅ Template (`templates/admin/quiz_content.html`)
4. ✅ JavaScript (`static/js/admin/quiz_content.js`)
5. ✅ Release Actions (Service-Integration)
6. ✅ Units Bulk Update (PATCH endpoint)
7. ✅ Log Viewer (tail endpoint)

### Phase B: Server Integration
- Nginx paths für admin assets
- Media write permissions
- Logs retention

---

## 12. Akzeptanzkriterien (MVP)

- [ ] Admin kann 1 Unit JSON + mp3 hochladen
- [ ] System erzeugt Release-ID automatisch
- [ ] Admin kann Import (Draft) auslösen, sieht Fehler/Logs
- [ ] Admin kann Publish auslösen → Unit erscheint in App
- [ ] Admin kann Units aktiv/inaktiv + Reihenfolge ändern
- [ ] Stats-Tab existiert als Platzhalter
- [ ] Alle Admin-Routen per `@require_role(Role.ADMIN)` geschützt
- [ ] Navigation Drawer zeigt "Quiz Content" nur für Admins

---

## 13. Repo Evidence (Quellenangaben)

**Vollständige Referenzen in Section 3 (Technische Entscheidungen)**

Wichtigste Dateien:
- [`game_modules/quiz/validation.py`](../../game_modules/quiz/validation.py) - Schema-Definitionen
- [`game_modules/quiz/models.py`](../../game_modules/quiz/models.py) - DB Models
- [`game_modules/quiz/import_service.py`](../../game_modules/quiz/import_service.py) - Service-Logik
- [`templates/auth/admin_users.html`](../../templates/auth/admin_users.html) - UI-Pattern-Referenz
- [`static/css/md3/components/`](../../static/css/md3/components/) - MD3-Komponenten

---

## 14. Offene Punkte

**Keine offenen technischen Fragen mehr** – alle Details aus Repo geklärt.

Bei Implementierung neue Fragen:
1. Prüfe Repo Evidence (Section 3)
2. Lese referenzierte Dateien (mit Zeilennummern)
3. Teste mit Unit-Tests (`tests/test_import_service.py`)

---

**Ende des konsolidierten Admin Upload Plans. Bereit für UI-Review und Implementierung.**
