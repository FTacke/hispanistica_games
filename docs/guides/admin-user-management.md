---
title: "Admin: Benutzerverwaltung — CO.RA.PAN"
status: active
owner: backend-team
updated: "2025-12-01"
tags: [admin, users, management, guide]
links:
  - ../reference/api-auth-endpoints.md
  - ../reference/auth-access-matrix.md
---

# Admin: Benutzerverwaltung

Diese Anleitung beschreibt die Benutzerverwaltung für Administratoren in CO.RA.PAN.

## 1. Übersicht

Die Admin-Benutzerverwaltung ist unter `/auth/admin_users` erreichbar und ermöglicht:

- Anzeigen aller Benutzerkonten
- Erstellen neuer Benutzer mit Einladungslink
- Bearbeiten von E-Mail, Rolle und Aktivitätsstatus
- Passwort-Reset / Einladung erneut senden

## 2. Benutzerliste

### Standardansicht (nur aktive Benutzer)

Standardmäßig werden nur **aktive Benutzer** (`is_active = True`) angezeigt. Dies sorgt für eine übersichtliche Liste ohne deaktivierte Konten.

### Filter-Chip „Inaktive anzeigen"

Über dem Tabellenkopf befindet sich ein Filter-Chip mit dem Label „Inaktive anzeigen":

- **Chip nicht ausgewählt**: Nur aktive Benutzer werden angezeigt.
- **Chip ausgewählt**: Aktive und inaktive Benutzer werden angezeigt.

Die Sortierung priorisiert aktive Benutzer vor inaktiven.

### Suchfunktion

Das Suchfeld filtert Benutzer nach Benutzername oder E-Mail (serverseitig).

## 3. Benutzer bearbeiten

Der Stift-Icon-Button in der Aktionen-Spalte öffnet den Bearbeiten-Dialog.

### Dialog-Struktur

Der Bearbeiten-Dialog enthält folgende Sektionen:

#### Sektion „Account"
- **Benutzername** (nur Anzeige, nicht editierbar)
- **E-Mail** (editierbar, mit Validierung)

#### Sektion „Rolle"
- **Rolle** (Dropdown):
  - `admin` → Administrator
  - `editor` → Editor
  - `user` → Standardnutzer

#### Sektion „Status"
- **Konto aktiv** (Switch)
  - Ein → Benutzer kann sich anmelden
  - Aus → Benutzer kann sich nicht anmelden, bleibt aber im System erhalten
- Helpertext: „Inaktive Konten können sich nicht mehr anmelden, bleiben aber im System erhalten."

#### Sektion „Passwort / Einladung"
- Button: „Passwort zurücksetzen / Einladung erneut senden"
- Erzeugt einen neuen Reset-Token und zeigt den Einladungslink an

### Aktionen
- **Abbrechen**: Schließt den Dialog ohne Änderungen
- **Speichern**: Übernimmt die Änderungen

## 4. Schutz des letzten Administrators

Das System verhindert, dass der **letzte aktive Administrator** deaktiviert oder herabgestuft wird. Wenn nur ein aktiver Admin existiert:

- **Rollenwechsel weg von `admin`**: Wird abgelehnt mit Fehlermeldung
- **Deaktivieren des Kontos**: Wird abgelehnt mit Fehlermeldung

Fehlermeldung: „Der letzte aktive Administrator kann nicht herabgestuft oder deaktiviert werden."

## 5. API-Endpunkte

| Endpunkt | Methode | Beschreibung |
|----------|---------|-------------|
| `/admin/users` | GET | Liste aller Benutzer (mit optionalen Filtern) |
| `/admin/users/<id>` | GET | Details eines Benutzers |
| `/admin/users` | POST | Neuen Benutzer anlegen |
| `/admin/users/<id>` | PATCH | Benutzer bearbeiten |
| `/admin/users/<id>/reset-password` | POST | Passwort-Reset / Einladung erneuern |

### Query-Parameter für GET `/admin/users`

| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `q` | string | Suche nach Benutzername/E-Mail |
| `role` | string | Filter nach Rolle (admin, editor, user) |
| `include_inactive` | `1` | Zeigt auch inaktive Benutzer |
| `status` | string | Status-Filter (active, inactive, all) |
| `page` | int | Seitennummer (Default: 1) |
| `size` | int | Einträge pro Seite (Default: 50) |

### PATCH `/admin/users/<id>` Body

```json
{
  "email": "new@example.org",
  "role": "editor",
  "is_active": true
}
```

Alle Felder sind optional.

## 6. UI-Patterns

Die Admin-Benutzerverwaltung verwendet folgende MD3-Patterns:

### Filter-Chips
- `.md3-chip` für den Filter-Button
- `.md3-chip--selected` für den ausgewählten Zustand
- Icon wechselt zwischen `visibility_off` und `visibility`

### Bearbeiten-Dialog
- `.md3-dialog--wide` für breiteren Dialog
- `.md3-fieldset` für visuelle Gruppierung
- `.md3-switch-row` für den Aktiv/Inaktiv-Toggle
- `.md3-alert--error` für Fehlermeldungen
- `.md3-text-success` / `.md3-text-error` für Feedback-Texte

### Buttons
- `.md3-button--filled` für primäre Aktionen
- `.md3-button--text` für sekundäre Aktionen
- `.md3-button--tonal` für tertiäre Aktionen

## 7. Weiterführende Links

- [Authentication Guide](./authentication.md)
- [Auth Access Matrix](../reference/auth-access-matrix.md)
- [API Auth Endpoints](../reference/api-auth-endpoints.md)
