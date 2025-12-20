# CO.RA.PAN Mapping v2 Pipeline Status

**Date:** November 16, 2025  
**Status:** ✅ **Operational** (with documented limitations)

## Overview

The BlackLab indexing pipeline has been successfully updated to work with the new JSON structure defined in `mapping_new_plan.md`. All 146 JSON files export cleanly to TSV format with expanded speaker and country metadata fields.

---

## 1. Export Pipeline (JSON → TSV + docmeta.jsonl)

### Script
- **Location:** `src/scripts/blacklab_index_creation.py`
- **Command:** `python -m src.scripts.blacklab_index_creation --in media/transcripts --out data/blacklab_export/tsv --docmeta data/blacklab_export/docmeta.jsonl --workers 8`

### TSV Header (28 columns)

```
word | norm | lemma | pos | past_type | future_type | tense | mood | person | number | aspect | 
tokid | start_ms | end_ms | sentence_id | utterance_id | 
speaker_code | speaker_type | speaker_sex | speaker_mode | speaker_discourse | 
file_id | country_code | country_scope | country_parent_code | country_region_code | city | radio
```

### Key Features

1. **Speaker Fields** (5 fields)
   - Source: `segment["speaker"]` object (NOT from individual tokens)
   - Expanded from `speaker_code` using mapping table
   - All 16 speaker codes supported: lib-pm, lib-pf, lib-om, lib-of, lec-pm, lec-pf, lec-om, lec-of, pre-pm, pre-pf, tie-pm, tie-pf, traf-pm, traf-pf, foreign, none

2. **Country/Region Fields** (4 fields)
   - `country_code`: Original code (e.g., ARG, ARG-CBA, ESP-SEV)
   - `country_scope`: "national" or "regional"
   - `country_parent_code`: Parent country (e.g., ARG from ARG-CBA)
   - `country_region_code`: Region code or empty (e.g., CBA, SEV, "")

3. **Document Metadata** (in TSV rows + docmeta.jsonl)
   - `file_id`, `filename`, `date`, `city`, `radio`, `revision`
   - All country/region fields
   - Repeated per token in TSV, single entry in docmeta.jsonl

---

## 2. Lemma Handling Policy

**Policy:** Tokens without `lemma` are deliberately discarded

### Rationale
- Tokens missing lemma are typically:
  - Unrecognized words
  - Non-linguistic content (noise, fragments)
  - Not searchable/analyzable
- Better to exclude than to create false matches

### Implementation
- `lemma` is a mandatory field in `_extract_mandatory_token()`
- Per-file summary warnings are logged (not per-token spam)
- Example output: `Skipped 15/15023 malformed tokens in 2023-08-10_ARG_Mitre (missing lemma or other required fields)`

### Statistics
- Typical skipped rate: 0.05-0.15% of tokens per file
- Total corpus: ~1.1M valid tokens from 146 files

---

## 3. BlackLab Configuration (BLF)

### File
- **Location:** `config/blacklab/corapan-tsv.blf.yaml`
- **Base Version:** Restored from commit `f98af66` (last known working)
- **Changes:** Only added new fields (speaker_*, country_scope, country_parent_code, country_region_code)

### Key Sections

#### Token Annotations (in `annotatedFields.contents.annotations`)
- Core linguistic: word, norm, lemma, pos, tense, mood, person, number, aspect
- Timing: tokid, start_ms, end_ms
- Structure: sentence_id, utterance_id
- **Speaker (NEW):** speaker_code, speaker_type, speaker_sex, speaker_mode, speaker_discourse
- **Document metadata (repeated per token):** file_id, country_code, country_scope, country_parent_code, country_region_code, city, radio

#### Document Metadata (in `metadata.fields`)
- Extracted from first token's values (constant across document)
- **Fields:** file_id, date, country_code, country_scope, country_parent_code, country_region_code, city, radio, audio_path

### Document ID Strategy

**Current:** No `pidField` configured

**Behavior:**
- BlackLab auto-generates document IDs based on filename
- ⚠️ Warning: "YOUR DOCUMENT IDs ARE NOT PERSISTENT!"
- IDs may change on re-indexing

