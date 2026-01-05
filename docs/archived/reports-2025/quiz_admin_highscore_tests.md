# Admin Highscore Management - Test-Plan

## Übersicht

Dieses Dokument beschreibt die Tests für die Admin-only Highscore-Verwaltung im Quiz-Modul.

## Voraussetzungen

1. Quiz-Modul läuft
2. Mindestens ein Quiz-Topic mit Highscores vorhanden
3. Admin-Account (Webapp-Auth, Rolle: admin)
4. Nicht-Admin-Account zum Testen der Zugriffsbeschränkungen

## 1. Backend-Tests

### 1.1 Reset-Endpoint (POST /api/quiz/admin/topics/{topic_id}/highscores/reset)

#### Test 1.1.1: Admin kann Highscores zurücksetzen
- **Setup:** Als Admin eingeloggt, Topic mit 5 Highscores
- **Aktion:** POST Request an Reset-Endpoint
- **Erwartung:** 
  - Status 200
  - Response: `{"ok": true, "deleted_count": 5}`
  - Leaderboard ist leer

#### Test 1.1.2: Nicht-Admin wird abgewiesen
- **Setup:** Nicht als Admin eingeloggt
- **Aktion:** POST Request an Reset-Endpoint
- **Erwartung:**
  - Status 403
  - Keine Scores gelöscht

#### Test 1.1.3: Ungültige Topic-ID
- **Setup:** Als Admin eingeloggt
- **Aktion:** POST an `/api/quiz/admin/topics/invalid_topic/highscores/reset`
- **Erwartung:**
  - Status 404
  - Error: "Topic not found"

### 1.2 Delete-Endpoint (DELETE /api/quiz/admin/topics/{topic_id}/highscores/{entry_id})

#### Test 1.2.1: Admin kann einzelnen Eintrag löschen
- **Setup:** Als Admin eingeloggt, Topic mit 5 Highscores
- **Aktion:** DELETE Request für einen spezifischen entry_id
- **Erwartung:**
  - Status 204
  - Eintrag ist gelöscht
  - Plätze der verbleibenden Einträge sind korrekt (dynamisch neu berechnet)

#### Test 1.2.2: IDOR-Schutz: Entry gehört nicht zu Topic
- **Setup:** Als Admin eingeloggt, zwei Topics A und B mit je 3 Scores
- **Aktion:** DELETE `/api/quiz/admin/topics/A/highscores/{entry_id_von_B}`
- **Erwartung:**
  - Status 404
  - Eintrag von B nicht gelöscht

#### Test 1.2.3: Nicht-Admin wird abgewiesen
- **Setup:** Nicht als Admin eingeloggt
- **Aktion:** DELETE Request
- **Erwartung:**
  - Status 403
  - Eintrag nicht gelöscht

### 1.3 Leaderboard-Endpoint Erweiterungen

#### Test 1.3.1: entry_id wird zurückgegeben
- **Aktion:** GET `/api/quiz/topics/{topic_id}/leaderboard`
- **Erwartung:**
  - Jeder Eintrag hat `entry_id` Feld
  - `entry_id` entspricht der QuizScore.id

#### Test 1.3.2: is_admin Flag korrekt
- **Aktion:** GET als Admin / als Nicht-Admin
- **Erwartung:**
  - Admin: `is_admin: true`
  - Nicht-Admin: `is_admin: false`

## 2. Frontend-Tests (Manuell)

### 2.1 Admin-UI Sichtbarkeit

#### Test 2.1.1: Admin sieht Reset-Button
- **Setup:** Als Admin eingeloggt, Topic-Entry-Seite öffnen
- **Erwartung:**
  - Reset-Button ("Zurücksetzen") in Leaderboard-Header sichtbar
  - Icon: `restart_alt`
  - Style: outlined, error-colored

#### Test 2.1.2: Admin sieht Trash-Icons
- **Setup:** Als Admin eingeloggt
- **Erwartung:**
  - Jede Leaderboard-Zeile hat Trash-Icon rechts
  - Icon: `delete`
  - Hit-area mindestens 40x40px
  - Tooltip: "Eintrag löschen"

