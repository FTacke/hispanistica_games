# Data Synchronisation: Dev → Production

Diese Anleitung beschreibt, wie die korpusbezogenen Daten vom Dev-Rechner auf den Produktionsserver synchronisiert werden.

> **Wichtig:** Bei allen Sync-Operationen gilt: **Lokal ist die Quelle der Wahrheit**. Der Server wird an den lokalen Stand angepasst.

## Übersicht

### Transport-Methoden

Das Sync-System unterstützt zwei Transport-Methoden:

| Methode | Beschreibung | Wann verwendet |
|---------|--------------|----------------|
| **rsync** (bevorzugt) | Echter Delta-Sync, überträgt nur geänderte Dateiteile | Wenn rsync unter Windows im PATH verfügbar |
| **tar+base64** (Fallback) | Packt komplettes Verzeichnis und überträgt via SSH | Automatisch, wenn rsync nicht verfügbar |

Die Entscheidung wird **automatisch** getroffen - wenn rsync installiert ist, wird es verwendet.

### Data-Verzeichnisse (`data/`)

| Verzeichnis | Wird synchronisiert | Beschreibung |
|-------------|---------------------|--------------|
| `blacklab_export/` | ✅ Ja | TSV-Export für BlackLab Indexierung (739MB) |
| `metadata/` | ✅ Ja | Metadaten (JSONL, etc.) (2.8MB) |
| `db_public/` | ✅ Ja | Öffentliche Datenbank-Dateien (8KB) |
| `exports/` | ✅ Ja | Export-Dateien (163MB) |
| `counters/` | ✅ Ja | Zähler-Dateien (4KB) |
| `blacklab_index/` | ❌ Nein | Wird auf Server neu gebaut |
| `blacklab_index.backup/` | ❌ Nein | Backup des Index (nur lokal) |
| `stats_temp/` | ❌ Nein | Temporäre Statistik-Dateien |
| `db/` | ❌ Nein | Dev-Datenbank (nicht für Prod) |

### Media-Verzeichnisse (`media/`)

| Verzeichnis | Wird synchronisiert | Beschreibung |
|-------------|---------------------|--------------|
| `transcripts/` | ✅ Ja | Transkript-Dateien |
| `mp3-full/` | ❌ Nein | Zu groß / separat verwaltet |
| `mp3-split/` | ❌ Nein | Zu groß / separat verwaltet |
| `mp3-temp/` | ❌ Nein | Temporäre Dateien |

## Voraussetzungen

- **SSH-Zugang** zum Server (VPN erforderlich)
- **Python 3** auf Windows (für base64 encoding bei Fallback)
- **Windows SSH-Client** (in Windows 10/11 integriert)
- **rsync** (optional aber empfohlen) - cwRsync unter `tools/cwrsync/`
- SSH-Key für Server in `~/.ssh/marele`

### SSH-Key-Konfiguration (Variante A — Empfohlen)

> **Dies ist die empfohlene Standardkonfiguration** für automatisierte Sync-/Deploy-Operationen.

Der SSH-Key `marele` sollte **ohne Passphrase** sein:

**Passphrase entfernen (falls vorhanden):**
```powershell
# Fragt nach der alten Passphrase, dann neue leer lassen:
ssh-keygen -p -f $env:USERPROFILE\.ssh\marele
```

**Test der SSH-Verbindung:**
```powershell
ssh -i $env:USERPROFILE\.ssh\marele root@marele.online.uni-marburg.de "echo OK"
# Sollte ohne Passphrase-Abfrage "OK" ausgeben
```

> **Sicherheitshinweis:** Der passwortlose Key ist ein dedizierter Deploy-Key, 
> der nur für automatisierte Sync-/Deploy-Operationen verwendet wird.
> Bei Sicherheitsbedenken kann alternativ ssh-agent verwendet werden (siehe unten).

### Alternative: ssh-agent (Variante B)

> **Nur relevant**, falls du künftig ein anderes rsync mit Windows-SSH nutzt oder
> den Key mit Passphrase behalten möchtest.

Falls der SSH-Key eine Passphrase haben soll, kann ssh-agent verwendet werden:

**Einmalige Einrichtung (als Administrator):**
```powershell
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
```

**Pro Session den SSH-Key laden:**
```powershell
ssh-add $env:USERPROFILE\.ssh\marele
# → Passphrase einmal eingeben
```

> **⚠️ Einschränkung:** cwRsync verwendet seinen eigenen Cygwin-SSH und **nicht** den Windows ssh-agent.
> Mit cwRsync ist daher ein passwortloser Key (Variante A) die einzig praktikable Lösung.

### rsync Installation (optional, aber empfohlen)

Für effizienten Delta-Sync sollte rsync unter Windows installiert werden. Bei fehlendem rsync wird automatisch die tar+base64-Fallback-Methode verwendet.

**Aktuelle Konfiguration:**

In diesem Projekt ist **cwRsync 3.4.1** vorinstalliert unter:
```
tools/cwrsync/bin/
```

Das Script fügt diesen Pfad automatisch zum PATH hinzu.

**Alternative Installationsoptionen:**

