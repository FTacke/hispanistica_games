# Quiz Module - Integration QA Runbook

## Ziel
Verifiziere dass Quiz-Modul korrekt in die Webapp-Navigation integriert ist.

## Vorbedingungen

### 1. PostgreSQL Datenbank
```bash
# PostgreSQL muss laufen
# Setze AUTH_DATABASE_URL
$env:AUTH_DATABASE_URL = "postgresql://user:pass@localhost:5432/hispanistica"
```

### 2. Quiz-Tabellen initialisieren
```powershell
python scripts/init_quiz_db.py --seed --drop
```

### 3. Server starten
```powershell
python -m src.app.main
```

Server läuft auf: **http://127.0.0.1:8000**

---

## Test Suite A: Routing & Redirects

### A1: Kanonische /quiz Route
**Schritte:**
1. Öffne http://127.0.0.1:8000/quiz
2. Erwarte: Quiz-Startseite mit Topic-Kacheln
3. Prüfe: URL bleibt `/quiz` (kein Redirect)

**Erwartet:**
- ✅ Status 200
- ✅ Zeigt "Wähle ein Thema" Header
- ✅ Zeigt "Demo Topic" Kachel
- ✅ Navigation/TopBar sind sichtbar (vom base.html)

### A2: Legacy /games/quiz Redirect
**Schritte:**
1. Öffne http://127.0.0.1:8000/games/quiz
2. Erwarte: 301 Redirect nach `/quiz`

**Erwartet:**
- ✅ Status 301
- ✅ Browser wird automatisch zu `/quiz` weitergeleitet

### A3: Topic Entry Canonical
**Schritte:**
1. Öffne http://127.0.0.1:8000/quiz/demo_topic
2. Erwarte: Topic Entry Page (Login/Resume)

**Erwartet:**
- ✅ Status 200
- ✅ Zeigt Demo Topic Titel
- ✅ Zeigt Login-Formular (Pseudonym/PIN oder Anonym)

### A4: Topic Entry Legacy Redirect
**Schritte:**
1. Öffne http://127.0.0.1:8000/games/quiz/demo_topic
2. Erwarte: 301 Redirect nach `/quiz/demo_topic`

**Erwartet:**
- ✅ Status 301
- ✅ Browser wird automatisch zu `/quiz/demo_topic` weitergeleitet

### A5: Play Page Canonical
**Schritte:**
1. Melde dich bei einem Topic an (Anonym möglich)
2. Starte Quiz
3. Prüfe URL: Sollte `/quiz/<topic_id>/play` sein

**Erwartet:**
- ✅ URL ist `/quiz/demo_topic/play`
- ✅ Quiz-Frage wird angezeigt
- ✅ Timer läuft (30 Sekunden)

### A6: Play Page Legacy Redirect
**Schritte:**
1. Öffne direkt http://127.0.0.1:8000/games/quiz/demo_topic/play
2. Erwarte: 301 Redirect nach `/quiz/demo_topic/play`
3. Dann 401 (weil nicht eingeloggt)

**Erwartet:**
- ✅ Status 301 → 401
- ✅ Redirect funktioniert (auch wenn dann Auth fehlt)

---

## Test Suite B: Navigation Integration

### B1: Index hat Quiz-Link
**Schritte:**
1. Öffne http://127.0.0.1:8000/
2. Suche Quiz-Karte

**Erwartet:**
- ✅ Index zeigt "Quiz" Karte mit Icon (quiz symbol)
- ✅ Karte hat Link zu `/quiz-redirect` (redirectet zu `/quiz`)
- ✅ Klick auf "Starten" Button führt zu Quiz

### B2: Navigation Drawer hat Quiz
**Schritte:**
1. Öffne eine beliebige Seite
2. Klicke auf Hamburger-Menü (Navigation Drawer)
3. Suche "Quiz" Eintrag

**Erwartet:**
- ✅ Navigation Drawer zeigt "Quiz" mit Icon
- ✅ Link zeigt auf `/quiz-redirect` (redirectet zu `/quiz`)
- ✅ Klick führt zu Quiz-Startseite

### B3: Active State in Nav
**Schritte:**
1. Öffne http://127.0.0.1:8000/quiz
2. Öffne Navigation Drawer
3. Prüfe ob "Quiz" als aktiv markiert ist

**Erwartet:**
- ✅ Quiz-Eintrag hat `md3-navigation-drawer__item--active` Klasse
- ✅ Visuell hervorgehoben (Background/Border)

---