#### Test 2.1.3: Nicht-Admin sieht keine Admin-Controls
- **Setup:** Nicht als Admin eingeloggt (oder ausgeloggt)
- **Erwartung:**
  - Kein Reset-Button
  - Keine Trash-Icons
  - Leaderboard-Layout normal (4 Spalten statt 5)

### 2.2 Reset-Funktion

#### Test 2.2.1: Reset mit Confirm-Dialog
- **Setup:** Als Admin eingeloggt
- **Aktion:** Reset-Button klicken
- **Erwartung:**
  - MD3-Dialog öffnet sich
  - Titel: "Alle Highscores zurücksetzen?"
  - Warning-Icon sichtbar
  - Text: Warnung, dass Aktion permanent ist
  - Buttons: "Abbrechen" (text) + "Zurücksetzen" (filled danger)

#### Test 2.2.2: Reset Abbrechen
- **Aktion:** Dialog öffnen → "Abbrechen" klicken
- **Erwartung:**
  - Dialog schließt
  - Keine Scores gelöscht

#### Test 2.2.3: Reset Bestätigen
- **Aktion:** Dialog öffnen → "Zurücksetzen" klicken
- **Erwartung:**
  - Button zeigt "Wird gelöscht..." (disabled)
  - Request wird gesendet
  - Toast: "X Einträge gelöscht"
  - Leaderboard wird neu geladen und ist leer
  - Dialog schließt

#### Test 2.2.4: Reset Error Handling
- **Setup:** Backend nicht erreichbar (z.B. Dev-Server stoppen)
- **Aktion:** Reset bestätigen
- **Erwartung:**
  - Toast: "Fehler beim Zurücksetzen"
  - Dialog bleibt offen
  - Button wieder enabled

### 2.3 Delete-Funktion

#### Test 2.3.1: Delete mit Confirm-Dialog
- **Aktion:** Trash-Icon bei einem Eintrag klicken
- **Erwartung:**
  - MD3-Dialog öffnet sich
  - Titel: "Highscore-Eintrag löschen?"
  - Text zeigt Name + Score des Eintrags
  - Buttons: "Abbrechen" + "Löschen" (filled danger)

#### Test 2.3.2: Delete Bestätigen
- **Setup:** Leaderboard mit 5 Einträgen
- **Aktion:** Eintrag #3 löschen → bestätigen
- **Erwartung:**
  - Request wird gesendet
  - Toast: "Eintrag gelöscht"
  - Leaderboard wird neu geladen
  - Nur noch 4 Einträge
  - Plätze automatisch neu: alte #4 ist jetzt #3, alte #5 ist jetzt #4

#### Test 2.3.3: Backdrop-Click schließt Dialog
- **Aktion:** Dialog öffnen → außerhalb des Dialogs klicken
- **Erwartung:**
  - Dialog schließt
  - Keine Änderung

#### Test 2.3.4: Escape-Key schließt Dialog
- **Aktion:** Dialog öffnen → ESC drücken
- **Erwartung:**
  - Dialog schließt
  - Keine Änderung

### 2.4 Layout & MD3-Konformität

#### Test 2.4.1: Leaderboard-Grid mit Admin-Spalte
- **Setup:** Als Admin eingeloggt
- **Erwartung:**
  - Grid: 5 Spalten (Rank, Name, Score, Tokens, Trash)
  - Trash-Spalte: 40px breit, rechtsbündig
  - Kein Layout-Shift beim Hover

#### Test 2.4.2: Button-Styles korrekt
- **Erwartung:**
  - Reset-Button: outlined, error-colored
  - Trash-Icon-Button: transparent → error-container on hover
  - Dialog-Buttons: text (cancel) + filled danger (confirm)

#### Test 2.4.3: Dialog-Styles korrekt
- **Erwartung:**
  - MD3-Dialog mit backdrop
  - Warning-Box: error-container background
  - Spacing: MD3-konform (--space-* tokens)

### 2.5 Responsive