**Status:** ✅ **Acceptable for current use case**
- Search functionality works correctly
- Advanced Search displays all metadata
- Persistent IDs can be added later if needed for saved searches/bookmarks

**Future:** If persistent IDs are required:
```yaml
# Option 1: Use filename (simple, stable)
corpusConfig:
  specialFields:
    pidField: file_id

# Option 2: Use external docmeta.jsonl lookup
# (requires BlackLab Server configuration)
```

---

## 4. Index Build Status

### Last Build
- **Date:** November 16, 2025 14:34
- **Command:** `.\scripts\build_blacklab_index_v3.ps1 -Force -SkipBackup` (with `--max-docs -1`)
- **BlackLab Version:** 5.0.0-SNAPSHOT (Lucene 9.11.1)
- **Docker Image:** `instituutnederlandsetaal/blacklab:latest`

### Result
- **Documents Indexed:** **146 of 146** ✅
- **Total Tokens:** 1,487,120
- **Status:** ✅ **All documents indexed successfully**

### Index Validation (All 146 docs)
- ✅ All TSV files parsed correctly
- ✅ No "wrong format" errors
- ✅ No pidField errors
- ✅ Token annotations indexed (28 fields)
- ✅ Document metadata extracted
- ✅ ~1.49M tokens indexed
- ✅ All speaker codes present
- ✅ All country/region combinations present

**Note:** The `--max-docs -1` flag was added to `build_blacklab_index_v3.ps1` to disable the document limit check, allowing all 146 documents to be indexed successfully.

---

## 5. File Locations

### Source Data
- **JSON (normalized):** `media/transcripts/**/*.json` (146 files)
- **Count:** 146 documents, ~1.1M tokens

### Export Data
- **TSV files:** `data/blacklab_export/tsv/*.tsv` (146 files)
- **Document metadata:** `data/blacklab_export/docmeta.jsonl` (146 entries)

### Index
- **Current index:** `data/blacklab_index/` (active index)
- **Backup:** `data/blacklab_index.backup/` (single rotating backup)

### Configuration
- **BLF config:** `config/blacklab/corapan-tsv.blf.yaml`
- **Exporter script:** `src/scripts/blacklab_index_creation.py`
- **Build script (canonical):** `scripts/blacklab/build_blacklab_index.ps1`
- **Build script (compatibility wrapper):** `scripts/build_blacklab_index_v3.ps1` (delegates to canonical)

---

## 5. Index Build & Backup Strategy

### Canonical Build Script
**Location:** `scripts/blacklab/build_blacklab_index.ps1`

This is the **single source of truth** for building the BlackLab index. All other build scripts should delegate to this one.

### Backup Strategy (Simplified November 16, 2025)

**Rule:** Maximum **one backup** is maintained at any time.

**Directory Structure:**
- `data/blacklab_index/` - Active index (currently in use)
- `data/blacklab_index.backup/` - Single rotating backup

**Build Process:**
1. When building a new index:
   - If `data/blacklab_index.backup/` exists → delete it
   - If `data/blacklab_index/` exists → move to `data/blacklab_index.backup/`
   - Build new index in `data/blacklab_index/`

**No More:**
- ❌ Timestamped backups (`blacklab_index.backup_YYYYMMDD_HHMMSS`)
- ❌ Version-numbered directories (`blacklab_index_v2`, `blacklab_index_v3`)
- ❌ Debug directories (`blacklab_index.debug_*`)
- ❌ Manual backup management

**Usage:**
```powershell
# Standard build (with backup and confirmation)
.\scripts\blacklab\build_blacklab_index.ps1

# Force build without confirmation
.\scripts\blacklab\build_blacklab_index.ps1 -Force

# Build without creating backup (dangerous!)
.\scripts\blacklab\build_blacklab_index.ps1 -SkipBackup -Force

# Compatibility (delegates to canonical script)
.\scripts\build_blacklab_index_v3.ps1
```

**Benefits:**
- Simple and predictable
- No disk space accumulation
- Always one rollback option available
- Clear state: current + previous

