---
title: "Advanced Search Architecture and Hardening Strategy"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [architecture, concepts, design, security, hardening, advanced-search]
links:
  - ../reference/cql-escaping-rules.md
  - ../reference/advanced-export-streaming.md
  - ../operations/rate-limiting-strategy.md
  - ../operations/advanced-search-monitoring.md
---

# Advanced Search Architecture and Hardening Strategy

**Purpose**: System architecture, design decisions, and security hardening strategy  
**Version**: 1.0  
**Last Updated**: 10. November 2025  
**Status**: Production Ready

---

## System Overview

The Advanced Search system provides a secure, performant interface to BlackLab corpus search engine. The architecture emphasizes **defense-in-depth security**, efficient **streaming for large exports**, and **comprehensive observability**.

### Layers

```
┌─────────────────────────────────────────┐
│        Frontend (Browser/JavaScript)    │
│  - URL State Restoration                │
│  - Error Differentiation                │
│  - Zero-Results Handling                │
│  - A11y (WCAG 2.1 AA)                   │
└──────────────────┬──────────────────────┘
                   │ HTTP
                   ▼
┌─────────────────────────────────────────┐
│    API Layer (Flask/Python)             │
│  - Rate Limiting (6/30 per min)         │
│  - Request Validation                   │
│  - CQL Escaping & Validation            │
│  - Response Formatting                  │
└──────────────────┬──────────────────────┘
                   │ Query
                   ▼
┌─────────────────────────────────────────┐
│    BlackLab Search Engine               │
│  - CQL Query Processing                 │
│  - Hit Retrieval                        │
│  - Metadata Filtering                   │
└──────────────────┬──────────────────────┘
                   │ Results
                   ▼
┌─────────────────────────────────────────┐
│    Backend (Streaming/Export)           │
│  - Row Chunking (1000 rows)             │
│  - CSV/TSV Formatting                   │
│  - Client-Disconnect Detection          │
│  - Memory-Efficient Streaming           │
└─────────────────────────────────────────┘
```

---

## Endpoints

### Endpoint 1: `/search/advanced/data` (DataTables)

**Purpose**: Fetch paginated search results for UI display

**Method**: `GET`

**Rate Limit**: 30 requests/minute

**Key Parameters**:
- `q` (required): Search query (CQL or simple)
- `mode` (required): forma, forma_exacta, lemma
- `filters`: country_code, speaker_type, sex, speech_mode, discourse

**Response**:
```json
{
  "draw": 1,
  "recordsTotal": 1024,
  "recordsFiltered": 256,
  "data": [
    {"left": "los", "match": "palabra", "right": "clave", ...},
    ...
  ]
}
```

**Error Handling**:
- CQL invalid: HTTP 400 `{error: "invalid_cql", message: "..."}`
- Filter invalid: HTTP 400 `{error: "invalid_filter", message: "..."}`
- Rate limited: HTTP 429 `{error: "rate_limit_exceeded", ...}`
- BlackLab error: HTTP 502 `{error: "upstream_error", ...}`

### Endpoint 2: `/search/advanced/export` (CSV/TSV Download)

**Purpose**: Stream full search results as downloadable file

**Method**: `GET`

**Rate Limit**: 6 requests/minute

**Parameters**: Same as `/data`

**Response**:
- Header: `Content-Disposition: attachment; filename="corapan-export_*.csv"`
- Body: CSV/TSV stream with BOM + 1000-row chunks

**Error Handling**: Same as `/data`

---

## Security Hardening (Defense-in-Depth)

### Layer 1: Input Validation

**Function**: `validate_cql_pattern()` in `cql_validator.py`

**Threats Mitigated**:
- ✅ SQL injection (SQL comment patterns)
- ✅ Shell injection (backticks, command substitution)
- ✅ Null byte injection

**Implementation**:
```python
def validate_cql_pattern(cql: str) -> str:
    # Check for suspicious patterns
    if re.search(r';--', cql):
        raise CQLValidationError("SQL comment injection detected")
    
    # Check brackets balanced
    # Check null bytes
    return cql
```

**Testing**: `test_advanced_hardening.py` → Test 4

### Layer 2: Data Escaping

**Function**: `escape_cql_string()` in `cql_validator.py`

**Threats Mitigated**:
- ✅ CQL syntax breaking (unescaped quotes)
- ✅ String boundary bypass

