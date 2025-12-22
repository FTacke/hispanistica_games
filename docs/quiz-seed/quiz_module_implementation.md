# hispanistica_games – Quiz-Modul v1 (Implementierungsspezifikation)

Stand: 2025-12-20  
Ziel: Quiz als Game-Modul in der bestehenden Webapp, mit eigener UI (isoliert), aber mit gemeinsamen Templates (TopAppBar/NavDrawer etc.)

Referenz: Quiz-Konzept + Fragenformat (YAML/i18n Keys, 4 Antworten, 30s, 50:50, Erklärungssnack, 5 Stufen à 2 Fragen) :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5}


---

## 1) Core-Entscheidungen (verbindlich)

### 1.1 Login / Session
- Spieler starten ein Spiel mit:
  - **Pseudonym (playername) + PIN (4 Zeichen)**
  - oder **Anonym-Modus**: Spielername = `"Anónimo"` (ohne PIN)
- **Highscore zeigt den playername** (auch "Anónimo")
- Wenn ein playername existiert → **neuen Namen erzwingen** (keine Duplikate)

PIN-Regeln:
- exakt 4 Zeichen (empfohlen: `A-Z` + `0-9`, uppercase)
- kein Klartext speichern (PIN wird gehasht)

### 1.2 Topics / Deep Links
- Startscreen zeigt **Topic-Kacheln**.
- Jede Topic hat eine **eigene URL**:
  - `/games/quiz/<topic_id>`
- Externe Links dürfen direkt auf ein Topic zeigen.

### 1.3 Run-Logik
- Ein Run = genau 10 Fragen:
  - 5 Schwierigkeitsstufen
  - pro Stufe 2 Fragen
  - Reihenfolge der Stufen fix: 1 → 2 → 3 → 4 → 5
  - Fragen pro Stufe zufällig (gewichtete Auswahl, siehe 1.4)

Persistenz:
- Run muss nach Reload **fortsetzbar** sein.
- Es gibt zusätzlich eine **Restart-Option** (Run abbrechen und neu starten).

### 1.4 Fragenauswahl (History)
- Es werden die **letzten 3 Runs** pro Spieler + Topic gespeichert.
- Sonderregel:
  - falsch beantwortete Fragen aus den letzten Runs sollen bevorzugt erneut erscheinen
  - maximal **2** solcher Fragen pro neuem Run
- Wiederholungen insgesamt möglichst vermeiden; wenn Korpus zu klein, Wiederholungen erlaubt.

### 1.5 Timer / Snack / Auto-Advance
- Jede Frage hat ein Zeitlimit von **30 Sekunden** (UI-soft).
- Die UI zeigt eine Uhr (Countdown).
- Bei Reload läuft die Zeit weiter:
  - Timer basiert auf `question_started_at_ms` (Client-Epoch in ms), gespeichert in DB beim Anzeigen einer Frage.
  - Remaining = `30s - (Date.now() - question_started_at_ms)`
  - Wenn Remaining <= 0 → Frage gilt als **falsch** (timeout) und es wird weitergeschaltet.

Snack:
- Nach Antwort (richtig/falsch) erscheint Erklärungssnack (Text aus `explanation_key`) :contentReference[oaicite:6]{index=6}
- Buttonlabel im Snack:
  - richtig: **"Wusste ich schon!"**
  - falsch: **"Verstanden!"**
- ABER: **Bei t = 30s ab Question-Start wird automatisch zur nächsten Frage gewechselt** – auch wenn Snack offen ist.
- Timeout-Fall:
  - sofort als falsch werten, Snack kurz anzeigen (optional 1–2 Sekunden), dann weiter.

### 1.6 Joker (50:50)
- Genau **2 Joker pro Run**. :contentReference[oaicite:7]{index=7}
- Joker kann pro Frage max. 1× genutzt werden.
- Nach Joker werden **2 falsche Antworten ausgegraut** (disabled, sichtbar).
- Joker-Status ist nach Reload identisch.

### 1.7 Scoring / Tokens
Punkte pro korrekt beantworteter Frage:
- difficulty 1: 10
- difficulty 2: 20
- difficulty 3: 30
- difficulty 4: 40
- difficulty 5: 50

Token-Bonus:
- Token wird vergeben, wenn beide Fragen einer Stufe korrekt beantwortet wurden.
- Token-Bonus = **Summe der beiden Fragenpunkte dieser Stufe** = `2 * (10 * difficulty)`
  - Stufe 1: +20
  - Stufe 2: +40
  - Stufe 3: +60
  - Stufe 4: +80
  - Stufe 5: +100

