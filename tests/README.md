# CO.RA.PAN Tests

This directory contains integration tests and unit tests for the CO.RA.PAN web application.

## Test Structure

- `test_advanced_datatables_results.py` - Integration tests for Advanced Search DataTables endpoint
  - Tests JSON structure, KWIC context, metadata fields
  - Tests filter combinations (país, include_regional, speaker attributes)
  - Tests case handling (display vs. internal codes)
  - Tests pagination and error handling

## Running Tests

### Prerequisites

1. **Python environment**: Ensure dependencies are installed
   ```bash
   pip install -r requirements.txt
   pip install pytest
   ```

2. **BlackLab Server** (optional): Tests will skip gracefully if BlackLab is not available
   ```bash
   # Start BlackLab Docker (if testing with real data)
   .\scripts\start_blacklab_docker_v3.ps1 -Detach
   ```

3. **Flask App**: Ensure the Flask app can be imported
   ```bash
   export FLASK_APP=src/app:create_app
   ```

### Running All Tests

```bash
# From repository root
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=src/app --cov-report=html

# Run specific test file
pytest tests/test_advanced_datatables_results.py -v

# Run specific test
pytest tests/test_advanced_datatables_results.py::test_datatables_json_structure -v
```

### Test Behavior Without BlackLab

All tests are designed to **skip gracefully** if BlackLab is not available:

```python
if not check_blacklab_available(client):
    pytest.skip("BlackLab not available in this environment")
```

This allows tests to run in CI environments or local development without requiring a full BlackLab stack.

### Test Markers

No custom markers are currently used. All tests are integration tests that require the Flask app but will skip if BlackLab is unavailable.

## Test Coverage

### Advanced Search DataTables (`test_advanced_datatables_results.py`)

1. **Structure Tests**
   - `test_datatables_json_structure`: Validates JSON contract (draw, recordsTotal, recordsFiltered, data)
   - `test_datatables_row_fields`: Validates all required fields in each row

2. **KWIC & Metadata Tests**
   - `test_kwic_context_present`: Validates context_left, text, context_right
   - `test_metadata_fields_populated`: Validates país, speaker attributes

3. **Filter Tests**
   - `test_country_filter_esp`: Tests country filtering
   - `test_include_regional_logic`: Tests national vs. regional filtering

4. **Case Handling Tests**
   - `test_case_preservation_in_tokens`: Validates original case preservation in text
   - `test_internal_codes_lowercase`: Validates internal codes are lowercase

5. **Example Sentence Tests** (from `docs/search_ui/search_ui_tests.md`)
   - `test_example_sentence_lemma_alcalde`: Test Case 1 (lemma search)
   - `test_example_sentence_forma_mujer_insensitive`: Test Case 7 (case-insensitive)

6. **Audio & Metadata Tests**
   - `test_audio_metadata_present`: Validates start_ms, end_ms, filename

7. **Error Handling Tests**
   - `test_empty_query_error`: Validates empty query handling

8. **Pagination Tests**
   - `test_pagination_parameters`: Validates start/length parameters

## Adding New Tests

When adding new tests:

1. **Follow the pattern**: Use `check_blacklab_available()` to skip when BlackLab is not available
2. **No mocks**: Tests should use real responses or skip
3. **Document test cases**: Reference manual test cases from `docs/search_ui/search_ui_tests.md`
4. **Use descriptive names**: Test names should clearly indicate what they test
5. **Add assertions**: Always include meaningful assertion messages

Example:
```python
def test_my_new_feature(client):
    """Test description."""
    if not check_blacklab_available(client):
        pytest.skip("BlackLab not available in this environment")
    
    # Test implementation
    params = {'q': 'test', ...}
    response = client.get(f'/search/advanced/data?{urlencode(params)}')
    
    assert response.status_code == 200, "Expected 200 OK"
    data = response.get_json()
    assert data['recordsTotal'] > 0, "Expected results"
```

## Continuous Integration

These tests are designed to run in CI environments:

- Tests skip when BlackLab is unavailable (no failures)
- Tests use Flask test client (no external dependencies except BlackLab)
- Tests are deterministic (no random data, no time-based checks)

## Troubleshooting

### Tests skip with "BlackLab not available"

This is expected behavior when BlackLab server is not running. To run tests with BlackLab:

1. Start BlackLab Docker: `.\scripts\start_blacklab_docker_v3.ps1 -Detach`
2. Verify BlackLab is accessible: `curl http://localhost:8081/blacklab-server/`
3. Run tests: `pytest tests/ -v`

### Import errors

Ensure Flask app can be imported:
```bash
export PYTHONPATH=/path/to/hispanistica_games/src:$PYTHONPATH
pytest tests/ -v
```

### Connection errors

If tests fail with connection errors instead of skipping:

1. Check Flask app configuration (BLS_BASE_URL)
2. Verify Flask test client is properly configured
3. Check firewall/network settings

## Related Documentation

- `docs/components/` - Component documentation
- `docs/search_ui/search_ui_progress.md` - Implementation progress and flow documentation
- `docs/blacklab_stack.md` - BlackLab infrastructure documentation
