# Admin Upload Plan (Quiz Content) – REPO-VERIFIED

## Ziel
Ein Admin-Dashboard soll Quiz-Content **unit-weise** verwalten. Admin lädt **immer genau 1 Quiz-Unit pro Upload** hoch (1 JSON + dazugehörige Media-Dateien). Das Dashboard speichert serverseitig weiterhin in der bestehenden Production-Ordnerlogik (**Release-Ordner + Import/Publish**), so dass der aktuelle Production-Workflow erhalten bleibt.

Nicht-Ziele (später):
- Nutzer-Statistiken / Analytics (aber UI-Platzhalter/Tab wird vorgesehen)
- Bulk-Upload mehrerer Units in einem Schritt
- Automatisches Publish ohne expliziten Admin-Klick

---

## Begriffe
- **Unit**: Eine Quiz-Unit (ein JSON-Dokument) mit optionalen Media-Dateien (z.B. mp3).
- **Release**: Serverseitiger Container für Content in `media/releases/<release_id>/...`.
- **Draft**: Importiert, aber nicht veröffentlicht (status='draft').
- **Published**: Aktiv veröffentlicht (status='published'); nur Published-Releases sind in der App sichtbar (zusätzlich zu Legacy/DEV-Daten ohne release_id, falls diese in prod noch erlaubt sind).

---

## Repo Evidence: Technische Grundlagen

### 1. JSON Schema & Unit ID (✅ GEKLÄRT)

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

### 2. DB Models & Felder (✅ GEKLÄRT)

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

**Admin-UI Patcht Direkt (ohne Re-Import):**
- `QuizTopic.is_active` (Boolean)
- `QuizTopic.order_index` (Integer)

**NICHT Direkt Ändern:**
- `release_id` (wird nur bei Import gesetzt)
- `created_at` (Audit)
- JSON-Inhalte (title, description, questions) → nur über Re-Import

---

### 3. Publish-Mechanik (✅ GEKLÄRT)

**Filter-Regel in App (Frontend sichtbar):**
- Topics mit `is_active=true` UND (`release_id IN (published releases)` ODER `release_id IS NULL`)
- Legacy-Support: `release_id=NULL` Topics bleiben sichtbar (DEV-Daten / vor Release-System)

**Nur 1 Published Release gleichzeitig:**
- Publish setzt alle anderen Releases auf `status='unpublished'`
- Atomare Operation (Transaction)

