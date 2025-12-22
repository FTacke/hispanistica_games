# Admin Auth Audit Report — hispanistica_games

**Date:** 2025-12-20  
**Status:** CRITICAL — Admin Features komplett nicht verdrahtet  
**Engineer:** Senior Full-Stack Analysis

---

## Executive Summary

**Hauptproblem:** Die Admin-UI für User-Management ist vollständig implementiert (Templates, JavaScript), aber **alle API-Endpoints fehlen komplett**. Das Frontend sendet Requests an nicht existierende Routes → 404-Fehler.

**Betroffene Funktionen:**
- ✅ Passwort ändern (funktioniert — `/auth/change-password` existiert)
- ❌ Benutzer anlegen (kein Backend)
- ❌ Benutzer auflisten (kein Backend)
- ❌ Benutzer bearbeiten (kein Backend)
- ❌ Passwort zurücksetzen (Admin) (kein Backend)

---

## 1. Architektur-Iststand

### 1.1 Runtime & Stack
- **Framework:** Flask 3.1.2 (Python 3.12+)
- **Entry Point:** `src/app/main.py` → `create_app()` in `src/app/__init__.py`
- **Dev Server:** `python -m src.app.main` (Port 8000)
- **Auth Backend:** SQLAlchemy 2.0.43 + DB-backed (Postgres oder SQLite)

### 1.2 Route-Definitionen
Routes sind in **Blueprints** organisiert:
- `src/app/routes/auth.py` → Blueprint `"auth"`, prefix `/auth`
- `src/app/routes/public.py` → Blueprint `"public"`, prefix `/`

**Registrierung:** In `src/app/__init__.py` via `register_blueprints()`

### 1.3 DB Models & Migrations
- **Models:** `src/app/auth/models.py`
  - `User` (ORM Model via SQLAlchemy DeclarativeBase)
  - `RefreshToken`, `ResetToken`
- **User Felder:**
  ```python
  id: str (UUID)
  username: str (unique, required)
  email: str (unique, optional)
  password_hash: str
  role: str (admin/editor/user)
  is_active: bool
  must_reset_password: bool
  created_at, updated_at, last_login_at: datetime
  login_failed_count: int
  locked_until: datetime (optional)
  deleted_at, deletion_requested_at: datetime (optional)
  ```

- **Migrations:** KEINE Alembic-Konfiguration gefunden
  - Models werden via `Base.metadata.create_all()` erstellt (siehe `create_initial_admin.py`)
  - Tabellen müssen manuell initialisiert werden

### 1.4 DB-Connector Konfiguration
- **Config:** `src/app/config/__init__.py`
  ```python
  AUTH_DATABASE_URL = os.getenv(
      "AUTH_DATABASE_URL",
      f"sqlite:///{PROJECT_ROOT}/data/db/auth.db"
  )
  ```
- **Engine Init:** `src/app/extensions/sqlalchemy_ext.py`
  - `init_engine(app)` erstellt SQLAlchemy Engine
  - `get_session()` Context Manager für Transaktionen
  - Engine wird in `create_app()` initialisiert

- **DB Datei:** `c:\dev\hispanistica_games\data\db\auth.db` (existiert bereits)

### 1.5 Admin Bootstrap
- **Script:** `scripts/create_initial_admin.py`
- **Usage:**
  ```powershell
  $env:START_ADMIN_USERNAME='admin'; $env:START_ADMIN_PASSWORD='SecurePass123'; python scripts/create_initial_admin.py
  ```
- **Funktionalität:**
  - Erstellt Tables (falls nicht vorhanden)
  - Erstellt/Updated Admin-User mit role='admin'
  - Hasht Passwort mit Argon2 (fallback Bcrypt)

---

## 2. Auth Mechanik

### 2.1 Session/JWT
- **Mechanismus:** JWT (JSON Web Tokens) via `flask-jwt-extended`
- **Token Types:**
  - **Access Token:** Cookie `access_token_cookie` (15min default via `ACCESS_TOKEN_EXP=900`)
  - **Refresh Token:** Opaque Token in Cookie `refreshToken` (7 days default)
- **CSRF Protection:** JWT_COOKIE_CSRF_PROTECT=True (Prod), False (Dev)
- **Cookie Paths:**
  - Access: `/` (alle Routen)
  - Refresh: `/auth/refresh`

