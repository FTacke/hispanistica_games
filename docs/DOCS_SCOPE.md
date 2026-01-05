# Documentation Scope & Principles

**Document Status:** Current code documentation (January 2025)

---

## Core Principle

**The documentation reflects ONLY what currently exists in the codebase.**

This documentation describes the **present state** of the games.hispanistica project. Historical features, removed components, and deprecated functionality are NOT documented here.

---

## What This Documentation Contains

✅ **Active Components** - Components currently in the codebase  
✅ **Current APIs** - Endpoints, schemas, request/response formats  
✅ **Existing Data Models** - Database tables, ORM models  
✅ **Working Features** - Quiz gameplay, auth system, admin API  
✅ **Deployment Setup** - Docker, CI/CD, scripts  
✅ **Live Configuration** - Environment variables, token system

---

## What This Documentation Does NOT Contain

❌ **Historical Features** - Removed components (e.g., Corapan corpus platform)  
❌ **Deprecated APIs** - Old endpoints no longer in code  
❌ **Migration History** - Past refactorings, old architectures  
❌ **Abandoned Plans** - Unimplemented features, scrapped designs  
❌ **Archived Code** - Code removed from main branch

---

## For Historical Context

**Use Git History:**
```bash
# View past file state
git log --follow -- <file>

# See deleted files
git log --all --full-history -- <file>

# Blame for line history
git blame <file>

# View commits from specific period
git log --since="2024-01-01" --until="2024-12-31"
```

**Old Documentation:**
If you need documentation for removed features, check out older commits where those features existed. The documentation in this folder is strictly **current-code-only**.

---

## Documentation Structure

```
docs/
├── README.md              # Architecture overview, component index
├── DOCS_SCOPE.md          # This file (documentation principles)
└── components/            # Component-based documentation
    ├── app-core/          # Flask app factory, extensions, config
    ├── auth/              # JWT auth, user management, RBAC
    ├── admin-api/         # Admin REST API for user management
    ├── database/          # SQLAlchemy setup, auth schema
    ├── quiz/              # Quiz game module (players, runs, scoring)
    ├── frontend-ui/       # Templates, MD3 design system, static assets
    └── deployment/        # Docker, CI/CD, deployment scripts
```

---

## Update Policy

**When Code Changes, Documentation MUST Change:**
- **New feature added** → Document it in relevant component README
- **Feature removed** → Delete documentation for it (no archives)
- **API changed** → Update endpoint schemas immediately
- **Data model updated** → Update model documentation

**Keep Documentation Synchronized:**
Documentation drift (docs describing non-existent code) is a critical failure. If you see outdated documentation, either update it or delete it.

---

## Why This Approach?

**Problem Solved:**
Previously, documentation accumulated historical content (old architectures, removed features, deprecated APIs). This created confusion:
- Developers couldn't tell what was current
- Documentation contradicted actual code
- Archives created maintenance burden

**Solution:**
Documentation strictly mirrors current codebase. Historical context lives in Git history where it belongs.

---

## Documentation Principle Summary

> **"Document what IS, not what WAS."**

If it's not in the current code, it's not in the current docs.

---

**See Also:**
- Component Index: [README.md](README.md)
- Git History: `git log --follow -- docs/`
