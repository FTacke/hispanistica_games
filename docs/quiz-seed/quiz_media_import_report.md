# Quiz Media Import - Implementation Report

**Datum:** 2025-01-28  
**Scope:** Schritte 2-8 aus `quiz_media_import.md`

---

## Zusammenfassung

Die vollständige Implementation ermöglicht:
- **Audio & Bilder** in Quiz-Fragen und Antwort-Optionen
- **quiz_unit_v2 Schema** mit Array-basiertem Media-Format (backward-kompatibel mit v1)
- **Idempotentes Media-Copy** beim Seeding (`static/quiz-media/<slug>/<question_id>/...`)
- **+10 Sekunden Timer-Bonus** für Fragen mit Medien
- **Frontend-Rendering** für Audio-Player und Bilder

---

## Geänderte Dateien

### 1. `game_modules/quiz/validation.py`
**Änderungen:**
- Neue Dataclass `UnitMediaSchema` für Media-Objekte
- `UnitAnswerSchema` erweitert um `media: List[UnitMediaSchema]` 
- `UnitQuestionSchema.media` geändert von `Optional[Dict]` zu `List[UnitMediaSchema]`
- Neue Konstanten:
  - `SUPPORTED_SCHEMA_VERSIONS = {'quiz_unit_v1', 'quiz_unit_v2'}`
  - `ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.ogg', '.wav'}`
  - `ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}`
- Neue Funktionen:
  - `_validate_media_item()` - Validiert einzelne Media-Objekte
  - `_convert_v1_media_to_v2()` - Konvertiert v1-single-object zu v2-array
- `validate_quiz_unit()` akzeptiert jetzt `quiz_unit_v1` und `quiz_unit_v2`

### 2. `scripts/quiz_units_normalize.py`
**Änderungen:**
- Neue Funktion `normalize_media_array()` - Normalisiert Media-Felder zu v2-Array-Format
- `normalize_quiz_unit()` erweitert:
  - Generiert fehlende Answer-IDs (`a1`, `a2`, ...)
  - Normalisiert `question.media` zu Array
  - Normalisiert `answer.media` zu Array für jede Antwort

### 3. `game_modules/quiz/seed.py`
**Änderungen:**
- Neue Konstante `QUIZ_MEDIA_STATIC_DIR = "static/quiz-media"`
- Neue Funktionen:
  - `compute_file_hash(file_path)` - SHA256 Hash für Idempotenz
  - `copy_media_file(src, dest, slug, question_id)` - Kopiert mit Hash-Validierung
  - `process_media_for_question()` - Verarbeitet alle Medien einer Frage
- `import_quiz_unit()` erweitert:
  - Neuer Parameter `json_path` für Media-Pfadauflösung
  - Neuer Parameter `project_root` für Zielverzeichnis
  - Ruft `process_media_for_question()` für jede Frage auf
  - Gibt `(topic, questions_count, media_files_copied)` zurück
- `seed_quiz_units()` aktualisiert:
  - Übergibt `json_path` und `project_root` an `import_quiz_unit()`
  - Zählt und loggt kopierte Media-Dateien

### 4. `game_modules/quiz/routes.py`
**Änderungen:**
- Neue Konstante `MEDIA_TIME_BONUS_SECONDS = 10`
- `api_get_question()` erweitert:
  - Prüft ob Frage oder Antworten Medien haben
  - Fügt `time_limit_bonus_s: 10` zum Response hinzu wenn Medien vorhanden

### 5. `static/js/games/quiz-play.js`
**Änderungen:**
- Neue Variable `currentQuestionMediaBonusSeconds` für Timer-Bonus
- Neue Funktionen:
  - `renderMediaArray(media, options)` - Rendert Media-Array zu HTML
  - `renderAnswerMedia(media)` - Kompakte Darstellung für Antworten
- `loadCurrentQuestion()` erweitert:
  - Liest `time_limit_bonus_s` aus API-Response
  - Speichert Bonus für Timer-Berechnung
- `startQuestionTimer()` erweitert:
  - Berechnet `totalTimerSeconds = TIMER_SECONDS + currentQuestionMediaBonusSeconds`
  - Sendet `time_limit_bonus_s` an Server
- `renderQuestion()` erweitert:
  - Verwendet `renderMediaArray()` für Frage-Medien
  - Rendert Answer-Medien mit `renderAnswerMedia()`

### 6. `static/css/games/quiz.css`
**Neue Styles:**
- `.quiz-media` - Container für Media-Elemente
- `.quiz-media--compact` - Kompakte Variante für Antworten
- `.quiz-media__item` - Einzelnes Media-Element (figure)
- `.quiz-media__audio` - Audio-Player Styles
- `.quiz-media__image` - Bild-Styles mit lazy loading
- `.quiz-media__label` - Label mit Kopfhörer-Icon
- `.quiz-media__caption` - Bildunterschriften
- `.quiz-answer--has-media` - Antwort-Layout mit Media
- Responsive Anpassungen für mobile Geräte
- Reduced motion Support

---

## Dateipfad-Konventionen

### Seed-Struktur (Input)
```
game_modules/quiz/quiz_units/topics/
  <slug>.json
  <slug>.media/
    q01_audio_1.mp3
    q01_img_1.jpg
    q01_a2_audio_1.mp3
```

