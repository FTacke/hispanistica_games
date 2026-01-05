# Documentation Consolidation Plan

**Date:** 2025-01-24  
**Scope:** Consolidate ~247 markdown files for public repo readiness  
**Goal:** Remove corapan remnants, archive dev notes, consolidate structure  

---

## Overview

**Total Files:** 247 markdown files across 28 directories  

### Directory Inventory

| Directory | Files | Assessment | Action |
|-----------|-------|------------|--------|
| docs/ (root) | 37 | Mixed: Recent audits + old reports | **CLEAN** - Keep audits, archive old |
| docs/admin | 3 | Admin setup & auth docs | **KEEP** |
| docs/analytics | 2 | Analytics implementation | **KEEP** |
| docs/archived | 38 | Already archived old material | **REVIEW & PRUNE** |
| docs/concepts | 9 | Architecture concepts | **REVIEW** - Check corapan refs |
| docs/decisions | 4 | ADRs (Architecture Decision Records) | **KEEP** |
| docs/design | 15 | Design system & UI specs | **KEEP** |
| docs/dev | 4 | Dev guides | **KEEP** |
| docs/guides | 3 | General guides | **KEEP** |
| docs/how-to | 14 | How-to guides | **KEEP** |
| docs/md3 | 12 | MD3 design system | **KEEP** |
| docs/md3/90_archive | 43 | MD3 archive (CSS migration) | **PRUNE** - Extremely old |
| docs/migration | 5 | Migration guides | **REVIEW** |
| docs/operations | 16 | Operations runbooks | **KEEP** |
| docs/performance | 1 | Performance docs | **KEEP** |
| docs/quiz-seed | 5 | Quiz seeding procedures | **KEEP** |
| docs/reference | 24 | Technical reference | **REVIEW** - Corapan refs |
| docs/reports | 3 | Status reports | **ARCHIVE** |
| docs/template | 2 | Doc templates | **KEEP** |
| docs/troubleshooting | 5 | Troubleshooting guides | **KEEP** |
| docs/ui | 1 | UI docs | **KEEP** |
| docs/ui_conventions | 5 | UI conventions | **KEEP** |
| **TOTAL** | **247** | | |

---

## Phase 1: Identify Files to REMOVE (Corapan Remnants)

### 🔍 Criteria for Removal:
- Files mentioning "corapan corpus" as primary topic
- Files referencing BlackLab (if not used in games_hispanistica)
- Files describing corapan-specific search features
- Template files for corpus linguistics (not quiz games)

### 📋 Candidates for Removal (to be verified):

#### A) Reference Docs with Corapan-Specific Content

**Check:** [docs/reference/](reference/)
- `blacklab-configuration.md` - ⚠️ **VERIFY** if BlackLab is used
- `AUDIO_SNIPPET_NAMING_CONVENTION.md` - Uses `corapan_{token_id}.mp3` pattern - ⚠️ **UPDATE** or **REMOVE**
- Other reference docs - grep for "corapan"

**Action:**
```powershell
cd C:\dev\hispanistica_games\docs\reference
grep -l "corapan" *.md
# Review each file, decide: UPDATE (rename patterns) or REMOVE (not applicable)
```

#### B) Concept Docs Inherited from Corapan

**Check:** [docs/concepts/](concepts/)

Likely candidates:
- `search-architecture.md` (if search is corpus-based, not quiz)
- `webapp-status.md` (if corapan-specific)
- Anything referencing "corpus", "transcripts", "linguistic annotation"

**Action:**
```powershell
cd C:\dev\hispanistica_games\docs\concepts
grep -r "corpus\|transcript\|blacklab" .
```

#### C) Migration Docs No Longer Relevant

**Check:** [docs/migration/](migration/)

Archive candidates:
- `turbo-to-htmx-migration-plan.md` (archived/migration/ - already archived!)
- Any corapan-specific migration guides

---

