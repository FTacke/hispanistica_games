# Audio-Wiedergabe im CO.RA.PAN Corpus

## Übersicht

Das System ermöglicht es, aus den Suchergebnissen im Corpus heraus Audio-Ausschnitte automatisch zu generieren und wiederzugeben. Diese Dokumentation beschreibt detailliert den gesamten Prozess von der Suche bis zur Wiedergabe.

---

## 1. Datenstruktur im BlackLab-Index

### Tokens (aus BlackLab-Index)

Jeder gefundene Token hat folgende relevante Felder:

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `token_id` | INTEGER | Eindeutige ID des Tokens |
| `filename` | TEXT | Name der Originaldatei (z.B. `ARG20180523_01.mp3`) |
| `text` | TEXT | Das gesuchte Wort (palabra) |
| `lemma` | TEXT | Lemma des Wortes |
| `context_start` | FLOAT | Startzeitpunkt des Kontexts (in Sekunden) |
| `context_end` | FLOAT | Endzeitpunkt des Kontexts (in Sekunden) |
| `context_left` | TEXT | Wörter links vom Suchbegriff |
| `context_right` | TEXT | Wörter rechts vom Suchbegriff |
| `country_code` | TEXT | Ländercode (ARG, URY, etc.) |
| `speaker_type` | TEXT | Sprecher-Typ (monoglot, bilingual, etc.) |
| `sex` | TEXT | Geschlecht des Sprechers |
| `mode` | TEXT | Modus (lectura, conversación, etc.) |
| `discourse` | TEXT | Diskurstyp |

**Beispiel:**
```
token_id: 12345
filename: ARG20180523_01.mp3
text: "casa"
context_start: 125.4
context_end: 125.6
context_left: "la"
context_right: "es"
```

---

## 2. Die 4-Minuten-Split-Struktur

### Problem: Große Audio-Dateien

Die Originalaufnahmen können mehrere Stunden lang sein. Um effizient mit ihnen zu arbeiten, werden sie in **4-Minuten-Segmente** aufgeteilt.

### Split-Dictionary

In `app.py` ist ein Dictionary definiert, das alle 29 möglichen 4-Minuten-Segmente beschreibt:

```python
split_times_dict = {
    '_01': {'Start Time': 0.0,      'End Time': 240.0},      # 0:00 - 4:00
    '_02': {'Start Time': 210.0,    'End Time': 450.0},      # 3:30 - 7:30
    '_03': {'Start Time': 420.0,    'End Time': 660.0},      # 7:00 - 11:00
    # ... bis _29
}
```

**Wichtig:** Die Segmente überlappen sich! Das ermöglicht nahtlose Audio-Schnitte über Segmentgrenzen hinweg.

### Dateistruktur im `/split` Ordner

Für jede Originaldatei `ARG20180523_01.mp3` existieren 29 Split-Dateien:

```
/split/
  ARG20180523_01_01.mp3  (0:00 - 4:00)
  ARG20180523_01_02.mp3  (3:30 - 7:30)
  ARG20180523_01_03.mp3  (7:00 - 11:00)
  ARG20180523_01_04.mp3  (11:00 - 15:00)
  ...
  ARG20180523_01_29.mp3  (letzte 4 Minuten)
```

---

## 3. Audio-Schnitt-Prozess

### 3.1 Beispiel-Szenario

Angenommen, wir suchen nach dem Wort "casa" und erhalten folgendes Ergebnis:

```
Suchbegriff: "casa"
Kontext:     "la casa es"
Datei:       ARG20180523_01.mp3
Startzeitpunkt: 125.4 Sekunden
Endzeitpunkt:   125.6 Sekunden (nur das Wort, nicht der Kontext)
Kontext-Breite: context_start=124.8, context_end=126.2
```

### 3.2 Schritt 1: Richtige Split-Datei identifizieren

Die **Kontext-Zeitpunkte** bestimmen, welche Split-Datei verwendet wird:

```python
context_start_ms = 124.8 * 1000 = 124800 ms
context_end_ms = 126.2 * 1000 = 126200 ms

# Durchsuche split_times_dict nach passendem Segment:
# Bedingung: times['Start Time'] * 1000 <= context_start_ms AND
#            times['End Time'] * 1000 >= context_end_ms

# Für _05: Start=840.0s → 840000ms, End=1080.0s → 1080000ms
# → NICHT passend (zu weit in der Zukunft)

# Für _01: Start=0s → 0ms, End=240.0s → 240000ms
# → PASSEND! (0 <= 124800 <= 240000 AND 0 <= 126200 <= 240000)
```