**Implementation**:
```python
def escape_cql_string(value: str) -> str:
    # Escape backslashes FIRST
    value = value.replace('\\', '\\\\')
    # Then escape quotes
    value = value.replace('"', '\\"')
    return value
```

**Critical**: Escaping order matters (backslashes first!)

### Layer 3: Rate Limiting

**Function**: `@limiter.limit()` decorators

**Threats Mitigated**:
- ✅ Denial of Service (resource exhaustion)
- ✅ Abuse (rapid requests)
- ✅ Brute force (query pattern exploration)

**Implementation**:
```python
@bp.route("/export")
@limiter.limit("6 per minute")  # 6 exports per minute
def export_data():
    pass
```

**Enforcement**: Flask-Limiter tracks IPs, returns HTTP 429

### Layer 4: Streaming

**Function**: Generator-based chunking in `generate_export()`

**Threats Mitigated**:
- ✅ Memory exhaustion (large exports)
- ✅ Server DoS (unbounded memory growth)

**Implementation**:
```python
def generate_export():
    for row in get_all_results():
        if len(chunk) >= 1000:
            yield chunk
            chunk = []
```

**Benefit**: Constant memory usage regardless of result size

### Layer 5: Client-Disconnect Detection

**Function**: `GeneratorExit` exception handling

**Threats Mitigated**:
- ✅ Wasted resources (processing after client gone)
- ✅ Zombie processes

**Implementation**:
```python
try:
    for row in get_results():
        yield row
except GeneratorExit:
    logger.warning(f"Export aborted after {count} lines")
    raise
```

---

## Data Flow: Search Request

### Scenario: User searches for "palabra"

```
1. Browser sends: GET /search/advanced/data?q=palabra&mode=forma

2. Flask receives:
   - Parse URL parameters
   - Validate: q and mode present
   - Extract: q="palabra", mode="forma", filters={}

3. API validation layer:
   - validate_cql_pattern("palabra")
   - ✅ No suspicious patterns
   - ✅ Brackets balanced
   - ✅ No null bytes

4. CQL escaping (if needed):
   - Input: palabra (no special chars)
   - Escaping: palabra (unchanged)

5. BlackLab query:
   - Pattern: palabra
   - Field: word
   - Execute CQL query

6. Results processing:
   - Hits: 1024 found
   - Apply filters: none
   - Filtered hits: 1024

7. Response formatting:
   - recordsTotal: 1024 (=numberOfHits)
   - recordsFiltered: 1024 (=numberOfHits)
   - data: Array of first 25 rows

8. Logging:
   - INFO: "BLS duration: 234ms, hits=1024"
   - INFO: "Response: recordsTotal=1024, recordsFiltered=1024"

9. Browser receives:
   - DataTables updates table
   - Updates page 1 of 41 (1024/25)
   - No errors
```

---

## Data Flow: Export Request

### Scenario: User exports 10,000 results

```
1. Browser sends: GET /search/advanced/export?q=palabra&format=csv

2. Rate limiter checks: IP 192.168.1.100
   - Requests in last minute: 2/6
   - ✅ Allowed

3. Flask receives:
   - Validate parameters
   - Check: format in ['csv', 'tsv']

4. CQL validation:
   - validate_cql_pattern("palabra")
   - ✅ Passed

5. Response headers prepared:
   - Content-Type: text/csv; charset=utf-8
   - Content-Disposition: attachment; filename="corapan-export_20251110_143022.csv"
   - Cache-Control: no-store
   - Transfer-Encoding: chunked

6. Generator started:
   - Logging: INFO "Export started: 10000 hits expected"
   - Yield BOM: \ufeff

7. Streaming (chunked):
   - Chunk 1: Yield CSV header + 1000 rows (245ms)
   - Chunk 2: Yield 1000 rows (238ms)
   - ... (continue for 10 chunks)
   - Chunk 10: Yield final rows (200ms)

8. Client receives:
   - HTTP 200
   - File download starts
   - ~50-60MB file

9. Completion logging:
   - INFO: "Export: 10000 lines in 2.3s (CPU: 22%, Mem: 12MB)"

10. Browser:
    - Save file: corapan-export_20251110_143022.csv
    - User opens in Excel
    - UTF-8 BOM ensures correct encoding
```

---

## Security Architecture Decisions

### Decision 1: Defense-in-Depth (Why Multiple Layers?)