### 2.2 Existierende Auth-Endpoints

#### ✅ Login/Logout
| Methode | Route | Funktion | Status |
|---------|-------|----------|--------|
| GET | `/auth/login` | Login-Seite | ✅ Funktioniert |
| POST | `/auth/login` | Login-Handler (DB-backed) | ✅ Funktioniert |
| GET/POST | `/auth/logout` | Logout (Cookie löschen) | ✅ Funktioniert |
| POST | `/auth/refresh` | Token Rotation | ✅ Funktioniert |
| GET | `/auth/session` | Session Check (optional auth) | ✅ Funktioniert |

#### ✅ Password Change (Current User)
| Methode | Route | Funktion | Status |
|---------|-------|----------|--------|
| GET | `/auth/account/password/page` | Passwort-Seite | ✅ Existiert |
| POST | `/auth/change-password` | Passwort ändern | ✅ Funktioniert |

**Implementation Details (`/auth/change-password`):**
- Decorator: `@jwt_required()` (user muss eingeloggt sein)
- Payload: `{"oldPassword": str, "newPassword": str}`
- Validierung: Password strength (8 chars, Upper/Lower/Digit)
- Service: `auth_services.verify_password()`, `hash_password()`, `update_user_password()`
- Response: `{"ok": true}` (200) oder `{"error": "..."}` (400/401/404)

#### ✅ User Profile
| Methode | Route | Funktion | Status |
|---------|-------|----------|--------|
| GET | `/auth/account/profile` | Get Profile JSON | ✅ Funktioniert |
| PATCH | `/auth/account/profile` | Update Profile | ✅ Funktioniert |
| GET | `/auth/account/profile/page` | Profile-Seite | ✅ Existiert |

---

## 3. Admin Endpoints — FEHLERBILD

### 3.1 Existierende Admin-UI

#### Template: `templates/auth/admin_users.html`
- **Hero Header:** "Benutzerverwaltung"
- **Suchfeld:** `#admin-search`
- **Toolbar Buttons:**
  - "Aktualisieren" → `#refresh`
  - "Benutzer anlegen" → `#create`
- **Tabelle:** `#users-table` mit Spalten:
  - Benutzername, Email, Rolle, Status, Erstellt am, Aktionen
- **Dialoge:**
  - Create User Dialog (`#create-user-dialog`)
  - Edit User Dialog (`#user-edit-dialog`)
  - Invite Link Dialog (`#invite-dialog`)

#### JavaScript: `static/js/auth/admin_users.js`
**Erwartete API Calls:**
1. `GET /admin/users?include_inactive=1&q=search` → Benutzerliste
2. `GET /admin/users/:id` → Einzelner User Details
3. `POST /admin/users` → User erstellen
4. `PATCH /admin/users/:id` → User aktualisieren (email, role, is_active)
5. `POST /admin/users/:id/reset-password` → Reset Token erstellen

**Alle Requests senden:**
- `credentials: 'same-origin'` (Cookie wird mitgesendet)
- `X-CSRF-TOKEN` Header (aus Cookie `csrf_access_token`)
- `Content-Type: application/json`

### 3.2 Fehlende Routen (404 Not Found)

#### ❌ `/admin/users` (GET/POST)
**Frontend Erwartung:**
```javascript
GET /admin/users?include_inactive=1&q=search
→ Response: {"items": [{"id": "...", "username": "...", "email": "...", "role": "...", "is_active": true, "created_at": "..."}]}

POST /admin/users
Body: {"username": "newuser", "email": "user@example.com", "role": "user"}
→ Response: {"ok": true, "inviteLink": "https://...", "inviteExpiresAt": "..."}
```

**Aktueller Status:**
- Keine Route definiert in `src/app/routes/auth.py`
- 404 Not Found

#### ❌ `/admin/users/:id` (GET/PATCH)
**Frontend Erwartung:**
```javascript
GET /admin/users/abc-123-def
→ Response: {"id": "...", "username": "...", "email": "...", "role": "...", "is_active": true}

PATCH /admin/users/abc-123-def
Body: {"email": "new@example.com", "role": "editor", "is_active": false}
→ Response: {"ok": true}
```

**Aktueller Status:**
- Keine Route definiert
- 404 Not Found