**Gefundenes Segment:** `_01`

**Split-Dateipfad:** `/split/ARG20180523_01_01.mp3`

### 3.3 Schritt 2: Lokale Zeitpunkte berechnen

Die Split-Datei beginnt bei `0 Sekunden` (relativ zur Originaldatei), aber die Zeitpunkte in der Datenbank sind absolut (relativ zur Originaldatei).

Wir müssen lokale Zeitpunkte berechnen:

```python
split_start_time = split_times_dict['_01']['Start Time'] = 0.0 Sekunden
split_start_ms = 0.0 * 1000 = 0 ms

# Lokale Startzeitpunkt:
local_context_start_ms = 124800 ms - 0 ms = 124800 ms

# Lokale Endzeitpunkt:
local_context_end_ms = 126200 ms - 0 ms = 126200 ms
```

Für ein anderes Beispiel mit Split `_02`:

```python
split_start_ms = 210.0 * 1000 = 210000 ms

# Lokale Startzeitpunkte:
local_context_start_ms = 124800 ms - 210000 ms = NEGATIV ❌
# → Dieses Segment passt NICHT
```

### 3.4 Schritt 3: Audio ausschneiden

Mit den lokalen Zeitpunkten wird die Split-Datei geladen und der relevante Ausschnitt extrahiert:

```python
# Lade die Split-Datei
split_file_path = "/split/ARG20180523_01_01.mp3"
audio = AudioSegment.from_mp3(split_file_path)

# Extrahiere den Ausschnitt
local_start_ms = 124800  # in Millisekunden
local_end_ms = 126200

# AudioSegment nutzt Slicing in Millisekunden
part_audio = audio[local_start_ms:local_end_ms]

# Länge: 126200 - 124800 = 1400 ms = 1.4 Sekunden
```

### 3.5 Schritt 4: Cache-Key generieren

Um zu vermeiden, dass die gleiche Audio-Schnitt mehrfach generiert wird, wird ein eindeutiger Cache-Key erstellt:

```python
cache_key = f"corapan_{query}_{result_number}_{context_start_ms}"
# Beispiel: "corapan_casa_1_124800"

cached_file_path = f"/temp-mp3/{cache_key}.mp3"
# Beispiel: "/temp-mp3/corapan_casa_1_124800.mp3"
```

### 3.6 Schritt 5: Als MP3 exportieren

Die extrahierte Audio wird mit den gleichen Eigenschaften wie die Original-Split-Datei exportiert:

```python
# Lade Audio-Eigenschaften von der Split-Datei
bitrate, channels = get_audio_properties(split_file_path)
# z.B. bitrate=128, channels=2

# Exportiere die Schnitt
part_audio.export(
    cached_file_path,
    format='mp3',
    bitrate=f'{bitrate}k',
    parameters=["-ac", str(channels)]
)
# Speichert z.B. als: /temp-mp3/corapan_casa_1_124800.mp3
```

---

## 4. Die Route `/play_audio/<path:filename>`

### 4.1 Request-Parameter

Wenn der Nutzer in der Corpus-Interface auf "Abspielen" klickt, wird eine Request an `/play_audio/<filename>` gesendet:

```
GET /play_audio/ARG20180523_01.mp3?
    start=124.8&
    end=126.2&
    query=casa&
    result_number=1
```

**Parameter:**
- `filename`: Name der Originaldatei (z.B. `ARG20180523_01.mp3`)
- `start`: Kontext-Startzeitpunkt in Sekunden (z.B. `124.8`)
- `end`: Kontext-Endzeitpunkt in Sekunden (z.B. `126.2`)
- `query`: Das gesuchte Wort (z.B. `casa`)
- `result_number`: Die Position in den Suchergebnissen (z.B. `1`)

### 4.2 Verarbeitung in der Route

