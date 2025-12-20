````md
# create_hispanistica-games.md

Ziel: Aus `corapan-webapp` ohne History eine neue Webapp `hispanistica_games` erstellen, auf “Games”-Use-Case reduzieren (prune), Branding setzen (`games.hispanistica`), neue Startseiten (Gamification/Quiz) anlegen, bestehendes Impressum/Datenschutz unverändert behalten, und das MD3-Farbtoken-Set integrieren.

Wichtige Vorgaben:
- Repo/Projektname lokal + GitHub: `hispanistica_games`
- Keine Git-History aus `corapan-webapp` übernehmen
- Domain/Brandname: `games.hispanistica`
- Impressum + Datenschutz: 1:1 beibehalten
- Index: Cards zu “Gamification” und “Quiz”
- Navigation: Einträge zu “Gamification” und “Quiz”
- Für beide: zunächst simple Textpage (keine Quiz-Logik)
- Farben: Primary `#0F4C5C`, Secondary `#276D7B`
- Farbtoken-Datei existiert bereits: `docs_migration/md3-color-tokens_games-hispanistica.md`

---

## Phase 0 — Vorab: lokale Voraussetzungen prüfen
1) Stelle sicher, dass du Zugriff auf das neue GitHub-Repo hast:
   - `FTacke/hispanistica_games` existiert (leer), oder wird vorab erstellt.
2) Lokal verfügbar:
   - `git`
   - passende Runtime/Tooling (Node/Python/etc.) wie im Template-Repo dokumentiert
3) Lege fest, wie deployt werden soll (nur vorbereiten, noch nicht final konfigurieren):
   - z.B. VM, Vercel, GitHub Pages o.ä.
   - Für diese Phase reicht: **lokaler Build + Tests grün**

Akzeptanzkriterium: Du kannst `git --version` ausführen und hast Schreibrechte auf `FTacke/hispanistica_games`.

---

## Phase 1 — Repository erstellen (ohne History) + Remote setzen

