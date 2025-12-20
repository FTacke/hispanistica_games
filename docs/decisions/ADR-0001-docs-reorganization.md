---
title: "ADR-0001: Documentation Reorganization (Docs as Code)"
status: accepted
owner: documentation
updated: "2025-11-07"
tags: [adr, documentation, architecture-decision, docs-as-code]
---

# ADR-0001: Documentation Reorganization ("Docs as Code")

**Status:** Accepted  
**Date:** 2025-11-07  
**Deciders:** Felix Tacke  
**Supersedes:** N/A  

---

## Context

Prior to November 2025, the CO.RA.PAN documentation was organized in a **flat structure** within `docs/`:

- 18 Markdown files with inconsistent naming (e.g., `DEPLOYMENT.md`, `deployment.md`, `GIT_SECURITY_CHECKLIST.md`)
- No front-matter metadata (no tags, status, ownership)
- No clear taxonomy (concepts vs. how-to vs. reference)
- Large monolithic files (e.g., `troubleshooting.md` with 638 lines covering Docker, DB, Auth, Frontend)
- Obsolete documentation mixed with active docs
- No master index (users had to browse directory listing)
- Cross-references used absolute paths or inconsistent relative paths

### Problems

1. **Discoverability**: Users couldn't quickly find the right documentation
2. **Maintainability**: Large files were hard to update (e.g., splitting troubleshooting by domain)
3. **Searchability**: No metadata meant no semantic search
4. **Consistency**: Naming conventions varied (CAPS vs. lowercase vs. mixed)
5. **Obsolescence**: No clear way to mark/archive completed analyses

---

## Decision

We will adopt **"Docs as Code" principles** with a clear 8-category taxonomy:

### New Structure

```
docs/
├── index.md                   # Master navigation index
├── concepts/                  # What & Why (architecture, auth-flow)
├── how-to/                    # Step-by-step guides
├── reference/                 # API docs, DB schema, technical specs
├── operations/                # Deployment, CI/CD, security
├── design/                    # Design system, tokens, accessibility
├── decisions/                 # ADRs, roadmap
├── migration/                 # Historical migrations (mostly empty)
├── troubleshooting/           # Problem-solutions by domain
└── archived/                  # Completed analyses, obsolete docs
```

### Conventions

1. **Front-Matter Metadata** (YAML):
   ```yaml
   ---
   title: "Document Title"
   status: active | deprecated | archived
   owner: backend-team | frontend-team | devops | documentation
   updated: "2025-11-07"
   tags: [tag1, tag2]
   links:
     - ../relative/path.md
   ---
   ```

2. **File Naming**: Kebab-case, no dates, descriptive
3. **Internal Links**: Relative paths (`../reference/file.md`)
4. **File Splitting**: Large files (>400 lines) split by logical domain
5. **Git History**: Use `git mv` to preserve history

---

## Rationale

### Taxonomy Choice

We chose the **Divio Documentation System** (modified):
- **Concepts**: Tutorials in Divio → Concepts (What & Why) in CO.RA.PAN
- **How-To**: Same (Step-by-step guides)
- **Reference**: Same (Technical specs)
- **Explanation**: Merged into Concepts/Decisions

**Additional Categories:**
- **Operations**: Deployment, CI/CD (not in Divio)
- **Design**: Design system, accessibility (not in Divio)
- **Decisions**: ADRs, roadmap (not in Divio)
- **Migration**: Historical migrations (CO.RA.PAN-specific)
- **Troubleshooting**: Problem-solutions (Divio puts in "How-To", we separate)

### Front-Matter Benefits

- **Searchability**: Tools like Algolia/grep can index metadata
- **Status Tracking**: Know what's active vs. deprecated vs. archived
- **Ownership**: Clear responsibility (`backend-team`, `frontend-team`, etc.)
- **Link Graphs**: Build documentation dependency graphs

### File Splitting Benefits

