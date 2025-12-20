---
title: "CO.RA.PAN Webapp - Current Status Overview"
status: active
owner: documentation
updated: "2025-11-11"
tags: [overview, status, features, production]
links:
  - architecture.md
  - authentication-flow.md
  - advanced-search-architecture.md
  - blacklab-indexing.md
---

# CO.RA.PAN Webapp - Current Status Overview

**Last Updated:** 11. November 2025  
**Status:** ✅ Production-Ready  
**Version:** 2.x

---

## Executive Summary

Die CO.RA.PAN Webapp ist eine moderne Flask-basierte Anwendung zur Exploration des Corpus Oral del Panhispánico. Alle Hauptfeatures sind vollständig implementiert und produktionsreif.

---

## Production-Ready Features

### 🔍 Corpus Search

#### Basic Search (Token-based)
- **Status**: ✅ Produktionsreif
- **Features**:
  - Token-basierte Suche mit morphologischen Filtern (Form, Lemma, POS)
  - Multi-Token-Queries mit Wildcards
  - Länder/Regions-Filter mit National/Regional-Toggle
  - Speaker-Metadaten-Filter (Typ, Geschlecht, Modus, Diskurs)
  - Ergebnisse mit Kontext (links/match/rechts) und Audio-Snippet-Links
- **Dokumentation**:
  - [Corpus Search Architecture](../reference/corpus-search-architecture.md)
  - [Corpus Search Quick Reference](../reference/corpus-search-quick-reference.md)

#### Advanced Search (BlackLab)
- **Status**: ✅ Produktionsreif (November 2025)
- **Features**:
  - CQL (Corpus Query Language) Support für komplexe Queries
  - Pattern-basierte Suche (exakt, lemma-basiert)
  - Server-side DataTables mit Pagination und Filterung
  - CSV/TSV Export mit Streaming (bis 50.000 Zeilen)
  - Rate Limiting und Security Hardening
- **Metriken**:
  - 146 Dokumente indexiert
  - 1.487.120 Tokens
  - 15.89 MB Index-Größe
  - <1s Suchzeit für komplexe CQL-Queries
- **Dokumentation**:
  - [Advanced Search Architecture](advanced-search-architecture.md)
  - [BlackLab Indexing Architecture](blacklab-indexing.md)
  - [How to Build BlackLab Index](../how-to/build-blacklab-index.md)
  - [BlackLab Integration Status](../operations/blacklab-integration-status.md)

---

### 🎵 Audio & Visualization

#### Audio Player
- **Status**: ✅ Produktionsreif
- **Features**:
  - Full Audio und Split Segment Playback
  - Interaktive Transkripte mit Zeit-synchronisiertem Highlighting
  - Temporäre Snippet-Generierung für Suchergebnisse
  - FFmpeg-basierte Audio-Verarbeitung
- **Dokumentation**:
  - [Media Folder Structure](../reference/media-folder-structure.md)
  - [Audio Folder Files](../reference/audio_folder_files.md)

#### Atlas (Karten-Ansicht)
- **Status**: ✅ Produktionsreif
- **Features**:
  - Interaktive geolinguistische Karte mit Leaflet
  - Länder/Regions-Marker mit Metadaten-Tooltips
  - Tooltips zeigen: Emisoras, Duración total, Palabras transcritas
  - Deep-Links zu Metadatos und Estadísticas pro Land
- **Hinweis**: Die früheren Tabellen/Tabs wurden nach `corpus_metadata` migriert
- **Dokumentation**:
  - [Architecture Overview](architecture.md) (Atlas-Sektion)

#### Corpus Metadata (Metadaten-Dashboard)
- **Status**: ✅ Produktionsreif
- **Features**:
  - Länder-Tab-Navigation für Metadaten-Übersicht
  - Tabelle mit Grabaciones pro Land (Fecha, Emisora, Archivo, Duración, Palabras)
  - Deep-Link-Unterstützung via `?country=XXX` Parameter
  - Schema-Dokumentation für Metadaten-Struktur
- **Route**: `/corpus/metadata`

#### Statistics Dashboard
- **Status**: ✅ Produktionsreif (November 2025)
- **Features**:
  - Speaker-Verteilung nach Land, Geschlecht, Typ
  - Wort-Frequenz-Analyse
  - Interaktive Charts mit ECharts
  - Deep-Link-Unterstützung via `?country=XXX` Parameter
  - Filterung konsistent mit Hauptsuche