Highscore-Sortierung:
1) `total_score` desc
2) `tokens_count` desc
3) `finished_at` desc (oder kürzere Dauer optional später)

Anzeige:
- Highscore zeigt **letzte 15 Spiele** pro Topic. (wie Konzept, aber jetzt mit Pseudonym) :contentReference[oaicite:8]{index=8}


---

## 2) Architektur im Repo

### 2.1 Game-Modul Ordner
`/game_modules/quiz/`
- `manifest.json`
- `entry.tsx`
- `quiz.routes.tsx` (oder Next/React Router Integration je nach App)
- `ui/` (Komponenten)
- `logic/` (run builder, timer, joker, scoring)
- `styles/quiz.module.css` (oder CSS Modules)
- `content/` (Seed-Fragen + i18n für Dummy-Topic)

Wichtig: **keine globalen CSS Regeln**. Nur innerhalb:
`.game-shell[data-game="quiz"][data-topic="..."] ...`

### 2.2 Host Integration (Wrapper)
Host rendert:
```html
<div class="game-shell" data-game="quiz" data-topic="<topic_id>">
  <!-- quiz root -->
</div>
````

Das Quiz darf:

* eigene Farben, Layouts, Animationen innerhalb des Wrappers
* aber niemals `body/html/topappbar/navdrawer` beeinflussen

---

## 3) Datenmodell (Postgres)

### 3.1 Spieler

`players`

* `id` uuid pk
* `name` text unique not null
* `pin_hash` text null  (null bei "Anónimo")
* `is_anonymous` bool not null default false
* `created_at` timestamptz
* `last_seen_at` timestamptz

Constraints:

* `name` unique
* `is_anonymous=true` nur wenn `name='Anónimo'` (oder umgekehrt strikt per code enforce)

### 3.2 Session

`game_sessions`

* `id` uuid pk
* `player_id` uuid fk
* `token_hash` text not null
* `created_at` timestamptz
* `expires_at` timestamptz

Auth:

* sessionToken wird als HttpOnly Cookie gesetzt (wenn möglich), sonst Bearer token.

### 3.3 Topics

`quiz_topics`

* `id` text pk (topic_id)
* `title_key` text not null
* `is_active` bool not null default true
* `order_index` int not null default 0

### 3.4 Questions (Bank)

DB-Mapping des authoring formats (YAML/i18n keys) 
`quiz_questions`

* `id` text pk (stable question id)
* `topic_id` text fk
* `difficulty` int (1..5)
* `type` text default 'single_choice'
* `prompt_key` text not null
* `explanation_key` text not null
* `answers` jsonb not null  // [{id:1,text_key:"...",correct:false},...]
* `media` jsonb null        // optional
* `sources` jsonb null
* `meta` jsonb null
* `is_active` bool default true

### 3.5 Runs (State + History)

`quiz_runs`

* `id` uuid pk
* `player_id` uuid fk
* `topic_id` text fk
* `status` text enum: 'in_progress' | 'finished' | 'abandoned'
* `created_at` timestamptz
* `finished_at` timestamptz null
* `current_index` int not null default 0  // 0..9
* `run_questions` jsonb not null

  * array length 10, each item:

    * `question_id`
    * `difficulty`
    * `answers_order` [answerId, answerId, answerId, answerId]  // persistent shuffle
* `joker_remaining` int not null default 2
* `joker_used_on` jsonb not null default '[]'  // array of question_index or question_id
* `question_started_at_ms` bigint null  // client epoch ms for the CURRENT question start
* `deadline_at_ms` bigint null          // question_started_at_ms + 30000 (store explicitly)

`quiz_run_answers`

* `id` uuid pk
* `run_id` uuid fk
* `question_id` text
* `question_index` int
* `selected_answer_id` int null
* `result` text enum: 'correct'|'wrong'|'timeout'
* `answered_at_ms` bigint null
* `used_joker` bool not null default false

### 3.6 Highscore snapshot

`quiz_scores`

* `id` uuid pk
* `run_id` uuid unique fk
* `player_name` text not null
* `topic_id` text not null
* `total_score` int not null
* `tokens_count` int not null
* `created_at` timestamptz not null

### 3.7 Statistik (optional v1.1)

`quiz_question_stats`

* `question_id` text pk
* `played_count` int
* `correct_count` int
* `wrong_count` int
* `timeout_count` int

---

## 4) API (Minimal v1)

### 4.1 Public

* `GET /api/quiz/topics`

  * returns: [{topic_id, title, href}]
* `GET /api/quiz/topics/:topic_id/leaderboard?limit=15`

  * returns last 15 games (sorted as spec)

### 4.2 Auth / Session (Game-only)

* `POST /api/quiz/auth/register`

  * body: { name, pin } OR { anonymous: true }
  * rules:

    * if anonymous: create/find player "Anónimo" with is_anonymous=true and no pin
    * if name exists: reject with code NAME_TAKEN
    * store pin_hash
* `POST /api/quiz/auth/login`

  * body: { name, pin }
  * returns session token cookie
* `POST /api/quiz/auth/logout`

### 4.3 Run lifecycle

* `POST /api/quiz/:topic_id/run/start`

  * starts new run (status in_progress)
  * if an in_progress run exists: return it (resume) unless `force_new=true` (restart)

* `POST /api/quiz/:topic_id/run/restart`

  * marks current run as abandoned, creates new run

* `GET /api/quiz/run/current?topic_id=...`

  * returns in_progress run state:

    * current_index, run_questions, joker_remaining, joker_used_on, question_started_at_ms, deadline_at_ms, answers so far

* `POST /api/quiz/run/:run_id/question/start`

  * body: { question_index, started_at_ms }
  * server stores question_started_at_ms and deadline_at_ms = started_at_ms + 30000
  * idempotent: same question_index does not overwrite if already set (optional)

* `POST /api/quiz/run/:run_id/answer`

  * body: { question_index, selected_answer_id|null, answered_at_ms, used_joker:boolean }
  * server evaluates correctness using `quiz_questions.answers.correct`
  * if answered_at_ms > deadline_at_ms: treat as timeout
  * updates quiz_run_answers, advances current_index (but UI may also navigate; server is authority)
  * returns:

    * result ('correct'|'wrong'|'timeout')
    * explanation_key
    * next_question_index (or finished=true)
    * updated joker_remaining

* `POST /api/quiz/run/:run_id/finish`

  * server calculates:

    * score + tokens + token-bonus (per rules)
  * creates quiz_scores row
  * marks run finished

### 4.4 Admin (später, aber vorgesehen)

Ziel: Admin kann neue Fragen effizient hinzufügen.

* Admin ist **Webapp-Auth**, nicht Game-Auth.
* Endpoint:

  * `POST /api/admin/quiz/import`

    * accepts YAML or JSON file (multipart)
    * validates:

      * 4 answers
      * 1 correct
      * difficulty 1..5
      * referenced i18n keys exist (wenn i18n serverseitig verfügbar) 
    * inserts/updates quiz_questions for topic_id
* Optional: `GET /api/admin/quiz/export?topic_id=...`

---

## 5) Frontend UX (Screens)

### 5.1 Startscreen

Route: `/games/quiz`

* zeigt Topic-Kacheln (title_key via i18n)
* CTA: "Spielen"

### 5.2 Topic Entry

Route: `/games/quiz/<topic_id>`
Flow:

1. Login Screen:

   * Input: playername
   * Input: pin (4)
   * Button: "Start"
   * Secondary: "Als Anónimo spielen"
2. Wenn eingeloggt:

   * Button: "Run fortsetzen" (wenn in_progress)
   * Button: "Restart" (fragt kurz nach)
   * Anzeige: Leaderboard (last 15)
3. Start/Resume -> Quiz Screen

### 5.3 Quiz Screen (pro Frage)

* Header:

  * Stufe + Frage x/10
  * Timer (Countdown, mm:ss oder 30..0)
  * Joker Button (disabled wenn 0 remaining oder bereits genutzt für diese Frage)
* Prompt
* optional Media (Audio player; mehrfach abspielbar)
* Antworten (4):

  * persistent shuffled order (run_questions.answers_order)
  * 50:50: zwei falsche disabled + visuell ausgegraut

Interaktion:

* Antwort klickbar oder Enter/Space (Accessibility)
* Nach Antwort:

  * Snack erscheint:

    * Text: explanation
    * Buttonlabel: korrekt? "Wusste ich schon!" : "Verstanden!"
  * Wenn Nutzer klickt: nächste Frage sofort
  * Wenn Deadline erreicht: nächste Frage automatisch (auch wenn Snack noch offen)

Timeout:

* wenn remaining <= 0 bevor Antwort:

  * result=timeout
  * snack optional sehr kurz, dann autoadvance

### 5.4 Finish Screen

* Punkte, Tokens, Breakdown pro Stufe
* CTA: "Nochmal spielen" (restart)
* Leaderboard eingeblendet

### 5.5 Animationen

* Nur innerhalb `.game-shell[data-game="quiz"]`
* Empfohlen:

  * Framer Motion für:

    * Fragewechsel (fade/slide)
    * Snack appear/disappear
    * Token reward micro animation

---

## 6) Styling Isolation (Pflicht)

* Alles CSS als CSS-Modules oder strikt prefixed:

  * `.game-shell[data-game="quiz"] .xyz { ... }`
* Keine globalen Selektoren:

  * verboten: `body`, `html`, `:root` (außer innerhalb `.game-shell`), `*`
* Variablen für “verspielte Farben” nur im Container:

  * `.game-shell[data-game="quiz"] { --quiz-accent: ...; }`

---

## 7) Seed Content: Dummy Topic mit 10 Fragen

Pfad (Beispiel):

* `/game_modules/quiz/content/topics/demo_topic.yml`
* `/game_modules/quiz/content/i18n/de.yml` (nur Demo)
* `/game_modules/quiz/content/i18n/ui.de.yml` (UI labels)

### 7.1 demo_topic.yml

```yaml
topic_id: "demo_topic"
questions:
  - id: "demo-0001"
    difficulty: 1
    type: "single_choice"
    prompt_key: "q.demo-0001.prompt"
    explanation_key: "q.demo-0001.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0001.answer.1", correct: true }
      - { id: 2, text_key: "q.demo-0001.answer.2", correct: false }
      - { id: 3, text_key: "q.demo-0001.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0001.answer.4", correct: false }

  - id: "demo-0002"
    difficulty: 1
    type: "single_choice"
    prompt_key: "q.demo-0002.prompt"
    explanation_key: "q.demo-0002.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0002.answer.1", correct: false }
      - { id: 2, text_key: "q.demo-0002.answer.2", correct: true }
      - { id: 3, text_key: "q.demo-0002.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0002.answer.4", correct: false }

  - id: "demo-0003"
    difficulty: 2
    type: "single_choice"
    prompt_key: "q.demo-0003.prompt"
    explanation_key: "q.demo-0003.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0003.answer.1", correct: false }
      - { id: 2, text_key: "q.demo-0003.answer.2", correct: false }
      - { id: 3, text_key: "q.demo-0003.answer.3", correct: true }
      - { id: 4, text_key: "q.demo-0003.answer.4", correct: false }

  - id: "demo-0004"
    difficulty: 2
    type: "single_choice"
    prompt_key: "q.demo-0004.prompt"
    explanation_key: "q.demo-0004.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0004.answer.1", correct: false }
      - { id: 2, text_key: "q.demo-0004.answer.2", correct: false }
      - { id: 3, text_key: "q.demo-0004.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0004.answer.4", correct: true }

  - id: "demo-0005"
    difficulty: 3
    type: "single_choice"
    prompt_key: "q.demo-0005.prompt"
    explanation_key: "q.demo-0005.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0005.answer.1", correct: true }
      - { id: 2, text_key: "q.demo-0005.answer.2", correct: false }
      - { id: 3, text_key: "q.demo-0005.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0005.answer.4", correct: false }

  - id: "demo-0006"
    difficulty: 3
    type: "single_choice"
    prompt_key: "q.demo-0006.prompt"
    explanation_key: "q.demo-0006.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0006.answer.1", correct: false }
      - { id: 2, text_key: "q.demo-0006.answer.2", correct: true }
      - { id: 3, text_key: "q.demo-0006.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0006.answer.4", correct: false }

  - id: "demo-0007"
    difficulty: 4
    type: "single_choice"
    prompt_key: "q.demo-0007.prompt"
    explanation_key: "q.demo-0007.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0007.answer.1", correct: false }
      - { id: 2, text_key: "q.demo-0007.answer.2", correct: false }
      - { id: 3, text_key: "q.demo-0007.answer.3", correct: true }
      - { id: 4, text_key: "q.demo-0007.answer.4", correct: false }

  - id: "demo-0008"
    difficulty: 4
    type: "single_choice"
    prompt_key: "q.demo-0008.prompt"
    explanation_key: "q.demo-0008.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0008.answer.1", correct: false }
      - { id: 2, text_key: "q.demo-0008.answer.2", correct: false }
      - { id: 3, text_key: "q.demo-0008.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0008.answer.4", correct: true }

  - id: "demo-0009"
    difficulty: 5
    type: "single_choice"
    prompt_key: "q.demo-0009.prompt"
    explanation_key: "q.demo-0009.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0009.answer.1", correct: true }
      - { id: 2, text_key: "q.demo-0009.answer.2", correct: false }
      - { id: 3, text_key: "q.demo-0009.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0009.answer.4", correct: false }

  - id: "demo-0010"
    difficulty: 5
    type: "single_choice"
    prompt_key: "q.demo-0010.prompt"
    explanation_key: "q.demo-0010.explanation"
    answers:
      - { id: 1, text_key: "q.demo-0010.answer.1", correct: false }
      - { id: 2, text_key: "q.demo-0010.answer.2", correct: true }
      - { id: 3, text_key: "q.demo-0010.answer.3", correct: false }
      - { id: 4, text_key: "q.demo-0010.answer.4", correct: false }
