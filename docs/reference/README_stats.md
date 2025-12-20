# CO.RA.PAN Statistics API

Aggregation and visualization of corpus statistics with dynamic charts.

## Overview

The statistics feature provides real-time aggregations of corpus data with breakdowns by:
- **Country** (país)
- **Speaker Type** (tipo de hablante)
- **Sex** (sexo)
- **Register** (registro/modo)

Statistics respect the same filters as the main search, ensuring consistency between results and visualizations.

---

## API Endpoint

### `GET /api/stats`

**Purpose**: Aggregate corpus statistics based on search filters.

**Access**: Public (read-only, no authentication required)

**Rate Limit**: 60 requests per minute per IP

**Cache**: 120 seconds TTL with ETag support

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `q` | string | Search query | `?q=hola` |
| `mode` | string | Search mode: `text`, `text_exact`, `lemma`, `lemma_exact` | `?mode=text` |
| `pais` | string[] | Country code(s) (ISO 3166-1 alpha-3) | `?pais=ARG&pais=MEX` |
| `speaker` | string[] | Speaker type(s) | `?speaker=pro&speaker=otro` |
| `sexo` | string[] | Sex filter(s) | `?sexo=m&sexo=f` |
| `modo` | string[] | Register/mode filter(s) | `?modo=formal&modo=informal` |
| `discourse` | string[] | Discourse type(s) | `?discourse=interview` |
| `token_ids` | string[] | Specific token IDs | `?token_ids=ABC123&token_ids=DEF456` |

**Note**: All filters are optional. Empty parameters return statistics for the entire corpus.

#### Response Format

```json
{
  "total": 1234,
  "by_country": [
    {"key": "ARG", "n": 321, "p": 0.260},
    {"key": "MEX", "n": 280, "p": 0.227},
    ...
  ],
  "by_speaker_type": [
    {"key": "pro", "n": 900, "p": 0.730},
    {"key": "otro", "n": 334, "p": 0.270}
  ],
  "by_sexo": [
    {"key": "m", "n": 804, "p": 0.652},
    {"key": "f", "n": 430, "p": 0.348}
  ],
  "by_modo": [
    {"key": "formal", "n": 800, "p": 0.648},
    {"key": "informal", "n": 434, "p": 0.352}
  ],
  "meta": {
    "query": {
      "query": "hola",
      "search_mode": "text",
      "countries": ["ARG", "MEX"],
      ...
    },
    "generatedAt": "2025-11-06T10:30:00.000Z"
  }
}
```

**Field Definitions**:
- `total`: Total number of matching documents (not tokens)
- `key`: Category identifier (e.g., country code, speaker type)
- `n`: Absolute count of documents in this category
- `p`: Proportion (0-1) of documents in this category relative to total

#### Response Headers

```
ETag: W/"abc123def456"
Cache-Control: public, max-age=60
Content-Type: application/json
```

#### Error Responses

**429 Too Many Requests**:
```json
{
  "error": "ratelimit_exceeded",
  "message": "Rate limit exceeded"
}
```

**500 Internal Server Error**:
```json
{
  "error": "internal_error",
  "message": "Failed to compute statistics"
}
```

---

## Database Requirements

The statistics API requires the following indexes for optimal performance:

```sql
-- Indexes for statistics GROUP BY operations
CREATE INDEX IF NOT EXISTS idx_tokens_country ON tokens(country_code);
CREATE INDEX IF NOT EXISTS idx_tokens_speaker ON tokens(speaker_type);
CREATE INDEX IF NOT EXISTS idx_tokens_sex ON tokens(sex);
CREATE INDEX IF NOT EXISTS idx_tokens_mode ON tokens(mode);
CREATE INDEX IF NOT EXISTS idx_tokens_discourse ON tokens(discourse);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_tokens_country_speaker_mode ON tokens(country_code, speaker_type, mode);
```

**Index Creation**: Indexes are automatically created during offline database rebuild via `database_creation_v2.py`.

**Verification**: Run `python database_creation_v2.py verify` to check all indexes exist.

**Schema Note**: Document metadata (country, speaker, sex, mode) is denormalized in the `tokens` table. Stats queries use `SELECT DISTINCT filename` to aggregate at document level.

---

## Caching Strategy

### File-Based Cache

- **Location**: `/data/stats_temp/`
- **TTL**: 120 seconds
- **Key**: SHA256 hash of normalized query parameters (first 16 chars)
- **Format**: JSON files named `{cache_key}.json`

### Cache Behavior

1. **Cache Hit**: Returns cached data with `ETag` header
2. **Cache Miss**: Computes fresh statistics, saves to cache
3. **Conditional Request**: Supports `If-None-Match` header (returns 304 if unchanged)
4. **Expiration**: Files older than TTL are automatically deleted on next request

### Cache Cleanup

Manual cleanup:
```bash
# Delete cache files older than 24 hours (recommended daily cron)
find data/stats_temp -name "*.json" -mtime +1 -delete
```

---

## Security

### Read-Only Access

- No authentication required
- No write operations
- Database connection uses read-only role

### Input Validation

