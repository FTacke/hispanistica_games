# Test Scripts Cleanup Plan

## Current Status

The repository root contains many ad-hoc test scripts that should be organized into a cleaner structure.

## Inventory

### Repository Root Test/Debug Scripts

**Test Scripts (to move to tests/):**
- `test_advanced_api_enrichment.py` - Tests API enrichment logic
- `test_advanced_api_live_counts.py` - Tests live count functionality
- `test_advanced_api_quick.py` - Quick API tests
- `test_blacklab_hit_mapping.py` - Tests hit mapping logic
- `test_bls_direct.py` - Direct BlackLab tests
- `test_bls_structure.py` - BlackLab structure tests
- `test_corpus_search_tokens.py` - Corpus search tests
- `test_cql_build.py` - CQL builder tests
- `test_cql_country_constraint.py` - CQL country constraint tests
- `test_cql_crash.py` - CQL crash tests
- `test_cql_validator.py` - CQL validator tests
- `test_docmeta_lookup.py` - Document metadata lookup tests
- `test_include_regional_logic.py` - Regional filter logic tests

**Debug/Helper Scripts (to move to scripts/debug/):**
- `debug_api_mapping.py` - Debug script for API mapping
- `check_db.py` - Database check utility

**Build/Export Scripts (keep in root or move to scripts/):**
- `build_index_test.ps1` - Test script for index building (should be in scripts/)
- `build_index_wrapper.ps1` - Build index wrapper (should be in scripts/)
- `run_export.py` - Export runner (should be in scripts/)

**PowerShell Test Scripts:**
- `test_docmeta_integration.ps1` - Document metadata integration test (move to tests/)

### Scripts Directory Test Files

These are already in scripts/ but could be reorganized:
- `scripts/test_proxy.py`
- `scripts/test_advanced_api_live_counts.py` (duplicate of root version?)
- `scripts/test_advanced_ui_smoke.py`
- `scripts/test_advanced_search_live.py`
- `scripts/test_advanced_search.py`
- `scripts/test_advanced_search_real.py`
- `scripts/test_mock_bls_direct.py`
- `scripts/test_advanced_hardening.py`

**Validated/Production Scripts (keep in scripts/):**
- `scripts/check_tsv_schema.py` - Referenced in blacklab_stack.md
- `scripts/build_blacklab_index*.ps1` - Production scripts
- `scripts/start_blacklab_docker*.ps1` - Production scripts

## Proposed Structure

```
corapan-webapp/
├── tests/                      # All pytest-compatible tests
│   ├── __init__.py
│   ├── README.md
│   ├── test_advanced_datatables_results.py  # New comprehensive tests
│   ├── test_advanced_api_enrichment.py      # Moved from root
│   ├── test_advanced_api_live_counts.py     # Moved from root
│   ├── test_advanced_api_quick.py           # Moved from root
│   ├── test_blacklab_hit_mapping.py         # Moved from root
│   ├── test_bls_direct.py                   # Moved from root
│   ├── test_bls_structure.py                # Moved from root
│   ├── test_corpus_search_tokens.py         # Moved from root
│   ├── test_cql_build.py                    # Moved from root
│   ├── test_cql_country_constraint.py       # Moved from root
│   ├── test_cql_crash.py                    # Moved from root
│   ├── test_cql_validator.py                # Moved from root
│   ├── test_docmeta_lookup.py               # Moved from root
│   └── test_include_regional_logic.py       # Moved from root
│
├── scripts/                    # Production & maintenance scripts
│   ├── README.md               # Document script purposes
│   ├── blacklab/build_blacklab_index.ps1           # Production (keep)
│   ├── build_blacklab_index_v3.ps1        # Production (keep)
│   ├── start_blacklab_docker_v3.ps1       # Production (keep)
│   ├── blacklab/start_blacklab_docker.ps1          # Production (keep)
│   ├── check_tsv_schema.py                # Validation tool (keep)
│   ├── build_index_wrapper.ps1            # Moved from root
│   ├── run_export.py                      # Moved from root
│   │
│   ├── debug/                  # Debug/troubleshooting scripts
│   │   ├── README.md
│   │   ├── debug_api_mapping.py           # Moved from root
│   │   ├── debug_blacklab_ven_index.ps1   # Referenced in docs
│   │   ├── check_db.py                    # Moved from root
│   │   └── build_index_test.ps1           # Moved from root
│   │
│   └── testing/                # Ad-hoc test scripts (not pytest)
│       ├── README.md
│       ├── test_proxy.py
│       ├── test_advanced_ui_smoke.py
│       ├── test_advanced_search_live.py
│       ├── test_advanced_search.py
│       ├── test_advanced_search_real.py
│       ├── test_mock_bls_direct.py
│       ├── test_advanced_hardening.py
│       └── test_docmeta_integration.ps1   # Moved from root
│
└── tools/                      # Third-party tools (BlackLab JARs)
    └── blacklab/               # Keep as-is
```

## Implementation Plan

### Phase 1: Move Root Tests to tests/
1. Move all `test_*.py` from root to `tests/`
2. Update imports if needed (sys.path adjustments)
3. Update any documentation references

### Phase 2: Organize scripts/
1. Create `scripts/debug/` subdirectory
2. Move debug scripts from root to `scripts/debug/`
3. Create `scripts/testing/` subdirectory
4. Keep existing test scripts in `scripts/testing/`
5. Move production-related scripts from root to `scripts/`

### Phase 3: Documentation
1. Create `scripts/README.md` explaining structure
2. Create `scripts/debug/README.md` for debug tools
3. Create `scripts/testing/README.md` for ad-hoc tests
4. Update references in `docs/blacklab_stack.md`
5. Update any other docs with script references

### Phase 4: Cleanup
1. Remove duplicates (e.g., `test_advanced_api_live_counts.py` in both root and scripts/)
2. Verify no broken references
3. Test that production scripts still work

## Benefits

1. **Clear separation**: Production scripts, debug tools, tests
2. **Discoverable**: New developers can find relevant scripts easily
3. **Maintainable**: Less clutter in repository root
4. **Documented**: Each directory has README explaining contents
5. **CI-friendly**: All pytest tests in one place (`tests/`)

## Script Purpose Reference

### Production Scripts (scripts/)
- `build_blacklab_index*.ps1` - Build BlackLab index from TSV exports
- `start_blacklab_docker*.ps1` - Start BlackLab Docker containers
- `check_tsv_schema.py` - Validate TSV schema consistency
- `run_export.py` - Run JSON to TSV export pipeline
- `build_index_wrapper.ps1` - Wrapper for index building

### Debug Scripts (scripts/debug/)
- `debug_api_mapping.py` - Debug API field mapping issues
- `check_db.py` - Check database structure/content
- `build_index_test.ps1` - Test index building with small subset
- `debug_blacklab_ven_index.ps1` - Debug VEN-specific index issues

### Ad-hoc Test Scripts (scripts/testing/)
- Live testing scripts for manual validation
- UI smoke tests
- Integration tests not suitable for pytest
- PowerShell integration tests

### Pytest Tests (tests/)
- Automated integration tests
- Unit tests
- Tests that can run in CI
- Tests that skip gracefully without BlackLab
