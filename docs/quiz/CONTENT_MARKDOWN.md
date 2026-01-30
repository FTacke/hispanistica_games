# Content Markdown (Quiz)

**Zweck:** Dezente Hervorhebungen in Prompts, Antworten und Erklärungen – ohne HTML oder komplexes Markdown.

---

## Unterstützte Syntax

**Bold**
- Input: `**wichtig**`
- Output: **wichtig**

**Italic**
- Input: `*betont*`
- Output: *betont*

---

## Nicht unterstützt (verboten)

- HTML-Tags (werden escaped)
- Links: `[text](url)`
- Nested Markdown: `***bold+italic***` oder `**bold *italic***`
- Unterstrich-Syntax: `__underline__`
- Listen, Überschriften, Code-Blöcke

---

## Hinweise für Autor:innen

- Nutze Hervorhebungen sparsam.
- Vermeide verschachtelte Sternchen-Kombinationen.
- Wenn ein Sternchen im Text nötig ist, schreibe es ausgeschrieben oder nutze Ersatzzeichen.

---

## Sicherheit

- HTML wird vor dem Rendern escaped.
- Danach werden nur die Marker für **bold** und *italic* umgesetzt.
- So bleiben Inhalte XSS-sicher.
