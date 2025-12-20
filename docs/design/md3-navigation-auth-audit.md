# MD3 Audit: Top App Bar, Navigation, Auth-Menüs & Sprachkonsistenz

**Erstellt:** 25. November 2025  
**Status:** Audit abgeschlossen — Freigabe für Umsetzung ausstehend  
**Autor:** Copilot-gestützte Analyse  
**Scope:** Top App Bar, Navigation Drawer, Auth-Menüs, Account-Button, Sprachkonsistenz, Responsiveness

---

## Doku-Teil A: Audit-Dokument

### Zusammenfassung

Das Audit identifiziert **12 Hauptbefunde** in den Bereichen Top App Bar, Navigation Drawer, Auth-Menüs und Sprachkonsistenz. Die Implementierung ist grundsätzlich MD3-konform, zeigt jedoch **Inkonsistenzen bei Sprachregeln** und **strukturelle Divergenzen** zwischen Modal- und Standard-Drawer.

---

## 1. Befundliste

### Befund 1: Sprachmischung im Modal-Drawer (Footer-Bereich)
**Datei:** `templates/partials/_navigation_drawer.html`, Zeilen 152-173

| Element | Ist-Zustand | Soll (nach Sprachregel) |
|---------|-------------|-------------------------|
| Login (unauthenticated) | "Anmelden" (DE) | "Iniciar sesión" (ES) |
| Passwort-Link | "Passwort" (DE) | "Contraseña" oder "Passwort" (DE, intern) |

**MD3-Abweichung:** Keine — rein sprachliches Problem  
**UX-Auswirkung:** Verwirrung bei spanischsprachigen Gästen; inkonsistente Erwartungshaltung

**Status:** ⚠️ Fix notwendig

---

### Befund 2: Fehlender "Profil"-Link im Modal-Drawer
**Datei:** `templates/partials/_navigation_drawer.html`, Zeilen 133-162

Der Modal-Drawer (für Compact/Medium Screens) zeigt für authentifizierte Benutzer:
- ✅ Editor (Editor/Admin)
- ✅ Dashboard (Admin)
- ✅ Benutzer (Admin)
- ✅ Passwort
- ✅ Abmelden

**FEHLEND:** Profil-Link

Der Standard-Drawer (Expanded, ab 840px) enthält dagegen:
- ✅ Profil (Zeile 284-287)

**MD3-Abweichung:** Navigation-Rail/Drawer sollten konsistente Items zeigen  
**UX-Auswirkung:** Mobile Nutzer können ihr Profil nur über Avatar-Menü in der Top App Bar erreichen

**Status:** ⚠️ Fix notwendig

---

### Befund 3: Inkonsistente Auth-Labels zwischen Top App Bar und Drawer
**Dateien:** 
- `templates/partials/_top_app_bar.html`, Zeilen 88-112
- `templates/partials/_navigation_drawer.html`, Zeilen 269-303

| Location | Element | Sprache |
|----------|---------|---------|
| Top App Bar - User Menu | Perfil | ES ✅ |
| Top App Bar - User Menu | Dashboard | EN/DE neutral ✅ |
| Top App Bar - User Menu | Usuarios | ES ✅ |
| Top App Bar - User Menu | Cerrar sesión | ES ✅ |
| Drawer - Standard | Profil | DE ❌ |
| Drawer - Standard | Dashboard | EN/DE neutral ✅ |
| Drawer - Standard | Benutzer | DE ✅ |
| Drawer - Standard | Abmelden | DE ✅ |

**MD3-Abweichung:** UI-Konsistenz verletzt  
**UX-Auswirkung:** Erwartung wird gebrochen; gleiche Funktion, unterschiedliche Sprache

**Sprachregel-Konflikt:**
- Top App Bar Menü zeigt interne Funktionen auf **Spanisch** (Perfil, Usuarios, Cerrar sesión)
- Drawer zeigt interne Funktionen auf **Deutsch** (Profil, Benutzer, Abmelden)
- Gemäß Sprachregel sollte **interner Bereich = Deutsch** sein

**Status:** ⚠️ Fix notwendig (Top App Bar → Deutsch)

---

### Befund 4: Login-Seite verwendet Deutsch statt Spanisch
**Datei:** `templates/auth/login.html`

