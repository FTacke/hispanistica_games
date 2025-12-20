---
title: "Advanced Search Monitoring and Observability"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [monitoring, operations, logging, metrics, observability]
links:
  - rate-limiting-strategy.md
  - ../reference/advanced-export-streaming.md
  - ../reference/cql-escaping-rules.md
  - ../concepts/advanced-search-architecture.md
---

# Advanced Search Monitoring and Observability

**Purpose**: Operations guide for logging, metrics, and observability  
**Version**: 1.0  
**Last Updated**: 10. November 2025  
**Status**: Production Ready

---

## Overview

Comprehensive monitoring ensures Advanced Search API health, performance, and security. This document specifies logging levels, metrics, alerts, and performance baselines.

**Key Principle**: "If it's not logged, it didn't happen"

---

## Logging Levels and Configuration

### Log Level: INFO

**When to Use**: Normal operations, important state changes

**Examples**:
```
INFO  [search.advanced_api] Export started: 10,000 hits expected
INFO  [search.advanced_api] Export completed: 10,000 lines in 4.5s
INFO  [search.advanced_api] CQL pattern validated: palabra AND (prueba)
INFO  [search.advanced_api] Filter applied: 256 hits → 42 hits (country=ARG)
```

**Format**:
```
INFO [module.submodule] Message with context
```

### Log Level: WARNING

**When to Use**: Unexpected but non-critical events

**Examples**:
```
WARNING [search.advanced_api] Export aborted by client after 2,156 lines
WARNING [search.advanced_api] Slow query: 8.2s duration (expected <5s)
WARNING [search.advanced_api] Rate limit exceeded: 192.168.1.100 on /export
WARNING [search.advanced_api] CQL validation rejected: SQL injection pattern
```

### Log Level: ERROR

**When to Use**: Errors that prevent operation completion

**Examples**:
```
ERROR [search.advanced_api] BlackLab server timeout (10s): palabra
ERROR [search.advanced_api] CQL pattern too complex: 50+ nested brackets
ERROR [search.advanced_api] Database connection failed: connection refused
ERROR [search.advanced_api] Export format invalid: only csv/tsv allowed
```

### Log Level: DEBUG

**When to Use**: Detailed troubleshooting (development only)

**Examples**:
```
DEBUG [search.advanced_api] Parsing URL params: q=palabra, mode=forma, ...
DEBUG [search.advanced_api] Escaping CQL: palabra → palabra (no special chars)
DEBUG [search.advanced_api] Building BLS request: pattern=palabra, field=word
DEBUG [search.advanced_api] Chunk 1/10 exported: 1,000 rows in 245ms
```

---

## Configuration

### Python Logging Setup

**Location**: `src/app/search/advanced_api.py`

```python
import logging
import sys

# Create logger
logger = logging.getLogger(__name__)

# Handler: Console (development)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_format = logging.Formatter(
    '%(levelname)-8s [%(name)s] %(message)s'
)
console_handler.setFormatter(console_format)

# Handler: File (production)
file_handler = logging.FileHandler('logs/advanced_search.log')
file_handler.setLevel(logging.INFO)
file_format = logging.Formatter(
    '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s'
)
file_handler.setFormatter(file_format)

# Add handlers
logger.addHandler(console_handler)
logger.addHandler(file_handler)
logger.setLevel(logging.INFO)
```

### Environment-Based Config

```python
import os

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')  # Set via env var
logger.setLevel(getattr(logging, LOG_LEVEL))

# Usage:
# Development: LOG_LEVEL=DEBUG python -m src.app.main
# Production: LOG_LEVEL=INFO python -m src.app.main
```

---

## Metrics and KPIs

### Metric 1: Query Duration (BLS Response Time)

**Purpose**: Identify slow queries

**Logged As**:
```
INFO [search.advanced_api] BLS duration: 234ms, hits=1024
INFO [search.advanced_api] BLS duration: 8500ms, hits=5, pattern=(complex nested query)
```

**Baseline**:
| Query Type | Expected Duration | Warning Threshold |
|---|---|---|
| Simple (1 word) | 100-200ms | >1000ms |
| Complex (3+ terms) | 500-800ms | >3000ms |
| Very complex (nested) | 2-5s | >8000ms |

**Calculation**:
```python
import time

start = time.time()
hits = search_blacklab(cql_pattern)
duration_ms = (time.time() - start) * 1000

logger.info(f"BLS duration: {duration_ms:.0f}ms, hits={len(hits)}")
```

### Metric 2: Export Performance

**Purpose**: Monitor export throughput and resource usage

