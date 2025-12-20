# Scripts Directory

This directory contains production scripts, maintenance tools, debug utilities, and ad-hoc test scripts for the CO.RA.PAN project.

## Directory Structure

```
scripts/
├── README.md                           # This file
├── build_blacklab_index.ps1            # Canonical BlackLab index builder (production)
├── build_blacklab_index_v3.ps1         # Docker-based index builder (v5.x)
├── build_blacklab_index.old.ps1        # Legacy index builder (deprecated)
├── start_blacklab_docker_v3.ps1        # Start BlackLab Docker server (v5.x)
├── start_blacklab_docker.ps1           # Start BlackLab Docker server (v4.x)
├── check_tsv_schema.py                 # Validate TSV schema consistency
├── build_index_wrapper.ps1             # Wrapper for index building
├── run_export.py                       # Run JSON to TSV export pipeline
│
├── debug/                              # Debug and troubleshooting tools
│   ├── README.md
│   ├── debug_api_mapping.py            # Debug API field mapping
│   ├── check_db.py                     # Database check utility
│   └── build_index_test.ps1            # Test index building with subset
│
└── testing/                            # Ad-hoc test scripts (not pytest)
    ├── README.md
    ├── test_proxy.py                   # Test BLS proxy
    ├── test_advanced_*.py              # Advanced search test scripts
    ├── test_auth_*.py/sh               # Auth flow tests
    ├── test_docmeta_integration.ps1    # Document metadata integration test
    └── ...
```

## Production Scripts

### BlackLab Index Management

- **`build_blacklab_index.ps1`** - Canonical index builder
  - Builds BlackLab index from TSV exports
  - Uses Docker-based IndexTool
  - Documented in `docs/blacklab_stack.md`
  - Default: `--threads 1` to avoid concurrency issues

- **`build_blacklab_index_v3.ps1`** - Docker-based builder (v5.x)
  - Uses BlackLab 5.x Docker image
  - Mounts TSV directory and outputs index
  
- **`start_blacklab_docker_v3.ps1`** - Start BlackLab server (v5.x)
  - Starts pinned Docker image with proper mounts
  - Default port: 8081

### Validation & Export

- **`check_tsv_schema.py`** - TSV Schema Validator
  - Validates that all TSV files have consistent headers
  - Detects structural differences across export files
  - Usage: `python scripts/check_tsv_schema.py`

- **`run_export.py`** - JSON to TSV Export Runner
  - Runs the export pipeline from `media/transcripts/` to TSV
  - Calls `src/scripts/blacklab_index_creation.py`

- **`build_index_wrapper.ps1`** - Build Wrapper
  - Wrapper script for index building workflows

## Debug Tools

See `debug/README.md` for debug and troubleshooting utilities.

## Testing Scripts

See `testing/README.md` for ad-hoc test scripts and integration tests.

## Related Documentation

- `docs/blacklab_stack.md` - BlackLab infrastructure and workflow
- `docs/how-to/build-blacklab-index.md` - Step-by-step index building guide
- `tests/README.md` - Automated pytest tests

## Usage Examples

### Build BlackLab Index

```powershell
# Run canonical index builder
.\scripts\build_blacklab_index.ps1

# Force rebuild without prompts
.\scripts\build_blacklab_index.ps1 -Force
```

### Start BlackLab Server

```powershell
# Start in foreground
.\scripts\start_blacklab_docker_v3.ps1

# Start detached (background)
.\scripts\start_blacklab_docker_v3.ps1 -Detach
```

### Validate TSV Schema

```bash
python scripts/check_tsv_schema.py
```

### Run Export Pipeline

```bash
python scripts/run_export.py
```

## Notes

- **Production scripts** are referenced in official documentation and should be stable
- **Debug scripts** are for troubleshooting and may be ad-hoc
- **Testing scripts** are for manual validation and may not be pytest-compatible
- **Deprecated scripts** (e.g., `build_blacklab_index.old.ps1`) are kept for reference but should not be used

## Adding New Scripts

When adding new scripts:

1. **Production scripts**: Add to `scripts/` root with clear naming
2. **Debug tools**: Add to `scripts/debug/`
3. **Test scripts**: Add to `scripts/testing/` or `tests/` (for pytest)
4. **Document**: Update this README and relevant docs
5. **Comment**: Add header comment explaining purpose and usage