**Principle**: No single layer is perfect

**Example**: 
- Escaping alone isn't enough (can be bypassed)
- Validation alone isn't enough (unforeseen patterns)
- Rate limiting alone isn't enough (legitimate DoS possible)

**Solution**: All layers together create defense-in-depth

### Decision 2: Server-Side Filtering (Why not client-side?)

**Principle**: Never trust the client

**Why**:
- User can modify JavaScript to bypass filters
- User can craft URL with unexpected parameters
- Server must validate all inputs

**Implementation**: All filtering happens on server, before BlackLab query

### Decision 3: Streaming Exports (Why not buffer?)

**Principle**: Constant memory usage

**Why**:
- 100,000 rows = 50+ MB
- Buffering = risk of OOM
- Streaming = constant 15-25MB regardless of size

**Trade-off**: Slightly higher CPU, much lower memory risk

### Decision 4: Separate Rate Limits (Why different for export?)

**Principle**: Cost-based limits

**Why**:
- `/data` = lightweight (100-200ms, 2MB)
- `/export` = expensive (1-15s, 15-25MB)
- Fair: 30 cheap operations OR 6 expensive operations per minute

### Decision 5: CQL Escaping Order (Why backslash first?)

**Principle**: Predictable escaping

**Why**:
- If we escape quotes first: `\` becomes `\"`
- Then escaping backslashes: `\"` becomes `\\\"`
- Result: Double escaping (wrong!)

**Correct order**:
1. Escape backslashes: `\` → `\\`
2. Escape quotes: `"` → `\"`
3. Result: Correct escaping

---

## Error Handling Strategy

### Error Type 1: CQL Syntax Error

**User Action**: Enters malformed CQL

**Example**: `(palabra AND (test` (unmatched parenthesis)

**Server Process**:
1. Validation detects unmatched `(`
2. Raises `CQLValidationError`
3. Returns HTTP 400

**Response**:
```json
{
  "error": "invalid_cql",
  "message": "Invalid CQL: Unbalanced brackets"
}
```

**Frontend Display**:
```
Título: "Sintaxis CQL inválida"
Mensaje: "Paréntesis sin cerrar: (palabra AND (test"
Color: Error (red)
```

**User Sees**: Red error message explaining the issue

### Error Type 2: Injection Attempt

**User Action**: Searches for `palabra; DROP TABLE`

**Server Process**:
1. Validation detects `; DROP` pattern
2. Raises `CQLValidationError` immediately
3. Never queries BlackLab
4. Returns HTTP 400

**Response**:
```json
{
  "error": "invalid_cql",
  "message": "Invalid CQL: SQL comment injection detected"
}
```

**Frontend Display**:
```
Título: "Patrón sospechoso"
Mensaje: "Se detectó un patrón potencialmente peligroso"
```

**Security Benefit**: Attack prevented before reaching BlackLab

### Error Type 3: Rate Limit Exceeded

**User Action**: Exports 7 times in 1 minute

**Server Process**:
1. Request 7 arrives
2. Rate limiter checks: 6/6 limit reached
3. Rejects with HTTP 429

**Response**:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Export limit exceeded (6 per minute)"
}
```

**Header**: `Retry-After: 45` (seconds to wait)

**Frontend Display**:
```
Título: "Límite de descargas alcanzado"
Mensaje: "Ha alcanzado el límite de 6 descargas por minuto.
          Reintente en 45 segundos."
```

### Error Type 4: BlackLab Unreachable

**Cause**: BlackLab server down or timeout

**Server Process**:
1. Try to query BlackLab
2. Connection fails or times out after 10s
3. Catch exception
4. Return HTTP 502

**Response**:
```json
{
  "error": "upstream_error",
  "message": "Search service temporarily unavailable"
}
```

**Frontend Display**:
```
Título: "Servicio no disponible"
Mensaje: "El servidor de búsqueda no está disponible.
          Intente más tarde."
