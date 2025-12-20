---
title: "Frontend & UI Troubleshooting"
status: active
owner: frontend-team
updated: "2025-11-07"
tags: [frontend, javascript, datatables, troubleshooting]
links:
  - ../design/design-system-overview.md
  - database-issues.md
---

# Frontend & UI Troubleshooting

Häufige Frontend- und User-Interface-Probleme.

---

## 🎨 Frontend-Probleme

### Problem: DataTable zeigt "No data available"

**Diagnose:** Browser Console (F12)

**Sollte zeigen:**
```
DataTable (Server-Side) initialized
```

**Falls Error:** AJAX-Request fehlgeschlagen

**Network-Tab prüfen:**
```
GET /corpus/search/datatables?...
Status: 200 OK
```

**Falls 500:** Backend-Problem (siehe Database Issues)

**Falls 404:** Route nicht registriert
```python
# src/app/routes/corpus.py
@blueprint.get("/corpus/search/datatables")
def search_datatables():
    # ...
```

---

### Problem: Spalten zeigen falsche Daten

**Diagnose:** Backend-Array prüfen

```python
# src/app/routes/corpus.py, Zeile ~218
data.append([
    idx,                        # 0: #
    item["context_left"],       # 1: Ctx.←
    item["text"],               # 2: Palabra
    item["context_right"],      # 3: Ctx.→
    item["audio_available"],    # 4: Audio
    item["country_code"],       # 5: País  ← WICHTIG!
    # ...
])
```

**Frontend-Mapping prüfen:**
```javascript
// static/js/corpus_datatables_serverside.js, Zeile ~233
columns: [
    { data: 0 },  // #
    { data: 1 },  // Ctx.←
    { data: 2 },  // Palabra
    // ...
    { data: 5 },  // País ← Muss mit Backend übereinstimmen!
]
```

---

## 🎵 Audio-Probleme

### Problem: Audio spielt nicht ab (Pal:/Ctx: Buttons)

#### Diagnose 1: Event-Binding
Browser-Console (F12):
```javascript
$('.audio-button').length
```

**Sollte zeigen:** Anzahl der Audio-Buttons (z.B. 50 bei 25 Zeilen)

**Falls 0:** Event-Binding fehlt

**Lösung:** `corpus_datatables_serverside.js` prüfen
```javascript
// Zeile ~375
function bindAudioEvents() {
    $('.audio-button').off('click').on('click', function(e) {
        // ...
    });
}
```

#### Diagnose 2: Media-Endpoint
```bash
curl http://127.0.0.1:8000/media/play_audio/2023-08-10_ARG_Mitre.mp3?start=1&end=2
```

**Sollte:** Audio-Datei zurückgeben (Content-Type: audio/mpeg)

**Falls 404:** Audio-Datei fehlt
```bash
# Prüfen ob Datei existiert
dir media\mp3-full\ARG\2023-08-10_ARG_Mitre.mp3
```

#### Diagnose 3: Authentifizierung
```javascript
// Browser-Console
allowTempMedia
```

**Sollte:** `true` zeigen

**Falls undefined:** JavaScript nicht geladen

---

### Problem: "Audio konnte nicht geladen werden"

**Ursache 1:** Datei nicht gefunden

**Lösung:**
```bash
# Alle MP3s auflisten
dir /s media\mp3-full\*.mp3
```

**Ursache 2:** Falscher Dateiname im Index

> **Note:** The SQL queries below reference the legacy `transcription.db`.
> With the current BlackLab-based architecture, check filenames via the
> BlackLab API or inspect the TSV export files under `data/blacklab_export/`.

**Prüfen (legacy):**
```sql
-- This is for reference only; transcription.db no longer exists
-- sqlite3 data/db/transcription.db
-- SELECT DISTINCT filename FROM tokens LIMIT 10;
```

**Sollte zeigen:** `2023-08-10_ARG_Mitre.mp3` (MIT .mp3 Extension)

---

## 📄 Player-Probleme

### Problem: Klick auf Archivo-Icon öffnet nichts

#### Diagnose: Link-Struktur prüfen
Browser DevTools → Rechtsklick auf Icon → "Element untersuchen"

**Sollte zeigen:**
```html
<a href="/player?transcription=/media/transcripts/2023-08-10_ARG_Mitre.json&audio=/media/full/2023-08-10_ARG_Mitre.mp3&token_id=ARG001" class="player-link">
  <i class="fa-regular fa-file"></i>
</a>
```

**Falls `href="#"` oder falsch:** Frontend-Rendering-Problem

**Lösung:** `corpus_datatables_serverside.js` Zeile ~313-343 prüfen
```javascript
const base = filename.trim().replace(/\.mp3$/i, '');
const transcriptionPath = `${MEDIA_ENDPOINT}/transcripts/${base}.json`;
const audioPath = `${MEDIA_ENDPOINT}/full/${base}.mp3`;
```

#### Diagnose: Player-Route
```bash
curl http://127.0.0.1:8000/player?transcription=/media/transcripts/2023-08-10_ARG_Mitre.json&audio=/media/full/2023-08-10_ARG_Mitre.mp3&token_id=ARG001
```

**Sollte:** HTML-Seite zurückgeben (200 OK)

**Falls 400 Bad Request:** Parameter fehlen

**Falls 404:** Route nicht registriert
```python
# src/app/main.py prüfen
from .routes import player
app.register_blueprint(player.blueprint)
```

---

### Problem: Player öffnet, aber "Transcription not found"

**Ursache:** JSON-Datei fehlt

**Prüfen:**
```bash
dir media\transcripts\ARG\2023-08-10_ARG_Mitre.json
```

**Falls nicht gefunden:**
- JSON-Datei fehlt in `media/transcripts/`
- Pfad-Struktur falsch (sollte nach Land unterteilt sein)

**Lösung:**
```bash
# Transcript-Struktur prüfen
dir /s media\transcripts\*.json | findstr ARG
```

---

## 🔄 Export-Probleme

### Problem: Export-Buttons fehlen

**Lösung:** Buttons.js laden
```html
<!-- templates/pages/corpus.html -->
<script src="https://cdn.datatables.net/buttons/2.3.6/js/dataTables.buttons.min.js"></script>
```

---

### Problem: Excel-Export zeigt Audio-Spalte

**Lösung:** exportOptions anpassen
```javascript
// static/js/corpus_datatables_serverside.js, Zeile ~186
buttons: [
    {
        extend: 'excel',
        exportOptions: {
            columns: [0,1,2,3,5,6,7,8,9,10,11]  // Skip column 4 (Audio)
        }
    }
]
```

---

## 📱 Mobile/Browser-Probleme

### Problem: Tabelle auf Handy zu breit

**Lösung:** Responsive Extension aktivieren
```javascript
$('#corpus-table').DataTable({
    responsive: true,
    scrollX: true,  // Horizontal Scrolling
    // ...
});
```

---

### Problem: Icons werden nicht angezeigt

**Ursache:** Font Awesome nicht geladen

**Lösung:**
```html
<!-- templates/base.html -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

---

## Siehe auch

- [Design System](../design/design-system-overview.md) - UI-Komponenten
- [Database Issues](database-issues.md) - Backend-Probleme
- [Auth Issues](auth-issues.md) - Authentifizierungs-Probleme
