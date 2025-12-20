---
title: "Advanced Export Streaming Specification"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [export, streaming, api-reference, performance]
links:
  - cql-escaping-rules.md
  - ../operations/rate-limiting-strategy.md
  - ../operations/advanced-search-monitoring.md
  - ../concepts/advanced-search-architecture.md
---

# Advanced Export Streaming Specification

**Purpose**: API reference for Advanced Search export endpoint (CSV/TSV)  
**Version**: 1.0  
**Last Updated**: 10. November 2025  
**Status**: Production Ready

---

## Overview

The Advanced Search export endpoint provides efficient, streaming downloads of search results in CSV or TSV format. The streaming approach ensures memory-efficient handling of large result sets (100K+ rows).

**Key Features**:
- ✅ Memory-efficient streaming (no buffering)
- ✅ 1000-row chunks
- ✅ UTF-8 BOM for Excel compatibility
- ✅ Client-disconnect detection
- ✅ Separate rate limiting (6/min)
- ✅ Comprehensive logging
- ✅ Secure MIME-type handling

---

## Endpoint Specification

### Route

```
GET /search/advanced/export
```

### Rate Limiting

```
6 requests per minute per IP
```

**Exceeding Limit**:
```
HTTP 429 Too Many Requests
Retry-After: 60

{
  "error": "rate_limit_exceeded",
  "message": "Export limit exceeded. Max 6 exports per minute.",
  "retry_after_seconds": 45
}
```

---

## Request Parameters

### Required Parameters

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `q` | string | `palabra` | Search query (CQL or simple) |
| `mode` | string | `forma` | Search mode: forma, forma_exacta, lemma |

### Optional Parameters

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `format` | string | `csv` | Export format: csv (default) or tsv |
| `include_regional` | string | `on` | Include regional variants (on/off) |
| `country_code` | string[] | `ARG,CHI` | Filter by country (multiple allowed) |
| `speaker_type` | string[] | `F,H,O` | Filter by speaker type |
| `sex` | string[] | `M,F` | Filter by speaker sex |
| `speech_mode` | string[] | `c,i` | Filter by speech mode |
| `discourse` | string[] | `narración,diálogo` | Filter by discourse type |
| `sensitive` | string | `on` | Case-sensitive search (on/off) |
| `pos` | string | `N,V` | Part-of-speech filter |

### Query Examples

**Basic CSV Export**:
```
GET /search/advanced/export?q=palabra&mode=forma&format=csv
```

**TSV with Filters**:
```
GET /search/advanced/export?q=habla&mode=forma&format=tsv&country_code=ARG&country_code=MEX&speaker_type=H
```

**Advanced with Multiple Filters**:
```
GET /search/advanced/export?q=palabra&mode=lemma&format=csv&country_code=URY&sex=F&discourse=narración&include_regional=on
```

---

## Response Format

### HTTP Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Type` | `text/csv; charset=utf-8` | MIME type for CSV |
| | `text/tab-separated-values; charset=utf-8` | MIME type for TSV |
| `Content-Disposition` | `attachment; filename="corapan-export_20251110_143022.csv"` | Download filename + timestamp |
| `Cache-Control` | `no-store` | Prevent caching |
| `Content-Encoding` | `utf-8` | Character encoding |
| `Transfer-Encoding` | `chunked` | Streaming (no Content-Length) |