| Option | Beschreibung |
|--------|--------------|
| **cwRsync** (empfohlen) | Standalone rsync für Windows, bereits in `tools/cwrsync/` |
| **Git for Windows** | rsync ist oft bereits enthalten (Git Bash) |
| **MSYS2** | `pacman -S rsync` nach MSYS2-Installation |

**Prüfen ob rsync verfügbar ist:**
```powershell
Get-Command rsync -ErrorAction SilentlyContinue
```

> **Hinweis zu 8.3-Pfaden:** Das Script verwendet intern Windows 8.3-Kurzpfade 
> (z.B. `FELIXT~1` statt `Felix Tacke`) um Probleme mit Leerzeichen in Pfaden zu vermeiden.
> Das ist ein Implementierungsdetail und erfordert keine Aktion.

> **Hinweis zu WSL:** WSL funktioniert **nicht** mit Uni-VPN (Routing-Problem). 
> Daher verwenden wir natives Windows-rsync.

## Verbindungsdaten

| Parameter | Wert |
|-----------|------|
| Server IP | `137.248.186.51` |
| Server DNS | `marele.online.uni-marburg.de` |
| User | `root` |
| SSH-Alias | `marele` (in `~/.ssh/config`) |
| Datenziel | `/srv/webapps/corapan/data` |
| Medienziel | `/srv/webapps/corapan/media` |
| Lokaler Data-Pfad | `C:\dev\corapan-webapp\data` |
| Lokaler Media-Pfad | `C:\dev\corapan-webapp\media` |
| App-User (Server) | `hrzadmin` (uid 1000) |

---

## End-to-End Deploy (Empfohlen)

Der einfachste Weg für ein vollständiges Deployment (Data + Media + Server-Deploy + Health-Check):

```powershell
cd C:\dev\corapan-webapp
.\scripts\deploy_sync\deploy_full_prod.ps1
```

Dieses Script führt automatisch aus:
1. Data-Sync aller Verzeichnisse (rsync oder tar+base64)
2. Media-Sync (transcripts)
3. Server-Deploy mit `--rebuild-index --skip-git`
4. Health-Check über HTTPS/SSH

### Transport-Erkennung im Log

Im Log erkennst du, welche Methode verwendet wird:

**rsync aktiv:**
```
[Sync] rsync verfügbar (C:\Program Files\Git\usr\bin\rsync.exe) - rsync-Modus aktiv
...
[metadata]
  Analysiere Änderungen...
  ...
  Starte Upload (rsync)...
    [rsync] metadata → root@137.248.186.51:/srv/webapps/corapan/data/metadata
    [rsync] metadata - OK ✓
```

**Fallback aktiv:**
```
[Sync] rsync nicht gefunden - verwende tar+base64 Fallback
...
[metadata]
  Analysiere Änderungen...
  ...
  Starte Upload (tar+base64)...
    Uploading (2.5 MB)...
  Status: OK ✓
```

### Diff-Zusammenfassung

**Vor jedem Upload** wird eine Diff-Zusammenfassung angezeigt:
- Anzahl neuer, geänderter und gelöschter Dateien
- Beispiel-Dateinamen zur Orientierung

```
[metadata]
  Analysiere Änderungen...

  Diff-Zusammenfassung:
    Dateien lokal: 15, remote: 14
    Neu: 1, Geändert: 2, Gelöscht: 0
      + Neu: metadata/new_file.jsonl
      ~ Geändert: metadata/corpus.jsonl, metadata/speakers.jsonl

  Starte Upload (rsync)...
    [rsync] metadata → root@137.248.186.51:/srv/webapps/corapan/data/metadata
    Übertragen: 3 Dateien/Änderungen
    [rsync] metadata - OK ✓
  Status: OK ✓
```

---

## Einzelne Syncs

### Nur Data synchronisieren

```powershell
cd C:\dev\corapan-webapp
.\scripts\deploy_sync\sync_data.ps1
```

Synchronisiert: `counters`, `db_public`, `metadata`, `exports`, `blacklab_export`

### Nur Media synchronisieren

```powershell
cd C:\dev\corapan-webapp
.\scripts\deploy_sync\sync_media.ps1
```

Synchronisiert: `transcripts` (erweiterbar in der Konfiguration)

---

## Remote-Struktur prüfen

```powershell
# In PowerShell (nicht WSL!)
ssh -i "$env:USERPROFILE\.ssh\marele" root@137.248.186.51 "ls -la /srv/webapps/corapan/data && du -sh /srv/webapps/corapan/data/*"
```

---

## Alternative: Manuelle Sync-Methoden

### Methode A: tar+base64 Fallback (automatisch bei fehlendem rsync)

> **Hinweis:** Diese Methode wird automatisch verwendet, wenn rsync nicht installiert ist. Du musst sie nicht manuell aufrufen.

<details>
<summary>Technische Details zur tar+base64-Methode</summary>

Die tar+base64-Methode funktioniert wie folgt:
1. Lokales Verzeichnis wird als `tar.gz` gepackt
2. Die tar-Datei wird base64-kodiert (via Python)
3. Die base64-Daten werden via SSH übertragen
4. Auf dem Server wird dekodiert und entpackt