#### ❌ `/admin/users/:id/reset-password` (POST)
**Frontend Erwartung:**
```javascript
POST /admin/users/abc-123-def/reset-password
→ Response: {"ok": true, "inviteLink": "https://...", "inviteExpiresAt": "..."}
```

**Aktueller Status:**
- Keine Route definiert
- 404 Not Found

### 3.3 Einziger vorhandener Admin-Endpoint

#### ✅ `/auth/admin_users` (GET) — Nur Template
```python
@blueprint.get("/admin_users")
@jwt_required()
@require_role(Role.ADMIN)
def admin_users_page() -> Response:
    return render_template("auth/admin_users.html"), 200
```
- **Funktion:** Rendert nur HTML-Template
- **Keine API:** Keine Daten, nur Seite
- **Decorator:** `@require_role(Role.ADMIN)` (prüft JWT claim `role == "admin"`)

---

## 4. Fehlerbild Reproduktion (Theoretisch)

### 4.1 Lokaler Start
```powershell
cd c:\dev\hispanistica_games
.venv\Scripts\Activate.ps1
python -m src.app.main
```
→ Server läuft auf http://localhost:8000

### 4.2 Admin UI öffnen
1. Login als Admin:
   - `POST /auth/login` mit `{"username": "admin", "password": "..."}`
   - Cookie `access_token_cookie` wird gesetzt
2. Navigiere zu Admin-Seite:
   - `/auth/admin_users` (GET)
   - Template wird geladen ✅

### 4.3 DevTools Network Tab

#### Schritt A: Seite lädt
```
GET /auth/admin_users → 200 OK (HTML)
GET /static/js/auth/admin_users.js → 200 OK
```

#### Schritt B: JavaScript initialisiert (`reload()`)
```
GET /admin/users → 404 Not Found
```
**Console Error:**
```
Failed to load users
```
**Tabelle zeigt:**
```
Fehler beim Laden der Benutzer.
```

#### Schritt C: "Benutzer anlegen" klicken
- Dialog öffnet sich ✅
- Formular ausfüllen
- Submit

```
POST /admin/users → 404 Not Found
```
**Snackbar:**
```
Netzwerkfehler beim Anlegen des Benutzers.
```

#### Schritt D: Edit-Button (wenn Tabelle Dummy-Daten hätte)
```
GET /admin/users/abc-123 → 404 Not Found
```

#### Schritt E: "Passwort zurücksetzen"
```
POST /admin/users/abc-123/reset-password → 404 Not Found
```

---

## 5. Root Cause Analysis

### 5.1 Hauptursache
**Admin-API Endpoints wurden nie implementiert.**
- UI-Templates sind fertig
- JavaScript ist fertig
- Backend-Services existieren (`auth_services.get_user_by_id()`, etc.)
- **Aber:** Keine Flask Routes verbinden Frontend → Backend

### 5.2 Warum fehlen die Routes?
Vermutlich:
1. UI wurde zuerst entwickelt (Template + JS)
2. Backend-API sollte später kommen
3. **API-Implementation wurde vergessen/übersprungen**

### 5.3 Warum funktioniert Passwort ändern?
- Route `/auth/change-password` existiert
- Wird von `account_password.js` korrekt aufgerufen
- **Diese Route wurde implementiert, aber Admin-Routes nicht**

---

## 6. Service Layer — Vorhanden aber ungenutzt

### 6.1 Existierende Services in `src/app/auth/services.py`

#### User Queries
```python
get_user_by_id(user_id: str) -> Optional[User]
find_user_by_username_or_email(identifier: str) -> Optional[User]
```

#### User Mutations
```python
update_user_password(user_id: str, new_hashed: str) -> None
update_user_profile(user_id: str, username=..., display_name=..., email=...) -> None
mark_user_deleted(user_id: str) -> None
```

#### Password Management
```python
hash_password(plain: str) -> str
verify_password(plain: str, hashed: str) -> bool
validate_password_strength(password: str) -> tuple[bool, str | None]
```

#### Reset Tokens
```python
create_reset_token_for_user(user: User) -> Tuple[str, ResetToken]
verify_and_use_reset_token(raw: str) -> Tuple[Optional[ResetToken], str]
```

#### Account Status
```python
check_account_status(user: User) -> AccountStatus
  # Prüft: is_active, locked_until, access_expires_at, valid_from
```

### 6.2 Fehlende Services (müssen erstellt werden)

