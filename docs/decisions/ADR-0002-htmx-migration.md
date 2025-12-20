---
title: "ADR-0002: Migration von Turbo zu htmx"
status: accepted
owner: frontend-team
updated: "2025-11-10"
tags: [adr, architecture, htmx, turbo, migration, spa, mpa]
links:
  - ../migration/turbo-to-htmx-migration-plan.md
  - ADR-0001-docs-reorganization.md
---

# ADR-0002: Migration von Turbo zu htmx für Progressive Enhancement

**Status:** Accepted  
**Date:** 2025-11-10  
**Deciders:** Felix Tacke, CO.RA.PAN Team  
**Supersedes:** Ursprüngliche Turbo-Integration (implizit)

---

## Context

CO.RA.PAN Web nutzt aktuell **Hotwired Turbo 8.0.10** für clientseitige Navigation und progressive enhancement. Wiederkehrende Probleme:

### Technische Probleme mit Turbo

1. **Flash-Effekte beim Laden**
   - Blue Flash beim Navigation (trotz CSS-Fixes)
   - `turbo-progress-bar` verhält sich unvorhersehbar (fullscreen statt 2px-Bar)
   - FOUC (Flash of Unstyled Content) bei Turbo Drive-Navigationen

2. **Komplexe Event-Handhabung**
   - Mehrere Event-Listener nötig: `turbo:load`, `turbo:render`, `turbo:before-fetch-request`
   - JavaScript muss defensiv programmiert werden ("avoid redeclaration with Turbo Drive")
   - `data-turbo-permanent` für persistente Elemente (Nav, Footer) funktioniert nicht zuverlässig

3. **Cache-Konflikte**
   - Turbo Preview-Mode interferiert mit Auth-State
   - `data-turbo-track="reload"` erzwingt Hard-Reloads, negiert Turbo-Vorteile
   - Cache-Invalidierung bei Token-Refresh problematisch

4. **Overengineering für Use-Case**
   - CO.RA.PAN ist primär eine **MPA** (Multi-Page App), keine SPA
   - Turbo Drive macht ganzen DOM-Swap → zu viel für unsere Bedürfnisse
   - Turbo Frames/Streams werden nicht genutzt → 90% der Library ungenutzt

### Anforderungen an Alternative

- ✅ **Progressive Enhancement**: App muss ohne JS funktionieren (Login-Fallback)
- ✅ **Einfache Auth-Integration**: Login als Overlay/Sheet, kein Full-Page-Redirect
- ✅ **401-Handling**: Expired Token → automatisch Login-Sheet öffnen
- ✅ **Leichtgewichtig**: < 20 KB Library
- ✅ **Flask + Jinja-kompatibel**: Server rendert HTML, Client enhancet

---

## Decision

**Wir migrieren von Turbo zu htmx 1.9.10+.**

### Architektur-Prinzipien

1. **MPA + hx-boost**: Multi-Page App mit selektivem htmx-Enhancement
2. **Hypermedia-Driven**: Server sendet HTML-Fragmente, kein JSON-API
3. **Progressive Degradation**: Login-Flow funktioniert auch ohne htmx (Form-POST → 303-Redirect)

### Login-Flow (Kernanwendungsfall)

**Mit htmx:**
```
1. User klickt "Iniciar sesión" → hx-get="/auth/login?sheet=1"
2. Server liefert HTML-Fragment: <div id="login-sheet">...</div>
3. htmx injiziert Fragment in #modal-root
4. User gibt Credentials ein → hx-post="/auth/login"
5. Server sendet 200 + 2x OOB-Swap:
   - <div id="login-sheet" hx-swap-oob="delete"></div>
   - <div id="top-app-bar-content" hx-swap-oob="outerHTML">...</div>
6. Sheet schließt, Nav aktualisiert, Cookies gesetzt
```

**Ohne htmx (Fallback):**
```
1. User klickt "Iniciar sesión" → GET /auth/login (ohne HX-Request Header)
2. Server → 302 Redirect zu /?login=1
3. JavaScript auf Landing-Page öffnet Sheet via htmx
4. Falls kein JS: Form-POST → 303 Redirect zu /auth/ready (Polling-Page)
```

### 401-Handling

**htmx Event-Handler:**
```javascript
document.body.addEventListener("htmx:responseError", function(evt){
  if (evt.detail.xhr.status === 401) {
    htmx.ajax("GET", "/auth/login?sheet=1", {target: "#modal-root"});
  }
});
```