**Logged As**:
```
INFO [search.advanced_api] Export: 1000 lines in 245ms (CPU: 18%, Mem: 8MB)
INFO [search.advanced_api] Export: 10000 lines in 2.3s (CPU: 35%, Mem: 15MB)
WARNING [search.advanced_api] Export aborted by client after 2156 lines
```

**Baseline**:
| Export Size | Expected Duration | Memory Usage | Warning Threshold |
|---|---|---|---|
| 100 rows | <100ms | <5MB | >500ms |
| 1K rows | 150-200ms | <8MB | >1000ms |
| 10K rows | 1-2s | <15MB | >5000ms |
| 100K rows | 10-15s | <25MB | >30000ms |

**Calculation**:
```python
import time
import psutil

process = psutil.Process()
start_time = time.time()
start_mem = process.memory_info().rss

# Export operation
for chunk in generate_export():
    yield chunk
    total_lines += len(chunk.split('\n'))

duration_ms = (time.time() - start_time) * 1000
peak_mem_mb = (process.memory_info().rss - start_mem) / 1024 / 1024

logger.info(f"Export: {total_lines} lines in {duration_ms:.1f}ms (Mem: {peak_mem_mb:.1f}MB)")
```

### Metric 3: Hit Count Metrics

**Purpose**: Track search effectiveness and filter impact

**Logged As**:
```
INFO [search.advanced_api] Hits: 1024, Filtered: 256 (75% reduction)
INFO [search.advanced_api] No hits found for pattern: xyznonexistent
WARNING [search.advanced_api] Hits capped: 1000000 actual (database limit)
```

**Calculation**:
```python
total_hits = search_blacklab(cql_pattern)
filtered_hits = apply_filters(total_hits, filters)
reduction_pct = 100 * (1 - filtered_hits / total_hits)

logger.info(f"Hits: {total_hits}, Filtered: {filtered_hits} ({reduction_pct:.0f}% reduction)")
```

### Metric 4: Error Rate

**Purpose**: Monitor API reliability

**Logged As**:
```
ERROR [search.advanced_api] CQL validation failed: SQL injection pattern detected
ERROR [search.advanced_api] BlackLab timeout (10s): palabra
ERROR [search.advanced_api] Filter validation failed: country_code=INVALID
```

**Tracking**:
```python
error_count = 0
total_requests = 0

try:
    # Request handling
    total_requests += 1
except Exception as e:
    error_count += 1
    logger.error(f"Request failed: {e}")
finally:
    error_rate = error_count / max(total_requests, 1)
    if error_rate > 0.05:  # >5% errors = warning
        logger.warning(f"High error rate: {error_rate:.1%}")
```

### Metric 5: Rate Limit Violations

**Purpose**: Detect abuse patterns

**Logged As**:
```
WARNING [search.advanced_api] Rate limit exceeded: 192.168.1.100 on /export (6/min limit)
WARNING [search.advanced_api] Repeated offender: 10.0.0.5 (5 violations in 10 min)
```

**Calculation**:
```python
from collections import defaultdict
from datetime import datetime, timedelta

violations_by_ip = defaultdict(list)

def log_rate_limit_violation(ip, endpoint):
    now = datetime.now()
    violations_by_ip[ip].append((endpoint, now))
    
    # Count violations in last 10 minutes
    recent = [v for v in violations_by_ip[ip] if v[1] > now - timedelta(minutes=10)]
    
    if len(recent) >= 5:
        logger.warning(f"Repeated offender: {ip} ({len(recent)} violations in 10 min)")
    else:
        logger.warning(f"Rate limit exceeded: {ip} on {endpoint}")
```

---

## Log Output Examples

### Example 1: Successful Search + Export

```
INFO  [search.advanced_api] Request: GET /search/advanced/data?q=palabra&mode=forma
INFO  [search.advanced_api] CQL pattern validated: palabra
INFO  [search.advanced_api] BLS duration: 234ms, hits=1024
INFO  [search.advanced_api] Response: recordsTotal=1024, recordsFiltered=1024 (no filter)
INFO  [search.advanced_api] Request: GET /search/advanced/export?q=palabra&mode=forma&format=csv
INFO  [search.advanced_api] Export: 1024 lines in 2.1s (CPU: 22%, Mem: 12MB)
```

### Example 2: Filtered Search with Slow Query

```
INFO  [search.advanced_api] Request: GET /search/advanced/data?q=(prueba AND (test OR verificación))&country_code=ARG
WARNING [search.advanced_api] Slow query: BLS duration 3200ms (expected <800ms)
INFO  [search.advanced_api] BLS duration: 3200ms, hits=512
INFO  [search.advanced_api] Filter applied: country=ARG → 128 hits (75% reduction)
INFO  [search.advanced_api] Response: recordsTotal=512, recordsFiltered=128
```

