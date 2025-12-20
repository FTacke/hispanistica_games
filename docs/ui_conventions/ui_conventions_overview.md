# UI-Texte Übersicht - CO.RA.PAN Webapp

Diese Dokumentation enthält eine zentrale Übersicht aller statischen UI-Texte der CO.RA.PAN-Webapp. Die Tabellen dienen als Arbeitsgrundlage, um Texte zu auditieren und später automatisiert zu ändern.

## Aufbau und Nutzung

Die Übersicht ist in vier Teile aufgeteilt:

| Datei | Inhalt | Anzahl Einträge |
| --- | --- | --- |
| [`ui_texts_part1_auth.md`](ui_texts_part1_auth.md) | Auth-Templates (Login, Profil, Admin-Users, Passwort) | ~110 |
| [`ui_texts_part2_navigation.md`](ui_texts_part2_navigation.md) | Navigation Drawer, Top App Bar, Footer, Partials | ~45 |
| [`ui_texts_part3_pages.md`](ui_texts_part3_pages.md) | Seiten-Templates (Index, Atlas, Proyecto, Corpus, Editor, Legal) | ~130 |
| [`ui_texts_part4_search.md`](ui_texts_part4_search.md) | Such-Templates und Fehlerseiten | ~100 |

## Tabellenstruktur

Alle Tabellen verwenden folgende einheitliche Spaltenstruktur:

| Spalte | Beschreibung |
| --- | --- |
| `id` | Stabiler, eindeutiger Identifier (z.B. `auth.login.form.username.label`) |
| `context_area` | Funktionsbereich der App (z.B. `auth/login`, `corpus/atlas`) |
| `file_path` | Relativer Pfad zur Datei (z.B. `templates/auth/login.html`) |
| `location_hint` | Kurzer Hinweis zur Position im Template |
| `ui_element_type` | Typ des UI-Elements (siehe unten) |
| `original_text` | Wortwörtlicher aktueller Text |
| `language_planned` | Vorgesehene Sprache (`DE`, `ES`, `EN`) |
| `new_text` | **LEER** - für manuelle Einträge bei Änderungen |

## UI-Element-Typen

| Typ | Beschreibung |
| --- | --- |
| `page_title` | HTML-Seitentitel |
| `hero_text` | Hero-Bereich (Eyebrow, Titel, Intro) |
| `section_heading` | Abschnittsüberschriften |
| `paragraph` | Fließtexte, Beschreibungen |
| `button_label` | Button-Beschriftungen |
| `link_label` | Link-Texte |
| `menu_item` | Navigations- und Menüeinträge |
| `form_label` | Formular-Labels |
| `form_placeholder` | Platzhaltertexte |
| `form_helper` | Hilfe-/Hinweistexte bei Feldern |
| `form_error` | Fehlermeldungen |
| `table_header` | Tabellenüberschriften |
| `badge_label` | Status-Badges, Chips |
| `dialog_title` | Dialog-Überschriften |
| `dialog_body` | Dialog-Inhaltstexte |
| `dialog_button_primary` | Primäre Dialog-Buttons |
| `dialog_button_secondary` | Sekundäre Dialog-Buttons |
| `tooltip` | Tooltips, Title-Attribute |
| `alert_message` | Warnungen, Fehlermeldungen |
| `snackbar_message` | Toast-/Snackbar-Nachrichten |

## Workflow für Änderungen

### Schritt 1: Texte auditieren
1. Öffne die relevante Teildatei
2. Prüfe die `original_text`-Spalte
3. Trage gewünschte Änderungen in `new_text` ein

### Schritt 2: Änderungen anwenden (Agent)
Ein Agent kann die Tabellen parsen und für jede Zeile mit nicht leerem `new_text`:
1. Die Datei unter `file_path` öffnen
2. Mit `id` + `location_hint` die Textstelle finden
3. `original_text` durch `new_text` ersetzen

### Wichtige Hinweise
- `original_text` muss **exakt** dem aktuellen Template-Text entsprechen
- `id` + `file_path` + `location_hint` müssen die Stelle eindeutig identifizieren
- Jede Instanz eines Textes (auch bei Duplikaten) hat eine eigene Zeile

## Sprachverteilung

Die App verwendet aktuell mehrere Sprachen:

| Sprache | Bereiche |
| --- | --- |
| **ES** (Spanisch) | Corpus-UI, Suche, Fehlerseiten, Proyecto-Seiten |
| **DE** (Deutsch) | Admin-Bereich, Auth (Profile, Passwort), Navigation (teilweise), Footer, Legal |
| **EN** (Englisch) | Rollen-Labels, technische Begriffe (Editor, Login, Dashboard) |

## Nicht erfasste Texte

Diese Übersicht erfasst **keine**:
- Dynamische Inhalte aus dem Korpus
- Datenbankgesteuerte Labels
- JavaScript-generierte Texte (werden teilweise erfasst, wo statisch definiert)
- Reine Entwickler-Kommentare

---

*Letzte Aktualisierung: Dezember 2025*