```

---

## Performance Characteristics

### Query Performance

| Query | Expected Time | Hits | Memory |
|---|---|---|---|
| Simple (`palabra`) | 150-200ms | 1000-10000 | 10MB |
| Complex (`(word AND (test OR verify))`) | 500-1000ms | 100-1000 | 15MB |
| Very complex (3+ nested levels) | 2-5s | <100 | 20MB |

**Optimization**: Queries slow >3s should be logged and investigated

### Export Performance

| Size | Duration | Throughput | Memory |
|---|---|---|---|
| 100 rows | 50ms | 2000 rows/s | 5MB |
| 1,000 rows | 150ms | 6700 rows/s | 8MB |
| 10,000 rows | 2s | 5000 rows/s | 15MB |
| 100,000 rows | 15s | 6700 rows/s | 25MB |

**Scaling**: Memory stays constant at ~25MB even for 100K rows (streaming benefit)

---

## Accessibility Architecture

### WCAG 2.1 Level AA Compliance

**Semantic HTML**:
```html
<form id="advanced-search-form" role="search">
  <label for="q">Search Query</label>
  <input id="q" type="text" />
</form>

<table id="advanced-table">
  <caption>Search results</caption>
  <thead>
    <tr>
      <th scope="col">Left</th>
      <th scope="col">Match</th>
      <th scope="col">Right</th>
    </tr>
  </thead>
</table>
```

**ARIA Attributes**:
```html
<div id="search-summary" aria-live="polite" tabindex="-1">
  Results updated
</div>
```

**Keyboard Navigation**:
1. Tab → Focus to Q input
2. Tab → Focus to Mode select
3. Tab → Focus to Filters
4. Tab → Focus to Search button
5. Enter → Submit form

**Screen Reader**: All form labels, table headers, and dynamic updates announced

---

## Monitoring and Observability

### Key Metrics

| Metric | Collection | Purpose |
|---|---|---|
| BLS Duration (ms) | `time.time()` around BlackLab call | Identify slow queries |
| Hits Count | NumberOfHits from response | Verify consistency |
| Export Lines | Count yielded lines | Verify completeness |
| CPU Usage | `psutil` | Resource monitoring |
| Memory Usage | `process.memory_info()` | Memory leak detection |
| Error Rate | Count 400/500 responses | Health check |
| Rate Limit Hits | Count 429 responses | Abuse detection |

### Logging

**INFO**: Normal operations
```
INFO Export: 10000 lines in 2.3s
```

**WARNING**: Unexpected but non-critical
```
WARNING Export aborted by client after 2156 lines
```

**ERROR**: Critical failures
```
ERROR BlackLab timeout (10s): palabra
```

---

## Deployment and Operations

### Deployment Requirements

- Python 3.10+
- Flask 2.x + extensions (Limiter, CORS)
- BlackLab server (accessible)
- Redis (for production rate limiting)
- 2GB RAM (recommended)
- 1 CPU core (minimum)

### Health Check

```bash
curl http://localhost:5000/search/advanced/data?q=test&mode=forma
# Expected: HTTP 200, JSON response
```

### Scaling Considerations

**Single Instance**: Up to 100 QPS (queries/second)

**Multiple Instances**: 
- Put behind load balancer
- Use Redis for shared rate limiting
- Share BlackLab connection pool

**Monitoring**: Log to centralized system (ELK, Splunk)

---

## Future Enhancements

### Enhancement 1: User Accounts (Q4 2025)

**Idea**: Increase rate limits for registered users

**Benefits**:
- Different limits per user tier
- Persistent search history
- Saved queries

### Enhancement 2: Query Optimization (Q1 2026)

**Idea**: Cache common queries

**Benefits**:
- Faster responses for popular searches
- Reduced BlackLab load
- Better performance during peak hours

### Enhancement 3: Advanced Analytics (Q2 2026)

**Idea**: Track search patterns, usage

**Benefits**:
- Usage reports
- Performance insights
- Popular queries trending

### Enhancement 4: API Versioning (Q3 2026)

**Idea**: Support `/v2/` endpoints with new features

**Benefits**:
- Backward compatibility
- Gradual migration path
- New features without breaking changes

---

## Siehe auch

- [CQL Escaping Rules](../reference/cql-escaping-rules.md) - Technical escaping details
- [Advanced Export Streaming](../reference/advanced-export-streaming.md) - Export implementation
- [Rate Limiting Strategy](../operations/rate-limiting-strategy.md) - Rate limit configuration
- [Advanced Search Monitoring](../operations/advanced-search-monitoring.md) - Logging and observability

---

**Document**: Advanced Search Architecture and Hardening Strategy  
**Version**: 1.0  
**Status**: Active  
**Owner**: backend-team  
**Last Updated**: 2025-11-10
