# Games Production Fix

## 1. Executive Summary

- `games.hispanistica.com` liefert aktuell `502 Bad Gateway`, weil nginx auf `127.0.0.1:7000` proxyt, der dort laufende `games`-Container aber vor dem Gunicorn-Bind abstirbt.
- Der unmittelbare Startfehler ist ein fehlerhafter PostgreSQL-Zugriffspfad: `games` versucht aktuell `AUTH_DATABASE_URL=postgresql://games_app:***@172.18.0.1:5432/games_hispanistica` und erreicht diese Adresse aus seinem Container nicht.
- `corapan` ist stabil, weil es nicht über Host-Routing, sondern über Docker-Service-Discovery arbeitet: `corapan-web-prod` spricht `AUTH_DATABASE_URL=...@db:5432/corapan_auth` innerhalb seines dedizierten Produktionsnetzes.
- Es gibt auf dem Server derzeit keinen bereits bestehenden dedizierten PostgreSQL-Service, den `games` sauber und betrieblich vertretbar übernehmen sollte.
- Empfehlung: Das `games`-Repo soll auf ein kanonisches Docker-Compose-Produktionsmodell mit lokal veröffentlichtem Web-Port `127.0.0.1:7000:5000` und einem dedizierten, per Docker-Service-Namen erreichbaren PostgreSQL-Ziel umgestellt werden. Dieses Ziel ist **nicht** `corapan-db-prod`, **nicht** Host-Postgres und **nicht** `host.docker.internal`, sondern ein separat bereitgestellter dedizierter DB-Service, z. B. `games-db-prod` auf einem dedizierten Backend-Netz.

## 2. Verified Current State

### nginx / Upstream

- Die aktive nginx-Site für `games` proxyt auf `127.0.0.1:7000`.
- nginx ist gesund: `nginx -t` erfolgreich, `nginx.service` aktiv.
- `curl -I http://127.0.0.1:7000` endet mit `Recv failure: Connection reset by peer`.
- `curl -k -I https://games.hispanistica.com` liefert `HTTP/2 502`.

### Aktuelles games-Laufzeitmodell

- Laufzeit ist aktuell ein Einzelcontainer: `games-webapp`.
- Containerstatus: `unhealthy`, hoher RestartCount.
- Startmodell kommt aus `scripts/deploy/deploy_prod.sh` und verwendet `docker build` plus `docker run`, nicht `docker compose`.
- Effektive Container-Umgebung enthält derzeit:
  - `AUTH_DATABASE_URL=postgresql://games_app:***@172.18.0.1:5432/games_hispanistica`
  - `DOCKER_NETWORK=corapan-network`
  - `DB_WAIT_SECONDS=120`
- `host.docker.internal` ist im laufenden Container nicht auflösbar.
- Im Container lauscht lokal nichts stabil auf `127.0.0.1:5000`, weil der Entrypoint vor dem App-Start abbricht.

### Aktueller DB-Pfad von games

- Der Entrypoint wartet auf PostgreSQL anhand der gesetzten DSN.
- Aktueller Zielpfad ist `172.18.0.1:5432`.
- TCP-Connectivity aus dem Container auf `172.18.0.1:5432` läuft in ein Timeout.
- Der Container-Log endet konsistent mit `Database not ready after 120 seconds`.

### Status von corapan

- `corapan` läuft stabil als Docker-Compose-Produktionsstack.
- Relevante Container:
  - `corapan-web-prod`
  - `corapan-db-prod`
  - `corapan-blacklab`
- `corapan-web-prod` ist `healthy` und veröffentlicht `127.0.0.1:6000->5000/tcp`.
- `corapan-web-prod` verwendet intern `AUTH_DATABASE_URL=postgresql+psycopg2://corapan_app:***@db:5432/corapan_auth`.
- Der Hostname `db` ist innerhalb von `corapan-network-prod` auflösbar und per TCP erreichbar.

### Identifizierte bestehende DB-Dienste

- Host-Postgres:
  - Systemdienst `postgresql@14-main.service` läuft.
  - TCP-Bind aktuell nur auf `127.0.0.1:5432` sichtbar.
  - Datenbanken `games_hispanistica` und `games_hispanistica_quiz` existieren dort.