**Example Response Headers**:
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="corapan-export_20251110_143022.csv"
Cache-Control: no-store
Transfer-Encoding: chunked
```

### Body Format: CSV

```csv
﻿left,match,right,filename,speaker,sex,country,discourse,speech_mode,date_year,hits
los,palabra,clave,RES_0001.txt,SH01,M,ARG,narración,conversacional,2015,5
en,palabra,de,RES_0002.txt,JM02,F,MEX,diálogo,formal,2016,3
con,palabra,importante,RES_0003.txt,LA03,M,URY,narrativo,coloquial,2017,2
```

**Row 1**: Header (column names)  
**Row 2+**: Data rows (one per match)

### Body Format: TSV

Same structure as CSV, but columns separated by tabs (`\t`) instead of commas.

```tsv
﻿left	match	right	filename	speaker	sex	country	discourse	speech_mode	date_year	hits
los	palabra	clave	RES_0001.txt	SH01	M	ARG	narración	conversacional	2015	5
en	palabra	de	RES_0002.txt	JM02	F	MEX	diálogo	formal	2016	3
```

### Row Count Details

**Formula**:
```
Total rows in file = 1 (header) + N (data rows)
```

**Consistency Rule**:
```
Data rows = numberOfHits (from BlackLab search)
```

**Example**:
```
Search query: palabra
Number of hits: 1,024
Expected export rows: 1 (header) + 1,024 (data) = 1,025 total lines
```

**Verification** (in `test_advanced_hardening.py`):
```python
def test_export_line_count():
    # Get numberOfHits from /data endpoint
    response_data = requests.get('/search/advanced/data?q=palabra&mode=forma')
    number_of_hits = response_data.json()['recordsTotal']
    
    # Get export
    response_export = requests.get('/search/advanced/export?q=palabra&mode=forma&format=csv')
    lines = response_export.text.strip().split('\n')
    
    # Verify: total lines = numberOfHits + 1 (header)
    assert len(lines) == number_of_hits + 1
```

---

## UTF-8 BOM (Byte Order Mark)

### What is BOM?

**BOM** = First 3 bytes in UTF-8 file: `EF BB BF` (hexadecimal)

**Purpose**: Signal to Excel/Calc that file is UTF-8, not system default (often Windows-1252)

### Why Include?

**Problem**: Excel opens CSV as system default encoding (Windows-1252 on Windows)
```
Input:  "corazón"
Without BOM:  "corazon"  (ó lost!)
With BOM:     "corazón"  (✓ correct)
```

**Solution**: Include UTF-8 BOM as first character

```python
# Python code (line 1 of CSV)
yield "\ufeff"  # UTF-8 BOM character

# Hexadecimal output
EF BB BF 6C 65 66 74 2C ...
^^^        (BOM)
```

### Implementation

**Flask Response**:
```python
def generate_csv():
    # Yield BOM first (Excel will recognize UTF-8)
    yield "\ufeff"
    
    # Then yield CSV header and rows
    yield "left,match,right,...\n"
    for row in get_results():
        yield f"{row['left']},{row['match']},...\n"

@bp.route("/export", methods=["GET"])
def export_data():
    return Response(
        generate_csv(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="export.csv"'}
    )
```

---

## Streaming Implementation

### Chunking Strategy

**Chunk Size**: 1,000 rows per chunk

**Reason**: 
- Balance between memory (small chunks) and overhead (too many chunks)
- ~1,000 rows = ~50KB typically
- No bottleneck even for 100K+ result sets

**Python Implementation**:
```python
def generate_export():
    chunk_rows = []
    chunk_size = 1000
    
    for row in get_all_results():
        chunk_rows.append(row)
        
        if len(chunk_rows) >= chunk_size:
            # Flush chunk
            buffer = io.StringIO()
            writer = csv.DictWriter(buffer, fieldnames=COLUMNS)
            for chunk_row in chunk_rows:
                writer.writerow(chunk_row)
            
            yield buffer.getvalue()
            chunk_rows = []
    
    # Flush final chunk
    if chunk_rows:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=COLUMNS)
        for chunk_row in chunk_rows:
            writer.writerow(chunk_row)
        yield buffer.getvalue()
```

### Client-Disconnect Handling

**Problem**: User closes browser mid-download; server keeps processing

**Solution**: Catch `GeneratorExit` exception

```python
def generate_export():
    try:
        total_exported = 0
        for row in get_all_results():
            yield format_row(row)
            total_exported += 1
    
    except GeneratorExit:
        # Client disconnected - log and stop
        logger.warning(f"Export aborted by client after {total_exported} lines")
        raise
    
    finally:
        # Always log completion
        logger.info(f"Export completed: {total_exported} lines")
