# Admin Setup Guide — hispanistica_games

**Letzte Aktualisierung:** 2025-12-20

## Überblick

Das Admin-System ermöglicht es, Benutzerkonten zu verwalten:
- ✅ Benutzer anlegen (mit Invite-Link)
- ✅ Benutzer bearbeiten (Email, Rolle, Status)
- ✅ Passwort zurücksetzen (Admin → User)
- ✅ Eigenes Passwort ändern (User selbst)
- ✅ Benutzerliste anzeigen & durchsuchen

---

## Ersteinrichtung (Admin Bootstrap)

### Schritt 1: Datenbank initialisieren

Die Auth-Datenbank wird automatisch beim ersten Start initialisiert:

```powershell
# Virtuelle Umgebung aktivieren
cd c:\dev\hispanistica_games
.venv\Scripts\Activate.ps1

# Server einmalig starten (erstellt Tabellen)
python -m src.app.main
```

**Hinweis:** Tabellen werden automatisch via SQLAlchemy erstellt, wenn sie nicht existieren.

### Schritt 2: Admin-User erstellen

```powershell
# PowerShell (empfohlen)
$env:START_ADMIN_USERNAME='admin'
$env:START_ADMIN_PASSWORD='Secure123Pass'
python scripts/create_initial_admin.py

# Oder mit CLI-Argumenten:
python scripts/create_initial_admin.py --username admin --password Secure123Pass --email admin@example.org
```

**Ausgabe:**
```
Admin user created/updated: admin (role=admin, active=True)
```

**WICHTIG:** Ändere das Passwort nach dem ersten Login!

---

## Server Starten

### Entwicklung
```powershell
$env:FLASK_ENV='development'
$env:FLASK_SECRET_KEY='your-secret-key-here'
python -m src.app.main
```

Server läuft auf: **http://localhost:8000**

### Produktion
```bash
export FLASK_ENV=production
export FLASK_SECRET_KEY=$(openssl rand -hex 32)
export AUTH_DATABASE_URL='postgresql://user:pass@localhost/auth_db'
gunicorn -w 4 -b 0.0.0.0:8000 'src.app:create_app("production")'
```

---

## ENV Variables

### Erforderlich
```env
FLASK_SECRET_KEY=<random-secret>     # Für Session/JWT (32+ Zeichen)
```

### Optional
```env
# Environment
FLASK_ENV=development                # development|production (default: production)

# Datenbank
AUTH_DATABASE_URL=sqlite:///data/db/auth.db  # SQLite (Standard)
# oder PostgreSQL:
# AUTH_DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Token Lifetimes
ACCESS_TOKEN_EXP=3600                # Access Token (15 Min default: 900)
REFRESH_TOKEN_EXP=604800             # Refresh Token (7 Tage default: 604800)

# Password Hashing
AUTH_HASH_ALGO=argon2                # argon2|bcrypt (default: argon2)
AUTH_ARGON2_TIME_COST=2              # Argon2 iterations
AUTH_ARGON2_MEMORY_COST=102400       # Argon2 memory (KB)

# Reset Token
AUTH_RESET_TOKEN_EXP_DAYS=7          # Reset-Token Gültigkeit (Tage)

# Security (Production)
JWT_COOKIE_CSRF_PROTECT=true         # CSRF Protection (true in prod)
SESSION_COOKIE_SECURE=true           # HTTPS-only cookies
```

---

## Admin UI Zugriff

### 1. Login
- URL: **http://localhost:8000/auth/login**
- Username: `admin`
- Password: (vom Bootstrap)

### 2. Admin-Seite öffnen
- URL: **http://localhost:8000/auth/admin_users**
- Erfordert: JWT Cookie + `role=admin`

### 3. Funktionen
- **Benutzerliste:** Alle User anzeigen
- **Suchen:** Nach Username oder Email filtern
- **Filter:** Inaktive User ein-/ausblenden
- **Benutzer anlegen:**
  - Username, Email, Rolle (admin/editor/user)
  - Generiert automatisch Invite-Link
  - Neuer User muss Passwort via Reset-Link setzen