**Repo Evidence:**
- [`game_modules/quiz/services.py:467`](../../game_modules/quiz/services.py#L467) - `get_active_topics()` implementiert Filter
- [`tests/test_quiz_release_filtering.py`](../../tests/test_quiz_release_filtering.py) - Tests für Visibility-Logik
- [`game_modules/quiz/import_service.py:481`](../../game_modules/quiz/import_service.py#L481) - Publish setzt old releases auf unpublished

---

### 4. Media-Handling & Audio-Referenzen (✅ GEKLÄRT)

#### File Storage Expectations
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

### 5. CLI/Service Integration (✅ GEKLÄRT)

#### Bestehende manage.py Commands
```bash
python manage.py import-content --units-path <path> --audio-path <path> --release <id> [--dry-run]
python manage.py publish-release --release <id>
python manage.py unpublish-release --release <id>
python manage.py list-releases
```

**Exit Codes:**
- 0 = success
- 2 = validation error
- 3 = filesystem error (path not found)
- 4 = database error

**Repo Evidence:**
- [`manage.py:1-255`](../../manage.py) - Vollständige CLI-Implementierung
- [`manage.py:53-116`](../../manage.py#L53-L116) - `import-content` Command

#### Service Integration (✅ EMPFOHLEN für Dashboard)
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

# Publish
with get_session() as session:
    result = service.publish_release(session=session, release_id=release_id)

# List Releases
with get_session() as session:
    releases = service.list_releases(session)
    # Returns: [{"release_id": "...", "status": "...", "units_count": N, ...}]
```

**Repo Evidence:**
- [`manage.py:73-85`](../../manage.py#L73-L85) - CLI ruft direkt `service.import_release()` auf
- [`game_modules/quiz/import_service.py:172`](../../game_modules/quiz/import_service.py#L172) - Service-Signatur + Dokumentation
- [`tests/test_import_service.py`](../../tests/test_import_service.py) - Unit-Tests zeigen Service-Verwendung

---

### 6. Logs & Error Structure (✅ GEKLÄRT)

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

**Example UI Payload:**
```json
{
    "success": false,
    "release_id": "release_20260106_2200",
    "units_imported": 2,
    "questions_imported": 20,
    "errors": [
        "Unit aussprache.json: Missing required field 'slug'",
        "Audio file nicht_vorhanden.mp3 referenced but not found"
    ],
    "warnings": [
        "Unit orthographie.json: No audio files referenced"
    ],
    "log_file": "data/import_logs/20260107_1430_import_release_20260106_2200.log"
}
```

---

### 7. Auth/Admin-Gating (✅ GEKLÄRT)

#### Admin-Erkennung
**Bestehende Auth-Struktur:**
- JWT-basierte Auth mit Role Enum
- Roles: `admin`, `editor`, `user`
- Middleware setzt `g.role` in jedem Request

**Repo Evidence:**
- [`src/app/auth/__init__.py:1-14`](../../src/app/auth/__init__.py#L1-L14) - `Role` Enum: `ADMIN`, `EDITOR`, `USER`
- [`src/app/auth/decorators.py:1-32`](../../src/app/auth/decorators.py) - `@require_role(Role.ADMIN)` Decorator
- [`src/app/__init__.py:193-240`](../../src/app/__init__.py#L193-L240) - `register_auth_context()` setzt `g.role`

#### Route Protection Pattern (✅ EMPFOHLEN)
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
    # ... nur für Admins erreichbar
    pass
```

#### Template/UI Protection
```jinja2
{# In Navigation Drawer / Menu #}
{% if role_value == 'admin' %}
  <a href="{{ url_for('quiz_admin.quiz_content_page') }}">
    <span class="md3-navigation-drawer__label">Quiz Content</span>
  </a>
{% endif %}
```

**Repo Evidence:**
- [`src/app/routes/admin.py`](../../src/app/routes/admin.py) - Beispiel: Admin-API-Blueprint mit `@require_role(Role.ADMIN)`
- [`templates/partials/_navigation_drawer.html:243-258`](../../templates/partials/_navigation_drawer.html#L243-L258) - Admin-only Menu Items
- [`src/app/routes/auth.py:252-255`](../../src/app/routes/auth.py#L252-L255) - Admin-Page Route: `@jwt_required() + @require_role(Role.ADMIN)`

---

### 8. UI/Routes Struktur (✅ GEKLÄRT)

#### Bestehende Admin-Seiten
**Aktuell vorhanden:**
- **User Management:** `/auth/admin_users` (Page + API `/api/admin/users`)
- **Templates:** `templates/auth/admin_users.html`
- **JavaScript:** `static/js/auth/admin_users.js`

**Repo Evidence:**
- [`templates/auth/admin_users.html`](../../templates/auth/admin_users.html) - Admin UI Template
- [`static/js/auth/admin_users.js`](../../static/js/auth/admin_users.js) - Admin UI JavaScript
- [`src/app/routes/auth.py:252-255`](../../src/app/routes/auth.py#L252-L255) - Route: `@blueprint.get("/admin_users")`

#### Navigation Integration
**Admin-Menü in Navigation Drawer:**
```jinja2
{# templates/partials/_navigation_drawer.html #}
{% if role_value == 'admin' %}
  <a href="{{ url_for('auth.admin_users_page') }}" ...>
    <span class="material-symbols-rounded">group</span>
    <span>Benutzer</span>
  </a>
  {# HIER EINFÜGEN: Quiz Content Link #}
{% endif %}
```

**Repo Evidence:**
- [`templates/partials/_navigation_drawer.html:243-258`](../../templates/partials/_navigation_drawer.html#L243-L258) - Admin-Bereich im Drawer
- [`templates/partials/_top_app_bar.html:81-102`](../../templates/partials/_top_app_bar.html#L81-L102) - User Menu mit Admin-Links

#### Blueprint Registration
**Bestehende Struktur:**
```python
# src/app/routes/__init__.py
BLUEPRINTS = [
    public.blueprint,
    auth.blueprint,
    admin.blueprint,        # ← Admin-API
    quiz_blueprint,         # ← Quiz Game
]
```

**Repo Evidence:**
- [`src/app/routes/__init__.py`](../../src/app/routes/__init__.py) - Blueprint-Registrierung

---

## Admin UI: Navigation und Seiten (MVP)

### Admin Navigation (Empfehlung)
**Erweiterung bestehender Admin-Sektion:**
```
Admin (role='admin' only)
├── Benutzer (/auth/admin_users)           ← bereits vorhanden
├── Quiz Content (/admin/quiz/content)     ← NEU (MVP)
└── Statistics (/admin/stats)              ← Platzhalter (später)
```

### Admin → Quiz Content: Bereiche

#### 1) Upload Unit
**Route:** `GET /admin/quiz/content`  
**UI-Elemente:**
- File Input: JSON Upload (required, accept=".json")
- File Input: Media Upload (optional, multiple, accept=".mp3,.ogg,.wav")
- Preview: JSON-Info (slug, title, question count)
- Preview: Media-Refs aus JSON + Matching-Status (✓ uploaded / ✗ missing)
- Button: **Save Upload** → `POST /api/quiz-admin/upload-unit`

#### 2) Release Actions
**UI-Elemente:**
- Dropdown: Release auswählen (aus `service.list_releases()`)
- Release Info: status (draft/published), units_count, questions_count, timestamps
- Buttons:
  - **Import (Draft)** → `POST /api/quiz-admin/releases/<id>/import`
  - **Publish** → `POST /api/quiz-admin/releases/<id>/publish`
  - **Unpublish** (optional MVP) → `POST /api/quiz-admin/releases/<id>/unpublish`
- Statusanzeige: Import/Publish Success/Error Messages
- Log Preview: Tail of `data/import_logs/<latest>.log` (last 50 lines)

#### 3) Units List
**Route:** Bereits in `/admin/quiz/content` integriert  
**UI-Elemente:**
- Table Columns:
  - `slug` (Primary Key)
  - `title` (Anzeige)
  - `status` (draft/published, abgeleitet von release_id)
  - `is_active` (Checkbox, inline edit)
  - `order_index` (Number Input, inline edit)
  - `updated_at` (readonly)
  - `release_id` (readonly)
  - Actions: **Delete** Button (soft-delete)
- Filter/Search:
  - Text Input: Search by slug/title
  - Dropdown: Filter by status (all/draft/published)
  - Checkbox: Show inactive
- Button: **Save Changes** (bulk update) → `PATCH /api/quiz-admin/units`

---

## Backend: Endpunkte / Services (MVP)

### AuthZ
Alle Endpoints: `@jwt_required() + @require_role(Role.ADMIN)`

### 1. Upload Endpoint
**`POST /api/quiz-admin/upload-unit`**

**Request:** `multipart/form-data`
- `unit_json`: File (required)
- `media_files[]`: Files (optional, multiple)

**Response:**
```json
{
    "ok": true,
    "release_id": "release_20260107_1430",
    "slug": "aussprache",
    "units_path": "media/releases/release_20260107_1430/units",
    "audio_path": "media/releases/release_20260107_1430/audio",
    "detected_refs": ["audio_01.mp3", "audio_02.mp3"],
    "uploaded_files": ["audio_01.mp3"],
    "missing_files": ["audio_02.mp3"]
}
```

**Implementierung:**
1. Generiere `release_id` (timestamp: `release_YYYYMMDD_HHMMSS`)
2. Parse JSON, validiere `slug` vorhanden
3. Erstelle `media/releases/<release_id>/units/` + `audio/`
4. Speichere JSON als `<slug>.json`
5. Speichere Media-Files in `audio/`
6. Extrahiere Media-Refs aus JSON (parse `questions[].media[].seed_src`)
7. Return matching status

### 2. Release Actions

**`POST /api/quiz-admin/releases/<release_id>/import`**
- Calls: `service.import_release(session, units_path, audio_path, release_id)`
- Response: `ImportResult` as JSON

**`POST /api/quiz-admin/releases/<release_id>/publish`**
- Calls: `service.publish_release(session, release_id)`
- Response: `PublishResult` as JSON

**`POST /api/quiz-admin/releases/<release_id>/unpublish`** (optional MVP)
- Calls: `service.unpublish_release(session, release_id)`
- Response: `PublishResult` as JSON

**`GET /api/quiz-admin/releases`**
- Calls: `service.list_releases(session)`
- Response: `[{"release_id": "...", "status": "...", ...}]`

### 3. Units CRUD-lite (DB only)

**`GET /api/quiz-admin/units`**
- Query params: `search`, `status_filter`, `include_inactive`
- Returns: `[{"slug": "...", "title": "...", "is_active": true, "order_index": 0, ...}]`

**`PATCH /api/quiz-admin/units`**
- Body: `{"updates": [{"slug": "a", "is_active": false}, {"slug": "b", "order_index": 5}]}`
- Bulk update: iteriere über `updates`, führe `session.query(QuizTopic).filter().update()` aus
- Response: `{"ok": true, "updated_count": 2}`

**`DELETE /api/quiz-admin/units/<slug>`** (soft-delete)
- Body: none (oder `{"hard_delete": false}`)
- MVP: set `is_active=false`
- Optional: hard-delete mit `session.delete(topic)` (CASCADE löscht Questions)
- Response: `{"ok": true}`

---

## Error Handling & UX

### Upload
- JSON parse error → inline message: "Invalid JSON: <error>"
- Validation error → field-level list: "Missing required field: slug"
- Missing media → list (Upload gespeichert, aber Warning): "Referenced but not uploaded: [list]"

### Import
- Summary: "Units imported: N, updated: M, skipped: K"
- Errors (first 10): "aussprache.json: Missing field 'slug'"
- Link/Preview: Logfile tail (last 50 lines)

### Publish
- Confirmation Modal: "Publish release X? (Will unpublish current release)"
- Success: "Release X published, Y units now active"

### Save Changes (Units List)
- Success: "Updated N units"
- Conflict (optional later): Optimistic lock warning

---

## Minimaler Implementierungsfahrplan (Repo-only → Server später)

### Phase A (Repo-only, MVP)
1. ✅ **Blueprint + Routes:** Create `src/app/routes/quiz_admin.py` mit Auth-Guards
2. ✅ **Upload Handler:** Implement `POST /upload-unit` (file storage + release_id generation)
3. ✅ **Template:** `templates/admin/quiz_content.html` (Upload Form + Release Panel + Units List)
4. ✅ **JavaScript:** `static/js/admin/quiz_content.js` (File Upload + AJAX API calls)
5. ✅ **Release Actions:** Implement Import/Publish Buttons (call Service)
6. ✅ **Units Bulk Update:** Implement PATCH endpoint für is_active + order_index
7. ✅ **Log Viewer:** Implement GET endpoint für Logfile tail

### Phase B (Server integration)
- Nginx/static paths für admin assets (falls nötig)
- Media write permissions (release dirs)
- Observability: logs retention

---

## Akzeptanzkriterien (MVP)

- [ ] Admin kann 1 Unit JSON + dazugehörige mp3 hochladen
- [ ] System erzeugt Release-ID automatisch und speichert in `media/releases/<id>/...`
- [ ] Admin kann Import (Draft) auslösen und sieht Fehler/Logs im UI
- [ ] Admin kann Publish auslösen → Unit erscheint in der App
- [ ] Admin kann Units in Liste aktiv/deaktiv und Reihenfolge ändern → Save schreibt DB
- [ ] Stats-Tab existiert als Platzhalter ("Coming Soon")
- [ ] Alle Admin-Routen sind per `@require_role(Role.ADMIN)` geschützt
- [ ] Navigation Drawer zeigt "Quiz Content" Link nur für Admins

---

## Offene Fragen (OPEN QUESTIONS)

**Keine offenen Fragen mehr** – alle technischen Details aus Repo geklärt.

Falls bei Implementierung neue Fragen auftauchen:
1. Prüfe Repo Evidence Sections oben
2. Lese referenzierte Dateien (mit Zeilennummern)
3. Teste mit bestehenden Unit-Tests (`tests/test_import_service.py`)

---

## Appendix: Hilfreiche Kommandos

### Testen der Service-Integration (lokal)
```python
# In Python REPL oder Script
from game_modules.quiz.import_service import QuizImportService
from src.app.extensions.sqlalchemy_ext import get_session

service = QuizImportService()

# List releases
with get_session() as session:
    releases = service.list_releases(session)
    print(releases)

# Dry-run Import
with get_session() as session:
    result = service.import_release(
        session,
        "content/quiz_releases/release_20260106_2200/units",
        "content/quiz_releases/release_20260106_2200/audio",
        "release_20260106_2200",
        dry_run=True
    )
    print(result)
```

### Log-Analyse
```bash
# Zeige letzte Import-Logs
ls -lt data/import_logs/ | head -5

# Tail eines Logfiles
tail -50 data/import_logs/<logfile>.log
```

### DB-Direktabfrage (Testing)
```python
from game_modules.quiz.models import QuizTopic
from src.app.extensions.sqlalchemy_ext import get_session

with get_session() as session:
    topics = session.query(QuizTopic).filter(QuizTopic.is_active == True).all()
    for t in topics:
        print(f"{t.id}: {t.title_key} (order: {t.order_index}, release: {t.release_id})")
```