## Phase 2: Archive Temporary/Outdated Files

### 🗂️ Consolidation Strategy:

#### A) Move OLD audit/cleanup reports to `docs/archived/reports-2025/`

**Candidates (in docs/ root):**
- `final-audit-notes.md` - Move to `archived/reports-2025/`
- `levelup_proof.md` - Move to `archived/reports-2025/`
- `quiz-integration-*.md` - Move to `archived/reports-2025/`
- `quiz-levelup-*.md` - Move to `archived/reports-2025/`
- `timer-robustness-*.md` - Move to `archived/reports-2025/`
- `quiz-bonus-dom-sync-fix.md` - Move to `archived/reports-2025/`
- `quiz_refinement_log.md` - Move to `archived/reports-2025/`

**Action:**
```powershell
$archiveReports = @(
    'final-audit-notes.md',
    'levelup_proof.md',
    'quiz-integration-qa.md',
    'quiz-integration-summary.md',
    'quiz-integration-test-results.md',
    'quiz-levelup-rootcause.md',
    'quiz-levelup-score-architecture.md',
    'quiz-levelup-smoke-test.md',
    'timer-robustness-fix-report.md',
    'timer-robustness-quickref.md',
    'quiz-bonus-dom-sync-fix.md',
    'quiz_refinement_log.md',
    'quiz_admin_highscore_implementation.md',
    'quiz_admin_highscore_tests.md',
    'quiz_contract_proof.md',
    'Quiz_Finishing.md',
    'Quiz_Fix_QuickStart.md',
    'FORM_SYSTEM_DIALOG_FIX.md',
    'FORM_SYSTEM_MIGRATION.md',
    'FORM_SYSTEM_SPACING_UPDATE.md',
    'deploy_plan.md',
    'MAINTENANCE_REPORT.md',
    'PRUNING_GUIDE.md'
)

foreach ($file in $archiveReports) {
    if (Test-Path "docs\$file") {
        git mv "docs\$file" "docs\archived\reports-2025\"
    }
}
```

#### B) Prune OLD md3 CSS migration archive

**Target:** `docs/md3/90_archive/` (43 files!)

These are OLD CSS migration notes from MD2 → MD3 transition. If migration is complete, these are no longer needed for public repo.

**Action:**
```powershell
# OPTION 1: Delete entirely (if MD3 migration is done)
git rm -r docs/md3/90_archive/

# OPTION 2: Move to top-level archived/
git mv docs/md3/90_archive/ docs/archived/md3-css-migration-2024/
```

**Recommendation:** **DELETE** (not needed in public repo - historical dev notes)

#### C) Review `docs/archived/` (already 38 files)

Some files might be duplicates or can be deleted outright.

**Action:**
```powershell
cd docs/archived
ls -Recurse *.md | Select-Object FullName, Length, LastWriteTime
# Review: Delete files older than 6 months with no historical value
```

---

## Phase 3: Update Files with Corapan References

### 🔧 Search & Replace Strategy:

#### Files to UPDATE (not remove):

1. **ARCHITECTURE.md** - Remove corapan references from examples
2. **MODULES.md** - Update module descriptions
3. **README.md** (root) - Ensure no corapan branding

**Action:**
```powershell
# Find all files with corapan references
cd C:\dev\hispanistica_games
grep -r "corapan\|Corapan\|CORAPAN" docs/ --include="*.md" -l | grep -v "CORAPAN_COMPARISON_AUDIT\|corapan-webapp-analysis\|corapan-quick-reference\|CORAPAN-ANALYSIS"

# For each file, manually review and either:
# - UPDATE: Remove/rename corapan references
# - REMOVE: Delete file if corapan-specific
# - KEEP: If reference is intentional (e.g., "inherited from corapan")
```

---

## Phase 4: Consolidate Root-Level Docs

### 📚 Current Root-Level Docs (docs/):