#### User Listing (für Admin)
```python
# FEHLT:
def list_users(
    include_inactive: bool = False,
    search_query: Optional[str] = None
) -> list[User]:
    # SQLAlchemy query mit Filtern
```

#### User Creation (für Admin)
```python
# FEHLT:
def create_user(
    username: str,
    email: Optional[str],
    role: str = "user",
    generate_reset_token: bool = True
) -> Tuple[User, Optional[str]]:
    # Validierung, UUID, placeholder password_hash, DB Insert
    # Optional: Reset Token für Invite
```

#### User Update (Admin)
```python
# FEHLT (oder erweitern):
def admin_update_user(
    user_id: str,
    email: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None
) -> None:
    # Spezifisch für Admin (mehr Rechte als update_user_profile)
```

---

## 7. Authorization — Funktioniert

### 7.1 Role-Based Access Control
- **Decorator:** `@require_role(Role.ADMIN)` in `src/app/auth/decorators.py`
- **Funktionsweise:**
  1. JWT wird via `@jwt_required()` geprüft
  2. JWT Claim `role` wird gelesen
  3. Verglichen mit erlaubten Rollen
  4. Falls nicht erlaubt → 403 Forbidden

### 7.2 Rollen-Hierarchie
```python
class Role(StrEnum):
    ADMIN = "admin"
    EDITOR = "editor"
    USER = "user"
```

### 7.3 Admin Check (aktuell)
- Nur in `admin_users_page()` verwendet
- **Fehlende Anwendung:** Alle Admin-API Routes brauchen `@require_role(Role.ADMIN)`

---

## 8. CSRF Protection

### 8.1 JWT CSRF
- **Prod:** JWT_COOKIE_CSRF_PROTECT = True
- **Dev:** JWT_COOKIE_CSRF_PROTECT = False
- **CSRF Token Cookie:** `csrf_access_token`
- **Header:** `X-CSRF-TOKEN` (JavaScript sendet korrekt)

### 8.2 Frontend Implementation
```javascript
function getCsrfToken() {
  const match = document.cookie.match(/csrf_access_token=([^;]+)/);
  return match ? match[1] : '';
}

fetch('/admin/users', {
  headers: { 'X-CSRF-TOKEN': getCsrfToken() }
})
```

**Status:** ✅ Korrekt implementiert im Frontend

---

## 9. Zusammenfassung — Was fehlt

### 9.1 Backend Routes (Flask Blueprints)
In `src/app/routes/auth.py` fehlen:
```python
@blueprint.get("/admin/users")  # ❌ FEHLT
@blueprint.post("/admin/users")  # ❌ FEHLT
@blueprint.get("/admin/users/<user_id>")  # ❌ FEHLT
@blueprint.patch("/admin/users/<user_id>")  # ❌ FEHLT
@blueprint.post("/admin/users/<user_id>/reset-password")  # ❌ FEHLT
```

Alternativ: Prefix `/api/admin/users` für klarere API-Struktur.

### 9.2 Service Functions
In `src/app/auth/services.py` fehlen:
```python
def list_users(...) -> list[User]:  # ❌ FEHLT
def create_user(...) -> Tuple[User, Optional[str]]:  # ❌ FEHLT
def admin_update_user(...) -> None:  # ❌ FEHLT (oder extend existing)
```

### 9.3 Migrationen/Bootstrap
- ✅ DB Models definiert
- ✅ `create_initial_admin.py` Script existiert
- ❌ Kein Alembic Setup (aber nicht kritisch — `create_all()` funktioniert)
- ⚠️ README fehlt: "So bootet man einen Admin"

---

## 10. Nächste Schritte (Fix-Plan)

### Phase 1: DB/Models prüfen (Schritt 3)
1. ✅ User Model ist vollständig
2. ✅ DB-Engine ist konfiguriert
3. ⚠️ Prüfen: Ist `auth.db` migriert? (via Python Shell)
4. ⚠️ Admin User existiert? Falls nicht → `create_initial_admin.py` ausführen

### Phase 2: Service Layer erweitern (Schritt 4.3)
1. `list_users()` implementieren
2. `create_user()` implementieren
3. `admin_update_user()` implementieren (oder `update_user_profile()` erweitern)