### Static-Struktur (Output)
```
static/quiz-media/<slug>/<question_id>/
  <media_id>.<ext>           # Frage-Media
  <answer_id>_<media_id>.<ext>  # Antwort-Media
```

### URL-Format (Runtime)
```
/static/quiz-media/<slug>/<question_id>/<filename>
```

---

## Media-Schema (v2)

```json
{
  "id": "m1",
  "type": "audio|image",
  "seed_src": "topic.media/filename.mp3",
  "src": "/static/quiz-media/topic/q_id/m1.mp3",
  "label": "Audio 1",
  "alt": "Alternativtext (nur für images)",
  "caption": "Optionale Beschreibung"
}
```

---

## Timer-Bonus Logik

```
time_limit = 30s (Basis)
if (question.media.length > 0 || any answer.media.length > 0):
    time_limit += 10s
```

- Backend berechnet `time_limit_bonus_s` in `api_get_question()`
- Frontend addiert Bonus zum Base-Timer
- Timer-Start sendet Bonus an Server für serverseitige Deadline

---

## Autoren-Guideline: Medien verknüpfen ohne IDs

Autoren müssen nur `media.id` vergeben - Question-IDs und Answer-IDs werden automatisch vom Normalizer generiert.

### Beispiel JSON (ohne question.id/answer.id):
```json
{
  "difficulty": 2,
  "type": "single_choice",
  "prompt": "Was hörst du?",
  "media": [
    { 
      "id": "m1", 
      "type": "audio", 
      "seed_src": "my_topic.media/q01_audio_1.mp3", 
      "label": "Audio 1" 
    }
  ],
  "answers": [
    { "text": "Option A", "correct": false },
    {
      "text": "Option B",
      "correct": true,
      "media": [
        { 
          "id": "m1", 
          "type": "audio", 
          "seed_src": "my_topic.media/q01_a2_audio_1.mp3", 
          "label": "Antwort B abspielen" 
        }
      ]
    }
  ],
  "explanation": "Die richtige Antwort ist B weil..."
}
```

### Nach Normalisierung + Seeding:
- `question.id = <slug>_q01`
- `answer[0].id = a1`, `answer[1].id = a2`
- Question-Media: `static/quiz-media/<slug>/<slug>_q01/m1.mp3`
- Answer-Media: `static/quiz-media/<slug>/<slug>_q01/a2_m1.mp3`

### Datei-Namenskonvention (empfohlen):
```
<slug>.media/
  q01_audio_1.mp3       # Frage 1, Audio 1
  q01_a2_audio_1.mp3    # Frage 1, Antwort 2, Audio 1
  q02_img_1.jpg         # Frage 2, Bild 1
```

### Wichtige Regeln:
1. `media.id` muss innerhalb einer Frage/Antwort eindeutig sein
2. `seed_src` ist relativ zum JSON-Ordner (nicht zur JSON-Datei)
3. Erlaubte Audio-Extensions: `.mp3`, `.ogg`, `.wav`
4. Erlaubte Bild-Extensions: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`
5. Bei mehreren Medien: `label` verwenden für Nummerierung

---

## Backward Compatibility

- `quiz_unit_v1` wird weiterhin unterstützt
- v1 `media: null|object` wird automatisch zu v2 `media: []|[object]` konvertiert
- Bestehende Topics ohne Medien funktionieren unverändert

---

## Idempotenz-Garantien

Der Media-Importer ist vollständig idempotent:

1. **Datei existiert nicht** → Kopieren
2. **Datei existiert mit gleichem Hash** → Überspringen (kein Log-Noise)
3. **Datei existiert mit anderem Hash** → Fehler mit klarer Meldung
4. **Wiederholtes Seeding** → Keine Duplikate, keine Änderungen

---

## Verifikation

Die Implementation kann getestet werden durch:

1. **DEV-Start:**
   ```powershell
   .\scripts\dev-start.ps1 -UsePostgres
   ```

2. **Erwartete Logs bei Media-Topic:**
   ```
   Importing quiz unit: <slug>
   Seeding topic <slug> | questions: 10 | d1=3 | d2=4 | d3=3 | media files: 5
   Quiz units seeding completed: 1 units, 10 questions, 5 media files, 0 errors
   ```

3. **Datei-Check:**
   - `static/quiz-media/<slug>/` enthält Unterordner pro Frage
   - URLs in DB (`media[].src`) zeigen auf existierende Dateien

4. **Frontend-Check:**
   - Medien werden in Quiz-Play gerendert
   - Timer zeigt +10s für Media-Fragen

---

## Offene Punkte / Erweiterungen

1. **Media-Cleanup:** Verwaiste Dateien in `static/quiz-media/` bei Hard-Prune löschen
2. **Thumbnail-Generierung:** Für große Bilder automatisch Thumbnails erstellen
3. **Video-Support:** Erweiterung um `type: "video"` möglich mit gleichem Schema
4. **CDN-Integration:** `src` könnte auf CDN-URL zeigen statt lokalem Static-Pfad

---

## Definition of Done ✅

- [x] v1 Topics laufen unverändert weiter
- [x] v2 Topics können Medien in Fragen und Antworten enthalten
- [x] Medien werden in `static/quiz-media/...` kopiert, deterministisch benannt
- [x] Wiederholtes DEV-Start-Seeding ist idempotent
- [x] Frontend zeigt Medien, Labels, und Timer ist bei Medienfragen +10s
- [x] Backend liefert `time_limit_bonus_s` im API-Response