- `corapan-db-prod`:
  - dedizierter PostgreSQL-Container für `corapan`.
  - läuft ausschließlich auf `corapan-network-prod`.
  - Alias innerhalb des Netzes: `db`.
  - Zweckbindung: `POSTGRES_DB=corapan_auth`.
- `hedgedoc_db`:
  - dedizierter PostgreSQL-Container für HedgeDoc.
  - läuft ausschließlich auf `hedgedoc_hedgedoc_net`.
  - Alias innerhalb des Netzes: `db`.
  - Zweckbindung: `POSTGRES_DB=hedgedoc`.

### Harter Befund zu nutzbaren dedizierten DB-Services

- Es gibt **keinen** vorhandenen dedizierten DB-Service, der heute als allgemeiner, app-unabhängiger Ziel-DB-Service für `games` bereitsteht.
- `corapan-db-prod` und `hedgedoc_db` sind beide app-spezifisch, in app-spezifischen Netzen isoliert und nicht als plattformweiter DB-Service vorgesehen.
- Host-Postgres ist zwar vorhanden, ist aber gerade **kein** dedizierter Docker-Service und wird aus `games` nur über fragile Host-Routing-Pfade erreicht.

## 3. Architecture Decision

### Entscheidung

- `games` soll **nicht** an `corapan-db-prod` angebunden werden.
- `games` soll **nicht** an `hedgedoc_db` angebunden werden.
- `games` soll **nicht** weiter an Host-Postgres über `172.18.0.1`, `localhost` im Container oder `host.docker.internal` angebunden bleiben.
- Für `games` gibt es derzeit **keinen geeigneten bereits bestehenden dedizierten DB-Service**.
- Die Zielarchitektur für das Repo soll daher ein Compose-gesteuerter `games`-Webstack sein, der an einen **separat bereitgestellten dedizierten PostgreSQL-Service** über Docker-Service-Discovery andockt, z. B.:
  - Hostname: `games-db-prod`
  - Port: `5432`
  - Datenbanken: `games_hispanistica`, `games_hispanistica_quiz`
  - Netzwerk: dediziertes Backend-Netz, z. B. `games-backend-prod`

### Begründung

- `corapan` ist robust, weil App und DB in einem klaren Docker-Service-Discovery-Modell laufen.
- Dieser Mechanismus ist die relevante Referenz, nicht die konkrete Wiederverwendung von `corapan`-Ressourcen.
- Eine Kopplung von `games` an `corapan-db-prod` würde `games` technisch und betrieblich an einen fremden Stack binden:
  - fremde Container-Lifecycle-Grenzen,
  - fremder Datenbankzweck (`corapan_auth`),
  - fremdes Netz,
  - riskante Querabhängigkeit zu einer produktiven Referenzanwendung.
- Host-Postgres ist für Containerzugriff derzeit nur über Bridge-/Host-Tricks erreichbar und ist damit ausdrücklich nicht das Zielmodell.

### Warum Host-IP-, localhost- und host.docker.internal-Pfade verworfen werden

- `172.18.0.1` ist ein Docker-Bridge-Gateway und kein stabiler app-semantischer Dienstname.
- `localhost` im Container zeigt auf den Container selbst, nicht auf den Host.
- `host.docker.internal` ist auf diesem Linux-Server nicht automatisch verfügbar und war im laufenden `games`-Container nicht auflösbar.
- Alle drei Varianten verlassen das robuste Muster aus dediziertem Netzwerk plus Service-Name.

### Produktive DB-Anforderung von games

- `games` braucht produktiv **zwei getrennte PostgreSQL-Datenbanken**:
  - Auth-DB über `AUTH_DATABASE_URL`
  - Quiz-DB über `QUIZ_DATABASE_URL`
- Das ist im Anwendungscode hart belegt:
  - `src/app/__init__.py` verlangt in Non-Test-Umgebungen sowohl funktionierende Auth- als auch Quiz-DB.
  - `src/app/extensions/sqlalchemy_ext.py` initialisiert einen separaten Quiz-Engine-Pfad.
