---
title: "Editor System Übersicht"
status: draft
owner: frontend-team
updated: "2025-11-08"
tags: [editor, transcriptions, json-editing, admin]
links:
  - ../reference/token-input-usage.md
  - editor-inline-editing-proposal.md
---

# Editor System - Schnell-Übersicht

**Stand:** 25. Oktober 2025  
**Vollständige Dokumentation:** → `editor-inline-editing-proposal.md`

---

## 🎯 Was wird gebaut?

Ein **vollständiges Editor-System** für Admin + Editor zur Bearbeitung der Transkriptions-JSONs.

---

## 📦 Komponenten

### 1. Navigation
- Neuer Link **"Editor"** in Navbar
- Nur sichtbar für Admin + Editor

### 2. Overview-Seite (`/editor`)
- Länder-Tabs (ARG, BOL, CHL, ...)
- Tabelle pro Land mit:
  - Filename
  - Duración (aus DB)
  - Palabras (aus DB)
  - Last Edited (aus Log)
  - Last Editor (aus Log)
  - [Edit]-Button

### 3. JSON-Editor (`/editor/edit?file=...`)
- Basiert auf Player-Seite
- **Features:**
  - ✏️ Wort-für-Wort Inline-Editing (Doppelklick)
  - 👥 Speaker-Namen bearbeiten
  - 🔖 Bookmarks setzen (localStorage)
  - ↩️ Undo/Redo (5-15 Aktionen, Session)
  - 📋 Audio-Player integriert

### 4. Backend-Routes
- `POST /api/transcript/update-word` (Wort ändern)
- `POST /api/transcript/update-speaker` (Speaker-Name ändern)
- Automatische Backups + Edit-Log

---

## 🔒 Sicherheit

✅ JWT-basierte Authentifizierung  
✅ Role-Check (Admin + Editor only)  
✅ Path-Traversal-Schutz  
✅ Input-Validation (keine HTML-Tags)  
✅ Optimistic Locking (prüft old_value)  

---

## 💾 Datenfluss

```
User (Admin/Editor)
  │
  ├─→ /editor (Overview)
  │   └─→ Lädt Files + DB-Stats + Edit-Log
  │
  └─→ /editor/edit?file=ARG/xxx.json
      ├─→ Inline-Edit Wort
      │   ├─ Frontend: Validation
      │   ├─ Backend: Backup + Update + Log
      │   └─ Undo-Stack speichern
      │
      ├─→ Inline-Edit Speaker
      │   └─ Analog zu Wort
      │
      └─→ Bookmark setzen
          └─ localStorage (lokal)
```

---

## 🗂️ Datei-Struktur

```
src/app/routes/
  └─ editor.py              # Neue Routes

templates/pages/
  ├─ editor_overview.html   # File-Liste
  └─ editor_edit.html       # JSON-Editor

static/js/editor/
  ├─ editor-main.js         # Haupt-Controller
  └─ modules/
      ├─ word-editor.js     # Inline Word-Editing
      ├─ speaker-editor.js  # Speaker-Name-Editing
      ├─ undo-manager.js    # Undo/Redo
      └─ bookmark-manager.js # Bookmarks

static/css/
  └─ editor.css             # Styling

media/transcripts/
```

---

## Siehe auch

- [Token Input Usage](../reference/token-input-usage.md) - Frontend-Komponenten für Bearbeitung
- [Editor Inline Editing Proposal](editor-inline-editing-proposal.md) - Detaillierte Architektur