```

**Logging Output**:
```
INFO Export: 5,000 lines in 2.3s
WARNING Export aborted by client after 2,156 lines
```

---

## Error Handling

### CQL Validation Error

**Request**:
```
GET /search/advanced/export?q=palabra);DROP&mode=forma
```

**Response**:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_cql",
  "message": "Invalid CQL: SQL comment injection detected"
}
```

### Filter Validation Error

**Request**:
```
GET /search/advanced/export?q=palabra&country_code=INVALID
```

**Response**:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_filter",
  "message": "Invalid country code: INVALID"
}
```

### Rate Limit Exceeded

**Request** (7th request in 1 minute):
```
GET /search/advanced/export?q=palabra&mode=forma
```

**Response**:
```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "rate_limit_exceeded",
  "message": "Export limit exceeded (6 per minute)"
}
```

### No Results

**Request**:
```
GET /search/advanced/export?q=xyznonexistent&mode=forma
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8

﻿left,match,right,filename,speaker,sex,country,discourse,speech_mode,date_year,hits
(no data rows - only header)
```

**Note**: Status 200 (not error), but 0 data rows

---

## Performance Metrics

### Baseline Performance

| Result Count | Expected Duration | Memory Peak |
|---|---|---|
| 100 rows | <100ms | <5MB |
| 1,000 rows | 200-300ms | <10MB |
| 10,000 rows | 1-2s | <15MB |
| 100,000 rows | 10-15s | <20MB |

**Streaming ensures memory stays constant** (even for 100K rows)

### Logging Output

```
INFO  [search.advanced_api] Export: 1000 hits in 245ms
INFO  [search.advanced_api] Export: 512 lines in 1.2s
WARNING [search.advanced_api] Export aborted by client after 250 lines
```

### Metrics Tracked

| Metric | Example | Purpose |
|--------|---------|---------|
| `hits` | 1000 | Total number of search hits |
| `export_duration` | 2.3s | Time to generate entire export |
| `export_lines` | 512 | Total rows exported (data + header) |
| `client_disconnect` | After 250 lines | Early termination detection |

---

## Example Workflows

### Scenario 1: Export 10K results to CSV

**User Action**: Click "Exportar a CSV"

**HTTP Request**:
```
GET /search/advanced/export?q=palabra&mode=forma&format=csv
```

**Server Processing**:
1. Validate CQL: `palabra` ✅
2. Query BlackLab: 10,000 hits found
3. Log: `INFO Export started: 10,000 hits expected`
4. Stream CSV with BOM + 1000-row chunks
5. Log: `INFO Export: 10,000 lines in 4.5s`

**Browser Result**:
- Download starts immediately (no delay)
- File: `corapan-export_20251110_143022.csv` (50-60 MB typically)
- Opens in Excel with correct encoding ✅

### Scenario 2: User aborts export at 30%

**User Action**: Click "Download" → Wait 5 seconds → Close browser tab

**Server Processing**:
1. Generate 3,000+ rows (30% of 10,000)
2. Detect client disconnect
3. Catch `GeneratorExit` exception
4. Log: `WARNING Export aborted by client after 3,142 lines`
5. Stop processing
6. Release memory

**Result**: No wasted resources, clean error handling ✅

### Scenario 3: Suspicious CQL pattern

**User Action**: Click "Exportar" with malicious search

**HTTP Request**:
```
GET /search/advanced/export?q=palabra;DROP%20TABLE&mode=forma
```

**Server Processing**:
1. Validate CQL: `palabra;DROP TABLE`
2. Detect suspicious pattern: `;DROP`
3. Return 400 error immediately (no query execution)
4. Log: `WARNING CQL validation failed: SQL injection detected`

**HTTP Response**:
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "invalid_cql",
  "message": "Invalid CQL: SQL comment injection detected"
}
```