| Element | Ist-Zustand | Soll (öffentlich = ES) |
|---------|-------------|------------------------|
| Seitentitel | "Anmelden" | "Iniciar sesión" |
| Card-Titel | "Anmelden" | "Iniciar sesión" |
| Beschreibung | "Melde dich mit deinem Benutzernamen..." | ES-Text |
| Labels | "Benutzername oder E‑Mail", "Passwort" | "Usuario o correo", "Contraseña" |
| Button | "Anmelden" | "Iniciar sesión" |
| Passwort vergessen | "Passwort vergessen?" | "¿Olvidaste tu contraseña?" |
| Footer | "Bei Problemen kontaktieren Sie bitte den Admin" | ES-Text |

**MD3-Abweichung:** Keine  
**UX-Auswirkung:** Spanischsprachige Nutzer treffen auf deutschen Login

**Status:** ⚠️ Fix notwendig — Login ist öffentlicher Bereich

---

### Befund 5: Password-Forgot-Seite auf Deutsch (sollte ES sein)
**Datei:** `templates/auth/password_forgot.html`

Die Seite "Passwort vergessen" ist auf Deutsch:
- Titel: "Passwort vergessen"
- Card-Titel: "Anweisungen anfordern"
- Labels: "E-Mail / Benutzername"
- Buttons: "Abbrechen", "Senden"

**Soll:** Spanisch (öffentlicher Bereich)

**Status:** ⚠️ Fix notwendig

---

### Befund 6: Password-Reset-Seite auf Deutsch (situativ)
**Datei:** `templates/auth/password_reset.html`

Diese Seite wird über Token-Link erreicht (öffentlich zugänglich, aber für authentifizierbare Nutzer).
Aktuell auf Deutsch.

**Empfehlung:** Spanisch für Konsistenz mit Login-Flow, oder hybrid (DE für eingeloggte Nutzer)

**Status:** 🔶 Prüfung erforderlich

---

### Befund 7: Doppelte data-role Attribute in Top App Bar
**Datei:** `templates/partials/_top_app_bar.html`, Zeilen 14-16

```html
<header class="md3-top-app-bar" 
        ...
        data-role="top-app-bar"
        data-element="top-app-bar"
        data-role="top-app-bar"  <!-- DOPPELT -->
```

**MD3-Abweichung:** Kein semantisches Problem, aber Code-Hygiene  
**UX-Auswirkung:** Keine

**Status:** 🟢 Low risk — Cleanup empfohlen

---

### Befund 8: Login-Button (unauthenticated) zeigt Icon ohne Text
**Datei:** `templates/partials/_top_app_bar.html`, Zeilen 115-121

```html
<a href="{{ url_for('public.login', next=...) }}"
   class="md3-icon-button" 
   aria-label="Iniciar sesión"
   title="Iniciar sesión">
  <span class="material-symbols-rounded">account_circle</span>
</a>
```

**Analyse:**
- ✅ `aria-label` vorhanden (ES) — korrekt
- ✅ `title` vorhanden (ES) — korrekt
- ⚠️ Nur Icon, kein sichtbarer Text

**MD3-Abweichung:** Icon-only Buttons sind MD3-konform für bekannte Aktionen  
**UX-Auswirkung:** Minimal — aria-label und title sind korrekt auf Spanisch

**Status:** 🟢 Optional — Kein Fix nötig

---

### Befund 9: Account-Chip Label truncation bei langen Benutzernamen
**Datei:** `static/css/md3/components/top-app-bar.css`, Zeilen 504-510

```css
.md3-top-app-bar__account-chip-label {
  max-width: 160px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
```

**MD3-Konformität:** ✅ Ellipsis ist MD3-konform  
**UX-Auswirkung:** Bei sehr langen Namen wird gekürzt — akzeptabel

**Status:** 🟢 Bewusst so

---

### Befund 10: Mobile Account-Chip (< 640px) kollabiert zu Icon-only
**Datei:** `static/css/md3/components/top-app-bar.css`, Zeilen 516-531

```css
@media (max-width: 640px) {
  .md3-top-app-bar__account-chip-label {
    display: none;
  }
  .md3-top-app-bar__account-chip {
    width: 48px;
    height: 48px;
    border-radius: 50%;
  }
}
```

**MD3-Konformität:** ✅ Responsive collapse ist MD3-konform  
**Touch-Target:** 48x48px — ✅ MD3 Minimum erfüllt

**Status:** 🟢 Bewusst so

---

### Befund 11: User-Menu Dropdown Position (fixed top: 64px)
**Datei:** `static/css/md3/components/top-app-bar.css`, Zeilen 642-656

