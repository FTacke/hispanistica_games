# Import Logs

This directory contains detailed logs from content import operations.

## Purpose

- Track import executions (success/failure)
- Debug import issues
- Audit content changes

## Log File Format

```
import_<timestamp>.log
```

Example:
```
import_2026-01-06_143045.log
```

## Log Contents

Each log contains:
- Import start/end timestamps
- Release ID being imported
- Number of units/audio files processed
- Validation results
- Database operations (UPSERT)
- Errors/warnings
- Summary statistics

## Retention

- Logs are kept indefinitely by default
- Manual cleanup recommended (keep last 50-100 logs)
- No automatic rotation/deletion

## Example Log Entry

```
[2026-01-06 14:30:45] INFO: Starting import for release '2026-01-06_1430'
[2026-01-06 14:30:45] INFO: Found 12 JSON files in media/current/units
[2026-01-06 14:30:46] INFO: Validating unit_a1_ser_estar.json
[2026-01-06 14:30:46] INFO: Unit 'a1_ser_estar' validated successfully
[2026-01-06 14:30:47] INFO: Audio file intro_ser_estar.mp3 (SHA256: abc123...)
[2026-01-06 14:30:48] INFO: Unit 'a1_ser_estar' imported as draft
[2026-01-06 14:31:20] INFO: Import completed: 12 units, 45 audio files
[2026-01-06 14:31:20] INFO: No errors
```

## Production vs DEV

- **Production:** Logs written by `./manage import-content` CLI
- **DEV:** No import logs (uses `quiz_seed.py` which has different logging)

## See Also

- [games_hispanistica_production.md](../../games_hispanistica_production.md) - Production documentation
- [manage.py](../../manage.py) - CLI import commands