### 1.1 Klonen in neues Verzeichnis
```bash
cd <dein-workspace>
git clone https://github.com/FTacke/corapan-webapp hispanistica_games
cd hispanistica_games
````

### 1.2 History entfernen und neues Git initialisieren

```bash
rm -rf .git
git init
git branch -M main
```

### 1.3 Neues Origin setzen

```bash
git remote add origin git@github.com:FTacke/hispanistica_games.git
git remote -v
```

Akzeptanzkriterium:

* `git status` funktioniert
* `git remote -v` zeigt ausschließlich `FTacke/hispanistica_games`

---

## Phase 2 — “Hard Prune” auf Games-Minimalzustand

Ziel: Alles entfernen, was nicht für eine simple Games-Site + Admin-geschützten Bereich (optional) gebraucht wird.

### 2.1 Module entfernen (gemäß Absprache)

Entfernen:

* Corpus / Search
* Player / Audio
* Atlas / Statistics
* Analytics
* Audit Logs
* Rollen/RBAC-Komplexität (weil Single Admin)

Behalten:

* App-Shell (Layout, Navigation, MD3 UI, Theme)
* Public Pages (Index, Impressum, Datenschutz)
* Minimal Auth nur, falls Admin-Bereich existiert (ansonsten Auth kann ebenfalls später rein)

### 2.2 Vorgehen beim Pruning (sequenziell, commitfähig)

1. Identifiziere im Repo die Feature-Blöcke:

   * Routen (public/private)
   * Templates/Pages
   * Services/DB-Migrations/Seeds
   * Tests/CI-Checks
2. Entferne Feature-Blöcke **in dieser Reihenfolge**, damit der Build schnell wieder grün wird:

   1. Public Navigation/Links bereinigen (damit keine Dead Links)
   2. Routen entfernen (Corpus/Player/Analytics/Audit)
   3. Templates/Pages entfernen, die nur dazu gehören
   4. DB-Migrations/Seeds entfernen/neutralisieren
   5. Tests aktualisieren (keine Tests mehr auf entfernte Routen/Features)
   6. `grep` auf Referenzen: keine alten Begriffe mehr
3. Stelle sicher, dass `LOKAL/` grundsätzlich ignoriert bleibt (falls im Repo vorhanden/entsteht).

Akzeptanzkriterien:

* Lokaler Build/Run funktioniert
* Tests/Checks grün
* Keine toten Links im Nav
* Keine DB-Migrations, die auf entfernte Features verweisen

### 2.3 Prune-Commit-Strategie (klein und nachvollziehbar)

Empfohlene Commits:

1. `chore: remove corpus/player modules`
2. `chore: remove analytics and audit logging`
3. `chore: simplify auth (single-admin) or remove auth`
4. `test: update tests after pruning`
5. `docs: update README for games minimal`

---

## Phase 3 — Branding: games.hispanistica

### 3.1 Brandname im UI setzen

* Setze App-Name/Title überall konsistent auf:

  * `games.hispanistica`

Typische Stellen:

* HTML `<title>` Default
* Header/Brand in Navigation
* README/Meta

Akzeptanzkriterium:

* In der laufenden App steht im Header/Title “games.hispanistica”.

### 3.2 README anpassen

* Projektname: `hispanistica_games`
* Kurzbeschreibung: “Games platform for hispanistica (Gamification modules such as quizzes).”
* Quickstart Steps aktualisieren (nur Minimal-Features, keine Corpus/Analytics Hinweise).

---

## Phase 4 — Pages: Index + Gamification + Quiz

### 4.1 Zwei neue Public Pages erstellen

Erstelle:

* `Gamification` (simple Textpage)
* `Quiz` (simple Textpage)

Inhalte (minimal, erstmal nur Platzhalter):

* Kurzer Absatz: was ist das, was kommt später
* Hinweis: “Coming soon / In Arbeit”

Akzeptanzkriterium:

* `/gamification` lädt
* `/quiz` lädt

### 4.2 Navigation ergänzen

* In den Navigation Drawer/Topbar:

  * Gamification → `/gamification`
  * Quiz → `/quiz`

Akzeptanzkriterium:

* Nav-Links funktionieren, kein 404.

### 4.3 Index Cards bauen

Auf der Startseite:

* Card 1: “Gamification” + Kurztext + Link `/gamification`
* Card 2: “Quiz” + Kurztext + Link `/quiz`

Akzeptanzkriterium:

* Startseite zeigt genau zwei Cards, Links funktionieren.

---

## Phase 5 — Impressum & Datenschutz unverändert

* Stelle sicher, dass:

  * Impressum Route/Seite unverändert existiert
  * Datenschutz Route/Seite unverändert existiert
* Nur Branding im Header darf sich ändern (die Inhalte 1:1 lassen).

Akzeptanzkriterium:

* Impressum/Datenschutz laden und Inhalt entspricht dem vorherigen Stand.

## Phase 6 — MD3 Theme: Color Tokens **systematisch** in CSS übertragen (aktualisiert)

Ziel: Die Token aus `docs_migration/md3-color-tokens_games-hispanistica.md` werden **nicht nur dokumentiert**, sondern **1:1 als Source of Truth in die CSS-Theme-Dateien** des Projekts übertragen, damit die UI wirklich überall konsistent ist (Light + Dark).

### 6.0 Vorarbeit: Theme-Mechanik im Repo identifizieren
1) Finde heraus, wo das Projekt aktuell die MD3-Farben definiert:
   - globale CSS Variables (z.B. `:root`, `[data-theme="dark"]`, `.dark`)
   - oder Theme-Dateien (z.B. `theme.css`, `md3.css`, `tokens.css`, `variables.css`)
   - oder per Build-Step (z.B. Tailwind config, TS-Theme-Objekt)
2) Dokumentiere kurz im Commit/Report:
   - *Welche Datei ist maßgeblich?*
   - *Wie wird Dark Mode geschaltet?* (Attribute/Class)

Akzeptanzkriterium:
- Es gibt eine klare Liste: `LIGHT_TOKENS_FILE`, `DARK_TOKENS_FILE` (kann auch dieselbe Datei mit zwei Blöcken sein).

---

### 6.1 Token-Set in CSS-Variablen abbilden (Light + Dark)
Übertrage die Tokens **systematisch** in die CSS-Dateien:

**Light**
- In `:root` (oder dem Light-Selector) Variablen setzen, z.B.:
  - `--md-sys-color-primary: #0F4C5C;`
  - `--md-sys-color-secondary: #276D7B;`
  - usw. (alle Tokens aus der MD-Datei)

**Dark**
- In dem Dark-Selector (z.B. `[data-theme="dark"]` oder `.dark`) die Dark-Werte setzen:
  - `--md-sys-color-primary: #7FA7B2;`
  - `--md-sys-color-secondary: #8DB4BE;`
  - usw.

Wichtig:
- **Alle** benötigten MD3 System-Colors abbilden, mindestens:
  - `primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`
  - `secondary`, `onSecondary`, `secondaryContainer`, `onSecondaryContainer`
  - `background`, `onBackground`, `surface`, `onSurface`
  - `surfaceVariant`, `onSurfaceVariant`
  - `outline`, `outlineVariant`
  - `error`, `onError`, `errorContainer`, `onErrorContainer`
- Zusätzlich (wenn im Projekt genutzt): `inverse*`, `surfaceContainer*`, `tertiary*`, `success/warning/info`

Akzeptanzkriterium:
- Es existiert eine CSS-Datei (oder ein konsistentes Set), die vollständig die Tokens enthält und im Build geladen wird.