```css
.md3-user-menu__dropdown {
  position: fixed;
  top: 64px;
  right: 12px;
  width: 256px;
}
```

**MD3-Analyse:**
- ⚠️ Hardcoded `top: 64px` — funktioniert nur bei Standard-App-Bar-Höhe
- ⚠️ Für Medium/Large App Bar (112px/152px) würde das Menü überlappen

**UX-Auswirkung:** Gering, da nur Small App Bar verwendet wird  

**Status:** 🟢 Low risk — aber Refactor empfohlen bei Einführung anderer Bar-Größen

---

### Befund 12: Footer-Links auf Deutsch (Impressum, Datenschutz)
**Datei:** `templates/partials/footer.html`, Zeilen 20-24

```html
<nav class="md3-footer__nav md3-body-small" aria-label="Rechtliches">
  <ul class="md3-footer__list">
    <li><a href="...">Impressum</a></li>
    <li><a href="...">Datenschutz</a></li>
  </ul>
</nav>
```

**Sprachregel-Analyse:** 
- Footer ist auf allen Seiten sichtbar (öffentlich + intern)
- "Impressum" und "Datenschutz" sind **deutsche Rechtsbegriffe**
- Die verlinkten Seiten (`impressum.html`, `privacy.html`) sind auf Deutsch

**Empfehlung:** Beibehaltung auf Deutsch, da rechtliche deutsche Anforderungen

**Status:** 🟢 Bewusst so — kein Fix nötig

---

## 2. MD3-Vergleich & Analyse

### Top App Bar

| Kriterium | MD3 Gold Standard | CO.RA.PAN Status |
|-----------|-------------------|------------------|
| Height (Small) | 64px | ✅ 64px |
| Burger Icon Position | Left | ✅ Left |
| Actions Position | Right | ✅ Right |
| Elevation (scrolled) | Level 2 (box-shadow) | ✅ var(--elev-3) |
| Transparent on Expanded | Yes | ✅ Ja (≥840px) |
| Hide Burger on Expanded | Yes | ✅ display: none |
| Touch Targets | ≥48px | ✅ 48px für alle Buttons |

**Fazit:** Top App Bar ist **vollständig MD3-konform**.

---

### Navigation Drawer

| Kriterium | MD3 Gold Standard | CO.RA.PAN Status |
|-----------|-------------------|------------------|
| Width | 280-360px | ✅ 280px |
| Modal on Compact/Medium | Dialog-basiert | ✅ `<dialog>` |
| Permanent on Expanded | Rail oder Standard | ✅ Standard (sticky) |
| Logo im Header | Optional | ✅ Vorhanden |
| Collapsible Sections | Accordion | ✅ Grid-basiert |
| Active State | Primary color | ✅ color-mix(primary 10%) |
| Touch Targets | ≥48px | ✅ min-height: 48px |
| Backdrop (Modal) | Scrim 40% | ✅ rgb(0 0 0 / 40%) |

**Fazit:** Navigation Drawer ist **vollständig MD3-konform**.

---

### Account-Button / User-Menu

| Kriterium | MD3 Gold Standard | CO.RA.PAN Status |
|-----------|-------------------|------------------|
| Chip-Style (Assist Chip) | Icon + Label | ✅ Vorhanden |
| Role-Indication | Tonal oder Icon | ✅ Icon + Tonal Background |
| Dropdown Positioning | Attached to trigger | ⚠️ Fixed position |
| Menu Items | List mit Icons | ✅ Vorhanden |
| Dividers | Semantic separation | ✅ Vorhanden |
| Focus Management | Trap + Escape | ⚠️ Nicht explizit geprüft |

**Teilweise konform** — Dropdown-Positioning könnte verbessert werden.

---

### Auth-Seiten

| Seite | MD3-Konformität | Sprachregel |
|-------|-----------------|-------------|
| login.html | ✅ MD3 Card + Form | ❌ DE statt ES |
| password_forgot.html | ✅ MD3 Card + Form | ❌ DE statt ES |
| password_reset.html | ✅ MD3 Card + Form | ⚠️ Prüfen |
| account_profile.html | ✅ MD3 Hero + Cards | ✅ DE (intern) |
| account_password.html | ✅ MD3 Hero + Cards | ✅ DE (intern) |
| admin_users.html | ✅ MD3 Hero + Table | ✅ DE (intern) |

---

## 3. Responsiveness-Prüfung

### Breakpoints (MD3-Mapping)