### Example 3: CQL Validation Rejection

```
INFO  [search.advanced_api] Request: GET /search/advanced/export?q=palabra);DROP&mode=forma
WARNING [search.advanced_api] CQL validation rejected: SQL injection pattern
ERROR  [search.advanced_api] Invalid CQL: SQL comment injection detected
INFO  [search.advanced_api] Response: HTTP 400, error=invalid_cql
```

### Example 4: Client-Disconnect During Export

```
INFO  [search.advanced_api] Export started: 10000 hits expected
INFO  [search.advanced_api] Chunk 1/10 exported: 1000 rows in 245ms
INFO  [search.advanced_api] Chunk 2/10 exported: 1000 rows in 238ms
WARNING [search.advanced_api] Export aborted by client after 2156 lines
INFO  [search.advanced_api] Memory freed: 8MB
```

### Example 5: Rate Limiting

```
INFO  [search.advanced_api] Request 1/6: GET /search/advanced/export (IP: 192.168.1.50)
INFO  [search.advanced_api] Request 2/6: GET /search/advanced/export (IP: 192.168.1.50)
INFO  [search.advanced_api] Request 3/6: GET /search/advanced/export (IP: 192.168.1.50)
INFO  [search.advanced_api] Request 4/6: GET /search/advanced/export (IP: 192.168.1.50)
INFO  [search.advanced_api] Request 5/6: GET /search/advanced/export (IP: 192.168.1.50)
INFO  [search.advanced_api] Request 6/6: GET /search/advanced/export (IP: 192.168.1.50)
WARNING [search.advanced_api] Rate limit exceeded: 192.168.1.50 on /export (6/min limit)
INFO  [search.advanced_api] Response: HTTP 429, Retry-After: 45s
```

---

## Alert Thresholds

### Alert 1: Slow Queries

**Condition**: BLS duration > 5 seconds

**Action**: Log warning, investigate CQL pattern

```python
if duration_ms > 5000:
    logger.warning(f"Slow query alert: {duration_ms:.0f}ms, pattern={cql_pattern}")
    # Notify ops team
```

### Alert 2: High Error Rate

**Condition**: >5% of requests failing

**Action**: Page on-call engineer

```python
error_rate = errors / requests
if error_rate > 0.05:
    logger.critical(f"High error rate alert: {error_rate:.1%}")
    # Send Slack/PagerDuty alert
```

### Alert 3: Memory Leak

**Condition**: Memory growth >100MB over 1 hour

**Action**: Restart service

```python
current_mem = process.memory_info().rss
if current_mem - baseline_mem > 100*1024*1024:
    logger.critical("Memory leak detected: potential OOM")
    # Trigger auto-restart
```

### Alert 4: Rate Limit Abuse

**Condition**: >10 violations from same IP in 10 minutes

**Action**: Consider IP ban

```python
if violations_from_ip > 10:
    logger.critical(f"Abuse detected: {ip} ({violations_from_ip} violations)")
    # Add to firewall deny list
```

---

## Performance Baselines

### CPU Usage

| Operation | Expected CPU | Peak CPU | Warning |
|---|---|---|---|
| Simple query | 5-10% | 15% | >30% |
| Complex query | 15-25% | 35% | >50% |
| Export (10K) | 20-30% | 40% | >60% |
| Export (100K) | 30-40% | 50% | >70% |

**Measurement**:
```python
import psutil
cpu_percent = psutil.cpu_percent(interval=1)
logger.info(f"CPU usage: {cpu_percent}%")
```

### Memory Usage

| Operation | Expected RAM | Peak RAM | Warning |
|---|---|---|---|
| Idle (baseline) | 50MB | 80MB | >150MB |
| Simple query | 60MB | 100MB | >200MB |
| Complex query | 80MB | 120MB | >250MB |
| Export (10K) | 100MB | 150MB | >300MB |
| Export (100K) | 150MB | 250MB | >400MB |

**Measurement**:
```python
import psutil
process = psutil.Process()
mem_mb = process.memory_info().rss / 1024 / 1024
logger.info(f"Memory: {mem_mb:.1f}MB")
```

### Response Times

| Operation | Expected | Good | Warning | Alert |
|---|---|---|---|---|
| /data query | 200ms | <500ms | 500-2000ms | >2000ms |
| /export (10K) | 2s | <5s | 5-15s | >15s |
| BLS (simple) | 150ms | <500ms | 500-2000ms | >2000ms |
| BLS (complex) | 1s | <3s | 3-8s | >8s |

---

## Troubleshooting with Logs

### Problem: Slow Export

**Logs to Check**:
```
grep "Export:" logs/advanced_search.log
# Look for duration >5s for 10K rows
```