```

### 7.2 de.yml (Dummy Texte)

```yaml
q:
  demo-0001:
    prompt: "Demo 1: Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 1 war korrekt."
    answer: { 1: "Richtig", 2: "Falsch A", 3: "Falsch B", 4: "Falsch C" }

  demo-0002:
    prompt: "Demo 2: Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 2 war korrekt."
    answer: { 1: "Falsch A", 2: "Richtig", 3: "Falsch B", 4: "Falsch C" }

  demo-0003:
    prompt: "Demo 3 (Stufe 2): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 3 war korrekt."
    answer: { 1: "Falsch A", 2: "Falsch B", 3: "Richtig", 4: "Falsch C" }

  demo-0004:
    prompt: "Demo 4 (Stufe 2): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 4 war korrekt."
    answer: { 1: "Falsch A", 2: "Falsch B", 3: "Falsch C", 4: "Richtig" }

  demo-0005:
    prompt: "Demo 5 (Stufe 3): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 1 war korrekt."
    answer: { 1: "Richtig", 2: "Falsch A", 3: "Falsch B", 4: "Falsch C" }

  demo-0006:
    prompt: "Demo 6 (Stufe 3): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 2 war korrekt."
    answer: { 1: "Falsch A", 2: "Richtig", 3: "Falsch B", 4: "Falsch C" }

  demo-0007:
    prompt: "Demo 7 (Stufe 4): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 3 war korrekt."
    answer: { 1: "Falsch A", 2: "Falsch B", 3: "Richtig", 4: "Falsch C" }

  demo-0008:
    prompt: "Demo 8 (Stufe 4): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 4 war korrekt."
    answer: { 1: "Falsch A", 2: "Falsch B", 3: "Falsch C", 4: "Richtig" }

  demo-0009:
    prompt: "Demo 9 (Stufe 5): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 1 war korrekt."
    answer: { 1: "Richtig", 2: "Falsch A", 3: "Falsch B", 4: "Falsch C" }

  demo-0010:
    prompt: "Demo 10 (Stufe 5): Welche Option ist korrekt?"
    explanation: "Demo-Erklärung: Option 2 war korrekt."
    answer: { 1: "Falsch A", 2: "Richtig", 3: "Falsch B", 4: "Falsch C" }

