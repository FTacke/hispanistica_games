# Diagnose Quiz-Architektur: anonyme Parallelität, Persistenz und Spielmechanik

Stand: 2026-04-20

## Kurzfazit

Der aktuelle Eindruck ist korrekt: anonyme Spieler laufen serverseitig nicht auf getrennten Konten, sondern auf genau einem gemeinsamen Quiz-Player. Dadurch teilen mehrere anonyme Nutzer denselben laufenden Spielstand pro Topic. Das ist nicht nur ein theoretisches Architekturproblem, sondern wurde praktisch reproduziert.

Zusätzlich gibt es im Timeout-/Refresh-Pfad einen harten Fehler: `GET /api/quiz/run/<run_id>/state` kann nach automatischem Timeout mit HTTP 500 abbrechen. Selbst wenn dieser 500er provisorisch umgangen wird, ist der Zustandsautomat nach Timeout nicht stabil genug, um bei späteren Refreshes zuverlässig im erwarteten `POST_ANSWER`-Zustand zu bleiben.

Die Spielmechanik ist an mehreren Stellen bereits gut abgesichert, insbesondere bei serverbasierten Timern, Ownership-Checks und UI-Guards im Frontend. Die kritischen Schwachstellen liegen aktuell aber bei Identitätstrennung für anonyme Spieler, beim Timeout-Resume-Verhalten und bei fehlender Testabdeckung genau für diese Pfade.

## Untersuchungsumfang

Geprüft wurden:

- Backend-Modelle und Services für Player, Sessions, Runs, Answers und Scores
- Quiz-Routen für Auth, Run-Start, Status, State, Timerstart, Antwortabgabe und Finish
- Frontend-Logik in `static/js/games/quiz-play.js` für Resume, Timer, Timeout, Weiter-Übergänge und lokale Caches
- vorhandene Tests und deren Abdeckungsbild
- praktische Reproduktionen gegen eine isoliert gestartete Quiz-Postgres-Instanz auf Host-Port `54495`

Es wurden keine Anwendungsdateien geändert. Diese Datei ist die Diagnose.

## Zentrale Befunde

### 1. Anonyme Spieler teilen tatsächlich denselben Account

In `game_modules/quiz/services.py`, Funktion `register_player(...)`, wird bei `anonymous=True` explizit der erste Datensatz mit `QuizPlayer.is_anonymous` gesucht und wiederverwendet. Falls keiner existiert, wird genau ein Player `Anonym` angelegt und danach für weitere anonyme Sessions wiederverwendet.

Folge:

- verschiedene Browser oder Clients erhalten zwar unterschiedliche Session-Tokens
- diese Tokens zeigen aber auf denselben `quiz_players.id`
- da laufende Runs über `player_id + topic_id + status='in_progress'` gefunden werden, teilen sich diese Nutzer denselben Run

Das wird zusätzlich in `game_modules/quiz/services.py`, Funktion `get_current_run(...)`, bestätigt: dort ist die Zuordnung ausschließlich an `player_id`, `topic_id` und `status` gebunden.

### 2. Praktische Reproduktion: zwei anonyme Clients kollidieren vollständig

Ich habe die Architektur mit zwei unabhängigen Flask-Testclients gegen eine echte Quiz-Postgres-DB reproduziert.

Beobachtetes Ergebnis:

- beide anonyme Registrierungen lieferten denselben `player_id`
- der zweite Run-Start lieferte `is_new = False`
- beide Clients bekamen denselben `run_id`
- nach einer Antwort von Client A sah Client B sofort `current_index = 1`, `running_score = 10` und dieselbe Answer-Historie

Damit ist die Kernfrage beantwortet: mehrere anonyme Spieler können aktuell nicht sauber parallel spielen, weil sie serverseitig dieselbe Identität und denselben aktiven Run teilen.

### 3. Harter Fehler im Timeout-Refresh-Pfad: `/state` kann 500 werfen

In `game_modules/quiz/routes.py`, Funktion `api_get_run_state(...)`, wird beim automatischen Timeout folgender Codepfad ausgeführt:

- Timeout-Answer wird serverseitig erzeugt
- `run.current_index` wird erhöht
- Timerzustand wird gelöscht
- `run.time_limit_seconds = services.TIMER_SECONDS`