- Ein dedizierter Ziel-DB-Service für `games` muss daher zwei logische DBs im selben PostgreSQL-Dienst bereitstellen.

## 4. Required Repo Changes

### Datei: `infra/docker-compose.prod.yml`

- Problem heute:
  - Datei enthält noch massive `corapan`-Artefakte.
  - Falsche Container-Namen (`corapan-web-prod`, `corapan-db-prod`).
  - Falsche DB-User/-Namen.
  - Falsche Mount-Pfade (`~/corapan/...`).
  - Falscher Port (`6000`).
  - Falsches Netz (`corapan-network-prod`).
  - Legacy-`DATABASE_URL` zusätzlich zu `AUTH_DATABASE_URL`.
- Ziel:
  - Kanonische Produktions-Compose-Datei für `games`.
  - `web`-Service aus dem Repo.
  - Kein Host-Postgres-Pfad.
  - Anbindung an extern bereitgestellten dedizierten DB-Service per Service-Name.
- Konkrete Änderung:
  - Datei komplett neu aufsetzen.
  - `web`-Service soll nur lokal `127.0.0.1:7000:5000` publishen.
  - `web`-Service soll an ein dediziertes externes Backend-Netz gehängt werden.
  - `AUTH_DATABASE_URL` und `QUIZ_DATABASE_URL` sollen explizit auf `games-db-prod:5432` zeigen.
  - `DATABASE_URL` im Produktionsmodell nicht mehr verwenden.
- Begründung:
  - Compose muss den produktiven Zielpfad modellieren, nicht das veraltete Einzelcontainer-/Host-DB-Modell.

### Datei: `scripts/deploy/deploy_prod.sh`

- Problem heute:
  - Einzelcontainer-Deploy mit `docker run`.
  - Hardcoded Shared-Netz-Logik (`corapan-network`).
  - Preflight prüft Host-Postgres-Reichweite statt dediziertem DB-Service.
  - Postdeploy-Assertions sind auf Einzelcontainer zugeschnitten.
- Ziel:
  - Kanonischer Compose-Deploypfad.
  - Verifikation eines externen dedizierten DB-Service-Namens im Backend-Netz.
- Konkrete Änderung:
  - Auf `docker compose --env-file ... -f infra/docker-compose.prod.yml up -d --build --force-recreate` umstellen.
  - Vor Deploy prüfen, dass das externe Backend-Netz existiert.
  - Vor Deploy oder unmittelbar nach Stack-Start DB-Erreichbarkeit gegen `games-db-prod:5432` testen.
  - Kein `docker run` mehr für die App.
  - Kein `--network corapan-network` mehr.
  - Keine `172.18.0.1`- oder `host.docker.internal`-Logik mehr.
- Begründung:
  - Das aktuelle Deploy-Skript ist die zentrale Quelle des Legacy-Laufzeitmodells.

### Datei: `.github/workflows/deploy.yml`

- Problem heute:
  - Workflow ist auf den alten Einzelcontainer-Deploy ausgerichtet.
  - `continue-on-error: true` maskiert Produktionsfehler.
- Ziel:
  - Fail-fast-Deploy eines Compose-basierten Produktionspfads.
- Konkrete Änderung:
  - `continue-on-error: true` entfernen.
  - Runner soll Checkout auf Ziel-Commit setzen und das neue `deploy_prod.sh` ausführen.
  - Finale Verifikation auf `games-web-prod` und `http://127.0.0.1:7000/health` umstellen.
- Begründung:
  - Produktionsfehler müssen den Workflow klar fehlschlagen lassen.

### Datei: `.env.prod.example`

- Problem heute:
  - Zeigt ein falsches Produktionsbeispiel mit `localhost:5432`.
  - Enthält keine saubere Darstellung der zwei produktiven Datenbanken.
- Ziel:
  - Operator-Dokumentation passend zum dedizierten DB-Service-Modell.
