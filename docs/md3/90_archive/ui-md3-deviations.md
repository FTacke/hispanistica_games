# MD3 Styleguide – Dokumentierte Abweichungen

> **Version:** 1.0  
> **Stand:** 2025-01-27

Dieses Dokument beschreibt Komponenten, die aus technischen oder UX-Gründen vom MD3 Goldstandard abweichen.

---

## 1. Player-Komponente

**Dateien:**
- `static/css/md3/components/player.css`
- `static/css/player-mobile.css`

### 1.1 Button-System

| Klasse | Verwendung | Abweichung |
|--------|------------|------------|
| `.md3-player-btn-primary` | Primärer Player-Button (Marcar) | Eigene Klasse statt `.md3-button--filled` |
| `.skip-control` | Skip-Navigation (±5s) | Custom SVG-Buttons, nicht MD3-Button |
| `.play-icon` | Play/Pause | Material Symbol direkt, kein Button-Container |

### 1.2 Begründung

- **Audio-Player UX:** Player-Controls erfordern spezielle Touch-Targets und visuelle Feedback-Patterns, die von Standard-Buttons abweichen
- **Performance:** Minimale DOM-Struktur für flüssige Wiedergabe
- **Mobile-Optimierung:** 4-Zeilen-Layout auf Mobile erfordert custom Grid

### 1.3 Token-Konformität

✅ **Migriert (2025-01-27):** Alle `--md3-*` Tokens wurden auf kanonische Tokens umgestellt:
- `--md-sys-color-*` für Farben
- `--space-*` für Abstände
- `--radius-*` für Border-Radien

### 1.4 Zukünftige Harmonisierung

- [ ] Player-Buttons zu `.md3-button--icon` mit custom styling migrieren
- [ ] Speed-Control als `.md3-slider` implementieren
- [ ] Progress-Bar als `.md3-progress` standardisieren

---

## 2. Editor-Komponente

**Dateien:**
- `static/css/md3/components/editor.css`
- `templates/pages/editor.html`
- `static/js/editor/dialog-utils.js`

### 2.1 Button-System

| Klasse | Verwendung | Abweichung |
|--------|------------|------------|
| `.md3-editor-btn` | Editor-Toolbar-Buttons | Eigene Klasse statt `.md3-button` |
| `.md3-editor-btn-primary` | Primärer Editor-Button | Eigene Klasse statt `.md3-button--filled` |
| `.md3-editor-btn-sm` | Kompakte Editor-Buttons | Keine SM-Variante in Standard-System |

### 2.2 Begründung

- **Transkript-Editor:** Spezialisierte Anforderungen für Word-Level-Editing
- **Dense UI:** Mehr Controls auf kleinerem Raum als Standard-Forms
- **Keyboard-First:** Optimiert für Tastatur-Navigation

### 2.3 dialog-utils.js

```javascript
// Zeile 109 - verwendet eigene Button-Klasse
? "md3-editor-btn md3-editor-btn-primary"
```

Diese Logik erzeugt dynamische Dialoge im Editor-Kontext mit Editor-spezifischen Buttons.

### 2.4 Zukünftige Harmonisierung

- [ ] Editor-Dialoge auf `.md3-dialog` migrieren
- [ ] Editor-Buttons als `.md3-button` mit `--dense` Modifier
- [ ] Toolbar auf `.md3-toolbar` standardisieren

---

## 3. Text-Pages Legacy

**Dateien:**
- `static/css/md3/components/text-pages.css`

### 3.1 Bootstrap-Reste

```css
/* Zeile 361-373 */
.btn-primary {
  /* Legacy Bootstrap-Kompatibilität */
}
```

### 3.2 Status

⚠️ **Deprecated:** Diese Klassen existieren nur für statische Textseiten, die noch nicht migriert wurden.

### 3.3 Betroffene Templates

- Möglicherweise alte Dokumentations-Seiten
- Externe Einbettungen

### 3.4 Migration

- [ ] Alle Templates mit `.btn-primary` identifizieren
- [ ] Zu `.md3-button--filled` migrieren
- [ ] Legacy-CSS entfernen

---

## 4. main.js Token-Referenz

**Datei:** `static/js/main.js`

### 4.1 CSS-Variable Zugriff

```javascript
// Zeile 204
.getPropertyValue("--md3-mobile-menu-duration")
```

### 4.2 Status

⚠️ **Legacy:** Diese Variable existiert im Legacy-Token-Shim in `base.html`.

### 4.3 Lösung

```javascript
// Sollte migriert werden zu:
.getPropertyValue("--md-motion-duration-medium2")
```

### 4.4 Abhängigkeit

Der Legacy-Token-Shim in `base.html` (Zeile 79) muss erhalten bleiben, bis diese JS-Referenz aktualisiert wird:

```html
<!-- Legacy tokens shim: temporary mapping of --md3-* names to canonical tokens -->
```

---

## 5. Zusammenfassung

### Komponenten mit Abweichungen

| Komponente | Severity | Status | Priorität |
|------------|----------|--------|-----------|
| Player | Medium | Dokumentiert, Tokens migriert | Low |
| Editor | Medium | Dokumentiert | Medium |
| Text-Pages | Low | Deprecated | High (entfernen) |
| main.js | Low | Token-Shim benötigt | Medium |

### Vollständig konforme Komponenten

✅ Auth-Bereich (Login, Profile, Admin)
✅ Search (Advanced, Results)
✅ Cards & Dialogs
✅ Tables & Pagination
✅ Alerts & Snackbar
✅ Tabs & Toolbar

---

## Anhang: Token-Shim (base.html)

Solange JS-Code `--md3-*` Variablen referenziert, muss dieser Shim erhalten bleiben:

```html
<style>
  :root {
    --md3-mobile-menu-duration: var(--md-motion-duration-medium2);
    /* Weitere Aliase hier hinzufügen bei Bedarf */
  }
</style>
```

Nach vollständiger Migration kann dieser Shim entfernt werden.