Problem:

- `game_modules/quiz/services.py` definiert `TIMER_SECONDS_NAMED` und `TIMER_SECONDS_ANON`, aber keine Konstante `TIMER_SECONDS`
- der Pfad produziert dadurch `AttributeError: module 'game_modules.quiz.services' has no attribute 'TIMER_SECONDS'`

Das wurde praktisch reproduziert: ein abgelaufener Run mit anschließendem `GET /api/quiz/run/<run_id>/state` endete mit HTTP 500.

### 4. Auch unterhalb des 500ers ist die Timeout-Phase nicht stabil

Für die reine Diagnose habe ich den fehlenden Konstantenzugriff temporär im Laufkontext übersteuert, um den darunterliegenden Zustand zu beobachten.

Ergebnis:

- erste `/state`-Antwort nach Auto-Timeout: `phase = NOT_STARTED`, `is_expired = true`, `last_answer_result = timeout`
- zweite `/state`-Antwort danach: `phase = NOT_STARTED`, `is_expired = false`, `last_answer_result = timeout`

Das bedeutet:

- der Server behandelt den Timeout nicht als stabilen `POST_ANSWER`-Zustand
- stattdessen springt er sofort auf die nächste Frage (`current_index += 1`)
- der Timeout bleibt nur indirekt über `last_answer_result` sichtbar
- bei späteren Refreshes fehlt sogar das Rettungsnetz `is_expired = true`

Die Frontend-Logik in `static/js/games/quiz-play.js`, Funktion `loadStateForResume()`, setzt `POST_ANSWER` nur dann sicher, wenn `stateData.phase === 'POST_ANSWER'` oder `stateData.is_expired` wahr ist. Beim zweiten Refresh nach Timeout trifft beides nicht mehr zu. Dann fällt der Client auf `NOT_STARTED` zurück und startet faktisch direkt die nächste Frage.

Folge:

- Timeout-Feedback kann bei späterem Refresh verloren gehen
- das Verhalten ist nicht deterministisch genug für robuste Resume-Semantik

### 5. Browser-/Tab-Isolation ist zusätzlich clientseitig unzureichend

In `static/js/games/quiz-play.js` werden Run-ID und Score in `window.localStorage` gespeichert:

- `quiz:lastRunId:<topicId>`
- `quiz:lastScore:<runId>`

`localStorage` ist pro Origin browserweit geteilt, nicht pro Tab.

Das ist nicht die Hauptursache des aktuellen Serverfehlers, verschärft aber die Situation:

- mehrere Tabs desselben Browserprofils teilen Cachezustände
- die Quiz-Session läuft über Cookie `quiz_session`, das ebenfalls browserprofilweit geteilt ist

Selbst nach einer serverseitigen Trennung pro anonymem Spieler wäre damit paralleles anonymes Spielen in mehreren Tabs desselben Browserprofils noch nicht sauber isoliert.

### 6. Testabdeckung ist für die kritischen Pfade zu dünn

Vorhanden ist nur ein einfacher Happy-Path-Test für anonymes Spielen in `tests/test_quiz_module.py` (`test_anonymous_play`). Dieser prüft nur, dass ein anonymer Client grundsätzlich einen Run starten kann.

Nicht abgedeckt sind aktuell:

- zwei gleichzeitige anonyme Clients
- Run-Trennung zwischen anonymen Sessions
- Auto-Timeout in `/state`
- Refresh nach Timeout, insbesondere wiederholter Refresh
- Parallelität zwischen mehreren Browsern oder Tabs

Es existiert zwar ein Parallelitätstest in `tests/test_refresh_concurrency.py`, aber der betrifft Refresh-Tokens des Webapp-Auth-Systems, nicht das Quiz.

### 7. Doku- und Testverdrahtung wirken teilweise hinter der aktuellen Laufzeitarchitektur zurück

Mehrere Stellen beschreiben noch eine ältere Quiz-Realität, etwa 5 Difficulty-Stufen oder pauschale 30-Sekunden-Timer. Die aktive Laufzeitlogik verwendet dagegen `v2`-Mechanik, 3 Levels und getrennte Timer für anonyme und benannte Spieler.