ui:
  quiz:
    start: "Start"
    resume: "Fortsetzen"
    restart: "Restart"
    play_anonymous: "Als Anónimo spielen"
    joker: "50:50"
    time_up: "Zeit abgelaufen"
    understood_wrong: "Verstanden!"
    knew_right: "Wusste ich schon!"
```

Seed-Import:

* Beim App-Start/Migration wird `demo_topic.yml` + `de.yml` in DB importiert.
* Validierung strikt nach question_format.md. 

---

## 8) Open-Source Libraries (final selection)

* Animationen: **framer-motion** (Snack + Fragewechsel) ([NPM][1])
* Validation: **zod** (API + Import Schema) ([NPM][2])
* YAML parsing: **yaml** oder **js-yaml** (Seed + Admin Import) ([NPM][3])
* Timer: custom (Resume/Deadline) – optional `react-timer-hook`, aber nicht nötig. ([NPM][4])

---

## 9) Done-Kriterien (Abnahme)

* Deep-link: `/games/quiz/demo_topic` funktioniert ohne Webapp-login
* Login: name+pin, name unique enforced, "Anónimo" möglich
* Run: 10 Fragen, 5 Stufen, 2 Fragen pro Stufe, persistente Shuffles
* Timer: Reload-Resume korrekt, autoadvance bei t=30
* Joker: 2 pro Run, disables 2 falsche, persistiert
* Snack: Erklärung immer, Buttonlabel korrekt, autoadvance trotzdem
* Highscore: letzte 15 Spiele, zeigt playername, score + tokens
* CSS: visuell “verspielt” möglich, aber keine Auswirkungen auf Host (Nav/AppBar bleibt korrekt)