```python
@app.route('/play_audio/<path:filename>')
def play_audio(filename):
    # Parameter extrahieren
    context_start = request.args.get('start', type=float)     # 124.8
    context_end = request.args.get('end', type=float)         # 126.2
    query = request.args.get('query')                          # "casa"
    result_number = request.args.get('result_number', type=int) # 1

    # Umrechnen in Millisekunden
    context_start_ms = int(context_start * 1000)     # 124800
    context_end_ms = int(context_end * 1000)         # 126200

    # Schritt 1: Richtige Split-Datei finden
    relevant_part = None
    for part, times in split_times_dict.items():
        start_check = times['Start Time'] * 1000 <= context_start_ms
        end_check = times['End Time'] * 1000 >= context_end_ms
        if start_check and end_check:
            relevant_part = part
            break
    
    if relevant_part is None:
        return "Kein passendes Audiosegment gefunden", 404
    # relevant_part = "_01"

    # Schritt 2: Split-Dateipfad konstruieren
    split_file_path = os.path.join(
        SPLIT_FOLDER,
        f"{os.path.splitext(filename)[0]}{relevant_part}.mp3"
    )
    # z.B. "/split/ARG20180523_01_01.mp3"

    # Schritt 3: Cache-Key erstellen
    cache_key = f"corapan_{query}_{result_number}_{context_start_ms}"
    # z.B. "corapan_casa_1_124800"

    cached_file_path = os.path.join(TEMP_MP3_FOLDER, f"{cache_key}.mp3")
    # z.B. "/temp-mp3/corapan_casa_1_124800.mp3"

    # Schritt 4: Prüfe, ob Cache-Datei bereits existiert
    if not os.path.exists(cached_file_path):
        # Schritt 5: Audio ausschneiden und exportieren
        try:
            bitrate, channels = get_audio_properties(split_file_path)
            audio = AudioSegment.from_mp3(split_file_path)
            
            # Lokale Zeitpunkte berechnen
            local_start_ms = context_start_ms - int(
                split_times_dict[relevant_part]['Start Time'] * 1000
            )
            local_end_ms = context_end_ms - int(
                split_times_dict[relevant_part]['Start Time'] * 1000
            )
            
            # Audio ausschneiden
            part_audio = audio[local_start_ms:local_end_ms]
            
            # Als MP3 exportieren
            part_audio.export(
                cached_file_path,
                format='mp3',
                bitrate=f'{bitrate}k',
                parameters=["-ac", str(channels)]
            )
        except Exception as e:
            return str(e), 500

    # Schritt 6: Gecachte MP3-Datei zurückgeben
    return send_file(cached_file_path, mimetype='audio/mp3', as_attachment=True)
```

---

## 5. Temporäre Datei-Verwaltung

### 5.1 Cache-Ordner

Alle generierten Audio-Schnitte werden in `/temp-mp3/` gespeichert:

```
/temp-mp3/
  corapan_casa_1_124800.mp3
  corapan_casa_2_245600.mp3
  corapan_espacio_1_389200.mp3
  corapan_casa_1_124800_spectrogram.png
  corapan_casa_2_245600_spectrogram.png
```

### 5.2 Automatisches Löschen

Um Speicher zu sparen, werden alte Dateien automatisch gelöscht:

```python
def delete_old_files():
    now = time.time()
    for filename in os.listdir(TEMP_MP3_FOLDER):
        if (filename.endswith('.mp3') or filename.endswith('.png')):
            file_path = os.path.join(TEMP_MP3_FOLDER, filename)
            try:
                # Löschen, wenn älter als 12 Minuten (720 Sekunden)
                if os.stat(file_path).st_mtime < now - 720:
                    os.remove(file_path)
            except PermissionError:
                print(f"Konnte nicht löschen: {file_path}")

scheduler = BackgroundScheduler()
scheduler.add_job(func=delete_old_files, trigger="interval", minutes=2)
scheduler.start()
```

**Wichtig:** Alle 2 Minuten werden Dateien älter als 12 Minuten gelöscht.

---

## 6. Praktisches Beispiel: Kompletter Ablauf

### Szenario

Der Nutzer sucht nach "amor" und bekommt folgende Ergebnisse:

```
Suchbegriff: amor
Ergebnis 1:
  - Datei: URY20190315_03.mp3
  - Wort: "amor"
  - Kontext: "el amor es"
  - context_start: 523.1
  - context_end: 523.4
```

### Ablauf

1. **Nutzer klickt "Abspielen"** in der Corpus-Interface

2. **Browser sendet Request:**
   ```
   GET /play_audio/URY20190315_03.mp3?
       start=523.1&
       end=523.4&
       query=amor&
       result_number=1
   ```

3. **Server empfängt Parameter:**
   ```python
   filename = "URY20190315_03.mp3"
   context_start = 523.1
   context_end = 523.4
   context_start_ms = 523100 ms
   context_end_ms = 523400 ms
   ```

4. **Richtige Split-Datei finden:**
   ```python
   # Durchsuche split_times_dict:
   # _05: Start=840s=840000ms, End=1080s=1080000ms
   # → 840000 <= 523100? NEIN
   # ...
   # _11: Start=2100s=2100000ms, End=2340s=2340000ms
   # → 2100000 <= 523100? NEIN
   # ...
   # Nach Durchsuche: KEINE Passende gefunden?
   # Hmm, 523.1 Sekunden sind in Split _03:
   # _03: Start=420s=420000ms, End=660s=660000ms
   # → 420000 <= 523100 <= 660000? JA!
   ```

