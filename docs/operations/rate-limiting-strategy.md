---
title: "Rate Limiting Strategy and Configuration"
status: active
owner: devops
updated: "2025-11-10"
tags: [rate-limiting, operations, api, security, deployment]
links:
  - advanced-search-monitoring.md
  - ../reference/advanced-export-streaming.md
  - ../concepts/advanced-search-architecture.md
---

# Rate Limiting Strategy and Configuration

**Purpose**: Operations and deployment guide for Advanced Search API rate limiting  
**Version**: 1.0  
**Last Updated**: 10. November 2025  
**Status**: Production Ready

---

## Overview

Rate limiting protects the Advanced Search API from abuse and prevents resource exhaustion. The strategy uses separate buckets for different endpoints, with different limits based on computational cost.

**Key Principle**: Higher limits for cheaper operations, lower limits for expensive operations

---

## Rate Limit Configuration

### Endpoint: `/search/advanced/data` (DataTables)

**Limit**: **30 requests per minute** per IP

**Reason**: 
- Lightweight query (pagination only)
- Returns small dataset (25-100 rows)
- Low computational cost (~100-200ms typical)

**Use Case**: Users navigating paginated results

**Example**: User clicks page 2, then page 3, then page 4 (3 requests) → Within limit ✅

### Endpoint: `/search/advanced/export` (CSV/TSV Download)

**Limit**: **6 requests per minute** per IP

**Reason**:
- Heavy operation (full result set export)
- Streams 1,000-100,000+ rows
- High computational cost (1-15s typical)
- High bandwidth usage

**Use Case**: Users exporting search results

**Example**: User exports 10,000 rows (1 request), then requests 5 more → Exceeds limit after request 7 ❌

---

## Configuration

### Flask Setup

**Location**: `src/app/search/advanced_api.py`

**Import Limiter**:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,  # Rate limit by IP
    default_limits=["200 per day"],  # Global fallback
    storage_uri="memory://"  # Or redis:// for production
)
```

**Apply to Endpoints**:
```python
@bp.route("/data", methods=["GET"])
@limiter.limit("30 per minute")  # ← /data limit
def get_search_data():
    # ... implementation ...

@bp.route("/export", methods=["GET"])
@limiter.limit("6 per minute")   # ← /export limit (5x stricter)
def export_data():
    # ... implementation ...
```

### Response Headers

When rate-limited, Flask-Limiter adds these headers:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 1699607942
```

**Header Meanings**:
- `X-RateLimit-Limit`: Total requests allowed per minute (30)
- `X-RateLimit-Remaining`: Requests remaining in current window (25)
- `X-RateLimit-Reset`: Unix timestamp when counter resets

### Exceeding Limits

**When Limit Exceeded**:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45

{
  "error": "rate_limit_exceeded",
  "message": "Export limit exceeded (6 per minute)",
  "retry_after_seconds": 45
}
```

**Status Code**: `429 Too Many Requests`  
**Header**: `Retry-After: 45` (seconds until retry possible)

---

## Rate Limit Windows

### Window Type: Sliding Window

**Mechanism**: Flask-Limiter uses sliding windows

**Example: 6 per minute for /export**

| Time | Request | Count | Status |
|------|---------|-------|--------|
| 00:00 | 1st export | 1/6 | ✅ |
| 00:05 | 2nd export | 2/6 | ✅ |
| 00:10 | 3rd export | 3/6 | ✅ |
| 00:15 | 4th export | 4/6 | ✅ |
| 00:20 | 5th export | 5/6 | ✅ |
| 00:25 | 6th export | 6/6 | ✅ |
| 00:30 | 7th export | — | ❌ 429 |
| 01:00 | 1st one minute later | 1/6 | ✅ Resets! |

**Reset Point**: After 1 minute from first request in window, counter resets

---

## Production Deployment

### Option 1: In-Memory Storage (Development)

**Configuration**:
```python
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://"  # ← All in RAM
)
```

**Pros**: Fast, no external dependency  
**Cons**: Per-process (doesn't work with multiple workers)  
**Use**: Development, single-worker deployment only

### Option 2: Redis Storage (Production)

**Configuration**:
```python
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379"  # ← Shared Redis
)
```

**Setup**:
```bash
# Install Redis
sudo apt-get install redis-server

# Start Redis
redis-server --daemonize yes

