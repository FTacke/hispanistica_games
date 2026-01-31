---
title: "Quiz UI – Cosmetic Revamp"
status: active
owner: frontend-team
updated: "2026-01-31"
tags: [quiz, ui, md3, css, mobile]
links:
  - ../components/quiz/README.md
  - ../components/quiz/ARCHITECTURE.md
  - ../components/quiz/OPERATIONS.md
---

# Quiz UI – Cosmetic Revamp

## Überblick

Kosmetische UI-Überarbeitung des Quiz HUD (Desktop + Mobile) sowie Entfernen der Token-Anzeige aus dem Ranking. Es wurden keine Logikänderungen vorgenommen.

## Screenshots

> Hinweis: Bitte die finalen Screenshots ergänzen.

### Desktop – Vorher/Nachher

- Vorher: ![Desktop vorher](../ui/assets/quiz-ui-cosmetic/desktop-before.png)
- Nachher: ![Desktop nachher](../ui/assets/quiz-ui-cosmetic/desktop-after.png)

### Mobile – Vorher/Nachher

- Vorher: ![Mobile vorher](../ui/assets/quiz-ui-cosmetic/mobile-before.png)
- Nachher: ![Mobile nachher](../ui/assets/quiz-ui-cosmetic/mobile-after.png)

### Ranking – Vorher/Nachher

- Vorher: ![Ranking vorher](../ui/assets/quiz-ui-cosmetic/ranking-before.png)
- Nachher: ![Ranking nachher](../ui/assets/quiz-ui-cosmetic/ranking-after.png)

## Änderungen (Dateiliste)

- templates/games/quiz/play.html
- static/css/games/quiz.css
- static/js/games/quiz-entry.js
- game_modules/quiz/styles/quiz.css

## Hinweise

- Keine Logikänderungen.
- Countdown- und Joker-Farben unverändert.

---

## Siehe auch

- ../components/quiz/README.md - Quiz-Überblick und Einstiegspunkte
- ../components/quiz/ARCHITECTURE.md - Architektur und Mechaniken
- ../components/quiz/OPERATIONS.md - DEV/Prod Workflows