**Keep (Essential):**
- ✅ `ARCHITECTURE.md` - Core architecture
- ✅ `index.md` - Documentation index
- ✅ `MODULES.md` - Module overview
- ✅ `REPO_AUDIT.md` - Recent audit (THIS cleanup session)
- ✅ `CONTENT_WORKFLOW.md` - Seed data workflow
- ✅ `SECURITY_AND_SECRETS.md` - Security guide
- ✅ `CORAPAN_COMPARISON_AUDIT.md` - Corapan comparison audit
- ✅ `README-ANALYSIS.md` - Analysis navigation
- ✅ `START-HERE.md` - Documentation entry point

**Keep (Corapan Reference - Intentional):**
- ✅ `corapan-webapp-analysis.md` - Parent repo reference
- ✅ `corapan-quick-reference.md` - Parent repo quick ref
- ✅ `CORAPAN-ANALYSIS-INDEX.md` - Navigation guide
- ✅ `CORAPAN-ANALYSIS-SUMMARY.md` - Executive summary
- ✅ `audit-methodology.md` - Audit guide

**Archive (Old Status Reports):**
- 📦 → `archived/reports-2025/` (see Phase 2A)

---

## Phase 5: Final Structure (Target)

### Proposed Documentation Structure:

```
docs/
├── README.md                              ← Main entry point
├── ARCHITECTURE.md                        ← System architecture
├── MODULES.md                             ← Module overview
├── SECURITY_AND_SECRETS.md                ← Security practices
├── CONTENT_WORKFLOW.md                    ← Seed data management
│
├── admin/                                 ← Admin & auth setup
├── analytics/                             ← Analytics guides
├── concepts/                              ← Architecture concepts
├── decisions/                             ← ADRs
├── design/                                ← Design system
├── dev/                                   ← Developer guides
├── guides/                                ← General guides
├── how-to/                                ← How-to guides
├── md3/                                   ← MD3 design system
│   └── (remove 90_archive/)
├── operations/                            ← Operations runbooks
├── quiz-seed/                             ← Quiz seeding procedures
├── reference/                             ← Technical reference
│   └── (update corapan patterns)
├── template/                              ← Doc templates
├── troubleshooting/                       ← Troubleshooting
├── ui/                                    ← UI documentation
├── ui_conventions/                        ← UI conventions
│
└── archived/                              ← Historical docs
    ├── reports-2025/                      ← Dev reports (consolidated)
    ├── auth-migration/                    ← Auth migration history
    ├── finalizing-2025/                   ← Finalization work
    └── migration/                         ← Migration guides

└── _corapan-reference/                    ← Corapan analysis docs (separate)
    ├── CORAPAN_COMPARISON_AUDIT.md
    ├── corapan-webapp-analysis.md
    ├── corapan-quick-reference.md
    ├── CORAPAN-ANALYSIS-INDEX.md
    ├── CORAPAN-ANALYSIS-SUMMARY.md
    ├── README-ANALYSIS.md
    ├── START-HERE.md
    └── audit-methodology.md
```

**Rationale:**
- Move corapan analysis docs to `_corapan-reference/` subfolder (clearly separated)
- Consolidate old reports into `archived/reports-2025/`
- Remove `md3/90_archive/` (43 files of old CSS migration notes)
- Update `docs/index.md` to reflect new structure

---

## Execution Plan

### 🎯 Step-by-Step:

#### Step 1: Review & Remove Corapan-Specific Docs
```powershell
cd C:\dev\hispanistica_games

# Find corapan-specific files (excluding our analysis docs)
grep -r "corpus\|BlackLab\|transcript" docs/reference/ docs/concepts/ -l

# For each file:
# - If BlackLab/corpus-specific: git rm
# - If pattern needs updating: edit and rename
```

#### Step 2: Archive Old Reports
```powershell
# Move old quiz/form system reports to archived/
# (See Phase 2A script above)
```

