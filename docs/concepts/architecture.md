---
title: "Architecture Overview"
status: active
owner: backend-team
updated: "2025-11-07"
tags: [architecture, flask, blueprint, overview]
links:
  - authentication-flow.md
  - ../reference/database-maintenance.md
---

# Architecture Overview

## Backend
- Flask 3.x application factory located at `src/app/__init__.py`.
- Blueprints split by domain (`public`, `auth`, `corpus`, `media`, `admin`, `atlas`).
- Role-based access control provided through `src/app/auth` with three tiers: `admin`, `editor`, `user`.
- JWT cookies configured with secure defaults; credentials hydrated from `*_PASSWORD_HASH` environment variables.
- Media endpoints read from `media/mp3-full`, `media/mp3-split`, `media/mp3-temp`, and `media/transcripts` with traversal protection.
- Public toggle (`ALLOW_PUBLIC_TEMP_AUDIO`) controls anonymous access to snippets; authenticated roles always retain playback.
- Counter service in `src/app/services/counters.py` tracks access, visits, and search requests using JSON stores under `data/counters`.
- Corpus search is powered by BlackLab (`src/app/services/blacklab_search.py`) with indexed documents under `data/blacklab_index/`.

## Frontend
- Base layout (`templates/base.html`) shares navigation, login banner, and footer across all pages.
- Templates organized under `templates/pages` with partials for navigation, footer, and status banner; legacy pages (corpus/player) currently live in `templates/legacy` while the UI is being modernized.
- CSS split into design tokens, layout scaffolding, and component styles (`static/css`).
- JavaScript uses ES modules grouped by feature (`static/js/modules/*`).
- External libraries loaded via CDN (Tailwind CSS, ECharts).
- Burger navigation and login sheet provide a consistent experience on mobile and desktop.
- Corpus UI consumes the JSON API, highlights matches, and disables snippet/transcript actions when access is restricted.
- Atlas module reads country/file metadata from dedicated REST endpoints and renders summaries alongside the Leaflet map.

## Deployment
- Dockerfile targets Python 3.12 slim with FFmpeg and libsndfile installed for audio processing.
- `media` and `data` directories act as bind mounts in production deployments.
- Static assets served directly from `static/` directory (no build step required).

