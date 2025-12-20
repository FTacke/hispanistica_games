# MD3 CSS Migration Workflow

## Ziel
Saubere, seitenweise Migration aller CSS nach MD3-Designsystem. Jede Seite bekommt eigene, klar benannte CSS-Datei im neuen Schema.

## Struktur
```
static/css/md3/
  ├── tokens.css         # Farb-Tokens (aus Generator)
  ├── typography.css     # Typografie-Klassen
  ├── layout.css         # Layout-Utilities
  └── components/
      ├── text-pages.css # Für Textseiten
      ├── index.css      # Für index.html
      ├── atlas.css      # Für atlas.html
      ├── player.css     # Für player.html
      └── corpus.css     # Für Corpus-Seiten
```

## Workflow pro Seite
1. **Analyse:** Welche Klassen/Styles werden in der HTML verwendet?
2. **Migration:**
   - Neue CSS-Datei in `md3/components/` anlegen (z.B. `atlas.css`)
   - Nur benötigte Styles übernehmen, Farben durch Token ersetzen
   - Alte, nicht mehr genutzte Klassen weglassen
3. **Einbindung:**
   - In `base.html` oder direkt in der Seite die neue CSS einbinden
   - Reihenfolge: tokens.css → typography.css → layout.css → [page/component].css
4. **Review:**
   - Visuell prüfen
   - Überflüssige alte CSS entfernen, sobald alle Seiten migriert

## Hinweise
- **Keine CSS-Merges!** Immer neu anlegen, nur das Nötige übernehmen
- **Tokens immer aus `md3/tokens.css` verwenden**
- **Typografie und Layout zentral halten**
- **Jede Seite bekommt eigene Komponenten-CSS**

---
**Dieses Dokument als Vorlage für alle Migrationen verwenden!**