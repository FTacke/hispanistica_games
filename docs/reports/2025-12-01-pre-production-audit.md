# Pre-Production Audit: Dead Code & Legacy Scan

**Datum:** 2025-12-01  
**Branch:** `audit/pre-production-cleanup`  
**Auditor:** Automated Scan + Manual Review

---

## Executive Summary

Dieser Audit identifiziert ungenutzte Dateien, Legacy-Code und potentielle Cleanup-Kandidaten vor der Production-Deployment.

### Kritische Funde
- 🔴 **3 definitiv ungenutzte JS-Dateien** im Root von `static/js/`
- 🟡 **1 nicht gerendertes Template** (`proyecto_referencias.html`)  
- 🟡 **2 doppelte Vendor-Dateien** (htmx-Versionen)
- 🟢 **Templates und CSS sind überwiegend in Gebrauch**

---

## 1. Unbenutzte Python-Views/Endpoints

### ✅ Alle registrierten Routes sind in Verwendung

Nach Analyse der Dateien in `src/app/routes/`:

| Route-Datei | Status | Anmerkungen |
|-------------|--------|-------------|
| `public.py` | ✅ Aktiv | Hauptseiten (index, proyecto/*, atlas, impressum, privacy) |
| `auth.py` | ✅ Aktiv | Auth-Flows, Account-Pages |
| `corpus.py` | ⚠️ Legacy | Redirects zu advanced search (Backwards-Compat) |
| `player.py` | ✅ Aktiv | Player-Page |
| `editor.py` | ✅ Aktiv | Editor-Pages + API |
| `admin.py` | ✅ Aktiv | Admin Dashboard |
| `admin_users.py` | ✅ Aktiv | User Management API |
| `atlas.py` | ✅ Aktiv | Atlas API v1 + Legacy redirects |
| `bls_proxy.py` | ✅ Aktiv | BlackLab Server Proxy |
| `media.py` | ✅ Aktiv | Audio/Transcript serving |
| `stats.py` | ✅ Aktiv | Statistics API |

### ⚠️ Potentielle Cleanup-Kandidaten

**`src/app/routes/corpus.py`** - Enthält nur Redirect-Endpoints:
```python
# Alle Endpoints redirecten zu advanced_search
# Kommentar: "Legacy routes that redirect to the new BlackLab-based advanced search"
```
**Empfehlung:** Behalten für Backwards-Compatibility, aber in Monitoring/Logs prüfen ob noch Traffic kommt.

---

## 2. Unbenutzte Templates

### Alle Template-Verzeichnisse analysiert:

| Verzeichnis | Dateien | Status |
|-------------|---------|--------|
| `templates/auth/` | 7 | ✅ Alle referenziert |
| `templates/errors/` | 5 | ✅ Alle via Error-Handler |
| `templates/pages/` | 15 | ⚠️ 1 nicht referenziert |
| `templates/partials/` | 6 | ✅ Alle via include |
| `templates/search/` | 3 | ✅ Alle referenziert |
| `templates/_md3_skeletons/` | 9 | 📘 Nur Referenz-Templates |

### 🔴 DEFINITIV UNGENUTZT

**`templates/pages/proyecto_referencias.html`**
- Kein `render_template("pages/proyecto_referencias.html")` gefunden
- Kein Link/Navigation zu dieser Seite
- War wahrscheinlich für `/proyecto/referencias` geplant
- **Empfehlung:** Entfernen oder Route hinzufügen

### 📘 Skeleton-Templates (Behalten)

Die Dateien in `templates/_md3_skeletons/` sind **Referenz-Templates** für Entwickler:
- `auth_dialog_skeleton.html`
- `auth_login_skeleton.html`
- `auth_profile_skeleton.html`
- `dialog_skeleton.html`
- `page_admin_skeleton.html`
- `page_form_skeleton.html`
- `page_large_form_skeleton.html`
- `page_text_skeleton.html`
- `sheet_skeleton.html`

**Empfehlung:** Behalten als Entwickler-Dokumentation.

### ⚠️ Partial mit reduzierter Nutzung

**`templates/partials/status_banner.html`**
- Enthält nur minimale "nicht angemeldet" Meldung
- War ursprünglich Login-Sheet, jetzt Stub
- Wird in `base.html` erwähnt aber nicht inkludiert
- **Empfehlung:** Prüfen ob benötigt, ggf. entfernen

---

## 3. Unbenutzte JS/CSS-Dateien

### 3.1 JavaScript-Analyse

#### 🔴 DEFINITIV UNGENUTZT (Hohe Sicherheit)

| Datei | Reason | Empfehlung |
|-------|--------|------------|
| `static/js/player_script.js` | Nicht in Templates eingebunden, 1173 Zeilen Legacy-Code | **Entfernen** |
| `static/js/nav_proyecto.js` | Nicht in Templates eingebunden, 399 Zeilen | **Entfernen** |
| `static/js/player-token-marker.js` | Nicht in Templates eingebunden, 77 Zeilen | **Entfernen** |

Diese Dateien wurden durch das neue Modul-System ersetzt:
- Player-Logik: `static/js/modules/player/entry.js`
- Navigation: `static/js/modules/navigation/index.js`
- Token-Marker: In `static/js/player/modules/transcription.js` integriert

#### 🟡 MÖGLICHERWEISE UNGENUTZT (Prüfen)

| Datei | Nutzung | Empfehlung |
|-------|---------|------------|
| `static/js/modules/auth/refresh.js` | Nur von `token-refresh.js` importiert (die Hauptimplementierung) | Prüfen ob beide nötig |
| `static/js/modules/navigation/test-adaptive-title.js` | Test-Datei | Prüfen ob in CI genutzt |

#### ✅ In Verwendung

Alle anderen JS-Dateien in `static/js/` sind korrekt referenziert über:
- Template `<script>` Tags
- ES6 `import` Statements
- Entry Points (`entry.js` Dateien)

### 3.2 CSS-Analyse

#### 🟡 MÖGLICHERWEISE UNGENUTZT

| Datei | Status | Anmerkung |
|-------|--------|-----------|
| `static/css/branding.css` | Nicht in Templates | Dokumentation sagt "create for new projects" |
| `static/css/md3/components/corpus-search-form.css` | Nur via ID-Selector `#corpus-search-form` | Prüfen ob ID noch existiert |
| `static/css/md3/components/select2-tagify.css` | **DEPRECATED** laut Header | Enthält aber noch aktive Select2-Styles |
| `static/css/md3/components/motion.css` | Keine explizite Referenz | Vermutlich via andere CSS importiert |
| `static/css/md3/components/progress.css` | Keine explizite Referenz | Vermutlich via andere CSS importiert |
| `static/css/md3/components/toolbar.css` | Keine explizite Referenz | Prüfen |

#### ✅ Alle basis CSS-Dateien sind via `base.html` geladen

```html
<!-- In base.html referenziert -->
layout.css
app-tokens.css
md3/tokens.css
md3/tokens-legacy-shim.css
md3/typography.css
md3/layout.css
md3/components/*.css (viele)
player-mobile.css
```

### 3.3 Doppelte Vendor-Dateien

| Datei | Problem | Empfehlung |
|-------|---------|------------|
| `static/vendor/htmx.min.js` | In `base.html` geladen | Behalten |
| `static/vendor/htmx-1.9.10.min.js` | In `search/advanced.html` geladen | **Vereinheitlichen** |

**Empfehlung:** Nur eine Version behalten (`htmx.min.js`), in `advanced.html` anpassen.

---

## 4. Legacy-Marker und TODOs

### 🔴 Kritische TODOs (vor Production lösen)

| Datei | Zeile | TODO | Priorität |
|-------|-------|------|-----------|
| `src/app/__init__.py` | 213 | `TODO: Remove 'unsafe-inline' after jQuery migration` | 🔴 High - Security |
| `src/app/extensions/__init__.py` | 21 | `TODO: For production, use Redis` für Cache | 🟡 Medium |
| `src/app/services/blacklab_search.py` | 59 | `TODO: Implement 'contains' semantics` | 🟢 Low |

### 🟡 Legacy-Kommentare (Dokumentiert, OK)

| Pattern | Anzahl | Kontext |
|---------|--------|---------|
| `legacy` | ~100 | Meist Dokumentation von Backwards-Compat |
| `deprecated` | ~15 | Vendor-Libs (select2) + alte Features |
| Spanische "Todos" | viele | Nicht-TODO, spanischer Text ("Todos los países") |

### ✅ Code-Hygiene

Die meisten Legacy-Kommentare sind:
1. Dokumentation für Entwickler
2. Vendor-Bibliotheken (nicht ändern)
3. Bewusste Backwards-Compatibility

---

## 5. Doppelte/Redundante Dateien

### ✅ Keine kritischen Duplikate gefunden

Die Suche nach `*old*`, `*backup*`, `*copy*` fand nur:
- `scripts/backup.sh` - Legitimate Backup-Script
- `scripts/anonymize_old_users.py` - Legitimate Script
- Dokumentation (`docs/archived/`)

### 🟡 Potentielle Redundanz

| Dateien | Beschreibung | Empfehlung |
|---------|--------------|------------|
| `refresh.js` vs `token-refresh.js` | Beide in `modules/auth/` | Prüfen ob Merge möglich |
| `htmx.min.js` vs `htmx-1.9.10.min.js` | Zwei HTMX-Versionen | Vereinheitlichen |

---

## 6. Zusammenfassung & Aktionen

### 🔴 Sofort entfernen (sicher)

```
static/js/player_script.js      # 1173 Zeilen, ersetzt durch modules
static/js/nav_proyecto.js       # 399 Zeilen, ersetzt durch modules
static/js/player-token-marker.js # 77 Zeilen, ersetzt durch modules
```

### 🟡 Prüfen und ggf. entfernen

```
templates/pages/proyecto_referencias.html  # Kein Route existiert
templates/partials/status_banner.html      # Minimaler Inhalt
static/vendor/htmx-1.9.10.min.js           # Duplikat von htmx.min.js
static/js/modules/auth/refresh.js          # Möglicherweise redundant
```

### 🔴 Vor Production klären

1. **CSP 'unsafe-inline'**: jQuery-Migration abschließen
2. **Cache-Backend**: Redis für Production konfigurieren

### 📘 Behalten (Dokumentation/Referenz)

```
templates/_md3_skeletons/*      # Entwickler-Referenz
static/css/branding.css         # Template für Branding
docs/archived/*                 # Historische Dokumentation
```

---

## Appendix: Analysierte Dateien

### Templates (vollständige Liste)

```
templates/
├── base.html ✅
├── auth/
│   ├── account_delete.html ✅
│   ├── account_password.html ✅
│   ├── account_profile.html ✅
│   ├── admin_users.html ✅
│   ├── login.html ✅
│   ├── password_forgot.html ✅
│   └── password_reset.html ✅
├── errors/
│   ├── 400.html ✅
│   ├── 401.html ✅
│   ├── 403.html ✅
│   ├── 404.html ✅
│   └── 500.html ✅
├── pages/
│   ├── admin_dashboard.html ✅
│   ├── atlas.html ✅
│   ├── corpus_guia.html ✅
│   ├── editor.html ✅
│   ├── editor_overview.html ✅
│   ├── impressum.html ✅
│   ├── index.html ✅
│   ├── player.html ✅
│   ├── privacy.html ✅
│   ├── proyecto_como_citar.html ✅
│   ├── proyecto_diseno.html ✅
│   ├── proyecto_estadisticas.html ✅
│   ├── proyecto_overview.html ✅
│   ├── proyecto_quienes_somos.html ✅
│   └── proyecto_referencias.html 🔴 UNUSED
├── partials/
│   ├── audio-player.html ✅
│   ├── footer.html ✅
│   ├── page_navigation.html ✅
│   ├── status_banner.html 🟡 (minimal)
│   ├── _navigation_drawer.html ✅
│   └── _top_app_bar.html ✅
├── search/
│   ├── advanced.html ✅
│   ├── partials/filters_block.html ✅
│   └── _results.html ✅
└── _md3_skeletons/ 📘 (reference only)
```

### JavaScript Module-Struktur

```
static/js/
├── 🔴 player_script.js (UNUSED)
├── 🔴 nav_proyecto.js (UNUSED)
├── 🔴 player-token-marker.js (UNUSED)
├── ✅ main.js (entry point)
├── ✅ theme.js
├── ✅ auth-setup.js
├── ✅ logout.js
├── ✅ theme-toggle.js
├── ✅ navigation-drawer-init.js
├── ✅ drawer-logo.js
├── ✅ morph_formatter.js
└── modules/
    ├── core/ ✅
    ├── auth/ ✅
    ├── navigation/ ✅
    ├── search/ ✅
    ├── player/ ✅
    ├── editor/ ✅
    ├── admin/ ✅
    ├── stats/ ✅
    └── atlas/ ✅
```
