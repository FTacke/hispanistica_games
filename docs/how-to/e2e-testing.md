# Advanced Search E2E Testing Guide

**Date:** November 16, 2025  
**Version:** Mapping v2 Integration  
**Status:** Ready for testing

## Prerequisites

1. **BlackLab Server** must be running:
   ```powershell
   .\scripts\start_blacklab_docker_v3.ps1 -Detach
   ```
   Verify: http://localhost:8081/blacklab-server/

2. **Flask Application** must be running:
   ```powershell
   $env:FLASK_APP="src.app:create_app"
   python -m flask run --host=0.0.0.0 --port=8000
   ```
   Verify: http://localhost:8000/health

3. **Full Index** (146 documents) must be built:
   ```powershell
   .\scripts\build_blacklab_index_v3.ps1 -Force -SkipBackup
   ```

---

## Test Suite

### Test A: Basic Lemma Search (No Filters)

**URL:** http://localhost:8000/search/advanced?q=casa&mode=lemma

**Expected Results:**
- Total hits: ~761 (based on direct BlackLab API test)
- Documents: ~139
- No errors
- Results show KWIC context
- Metadata displayed (country, speaker info)

**Validation:**
- [ ] Page loads without errors
- [ ] Total hit count displayed
- [ ] KWIC results visible
- [ ] Left/right context shown
- [ ] No 500/502 errors in browser console

---

### Test B: National Country Filter (ARG)

**URL:** http://localhost:8000/search/advanced?q=casa&mode=lemma&country_code=ARG

**Expected Results:**
- Total hits: ~158 (based on direct BlackLab API test)
- Documents: ~25
- Only ARG national documents in results
- CQL in logs: `[lemma="casa" & country_parent_code="arg"]`

**Validation:**
- [ ] Fewer hits than Test A
- [ ] All results show country="ARG" or similar
- [ ] No regional ARG codes (ARG-CBA, ARG-SDE, ARG-CHU) in results
- [ ] Check Flask logs for correct CQL generation

---

### Test C: Regional Country Filter (ARG-CBA)

**URL:** http://localhost:8000/search/advanced?q=casa&mode=lemma&country_scope=regional&country_parent_code=ARG&country_region_code=CBA

**Expected Results:**
- Total hits: ~33 (based on direct BlackLab API test)
- Documents: ~5
- Only ARG-CBA regional documents
- CQL: `[lemma="casa" & country_scope="regional" & country_parent_code="arg" & country_region_code="cba"]`

**Validation:**
- [ ] Significantly fewer hits than Test B
- [ ] All results show region="CBA" or city="Córdoba"
- [ ] No national ARG documents in results
- [ ] Flask logs show correct regional CQL

---

### Test D: Speaker Filter (Professional + Female)

**URL:** http://localhost:8000/search/advanced?q=casa&mode=lemma&speaker_type=pro&sex=f

**Expected Results:**
- Total hits: Mixed across all countries (no country filter)
- Only professional female speakers
- CQL: `[lemma="casa" & speaker_code="(lib-pf|lec-pf|pre-pf|tie-pf|traf-pf)"]`
- Speaker codes in results: lib-pf, lec-pf, pre-pf, tie-pf, traf-pf

**Validation:**
- [ ] No male speaker codes (lib-pm, lec-pm, etc.) in results
- [ ] No "otro" speaker types (lib-om, lib-of, etc.)
- [ ] Flask logs show correct speaker_code regex
- [ ] Results metadata shows speaker_type=pro, speaker_sex=f

---

### Test E: Combined Filter (ARG + Professional + Libre Mode)

**URL:** http://localhost:8000/search/advanced?q=casa&mode=lemma&country_code=ARG&speaker_type=pro&speech_mode=libre

**Expected Results:**
- Subset of Test B (ARG filter) + Test D (speaker filter)
- Only ARG national, professional speakers in libre mode
- CQL: `[lemma="casa" & speaker_code="(lib-pm|lib-pf)" & country_parent_code="arg"]`
- Speaker codes: lib-pm or lib-pf only

**Validation:**
- [ ] Fewer hits than Test B or Test D alone
- [ ] All results show country=ARG
- [ ] All results show speaker_type=pro, speaker_mode=libre
- [ ] No lectura, pre, or other modes in results
- [ ] Flask logs show combined CQL

---

### Test F: Multiple Countries (ARG + ESP)

**URL:** http://localhost:8000/search/advanced?q=casa&mode=lemma&country_code=ARG&country_code=ESP

**Expected Results:**
- Combined hits from ARG and ESP
- CQL: `[lemma="casa" & country_parent_code="(arg|esp)"]`
- Results include both ARG and ESP documents

**Validation:**
- [ ] More hits than Test B (ARG only)
- [ ] Results show mix of ARG and ESP countries
- [ ] Flask logs show OR regex: `(arg|esp)`
- [ ] No other countries in results

---

### Test G: Speaker Discourse Filter (Tiempo)