- Konkrete Änderung:
  - `AUTH_DATABASE_URL`- und `QUIZ_DATABASE_URL`-Beispiele auf `games-db-prod:5432` umstellen.
  - Keine Beispiele mit `localhost`, `172.18.0.1` oder `host.docker.internal`.
  - Klar dokumentieren, dass Auth- und Quiz-DB getrennte Datenbanken im selben dedizierten PostgreSQL-Dienst sind.
- Begründung:
  - Die Beispiel-Env ist aktuell irreführend und fördert genau den Pfad, der den 502 ausgelöst hat.

### Datei: `scripts/docker-entrypoint.sh`

- Problem heute:
  - Enthält Legacy-Hinweise für `host.docker.internal` und `172.18.0.1`.
  - Diagnose ist auf Host-DB-Routing zugeschnitten.
  - Führt beim Containerstart Logik aus, die sauberer in explizite Deploy-Schritte gehört.
- Ziel:
  - Schlanker Runtime-Entrypoint mit generischem Warten auf explizite PostgreSQL-DSNs.
- Konkrete Änderung:
  - Wartelogik auf `AUTH_DATABASE_URL` und `QUIZ_DATABASE_URL` verallgemeinern.
  - Alle Host-DB-spezifischen Hinweise entfernen.
  - Keine Hardcoded-Empfehlungen mehr für `host.docker.internal` oder Bridge-Gateways.
- Begründung:
  - Der Entrypoint soll das Zielmodell bestätigen, nicht das alte kompensieren.

### Datei: `scripts/setup_prod_db.py`

- Problem heute:
  - Nutzt nur `AUTH_DATABASE_URL`, was für Auth korrekt ist.
  - Erzwingt in Production faktisch immer Admin-Bootstrap-Parameter.
- Ziel:
  - Idempotentes Auth-DB-Setup; Bootstrap nur bei expliziter Erstinbetriebnahme.
- Konkrete Änderung:
  - `START_ADMIN_PASSWORD` nur verlangen, wenn `ADMIN_BOOTSTRAP=1` gesetzt ist.
  - Normale Deploys dürfen ohne Passwort-Reset durchlaufen.
- Begründung:
  - Produktionsdeploys sollen nicht an einer unnötigen Bootstrap-Zwangsbedingung scheitern.

### Datei: `scripts/init_quiz_db.py`

- Problem heute:
  - Nutzt derzeit fälschlich `AUTH_DATABASE_URL` statt explizit `QUIZ_DATABASE_URL`.
- Ziel:
  - Idempotentes Setup der Quiz-DB auf dem separaten Quiz-DSN.
- Konkrete Änderung:
  - Auf `QUIZ_DATABASE_URL` bzw. `QUIZ_DB_*` umstellen.
  - Quiz-Engine statt Auth-Engine initialisieren.
- Begründung:
  - `games` benötigt produktiv eine getrennte Quiz-DB; das Setup-Skript muss dieses Modell abbilden.

### Datei: `Dockerfile`

- Problem heute:
  - Kein Hauptblocker, aber der Image-Healthcheck ist knapper als beim Referenzsetup.
- Ziel:
  - Produktionssemantik primär in Compose; Image bleibt generisch.
- Konkrete Änderung:
  - Healthcheck-Werte an das endgültige Compose-Modell angleichen oder Compose den Image-Healthcheck explizit überschreiben lassen.
- Begründung:
  - Nicht kritisch, aber für konsistentes Betriebsverhalten sinnvoll.

### Weitere relevante Dateien

#### Datei: `infra/docker-compose.dev.yml`

- Problem heute:
  - Auch diese Datei enthält `corapan`-Artefakte und ist keine verlässliche `games`-Referenz.
- Ziel:
  - Entweder vollständig auf `games` korrigieren oder klar als Altlast markieren.
- Konkrete Änderung:
  - Im Zuge der Bereinigung umbenennen, korrigieren oder als nicht-kanonisch dokumentieren.

#### Datei: `docker-compose.yml`

- Problem heute:
  - Ebenfalls offenkundige `corapan`-Reste.
- Ziel:
  - Keine konkurrierende falsche Produktionsreferenz im Repo.
- Konkrete Änderung:
  - Entweder auf `games` korrigieren oder als Legacy-Datei entfernen/deklarieren.