| MD3 Name | Breakpoint | CO.RA.PAN |
|----------|------------|-----------|
| Compact | 0-599px | ✅ `@media (max-width: 599px)` |
| Medium | 600-839px | ✅ `@media (min-width: 600px) and (max-width: 839px)` |
| Expanded | ≥840px | ✅ `@media (min-width: 840px)` |

### App Bar Collapsing

- **Compact/Medium:** Opak mit Elevation, Burger sichtbar ✅
- **Expanded:** Transparent, Burger hidden ✅
- **Scroll Behavior:** Elevation erhöht sich ✅

### Drawer-Verhalten

- **Compact/Medium:** Modal Dialog ✅
- **Expanded:** Standard Drawer (sticky) ✅
- **Animation:** Smooth slide-in mit @starting-style ✅
- **Reduced Motion:** Transitions disabled ✅

### Touch Targets

| Element | Größe | MD3-Minimum | Status |
|---------|-------|-------------|--------|
| Burger Button | 48x48 | 48px | ✅ |
| Theme Toggle | 48x48 | 48px | ✅ |
| Account Chip | 48px height | 48px | ✅ |
| Login Icon-Button | 48x48 | 48px | ✅ |
| Drawer Items | 48px min-height | 48px | ✅ |
| Menu Items | 48px min-height | 48px | ✅ |

### Icon Cutting / Text Wrapping

- **Account-Chip:** Label wird auf ≤640px hidden ✅
- **Drawer Labels:** Ellipsis mit text-overflow ✅
- **Page Title:** max-width mit Ellipsis ✅

---

## Doku-Teil B: Zukünftige Standards

### MD3-Spezifikation für CO.RA.PAN

#### 1. Top App Bar

```html
<!-- Canonical Structure -->
<header class="md3-top-app-bar" 
        role="banner"
        data-element="top-app-bar"
        data-size="small"
        data-auth="true|false">
  <div class="md3-top-app-bar__row">
    <!-- Left: Navigation (Burger) -->
    <button class="md3-icon-button md3-top-app-bar__navigation-icon"
            aria-controls="navigation-drawer-modal"
            aria-expanded="false"
            data-action="open-drawer">
      <span class="material-symbols-rounded">menu</span>
    </button>

    <!-- Center: Title -->
    <div class="md3-top-app-bar__title">
      <span data-site-title>CO.RA.PAN</span>
      <span data-page-title-el></span>
    </div>

    <!-- Right: Actions -->
    <div class="md3-top-app-bar__actions">
      <!-- Theme Toggle -->
      <button class="md3-icon-button md3-theme-toggle">...</button>
      
      <!-- Account Chip (authenticated) oder Login Icon (unauthenticated) -->
    </div>
  </div>
</header>
```

**CSS-Hooks:**
- `.md3-top-app-bar` — Container
- `.md3-top-app-bar__row` — Flex-Row
- `.md3-top-app-bar__navigation-icon` — Burger
- `.md3-top-app-bar__title` — Title area
- `.md3-top-app-bar__actions` — Right actions
- `.md3-icon-button` — Icon buttons (48x48)
- `.md3-top-app-bar__account-chip` — Account chip
- `.md3-top-app-bar__account-chip--{role}` — Role-spezifische Farben

---

#### 2. Navigation Drawer

```html
<!-- Modal Drawer (Compact/Medium) -->
<dialog id="navigation-drawer-modal" class="drawer">
  <div class="drawer__panel">
    <div class="md3-navigation-drawer__header">
      <a class="md3-navigation-drawer__logo-link">
        <img class="md3-navigation-drawer__logo" />
      </a>
    </div>
    <nav class="md3-navigation-drawer__content">
      <!-- Items -->
    </nav>
    <nav class="md3-navigation-drawer__footer">
      <!-- Auth Items -->
    </nav>
  </div>
</dialog>

<!-- Standard Drawer (Expanded) -->
<aside class="md3-navigation-drawer md3-navigation-drawer--standard">
  <!-- Same structure -->
</aside>
```

**CSS-Hooks:**
- `.drawer` — Dialog container
- `.drawer__panel` — Slide panel
- `.md3-navigation-drawer__item` — Nav item (48px min-height)
- `.md3-navigation-drawer__item--active` — Active state
- `.md3-navigation-drawer__item--logout` — Logout (error color)
- `.md3-navigation-drawer__collapsible` — Accordion parent
- `.md3-navigation-drawer__submenu` — Accordion content

---

#### 3. Avatar-Menü / User-Menu