- **API**: `GET /api/stats` (öffentlich, read-only)
- **Dokumentation**:
  - [Stats API Reference](../reference/README_stats.md)

---

### 👥 Content Management

#### Editor Interface
- **Status**: ✅ Produktionsreif
- **Zugriff**: Editor/Admin Roles
- **Features**:
  - JSON-Transkript-Editing mit Live-Preview
  - Versions-Tracking und Edit-History
  - File-Management pro Land/Region
- **Dokumentation**:
  - [Editor System Overview](../design/editor-system-overview.md)

#### Admin Dashboard
- **Status**: ✅ Produktionsreif
- **Zugriff**: Admin Role
- **Features**:
  - User-Management und Role-Assignment
  - Content-Moderation-Capabilities
- **Dokumentation**:
  - [Architecture Overview](architecture.md) (Admin-Sektion)

---

### 🔐 Authentication & Security

#### Authentication System
- **Status**: ✅ Produktionsreif (November 2025)
- **Features**:
  - JWT-basierte Authentifizierung mit Cookie-basierten Tokens
  - CSRF-Protection für state-changing Requests
  - GET `/auth/logout` als Primary Endpoint (idempotent)
  - POST `/auth/logout` für Backward-Compatibility
- **Role-Based Access Control**:
  - 3 Rollen-Tiers: `user`, `editor`, `admin`
  - Fine-grained Access-Matrix für alle Routes
- **Dokumentation**:
  - [Authentication Flow](authentication-flow.md)
  - [API Auth Endpoints](../reference/api-auth-endpoints.md)
  - [Auth Access Matrix](../reference/auth-access-matrix.md)
  - [Recent Auth Reports (archived)](../archived/reports-2025/2025-11-11-auth-logout-v3-fix.md)

#### Security Features
- **Status**: ✅ Production-hardened
- **Features**:
  - Rate Limiting (30 req/min für DataTables, 5 req/min für Export)
  - CQL Injection Prevention
  - Input Validation auf allen Endpoints
  - Secure Audio Snippet Access Control (public snippet playback via `/media/play_audio` is always available)
  - `ALLOW_PUBLIC_TEMP_AUDIO` Toggle controls access to `/media/temp` and `/media/snippet` (not `/media/play_audio`)
- **Dokumentation**:
  - [CQL Escaping Rules](../reference/cql-escaping-rules.md)
  - [Rate Limiting Strategy](../operations/rate-limiting-strategy.md)

---

## Technology Stack

### Backend
- **Flask 3.x** mit Application Factory Pattern
- **PostgreSQL** Database (Production & Dev default für Auth)
- **SQLite** Database (Fallback/Quickstart: `auth.db` for auth, `data/stats_all.db` for stats)
- **BlackLab Server** für Corpus Search (Java-basiert, indexes under `data/blacklab_index/`)
- **FFmpeg** und **libsndfile** für Audio-Processing
- **JWT** für Authentication mit Cookie-basierten Tokens

### Frontend
- **Vite** für Asset-Bundling und Build-Process
- **Material Design 3** Principles mit Custom CSS Architecture
- **DataTables** für interaktive Result-Tables
- **ECharts** für Data-Visualization
- **Leaflet** für Geolinguistic Mapping
- **HTMX** für Dynamic UI Interactions

### Infrastructure
- **Docker** für Production Deployment
- **GitLab CI/CD** für Automated Testing
- **Python 3.12+**, **Node 20+** erforderlich für Development

---

## System Metrics (November 2025)

### Corpus Size
- **146 JSON Dokumente** über 20+ Länder/Regionen
- **~1.5 Millionen indexierte Tokens**
- **15.89 MB BlackLab-Index**

### Performance
- **<100ms** für Basic Queries
- **<1s** für komplexe CQL-Queries
- **50.000 Zeilen** Export-Capability mit Streaming

### Deployment
- **Production-Ready** seit November 2025
- **Automated CI/CD** Pipeline
- **Zero-Downtime** Index-Updates
- **Health-Checks** für alle kritischen Services

---

## Recent Major Updates (November 2025)

### Authentication & Security
- ✅ GET Logout Implementation (idempotent, CSRF-free)
- ✅ Public Route Access ohne JWT-Decorator
- ✅ Comprehensive Auth Access Matrix dokumentiert
- ✅ Tab Navigation Fixes für Advanced Search

