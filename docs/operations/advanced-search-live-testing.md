---
title: "Advanced Search Live Testing Guide"
status: active
owner: qa-team
updated: "2025-11-10"
tags: [testing, advanced-search, blacklab, live-tests, validation]
links:
  - ../operations/production-deployment.md
  - ../operations/runbook-advanced-search.md
  - ../how-to/advanced-search.md
---

# Advanced Search Live Testing Guide

Anleitung zum manuellen Testen der Advanced Search gegen einen echten BlackLab Server.

---

## Voraussetzungen

1. **BlackLab Server läuft** auf Port 8081
  ```bash
  bash scripts/blacklab/run_bls.sh 8081 4g 1g
  ```

2. **Flask/Waitress läuft** auf Port 8000
   ```bash
   export FLASK_ENV=production
   export BLS_BASE_URL=http://127.0.0.1:8081/blacklab-server
   python scripts/start_waitress.py
   ```

3. **Index geladen:** `data/blacklab_index/` (146 Dokumente, 1.487M Tokens)

4. **Test-Script ready:** `scripts/test_advanced_search_real.py`

---

## Automated Tests (Empfohlen)

### Alle 3 Tests ausführen
```bash
python scripts/test_advanced_search_real.py
```

**Erwartet: 3/3 tests passed (grüne Ausgabe)**

### Test 1: CQL Parameter Fallback
Validiert, dass alle drei CQL-Parameter-Namen funktionieren:
- `patt=<cql>` (Standard)
- `cql=<cql>` (Fallback 1)
- `cql_query=<cql>` (Fallback 2)

**Check:** Alle liefern identische `numberOfHits`

### Test 2: Filter Reduzierung
Validiert, dass Filter die Ergebnismenge reduzieren.

**Check:**
- Ohne Filter: z.B. 1234 hits
- Mit Filter (country=ARG): z.B. 456 hits
- Assertion: 456 <= 1234 ✓

### Test 3: Export Route
Validiert CSV-Export Funktionalität.

**Check:**
- Content-Type: `text/csv`
- HTTP 200
- CSV Zeilen = DataTables Hits + 1 (Header)

---

## Manuelle Tests (für Debug)

### 1. DataTables Endpoint testen

#### Simple Query
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&mode=forma&sensitive=1' | jq .
```

**Erwartet:**
```json
{
  "draw": 1,
  "recordsTotal": 1234,
  "recordsFiltered": 1234,
  "data": [
    ["para que", "radio", "en directo", "ARG", "pro", "m", "lectura", "general", "file.mp3", "national", "tok_123", "125000", "135000"],
    ...
  ]
}
```

#### Mit Filter
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&mode=forma&country_code=ARG&speaker_type=pro' | jq .
```

**Erwartet:** Weniger records als ohne Filter

#### Mit DataTables Pagination
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&draw=1&start=0&length=25' | jq .
```

**Erwartet:** Max 25 rows in `data` array

### 2. CQL Modes testen

#### forma_exacta (case-sensitive)
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=Radio&mode=forma_exacta' | jq '.recordsTotal'
```

**Erwartet:** Nur Großbuchstaben "Radio"

#### forma (normalized)
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&mode=forma&sensitive=0' | jq '.recordsTotal'
```

**Erwartet:** Mehr hits als "forma_exacta" (case-insensitive)

#### lemma
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=ir&mode=lemma' | jq '.recordsTotal'
```

**Erwartet:** Alle Flexionen von "ir" (gehe, gehst, gehen, ...)

### 3. Export Route testen

#### CSV Export
```bash
curl -s 'http://localhost:8000/search/advanced/export?q=radio&mode=forma&format=csv' \
  -o test.csv && wc -l test.csv
```

**Erwartet:** 
- HTTP 200
- File nicht leer
- First line = Header

#### TSV Export
```bash
curl -s 'http://localhost:8000/search/advanced/export?q=radio&mode=forma&format=tsv' \
  -o test.tsv && head -1 test.tsv
```

**Erwartet:**
- Content-Type: `text/tab-separated-values`
- Header mit Tabs statt Kommas

#### Export mit Filter
```bash
curl -s 'http://localhost:8000/search/advanced/export?q=radio&country_code=ARG&country_code=CHL&format=csv' \
  -o test.csv && wc -l test.csv
```

**Erwartet:** Weniger Zeilen als ohne Filter

### 4. Fehlerbehandlung testen

#### Ungültiges CQL
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=%5B%5B' -w '\n%{http_code}\n' | jq .
```

**Erwartet:**
- HTTP 400
- `{"error": "invalid_cql", "message": "..."}`

#### Timeout (lange Query)
```bash
timeout 30 curl -s 'http://localhost:8000/search/advanced/data?q=a&mode=forma&sensitive=0' \
  > /dev/null && echo "OK" || echo "TIMEOUT"