---

### 6.2 Mapping prüfen: verwendete Variablennamen im Projekt
Nicht raten: im Code nachsehen, welche Variablen-Namen wirklich verwendet werden.
- Wenn das Projekt bereits `--md-sys-color-*` nutzt: beibehalten.
- Wenn es eigene Namen nutzt (z.B. `--color-primary`): sauberes Mapping herstellen:
  - entweder Alias-Variablen setzen
  - oder die Komponenten auf MD3-Variablen umstellen (klein halten, kein Refactor-Overkill)

Akzeptanzkriterium:
- Es gibt keine “doppelten Wahrheiten” (nicht zwei parallel gepflegte Token-Systeme ohne klare Hierarchie).

---

### 6.3 Smoke-Test + Regression-Check
1) Light Mode:
   - Background wirklich hell (`#F3F6F7`)
   - Primary Buttons/Links wirklich `#0F4C5C`
2) Dark Mode:
   - Kontrast ok, Text lesbar
   - Primary/Secondary sichtbar differenziert
3) Seiten prüfen:
   - Index Cards
   - Gamification/Quiz Page
   - Impressum/Datenschutz
   - Navigation Drawer + AppBar

Akzeptanzkriterium:
- Keine “komischen” Default-Farben mehr aus dem alten Projekt (visuell plausibel + konsistent).

---

### 6.4 Doku nur als Referenz (kein zusätzlicher Pflegeaufwand)
- `docs_migration/md3-color-tokens_games-hispanistica.md` bleibt als Dokumentationsquelle erhalten.
- Optional: In `/docs` eine kurze Seite “Theme” hinzufügen:
  - “Source of truth ist CSS Datei X”
  - “Dark Mode Selector ist Y”
  - “Token-Update-Prozess: MD → CSS”

Akzeptanzkriterium:
- Theme-Änderungen sind nachvollziehbar, ohne dass man raten muss.

---

### Commit-Empfehlung für Phase 6
1) `style: apply games.hispanistica md3 color tokens (light/dark)`
2) `docs: document theme token source of truth`

## Phase 7 — Laufzeit / DB / ENV minimalisieren

Ziel: Keine Alt-ENV-Variablen, keine unnötigen Services.

1. `env.example` (oder Äquivalent) reduzieren:

   * nur Variablen, die noch gebraucht werden
2. DB:

   * wenn aktuell zwingend: minimal schema
   * wenn nicht zwingend: DB optional machen (nur für späteres Quiz/Admin)

Akzeptanzkriterium:

* Setup-Doku enthält nur noch relevante Variablen/Schritte.

---

## Phase 8 — Qualitätsschranke: Tests, Lint, Build, Grep

Pflichtchecks (je nach Repo-Tooling):

* `test`
* `lint`
* `typecheck`
* `build`

Zusätzlich:

* `grep` nach Alt-Begriffen (muss 0 Treffer liefern oder bewusst erklärt sein):

  * corpus
  * blacklab
  * player
  * audio
  * analytics
  * audit_log
  * atlas
  * statistics

Akzeptanzkriterium:

* Alles grün, keine toten Referenzen.

---

## Phase 9 — Erst-Commit + Push ins neue Repo

### 9.1 Initialer Commit (nach Phase 1 optional sofort, oder nach Phase 2)

Empfohlen: commit erst, wenn Pruning+Branding minimal stehen (damit main direkt brauchbar ist).

```bash
git add -A
git commit -m "Initialize hispanistica_games (games minimal)"
git push -u origin main
```

Akzeptanzkriterium:

* GitHub Repo enthält den Code
* CI (falls aktiviert) läuft grün oder ist nachvollziehbar konfiguriert.

---

## Phase 10 — Ergebnisdefinition (Definition of Done)

Die Arbeit ist fertig, wenn:

1. Repo `hispanistica_games` ist online, ohne Template-History
2. App startet lokal ohne Corpus/Player/Analytics/Audit
3. Pages vorhanden:

   * Index mit 2 Cards (Gamification/Quiz)
   * Gamification Textpage
   * Quiz Textpage
   * Impressum/Datenschutz unverändert
4. Branding: “games.hispanistica” sichtbar
5. Light/Dark Theme mit Token-Set integriert
6. Tests/Lint/Build grün
7. README/Docs sind konsistent und beschreiben das neue Minimal-Projekt

---

## Arbeitsmodus für den Agenten (wichtig)

* Arbeite sequenziell Phase für Phase.
* Nach jeder Phase:

  * kurz berichten: “Was geändert, welche Commands, Ergebnis”
  * Akzeptanzkriterien abhaken
* Keine großen Refactors. Nur zielgerichtete Änderungen.
* Kleine Commits, logisch getrennt.

```
```