```html
<div class="md3-user-menu" data-user-menu-root>
  <button class="md3-top-app-bar__account-chip"
          aria-haspopup="menu"
          aria-expanded="false"
          aria-controls="user-menu-dropdown">
    <span class="material-symbols-rounded md3-top-app-bar__account-chip-icon">
      {role-icon}
    </span>
    <span class="md3-top-app-bar__account-chip-label">{username}</span>
  </button>

  <div class="md3-user-menu__dropdown" 
       id="user-menu-dropdown"
       role="menu"
       hidden>
    <a class="md3-user-menu__item" role="menuitem">
      <span class="material-symbols-rounded md3-user-menu__icon">{icon}</span>
      <span class="md3-user-menu__label">{label}</span>
    </a>
    <div class="md3-user-menu__divider" role="separator"></div>
    <!-- More items -->
  </div>
</div>
```

---

#### 4. Auth-Menü-Struktur (Sprachregeln)

| Kontext | Sprache | Menüpunkt | Label |
|---------|---------|-----------|-------|
| Öffentlich (Gast) | ES | Login | Iniciar sesión |
| Öffentlich (Gast) | ES | Passwort vergessen | ¿Olvidaste tu contraseña? |
| Intern (eingeloggt) | DE | Profil | Profil |
| Intern (eingeloggt) | DE | Passwort ändern | Passwort ändern |
| Intern (Admin) | DE | Benutzerverwaltung | Benutzer |
| Intern (Admin) | DE | Dashboard | Dashboard |
| Intern (eingeloggt) | DE | Abmelden | Abmelden |

---

#### 5. Sprachregeln-Referenz

```
┌─────────────────────────────────────────────────────────────┐
│ ÖFFENTLICHER BEREICH (unauthenticated)                      │
│ → Sprache: SPANISCH                                         │
│                                                             │
│ - Landing Page                                              │
│ - Proyecto-Seiten                                           │
│ - Corpus (Suche)                                            │
│ - Atlas                                                     │
│ - Login-Seite                                               │
│ - Passwort vergessen                                        │
│ - Passwort zurücksetzen (Token-Link)                        │
├─────────────────────────────────────────────────────────────┤
│ INTERNER BEREICH (authenticated)                            │
│ → Sprache: DEUTSCH                                          │
│                                                             │
│ - Profil                                                    │
│ - Passwort ändern                                           │
│ - Benutzerverwaltung (Admin)                                │
│ - Dashboard (Admin)                                         │
│ - Editor (Editor/Admin)                                     │
│ - Drawer Footer (Auth-Items)                                │
│ - User-Menu Dropdown                                        │
├─────────────────────────────────────────────────────────────┤
│ AUSNAHMEN (bewusst deutsch)                                 │
│                                                             │
│ - Footer: Impressum, Datenschutz (deutsche Rechtsbegriffe)  │
│ - Privacy-Seite (deutsches Recht)                           │
└─────────────────────────────────────────────────────────────┘
```

---

#### 6. Responsiveness-Referenz

```css
/* MD3 Breakpoints */
--breakpoint-compact: 599px;    /* 0-599px: Mobile */
--breakpoint-medium: 839px;     /* 600-839px: Tablet */
--breakpoint-expanded: 840px;   /* ≥840px: Desktop */

/* App Bar */
@media (min-width: 840px) {
  .md3-top-app-bar { background: transparent; }
  .md3-top-app-bar__navigation-icon { display: none; }
}

/* Drawer */
@media (min-width: 840px) {
  .drawer { display: none; }  /* Modal hidden */
  .md3-navigation-drawer--standard { display: flex; }
}

/* Account Chip */
@media (max-width: 640px) {
  .md3-top-app-bar__account-chip-label { display: none; }
}
```

---

### Dos / Don'ts

#### ✅ Dos

1. **Touch Targets:** Mindestens 48x48px für alle interaktiven Elemente
2. **ARIA:** `aria-label`, `aria-expanded`, `aria-controls` für alle Menüs
3. **Semantic HTML:** `<dialog>` für Modals, `<nav>` für Navigation
4. **Focus States:** `:focus-visible` mit Primary-Outline
5. **Reduced Motion:** `@media (prefers-reduced-motion: reduce)` respektieren
6. **Sprachkonsistenz:** Öffentlich = ES, Intern = DE

#### ❌ Don'ts