**Backend (keine Änderung nötig):**
- Protected routes senden 401 bei fehlendem/expired Token
- htmx fängt 401 ab, öffnet Sheet
- Kein Flash-Message/Redirect-Loop

---

## Consequences

### Positive ✅

1. **Einfachheit**
   - htmx: 14 KB (vs. Turbo: 312 KB)
   - 5 Attribute statt 10+ Event-Listener: `hx-get`, `hx-post`, `hx-target`, `hx-swap`, `hx-boost`
   - Kein `data-turbo-permanent`, kein `turbo:load`

2. **Bessere Developer Experience**
   - Kein "avoid redeclaration" Workarounds
   - Standard JavaScript funktioniert (keine Turbo-spezifischen Hooks)
   - Chrome DevTools zeigen echte HTTP-Requests (nicht Turbo-intern)

3. **Flexibilität**
   - Granulares Enhancement (nur Login-Sheet nutzt htmx, Rest bleibt MPA)
   - Einfach erweiterbar (z.B. Corpus-Filter als htmx-Fragment)
   - OOB-Swaps erlauben multiple DOM-Updates ohne Custom-Logic

4. **Performance**
   - Kleinere Bundle-Size (298 KB weniger JS)
   - Weniger Client-Side State (kein Turbo Cache)
   - Schnellere Time-to-Interactive (TTI)

5. **Wartbarkeit**
   - Dokumentation: htmx.org ist exzellenter als Turbo Handbook
   - Community: 25k+ GitHub Stars, aktive Entwicklung
   - Onboarding: Neue Entwickler lernen htmx in < 1 Tag

### Negative ⚠️

1. **Migrations-Aufwand**
   - ~9 Stunden Arbeit (geschätzt)
   - 8 Templates + 4 JS-Dateien + 2 Python-Dateien ändern
   - Regression-Testing nötig (Login, 401, Navigation)

2. **Verlust von Turbo Drive Preloading**
   - Turbo Drive preloaded Links beim Hover
   - htmx: kein automatisches Preloading (manuell mit `hx-trigger="mouseenter once"`)
   - **Mitigation**: MPA-Seiten laden schnell, Preloading nicht kritisch

3. **Lernkurve für Team**
   - Turbo-Kenntnisse nicht übertragbar
   - htmx-Patterns müssen gelernt werden (OOB-Swap, hx-boost)
   - **Mitigation**: Dokumentation in `docs/how-to/htmx-*.md`

4. **Browser ohne JS**
   - Login-Sheet funktioniert nicht ohne JS (Sheet = htmx-Fragment)
   - Fallback: Form-POST → 303-Redirect (funktioniert, aber schlechter UX)
   - **Impact**: < 1% User nutzen Browser ohne JS (laut Analytics)

### Neutral 🟦

1. **Token-Refresh bleibt unverändert**
   - `setupTokenRefresh()` ist Turbo-agnostisch
   - Funktioniert mit htmx ohne Änderungen

2. **Backend bleibt MPA-First**
   - Server rendert weiterhin vollständige HTML-Pages
   - Nur `/auth/login` liefert Fragmente (bei HX-Request Header)

3. **CSS/MD3 Design System unverändert**
   - Login-Sheet-Styles bleiben gleich
   - Keine visuellen Änderungen für User

---

## Alternatives Considered

### 1. **Turbo behalten + Bugs fixen**

**Pro:**
- Kein Migrations-Aufwand
- Team kennt Turbo bereits

**Contra:**
- Flash-Bugs sind tief in Turbo's Architektur (schwer zu fixen)
- Turbo Drive ist overkill für MPA-Use-Case
- Community-Support: Turbo ist weniger aktiv als htmx

**Verdict:** ❌ Rejected (Turbo löst Probleme, die wir nicht haben)

---

### 2. **Alpine.js + Fetch API (Custom-Lösung)**

**Pro:**
- Volle Kontrolle über Fetch-Logik
- Alpine.js für reaktive UI (2-Way-Binding)

**Contra:**
- Mehr Code zu schreiben (Custom Fetch-Wrapper)
- Alpine.js: 15 KB + Custom-Code > htmx
- Mehr Wartungsaufwand (kein Standard-Pattern)