- **Benutzer bearbeiten:**
  - Email ändern
  - Rolle ändern (admin/editor/user)
  - Aktivieren/Deaktivieren
- **Passwort zurücksetzen:**
  - Generiert neuen Reset-Link
  - User kann Passwort neu setzen

---

## API Endpoints (Admin)

Alle Admin-Routen sind geschützt: `@jwt_required()` + `@require_role(Role.ADMIN)`

### Liste aller User
```http
GET /api/admin/users?include_inactive=1&q=search
Authorization: Cookie (JWT)

Response 200:
{
  "items": [
    {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.org",
      "role": "admin",
      "is_active": true,
      "created_at": "2025-12-20T12:00:00Z",
      "last_login_at": "2025-12-20T14:30:00Z"
    }
  ]
}
```

### Benutzer erstellen
```http
POST /api/admin/users
Content-Type: application/json
Authorization: Cookie (JWT)
X-CSRF-TOKEN: <token>

{
  "username": "newuser",
  "email": "user@example.com",
  "role": "user"
}

Response 201:
{
  "ok": true,
  "user": {
    "id": "uuid",
    "username": "newuser",
    "email": "user@example.com",
    "role": "user"
  },
  "inviteLink": "http://localhost:8000/auth/login?reset=<token>",
  "inviteExpiresAt": "2025-12-27T12:00:00Z"
}

Errors:
409: {"error": "username_exists", "message": "Benutzername bereits vergeben."}
409: {"error": "email_exists", "message": "E-Mail bereits vergeben."}
400: {"error": "missing_parameters"}
```

### User Details abrufen
```http
GET /api/admin/users/<user_id>
Authorization: Cookie (JWT)

Response 200:
{
  "id": "uuid",
  "username": "newuser",
  "email": "user@example.com",
  "role": "user",
  "is_active": true,
  "created_at": "2025-12-20T12:00:00Z",
  "last_login_at": null
}

Errors:
404: {"error": "user_not_found"}
```

### User aktualisieren
```http
PATCH /api/admin/users/<user_id>
Content-Type: application/json
Authorization: Cookie (JWT)
X-CSRF-TOKEN: <token>

{
  "email": "newemail@example.com",
  "role": "editor",
  "is_active": false
}

Response 200:
{"ok": true}

Errors:
404: {"error": "user_not_found"}
409: {"error": "email_exists"}
```

### Passwort zurücksetzen
```http
POST /api/admin/users/<user_id>/reset-password
Authorization: Cookie (JWT)
X-CSRF-TOKEN: <token>

Response 200:
{
  "ok": true,
  "inviteLink": "http://localhost:8000/auth/login?reset=<token>",
  "inviteExpiresAt": "2025-12-27T12:00:00Z"
}

Errors:
404: {"error": "user_not_found"}
```

---

## API Endpoints (Self-Service)

### Eigenes Passwort ändern
```http
POST /auth/change-password
Content-Type: application/json
Authorization: Cookie (JWT)
X-CSRF-TOKEN: <token>

{
  "oldPassword": "current",
  "newPassword": "NewSecure123"
}

Response 200:
{"ok": true}

Errors:
400: {"error": "password_too_short"}
400: {"error": "password_missing_uppercase"}
401: {"error": "invalid_credentials"}
```

**Passwort Requirements:**
- Mindestens 8 Zeichen
- Mindestens 1 Großbuchstabe
- Mindestens 1 Kleinbuchstabe
- Mindestens 1 Ziffer

---

## Datenbank Schema

