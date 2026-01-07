# Release Upload Checkliste

Verwende diese Checkliste für jeden Production-Release.

## Pre-Upload (Lokal)

- [ ] Release-Ordner existiert: `C:\content\quiz_releases\YYYY-MM-DD_HHMM\`
- [ ] `units/` Unterordner vorhanden mit *.json Dateien
- [ ] `audio/` Unterordner vorhanden (kann leer sein, aber muss existieren)
- [ ] JSON-Dateien sind valid (test mit `python scripts/quiz_units_normalize.py`)
- [ ] Release-ID Format ist YYYY-MM-DD_HHMM (z.B. `release_20260106_2200`)

## Upload (Local → Server)

**Dry-Run (IMMER ZUERST):**
```powershell
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "release_20260106_2200" `
  -LocalPath "C:\content\quiz_releases\release_20260106_2200" `
  -ServerUser "root" `
  -ServerHost "games.hispanistica.com"
```

- [ ] Dry-Run zeigt keine Fehler
- [ ] Datei-Count stimmt (units + audio)
- [ ] SSH-Verbindung funktioniert

**Real Upload (mit -Execute):**
```powershell
.\scripts\content_release\sync_release.ps1 `
  -ReleaseId "release_20260106_2200" `
  -LocalPath "C:\content\quiz_releases\release_20260106_2200" `
  -ServerUser "root" `
  -ServerHost "games.hispanistica.com" `
  -Execute
```

- [ ] Upload zeigt "completed successfully"
- [ ] Keine rsync-Fehler

## Import (Server-Seite)

SSH in Server:
```bash
ssh root@games.hispanistica.com
cd /srv/webapps/games_hispanistica/app
```

Vorbereitung:
```bash
cd ../media
ln -sfn releases/release_20260106_2200 current
cd ../app
```

- [ ] Symlink gesetzt

Import durchführen:
```bash
python manage.py import-content \
  --units-path media/current/units \
  --audio-path media/current/audio \
  --release release_20260106_2200
```

- [ ] Import zeigt "successful"
- [ ] Units imported count stimmt
- [ ] Log in `data/import_logs/` vorhanden

## Publish (Server-Seite)

```bash
python manage.py publish-release --release release_20260106_2200
```

- [ ] Publish zeigt "published"
- [ ] Vorheriges Release wurde automatisch unpublished

## Verify

```bash
python manage.py list-releases
```

- [ ] Neuer Release hat status: "published"
- [ ] Units count stimmt
- [ ] published_at Timestamp ist aktuell

## Test im Browser

```
https://games.hispanistica.com/games/quiz
```

- [ ] Neue Topics sind sichtbar
- [ ] Alte Topics sind nicht mehr sichtbar (falls updated)
- [ ] Quiz funktioniert (start game, answer question)

## Rollback (Falls Problem)

```bash
python manage.py unpublish-release --release release_20260106_2200
python manage.py publish-release --release <previous_release_id>
```

- [ ] Vorheriges Release ist wieder active
- [ ] Content ist zurück zu alter Version

---

## Troubleshooting Schnell-Guide

| Problem | Lösung |
|---------|--------|
| `rsync: command not found` | Installiere rsync (WSL/Cygwin/native) |
| `SSH: permission denied` | SSH-Key konfigurieren, siehe Doku § A3 |
| `JSON validation failed` | `python scripts/quiz_units_normalize.py --write` |
| `Local path does not exist` | Check Pfad, richtige Struktur? |
| `units/ directory missing` | Erstelle `release_ID/units/` mit JSON-Dateien |
| `Import: 0 units imported` | Check JSON-Dateien sind valid und haben slug field |
| `Content nicht sichtbar nach Import` | `publish-release` aufrufen! |

---

**Letzte Aktualisierung:** 2026-01-06
