---
title: "Editor System Update und Klärungen"
status: draft
owner: frontend-team
updated: "2025-11-08"
tags: [editor, speaker-editing, reclassification, undo, backup]
links:
  - editor-system-overview.md
  - ../reference/token-input-usage.md
---

# Editor System - Update & Klärungen

**Datum:** 25. Oktober 2025  
**Status:** Ready for Implementation

---

## ✅ User-Entscheidungen (bestätigt)

1. **Undo-History:** 10 Aktionen
2. **Backup-Rotation:** 10 Backups pro File
3. **Admin-Dashboard:** Ja (Edit-Log-Viewer)
4. **Bookmark-Notizen:** Ja (Freitext)

---

## 🔴 WICHTIGE KLÄRUNG: Speaker-Editing

### Problem erkannt & korrigiert

**Mein ursprüngliches (falsches) Verständnis:**
- Speaker-Namen global ändern
- Wenn `spk1` → `lib-pm` heißt, dann Namen in `speakers[]` ändern
- Alle Segmente mit `spk1` zeigen neuen Namen

**Korrektes Verständnis (nach User-Feedback):**
- **Segment-Reclassification**, nicht Name-Editing
- Wenn Segment falsch klassifiziert ist (`lib-pm` statt `lec-pm`)
- Dann `segments[i].speaker` von `spk1` → `spk2` ändern
- `speakers[]`-Array bleibt **komplett unverändert**

---

## 📝 Technische Umsetzung

### Szenario-Beispiel

**Ausgangssituation:**
```json
{
  "speakers": [
    {"spkid": "spk1", "name": "lib-pm"},
    {"spkid": "spk2", "name": "lec-pm"},
    {"spkid": "spk3", "name": "lib-pf"}
  ],
  "segments": [
    {
      "speaker": "spk1",
      "words": [...]
    },
    {
      "speaker": "spk1",
      "words": [...]
    }
  ]
}
```

**User-Aktion:**
1. Doppelklick auf Speaker-Label bei Segment 0 (zeigt "lib-pm")
2. Dropdown öffnet sich mit allen verfügbaren Speakern
3. User wählt "lec-pm"

**Backend-Logik:**
1. Lookup: `"lec-pm"` → `spkid = "spk2"`
2. Update: `segments[0].speaker = "spk2"`
3. Backup + Log
4. Response: `{"success": true, "new_name": "lec-pm"}`

**Resultat:**
```json
{
  "speakers": [
    {"spkid": "spk1", "name": "lib-pm"},
    {"spkid": "spk2", "name": "lec-pm"},
    {"spkid": "spk3", "name": "lib-pf"}
  ],
  "segments": [
    {
      "speaker": "spk2",
      "words": [...]
    },
    {
      "speaker": "spk1",
      "words": [...]
    }
  ]
}
```

---

## 🔧 Implementation-Details

### Frontend: SpeakerEditor

**Feature:**
- Doppelklick auf Speaker-Label
- **Dropdown** mit allen verfügbaren Speakern (nicht Freitext)
- Bei Auswahl: Backend-Call zum Reclassify
- Nur das eine Label ändert sich

**Wichtig:**
- Maps aufbauen: `spkid → name` UND `name → spkid`
- Dropdown verhindert ungültige Speaker-Namen
- Optional: Freitext-Input mit Autocomplete (falls neuer Speaker)

### Backend: `/api/transcript/reclassify-segment`

**Endpoint:** `POST /api/transcript/reclassify-segment`

**Payload:**
```json
{
  "transcript_file": "ARG/xxx.json",
  "segment_index": 0,
  "old_spkid": "spk1",
  "new_spkid": "spk2"
}
```

**Validierung:**
- Segment existiert?
- Aktueller `spkid` stimmt mit `old_spkid` überein?
- Neuer `spkid` existiert in `speakers[]`?

**Aktion:**
- `segments[segment_index].speaker = new_spkid`
- Backup erstellen
- Log schreiben (mit Namen für Lesbarkeit)

---

## 📊 Edit-Log-Format (aktualisiert)

**Action: `reclassify_segment`**

```jsonl
{
  "timestamp": "2025-10-25T14:32:15",
  "user": "editor_test",
  "role": "editor",
  "file": "ARG/Mitre.json",
  "action": "reclassify_segment",
  "segment_index": 0,
  "old_spkid": "spk1",
  "new_spkid": "spk2",
  "old_name": "lib-pm",
  "new_name": "lec-pm",
  "backup_file": "transcripts/json-backup/Mitre_backup_20251025_143215.json"
}
```

**Vorteile:**
- Speichert `spkid` (technisch korrekt)
- Speichert `name` (für Lesbarkeit)
- Admin kann Log verstehen ohne JSON zu öffnen

---

## ↩️ Undo für Speaker-Reclassification

**Undo-Action:**
```javascript
{
  type: 'speaker_reclassify',
  data: {
    transcriptFile: 'ARG/xxx.json',
    segmentIndex: 0,
    oldSpkid: 'spk1',
    newSpkid: 'spk2',
    oldName: 'lib-pm',
    newName: 'lec-pm'
  }
}
```

**Undo ausführen:**
- Backend-Call mit vertauschten Werten (`old` ↔ `new`)
- UI-Update: Label zurücksetzen
- Neues Backup + Log mit `is_undo: true`

---

## Siehe auch

- [Editor System Übersicht](editor-system-overview.md) - Komponenten und Architektur
- [Token Input Usage](../reference/token-input-usage.md) - Frontend-Implementierung