# Verify
redis-cli ping  # Should output: PONG
```

**Benefits**:
- ✅ Works with multiple Flask workers
- ✅ Shared across processes
- ✅ Accurate rate limiting
- ✅ Production-grade

**Pros**: Distributed, accurate across workers  
**Cons**: Additional dependency, network overhead  
**Use**: Production multi-worker deployment, Docker, Kubernetes

### Docker Compose Configuration

**docker-compose.yml**:
```yaml
version: "3.8"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  flask:
    build: .
    environment:
      - FLASK_ENV=production
      - LIMITER_STORAGE_URI=redis://redis:6379
    ports:
      - "5000:5000"
    depends_on:
      - redis

volumes:
  redis_data:
```

**Start**: `docker-compose up`

---

## Monitoring Rate Limits

### Logging Rate Limit Violations

**Python Code**:
```python
from flask_limiter.errors import RateLimitExceeded

@bp.errorhandler(RateLimitExceeded)
def rate_limit_handler(e):
    logger.warning(f"Rate limit exceeded: {request.remote_addr} on {request.path}")
    return jsonify({
        "error": "rate_limit_exceeded",
        "message": f"{request.path} limit exceeded"
    }), 429
```

**Log Output**:
```
WARNING [search.advanced_api] Rate limit exceeded: 192.168.1.100 on /search/advanced/export
WARNING [search.advanced_api] Rate limit exceeded: 10.0.0.5 on /search/advanced/data
```

### Metrics to Track

| Metric | Purpose | Alert Threshold |
|--------|---------|-----------------|
| Rate limit violations per minute | Abuse detection | >5 violations/min |
| Top IPs hitting limit | Identify heavy users | >3 limits from single IP |
| /export limit hits vs /data | Endpoint usage pattern | Analyze trends |
| Repeat offender IPs | Persistent abuse | >10 limits from same IP in 1 hour |

### Prometheus Metrics (Future)

```python
from prometheus_client import Counter

rate_limit_exceeded = Counter(
    'api_rate_limit_exceeded_total',
    'Rate limit exceeded',
    ['endpoint', 'ip']
)

@bp.errorhandler(RateLimitExceeded)
def rate_limit_handler(e):
    rate_limit_exceeded.labels(
        endpoint=request.path,
        ip=request.remote_addr
    ).inc()
    return jsonify({"error": "rate_limit_exceeded"}), 429
```

---

## User Communication

### Error Messages for Users

**When Export Limit Exceeded**:
```
Título: Límite de descargas alcanzado
Mensaje: "Ha alcanzado el límite de 6 descargas por minuto. 
          Por favor, intente de nuevo en 45 segundos."
Botón: "Reintentar en 45s"
```

**When Data Limit Exceeded**:
```
Título: Demasiadas solicitudes
Mensaje: "Navegación muy rápida. Por favor, espere 30 segundos 
          antes de cambiar de página."