**Result**: Attack prevented, user sees error message ✅

---

## Testing Export Streaming

### Test Suite: `scripts/test_advanced_hardening.py`

**Test 1: Export Line Count Consistency**

```python
def test_export_line_count():
    """Verify CSV row count = numberOfHits + 1 (header)."""
    
    # Get hit count from /data
    response_data = requests.get('/search/advanced/data?q=palabra&mode=forma')
    number_of_hits = response_data.json()['recordsTotal']
    
    # Export to CSV
    response = requests.get('/search/advanced/export?q=palabra&mode=forma&format=csv')
    
    # Verify
    assert response.status_code == 200
    assert 'corapan-export' in response.headers.get('Content-Disposition', '')
    assert response.headers.get('Cache-Control') == 'no-store'
    
    lines = response.text.strip().split('\n')
    assert len(lines) == number_of_hits + 1  # +1 for header
    assert lines[0].startswith('\ufeff')  # BOM check
```

**Run**: `python scripts/test_advanced_hardening.py`  
**Expected**: Test 1 PASSES ✅

### Manual Testing: Export Download

1. Open: http://localhost:5000/search/advanced
2. Enter query: `palabra`
3. Click: "Exportar CSV"
4. Verify:
   - ✅ Download starts immediately
   - ✅ File: `corapan-export_*.csv` with timestamp
   - ✅ File opens in Excel correctly
   - ✅ Encoding correct (é, ñ, ü visible)
   - ✅ BOM present (opening in UTF-8 text editor shows `ï»¿` at start)

---

## Troubleshooting

### Issue: Excel shows garbled characters

**Symptoms**:
```
Input:  "corazón"
Display: "corazón" (ó appears as replacement character)
```

**Cause**: Missing UTF-8 BOM

**Fix**: Ensure BOM is yielded first
```python
yield "\ufeff"  # Always first!
```

**Test**:
```bash
# Check hex dump
xxd corapan-export_*.csv | head -1
# Should show: ef bb bf (UTF-8 BOM)
```

### Issue: Export hangs or incomplete

**Symptoms**:
- Download starts but stalls at 50%
- File incomplete (truncated rows)

**Cause**: Large result set not chunked properly

**Fix**: Verify chunk_size = 1000
```python
if len(chunk_rows) >= 1000:  # ← Check this
    yield flush_chunk()
```

**Debug**:
```python
logger.info(f"Export: row {total_rows}, chunk buffer size: {len(chunk_rows)}")
```

### Issue: Rate limiting blocks valid exports

**Symptoms**:
```json
HTTP 429: "Export limit exceeded"
```

**Cause**: More than 6 exports per minute from same IP

**Fix**: Wait 1 minute, then retry

**Check limit**:
```bash
# View rate limit status
curl -i http://localhost:5000/search/advanced/export?q=palabra
# Look for: X-RateLimit-Limit, X-RateLimit-Remaining headers
```

---

## Performance Optimization

### Future Enhancements

| Enhancement | Benefit | Timeline |
|---|---|---|
| Gzip streaming | 80-90% size reduction | Q4 2025 |
| Parallel chunk generation | 2-3x faster for 100K+ | Q1 2026 |
| Database cursor optimization | Reduce memory peak | Q4 2025 |
| Format: JSON export | Alternative output | Q1 2026 |

---

## Siehe auch

- [CQL Escaping Rules](cql-escaping-rules.md) - Security validation
- [Rate Limiting Strategy](../operations/rate-limiting-strategy.md) - Rate limit configuration
- [Advanced Search Monitoring](../operations/advanced-search-monitoring.md) - Logging & metrics
- [Advanced Search Architecture](../concepts/advanced-search-architecture.md) - System overview

---

**Document**: Advanced Export Streaming Specification  
**Version**: 1.0  
**Status**: Active  
**Owner**: backend-team  
**Last Updated**: 2025-11-10