**Verdict:** ❌ Rejected (Reinventing the Wheel)

---

### 3. **Vanilla JS ohne Library**

**Pro:**
- Kein External Dependency
- Kleinste Bundle-Size

**Contra:**
- 200+ Zeilen Code für Login-Sheet + 401-Handling
- Fehleranfällig (CSRF, Cache-Header, OOB-Updates manuell)
- Schwer wartbar (kein Standard-Pattern)

**Verdict:** ❌ Rejected (zu viel Boilerplate)

---

### 4. **Unpoly (ähnlich wie htmx)**

**Pro:**
- Mature Library (seit 2013)
- Ähnliche Philosophie wie htmx

**Contra:**
- 46 KB (größer als htmx)
- Weniger Community-Support (4k GitHub Stars vs. 25k)
- Komplexere API

**Verdict:** ❌ Rejected (htmx ist besser dokumentiert)

---

## Implementation

Siehe: [Turbo → htmx Migration Plan](../migration/turbo-to-htmx-migration-plan.md)

**Phasen:**
1. ✅ **DISCOVER**: Turbo-Referenzen sammeln (erledigt)
2. ✅ **PLAN**: Migrationsstrategie dokumentieren (dieser ADR)
3. ⏳ **LINT**: Pre-Flight-Checks (Checkliste in Plan)
4. ⏳ **APPLY**: Code-Änderungen (8 Templates, 4 JS, 2 Python)
5. ⏳ **REPORT**: Unified Diffs + CHANGELOG
6. ⏳ **TEST**: Manuelle + E2E-Tests

**Zeitplan:** ~1 Arbeitstag (9h)

---

## Monitoring & Success Criteria

### KPIs nach Migration

| Metrik | Vor (Turbo) | Ziel (htmx) | Messung |
|--------|-------------|-------------|---------|
| Bundle Size (JS) | 312 KB | < 20 KB | Chrome DevTools Network |
| Time-to-Interactive | ~2.5s | < 2s | Lighthouse |
| Login-Success-Rate | 95% | > 98% | Backend-Logs |
| 401-Recovery-Rate | 80% | > 95% | Frontend-Monitoring |
| Flash-Bugs (User Reports) | ~5/Monat | 0 | GitHub Issues |

### Acceptance Tests

- [ ] Login-Sheet öffnet/schließt ohne Flicker
- [ ] Login-Fehler zeigt Nachricht im Sheet (kein Redirect)
- [ ] Login-Erfolg schließt Sheet + aktualisiert Nav (kein Reload)
- [ ] 401 bei geschützter Route öffnet Sheet automatisch
- [ ] hx-boost Navigation funktioniert (Back/Forward-Buttons)
- [ ] Cache-Header korrekt (`/auth/*` → no-store, private, Vary: Cookie)
- [ ] CSRF-Token in htmx-Requests (Header: X-CSRF-TOKEN)
- [ ] Fallback ohne JS funktioniert (Form-POST → 303)

---

## Rollback-Plan

**Falls kritische Bugs nach Deployment:**

1. **Git Revert:** `git revert <commit-hash>`
2. **Re-Deploy:** `docker-compose restart web`
3. **Downtime:** < 5 Minuten

**Rollback-Trigger:**
- Login-Success-Rate < 90% (binnen 24h)
- > 10 User-Reports über "Login funktioniert nicht"
- Kritischer 401-Bug (User kann nicht mehr einloggen)

---

## References

- [htmx Documentation](https://htmx.org/docs/) - Offizielle Docs
- [htmx Essays: Locality of Behaviour](https://htmx.org/essays/locality-of-behaviour/) - Design-Philosophie
- [Flask + htmx Guide](https://testdriven.io/blog/flask-htmx/) - Tutorial
- [Hotwired Turbo Handbook](https://turbo.hotwired.dev/handbook/introduction) - Vergleich

---

## Siehe auch

- [Migration Plan: Turbo → htmx](../migration/turbo-to-htmx-migration-plan.md) - Detaillierter Plan
- [How-To: htmx Login Flow](../how-to/htmx-login-flow.md) - Implementierungsanleitung
- [Reference: htmx Patterns](../reference/htmx-patterns.md) - Patterns für CO.RA.PAN
- [ADR-0001: Docs Reorganization](ADR-0001-docs-reorganization.md) - Vorige ADR