## Test Suite C: API Endpoints

### C1: Topics API
**Schritte:**
```bash
curl http://127.0.0.1:8000/api/quiz/topics
```

**Erwartet:**
```json
{
  "topics": [
    {
      "topic_id": "demo_topic",
      "title_key": "topics.demo_topic.title",
      "description_key": "topics.demo_topic.description",
      "href": "/quiz/demo_topic"
    }
  ]
}
```

### C2: Leaderboard API
**Schritte:**
```bash
curl http://127.0.0.1:8000/api/quiz/topics/demo_topic/leaderboard
```

**Erwartet:**
- ✅ Status 200
- ✅ JSON mit `leaderboard` Array

---

## Test Suite D: Deep Links & Bookmarks

### D1: Direkter Topic Link
**Schritte:**
1. Öffne http://127.0.0.1:8000/quiz/demo_topic direkt
2. Logge dich ein (Anonym)
3. Starte Quiz

**Erwartet:**
- ✅ Funktioniert ohne über Index zu gehen
- ✅ Topic-Kontext bleibt erhalten

### D2: Reload während Quiz
**Schritte:**
1. Starte Quiz
2. Beantworte 2 Fragen
3. Drücke F5 (Page Reload)

**Erwartet:**
- ✅ Quiz setzt bei Frage 3 fort
- ✅ Timer wird korrekt restauriert (question_started_at_ms)
- ✅ Joker-Status bleibt erhalten

---

## Test Suite E: Template Integration

### E1: Base Layout Inheritance
**Schritte:**
1. Öffne Quiz-Seite
2. Prüfe Developer Tools → Elements

**Erwartet:**
- ✅ `<header id="top-app-bar">` vorhanden
- ✅ `<aside id="navigation-drawer">` vorhanden
- ✅ `<footer id="site-footer">` vorhanden
- ✅ Quiz-Content in `<main id="main-content">`

### E2: Keine CSS-Leaks
**Schritte:**
1. Öffne Index (nicht-Quiz Seite)
2. Developer Tools → Network
3. Prüfe geladene CSS-Dateien

**Erwartet:**
- ❌ `quiz.css` wird NICHT geladen
- ❌ `quiz-*.js` wird NICHT geladen

**Dann:**
1. Navigiere zu `/quiz`
2. Prüfe erneut

**Erwartet:**
- ✅ `quiz.css` wird jetzt geladen
- ✅ `quiz-i18n.js`, `quiz-topics.js` werden geladen

---

## Checkliste: Erfolgsnachweis

- [x] A1-A6: Alle Routing/Redirect-Tests bestanden
- [x] B1-B3: Navigation Integration funktioniert
- [x] C1-C2: API Endpoints antworten korrekt
- [x] D1-D2: Deep Links und Reload funktionieren
- [x] E1-E2: Templates integriert, keine Leaks

**QA Completed:** 2025-12-20
**See:** [quiz-integration-test-results.md](quiz-integration-test-results.md) for detailed test results

---

## Troubleshooting

### Problem: 404 bei /quiz
**Lösung:** Prüfe ob Blueprint registriert ist in `src/app/routes/__init__.py`:
```python
from game_modules.quiz import quiz_blueprint
BLUEPRINTS = [..., quiz_blueprint]
```

### Problem: Topics nicht sichtbar
**Lösung:** DB seeden:
```powershell
python scripts/init_quiz_db.py --seed
```

### Problem: JSONB Error
**Lösung:** Prüfe AUTH_DATABASE_URL - muss PostgreSQL sein, nicht SQLite:
```powershell
$env:AUTH_DATABASE_URL = "postgresql://..."
```

### Problem: Navigation zeigt Quiz nicht
**Lösung:** Cache leeren oder Hard Reload (Ctrl+Shift+R)

---

## Kritische Pfade für Prod-Deployment

1. **Migrations:** 
   - `explanation_key NOT NULL` erfordert Daten-Migration wenn DB existiert
   - Alle bestehenden Questions müssen explanation_key haben

2. **URL Migration:**
   - 301 Redirects von `/games/quiz` sind permanent
   - Externe Links müssen ggf. aktualisiert werden

3. **i18n Keys:**
   - Topics müssen i18n-Keys haben: `topics.<topic_id>.title`
   - Questions brauchen: `q.<question_id>.prompt`, `q.<question_id>.explanation`

---

**Status:** ✅ Integration komplett - Manuelle QA erforderlich
**Next:** Prod-Deployment mit Migration-Script
