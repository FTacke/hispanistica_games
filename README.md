# Games.Hispanistica

**Games.Hispanistica** ist eine Webapp für interaktive, kompetenzbasierte Lernmodule im Bereich der spanischen Linguistik. Die Webapp entstand aus der hochschuldidaktischen Arbeit mit dem digitalen Lehrbuch *Spanische Linguistik @ School* und erweitert dieses um spielbasierte, gamifizierte Formate für Wiederholung, Anwendung und Selbstüberprüfung linguistischer Inhalte.

---

## Projektidee & fachlicher Hintergrund

Games.Hispanistica ist kein eigenständiges Lernprodukt, sondern eine didaktische Erweiterung des digitalen Lehrbuchs [*Spanische Linguistik @ School*](https://school.hispanistica.com/). Das Lehrbuch wurde entwickelt, um die Relevanz linguistischer Inhalte für schulische Vermittlungskontexte sichtbar zu machen. Games.Hispanistica knüpft daran an und überführt ausgewählte Kapitel in interaktive Quiz-Module, die zum Wiederholen, Üben und zur Selbstüberprüfung einladen.

### Inhaltliche Schwerpunkte

Die Webapp behandelt zentrale Themenbereiche der hispanistischen Linguistik:

- **Variation**: regionale, situative und soziolinguistische Unterschiede im Spanischen
- **Phonetik und Phonologie**: Aussprachevariation (z. B. Distinción, Seseo, Yeísmo)
- **Grammatik und Morphosyntax**: strukturelle Variation in Grammatik und Syntax
- **Orthographie**: Rechtschreibung und Normierung

Alle Themen sind so aufbereitet, dass sie sich sowohl für sprachwissenschaftliche Seminare als auch für die Vorbereitung auf Prüfungen oder unterrichtsbezogene Kontexte eignen.

### Zielgruppe

Die Webapp richtet sich primär an Studierende der Hispanistik und verwandter Fächer. Sie setzt grundlegendes linguistisches Verständnis voraus und ist als Ergänzung zu Lehrveranstaltungen und zum Selbststudium konzipiert.

---

## Zentrale Module der Webapp

### Quiz-Modul

Das Quiz-Modul ist das zentrale interaktive Format von Games.Hispanistica. Es umfasst:

- **Themenbasierte Quiz-Einheiten**: Jede Einheit behandelt ein spezifisches linguistisches Thema (z. B. *Variation in der Aussprache*, *Variation in der Grammatik*)
- **Schwierigkeitsstufen**: Fragen sind nach Schwierigkeitsgrad gestaffelt (1–5), um unterschiedliche Kenntnisstufen abzubilden
- **Spielmechaniken**: Timer, Joker (Ausschluss falscher Antworten), Live-Highscore
- **Anonyme Nutzung**: Quiz können ohne Registrierung gespielt werden; Highscore-Einträge erfolgen mit frei wählbaren Pseudonymen
- **Wiederaufnahme**: Unterbrochene Quiz-Durchläufe können später fortgesetzt werden

Jede Quiz-Einheit ist direkt mit einem Kapitel aus *Spanische Linguistik @ School* verknüpft und bietet Verweise auf die ausführliche fachliche Darstellung.

### Projekt-/Informationsseiten

Die Webapp enthält Seiten, die das Projekt, das didaktische Konzept und die offene Entwicklungsstruktur erklären:

- **Über das Projekt**: Entstehung, Verbindung zu *Spanische Linguistik @ School*, Beteiligung von Studierenden
- **Didaktisches Konzept**: Rolle von Gamification, Studierende als Produzierende, Einbettung in die Lehre
- **Offene Entwicklung**: Open Educational Resources, Open Source, Einsatz von generativer KI für technische Umsetzung

---

## Didaktisches Konzept

### Gamification als didaktisches Mittel

Gamification ist in Games.Hispanistica kein spielerischer Zusatz, sondern ein gezieltes didaktisches Format. Die spielbasierten Module ermöglichen:

- niedrigschwelligen Einstieg in komplexe linguistische Themen
- mehrfaches, selbstgesteuertes Wiederholen von Inhalten
- direkte Rückmeldung zu Antworten und Lernfortschritt
- Überprüfung des eigenen Verständnisses

Im Unterschied zu statischen Übungen laden die Quiz-Formate dazu ein, Inhalte aktiv anzuwenden und gezielt an Verständnisschwierigkeiten zu arbeiten.

### Studierende als Mitgestaltende

Ein zentraler Bestandteil des Konzepts ist die Beteiligung von Studierenden an der Entwicklung der Inhalte. Studierende wirken in Lehrveranstaltungen mit, indem sie:

- Inhalte aus *Spanische Linguistik @ School* in Quiz-Formate überführen
- typische Verständnisschwierigkeiten identifizieren und in Fragen/Antworten abbilden
- Spielmechaniken und Aufgabenformate konzeptionell mitentwickeln

Wer Inhalte für andere aufbereitet, muss priorisieren, strukturieren und didaktisch begründen. Diese Form der Vermittlungsarbeit fördert nicht nur das fachliche Verständnis, sondern auch Kompetenzen in Wissensstrukturierung und adressatengerechter Darstellung.

Auf der Webapp werden Autorinnen und Autoren der Quiz-Einheiten namentlich genannt – als sichtbares Zeichen der gemeinsamen Arbeit an einem wachsenden Projekt.

### Einbettung in die Lehre

Games.Hispanistica ist fest in universitäre Lehrveranstaltungen eingebunden:

- Einsatz in Seminaren zur Wiederholung und Vertiefung
- Nutzung im Kolloquium für Examenskandidatinnen und -kandidaten zur Prüfungsvorbereitung
- Entwicklung neuer Module als Studien- und Prüfungsleistung

Die Quiz-Module ersetzen keine theoretische Auseinandersetzung, sondern ergänzen sie um eine Ebene der Anwendung und Überprüfung.

---

## Technischer Überblick

### Technologie-Stack

Games.Hispanistica ist eine **server-seitig gerenderte Webanwendung** mit interaktiven JavaScript-Elementen:

- **Backend**: Python (Flask), SQLAlchemy (ORM), SQLite (Datenbank)
- **Frontend**: Jinja2 Templates, Material Design 3 (MD3) Tokens, vanilla JavaScript
- **Deployment**: Docker, nginx (Reverse Proxy)

Die Webapp ist modular aufgebaut: Game-Module (z. B. Quiz) sind als eigenständige Flask Blueprints organisiert und können unabhängig erweitert werden.

### Inhalte als JSON-Datenquellen

Die Quiz-Inhalte liegen als strukturierte JSON-Dateien im Repository vor (`content/quiz/topics/`). Diese werden beim Deployment in die Datenbank importiert. Die JSON-Struktur erlaubt es, Fragen, Antworten, Erklärungen, Schwierigkeitsgrade und Metadaten (Autorinnen/Autoren, Tags) maschinenlesbar zu verwalten.

### Offene Entwicklung mit generativer KI

Die technische Umsetzung von Games.Hispanistica wurde maßgeblich durch den Einsatz generativer KI ermöglicht. Konzeptionelle und didaktische Ideen, die von Studierenden und Lehrenden entwickelt wurden, konnten so in funktionierende, maßgeschneiderte Open-Source-Lösungen überführt werden – ohne Bindung an proprietäre Plattformen oder vorgefertigte Templates.

Diese Arbeitsweise wirkt als *Empowerment*: Didaktische Ideen lassen sich im Rahmen universitärer Lehre realisieren, ohne die Kontrolle über Inhalte, Struktur und Weiterverwendung aus der Hand zu geben.

---

## Projektstatus

Games.Hispanistica ist ein **experimentelles, offenes Projekt** in aktiver Entwicklung. Die Webapp ist funktionsfähig und wird in Lehrveranstaltungen eingesetzt, befindet sich jedoch in kontinuierlicher Weiterentwicklung.

Neue Quiz-Einheiten, zusätzliche Spielformate und weitere Inhalte können jederzeit hinzugefügt werden. Die modulare Struktur erlaubt es, das Projekt schrittweise zu erweitern, ohne bestehende Funktionalität zu beeinträchtigen.

Der Quellcode ist öffentlich auf [GitHub](https://github.com/FTacke/hispanistica_games) verfügbar und wird offen entwickelt.

---

## Abgrenzung: Was Games.Hispanistica nicht ist

- **Kein vollständiger Linguistik-Kurs**: Die Webapp setzt linguistische Grundkenntnisse voraus und ist als Ergänzung zu Lehrveranstaltungen und zum Lehrbuch *Spanische Linguistik @ School* konzipiert, nicht als eigenständiger Kurs.
- **Keine Lernplattform mit persistenten Accounts**: Es gibt kein User-Management für Lernende. Quiz können anonym gespielt werden; Highscore-Einträge erfolgen mit frei wählbaren Pseudonymen.
- **Keine automatisierte Prüfungssoftware**: Die Quiz dienen der Selbstüberprüfung und Wiederholung, nicht der formellen Leistungsbewertung.
- **Kein abgeschlossenes Produkt**: Games.Hispanistica ist als offenes, wachsendes Projekt angelegt. Es wird kontinuierlich weiterentwickelt und ist nicht auf einen finalen Zustand ausgelegt.

---

## Dokumentation

### Produktionshinweis

Der Produktionsdeploy läuft über Docker Compose auf einem Self-Hosted GitHub Actions Runner. Das kanonische Deploy-Skript erzwingt dabei immer den expliziten Compose-Projektnamen `games-hispanistica-prod`, damit der Stack niemals einen generischen Verzeichnisnamen wie `infra` erbt und nicht mit anderen Compose-Stacks kollidiert. Das Skript kann das dedizierte games-Backend-Netz bei Bedarf selbst erzeugen, ersetzt vor dem Compose-Start gezielt nur den Legacy-Container `games-webapp` und bleibt strikt ohne Fallback auf Host-Postgres, `host.docker.internal` oder fremde Ressourcen.

### Technische Dokumentation

- **[startme.md](startme.md)** – Lokales Setup für Entwicklung
- **[docs/QUICKSTART.md](docs/QUICKSTART.md)** – Detaillierte Installationsanleitung
- **[docs/components/quiz/ARCHITECTURE.md](docs/components/quiz/ARCHITECTURE.md)** – Architektur des Quiz-Moduls
- **[games_hispanistica_production.md](games_hispanistica_production.md)** – Produktions-Deployment

### Inhalts-Dokumentation

- **[content/quiz/README.md](content/quiz/README.md)** – Struktur und Workflow für Quiz-Inhalte
- **[docs/components/quiz/CONTENT.md](docs/components/quiz/CONTENT.md)** – JSON-Schema für Quiz-Einheiten

---

## Python-Version (autoritativ)

- **Prod/CI:** Python `3.12` (latest Patch über Docker/CI)
- **Dev-Target:** Python `3.12.10` (`.python-version`)
- **Maßgebliche Quellen:**
  - `Dockerfile`: `FROM python:3.12-slim` (Builder + Runtime)
  - `.github/workflows/ci.yml`: `python-version: "3.12"`
  - `.github/workflows/md3-lint.yml`: `python-version: "3.12"`
- **Klarer Hinweis:** Wenn Docker/CI auf Patchlevel gepinnt werden sollen, dort explizit `3.12.10` setzen.

## Setup (Windows, copy-paste)

```powershell
git clone https://github.com/FTacke/hispanistica_games.git
cd hispanistica_games
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
.\scripts\bootstrap.ps1
python -m src.app.main
```

Optional für zusätzliche Dev-Tools:

```powershell
.\scripts\bootstrap.ps1 -Dev
```

Wenn `.env` fehlt, gibt `scripts/bootstrap.ps1` nur einen Hinweis aus und verändert keinen bestehenden Zustand.

---

## Quellenverzeichnis

Diese README basiert auf folgenden Templates und Projektdokumenten:

- [templates/pages/projekt_ueber.html](templates/pages/projekt_ueber.html) – Projektbeschreibung, Entstehung, Bezug zu *Spanische Linguistik @ School*
- [templates/pages/projekt_konzept.html](templates/pages/projekt_konzept.html) – Didaktisches Konzept, Gamification, Studierende als Produzierende
- [templates/pages/projekt_entwicklung.html](templates/pages/projekt_entwicklung.html) – Offene Entwicklung, Open Source, Rolle von KI
- [templates/pages/index.html](templates/pages/index.html) – Überblick über verfügbare Module
- [content/quiz/topics/variation_aussprache.json](content/quiz/topics/variation_aussprache.json) – Beispiel für Quiz-Inhalte (Variation in der Aussprache)
- [game_modules/quiz/manifest.json](game_modules/quiz/manifest.json) – Technische Struktur des Quiz-Moduls

### Bewusste Abgrenzungen

Folgende Aspekte wurden bewusst nicht behauptet, da sie aus den Templates und dem Code nicht klar ableitbar sind:

- **Zukunftspläne**: Keine konkreten Ankündigungen zu geplanten Features oder Modulen (außer allgemeiner Hinweis auf offene Weiterentwicklung)
- **Pädagogische Wirksamkeit**: Keine Aussagen zur empirischen Lernwirksamkeit der Gamification-Formate (da nicht empirisch untersucht)
- **Vollständigkeit der Inhalte**: Kein Anspruch auf vollständige Abdeckung linguistischer Themengebiete
- **Technische Details**: Nur grobe Übersicht des Tech-Stacks, da detaillierte Architektur in separaten Dokumenten liegt

- **User Management** (`/auth/admin_users`):
  - Create users with invite links
  - Edit user details (email, role, status)
  - Reset user passwords
  - Search and filter users
- **Self-Service**:
  - Change own password (`/auth/account/password/page`)
  - View/edit profile (`/auth/account/profile/page`)

### Design System

The application uses Material Design 3 (MD3) with a custom color scheme:

- **Primary**: `#0F4C5C`
- **Secondary**: `#276D7B`

Color tokens are defined in `static/css/branding.css`.

## ENV-Variablen

Secrets gehören in `.env` (gitignored) und sollen aus Secret-Manager/Deployment-Umgebung injiziert werden (z. B. Docker Secrets, CI Secrets, Vault).

| Variable | Zweck |
|---|---|
| `FLASK_SECRET_KEY` | Signiert Flask-Session-Cookies. |
| `JWT_SECRET_KEY` | Signiert JWTs bei symmetrischer Konfiguration (`HS256`). |
| `AUTH_DATABASE_URL` | Verbindungs-URL zur Auth-Datenbank. |
| `QUIZ_DATABASE_URL` | Verbindungs-URL zur Quiz-Datenbank. |
| `AUTH_HASH_ALGO` | Passwort-Hash-Algorithmus für Auth-Accounts (`argon2` oder `bcrypt`). |
| `FLASK_ENV` | Laufmodus der App (`development`, `production`, `testing`). |
| `JWT_ALG` | JWT-Algorithmus (z. B. `HS256`, `RS256`). |
| `JWT_PRIVATE_KEY_PATH` | Pfad zum privaten JWT-Schlüssel bei asymmetrischer Signatur. |
| `JWT_PUBLIC_KEY_PATH` | Pfad zum öffentlichen JWT-Schlüssel zur Verifikation. |

## Development

### Running Tests

```bash
pytest -v
```

### Code Style

```bash
ruff check .
mypy src/
```

## License

See [LICENSE](LICENSE) for details.