#### Step 3: Delete MD3 Archive
```powershell
# Remove old CSS migration notes (43 files)
git rm -r docs/md3/90_archive/
```

#### Step 4: Consolidate Corapan Analysis Docs
```powershell
# Create corapan reference directory
mkdir docs/_corapan-reference

# Move analysis docs
git mv docs/CORAPAN_COMPARISON_AUDIT.md docs/_corapan-reference/
git mv docs/corapan-webapp-analysis.md docs/_corapan-reference/
git mv docs/corapan-quick-reference.md docs/_corapan-reference/
git mv docs/CORAPAN-ANALYSIS-INDEX.md docs/_corapan-reference/
git mv docs/CORAPAN-ANALYSIS-SUMMARY.md docs/_corapan-reference/
git mv docs/README-ANALYSIS.md docs/_corapan-reference/
git mv docs/START-HERE.md docs/_corapan-reference/
git mv docs/audit-methodology.md docs/_corapan-reference/

# Create README for this directory
cat > docs/_corapan-reference/README.md <<EOF
# Corapan-Webapp Reference

This directory contains analysis and comparison documentation for the **corapan-webapp** parent repository.

**Purpose:** Historical reference for understanding inherited code and architecture decisions.

**Start Here:** [START-HERE.md](START-HERE.md)

**Note:** These documents are for maintainer reference only and document the ancestry of games_hispanistica.
EOF
```

#### Step 5: Update docs/index.md
- Remove references to moved/deleted files
- Add link to `_corapan-reference/` section
- Update directory structure overview

#### Step 6: Git Commit
```powershell
git add -A
git commit -m "docs: consolidate documentation structure

- Archive old reports to archived/reports-2025/
- Remove MD3 CSS migration archive (43 files)
- Move corapan analysis docs to _corapan-reference/
- Update docs/index.md with new structure
- Remove corapan-specific reference docs (corpus/BlackLab)

Result: 247 → ~160 docs (87 files removed/moved)"
```

---

## Metrics

### Before Consolidation:
- **Total:** 247 markdown files
- **Root-level:** 37 files (many old reports)
- **MD3 archive:** 43 files (old CSS migration)
- **Archived:** 38 files (already archived)

### After Consolidation (Projected):
- **Total:** ~160-180 markdown files
- **Root-level:** ~10 essential files
- **Removed:** ~43 files (MD3 archive)
- **Moved:** ~25 files (old reports → archived/)
- **Archived:** ~65 files (consolidated)
- **Corapan reference:** 8 files (moved to `_corapan-reference/`)

### Expected Reduction:
- **~65-87 files removed/consolidated** (26-35% reduction)
- Clearer structure for public contributors
- Historical dev notes properly archived

---

## Risk Assessment

### ⚠️ Risks:
1. **Removing needed docs** - Mitigated by: Review each file before deletion
2. **Breaking doc links** - Mitigated by: Update index.md and search for internal links
3. **Losing historical context** - Mitigated by: Move to archived/, don't delete

### ✅ Safety Measures:
- All changes in Git (can be reverted)
- Use `git mv` (preserves history)
- Archive instead of delete when unsure
- Review `grep -r "\.\./" docs/` for relative links before committing

---

## Next Actions

1. ✅ Create this consolidation plan
2. ⏸️ Review corapan references in reference/ and concepts/
3. ⏸️ Execute Step 1: Remove corapan-specific docs
4. ⏸️ Execute Step 2: Archive old reports
5. ⏸️ Execute Step 3: Delete MD3 archive
6. ⏸️ Execute Step 4: Move corapan analysis docs
7. ⏸️ Execute Step 5: Update index.md
8. ⏸️ Execute Step 6: Git commit

---

**Status:** PLANNING COMPLETE  
**Ready for Execution:** YES  
**Estimated Time:** 30-45 minutes  
**Git Operations:** `git mv`, `git rm`, commit with detailed message  
