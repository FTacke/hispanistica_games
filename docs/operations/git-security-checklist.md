# Git Security Checklist

✅ **VERIFIZIERT: Alle sensiblen Daten sind korrekt ignoriert!**

## 🔐 Was NICHT in Git ist (und nie sein sollte):

### Secrets & Credentials
- ✅ `passwords.env` - Environment-Variablen mit Passwörtern
- ✅ `config/keys/*` - JWT Private/Public Keys
- ✅ `*.key`, `*.pem`, `*.crt` - Alle Schlüssel-Dateien

### Große Dateien
- ✅ `media/mp3-full/` - Original-Audio-Dateien
- ✅ `media/mp3-split/` - Segmentierte Audio-Dateien
- ✅ `media/transcripts/` - Transkript-Dateien
- ✅ `data/db/` - SQLite-Datenbanken
- ✅ `data/counters/` - Counter-JSON-Dateien

### Build-Artefakte
- ✅ `.venv/` - Python Virtual Environment
- ✅ `__pycache__/` - Python Cache
- ✅ `.ruff_cache/` - Linter Cache

### Logs & Temporäre Dateien
- ✅ `logs/` - Log-Dateien (können sensible Daten enthalten!)
- ✅ `*.log` - Alle Log-Dateien
- ✅ `backups/` - Backup-Archive

### Lokale Entwicklung
- ✅ `LOKAL/` - Ihre lokalen Scripts/Notizen/Analysen
- ✅ `.vscode/` - VS Code Settings
- ✅ `.idea/` - JetBrains IDE Settings

## ✅ Was IN Git ist (und sein sollte):

### Source Code
- ✅ `src/` - Kompletter Python-Code
- ✅ `static/` - CSS, JS, Bilder
- ✅ `templates/` - HTML-Templates

### Konfiguration
- ✅ `.gitignore` - Git-Ignore-Rules
- ✅ `.dockerignore` - Docker-Build-Ignore-Rules
- ✅ `docker-compose.yml` - Docker Compose Config
- ✅ `Dockerfile` - Docker Build Instructions
- ✅ `requirements.txt` - Python Dependencies
- ✅ `package.json` - Node Dependencies
- ✅ `pyproject.toml` - Python Project Config

### Deployment
- ✅ `update.sh` - Auto-Update-Script für Server
- ✅ `backup.sh` - Backup-Script
- ✅ `DEPLOYMENT.md` - Deployment-Dokumentation

### Templates für Secrets
- ✅ `passwords.env.template` - Template für Environment-Variablen

### Verzeichnisstruktur
- ✅ `.gitkeep` Dateien in `media/` und `data/` Unterordnern

### Dokumentation
- ✅ `README.md` - Projekt-Beschreibung
- ✅ `docs/` - Öffentliche Dokumentation
- ✅ `LOKAL/Roadmaps/` - Roadmap-Dokumente

## 🚨 Wichtige Sicherheits-Checks

### Vor jedem Git Push:

```powershell
# 1. Prüfen ob passwords.env NICHT im Status ist
git status | Select-String "passwords.env"
# Erwartet: Nur "passwords.env.template"

# 2. Prüfen ob keine Secrets committed wurden
git diff --cached | Select-String "password|secret|key"

# 3. Prüfen ob .gitignore funktioniert
git check-ignore passwords.env
# Erwartet: "passwords.env"

git check-ignore config/keys/
# Erwartet: "config/keys/"
```

### Wenn versehentlich Secrets committed wurden:

```bash
# SOFORT aus Git History entfernen!
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch passwords.env" \
  --prune-empty --tag-name-filter cat -- --all

# Dann force push (VORSICHT!)
git push origin --force --all
```

## 📋 Setup-Checklist für neuen Server

1. [ ] Git Repository clonen
2. [ ] `passwords.env.template` zu `passwords.env` kopieren
3. [ ] `passwords.env` ausfüllen (Passwörter, Secret Keys)
4. [ ] JWT Keys generieren (`config/keys/`)
5. [ ] Media-Dateien hochladen (`media/`)
6. [ ] Datenbank hochladen (`data/db/`)
7. [ ] `chmod +x update.sh backup.sh`
8. [ ] Erstes Deployment: `./update.sh --no-backup`
9. [ ] Prüfen: `passwords.env` ist NICHT in Git!

## 🔍 Audit Log

- **2025-10-19**: Initiale Security-Audit
  - ✅ `.gitignore` vollständig überarbeitet
  - ✅ Alle sensiblen Dateien ignoriert
  - ✅ `.gitkeep` für Verzeichnisstruktur hinzugefügt
  - ✅ `passwords.env.template` erstellt
  - ✅ Security-Checks dokumentiert

---

**Status:** ✅ **SICHER - Keine sensiblen Daten in Git!**