1. **Keine hardcoded Pixel-Werte:** Token verwenden (`var(--space-*)`)
2. **Keine duplicate IDs:** Unique IDs für ARIA-Referenzen
3. **Keine Shadow-only Elevation:** Tonal surfaces bevorzugen
4. **Keine Sprachmischung:** Nicht DE und ES in derselben View mischen
5. **Keine Touch Targets < 48px:** Besonders auf Mobile kritisch

---

## Doku-Teil C: Impact & Follow-up

### Betroffene Dateien

| Datei | Befunde | Priorität |
|-------|---------|-----------|
| `templates/partials/_navigation_drawer.html` | #1, #2 | 🔴 Hoch |
| `templates/partials/_top_app_bar.html` | #3, #7 | 🟠 Mittel |
| `templates/auth/login.html` | #4 | 🔴 Hoch |
| `templates/auth/password_forgot.html` | #5 | 🔴 Hoch |
| `templates/auth/password_reset.html` | #6 | 🟠 Mittel |

### Komponenten zur Vereinheitlichung

1. **Auth-Labels im User-Menu:**
   - `_top_app_bar.html` → auf Deutsch ändern
   - Labels: Profil, Dashboard, Benutzer, Abmelden

2. **Modal-Drawer Footer:**
   - Profil-Link hinzufügen
   - Login-Label auf Spanisch ändern

3. **Login-Flow Seiten:**
   - `login.html` → Spanisch
   - `password_forgot.html` → Spanisch
   - `password_reset.html` → Spanisch oder hybrid

### Priorisierte Aufgabenliste

| # | Aufgabe | Risiko | Aufwand |
|---|---------|--------|---------|
| 1 | Login-Seite auf Spanisch umstellen | Low | ~30 Min |
| 2 | Password-Forgot auf Spanisch umstellen | Low | ~20 Min |
| 3 | User-Menu Labels auf Deutsch ändern | Low | ~10 Min |
| 4 | Modal-Drawer: Profil-Link hinzufügen | Low | ~10 Min |
| 5 | Modal-Drawer: Login-Label auf Spanisch | Low | ~5 Min |
| 6 | Doppeltes data-role entfernen | Very Low | ~2 Min |
| 7 | Password-Reset Sprachstrategie festlegen | Requires Decision | — |

### Nächste Schritte

1. **Review durch Stakeholder:** Sprachregeln bestätigen
2. **Freigabe:** Welche Fixes sollen umgesetzt werden?
3. **Implementierung:** Nach Priorität abarbeiten
4. **Testing:** E2E-Tests für Auth-Flow aktualisieren
5. **Dokumentation:** `CHANGELOG.md` aktualisieren

---

## Anhang: Sprachvergleich (Aktuell vs. Soll)

### Login-Seite

| Element | Aktuell (DE) | Soll (ES) |
|---------|--------------|-----------|
| Seitentitel | "Anmelden - CO.RA.PAN" | "Iniciar sesión - CO.RA.PAN" |
| Card-Titel | "Anmelden" | "Iniciar sesión" |
| Intro | "Melde dich mit deinem Benutzernamen oder deiner E‑Mail an." | "Inicia sesión con tu nombre de usuario o correo electrónico." |
| Username Label | "Benutzername oder E‑Mail" | "Usuario o correo electrónico" |
| Password Label | "Passwort" | "Contraseña" |
| Submit Button | "Anmelden" | "Iniciar sesión" |
| Passwort vergessen | "Passwort vergessen?" | "¿Olvidaste tu contraseña?" |
| Footer | "Bei Problemen kontaktieren Sie bitte den Admin." | "Si tienes problemas, contacta al administrador." |
| Error Alert | "Fehler" | "Error" |

### Password-Forgot-Seite

| Element | Aktuell (DE) | Soll (ES) |
|---------|--------------|-----------|
| Seitentitel | "Passwort vergessen — CO.RA.PAN" | "Recuperar contraseña — CO.RA.PAN" |
| Hero-Titel | "Passwort vergessen" | "Recuperar contraseña" |
| Card-Titel | "Anweisungen anfordern" | "Solicitar instrucciones" |
| Intro | "Gib deinen Benutzernamen oder deine E-Mail-Adresse an, wir senden dir Anweisungen." | "Ingresa tu nombre de usuario o correo electrónico y te enviaremos instrucciones." |
| Label | "E-Mail / Benutzername" | "Correo / Usuario" |
| Cancel | "Abbrechen" | "Cancelar" |
| Submit | "Senden" | "Enviar" |

---

**Ende des Audit-Dokuments**