**Example**:
```
INFO [search.advanced_api] Export: 10000 lines in 8.5s ← TOO SLOW
# Expected: 2-3s for 10K
```

**Diagnosis**:
1. Check BLS duration (in same log)
2. Check CPU/memory (in system logs)
3. Check network to BlackLab (ping, traceroute)

**Action**:
```bash
# View slow exports
grep "Export.*in [5-9]" logs/advanced_search.log | wc -l

# If >3 in 1 hour: investigate
# 1. BlackLab performance
# 2. Network latency
# 3. System resources
```

### Problem: High Error Rate

**Logs to Check**:
```
grep "ERROR" logs/advanced_search.log
# Count errors by type
grep "ERROR" logs/advanced_search.log | cut -d: -f4 | sort | uniq -c
```

**Example**:
```
10 CQL validation failed
5 BlackLab timeout
3 Database connection failed
```

**Action**:
1. Most common: Fix CQL validator or user queries
2. Timeout: Increase BLS timeout or optimize queries
3. Connection: Check database/BlackLab service

### Problem: Memory Growth

**Logs to Check**:
```
grep "Memory:" logs/advanced_search.log | tail -20
# Should stay flat (±20MB)
```

**Example**:
```
INFO [search.advanced_api] Memory: 50MB
INFO [search.advanced_api] Memory: 52MB
INFO [search.advanced_api] Memory: 65MB ← Growing
INFO [search.advanced_api] Memory: 85MB ← Still growing
```

**Action**:
1. Check for memory leaks in export chunking
2. Verify client-disconnect handling
3. Restart service if >200MB

---

## Log Analysis Tools

### Command: Count Request Types

```bash
grep "Request:" logs/advanced_search.log | cut -d' ' -f9 | sort | uniq -c
# Output:
#    45 GET /search/advanced/data
#     8 GET /search/advanced/export
```

### Command: Average Query Duration

```bash
grep "BLS duration:" logs/advanced_search.log | \
    grep -oP '\d+(?=ms)' | \
    awk '{sum+=$1; count++} END {print "Avg: " sum/count "ms"}'
```

### Command: Errors by Type

```bash
grep "ERROR" logs/advanced_search.log | cut -d: -f4 | sort | uniq -c | sort -rn
```

### Command: Rate Limit Violations

```bash
grep "Rate limit exceeded" logs/advanced_search.log | \
    grep -oP '\d+\.\d+\.\d+\.\d+' | sort | uniq -c | sort -rn
```

---

## Integration with Monitoring Stack

### ELK Stack (Elasticsearch, Logstash, Kibana)

**Logstash Configuration** (`/etc/logstash/conf.d/advanced-search.conf`):
```
input {
  file {
    path => "/app/logs/advanced_search.log"
    start_position => "beginning"
  }
}

filter {
  grok {
    match => { "message" => "%{LOGLEVEL:level} \[%{DATA:logger}\] %{GREEDYDATA:msg}" }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "advanced-search-%{+YYYY.MM.dd}"
  }
}
```

**Kibana Dashboards**:
- Request rate (requests/min)
- Error rate (errors/min)
- Query duration (P50, P95, P99)
- Export performance (throughput, memory)

### Prometheus + Grafana

**Prometheus Metrics**:
```
advanced_search_requests_total{endpoint="/data"} 1024
advanced_search_request_duration_seconds_bucket{endpoint="/data",le="0.5"} 820
advanced_search_errors_total{type="cql_validation"} 5
```

**Grafana Panels**:
- Query latency heatmap
- Error rate trend
- Export throughput
- Memory usage over time

---

## Deployment Checklist

- [ ] Configure logging handlers (console + file)
- [ ] Set appropriate log level (INFO for production)
- [ ] Test all log messages (5 example scenarios)
- [ ] Verify baseline metrics (query time, export time)
- [ ] Set up alerting (slow queries, errors, memory)
- [ ] Configure log rotation (7 days retention)
- [ ] Integrate with monitoring stack (ELK/Prometheus)
- [ ] Create Kibana/Grafana dashboards
- [ ] Document runbook for alert responses
- [ ] Test log analysis commands

---

## Siehe auch

- [Rate Limiting Strategy](rate-limiting-strategy.md) - Rate limit configuration
- [Advanced Export Streaming](../reference/advanced-export-streaming.md) - Export metrics
- [CQL Escaping Rules](../reference/cql-escaping-rules.md) - Validation logging
- [Advanced Search Architecture](../concepts/advanced-search-architecture.md) - System overview

---

**Document**: Advanced Search Monitoring and Observability  
**Version**: 1.0  
**Status**: Active  
**Owner**: backend-team  
**Last Updated**: 2025-11-10
