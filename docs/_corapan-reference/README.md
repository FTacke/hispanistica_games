# Corapan-Webapp Reference Documentation

This directory contains analysis and comparison documentation for the **corapan-webapp** parent repository (https://github.com/FTacke/corapan-webapp).

## Purpose

These documents serve as **historical reference** for understanding:
- **Inherited code** and architecture decisions
- **Parent repository** structure and patterns
- **What to keep vs. remove** when cleaning up games_hispanistica
- **Architectural lineage** of this project

## Documents in this Directory

### 📖 Start Here

**[START-HERE.md](START-HERE.md)** - Entry point for understanding the corapan analysis docs

### 🔍 Analysis Documents

1. **[CORAPAN_COMPARISON_AUDIT.md](CORAPAN_COMPARISON_AUDIT.md)** - Systematic comparison of games_hispanistica vs. corapan-webapp
   - What was inherited, modified, and should be removed
   - Code cleanup recommendations
   - Database/config updates needed

2. **[corapan-webapp-analysis.md](corapan-webapp-analysis.md)** - Complete technical reference of parent repository
   - ~8,000 words comprehensive analysis
   - 13 blueprints, authentication system, database schema
   - Deployment patterns and service architecture

3. **[corapan-quick-reference.md](corapan-quick-reference.md)** - Fast lookup guide
   - ~3,000 words condensed reference
   - Code patterns and examples
   - Quick directory map and lookups

4. **[audit-methodology.md](audit-methodology.md)** - Step-by-step comparison guide
   - How to systematically compare repositories
   - Commands for diffing files and structures
   - Checklist for auditing components

### 📚 Navigation & Summaries

- **[CORAPAN-ANALYSIS-INDEX.md](CORAPAN-ANALYSIS-INDEX.md)** - Master navigation guide with cross-references
- **[CORAPAN-ANALYSIS-SUMMARY.md](CORAPAN-ANALYSIS-SUMMARY.md)** - Executive overview of all documents
- **[README-ANALYSIS.md](README-ANALYSIS.md)** - Detailed guide to navigating analysis docs

## When to Use These Documents

✅ **Use when:**
- Understanding why certain code exists in games_hispanistica
- Deciding whether to keep or remove inherited components
- Researching parent repository architecture patterns
- Onboarding new maintainers to the project's history
- Planning major refactoring or cleanup work

❌ **NOT for:**
- Day-to-day development (use docs in parent directories)
- User-facing documentation
- Deployment guides (see docs/operations/)

## Key Findings

### ✅ Keep (Inherited & Valuable)
- Flask app factory pattern
- JWT authentication system
- Material Design 3 (MD3) design system
- Docker multi-service setup
- Database service layer patterns
- Admin user management

### ❌ Remove (Corapan-Specific)
- Corpus search features (if BlackLab not used)
- `corapan`-branded configuration
- Database names referencing "corapan_auth" (update to "hispanistica_games_auth")
- Deployment paths `/srv/webapps/corapan` (update to project-specific)
- Systemd service names `corapan-gunicorn.service`

### 🔧 Update (Rebranding Needed)
- Database connection strings in CI/CD
- Service names in systemd/Docker
- Deployment paths in workflows
- Configuration references

## Maintenance Notes

**Created:** 2025-01-24 (during public repo cleanup)  
**Parent Repository Version:** corapan-webapp v1.0.0  
**Analysis Method:** Automated GitHub repo analysis + manual audit  

**Update Policy:**
- Re-run analysis if corapan-webapp releases major version (v2.0+)
- Archive these docs if games_hispanistica diverges significantly from parent
- Keep for historical reference even after cleanup complete

## Related Documentation

- **Parent:** [docs/ARCHITECTURE.md](../ARCHITECTURE.md) - games_hispanistica architecture
- **Sibling:** [docs/MODULES.md](../MODULES.md) - games_hispanistica module overview
- **Related:** [docs/SECURITY_AND_SECRETS.md](../SECURITY_AND_SECRETS.md) - Security practices

---

**Note:** These documents are for **maintainer reference only** and document the ancestry of games_hispanistica. They are not required reading for contributors focusing on quiz game features.

**Questions?** Start with [START-HERE.md](START-HERE.md) or consult [CORAPAN-ANALYSIS-INDEX.md](CORAPAN-ANALYSIS-INDEX.md) for navigation.
