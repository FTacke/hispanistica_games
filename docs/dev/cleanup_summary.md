# Repository Cleanup Summary

**Date:** November 16, 2025  
**Branch:** copilot/organize-repo-structure

## Overview

This document summarizes the cleanup and reorganization of the corapan-webapp repository. The goal was to move test scripts, debug files, and documentation from the repository root into proper subdirectories, maintaining a clean and organized project structure.

## What Was Done

### 1. Root Directory Cleanup

The following files were removed from the repository root:

#### Test Files Moved
- `test_advanced_search.py` → `tests/test_advanced_search.py`

#### Documentation Moved
- `TEST_REGIONAL_CHECKBOX.md` → `docs/ADVANCED SEARCH/TEST_REGIONAL_CHECKBOX.md`

#### Test Data/Resources Moved
- `test_bls_raw.json` → `tests/resources/test_bls_raw.json`
- `test_corpus_info.json` → `tests/resources/test_corpus_info.json`
- `test_flask_bls.json` → `tests/resources/test_flask_bls.json`
- `test_full_hit.json` → `tests/resources/test_full_hit.json`
- `response_example.json` → `tests/resources/response_example.json`
- `corpus_schema_real.json` → `tests/resources/corpus_schema_real.json`

#### Files Deleted (Logs and Temporary Files)
- `test_contentstore.txt` (empty file)
- `blacklab_logs.txt` (log file)
- `export_log.txt` (log file)
- `export_results.txt` (empty log file)
- `flask_log.txt` (log file)
- `corpus_info.txt` (temporary data)
- `COMMIT_MESSAGE_STAGE3.txt` (temporary commit message)

### 2. Scripts Directory Reorganization

#### Created Directories
- `scripts/debug/` - For debug and troubleshooting scripts
- `scripts/testing/` - Already existed, organized ad-hoc test scripts

#### Temporary Debug Scripts Moved
All `_tmp_*.py` files moved from `scripts/` to `scripts/debug/`:
- `_tmp_bls_direct_probe.py`
- `_tmp_bls_probe.py`
- `_tmp_corpus_search_probe.py`
- `_tmp_debug_cql.py`
- `_tmp_env_check.py`
- `_tmp_proxy_probe.py`
- `_tmp_search_blacklab_probe.py`

#### Debug Scripts Moved
- `debug_blacklab_ven_index.ps1` → `scripts/debug/`

#### Test Scripts Moved to scripts/testing/
- `live_tests.py`
- `quick_tests.py`
- `smoke_tests.py`
- `test_auth_curl.sh`
- `mock_bls_server.py`
- `simulate_index_build.py`
- `verify_stage_2_3.py`
- `sanity-check-advanced.js`

### 3. Configuration Updates

#### .gitignore Enhancements
Added explicit patterns to ignore temporary files:
```gitignore
_tmp_*
*.scratch.*
```

These patterns complement existing ignore rules for:
- `*.log` files
- `__pycache__/` directories
- `.pytest_cache/` directories
- Build artifacts

## Current Repository Structure

### Root Directory (Clean)
The root now contains only essential project files:
- Configuration: `.gitignore`, `pyproject.toml`, `requirements.txt`, `docker-compose.yml`, `Dockerfile`
- Documentation: `README.md`
- Build/Deploy: `Makefile`, `backup.sh`, `update.sh`
- Template: `passwords.env.template`
- Source directories: `src/`, `tests/`, `docs/`, `scripts/`, `static/`, `templates/`, `config/`, `data/`, `media/`, `tools/`, `ops/`, `opt/`

### Tests Directory Structure
```
tests/
├── __init__.py
├── README.md
├── resources/              # NEW: Test data and example files
│   ├── test_bls_raw.json
│   ├── test_corpus_info.json
│   ├── test_flask_bls.json
│   ├── test_full_hit.json
│   ├── response_example.json
│   └── corpus_schema_real.json
├── test_advanced_search.py  # MOVED from root
├── test_advanced_api_enrichment.py
├── test_advanced_api_live_counts.py
├── test_advanced_api_quick.py
├── test_advanced_datatables_results.py
├── test_blacklab_hit_mapping.py
├── test_bls_direct.py
├── test_bls_structure.py
├── test_corpus_search_tokens.py
├── test_cql_build.py
├── test_cql_country_constraint.py
├── test_cql_crash.py
├── test_cql_validator.py
├── test_docmeta_lookup.py
└── test_include_regional_logic.py
```

