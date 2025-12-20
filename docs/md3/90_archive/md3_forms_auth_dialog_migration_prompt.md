Du arbeitest im CO.RA.PAN-Webapp-Projekt und sollst die MD3-Implementierung von Formularen, Auth-Seiten und Dialogen auf Gold-Standard heben. Verwende ausschließlich die MD3-Standards der App und entferne mixed/legacy Markup sowie nicht-tokenisierte CSS-Fragmente.

Lies und beziehe ein:
- docs/md3-template/md3_forms_auth_dialog_audit.md
- docs/md3-template/md3_textpages_standard.md
- docs/md3-template/md3_auth_pages_standard.md
- docs/md3-template/md3_forms_auth_dialog_standard.md (besteht bereits, ist maßgebliche Referenz)
- Vorhandene Skeletons und CSS-Komponenten unter static/css/md3/components/

Ziel:
- Einheitliches, tokens-basiertes MD3-Design für Formulare, Auth-Seiten, Dialoge, Sheets.
- Kein unkontrolliertes HTML, keine Alternativ-Textfields, keine verkrüppelten Label-Hintergrund-Hacks.
- Guards + Linting verhindern neue Fehler.

---

AUFGABEN

1) Dokumentation anlegen
   Lege ein neues Dokument `docs/md3-template/md3_forms_auth_dialog_standard.md` an (Inhalt siehe unten) und verlinke es in den bestehenden Standards. Es definiert:
   - Canonical Outlined Textfield
   - Canonical Checkbox
   - Canonical Dialog + Sheet
   - Auth-Seitenstruktur
   - Token-only-Regeln
   - Guard- und Linting-Regeln
   - Skeleton-Verpflichtungen

2) HTML-Markup normalisieren
   - Verwende ausschließlich das Canonical Outlined Textfield (div + input + label + outline).
   - Ziehe alle Auth-Formulare, Profile, User-Management, Reset-Passwort-Formulare, Login-Sheets, Admin-User-Listen darauf.
   - Ersetze alle nicht-canonical Textfield-Markups.
   - Dialoge: alle Dialoge auf md3-dialog-Skeleton migrieren.
   - Sheets: `.md3-sheet` verwenden; `.md3-login-sheet` nur als klar markierter Legacy-Alias.

3) CSS bereinigen
   - Entferne die alte Checkbox aus forms.css oder kapsle sie als Legacy, baue dafür die neue md3-checkbox-Komponente.
   - Entferne alle Hex-Farben aus Komponenten-CSS.
   - Ersetze sie durch Tokens (`--md-sys-*`).
   - Keine Inline-Styles, keine Schatten/Outline-Hacks bei Textfields.
   - Stelle sicher, dass der Label-Hintergrund beim Float-Label korrekt durch tokens (`--md-sys-color-surface`) erzeugt wird.
     -> Kein „Wegpatchen“ der Farbe.

4) Guards / Linting erweitern
   - `scripts/md3-forms-auth-guard.py`:
     Prüft Canonical-Textfields, Canonical-Dialoge, keine Inline-Styles, keine Legacy-Checkbox, nur MD3-Buttontypen.
   - `scripts/md3-lint.py`:
     Verbot von Hex-Farben, verbotenen Selektoren, neuen non-MD3 Overrides.

5) Skeletons
   - Ergänze/überarbeite Skeleton-Dateien unter `templates/_md3_skeletons/`:
     `page_form_skeleton.html`, `auth_form_skeleton.html`, `dialog_skeleton.html`, `sheet_skeleton.html`.
   - Diese Skeletons müssen exakt das dokumentierte Pattern widerspiegeln.

6) Commits
   - Saubere, nachvollziehbare Commits, jeder mit klarer Erklärung (Legacy-Entfernung, Vereinheitlichung, Bugfix).

---

Regeln:
- Keine Alternativvarianten erfinden.
- Keine Styles überschreiben, die durch Tokens bezeichnet werden müssen.
- Alles muss mit Textseiten-Standard + Auth-Standard harmonieren.
- CI darf erst dann grün sein, wenn Guard + Linter ohne Verstöße durchlaufen.

Hinweise für technische Umsetzung:

1) JS Anpassung: Stelle sicher, dass die vorhandene JS-Interaktion/Front-End-Helpers das Verhalten setzt/entfernt:
   - `.md3-outlined-textfield--focused` beim Focus setzen/entfernen
   - `.md3-outlined-textfield--has-value` beim Input/Blur setzen/entfernen

2) Label background solution: Verwende `background: var(--md-sys-color-surface)` für `.md3-outlined-textfield__label` und entferne alle bisherigen hacks (inline color changes, additional wrappers). Das sorgt für korrekten Float-Label-Effekt und hält die Oberfläche tokenisiert.

3) Tests & CI: Nach Umsetzung die Guard-Skript + md3-lint erweitern und dafür Unit-/smoke-tests ergänzen; CI-Pipeline darf das Merge erst zulassen, wenn beide Tools sauber laufen.

END OF PROMPT

### ANHANG: Technische Startgerüste (Skeleton, Guard, Lint, CSS)

ANHANG: Technische Startgerüste (Skeleton, Guard, Lint, CSS)

Nutze die folgenden Startgerüste, um die Implementierung zu beschleunigen.
Du darfst die Details an die tatsächliche Codebasis anpassen (Pfadnamen, bestehende Hilfsfunktionen etc.), die Struktur soll aber erkennbar bleiben.

1) Skeleton für „große“ Formseiten

Lege `templates/_md3_skeletons/page_large_form_skeleton.html` an:

```html
<div class="md3-page md3-page--form">
   <header class="md3-page__header">
      <h1 class="md3-title-large">Seitentitel (H1)</h1>
      <p class="md3-body-medium md3-page__subtitle">
         Kurze Beschreibung des Formulars. Maximal 1–2 Zeilen.
      </p>
   </header>

   <main class="md3-page__main">
      <section class="md3-auth-card md3-auth-card--large-form">
         <header class="md3-auth-card__header">
            <h2 class="md3-headline-small">Formularabschnitt (H2)</h2>
            <p class="md3-body-medium md3-auth-card__description">
               Optionaler Abschnittstext, der erklärt, was in diesem Formularabschnitt zu tun ist.
            </p>
         </header>

         <form class="md3-form md3-form--two-column" method="post">
            <div class="md3-form__row">
               <div class="md3-form__field md3-form__field--half">
                  <div class="md3-outlined-textfield md3-outlined-textfield--block">
                     <input
                        class="md3-outlined-textfield__input"
                        type="text"
                        name="first_name"
                        required
                     >
                     <label class="md3-outlined-textfield__label">Vorname</label>
                     <span class="md3-outlined-textfield__outline">
                        <span class="md3-outlined-textfield__outline-start"></span>
                        <span class="md3-outlined-textfield__outline-notch"></span>
                        <span class="md3-outlined-textfield__outline-end"></span>
                     </span>
                  </div>
               </div>

               <div class="md3-form__field md3-form__field--half">
                  <div class="md3-outlined-textfield md3-outlined-textfield--block">
                     <input
                        class="md3-outlined-textfield__input"
                        type="text"
                        name="last_name"
                        required
                     >
                     <label class="md3-outlined-textfield__label">Nachname</label>
                     <span class="md3-outlined-textfield__outline">
                        <span class="md3-outlined-textfield__outline-start"></span>
                        <span class="md3-outlined-textfield__outline-notch"></span>
                        <span class="md3-outlined-textfield__outline-end"></span>
                     </span>
                  </div>
               </div>
            </div>

            <div class="md3-form__row">
               <div class="md3-form__field md3-form__field--full">
                  <div class="md3-outlined-textfield md3-outlined-textfield--block">
                     <input
                        class="md3-outlined-textfield__input"
                        type="email"
                        name="email"
                        required
                     >
                     <label class="md3-outlined-textfield__label">E-Mail-Adresse</label>
                     <span class="md3-outlined-textfield__outline">
                        <span class="md3-outlined-textfield__outline-start"></span>
                        <span class="md3-outlined-textfield__outline-notch"></span>
                        <span class="md3-outlined-textfield__outline-end"></span>
                     </span>
                  </div>
                  <div class="md3-field-error" aria-live="polite">
                     <!-- Optionaler Fehlertest -->
                  </div>
               </div>
            </div>

            <div class="md3-form__row md3-form__row--compact">
               <div class="md3-form__field md3-form__field--full">
                  <label class="md3-checkbox">
                     <input type="checkbox" name="terms" required>
                     <span class="md3-checkbox__icon"></span>
                     <span class="md3-checkbox__label">
                        Ich akzeptiere die Nutzungsbedingungen.
                     </span>
                  </label>
               </div>
            </div>

            <div class="md3-form__actions">
               <button type="button" class="md3-button md3-button--text">
                  Abbrechen
               </button>
               <button type="submit" class="md3-button md3-button--filled">
                  Speichern
               </button>
            </div>
         </form>
      </section>
   </main>
</div>
```