Zusätzlich wirken einige Test-Fixtures so, als würden sie noch auf eine ältere DB-Verdrahtung zielen. Das ist kein direkter Produktionsfehler, aber ein Risiko für falsches Sicherheitsgefühl durch grüne oder gar nicht ausgeführte Tests.

## Was bereits robust wirkt

Trotz der kritischen Punkte gibt es mehrere solide Bausteine:

- Run-Zugriff wird in den API-Routen an `run_id` und `player_id` gebunden; Fremdzugriffe auf Runs werden sauber blockiert
- Timerlogik ist grundsätzlich serverbasiert ausgelegt, nicht rein clientseitig
- `QuizRunAnswer` hat eine Unique-Constraint auf `(run_id, question_index)` und schützt damit gegen doppelte Answer-Zeilen
- der Frontend-Code enthält bereits viele Schutzmechanismen gegen doppelte Timerstarts, parallele Transitions und doppelte Timeout-Submits
- `running_score` wird serverseitig als Quelle der Wahrheit behandelt und bei Bedarf über `/status` nachgezogen

Die Architektur ist also nicht generell instabil. Die Probleme konzentrieren sich auf einige hochkritische Zustandsübergänge.

## Bewertung der Spielmechanik im Detail

### Übergang von Frage zu Frage

Grundsätzlich sauber:

- Antwortabgabe erhöht den Index serverseitig
- Frontend hält `pendingTransition` und `nextQuestionIndex`
- `Weiter` und Auto-Advance sind gegen Doppeltrigger abgesichert

Risiko:

- beim Auto-Timeout wird der Index bereits im GET-Handler `/state` weitergeschoben
- dadurch ist das System stärker refresh- und reihenfolgeabhängig, als es sein sollte

### Markierungen und Antwortzustände

Grundsätzlich sauber:

- richtige/falsche Antworten werden im Frontend differenziert markiert
- Timeout hat eigene UI (`applyTimeoutUI()`), die bewusst keine richtige Antwort mehr aufdeckt
- es gibt Locks gegen erneutes Klicken während `POST_ANSWER`

Risiko:

- bei Refresh nach Timeout kann der Client später direkt in `NOT_STARTED` landen und diese UI-Stufe überspringen

### Countdown und Timer

Grundsätzlich sauber:

- Serverzeit ist die relevante Quelle
- Client arbeitet mit Offset und Countdown nur als Anzeige
- mehrere Timer-Guards reduzieren doppelte Starts

Kritisch:

- der Auto-Timeout-Pfad in `/state` ist aktuell faktisch defekt, weil er 500 werfen kann

### Refresh der Seite

Grundsätzlich gut gedacht:

- `/status` und `/state` sollen Resume und Score-Recovery ermöglichen
- Frontend hat spezielle Resume-Logik für `POST_ANSWER`, `ANSWERING` und `NOT_STARTED`

Aktuell nicht robust genug:

- Refresh nach Timeout ist nicht stabil
- wiederholter Refresh nach Timeout verliert die semantische `POST_ANSWER`-Phase
- bei anonymer Nutzung führt Refresh außerdem nicht auf eine isolierte Session, sondern auf den gemeinsamen anonymen Account

## Konkrete Verbesserungen

### A. Anonyme Spieler sauber parallelisieren

Empfehlung mit höchstem Nutzen:

- bei `anonymous=True` nicht den Shared-Player wiederverwenden
- stattdessen pro anonymer Anmeldung oder pro erstmaligem anonymen Spielstart einen eigenen `QuizPlayer` mit `is_anonymous=True` anlegen
- `pin_hash = NULL` bleibt sinnvoll
- Leaderboard-Filter über `is_anonymous` kann unverändert bleiben
- alte anonyme Player/Runs/Sessions können per Retention-Job bereinigt werden

Warum das sinnvoll ist:

- minimale Änderung am vorhandenen Datenmodell
- Ownership-Logik über `player_id` bleibt konsistent
- bestehende Run- und Score-Tabellen müssen nicht grundsätzlich neu gedacht werden

Wenn parallele anonyme Spiele im selben Browserprofil unterstützt werden sollen, reicht das allein nicht. Dann zusätzlich:

- anonymen Zustand nicht ausschließlich an ein Cookie binden
- stattdessen tab- oder browserinstanzspezifische Kennung verwenden, z. B. `sessionStorage` plus Header oder run-spezifisches Client-Handle
- lokale Run-/Score-Caches von `localStorage` auf `sessionStorage` umstellen oder mit einer Tab-ID namespacen

### B. Timeout-Logik stabilisieren

Kurzfristig zwingend:

- den Zugriff auf `services.TIMER_SECONDS` entfernen und durch eine tatsächlich vorhandene Logik ersetzen, z. B. `_get_base_timer_seconds(run.player.is_anonymous)` oder den bisherigen `run.time_limit_seconds`

Architektonisch sinnvoll:

- `GET /state` sollte nicht den kompletten semantischen Sprung auf die nächste Frage vollziehen, bevor der Client den `POST_ANSWER`-Zustand gesehen hat
- nach Timeout sollte ein stabiler Resume-Zustand existieren, der auch beim zweiten oder dritten Refresh noch als `POST_ANSWER` erkennbar bleibt

Pragmatische Varianten:

- `current_index` erst nach explizitem `Weiter` erhöhen
- oder einen separaten `pending_timeout_ack` / `post_answer_pending` Zustand am Run speichern
- oder `/state` so anpassen, dass der zuletzt beantwortete/abgelaufene Index separat zurückgegeben wird und `phase='POST_ANSWER'` bleibt, bis der Client bestätigt weitergeht

### C. Defensive Guards für Run-Erzeugung ergänzen

Empfehlenswert:

- vor dem Anlegen eines Runs serverseitig prüfen, dass wirklich `QUESTIONS_PER_RUN` Fragen selektiert wurden
- bei Unterversorgung des Topics klar mit Fehler abbrechen statt verkürzte Runs zu erzeugen

Das ist kein Hauptproblem des aktuellen Produktionspfads, schützt aber gegen defekte Datenbestände oder manuelle DB-Eingriffe.

### D. Datenbankseitige Invarianten schärfen

Sinnvoll:

- partielle Unique-Constraint oder entsprechender DB-Index, der pro Identität und Topic höchstens einen `in_progress`-Run zulässt
- falls anonyme Spieler künftig pro Session getrennt werden: die Invariante an `anonymous_owner_id` oder `session_id` koppeln, nicht pauschal nur an `player_id`

### E. Tests gezielt auf die aktuellen Risiken ausrichten

Mindestens ergänzen:

- `test_two_anonymous_clients_get_distinct_player_ids`
- `test_two_anonymous_clients_do_not_share_in_progress_run`
- `test_state_auto_timeout_does_not_500`
- `test_refresh_after_timeout_remains_post_answer`
- Playwright-Test für Refresh mitten im Countdown
- Playwright-Test für Refresh direkt nach Timeout

Zusätzlich sinnvoll:

- Testabdeckung und Fixtures an die tatsächliche Quiz-DB-Verdrahtung angleichen
- Doku- und Testbegriffe an die aktuelle `v2`-Mechanik angleichen

## Priorisierung

### Sofort

- Shared-Anonymous-Player abschaffen
- `/state`-500 im Auto-Timeout-Pfad beheben

### Danach

- Timeout-Resume-Zustand stabilisieren
- Tests für anonyme Parallelität und Timeout-Refresh ergänzen

### Danach optional, aber sinnvoll

- Tab-Isolation für anonyme Spiele im selben Browserprofil verbessern
- `localStorage`-Caches tab-spezifisch machen oder auf `sessionStorage` umstellen
- defensive Run-Guards und DB-Invarianten ergänzen

## Gesamtbewertung

Die Quiz-Mechanik ist in vielen Bausteinen bereits ernsthaft und nicht trivial umgesetzt. Die aktuelle Architektur ist aber noch nicht robust genug für paralleles anonymes Spielen und hat einen klar reproduzierbaren Defekt im Timeout-Refresh-Pfad.

Wichtigster Architekturentscheid für die nächste Stufe ist daher:

- anonyme Identität von einem global geteilten Placeholder entkoppeln
- Timeout und Resume als stabilen, expliziten Zustandsautomaten modellieren

Solange das nicht passiert, bleibt die anonyme Parallelität fehleranfällig, und Refresh rund um Timeouts kann Nutzer in inkonsistente Zustände bringen.