### Phase 3: API Routes bauen (Schritt 4)
1. `GET /api/admin/users` → list_users()
2. `POST /api/admin/users` → create_user()
3. `GET /api/admin/users/<id>` → get_user_by_id()
4. `PATCH /api/admin/users/<id>` → admin_update_user()
5. `POST /api/admin/users/<id>/reset-password` → create_reset_token_for_user()

Alle mit:
- `@jwt_required()`
- `@require_role(Role.ADMIN)`
- Konsistente JSON Responses
- Error Handling (400/403/404/409/500)

### Phase 4: Frontend anpassen (Schritt 5)
1. ⚠️ JavaScript ändert API-Prefix zu `/api/admin/users` (falls gewählt)
2. ✅ Credentials/CSRF sind bereits korrekt
3. ✅ Error Handling ist bereits vorhanden

### Phase 5: Tests (Schritt 6)
1. Manual: Admin bootet → login → create user → edit → reset password
2. Pytest: API-Tests für alle Admin-Routen

### Phase 6: Dokumentation (Schritt 7)
1. README: Admin bootstrap Anleitung
2. README: ENV Variables (AUTH_DATABASE_URL)
3. docs/admin/: Endpoint-Referenz

---

## 11. Empfohlene API-Struktur

### Variante A: Prefix `/api/admin/users` (EMPFOHLEN)
```
GET    /api/admin/users              # List all users
POST   /api/admin/users              # Create user
GET    /api/admin/users/<id>         # Get user by ID
PATCH  /api/admin/users/<id>         # Update user
DELETE /api/admin/users/<id>         # Delete user (optional)
POST   /api/admin/users/<id>/reset-password  # Reset password
```

**Vorteile:**
- Klare Trennung Auth (`/auth/*`) vs. Admin API (`/api/admin/*`)
- RESTful
- Erweiterbar (z.B. `/api/admin/stats`)

**Nachteil:**
- JavaScript muss angepasst werden (von `/admin/users` → `/api/admin/users`)

### Variante B: Prefix `/admin/users` (wie Frontend erwartet)
```
GET    /admin/users
POST   /admin/users
...
```

**Vorteil:**
- Kein JavaScript-Änderung nötig

**Nachteil:**
- Inconsistent mit `/auth/*`
- Blueprint `"auth"` hat prefix `/auth`, aber Admin-Routes sind `/admin`
  → Entweder neuer Blueprint `"admin"` oder Route außerhalb Prefix

**Lösung:** Neuer Blueprint:
```python
# src/app/routes/admin.py
blueprint = Blueprint("admin", __name__, url_prefix="/admin")
```

---

## 12. Bewertung: Minimal vs. Vollständig

### Minimal (wie User beschreibt)
- Admin kann User anlegen (username + email)
- Initial password via Reset Token (Invite-Link)
- Liste sehen
- Email/Role/Status ändern
- Reset Password (für vergessene Passwörter)

**Reicht für:**
- Single-Admin Scenario
- Wenige User (<100)

### Optional (nice-to-have)
- User löschen (mit "nicht sich selbst" Check)
- Batch-Actions (z.B. mehrere deaktivieren)
- Pagination (bei >1000 Users)
- Audit Log (wer hat was geändert)

**Empfehlung:** Erst Minimal, dann erweitern wenn nötig.

---

## 13. Risiken & Constraints

### 13.1 Security Checks nötig
- ✅ Admin-only via `@require_role(Role.ADMIN)`
- ✅ CSRF via JWT cookies
- ⚠️ Input Validation:
  - Email format
  - Username uniqueness
  - Role whitelist (admin/editor/user)
  - Prevent self-privilege-escalation (optional)
- ⚠️ Rate Limiting für Create/Update (optional)

### 13.2 Error Handling
- 400: Bad Request (validation errors)
- 401: Unauthorized (kein JWT)
- 403: Forbidden (kein Admin)
- 404: Not Found (user_id ungültig)
- 409: Conflict (username/email exists)
- 500: Internal Server Error (DB failure)

**Alle Errors als JSON:**
```json
{"error": "username_exists", "message": "Benutzername bereits vergeben."}
```

### 13.3 Transaktionen
- Service Layer nutzt bereits `get_session()` Context Manager
- Automatisches Rollback bei Exception ✅
- Commit bei Success ✅

---

## 14. Technische Notizen

