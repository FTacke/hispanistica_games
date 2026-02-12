Aufgabe:
Überarbeite die TSV- oder CSV-Datei, die im Ordner
C:\dev\hispanistica_games\scripts\quiz_units\input\
liegt. Wenn dort mehrere liegen, frage zunächst nach, welche bearbeitet werden soll.
gemäß unseren verbindlichen Content-Konventionen.

Du arbeitest deterministisch und vollständig prüfbar.
Keine kreative Interpretation.
Keine Auslassungen.

────────────────────────
PHASE 1 – STRUKTURANALYSE
────────────────────────

1) Lies die Datei vollständig ein.
2) Ermittle:
   - Gesamtanzahl Zeilen (inkl. Header)
   - Anzahl Datenzeilen (Gesamt - 1 Headerzeile)
3) Gib aus:
   - "Gesamtzeilen: X"
   - "Datenzeilen: Y"
4) Bestätige:
   - "Ich werde jede der Y Datenzeilen systematisch prüfen."

Noch KEINE Änderungen durchführen.

────────────────────────
PHASE 2 – SYSTEMATISCHE ZEILENPRÜFUNG
────────────────────────

Bearbeite ausschließlich diese Spalten:
- Fragetext (DE)
- Erklärung (DE)
- Korrekte Antwort (DE)
- Falsche Antwort 1 (DE)
- Falsche Antwort 2 (DE)
- Falsche Antwort 3 (DE)

NICHT verändern:
- Schwierigkeit
- Autor:in
- TSV-Struktur
- Zeilenanzahl
- Spaltenanzahl
- Tabulator-Trennung

Für JEDE Datenzeile:

1) Prüfe Abkürzungen:
   - z. B. → z.B.
   - u. a. → u.a.
   - d. h. → d.h.
   Zähle Anzahl Änderungen.

2) Prüfe Antwortanfang:
   - Falls Antwort mit Buchstabe beginnt → erster Buchstabe groß.
   Zähle Anzahl Änderungen.

3) Schütze linguistische Notation:
   - /.../ unverändert
   - [... ] unverändert
   - <...> unverändert
   Diese dürfen niemals kursiv oder verändert werden.

4) Kursiv-Regeln (kontextsensitiv, aber konsequent):
   IMMER kursiv:
   - spanische Beispielwörter (casa, caza, zapato, cine etc.)
   - Terminologie: seseo, ceceo, distinción, yeísmo
   - englische Minimalpaare (thin, sin)
   - fremdsprachige Lexeme im didaktischen Kontext

   NICHT kursiv:
   - deutsche Fachwörter
   - Eigennamen/Ortsnamen
   - Symbolnotation (siehe Punkt 3)

5) Umgang mit Anführungszeichen:
   - Wenn rein markierend: "los amigos" → *los amigos*
   - Wenn echtes Zitat: Anführungszeichen beibehalten,
     nur fremdsprachige Wörter im Zitat kursiv setzen.

6) Keine verschachtelten Markdown-Marker.
7) Kein Bold.
8) Keine inhaltlichen Umformulierungen.

Für JEDE Zeile dokumentieren:
- Zeilennummer
- Anzahl Änderungen in dieser Zeile
- Kurze Stichworte (z.B. "2 Kursiv, 1 Abkürzung, 1 Großschreibung")

Am Ende dieser Phase ausgeben:
- Tabelle:
   Zeile | Änderungen | Typen
- Gesamtanzahl Änderungen
- Anzahl Zeilen ohne Änderung

────────────────────────
PHASE 3 – KONSISTENZCHECK
────────────────────────

Prüfe:

1) Wurde jede Datenzeile geprüft?
   → Anzahl geprüfter Zeilen = Y ?

2) Wurden alle bekannten Terminologien konsistent kursiv gesetzt?
   - seseo
   - ceceo
   - distinción
   - yeísmo

3) Gibt es noch unnormierte Abkürzungen?
4) Wurde keine /.../, [...], <...> Sequenz verändert?

Bestätige explizit:
- "Alle Y Datenzeilen wurden geprüft."
- "Zeilenanzahl nach Bearbeitung unverändert."
- "TSV-Struktur unverändert."

────────────────────────
PHASE 4 – DIFF & FREIGABE
────────────────────────

1) Zeige vollständigen DIFF (vorher/nachher).
2) Liste Unsicherheiten:
   - Zeilennummer
   - Ausdruck
   - Begründung

3) Frage:
   "Soll ich die Änderungen anwenden?"

Erst nach expliziter Bestätigung Datei überschreiben.

Am Ende muss stehen:
"Alle Zeilen wurden vollständig geprüft und validiert."


ZUSÄTZLICHE STRUKTURPRÜFUNG – HEADER-DUPLIKATE

1) Prüfe, ob innerhalb der Datei (außer der ersten Zeile) eine Zeile exakt
   dem Header entspricht:

   "Schwierigkeit	Fragetext (DE)	Erklärung (DE)	Korrekte Antwort (DE)	Falsche Antwort 1 (DE)	Falsche Antwort 2 (DE)	Falsche Antwort 3 (DE)	Autor:in"

2) Falls eine solche Zeile gefunden wird:
   - Gib aus:
       "Header-Duplikat gefunden in Zeile X."
   - Zähle sie NICHT als Datenzeile.
   - Entferne sie aus der Arbeitskopie.
   - Dokumentiere die Entfernung.

3) Nach Entfernung aller Header-Duplikate:
   - Berechne erneut:
       - Gesamtzeilen
       - Datenzeilen
   - Gib die neuen Werte aus.

4) Bestätige:
   - "Es existiert genau eine Headerzeile."
   - "Alle weiteren Zeilen sind Datenzeilen."

5) Falls mehrere Header-Duplikate existieren:
   - Liste alle Zeilennummern auf.
   - Entferne sie alle.
   - Dokumentiere Anzahl entfernter Duplikate.


STRUKTUR-INTEGRITÄTSKONTROLLE

Bestätige:

1) Die finale Zeilenanzahl = 1 Header + Y Datenzeilen.
2) Keine weitere Zeile entspricht exakt dem Header.
3) TSV-Struktur unverändert (gleiche Anzahl Spalten pro Zeile).
4) Keine leeren Zeilen am Ende der Datei.