```

**Erwartet:** Sollte in < 30 Sekunden antworten (Timeout 180s im BLS)

#### BLS nicht erreichbar
```bash
# Stoppe BLS
pkill -f "blacklab-server"

# Test Query
curl -s 'http://localhost:8000/search/advanced/data?q=radio' -w '\nHTTP %{http_code}\n'
```

**Erwartet:**
- HTTP 502
- `{"error": "upstream_error", "message": "..."}`

---

## Performance Testing

### Response Time
```bash
time curl -s 'http://localhost:8000/search/advanced/data?q=radio&length=100' > /dev/null
```

**Ziel:**
- < 2 Sekunden für einfache Query
- < 10 Sekunden für komplexe Multi-Filter-Query

### Export Streaming
```bash
time curl -s 'http://localhost:8000/search/advanced/export?q=radio&format=csv' \
  -o test.csv && du -h test.csv
```

**Ziel:**
- < 30 Sekunden für 10.000 hits
- < 60 Sekunden für 50.000 hits

### Rate Limiting
```bash
# 31 requests in quick succession (limit = 30/min)
for i in {1..31}; do
  curl -s 'http://localhost:8000/search/advanced/data?q=radio' \
    -w 'Request %d: HTTP %{http_code}\n' | tail -1
done
```

**Erwartet:**
- Requests 1-30: HTTP 200
- Request 31: HTTP 429 (Too Many Requests)

---

## Filter Combinations Testing

### Single Country
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&country_code=ARG' | jq '.recordsTotal'
```

### Multiple Countries (OR)
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&country_code=ARG&country_code=CHL&country_code=MEX' | jq '.recordsTotal'
```

**Erwartet:** Summe der einzelnen Länder (OR-Logik)

### Country + Speaker Type + Sex (AND)
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&country_code=ARG&speaker_type=pro&sex=m' | jq '.recordsTotal'
```

**Erwartet:** Kleinste Schnittmenge (AND zwischen Facetten)

### Regional Inclusion
```bash
curl -s 'http://localhost:8000/search/advanced/data?q=radio&include_regional=0' | jq '.recordsTotal'
# vs
curl -s 'http://localhost:8000/search/advanced/data?q=radio&include_regional=1' | jq '.recordsTotal'
```

**Erwartet:** include_regional=1 liefert mehr Hits

---

## Troubleshooting

### "No JSON object could be decoded"
→ BLS antwortet nicht mit JSON (wahrscheinlich 502 Bad Gateway)
→ Check: `curl http://localhost:8081/blacklab-server/`

### "Invalid CQL syntax"
→ Query kann nicht geparst werden
→ Check: BLS-Logs für CQL-Detail
→ Versuchen: Query mit mehr Kontext (`radio` → `[lemma="radio"]`)

### "Timeout"
→ BLS zu langsam (180s überschritten)
→ Check: BLS Memory: `free -h`
→ Check: BLS Query Complexity
→ Solution: Erhöhe BLS Memory oder Query spezifischer machen

### "429 Too Many Requests"
→ Rate Limit überschritten
→ Wait: 60 Sekunden, dann neuer Versuch
→ (oder erhöhe Limit in `advanced_api.py`)

---

## Success Criteria

✅ **Alle Tests passed:**
```bash
python scripts/test_advanced_search_real.py
# Output: Result: 3/3 tests passed
```

✅ **Filterung funktioniert:**
- Filter reduzieren Ergebnisanzahl messbar

✅ **Export funktioniert:**
- CSV hat mindestens Header + 1 Datenzeile
- Zeilenzahl ≤ 50.000 (Hard Cap)

✅ **Performance akzeptabel:**
- DataTables Response: < 10 Sekunden
- Export Streaming: < 60 Sekunden (für 50k Hits)

✅ **Fehlerbehandlung:**
- Ungültiges CQL → 400 mit Detail
- BLS down → 502
- Timeout → 504

---

## Regression Tests (vor Produktion)

1. **Simple Search (Legacy)** `/corpus` muss noch funktionieren
2. **Player** Audio-Links in KWIC-Results müssen funktionieren
3. **Stats** Statistiken-Tab muss noch funktionieren
4. **Auth** Login/Logout muss noch funktionieren

---

## Siehe auch

- [Advanced Search How-To](../how-to/advanced-search.md) - Benutzer-Anleitung
- [Production Deployment](production-deployment.md) - Deployment-Schritte
- [Runbook Advanced Search](runbook-advanced-search.md) - Incident-Response
- [Search API Reference](../reference/blacklab-api-proxy.md) - API-Details
