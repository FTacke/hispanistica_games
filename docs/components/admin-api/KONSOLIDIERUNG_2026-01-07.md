# Admin Upload Plan – Konsolidierung 2026-01-07

## Was wurde gemacht?

Die beiden Dateien `admin_upload_plan.md` und `admin_upload_plan_UPDATED.md` wurden zu einer einzigen finalen Datei **`admin_upload_plan.md`** konsolidiert.

## Struktur der finalen Datei

Die neue Datei ist in 14 klare Hauptsektionen gegliedert:

1. **Ziel & Scope** – Projektübersicht, Nicht-Ziele
2. **Begriffe & Grundannahmen** – Fachliche + technische Begriffe
3. **Verbindliche technische Entscheidungen** (8 Untersektionen)
   - unit_id / slug (✅ GEKLÄRT)
   - DB Models & Felder
   - Publish-Mechanik
   - Media-Handling & Audio-Referenzen
   - Service Integration (NICHT CLI!)
   - Logs & Error Structure
   - Auth & Admin-Gating
   - Bestehende UI/Routes Struktur
4. **Admin-Funktionen (fachlich)** – Upload, Release-Handling, Unit-Verwaltung
5. **UI / Layout / Style-Vorschlag** (7 Untersektionen)
   - Seitenaufbau (Wireframe)
   - Upload-Bereich (Section 1)
   - Release Actions (Section 2)
   - Units-Liste (Section 3)
   - Skeletons & Loading States
   - Tabs & Navigation
   - Responsive Verhalten
6. **UX-Begründungen** – 5 dokumentierte Design-Entscheidungen
7. **Backend-Endpunkte (MVP)** – API-Spezifikation
8. **Nicht-Ziele & spätere Erweiterungen** – Was bewusst NICHT im MVP
9. **Fehlende Komponenten** – Was neu erstellt werden muss
10. **Accessibility Checkliste** – WCAG-Konformität
11. **Implementierungsfahrplan** – Phase A (Repo) + Phase B (Server)
12. **Akzeptanzkriterien (MVP)** – Testbare Kriterien
13. **Repo Evidence** – Quellenangaben
14. **Offene Punkte** – (keine mehr!)

## Was wurde konsolidiert?

### Aus `admin_upload_plan_UPDATED.md` übernommen:
- ✅ Detaillierte Repo Evidence mit Zeilennummern
- ✅ Service Integration Code-Beispiele
- ✅ ImportResult Dataclass Details
- ✅ Auth Pattern Code-Beispiele
- ✅ CLI Exit Codes Dokumentation
- ✅ SHA256 Hash Validation Details

### Aus `admin_upload_plan.md` übernommen:
- ✅ Vollständiger UI/Layout-Vorschlag (7 Subsektionen)
- ✅ Wireframe in Textform
- ✅ HTML-Strukturen für Upload/Release/Units
- ✅ CSS-Komponenten-Zuordnung
- ✅ Status Badge Definitionen
- ✅ UX-Begründungen (5 Design-Entscheidungen)
- ✅ Responsive Behavior Spezifikation
- ✅ Accessibility Checkliste

### Widersprüche eliminiert:
- ❌ "unit_id offen?" → ✅ **slug** (geklärt)
- ❌ Doppelte Section-Beschreibungen → ✅ Konsolidiert
- ❌ Inkonsistente Terminologie → ✅ Vereinheitlicht

## Archivierte Dateien

- `docs/_archive/admin_upload_plan_UPDATED_20260107.md` – Technische Repo-Evidence-Version
- `docs/components/admin-api/admin_upload_plan_BACKUP.md` – Pre-Konsolidierungs-Backup

## Finale Datei

**Pfad:** `docs/components/admin-api/admin_upload_plan.md`

**Status:** 
- ✅ Technisch vollständig (alle Repo-Evidence vorhanden)
- ✅ UI/UX vollständig durchdacht (MD3-konform)
- ✅ Widerspruchsfrei
- ✅ Bereit für UI-Review
- ✅ Bereit für Implementierungs-Prompt

**Umfang:** ~900 Zeilen, 14 Hauptsektionen

---

**Konsolidierung abgeschlossen am 2026-01-07**