### 14.1 Password Hashing
- **Algorithmus:** Argon2 (fallback Bcrypt)
- **Config:** `AUTH_HASH_ALGO=argon2`
- **Libraries:** `argon2-cffi`, `passlib`, `bcrypt`
- **Verification:** Multi-backend (Werkzeug/Argon2/Bcrypt) für Kompatibilität

### 14.2 UUID Generation
```python
import uuid
user_id = str(uuid.uuid4())  # e.g., "a3bb189e-8bf9-3888-9912-ace4e6543002"
```

### 14.3 Datetime Handling
```python
from datetime import datetime, timezone
created_at = datetime.now(timezone.utc)  # ALWAYS UTC
```

---

## 15. Testing Strategy

### 15.1 Manual Smoke Test
1. Start Server
2. Run `create_initial_admin.py`
3. Login als Admin
4. Open `/auth/admin_users`
5. **Should now work:** Liste lädt, Create funktioniert, Edit funktioniert

### 15.2 Pytest Tests
```python
# tests/test_admin_api.py

def test_list_users_as_admin(client, admin_token):
    resp = client.get('/api/admin/users', headers={'Authorization': f'Bearer {admin_token}'})
    assert resp.status_code == 200
    assert 'items' in resp.json

def test_create_user_as_admin(client, admin_token):
    resp = client.post('/api/admin/users', 
        json={'username': 'testuser', 'email': 'test@example.com'},
        headers={'Authorization': f'Bearer {admin_token}'})
    assert resp.status_code == 201
    assert resp.json['ok'] is True

def test_list_users_as_non_admin_forbidden(client, user_token):
    resp = client.get('/api/admin/users', headers={'Authorization': f'Bearer {user_token}'})
    assert resp.status_code == 403
```

---

## Appendix A: File Structure

```
src/app/
├── __init__.py              # create_app(), Blueprint registration
├── main.py                  # Entry point
├── config/
│   └── __init__.py          # Config (AUTH_DATABASE_URL, JWT settings)
├── extensions/
│   └── sqlalchemy_ext.py    # SQLAlchemy engine/session helpers
├── auth/
│   ├── __init__.py          # Role enum
│   ├── models.py            # User, RefreshToken, ResetToken ORM
│   ├── services.py          # Auth service layer (hash, verify, user CRUD)
│   ├── decorators.py        # @require_role
│   ├── jwt.py               # JWT config helpers
│   └── loader.py            # JWT user loader
├── routes/
│   ├── __init__.py          # register_blueprints()
│   ├── public.py            # Blueprint "public"
│   └── auth.py              # Blueprint "auth" (/auth/*)
└── services/
    └── database.py          # (unused?)

templates/auth/
├── admin_users.html         # Admin UI Template
├── account_password.html    # Password Change Template
├── account_profile.html     # Profile Template
└── login.html               # Login Template

static/js/auth/
├── admin_users.js           # ❌ Ruft nicht existierende APIs
├── account_password.js      # ✅ Funktioniert
└── account_profile.js       # ✅ Funktioniert

scripts/
└── create_initial_admin.py  # ✅ Bootstrap Script
```

---

## Appendix B: ENV Variables

### Required
```env
FLASK_SECRET_KEY=<random-secret>          # Required for sessions/JWT
AUTH_DATABASE_URL=sqlite:///data/db/auth.db  # Or postgresql://...
```

### Optional
```env
FLASK_ENV=development                     # development|production
JWT_COOKIE_CSRF_PROTECT=false             # true in prod
ACCESS_TOKEN_EXP=3600                     # seconds (default 1h)
REFRESH_TOKEN_EXP=604800                  # seconds (default 7d)
AUTH_HASH_ALGO=argon2                     # argon2|bcrypt
```

---

## Conclusion

**Status:** AUDIT COMPLETE

**Diagnose:** Admin-Features sind UI-seitig fertig, aber Backend-API fehlt komplett (404 Errors).

**Fix Complexity:** MEDIUM
- Models ✅
- Services ✅ (teilweise — Ergänzung nötig)
- Routes ❌ (komplett neu)
- Frontend ✅ (minimal anpassen)

**ETA:** ~4-6 Stunden für vollständige Implementation + Tests

**Risk:** LOW — Klare Struktur, Services vorhanden, nur Routes bauen.

**Next Action:** Proceed to Step 5 (DB/Models prüfen) → Step 6 (API Routes implementieren)

---

**Report Ende.**
