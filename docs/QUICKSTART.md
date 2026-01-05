# 🎮 Hispanistica Games - Quick Start Guide

Minimalistische Flask-Webapp für Gamification und Quiz-Module mit hispanística Branding.

## 🚀 Schnellstart (empfohlen)

```powershell
# Im Repository-Root ausführen
.\scripts\dev-setup.ps1
```

Das wars! Der Dev-Server startet automatisch auf `http://localhost:8000`

**Login:** `admin` / `change-me`

---

## 📋 Was passiert beim Setup?

1. **Python venv** erstellen (`.venv`)
2. **Dependencies** installieren
3. **SQLite Auth-DB** initialisieren (`data/db/auth.db`)
4. **Admin-User** anlegen
5. **Dev-Server** starten

---

## 🔄 Tägliches Arbeiten

Wenn alles bereits eingerichtet ist:

```powershell
.\scripts\dev-start.ps1
```

oder noch schneller:

```powershell
.\scripts\quick-start.ps1
```

---

## 🎨 Features

- ✅ **Gamification-Modul** (Placeholder)
- ✅ **Quiz-Modul** (Placeholder)
- ✅ Material Design 3 (MD3) UI
- ✅ Custom Color Scheme (Primary: #0F4C5C, Secondary: #276D7B)
- ✅ JWT-basierte Authentifizierung
- ✅ SQLite oder PostgreSQL
- ✅ Legal Pages (Impressum, Datenschutz)

---

## 🛠️ Technologie-Stack

- **Backend:** Flask 3.x + Python 3.12+
- **UI:** Material Design 3 (MD3) mit CSS Tokens
- **Auth:** Flask-JWT-Extended + SQLAlchemy
- **DB:** SQLite (dev) oder PostgreSQL (prod)

---

## 📂 Projekt-Struktur

```
hispanistica_games/
├── src/app/              # Flask App
│   ├── routes/           # Route Handler (public, auth)
│   ├── auth/             # Auth Models & Loader
│   └── extensions/       # SQLAlchemy, JWT, etc.
├── templates/            # Jinja2 Templates
│   ├── pages/            # Seiten (index, gamification, quiz, etc.)
│   └── partials/         # Wiederverwendbare Components
├── static/               # CSS, JS, Bilder
│   ├── css/branding.css  # games.hispanistica Farben
│   └── js/               # JavaScript Modules
├── scripts/              # Setup & Utility Scripts
├── data/db/              # SQLite Datenbanken
└── docs/                 # Dokumentation
```

---

## 🐘 PostgreSQL-Modus (optional)

Für produktionsnahe Tests mit PostgreSQL:

```powershell
.\scripts\dev-setup.ps1 -UsePostgres
```

**Voraussetzung:** Docker Desktop muss laufen

---

## 🔧 Erweiterte Optionen

### dev-setup.ps1

```powershell
# Skip Python Dependencies Installation
.\scripts\dev-setup.ps1 -SkipInstall

# Reset Auth-DB und neues Admin-Passwort
.\scripts\dev-setup.ps1 -ResetAuth -StartAdminPassword "geheim123"

# PostgreSQL + Reset
.\scripts\dev-setup.ps1 -UsePostgres -ResetAuth

# Nur Setup, kein Server-Start
.\scripts\dev-setup.ps1 -SkipDevServer
```

---

## 🩺 Health Checks

```powershell
# App Health
Invoke-WebRequest http://localhost:8000/health

# Auth DB Health
Invoke-WebRequest http://localhost:8000/health/auth
```

---

## 🐛 Troubleshooting

### "Database file not found"

```powershell
# Verzeichnis erstellen und DB initialisieren
New-Item -ItemType Directory -Path "data\db" -Force
.\.venv\Scripts\python.exe scripts\init_auth_db.py
```

### "Admin login fails"

```powershell
# Admin-User neu erstellen
.\.venv\Scripts\python.exe scripts\create_initial_admin.py --username admin --password change-me --db data/db/auth.db
```

### Auth-DB zurücksetzen

```powershell
# Datenbank löschen und neu aufsetzen
Remove-Item data\db\auth.db -Force
.\scripts\dev-setup.ps1
```

---

## 📝 Nächste Schritte

1. **Gamification-Logik** implementieren ([templates/pages/gamification.html](templates/pages/gamification.html))
2. **Quiz-Logik** implementieren ([templates/pages/quiz.html](templates/pages/quiz.html))
3. **API-Endpunkte** für Gamification/Quiz erstellen
4. **Deployment** vorbereiten (siehe [DEPLOYMENT.md](docs/operations/deployment.md))

---

## 📚 Weitere Dokumentation

- [startme.md](startme.md) - Detaillierte Start-Anleitung
- [README.md](README.md) - Projekt-Übersicht
- [docs/](docs/) - Vollständige Dokumentation

---

## 🎯 Unterschied zu corapan-webapp

Diese App ist eine **vereinfachte** Version ohne:
- ❌ Corpus-Suche (BlackLab)
- ❌ Audio-Player
- ❌ Atlas/Stats-Module
- ❌ Analytics-Dashboard
- ❌ Media-Management

Fokus liegt auf:
- ✅ Gamification
- ✅ Quiz-Module
- ✅ Minimale User-Verwaltung

---

**Viel Erfolg! 🚀**