### Tabelle: `users`
```sql
CREATE TABLE users (
  user_id VARCHAR(36) PRIMARY KEY,           -- UUID
  username VARCHAR UNIQUE NOT NULL,          -- Lowercase
  email VARCHAR UNIQUE,                      -- Optional
  password_hash TEXT NOT NULL,               -- Argon2/Bcrypt
  role VARCHAR(32) NOT NULL DEFAULT 'user',  -- admin|editor|user
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  last_login_at TIMESTAMP,
  login_failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  deleted_at TIMESTAMP,
  deletion_requested_at TIMESTAMP,
  access_expires_at TIMESTAMP,
  valid_from TIMESTAMP,
  display_name VARCHAR
);
```

### Tabelle: `refresh_tokens`
```sql
CREATE TABLE refresh_tokens (
  token_id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(user_id),
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  replaced_by VARCHAR(36),
  revoked_at TIMESTAMP,
  user_agent TEXT,
  ip_address VARCHAR
);
```

### Tabelle: `reset_tokens`
```sql
CREATE TABLE reset_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(user_id),
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP
);
```

---

## Troubleshooting

### Problem: "user_not_found" beim Login
**Lösung:** Admin-User erstellen:
```powershell
python scripts/create_initial_admin.py --username admin --password YourPassword123
```

### Problem: "AUTH_DATABASE_URL is not configured"
**Lösung:** ENV Variable setzen oder in config.py prüfen:
```powershell
$env:AUTH_DATABASE_URL='sqlite:///C:/dev/hispanistica_games/data/db/auth.db'
```

### Problem: 403 Forbidden bei /api/admin/users
**Ursache:** User ist nicht als Admin eingeloggt.
**Lösung:** Prüfen Sie:
```python
# In Python Shell:
from src.app.auth.services import get_user_by_id
user = get_user_by_id('user-uuid')
print(user.role)  # Sollte 'admin' sein
```

### Problem: JWT Token abgelaufen
**Ursache:** Access Token ist expired (15 Min Standard).
**Lösung:** Automatische Token-Rotation via `/auth/refresh` (Frontend macht das automatisch).

### Problem: Passwort ändern gibt 400
**Ursache:** Neues Passwort erfüllt nicht die Anforderungen.
**Lösung:** Passwort muss enthalten:
- Min. 8 Zeichen
- 1 Großbuchstabe
- 1 Kleinbuchstabe
- 1 Ziffer

---

## Sicherheit

### Passwort Hashing
- **Algorithmus:** Argon2 (empfohlen) oder Bcrypt
- **Fallback:** Multi-Backend-Verification (Werkzeug/Argon2/Bcrypt)
- **Config:** `AUTH_HASH_ALGO=argon2`

### JWT Cookies
- **HTTPOnly:** `true` (nicht per JavaScript zugreifbar)
- **Secure:** `true` in Produktion (HTTPS-only)
- **SameSite:** `Lax` (CSRF-Schutz)
- **CSRF Token:** Separate Cookie `csrf_access_token` (in Produktion)

### Rate Limiting
- Login: 5 Versuche → 10 Min Lockout
- Reset Password Request: 5/Minute (via Flask-Limiter)

### Account Lockout
- Nach 5 fehlgeschlagenen Login-Versuchen
- Automatische Entsperrung nach 10 Minuten
- Admin kann manuell entsperren (via DB oder `is_active=True`)

---

## Entwicklung

### Tests ausführen
```powershell
pytest tests/test_admin_api.py -v
```

### Neue Admin-Route hinzufügen
1. Service in `src/app/auth/services.py` implementieren
2. Route in `src/app/routes/admin.py` hinzufügen
3. Decorator: `@jwt_required()` + `@require_role(Role.ADMIN)`
4. Test in `tests/test_admin_api.py` schreiben

---

## Weitere Dokumentation

- [Admin Auth Audit Report](./admin-auth-audit.md) — Vollständige technische Analyse
- [README.md](../../README.md) — Projekt-Übersicht
- [ARCHITECTURE.md](../ARCHITECTURE.md) — System-Architektur

---

**Ende der Admin Setup Dokumentation**