```powershell
# Beispiel eines manuellen tar-Syncs (für Debugging)
function Sync-DataDir {
    param([string]$DirName)
    
    $localPath = "C:\dev\corapan-webapp\data"
    $keyPath = "$env:USERPROFILE\.ssh\marele"
    $server = "root@137.248.186.51"
    $remotePath = "/srv/webapps/corapan/data"
    
    Write-Host "Creating tar for $DirName..." -ForegroundColor Cyan
    cd $localPath
    tar -czf "$env:TEMP\$DirName.tar.gz" $DirName
    
    $sizeMB = [math]::Round((Get-Item "$env:TEMP\$DirName.tar.gz").Length / 1MB, 2)
    Write-Host "Uploading $DirName ($sizeMB MB)..." -ForegroundColor Cyan
    
    python -c "import base64; print(base64.b64encode(open(r'$env:TEMP\$DirName.tar.gz','rb').read()).decode())" | `
        ssh -i $keyPath $server "python3 -c 'import base64,sys; sys.stdout.buffer.write(base64.b64decode(sys.stdin.read()))' > /tmp/$DirName.tar.gz && cd $remotePath && tar -xzf /tmp/$DirName.tar.gz && rm /tmp/$DirName.tar.gz && echo 'SUCCESS: $DirName synced'"
    
    Remove-Item "$env:TEMP\$DirName.tar.gz" -ErrorAction SilentlyContinue
}
```

</details>

### Methode B: rsync manuell (für Debugging)

Falls rsync installiert ist und du manuell testen möchtest:

```bash
# In Git Bash oder MSYS2 Terminal
rsync -avz --delete \
  --exclude 'blacklab_index' \
  --exclude 'blacklab_index.backup' \
  --exclude 'stats_temp' \
  --exclude 'db' \
  -e "ssh -i ~/.ssh/marele" \
  /c/dev/corapan-webapp/data/ \
  root@137.248.186.51:/srv/webapps/corapan/data/
```

> **Hinweis:** Der Pfad `/c/dev/...` ist das MSYS2/Git-Bash-Format. Je nach rsync-Installation können auch `/cygdrive/c/dev/...` oder Windows-Pfade erforderlich sein.

### Methode C: rsync über WSL (wenn VPN-Routing funktioniert)

Falls WSL das VPN-Netzwerk erreichen kann:

```bash
cd /mnt/c/dev/corapan-webapp

rsync -avz --delete \
  --exclude 'blacklab_index' \
  --exclude 'blacklab_index.backup' \
  --exclude 'stats_temp' \
  --exclude 'db' \
  ./data/ root@marele.online.uni-marburg.de:/srv/webapps/corapan/data/
```

Falls WSL kein VPN-Routing hat, in `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=true
```

Dann WSL neu starten: `wsl --shutdown`

---

## Troubleshooting

### SSH fragt wiederholt nach Passphrase

Falls SSH bei jedem rsync-Aufruf nach der Passphrase fragt:

1. **Passphrase vom Key entfernen (empfohlen):**
   ```powershell
   ssh-keygen -p -f $env:USERPROFILE\.ssh\marele
   # Alte Passphrase eingeben, neue leer lassen
   ```

2. **Test:** `ssh -i $env:USERPROFILE\.ssh\marele root@marele.online.uni-marburg.de "echo OK"`

> **Hinweis:** cwRsync verwendet einen eigenen Cygwin-SSH, der nicht mit dem Windows ssh-agent 
> zusammenarbeitet. Daher ist ein passwortloser Key die zuverlässigste Lösung.

### WSL kann Server nicht erreichen (VPN-Problem)

```powershell
# Test von Windows aus (sollte funktionieren):
ping 137.248.186.51

# Test von WSL aus (funktioniert oft nicht mit VPN):
wsl -e bash -c "ping -c 2 137.248.186.51"
```

**Lösung:** PowerShell-Scripts verwenden (nicht WSL).

### SSH Connection Timeout

- VPN aktiv?
- `ssh -v -i "$env:USERPROFILE\.ssh\marele" root@137.248.186.51` für Debug

### tar: Ignoring unknown extended header keyword 'SCHILY.fflags'

Diese Warnung kann ignoriert werden - die Dateien werden korrekt übertragen.

### Health-Check schlägt fehl

Falls der Health-Check nach dem Deploy fehlschlägt:
1. Manuell prüfen: `ssh root@137.248.186.51 "docker logs corapan-webapp --tail 50"`
2. Container-Status: `ssh root@137.248.186.51 "docker ps -a | grep corapan"`

---

## Quick Reference

```powershell
# Vollständiges Deployment (Data + Media + Deploy + Health)
.\scripts\deploy_sync\deploy_full_prod.ps1

# Nur Data synchronisieren
.\scripts\deploy_sync\sync_data.ps1

# Nur Media synchronisieren
.\scripts\deploy_sync\sync_media.ps1
```

---

## Siehe auch

- [BlackLab Index Rebuild](blacklab_index_rebuild.md)
- [Production Deployment](production-deployment.md)
- [Development Setup](development-setup.md)
