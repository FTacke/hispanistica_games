# CO.RA.PAN Server Operations Guide

**Server:** marele.online.uni-marburg.de  
**Projektpfad:** `/srv/webapps/corapan/app`  
**Stand:** Dezember 2025

---

## Übersicht

Die CO.RA.PAN Webapp läuft als Docker-Container mit folgender Architektur:

- **Web-Container:** `corapan-webapp` (Port 6000 → nginx Reverse Proxy)
- **PostgreSQL:** Nativ auf dem Host (Port 5432)
- **Docker-Netzwerk:** `corapan-network` (Subnetz: 172.18.0.0/16)
- **BlackLab:** `corapan-blacklab` (Port 8081)

---

## Container-Start & Netzwerk

### Automatisches Deployment (Standard)

Das Deployment erfolgt automatisch über GitHub Actions bei Push auf `main`:

```bash
# Der GitHub Actions Runner führt aus:
cd /srv/webapps/corapan/app
bash scripts/deploy_prod.sh
```

Das Script stellt sicher, dass:
- Das Docker-Netzwerk `corapan-network` existiert
- Der Container im richtigen Netzwerk gestartet wird
- Die Datenbank erreichbar ist (172.18.0.1)

### Manueller Neustart

```bash
cd /srv/webapps/corapan/app

# Variante 1: Deploy-Script verwenden (empfohlen)
bash scripts/deploy_prod.sh

# Variante 2: Nur Container neustarten (ohne Rebuild)
docker restart corapan-webapp
```

### Container-Status prüfen

```bash
# Container läuft?
docker ps | grep corapan-webapp

# Netzwerk-Konfiguration prüfen (MUSS corapan-network zeigen!)
docker inspect corapan-webapp --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool

# Logs anzeigen
docker logs corapan-webapp --tail 50

# Health-Check
curl -s http://localhost:6000/health | python3 -m json.tool
```

---

## Datenbank-Verbindung

### Architektur

```
┌─────────────────────┐        ┌─────────────────────┐
│   corapan-webapp    │        │    PostgreSQL 14    │
│   (Docker Container)│───────▶│    (Host-Native)    │
│   IP: 172.18.0.x    │        │    Port: 5432       │
└─────────────────────┘        └─────────────────────┘
        │                               ▲
        │ corapan-network               │
        │ (172.18.0.0/16)               │
        │                               │
        └── Gateway: 172.18.0.1 ────────┘
```

### Verbindungsparameter

In `/srv/webapps/corapan/config/passwords.env`:

```bash
AUTH_DATABASE_URL=postgresql+psycopg2://corapan_app:PASSWORD@172.18.0.1:5432/corapan_auth
```

**Wichtig:** Die IP `172.18.0.1` ist der Docker-Gateway und entspricht dem Host aus Container-Sicht.

### Verbindung testen

```bash
# Vom Host aus:
pg_isready -h 172.18.0.1 -p 5432

# Vom Container aus:
docker exec corapan-webapp pg_isready -h 172.18.0.1 -p 5432

# Datenbank-Inhalt prüfen:
sudo -u postgres psql -d corapan_auth -c "SELECT username, role FROM users;"
```

### pg_hba.conf (PostgreSQL Zugriffskontrolle)

Die Datei `/etc/postgresql/14/main/pg_hba.conf` muss enthalten:

```
host    corapan_auth    corapan_app    172.18.0.0/16    scram-sha-256
```

Nach Änderungen:
```bash
sudo systemctl reload postgresql
```

---

## Admin-Passwort Reset

### Standardverfahren (Container läuft bereits)

```bash
# Passwort zurücksetzen
docker exec corapan-webapp \
    python scripts/create_initial_admin.py \
    --username admin \
    --password 'NEUES_SICHERES_PASSWORT' \
    --allow-production

# Erfolg prüfen: Muss "Updated existing user 'admin'..." ausgeben
```

### Hinweise

- Das Passwort wird **nicht** in Logs gespeichert (nur im Befehl sichtbar)
- Nach dem Reset: Im Browser einloggen und Passwort im UI ändern
- Das Script ist idempotent: Existiert der User, wird er aktualisiert

### Beispiel mit Einmal-Passwort

```bash
# 1. Temporäres Passwort setzen
docker exec corapan-webapp \
    python scripts/create_initial_admin.py \
    --username admin \
    --password 'TempPass2025!' \
    --allow-production

# 2. Im Browser einloggen: https://corapan.example.de
# 3. Passwort über Profil-Einstellungen ändern
```

---

## Troubleshooting

### Problem: Container im falschen Netzwerk (172.17.x statt 172.18.x)

**Symptom:** Container startet, aber `pg_isready` schlägt fehl.

**Diagnose:**
```bash
docker inspect corapan-webapp --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool
# Zeigt "bridge" mit 172.17.x statt "corapan-network" mit 172.18.x
```

**Lösung:**
```bash
# Container stoppen und entfernen
docker stop corapan-webapp
docker rm corapan-webapp

# Sauber neu starten mit Deploy-Script
cd /srv/webapps/corapan/app
bash scripts/deploy_prod.sh
```

### Problem: Netzwerk existiert nicht

```bash
# Netzwerk erstellen (falls nicht vorhanden)
docker network create --subnet=172.18.0.0/16 corapan-network

# Dann Deploy-Script ausführen
bash scripts/deploy_prod.sh
```

### Problem: Datenbank-Verbindung schlägt fehl

1. **PostgreSQL läuft?**
   ```bash
   sudo systemctl status postgresql
   ```

2. **Lauscht auf richtigem Interface?**
   ```bash
   grep listen_addresses /etc/postgresql/14/main/postgresql.conf
   # Sollte '0.0.0.0' oder '*' sein
   ```

3. **pg_hba.conf korrekt?**
   ```bash
   sudo grep 172.18 /etc/postgresql/14/main/pg_hba.conf
   # Muss die Zeile für corapan_auth zeigen
   ```

4. **Firewall blockiert?**
   ```bash
   sudo ufw status
   # Port 5432 sollte für Docker-Netzwerk offen sein
   ```

---

## ⚠️ NICHT MEHR VERWENDEN

Die folgenden Ad-hoc-Befehle sind **veraltet** und sollten nicht mehr verwendet werden:

```bash
# VERALTET: Manuelles Netzwerk-Connect
docker network connect corapan-network corapan-webapp  # NICHT MEHR NÖTIG!

# VERALTET: Container ohne Netzwerk starten
docker run -d --name corapan-webapp ...  # OHNE --network

# VERALTET: Temporäre Scripts unter /tmp/
/tmp/reset_admin.sh  # LÖSCHEN!
```

Alle Container-Operationen sollten über `scripts/deploy_prod.sh` erfolgen.

---

## Dateien & Pfade

| Pfad | Beschreibung |
|------|--------------|
| `/srv/webapps/corapan/app/` | Git-Repository (Code) |
| `/srv/webapps/corapan/config/passwords.env` | Umgebungsvariablen (Secrets) |
| `/srv/webapps/corapan/data/` | Datenbanken, Counter |
| `/srv/webapps/corapan/media/` | MP3s, Transkripte |
| `/srv/webapps/corapan/logs/` | Anwendungs-Logs |
| `/etc/postgresql/14/main/` | PostgreSQL-Konfiguration |

---

## Kontakt & Eskalation

Bei Problemen:
1. Logs prüfen: `docker logs corapan-webapp --tail 100`
2. Diese Dokumentation konsultieren
3. GitHub Issues im Repository erstellen