---

## 6. Flask Backend & Advanced Search Integration

### Status
✅ **Fully integrated** with Mapping v2 structure (November 16, 2025)

### Updated Components

#### 1. CQL Builder (`src/app/search/cql.py`)
- **Updated:** `build_filters()` to support new country/region fields
  - `country_scope`: national | regional
  - `country_parent_code`: ARG, ESP, etc.
  - `country_region_code`: CBA, SEV, etc.
- **Updated:** `build_metadata_cql_constraints()` to generate CQL with new fields
- **Backward compatibility:** Legacy `country_code` parameter auto-mapped to `country_parent_code`
- **Speaker filters:** Fully functional via `speaker_code` constraint generation

#### 2. BlackLab Search Service (`src/app/services/blacklab_search.py`)
- **Updated:** Field mappings to use `speaker_sex`, `speaker_mode`, `speaker_discourse`
- **Updated:** `listvalues` parameter to request all 28 token annotation fields
- **Updated:** Result mapping to include new country/speaker fields
- **Backward compatibility:** Legacy fields (`sex`, `mode`, `discourse`) maintained

#### 3. Advanced Search View (`src/app/search/advanced.py`)
- **Updated:** BlackLab API URL to v5 path (`/corpora/corapan/hits`)
- **Updated:** Integration with `build_cql_with_speaker_filter()` for unified CQL generation
- **Updated:** `listvalues` parameter for complete field coverage

### Request Parameter Mapping

| UI Parameter | Backend Filter | BlackLab CQL Field |
|--------------|----------------|-------------------|
| `country_code` (3-letter) | `country_parent_code` | `country_parent_code` |
| `country_code` (regional) | `country_code` | `country_code` |
| `country_scope` | `country_scope` | `country_scope` |
| `country_region_code` | `country_region_code` | `country_region_code` |
| `speaker_type` | `speaker_type` → `speaker_code` | `speaker_code` |
| `sex` | `sex` → `speaker_code` | `speaker_code` |
| `speech_mode` | `mode` → `speaker_code` | `speaker_code` |
| `discourse` | `discourse` → `speaker_code` | `speaker_code` |
| `city` | `city` | `city` |
| `radio` | `radio` | `radio` |
| `date` | `date` | `date` |

### CQL Generation Examples

**Example 1:** National country filter
```
Input: q=casa, mode=lemma, country_code=ARG
CQL:   [lemma="casa" & country_parent_code="arg"]
```

**Example 2:** Regional filter
```
Input: q=casa, mode=lemma, country_scope=regional, country_parent_code=ARG, country_region_code=CBA
CQL:   [lemma="casa" & country_scope="regional" & country_parent_code="arg" & country_region_code="cba"]
```

**Example 3:** Speaker filter (pro + female)
```
Input: q=casa, mode=lemma, speaker_type=pro, sex=f
CQL:   [lemma="casa" & speaker_code="(lib-pf|lec-pf|pre-pf|tie-pf|traf-pf)"]
```

**Example 4:** Combined filters
```
Input: q=casa, mode=lemma, country_code=ARG, speaker_type=pro, speech_mode=libre
CQL:   [lemma="casa" & speaker_code="(lib-pm|lib-pf)" & country_parent_code="arg"]
```

### Testing

**Automated Unit Tests** (`test_advanced_search.py`):
- ✅ Basic lemma search
- ✅ National country filter
- ✅ Regional country filter
- ✅ Speaker filters (type, sex, mode, discourse)
- ✅ Combined filters
- ✅ Multiple countries with OR logic

**Manual E2E Tests** (to be performed in browser):
1. Simple search: `/search/advanced?q=casa&mode=lemma`
2. National filter: `/search/advanced?q=casa&mode=lemma&country_code=ARG`
3. Regional filter: `/search/advanced?q=casa&mode=lemma&country_scope=regional&country_parent_code=ARG&country_region_code=CBA`
4. Speaker filter: `/search/advanced?q=casa&mode=lemma&speaker_type=pro&sex=f`
5. Combined: `/search/advanced?q=casa&mode=lemma&country_code=ARG&speaker_type=pro&speech_mode=libre`