2. Guard-Skript (Startgerüst)

Erstelle `scripts/md3-forms-auth-guard.py` mit folgendem Startgerüst und passe es bei Bedarf an:

```python
#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

HTML_PATHS = [
      ROOT / "templates" / "auth",
      ROOT / "templates" / "_md3_skeletons",
]

INLINE_STYLE_RE = re.compile(r'style\s*=', re.IGNORECASE)
LEGACY_CHECKBOX_RE = re.compile(
      r'<input[^>]+type=["\']checkbox["\'][^>]*(class=["\'][^"\']*legacy-checkbox[^"\']*["\'])?',
      re.IGNORECASE
)
OUTLINED_TEXTFIELD_SIGNATURES = [
      re.compile(r'class="[^"]*md3-outlined-textfield[^"]*"', re.IGNORECASE),
      re.compile(r'class="[^"]*md3-outlined-textfield__input[^"]*"', re.IGNORECASE),
      re.compile(r'class="[^"]*md3-outlined-textfield__label[^"]*"', re.IGNORECASE),
      re.compile(r'class="[^"]*md3-outlined-textfield__outline[^"]*"', re.IGNORECASE),
]
DIALOG_SIGNATURES = [
      re.compile(r'<dialog[^>]+class="[^"]*md3-dialog[^"]*"', re.IGNORECASE),
      re.compile(r'class="[^"]*md3-dialog__surface[^"]*"', re.IGNORECASE),
      re.compile(r'class="[^"]*md3-dialog__title[^"]*"', re.IGNORECASE),
      re.compile(r'class="[^"]*md3-dialog__content[^"]*"', re.IGNORECASE),
      re.compile(r'class="[^"]*md3-dialog__actions[^"]*"', re.IGNORECASE),
]
BUTTON_FORBIDDEN_RE = re.compile(
      r'<button[^>]+class="[^"]*(btn-|btn-primary|btn-secondary)[^"]*"', re.IGNORECASE
)


def iter_html_files():
      for base in HTML_PATHS:
            if not base.exists():
                  continue
            for path in base.rglob("*.html"):
                  yield path


def main() -> int:
      errors = []

      for path in iter_html_files():
            text = path.read_text(encoding="utf-8")

            if INLINE_STYLE_RE.search(text):
                  errors.append((path, "INLINE_STYLE", "Inline style in HTML ist verboten (MD3-Komponenten)."))

            if LEGACY_CHECKBOX_RE.search(text):
                  errors.append((path, "LEGACY_CHECKBOX", "Legacy-Checkbox-Markup gefunden. Verwende <label class=\"md3-checkbox\">…"))

            if 'md3-outlined-textfield' in text:
                  for sig in OUTLINED_TEXTFIELD_SIGNATURES:
                        if not sig.search(text):
                              errors.append((path, "TEXTFIELD_INCOMPLETE", "md3-outlined-textfield ohne vollständiges Canonical-Markup."))

            if 'md3-dialog' in text:
                  for sig in DIALOG_SIGNATURES:
                        if not sig.search(text):
                              errors.append((path, "DIALOG_INCOMPLETE", "md3-dialog ohne vollständige Canonical-Struktur."))

            for m in BUTTON_FORBIDDEN_RE.finditer(text):
                  errors.append((path, "BUTTON_LEGACY_CLASS", "Legacy-Button-Klasse gefunden (btn-*). Nutze md3-button*."))

      if errors:
            print("MD3 Forms/Auth Guard: Fehler gefunden:")
            for path, code, msg in errors:
                  print(f"- [{code}] {path}: {msg}")
            return 1

      print("MD3 Forms/Auth Guard: OK")
      return 0


if __name__ == "__main__":
      sys.exit(main())
```

3. Lint-Erweiterung für Komponenten-CSS

Erweitere `scripts/md3-lint.py` um eine Prüfung für Komponenten-CSS:

```python
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

CSS_COMPONENT_DIRS = [
      ROOT / "static" / "css" / "md3" / "components",
]

HEX_COLOR_RE = re.compile(r'#[0-9a-fA-F]{3,8}')
IMPORTANT_RE = re.compile(r'!important')
LEGACY_SELECTOR_RE = re.compile(r'\.legacy-(checkbox|button|form)\b')


def iter_component_css():
      for base in CSS_COMPONENT_DIRS:
            if not base.exists():
                  continue
            for path in base.rglob("*.css"):
                  yield path


def lint_md3_components_css():
      errors = []
      for path in iter_component_css():
            text = path.read_text(encoding="utf-8")

            for m in HEX_COLOR_RE.finditer(text):
                  errors.append((path, "CSS_HEX_COLOR", f"Hex-Farbe '{m.group(0)}' gefunden. Nutze MD3-Tokens (--md-sys-*)."))

            for m in IMPORTANT_RE.finditer(text):
                  errors.append((path, "CSS_IMPORTANT", "!important gefunden. Nur in begründeten Ausnahmefällen verwenden."))

            for m in LEGACY_SELECTOR_RE.finditer(text):
                  errors.append((path, "CSS_LEGACY_SELECTOR", f"Legacy-Selector '{m.group(0)}' gefunden. Auf MD3-Pattern migrieren."))

      return errors
```

Binde `lint_md3_components_css()` in der main/run-Funktion von `md3-lint.py` ein und lass die CI bei Fehlern fehlschlagen.

4. CSS-Fragment für Outlined Textfield + Label-Surface

Lege/erweitere `static/css/md3/components/textfields.css` um folgendes Muster:

```css
.md3-outlined-textfield {
   position: relative;
   display: inline-flex;
   flex-direction: column;
   width: 100%;
   font-family: var(--md-sys-typescale-body-medium-font, system-ui);
   color: var(--md-sys-color-on-surface);
}

.md3-outlined-textfield--block {
   width: 100%;
}

.md3-outlined-textfield__input {
   border: none;
   outline: none;
   background: transparent;
   padding: 20px 16px 8px 16px;
   font: inherit;
   color: inherit;
}

.md3-outlined-textfield__outline {
   pointer-events: none;
   position: absolute;
   inset: 0;
   border-radius: 12px;
   border: 1px solid var(--md-sys-color-outline);
   box-sizing: border-box;
}

.md3-outlined-textfield__outline-start,
.md3-outlined-textfield__outline-notch,
.md3-outlined-textfield__outline-end {
   display: inline-block;
}

.md3-outlined-textfield__label {
   position: absolute;
   top: 50%;
   left: 16px;
   transform: translateY(-50%);
   transform-origin: left center;
   padding: 0 4px;
   background: var(--md-sys-color-surface);
   font-size: 0.95em;
   line-height: 1.2;
   color: var(--md-sys-color-on-surface-variant);
   transition:
      transform 150ms ease-out,
      top 150ms ease-out,
      font-size 150ms ease-out,
      color 150ms ease-out,
      background-color 150ms ease-out;
}

.md3-outlined-textfield--focused .md3-outlined-textfield__label,
.md3-outlined-textfield--has-value .md3-outlined-textfield__label {
   top: 0;
   transform: translateY(-50%) scale(0.85);
   color: var(--md-sys-color-primary);
}

.md3-outlined-textfield--focused .md3-outlined-textfield__outline {
   border-width: 2px;
   border-color: var(--md-sys-color-primary);
}

.md3-outlined-textfield--error .md3-outlined-textfield__outline {
   border-color: var(--md-sys-color-error);
}

.md3-outlined-textfield--error .md3-outlined-textfield__label {
   color: var(--md-sys-color-error);
}

.md3-field-error {
   margin-top: 4px;
   font-size: 0.8rem;
   color: var(--md-sys-color-error);
}
```

Stelle in deinem JS sicher, dass:

* beim Fokus die Klasse `.md3-outlined-textfield--focused` gesetzt/entfernt wird,
* bei vorhandenem Wert (on input/blur) `.md3-outlined-textfield--has-value` korrekt gesetzt/entfernt wird.
   So erreicht das Label den korrekten Floating-Effekt ohne weitere Hacks und orientiert sich an `--md-sys-color-surface`.