**Example: `troubleshooting.md` (638 lines) → 4 files:**
- `troubleshooting/auth-issues.md` (Auth-specific)
- `troubleshooting/database-issues.md` (DB-specific)
- `troubleshooting/docker-issues.md` (Server-specific)
- `troubleshooting/frontend-issues.md` (UI-specific)

**Benefits:**
- Easier to maintain (smaller files)
- Faster to load (users only read relevant section)
- Better SEO (specific titles)
- Clearer ownership (backend vs. frontend)

---

## Consequences

### Positive

✅ **Better Discoverability**: Master index + 8-category taxonomy  
✅ **Improved Maintainability**: Smaller, focused files  
✅ **Metadata-Driven**: Front-matter enables tooling (search, link graphs)  
✅ **Git-Friendly**: `git mv` preserves history  
✅ **Scalable**: Easy to add new docs in correct category  
✅ **Professional**: Follows industry standards (Divio, GitLab Docs, etc.)

### Negative

⚠️ **One-Time Effort**: ~45 minutes to reorganize (DRY_RUN mitigated risk)  
⚠️ **Link Maintenance**: 30-50 internal links needed updating  
⚠️ **Learning Curve**: Team must learn new structure (mitigated by `index.md`)

### Neutral

- **Breaking Change**: External links to `docs/deployment.md` now `docs/operations/deployment.md`
- **Front-Matter Overhead**: New docs must include YAML (adds ~10 lines per file)

---

## Alternatives Considered

### Alt 1: Keep Flat Structure, Add Front-Matter Only

**Pros:** Minimal change, no link updates  
**Cons:** Doesn't solve discoverability or large-file problems  
**Decision:** Rejected (insufficient improvement)

### Alt 2: Use Subdirectories, No Front-Matter

**Pros:** Better organization, no metadata overhead  
**Cons:** No searchability, no status tracking  
**Decision:** Rejected (metadata is valuable)

### Alt 3: Use Tool-Specific Structure (e.g., MkDocs Material)

**Pros:** Tool-optimized structure  
**Cons:** Vendor lock-in, requires tool installation  
**Decision:** Rejected (prefer tool-agnostic Markdown)

---

## Implementation

**Date:** 2025-11-07  
**Commit:** `docs: Reorganize documentation (Docs as Code) - ADR-0001`

### Changes Made

1. Created 9 directories (`concepts/`, `how-to/`, `reference/`, `operations/`, `design/`, `decisions/`, `migration/`, `troubleshooting/`, `archived/`)
2. Moved 15 files with `git mv` (preserved history)
3. Split 3 large files into 11 total:
   - `auth-flow.md` → `concepts/authentication-flow.md`, `reference/api-auth-endpoints.md`, `troubleshooting/auth-issues.md`
   - `design-system.md` → `design/design-system-overview.md`, `design/design-tokens.md`, `design/material-design-3.md`, `design/accessibility.md`
   - `troubleshooting.md` → `troubleshooting/docker-issues.md`, `troubleshooting/database-issues.md`, `troubleshooting/frontend-issues.md`, `troubleshooting/auth-issues.md`
4. Added front-matter to 25 files (14 moves + 11 splits)
5. Fixed ~40 internal links (README.md, cross-doc references)
6. Created `docs/index.md` (master navigation)
7. Archived 5 completed analysis files to `docs/archived/`
8. Archived planning docs (`PLAN.md`, `QUALITY_REPORT.md`) to `docs/archived/`

### Validation

- ✅ All links checked (manual + grep)
- ✅ Front-matter valid YAML
- ✅ Git history preserved (`git log --follow`)
- ✅ No broken references

---

## References

- **Divio Documentation System**: https://documentation.divio.com/
- **GitLab Docs Structure**: https://docs.gitlab.com/ee/development/documentation/structure.html
- **ADR Template**: https://github.com/joelparkerhenderson/architecture-decision-record
- **Contributing Guidelines**: [/CONTRIBUTING.md](/CONTRIBUTING.md)

---

## Changelog

- **2025-11-07**: Initial decision and implementation