### Frontend Template (`templates/search/advanced.html`)

**Status:** ✅ Compatible with new backend (no changes required for basic functionality)

**Current UI elements:**
- País filter → maps to `country_code` → auto-converted to `country_parent_code`
- Hablante filter → `speaker_type`
- Sexo filter → `sex`
- Modo filter → `speech_mode`
- Discurso filter → `discourse`

**Optional future enhancements:**
- Add explicit `country_scope` selector (national/regional toggle)
- Add `country_region_code` dropdown (conditional on parent code)
- Display `country_scope`, `country_region_code` in result metadata
- Add `city` and `radio` filters

---

## 7. Next Steps

### Immediate
1. ✅ JSON→TSV export works for all 146 files
2. ✅ BLF config correctly defines all fields
3. ✅ Index builds successfully (limited by document count)

### For Full Production
1. **Resolve document limit:**
   - Contact BlackLab for license
   - OR split into sub-corpora
   - OR use alternative indexing strategy

2. **Optional enhancements:**
   - Add `pidField` for persistent document IDs
   - External docmeta.jsonl integration
   - Performance tuning for large corpus

3. **Testing:**
   - Test Advanced Search with speaker_* filters
   - Test country/region faceting
   - Verify audio playback integration

---

## 7. Known Issues & Workarounds

### Issue 1: MaxDocsReached ~~(RESOLVED)~~
- **Symptom:** Index build stopped after ~43 documents
- **Cause:** Default max-docs limit in build script
- **Solution:** Added `--max-docs -1` flag to `build_blacklab_index_v3.ps1`
- **Status:** ✅ **Resolved** - All 146 documents now indexed

### Issue 2: Non-Persistent Document IDs
- **Symptom:** Warning about missing pidField
- **Cause:** Intentionally not configured (per minimal-change strategy)
- **Impact:** Document IDs may change on re-indexing
- **Acceptable:** Yes, for current use case without saved searches
- **Solution:** Add `pidField: file_id` if needed in future

---

## 8. Validation Checklist

- [x] All 146 JSON files export to TSV
- [x] TSV schema is consistent across all files
- [x] Speaker fields correctly expanded from codes
- [x] Country/region fields correctly populated
- [x] docmeta.jsonl generated with all metadata
- [x] BLF config parses without errors
- [x] Index build succeeds (within document limit)
- [x] No "wrong format" errors
- [x] No pidField-related crashes
- [x] Full 146-document index (✅ **COMPLETED**)
- [x] Flask backend updated for Mapping v2
- [x] CQL builder supports country_scope, country_parent_code, country_region_code
- [x] Speaker filters functional via speaker_code mapping
- [x] Automated backend tests pass (test_advanced_search.py)
- [ ] Manual E2E browser tests (pending)

---

## Appendix: Speaker Code Mapping

All 16 speaker codes are supported and correctly expanded:

| Code    | Type  | Sex | Mode    | Discourse |
|---------|-------|-----|---------|-----------|
| lib-pm  | pro   | m   | libre   | general   |
| lib-pf  | pro   | f   | libre   | general   |
| lib-om  | otro  | m   | libre   | general   |
| lib-of  | otro  | f   | libre   | general   |
| lec-pm  | pro   | m   | lectura | general   |
| lec-pf  | pro   | f   | lectura | general   |
| lec-om  | otro  | m   | lectura | general   |
| lec-of  | otro  | f   | lectura | general   |
| pre-pm  | pro   | m   | pre     | general   |
| pre-pf  | pro   | f   | pre     | general   |
| tie-pm  | pro   | m   | n/a     | tiempo    |
| tie-pf  | pro   | f   | n/a     | tiempo    |
| traf-pm | pro   | m   | n/a     | tránsito  |
| traf-pf | pro   | f   | n/a     | tránsito  |
| foreign | n/a   | n/a | n/a     | foreign   |
| none    | (empty) | (empty) | (empty) | (empty) |

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-16  
**Author:** GitHub Copilot / Felix Tacke