**URL:** http://localhost:8000/search/advanced?q=casa&mode=lemma&discourse=tiempo

**Expected Results:**
- Only tiempo discourse segments
- CQL: `[lemma="casa" & speaker_code="(tie-pm|tie-pf)"]`
- Speaker codes: tie-pm or tie-pf only

**Validation:**
- [ ] Results show speaker_discourse=tiempo
- [ ] No general, tránsito, or foreign discourse in results
- [ ] Flask logs show correct speaker_code constraint

---

### Test H: Invalid/Edge Cases

**Test H1: Empty Query**
- URL: http://localhost:8000/search/advanced?q=&mode=lemma
- Expected: 400 error with "Query cannot be empty" message

**Test H2: Impossible Filter Combination**
- URL: http://localhost:8000/search/advanced?q=casa&mode=lemma&speaker_type=n/a
- Expected: 0 results (n/a is only for foreign discourse)

**Test H3: Non-Existent Country**
- URL: http://localhost:8000/search/advanced?q=casa&mode=lemma&country_code=ZZZ
- Expected: 0 results (no matches)

**Validation:**
- [ ] Empty query returns appropriate error
- [ ] Impossible filters return 0 results (not 500 error)
- [ ] Non-existent codes return 0 results gracefully

---

## UI/UX Tests (Browser)

### Test I: Advanced Search Form

Navigate to: http://localhost:8000/search/advanced

**Validation:**
- [ ] Form loads without errors
- [ ] Query input field visible
- [ ] Mode selector (Forma/Lemma/etc.) functional
- [ ] País (country) filter visible with checkboxes
- [ ] Hablante (speaker) filter visible
- [ ] Sexo (sex) filter visible
- [ ] Modo (mode) filter visible
- [ ] Discurso (discourse) filter visible
- [ ] Submit button functional
- [ ] No JavaScript errors in console

### Test J: Filter Interaction

1. Select país: ARG
2. Select hablante: Profesional
3. Select sexo: Femenino
4. Select modo: Habla libre
5. Submit search

**Validation:**
- [ ] All selected filters visible/active
- [ ] URL parameters correctly reflect selections
- [ ] Results match expected combined filter
- [ ] Active filter chips display (if implemented)
- [ ] Clear filters button works (if implemented)

---

## Flask Log Validation

For each test, check Flask logs for:

1. **CQL Generation:** Correct CQL pattern logged
2. **No Errors:** No Python tracebacks
3. **HTTP Status:** All requests return 200 (or appropriate 400 for invalid input)
4. **BlackLab Communication:** Successful calls to BlackLab API

**Example Log Entry:**
```
INFO in cql: CQL with filters: [lemma="casa" & speaker_code="(lib-pf|lec-pf|pre-pf|tie-pf|traf-pf)" & country_parent_code="arg"]
```

---

## Troubleshooting

### Issue: "BlackLab server error: 500"

**Possible causes:**
1. BlackLab container not running
2. CQL syntax error
3. Invalid field name in CQL

**Debug steps:**
1. Check BlackLab is running: `docker ps | findstr blacklab`
2. Check BlackLab logs: `docker logs blacklab-server-v3`
3. Test CQL directly via curl (see examples in test_advanced_search.py)
4. Verify field names match index schema

### Issue: "0 results" (unexpected)

**Possible causes:**
1. Filter too restrictive
2. Case mismatch in field values
3. Missing data in index

**Debug steps:**
1. Test same query without filters
2. Check field values in docmeta.jsonl
3. Verify index has expected documents: http://localhost:8081/blacklab-server/corpora/corapan
4. Test simpler filter combinations

### Issue: JavaScript errors in browser

**Possible causes:**
1. Missing JS modules
2. HTMX/Select2 not loaded
3. Syntax errors in formHandler.js

**Debug steps:**
1. Check browser console for specific errors
2. Verify all JS files load (Network tab)
3. Check formHandler.js for null-safe code
4. Test with browser DevTools enabled

---

## Success Criteria

- [ ] All Tests A-G pass without errors
- [ ] Edge cases (Test H) handled gracefully
- [ ] UI/UX tests (I-J) functional
- [ ] Flask logs show correct CQL for all tests
- [ ] No Python tracebacks in Flask logs
- [ ] No JavaScript errors in browser console
- [ ] Results metadata displays correctly
- [ ] Performance acceptable (<2s per search)

---

## Reporting

After completing tests, document:

1. **Pass/Fail Status** for each test
2. **Screenshots** of key results
3. **Flask Log Samples** showing CQL generation
4. **Any Errors/Issues** encountered
5. **Performance Metrics** (response times)

Save report to: `docs/mapping_new/e2e_test_report_YYYYMMDD.md`

---

**Testing By:** _____________  
**Date:** _____________  
**Version:** Mapping v2  
**Flask Version:** _____________  
**BlackLab Version:** 5.0.0-SNAPSHOT