#### Datei: `server_admin_config.md`

- Problem heute:
  - Beschreibt explizit das inzwischen verworfene Host-DB-/`host.docker.internal`-Modell.
- Ziel:
  - Dokumentation an die neue Zielarchitektur anpassen.
- Konkrete Änderung:
  - Nach technischer Umstellung auf den dedizierten DB-Service-Pfad umschreiben.

## 5. Canonical Configuration Targets

### Gewünschtes Laufzeitmodell

- `games` als Docker-Compose-Produktionsstack.
- App-seitig mindestens ein `web`-Service im Repo.
- DB-seitig ein **separat bereitgestellter dedizierter PostgreSQL-Service**, nicht Host-Postgres.

### Gewünschtes Netzwerkmodell

- Frontend-Port lokal auf dem Host:
  - `127.0.0.1:7000:5000`
- Zusätzlich dediziertes Docker-Backend-Netz für `games` und seinen DB-Service.
- Empfohlene Zielnamen:
  - Backend-Netz: `games-backend-prod`
  - DB-Service-Name: `games-db-prod`
  - Web-Container-Name: `games-web-prod`

### Gewünschte DB-DSNs

- Auth:
  - `AUTH_DATABASE_URL=postgresql+psycopg2://games_app:<PASSWORD>@games-db-prod:5432/games_hispanistica`
- Quiz:
  - `QUIZ_DATABASE_URL=postgresql+psycopg2://games_app:<PASSWORD>@games-db-prod:5432/games_hispanistica_quiz`

### Gewünschte Healthchecks

- DB-Preflight:
  - `pg_isready -h games-db-prod -p 5432 -U games_app -d games_hispanistica`
  - optional zusätzlich Quiz-DB prüfen.
- Web-Health:
  - `curl -f http://localhost:5000/health` im Container.
  - `curl -f http://127.0.0.1:7000/health` auf dem Host.

### Gewünschte Deploy-Reihenfolge

1. Server-Checkout auf Ziel-Commit setzen.
2. Compose-Konfiguration validieren.
3. Sicherstellen, dass dediziertes Backend-Netz vorhanden ist.
4. Sicherstellen, dass dedizierter DB-Service `games-db-prod` im Backend-Netz erreichbar ist.
5. `games`-Webservice per Compose neu erzeugen.
6. Auth-DB-Setup explizit ausführen.
7. Quiz-DB-Setup explizit ausführen.
8. Host-seitigen Healthcheck auf `127.0.0.1:7000/health` durchführen.

### Was explizit nicht mehr verwendet werden darf

- `172.18.0.1` als primärer DB-Host.
- `localhost` als DB-Host im Container.
- `host.docker.internal` als Produktionspfad.
- `docker run` als kanonischer Produktionsdeploy für `games`.
- stillschweigender Fallback auf `DATABASE_URL` im Produktionspfad.

## 6. Patch Guidance For Repo Agent

### Ziel-Compose-Struktur

- Das Repo soll einen kanonischen Produktionspfad unter `infra/docker-compose.prod.yml` bekommen.
- Diese Datei soll `games` als Webservice beschreiben und an ein **externes dediziertes Backend-Netz** anschließen.
- Die Datei soll **nicht** `corapan`-Artefakte enthalten.
- Wenn der DB-Service außerhalb des Repos bereitgestellt wird, soll die Compose-Datei diesen nicht neu definieren, sondern seine Erreichbarkeit über Netzwerk und DSNs voraussetzen.

### DB-Anbindung von games

- `AUTH_DATABASE_URL` und `QUIZ_DATABASE_URL` müssen explizit gesetzt sein.
- Beide DSNs sollen auf denselben dedizierten PostgreSQL-Service zeigen, aber auf zwei getrennte Datenbanken.
- Service-Discovery muss über Docker-Netz plus Hostname erfolgen, nicht über Host-Routing.

### Auth- und Quiz-DB

- Auth-DB:
  - DB-Name `games_hispanistica`
  - Nutzung durch `scripts/setup_prod_db.py`