#### Test 2.5.1: Mobile (< 768px)
- **Setup:** Viewport 375px breit
- **Erwartung:**
  - Reset-Button: Icon + Text oder nur Icon (je nach Platz)
  - Trash-Icons: weiterhin 40x40px Hit-Area
  - Leaderboard-Zeilen umbrechen oder horizontal scrollbar

#### Test 2.5.2: Tablet (768px - 1024px)
- **Erwartung:**
  - Alles normal dargestellt
  - Kein Overflow

## 3. Security-Tests

### 3.1 Backend-Zugriff

#### Test 3.1.1: Ohne JWT
- **Aktion:** Request ohne JWT-Cookie/Header
- **Erwartung:** 401 Unauthorized

#### Test 3.1.2: Mit Editor-Rolle
- **Aktion:** Request als Editor (nicht Admin)
- **Erwartung:** 403 Forbidden

#### Test 3.1.3: Mit abgelaufenem JWT
- **Aktion:** Request mit abgelaufenem Token
- **Erwartung:** 401 Unauthorized

### 3.2 CSRF-Schutz

- **Hinweis:** JWT-basierte Auth hat eingebauten CSRF-Schutz
- **Test:** Versuch, Request von anderer Origin zu senden
- **Erwartung:** JWT-Cookie wird nicht mitgesendet (SameSite)

### 3.3 IDOR-Tests

#### Test 3.3.1: Entry aus anderem Topic löschen
- **Setup:** Topic A mit Score X, Topic B mit Score Y
- **Aktion:** DELETE `/api/quiz/admin/topics/A/highscores/{score_Y_id}`
- **Erwartung:**
  - 404 Not Found
  - Score Y nicht gelöscht

#### Test 3.3.2: Nicht-existierende Entry-ID
- **Aktion:** DELETE mit UUID, der nicht existiert
- **Erwartung:** 404 Not Found

## 4. Fehlerbehandlung

### 4.1 Netzwerkfehler
- **Aktion:** Request senden, während Backend offline
- **Erwartung:** Toast "Aktion fehlgeschlagen"

### 4.2 Server-Fehler (500)
- **Aktion:** Backend wirft Exception
- **Erwartung:** Toast mit Error-Message

### 4.3 Ungültiges Topic
- **Aktion:** Leaderboard für nicht-existierende Topic-ID
- **Erwartung:** 404 Error-Page oder graceful fallback

## 5. Durchgeführte Tests

### Backend-Tests
- [x] Syntax-Check: Keine Fehler in routes.py, services.py
- [x] Code-Review: Admin-Guards korrekt, IDOR-Checks vorhanden
- [ ] Unit-Tests: Pytest-Suite ausführen (erfordert JWT-Mock-Setup)

### Frontend-Tests
- [ ] UI-Sichtbarkeit: Admin vs. Nicht-Admin
- [ ] Reset-Funktion: Dialog, Confirm, Refresh
- [ ] Delete-Funktion: Dialog, Confirm, Refresh, Ranking-Update
- [ ] Layout: Grid-Spalten, Button-Styles, Dialog-Styles
- [ ] Responsive: Mobile, Tablet, Desktop
- [ ] Keyboard: Dialoge mit Tab/Enter/Escape bedienbar

### Security-Tests
- [ ] Nicht-Admin kann keine Admin-Actions ausführen
- [ ] IDOR-Schutz funktioniert
- [ ] JWT-Validierung funktioniert

## 6. Bekannte Einschränkungen

1. **JWT-Test-Setup fehlt:** Die Pytest-Tests benötigen ein Mock-Setup für JWT-Auth
2. **E2E-Tests:** Playwright/Selenium-Tests wären ideal für volle UI-Tests
3. **Rate-Limiting:** Aktuell kein Rate-Limiting auf Admin-Endpoints (optional nachrüsten)

## 7. Nächste Schritte

1. **JWT-Mock erstellen:** Für Backend-Unit-Tests
2. **Manuelle UI-Tests durchführen:** In Dev-Umgebung mit Admin-Account
3. **E2E-Tests schreiben:** Falls Playwright bereits im Projekt
4. **Deployment:** Nach erfolgreichen Tests deployen
5. **Dokumentation:** Admin-Guide für Highscore-Management erstellen