- Maximum 2000 token IDs per request
- Parameter whitelisting for filter values
- Strict SQL parameterization (no SQL injection risk)

### Rate Limiting

- **60 requests/minute** per IP address
- Enforced via Flask-Limiter
- Returns 429 status on limit exceeded

### Network Security

- Database accessible only from application server (not exposed)
- CORS restricted to same origin
- Statement timeout: 5 seconds per query

---

## Frontend Integration

### UI Components

**Location**: `templates/pages/corpus.html`

**Sub-Tabs**:
- **Resultados**: Default view with search results table
- **Estadísticas**: Statistics view with charts

**Deep Linking**:
- `?tab=simple&view=stats` opens statistics tab directly
- `?tab=simple&view=results` opens results table (default)

### JavaScript Modules

**Location**: `static/js/modules/stats/`

**Files**:
- `theme/corapanTheme.js`: ECharts theme with MD3 color palette
- `renderBar.js`: Bar chart renderer with responsive behavior
- `initStatsTab.js`: Controller for fetching and displaying statistics

**Usage**:
```javascript
import { initStatsTab } from '/static/js/modules/stats/initStatsTab.js';

document.addEventListener('DOMContentLoaded', () => {
  initStatsTab();
});
```

### Chart Features

- **Responsive**: Auto-resize on container size change
- **Adaptive Labels**: Rotate axis labels if >20 categories
- **DataZoom**: Enable for >30 categories
- **Tooltips**: Show absolute count (n) and percentage (%)
- **Theme Support**: Automatically adapts to dark/light mode

---

## Performance Considerations

### Expected Load

- ~20 countries max
- ~2-5 speaker types
- ~2-3 sex categories
- ~5-10 register types

**No pagination needed** - all categories fit in a single response.

### Query Optimization

- **CTE Strategy**: Single `WITH hits AS (...)` clause for all aggregations
- **Indexed Filters**: All `GROUP BY` columns are indexed
- **Document Counting**: Counts distinct filenames (not tokens) to avoid inflation

### Scalability

- For >10k unique categories: consider top-N limiting with "show more" pagination
- For >100k documents: consider pre-aggregation or materialized views

---

## Development

### Local Testing

1. **Rebuild Database** (if needed):
   ```bash
   python "LOKAL\01 - Add New Transcriptions\03 update DB\database_creation_v2.py"
   ```

2. **Verify Indexes**:
   ```bash
   python "LOKAL\01 - Add New Transcriptions\03 update DB\database_creation_v2.py" verify
   ```

3. **Start Application**:
   ```bash
   python -m src.app
   ```

4. **Access UI**:
   ```
   http://localhost:5000/corpus/?tab=simple&view=stats
   ```

5. **Test API**:
   ```bash
   curl "http://localhost:5000/api/stats?q=hola&pais=ARG"
   ```

### Building Frontend

```bash
npm run build  # Production build
npm run dev    # Development server
```

---

## Troubleshooting

### Charts Not Rendering

**Symptom**: Empty chart containers or "Sin datos..." message

**Causes**:
1. No matching documents for current filters
2. JavaScript module loading failure
3. ECharts initialization error

**Solution**:
- Check browser console for errors
- Verify `/api/stats` returns valid JSON
- Ensure Vite build completed successfully

### Slow Query Performance

**Symptom**: API response time >2 seconds

**Causes**:
1. Missing indexes on `tokens` table
2. Complex multi-word search queries
3. Large result sets without filters

**Solution**:
- Run `python database_creation_v2.py verify` to check indexes
- If indexes missing: rebuild database with `python database_creation_v2.py`
- Check `EXPLAIN QUERY PLAN` for SQLite query
- Add `statement_timeout` to prevent long-running queries

### Cache Not Working

**Symptom**: Identical requests take full processing time

**Causes**:
1. `/data/stats_temp/` directory not writable
2. Cache files being deleted prematurely
3. Query parameters not normalized consistently

**Solution**:
- Check directory permissions: `chmod 755 data/stats_temp`
- Verify TTL configuration (120s default)
- Inspect cache key generation in logs

---

## Future Enhancements

### Planned Features

- [ ] **Export Charts**: Enable PNG/SVG download buttons
- [ ] **Time-Series Stats**: Aggregate by publication year
- [ ] **Advanced Filters**: Combine with "Búsqueda avanzada" tab
- [ ] **Comparison Mode**: Side-by-side chart comparisons
- [ ] **CSV Export**: Raw aggregation data download

### Architecture Extensions

- **Redis Cache**: Replace file cache with Redis for multi-instance deployments
- **Pre-Aggregation**: Daily batch jobs for common queries
- **Query Optimization**: Partial indexes for frequently filtered columns

---

## References

- **Material Design 3**: https://m3.material.io/
- **ECharts Documentation**: https://echarts.apache.org/
- **Flask-Limiter**: https://flask-limiter.readthedocs.io/
- **SQLite Indexes**: https://www.sqlite.org/queryplanner.html

---

## Support

For issues or questions:
1. Check logs in `logs/` directory
2. Review console output in browser DevTools
3. Consult `docs/troubleshooting.md`
4. File issue in project repository