5. **Split-Dateipfad konstruieren:**
   ```python
   relevant_part = "_03"
   split_file_path = "/split/URY20190315_03_03.mp3"
   ```

6. **Cache-Key erstellen:**
   ```python
   cache_key = "corapan_amor_1_523100"
   cached_file_path = "/temp-mp3/corapan_amor_1_523100.mp3"
   ```

7. **Cache-Datei existiert nicht → Audio ausschneiden:**
   ```python
   audio = AudioSegment.from_mp3("/split/URY20190315_03_03.mp3")
   
   # Lokale Zeitpunkte berechnen
   split_start_ms = 420 * 1000 = 420000
   local_start_ms = 523100 - 420000 = 103100 ms
   local_end_ms = 523400 - 420000 = 103400 ms
   
   # Audio ausschneiden (300 ms = 0.3 Sekunden)
   part_audio = audio[103100:103400]
   
   # Exportieren
   part_audio.export(
       "/temp-mp3/corapan_amor_1_523100.mp3",
       format='mp3',
       bitrate='128k',
       parameters=["-ac", "2"]
   )
   ```

8. **Datei an Browser senden:**
   ```
   /temp-mp3/corapan_amor_1_523100.mp3
   (Größe: ~5-10 KB)
   ```

9. **Browser spielt Audio ab:**
   - Der HTML5 `<audio>`-Element spielt die 0.3 Sekunden lange MP3 ab

10. **Nach 12 Minuten:**
    - Der Scheduler löscht `/temp-mp3/corapan_amor_1_523100.mp3`
    - Falls der Nutzer das Wort erneut abspielen möchte, wird die Datei neu generiert

---

## 7. Frontend-Integration

### HTML-Template (corpus.html)

Die Play-Buttons werden in den Suchergebnis-Zeilen angezeigt:

```html
<tr>
    <td>amor</td>
    <td>el <strong>amor</strong> es</td>
    <td>URY20190315_03.mp3</td>
    <td>
        <button onclick="playAudio(
            'URY20190315_03.mp3',
            523.1,
            523.4,
            'amor',
            1
        )">
            🔊 Abspielen
        </button>
    </td>
</tr>
```

### JavaScript-Funktion

```javascript
function playAudio(filename, contextStart, contextEnd, query, resultNumber) {
    // Baue die URL mit allen Parametern
    const url = `/play_audio/${filename}?` +
                `start=${contextStart}&` +
                `end=${contextEnd}&` +
                `query=${encodeURIComponent(query)}&` +
                `result_number=${resultNumber}`;

    // Erstelle einen Audio-Element oder nutze einen existierenden
    const audio = new Audio(url);
    audio.play();
}
```

---

## 8. Error-Handling

### Mögliche Fehler

| Fehler | Ursache | HTTP-Status |
|--------|--------|------------|
| "Kein passendes Audiosegment gefunden" | context_start/end passen in keinen Split | 404 |
| "Datei nicht gefunden (Split-Datei fehlt)" | `/split/...mp3` existiert nicht | 404 |
| "Datei nicht zugreifbar (keine Leserechte)" | Keine Leseberechtigung auf Split-Datei | 403 |
| Exception bei MP3-Generierung | Fehler beim Laden/Schneiden/Exportieren | 500 |

---

## 9. Performance-Optimierungen

### Caching

- **First Request:** 500-1000ms (Datei muss generiert werden)
- **Subsequent Requests:** <10ms (aus Cache)

### Speicher

- Typische MP3-Schnitt: 5-20 KB
- Nach 12 Minuten automatisch gelöscht
- Max. ca. 100-200 Dateien im `/temp-mp3/` Ordner

### Split-Struktur Vorteile

1. **Kleinere Dateien:** Split-Dateien sind 4 Minuten lang (~10-20 MB), nicht Stunden
2. **Schnelleres Laden:** `AudioSegment.from_mp3()` lädt nur 4 Minuten statt Stunden
3. **Overlaps:** Ermöglichen nahtlose Schnitte über Segmentgrenzen

---

## 10. Server-Deployment (Docker)

In der `Dockerfile` ist zu beachten:

```dockerfile
EXPOSE 5000
ENV FLASK_ENV=production
```

Die `/temp-mp3/` und `/split/` Ordner sollten als **Volumes** in Docker gemountet werden:

```bash
docker run -v /app/temp-mp3:/app/temp-mp3 \
           -v /app/split:/app/split \
           corapan-webapp
```

---

## 11. Zusammenfassung

```
Suchresultat (DB)
    ↓
    ├─ filename: "ARG20180523_01.mp3"
    ├─ context_start: 125.4 Sekunden
    ├─ context_end: 125.6 Sekunden
    └─ query: "casa"
    ↓
[Routing: /play_audio/<filename>?start=...&end=...&query=...&result_number=...]
    ↓
[Split-Datei identifizieren]
    └─ Welcher der 29 Splits passt zu [context_start, context_end]?
    └─ Gefunden: "_01" (0-240 Sekunden)
    ↓
[Lokale Zeitpunkte berechnen]
    └─ Offset von Split-Start (0s) abziehen
    └─ local_start_ms = 124800 ms - 0 ms = 124800 ms
    └─ local_end_ms = 126200 ms - 0 ms = 126200 ms
    ↓
[Audio ausschneiden]
    └─ Lade: /split/ARG20180523_01_01.mp3
    └─ Schneide: audio[124800:126200]
    └─ Länge: 1.4 Sekunden
    ↓
[Cache-Key generieren]
    └─ "corapan_casa_1_124800"
    ↓
[Als MP3 exportieren]
    └─ Speichere: /temp-mp3/corapan_casa_1_124800.mp3
    ↓
[Abspielen]
    └─ Browser spielt /temp-mp3/corapan_casa_1_124800.mp3 ab
    ↓
[Automatisches Löschen nach 12 Minuten]
```

---

## Anhang: Relevante Code-Snippets

### `split_times_dict` (Komplette Liste)

```python
split_times_dict = {
    '_01': {'Start Time': 0.0,      'End Time': 240.0},
    '_02': {'Start Time': 210.0,    'End Time': 450.0},
    '_03': {'Start Time': 420.0,    'End Time': 660.0},
    '_04': {'Start Time': 630.0,    'End Time': 870.0},
    '_05': {'Start Time': 840.0,    'End Time': 1080.0},
    '_06': {'Start Time': 1050.0,   'End Time': 1290.0},
    '_07': {'Start Time': 1260.0,   'End Time': 1500.0},
    '_08': {'Start Time': 1470.0,   'End Time': 1710.0},
    '_09': {'Start Time': 1680.0,   'End Time': 1920.0},
    '_10': {'Start Time': 1890.0,   'End Time': 2130.0},
    '_11': {'Start Time': 2100.0,   'End Time': 2340.0},
    '_12': {'Start Time': 2310.0,   'End Time': 2550.0},
    '_13': {'Start Time': 2520.0,   'End Time': 2760.0},
    '_14': {'Start Time': 2730.0,   'End Time': 2970.0},
    '_15': {'Start Time': 2940.0,   'End Time': 3180.0},
    '_16': {'Start Time': 3150.0,   'End Time': 3390.0},
    '_17': {'Start Time': 3360.0,   'End Time': 3600.0},
    '_18': {'Start Time': 3570.0,   'End Time': 3810.0},
    '_19': {'Start Time': 3780.0,   'End Time': 4020.0},
    '_20': {'Start Time': 3990.0,   'End Time': 4230.0},
    '_21': {'Start Time': 4200.0,   'End Time': 4440.0},
    '_22': {'Start Time': 4410.0,   'End Time': 4650.0},
    '_23': {'Start Time': 4620.0,   'End Time': 4860.0},
    '_24': {'Start Time': 4830.0,   'End Time': 5070.0},
    '_25': {'Start Time': 5040.0,   'End Time': 5280.0},
    '_26': {'Start Time': 5250.0,   'End Time': 5490.0},
    '_27': {'Start Time': 5460.0,   'End Time': 5700.0},
    '_28': {'Start Time': 5670.0,   'End Time': 5910.0},
    '_29': {'Start Time': 5880.0,   'End Time': 6120.0}
}
```

### Helper-Funktionen

```python
def get_audio_properties(file_path):
    """Extrahiere Bitrate und Kanäle aus einer MP3-Datei"""
    audiofile = eyed3.load(file_path)
    bitrate = audiofile.info.bit_rate[1]  # in kbps
    channels = audiofile.info.mode
    if channels.lower() == 'mono':
        channels = 1
    elif channels.lower() == 'stereo':
        channels = 2
    else:
        channels = 2
    return bitrate, channels
```

---

**Letzte Aktualisierung:** November 17, 2025