### Advanced Search
- ✅ BlackLab Stage 1-3 Complete (Export → Index → BLS)
- ✅ UI Implementation mit DataTables
- ✅ Streaming CSV/TSV Export (bis 50.000 Zeilen)
- ✅ CQL Security Hardening
- ✅ Rate Limiting & Error Handling

### Design System
- ✅ Material Design 3 Migration Complete
- ✅ BEM Naming Convention durchgängig
- ✅ Responsive Padding & Drawer Integration
- ✅ WCAG 2.1 AA Accessibility Compliance

---

## Configuration

### Required Environment Variables
- `FLASK_SECRET_KEY` - Flask Session Secret
- `JWT_SECRET_KEY` - JWT Signing Key (legacy: `JWT_SECRET`)
- `AUTH_DATABASE_URL` - SQLAlchemy URL for Auth-DB (Postgres or SQLite)
- `BLACKLAB_BASE_URL` - BlackLab Server URL (default: `http://localhost:8081/blacklab-server`)
- `ALLOW_PUBLIC_TEMP_AUDIO` - Public/Private Audio Snippet Access (default: false)

### Database Configuration

#### Production (Postgres)
```
AUTH_DATABASE_URL=postgresql+psycopg://user:pass@host:port/corapan_auth
```

#### Development (Postgres via Docker)
```
AUTH_DATABASE_URL=postgresql+psycopg://corapan_auth:corapan_auth@localhost:54320/corapan_auth
```

#### Fallback (SQLite - not recommended for integration tests)
```
AUTH_DATABASE_URL=sqlite:///data/db/auth.db
```

### Database Files
- `auth.db` - Authentication database (users, roles, sessions)
- `data/stats_all.db` - Aggregierte Statistiken
- `data/blacklab_index/` - BlackLab-powered corpus index (replaces legacy transcription.db)

### Media Structure
- `media/mp3-full/` - Vollständige Audio-Dateien
- `media/mp3-split/` - Segmentierte Audio-Clips
- `media/mp3-temp/` - Generierte Snippets für Suchergebnisse
- `media/transcripts/` - JSON-Transkripte pro Land

---

## Known Limitations

### Current Constraints
- **Export Limit**: 50.000 Zeilen (Hard Cap für Streaming)
- **Rate Limits**: 30 req/min (DataTables), 5 req/min (Export)
- **Audio Format**: MP3 only (kein FLAC/WAV)
- **Index Updates**: Require restart (atomic switch, aber kein hot-reload)

### Future Enhancements (Optional)
- Real-time Index Updates ohne Restart
- Multi-Format Audio Support (FLAC, WAV)
- Advanced Analytics Dashboard
- GraphQL API zusätzlich zu REST

---

## Support & Documentation

### Getting Started
1. **[Development Setup](../operations/development-setup.md)** - Lokale Entwicklungsumgebung
2. **[Architecture Overview](architecture.md)** - System-Architektur verstehen
3. **[Deployment Guide](../operations/deployment.md)** - Production Deployment

### Troubleshooting
- **[Auth Issues](../troubleshooting/auth-issues.md)** - Login, Token, Redirect-Probleme
- **[Database Issues](../troubleshooting/database-issues.md)** - Performance, Indizes, SQLite
- **[BlackLab Issues](../troubleshooting/blacklab-issues.md)** - Server, Indexing, Proxy, Search Errors
- **[Frontend Issues](../troubleshooting/frontend-issues.md)** - DataTables, Audio, Player

### Contributing
- **[CONTRIBUTING.md](/CONTRIBUTING.md)** - Contribution Guidelines
- **[Design System](../design/design-system-overview.md)** - UI/UX Guidelines
- **[Roadmap](../decisions/roadmap.md)** - Future Development Priorities

---

## Conclusion

Die CO.RA.PAN Webapp ist eine vollständig funktionale, produktionsreife Anwendung mit umfassenden Features für Corpus-Exploration, Audio-Playback, und Content-Management. Alle kritischen Systeme sind implementiert, getestet, und dokumentiert.

**Status**: ✅ Ready for Production Use  
**Maintainer**: Felix Tacke (felix.tacke@uni-marburg.de)  
**Repository**: `git@gitlab.uni-marburg.de:tackef/corapan-new.git`