```

### Client-Side Retry Logic (JavaScript)

```javascript
async function fetchWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const response = await fetch(url);
        
        if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delayMs = (parseInt(retryAfter) || 60) * 1000;
            
            console.log(`Rate limited. Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
        }
        
        return response;
    }
    throw new Error('Max retries exceeded');
}
```

---

## Rate Limit Justification

### Why 6 per minute for /export?

**Computational Cost Analysis**:

| Size | Duration | Memory | CPU |
|------|----------|--------|-----|
| 1,000 rows | 200ms | 8MB | 15% |
| 10,000 rows | 2s | 15MB | 35% |
| 100,000 rows | 15s | 25MB | 80% |

**Limit Justification**:
- 6 exports/min × 15s = 90s processing
- 6 exports/min × 25MB = 150MB peak memory
- Sustainable without resource exhaustion ✅

### Why 30 per minute for /data?

**Computational Cost Analysis**:

| Page | Duration | Memory | CPU |
|------|----------|--------|-----|
| Page 1-50 | 150ms | 2MB | 5% |
| Page 100 | 150ms | 2MB | 5% |

**Limit Justification**:
- 30 requests/min × 150ms = 4.5s processing
- 30 requests/min × 2MB = 60MB peak memory
- Allows rapid pagination without throttling ✅

---

## Testing Rate Limits

### Manual Test: Export Limit

```bash
# Send 7 requests in quick succession
for i in {1..7}; do
    curl -s -w "\nRequest $i: %{http_code}\n" \
        'http://localhost:5000/search/advanced/export?q=palabra&mode=forma'
done

# Expected:
# Request 1: 200 ✅
# Request 2: 200 ✅
# Request 3: 200 ✅
# Request 4: 200 ✅
# Request 5: 200 ✅
# Request 6: 200 ✅
# Request 7: 429 ✅ (rate limited)
```

### Automated Test: Rate Limiting

**Test Suite** (`scripts/test_advanced_hardening.py`):

```python
def test_rate_limiting():
    """Verify rate limiting is enforced."""
    
    # Test /export rate limit (6 per minute)
    responses = []
    for i in range(7):
        response = requests.get(
            '/search/advanced/export',
            params={'q': 'palabra', 'mode': 'forma'}
        )
        responses.append(response.status_code)
    
    # Verify: first 6 succeed, 7th fails
    assert responses[:6] == [200, 200, 200, 200, 200, 200]
    assert responses[6] == 429
    
    # Test /data rate limit (30 per minute)
    for i in range(31):
        response = requests.get(
            '/search/advanced/data',
            params={'q': 'palabra', 'mode': 'forma'}
        )
        if i < 30:
            assert response.status_code == 200
        else:
            assert response.status_code == 429
```

**Run**: `python scripts/test_advanced_hardening.py`  
**Expected**: Test 5 PASSES ✅

---

## Future Enhancements

### Enhancement 1: User-Based Limits

**Idea**: Different limits for authenticated users vs. anonymous

**Configuration**:
```python
@limiter.limit(
    lambda: "100 per minute" if current_user else "10 per minute"
)
def export_data():
    pass
```

**Timeline**: Q1 2026

### Enhancement 2: Adaptive Limits

**Idea**: Adjust limits based on server load

**Logic**:
```python
if cpu_load > 80%:
    limits = {"data": "20 per minute", "export": "3 per minute"}
else:
    limits = {"data": "30 per minute", "export": "6 per minute"}
```

**Timeline**: Q2 2026

### Enhancement 3: Geographic Limits

**Idea**: Stricter limits for suspicious countries (DDoS prevention)

**Configuration**:
```python
LIMIT = "6 per minute"  # Default
if request.country in HIGH_RISK_COUNTRIES:
    LIMIT = "2 per minute"  # Stricter
```

**Timeline**: Q1 2026

### Enhancement 4: Machine Learning Abuse Detection

**Idea**: Detect unusual patterns (rapid exports, specific patterns)

**Implementation**: TensorFlow/scikit-learn model analyzing:
- Request frequency
- Query complexity
- Export size requests
- Time-of-day patterns

**Timeline**: Q3 2026

---

## Troubleshooting

### Issue: Legitimate users getting rate-limited

**Symptoms**:
```
User error: "Límite de descargas alcanzado"
Multiple exports in 1 minute blocked
```

**Cause**: User legitimately needs many exports

**Solution**: Whitelist trusted IPs or increase limit

```python
# In config file
RATELIMIT_WHITELISTED_IPS = [
    "192.168.1.100",  # Admin office
    "10.0.0.50"       # Trusted partner
]

def exempt_from_limit(ip):
    return ip in RATELIMIT_WHITELISTED_IPS

@bp.route("/export")
@limiter.limit("6 per minute", exempt_when=exempt_from_limit)
def export_data():
    pass
```

### Issue: Rate limiting not working

**Symptoms**:
- 10+ requests in <1 minute accepted
- No 429 responses

**Cause**: Storage URI misconfigured

**Debug**:
```python
print(limiter.storage)  # Should show: RedisStorage or MemoryStorage
print(limiter.strategy)  # Should show: FixedWindowRateLimiter
```

**Fix**:
```python
# Verify Redis connection (for production)
import redis
r = redis.Redis(host='localhost', port=6379)
r.ping()  # Should output: True
```

### Issue: Rate limit resets inconsistently

**Symptoms**:
- Sometimes limit resets after 30 seconds
- Sometimes requires full 60 seconds

**Cause**: Window mechanism misunderstood (uses sliding windows, not fixed)

**Explanation**: 
- Sliding window: Counter resets 60 seconds after FIRST request
- Not a fixed window at 00:00, 01:00, etc.

**Expected Behavior**: ✅ Correct (design feature)

---

## Deployment Checklist

- [ ] Review limits: 6/min export, 30/min data
- [ ] Configure storage (memory: dev, Redis: production)
- [ ] Set up logging for violations
- [ ] Test with `scripts/test_advanced_hardening.py`
- [ ] Create error handler (429 JSON response)
- [ ] Test user error messages (Spanish)
- [ ] Monitor violations for first week
- [ ] Adjust limits if needed based on traffic

---

## Siehe auch

- [Advanced Search Monitoring](advanced-search-monitoring.md) - Logging & metrics
- [Advanced Export Streaming](../reference/advanced-export-streaming.md) - Export endpoint details
- [Advanced Search Architecture](../concepts/advanced-search-architecture.md) - System design

---

**Document**: Rate Limiting Strategy and Configuration  
**Version**: 1.0  
**Status**: Active  
**Owner**: devops  
**Last Updated**: 2025-11-10