### Scripts Directory Structure
```
scripts/
├── README.md
├── debug/                      # Debug and troubleshooting scripts
│   ├── README.md
│   ├── _tmp_*.py (7 files)    # Temporary probe scripts
│   ├── build_index_test.ps1
│   ├── check_db.py
│   ├── debug_api_mapping.py
│   └── debug_blacklab_ven_index.ps1
├── testing/                    # Ad-hoc testing scripts (not pytest)
│   ├── README.md
│   ├── live_tests.py
│   ├── mock_bls_server.py
│   ├── quick_tests.py
│   ├── sanity-check-advanced.js
│   ├── simulate_index_build.py
│   ├── smoke_tests.py
│   ├── test_advanced_api_live_counts.py
│   ├── test_advanced_hardening.py
│   ├── test_advanced_search.py
│   ├── test_advanced_search_live.py
│   ├── test_advanced_search_real.py
│   ├── test_advanced_ui_smoke.py
│   ├── test_auth_curl.sh
│   ├── test_auth_flow_simple.py
│   ├── test_docmeta_integration.ps1
│   ├── test_mock_bls_direct.py
│   ├── test_proxy.py
│   └── verify_stage_2_3.py
├── advanced-search-preflight.sh
├── build_blacklab_index.old.ps1
├── blacklab/build_blacklab_index.ps1
├── blacklab/build_blacklab_index.sh
├── build_blacklab_index_v3.ps1
├── build_index_wrapper.ps1
├── check_normalized_transcripts.py
├── check_tsv_schema.py
├── deploy_checklist.sh
├── fix_emoji.py
├── normalize_transcripts.py
├── blacklab/run_bls.sh
├── blacklab/run_export.py
├── blacklab/start_blacklab_docker.ps1
├── blacklab/start_blacklab_docker_v3.ps1
├── blacklab/start_blacklab_windows.ps1
├── start_dev_windows.ps1
├── start_waitress.py
└── blacklab/stop_blacklab_docker.ps1
```

### Documentation Structure
```
docs/
├── ADVANCED SEARCH/
│   ├── TEST_REGIONAL_CHECKBOX.md  # MOVED from root
│   └── ...other advanced search docs
├── dev/
│   └── cleanup_summary.md  # THIS FILE
└── ...other documentation directories
```

## Impact Assessment

### No Breaking Changes
- All test files maintain their original import paths (imports from `src.app.*` work from both root and tests/ directory)
- Production scripts remain in their original locations
- Application structure unchanged - only file organization improved

### Testing
- pytest can discover tests in the `tests/` directory
- Test imports work correctly (verified with pytest collection)
- Tests require Flask dependencies which are defined in requirements.txt

### Benefits
1. **Clean Root Directory**: Only essential project files in root
2. **Better Organization**: Clear separation between:
   - Production scripts (`scripts/*.py`, `scripts/*.sh`, `scripts/*.ps1`)
   - Debug tools (`scripts/debug/`)
   - Test scripts (`scripts/testing/`)
   - Automated tests (`tests/`)
3. **Improved Discoverability**: New developers can easily find:
   - Where to add tests (`tests/`)
   - Where debug scripts live (`scripts/debug/`)
   - Where test data is stored (`tests/resources/`)
4. **Maintainability**: Less clutter, clearer purpose for each directory
5. **CI-Friendly**: All pytest tests in one standard location

## Recommendations

### For Future Development

1. **Test Files**: Add new pytest tests to `tests/` directory
2. **Test Data**: Store test data and examples in `tests/resources/`
3. **Debug Scripts**: Temporary debug/probe scripts go in `scripts/debug/`
4. **Ad-hoc Tests**: Manual testing scripts go in `scripts/testing/`
5. **Production Scripts**: Automation and deployment scripts stay in `scripts/` root
6. **Temporary Files**: Use `_tmp_*` prefix or `*.scratch.*` pattern - these are now gitignored

### Cleanup Best Practices

1. Delete log files immediately - don't commit them
2. Use meaningful names for test data files
3. Document the purpose of scripts in comments or README files
4. Keep the root directory minimal
5. Use .gitignore patterns to prevent temporary files from being committed

## Files That Should Remain in Root

According to the repository's .gitignore documentation, these file types should stay in root:

### Build & Deployment
- `.dockerignore`, `docker-compose.yml`, `Dockerfile`
- `update.sh`, `backup.sh`, `Makefile`
- `requirements.txt`, `pyproject.toml`

### Configuration
- `.gitignore`, `.gitattributes`
- `passwords.env.template`

### Documentation
- `README.md`

### Source Structure
- `src/`, `templates/`, `static/`, `config/`, `scripts/`, `tests/`, `docs/`, `tools/`, `ops/`, `opt/`
- `data/` and `media/` (with `.gitkeep` only, actual content is ignored)

## Verification Checklist

- [x] Root directory contains only essential files
- [x] Test files moved to `tests/` directory
- [x] Test data moved to `tests/resources/`
- [x] Debug scripts organized in `scripts/debug/`
- [x] Test scripts organized in `scripts/testing/`
- [x] Documentation moved to appropriate `docs/` subdirectory
- [x] Temporary and log files deleted
- [x] .gitignore updated to prevent future clutter
- [x] Import paths verified (pytest can collect tests)
- [x] Cleanup summary documented

## Conclusion

The repository has been successfully reorganized. The root directory is now clean and contains only essential project files. Tests, debug scripts, and documentation have been moved to appropriate subdirectories, making the repository more maintainable and easier to navigate.

All changes were made conservatively - only clearly identifiable temporary, debug, and log files were deleted. Everything else was moved to appropriate locations where it can still be referenced if needed.
