# Audio Snippet Naming Convention

## Overview

Audio snippets generated from corpus search results now use a token-ID-based naming convention instead of hash-based names. This makes snippets **unique, predictable, and cacheable**.

## New Naming Convention

### Format

```
corapan_{token_id}.mp3          # Palabra/Resultado (no context)
corapan_{token_id}_contexto.mp3 # Contexto (with surrounding context)
```

### Examples

**Token ID:** `ARG_pro_m_pre_general_001_00042`

- **Palabra (Result):** `corapan_ARG_pro_m_pre_general_001_00042.mp3`
- **Contexto (Context):** `corapan_ARG_pro_m_pre_general_001_00042_contexto.mp3`

## Implementation Details

### Backend (`src/app/services/audio_snippets.py`)

The `_cache_filename()` function generates filenames based on:
- `token_id`: Unique identifier for the result token
- `snippet_type`: Either `"pal"` (palabra) or `"ctx"` (contexto)

**Logic:**
```python
if snippet_type == "ctx":
    return f"corapan_{token_id}_contexto.mp3"
else:
    return f"corapan_{token_id}.mp3"
```

### Frontend (`static/js/modules/corpus/audio.js`)

The audio manager:
1. Extracts `token_id` and `data-type` from button attributes
2. Passes them to the backend via query parameters:
   - `token_id`: The unique token identifier
   - `type`: Either `"pal"` or `"ctx"`

**Query String Example:**
```
/media/play_audio/2023-08-10_ARG_Mitre.mp3?start=10.5&end=12.3&token_id=ARG_pro_m_pre_general_001_00042&type=pal
```

### Backend Request Handling (`src/app/routes/media.py`)

The `/play_audio/<filename>` endpoint:
1. Receives `token_id` and `type` parameters
2. Passes them to `audio_snippets.build_snippet()`
3. Returns the cached file if it exists or creates a new one

## Fallback Behavior

If `token_id` or `snippet_type` is missing (legacy requests), the system falls back to **hash-based naming**:

```
snippet_{sha256_hash}.mp3
```

This ensures backward compatibility with older requests that don't include token information.

## Storage

Audio snippets are cached in:
```
media/mp3-temp/
```

The files are automatically cleaned up after **30 minutes** of inactivity to save disk space.

## Benefits

✅ **Unique Identification:** Each snippet is uniquely identified by its token_id
✅ **Predictable Names:** Snippet filename can be predicted without creation
✅ **Caching Friendly:** Same snippet requested twice = same filename = instant cache hit
✅ **User-Friendly:** Semantic naming helps debugging and monitoring
✅ **Distinguishable:** Can easily tell if a snippet is context or palabra by the filename

## Migration Notes

- **Old snippets:** Hash-based names (`snippet_*.mp3`) remain in cache but are cleaned up automatically
- **New snippets:** Generated with the new naming convention
- **Requests without token_id:** Continue to use hash-based fallback

## Related Files

- `src/app/services/audio_snippets.py` - Cache filename generation
- `src/app/routes/media.py` - HTTP endpoint handling
- `static/js/modules/corpus/audio.js` - Frontend audio playback
- `static/js/modules/corpus/datatables.js` - HTML rendering of audio buttons