- Quiz-DB:
  - DB-Name `games_hispanistica_quiz`
  - Nutzung durch `scripts/init_quiz_db.py`
- Der Repo-Agent soll die beiden DB-Pfade nicht zusammenlegen.

### Deploy-Workflow

- GitHub-Workflow soll fail-fast sein.
- `deploy_prod.sh` soll Compose verwenden.
- Preflight soll prüfen:
  - Compose verfügbar
  - Backend-Netz vorhanden
  - dedizierter DB-Service auflösbar/reachbar
- Postdeploy soll prüfen:
  - Container läuft
  - Healthcheck erfolgreich
  - Auth- und Quiz-Setup erfolgreich

### Zu entfernende Legacy-Logik

- `docker run`-Deploypfad
- Netzname `corapan-network` für `games`
- jegliche `172.18.0.1`-Verwendung
- jegliche `host.docker.internal`-Produktionslogik
- `localhost`-Beispiele für Container-DB-Zugriff in Produktivdokumentation
- irreführende `corapan`-Dateiinhalte in `games`-Compose-Dateien

## 7. Risks / Migration Notes

### Gesicherte Fakten

- `games` benötigt produktiv zwei PostgreSQL-Datenbanken.
- Es gibt derzeit keinen geeigneten vorhandenen dedizierten DB-Service für `games`.
- `corapan-db-prod` und `hedgedoc_db` sind app-spezifisch und sollen nicht wiederverwendet werden.

### Datenmigration

- Falls `games` von Host-Postgres auf einen dedizierten PostgreSQL-Service wechselt, müssen beide produktiven Datenbanken migriert werden:
  - `games_hispanistica`
  - `games_hispanistica_quiz`
- Repo-Änderungen allein genügen dafür nicht.

### Kompatibilitätsrisiken

- Das Repo kann auf ein sauberes Zielmodell umgestellt werden, aber ohne separat bereitgestellten dedizierten DB-Service bleibt der Live-Cutover unvollständig.
- Dokumentationsreste im Repo können Operatoren weiter auf das falsche Host-DB-Modell lenken, wenn sie nicht mitbereinigt werden.

### Rollback-Hinweise

- Kein Rollback über Änderungen an `corapan`.
- Kein Rollback über Reaktivierung von `172.18.0.1` als Zielarchitektur.
- Rollback bedeutet ausschließlich Rücknahme der `games`-Repo-/Deploy-Umstellung oder temporäre Rückkehr zum alten `games`-Deploypfad, falls betrieblich notwendig.

### Verbleibende Annahmen / offene Punkte

- **Gesicherter Fakt:** Es gibt heute keinen geeigneten bestehenden dedizierten DB-Service für `games`.
- **Empfehlung:** Ein dedizierter DB-Service mit Hostname `games-db-prod` auf einem dedizierten Backend-Netz soll bereitgestellt werden.
- **Offener Infrastrukturpunkt:** Die konkrete Provisionierung dieses dedizierten DB-Service ist **nicht** Teil des `games`-Repos und muss separat erfolgen.

## 8. Final Recommendation

1. `games` nicht länger an Host-Postgres über `172.18.0.1`, `localhost` oder `host.docker.internal` koppeln.
2. `corapan-db-prod` nicht als Ziel-DB-Service für `games` wiederverwenden.
3. `games`-Produktionspfad vollständig auf Docker Compose umstellen.
4. `infra/docker-compose.prod.yml` inhaltlich neu auf `games` zuschneiden.
5. `AUTH_DATABASE_URL` und `QUIZ_DATABASE_URL` explizit auf einen dedizierten Service-Namen wie `games-db-prod:5432` ausrichten.
6. `deploy_prod.sh` von `docker run` auf `docker compose` umstellen.
7. Den GitHub-Workflow fail-fast machen und an den Compose-Deploy koppeln.
8. `scripts/init_quiz_db.py` auf die Quiz-DB korrigieren.
9. `scripts/docker-entrypoint.sh` von Host-DB-Altlogik bereinigen.
10. Erst nach Repo-Umstellung und separater Bereitstellung eines dedizierten DB-Service den produktiven Cutover planen.