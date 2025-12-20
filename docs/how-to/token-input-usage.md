# Token-ID Eingabefeld - Mehrfach-Eingabe

## Übersicht
Das Token-ID-Eingabefeld auf der Corpus-Seite wurde erweitert, um mehrere Token-IDs gleichzeitig zu akzeptieren.

## Funktionalität

### Unterstützte Trennzeichen
Die Funktion erkennt und unterstützt folgende Trennzeichen:
- Komma: `,`
- Komma mit Leerzeichen: `, `
- Semikolon: `;`
- Semikolon mit Leerzeichen: `; `
- Tab: `\t`
- Newline: `\n` und `\r`
- Mehrere Leerzeichen: `  ` (zwei oder mehr)

### Beispiele für gültige Eingaben

**Einzelne Token-ID:**
```
ES-SEVf619e
```

**Mehrere Token-IDs mit Komma:**
```
ES-SEVf619e, ES-SEV1026f, ES-SEVc5c3b
```

**Mehrere Token-IDs mit Semikolon:**
```
ES-SEVf619e; ES-SEV1026f; ES-SEVc5c3b
```

**Gemischte Trennzeichen:**
```
ES-SEVf619e, ES-SEV1026f; ES-SEVc5c3b
```

**Mit Newlines (aus Excel kopiert):**
```
ES-SEVf619e
ES-SEV1026f
ES-SEVc5c3b
```

### Eingabemethoden

1. **Copy & Paste**: Kopieren Sie mehrere Token-IDs aus Excel, CSV oder einem anderen Dokument und fügen Sie sie direkt ein. Die Token-IDs werden automatisch erkannt und als separate Tags hinzugefügt.

2. **Manuelle Eingabe mit Enter**: Geben Sie mehrere Token-IDs ein (mit beliebigen unterstützten Trennzeichen) und drücken Sie Enter.

3. **Manuelle Eingabe mit Blur**: Geben Sie mehrere Token-IDs ein und klicken Sie außerhalb des Feldes. Die Token-IDs werden automatisch erkannt und hinzugefügt.

### Validierung

Die Funktion validiert jede Token-ID nach folgendem Muster:
- Nur Buchstaben (A-Z, a-z), Zahlen (0-9) und Bindestriche (-) sind erlaubt
- Ungültige Token-IDs werden übersprungen und in der Konsole geloggt

### Limit

Es können maximal **2000 Token-IDs** gleichzeitig eingegeben werden.

## Technische Details

### Datei
`static/js/corpus_token.js`

### Funktion
```javascript
function parseMultipleTokenIds(text)
```

Diese Funktion:
1. Nimmt einen String entgegen
2. Splittet ihn nach verschiedenen Trennzeichen
3. Validiert jede Token-ID
4. Gibt ein Array von bereinigten Token-IDs zurück

### Event Handler
- **paste**: Wird beim Einfügen von Text aktiviert
- **keydown** (Enter): Wird bei Enter-Taste aktiviert
- **blur**: Wird aktiviert, wenn das Feld den Fokus verliert

## Changelog

### 2025-10-17
- ✅ Neue Funktion `parseMultipleTokenIds()` hinzugefügt
- ✅ Paste-Handler verbessert
- ✅ Enter-Handler verbessert  
- ✅ Blur-Handler hinzugefügt
- ✅ Unterstützung für verschiedene Trennzeichen (`,`, `;`, Leerzeichen, Newlines)
- ✅ Validierung der Token-ID-Formate
- ✅ Console-Logging für Debugging
