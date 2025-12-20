---
title: "CQL Escaping and Validation Rules"
status: active
owner: backend-team
updated: "2025-11-10"
tags: [cql, escaping, validation, security, api-reference]
links:
  - advanced-export-streaming.md
  - ../operations/rate-limiting-strategy.md
  - ../concepts/advanced-search-architecture.md
---

# CQL Escaping and Validation Rules

**Purpose**: API reference for CQL query escaping, validation, and security rules  
**Version**: 1.0  
**Last Updated**: 10. November 2025

---

## Overview

CQL (Contextual Query Language) escaping prevents injection attacks and malformed queries when users provide search patterns. This document specifies the escaping rules implemented in the Advanced Search backend.

**Key Principle**: Defense-in-Depth
- Backend validation rejects suspicious patterns
- Escaping neutralizes special characters
- Frontend differentiation helps users understand errors

---

## Escaping Rules

### Rule 1: Quote Character Escaping

**Pattern**: `"` (double quote)  
**Action**: Escape with backslash `\"`

```
Input:    word"test
Escaped:  word\"test
```

**Reason**: Quotes can break CQL string boundaries in BlackLab

### Rule 2: Backslash Escaping

**Pattern**: `\` (backslash)  
**Action**: Escape with another backslash `\\`

```
Input:    word\path
Escaped:  word\\path
```

**Reason**: Backslashes are escape characters in CQL syntax; must be escaped first (before quotes)

### Rule 3: Escaping Order (CRITICAL)

**ALWAYS escape in this order**:
1. Backslashes first: `\` → `\\`
2. Quotes second: `"` → `\"`

**WRONG** ❌:
```python
escaped = cql.replace('"', '\\"').replace('\\', '\\\\')
# "test\ → "test\\ → "test\\\\ (DOUBLE ESCAPES!)
```

**CORRECT** ✅:
```python
escaped = cql.replace('\\', '\\\\').replace('"', '\\"')
# "test\ → "test\\ → "test\\" (CORRECT)
```

---

## Validation Rules

### Validation 1: Bracket Balancing

**Requirement**: All opening brackets must have matching closing brackets

| Pattern | Valid? | Reason |
|---------|--------|--------|
| `(word)` | ✅ Yes | Balanced |
| `(word` | ❌ No | Missing closing `)` |
| `word)` | ❌ No | Unmatched closing `)` |
| `[word]` | ✅ Yes | Balanced |
| `[(word)]` | ✅ Yes | Nested balanced |
| `(word]` | ❌ No | Mismatched delimiters |

**Implementation**:
```python
def validate_brackets(cql: str) -> bool:
    paren_count = bracket_count = 0
    for char in cql:
        if char == '(': paren_count += 1
        elif char == ')': paren_count -= 1
        elif char == '[': bracket_count += 1
        elif char == ']': bracket_count -= 1
        
        # No negative counts allowed (unmatched closing)
        if paren_count < 0 or bracket_count < 0:
            return False
    
    # Final count must be zero (balanced)
    return paren_count == 0 and bracket_count == 0
```

### Validation 2: Suspicious Pattern Detection

**Patterns REJECTED**:

| Pattern | Description | HTTP Status |
|---------|-------------|-------------|
| `;--` | SQL comment injection | 400 Bad Request |
| `DROP` | SQL DROP statement | 400 Bad Request |
| `DELETE` | SQL DELETE statement | 400 Bad Request |
| `` ` `` (backtick) | Shell command execution | 400 Bad Request |
| `$(..)` | Shell command substitution | 400 Bad Request |
| `&..;` | Shell command chaining | 400 Bad Request |
| `\x00` | Null byte | 400 Bad Request |

**Example Rejections**:
```
CQL:       (word); DROP TABLE index
Status:    400 Bad Request
Error:     "invalid_cql"
Message:   "Invalid CQL: SQL comment injection detected"

CQL:       word`id`.txt
Status:    400 Bad Request
Error:     "invalid_cql"
Message:   "Invalid CQL: Shell metacharacter detected"
```

---

## Escaping Examples

### Example 1: Simple String

```
Input CQL:     palabra
Validation:    ✅ No special chars, brackets balanced
Escaped CQL:   palabra
BlackLab Query: 1 result expected
```

### Example 2: Quote in String

```
Input CQL:     "prueba"documento"
Validation:    ❌ Unescaped quotes break string boundary
Status:        400 Bad Request
User Message:  "Sintaxis CQL inválida: Quote no escapeada"
```

**CORRECT APPROACH**:
```
Input:         prueba"documento
Escaping:      1. No backslashes → skip step 1
               2. Escape quotes: " → \"
Escaped CQL:   prueba\"documento
BlackLab Query: Matches "prueba"documento" as single word
```

### Example 3: Backslash in String

```
Input CQL:     ruta\archivo
Validation:    ✅ Balanced brackets (none)
Escaping:      1. Escape backslash: \ → \\
               2. No quotes → skip step 2
Escaped CQL:   ruta\\archivo
BlackLab Query: Matches "ruta\archivo" literally
```

### Example 4: Complex Query

```
Input:         (prueba AND "documento")
Validation:    ✅ Balanced: ( ) balanced, quotes OK
Escaped:       (prueba AND "documento")
               → No escaping needed (balanced, no special chars)
BlackLab Query: (prueba AND "documento") executed as-is
```

### Example 5: Injection Attempt

```
Input:         palabra; DROP TABLE index
Validation:    ❌ Contains suspicious pattern "; DROP"
Status:        400 Bad Request
Error:         "invalid_cql"
Message:       "Invalid CQL: SQL comment injection"
User Message:  "Patrón sospechoso detectado; no se permiten comentarios SQL"
```

---

## Implementation Reference

### Python Function: `escape_cql_string()`

**Signature**: `escape_cql_string(value: str) → str`

**Purpose**: Escape dangerous characters in a CQL value

**Implementation**:
```python
def escape_cql_string(value: str) -> str:
    """Escape backslashes and quotes for CQL syntax."""
    # CRITICAL: Escape backslashes FIRST
    value = value.replace('\\', '\\\\')
    # Then escape quotes
    value = value.replace('"', '\\"')
    return value
```

**Usage**:
```python
escaped = escape_cql_string(user_input)
# Use escaped in CQL pattern
cql = f'"{escaped}"'  # Now safe for BlackLab
```

**Test Cases**:
```python
assert escape_cql_string('word') == 'word'
assert escape_cql_string('word"') == 'word\\"'
assert escape_cql_string('word\\') == 'word\\\\'
assert escape_cql_string('word\\"') == 'word\\\\\\"'
```

### Python Function: `validate_cql_pattern()`

**Signature**: `validate_cql_pattern(cql: str) → str`

**Purpose**: Validate CQL pattern, raise exception if invalid

**Raises**: `CQLValidationError` on invalid pattern

**Implementation**:
```python
def validate_cql_pattern(cql: str) -> str:
    """Validate CQL pattern and raise exception if invalid."""
    
    # Check for suspicious patterns
    suspicious = [
        (r';--', "SQL comment injection"),
        (r'DROP', "DROP statement"),
        (r'DELETE', "DELETE statement"),
        (r'`', "Shell command (backtick)"),
        (r'\$\(', "Shell substitution"),
        (r'[&|;]', "Shell metacharacter"),
    ]
    
    for pattern, reason in suspicious:
        if re.search(pattern, cql, re.IGNORECASE):
            raise CQLValidationError(f"Invalid CQL: {reason}")
    
    # Check for null bytes
    if '\x00' in cql:
        raise CQLValidationError("Invalid CQL: Null byte detected")
    
    # Check bracket balancing
    paren = bracket = 0
    for char in cql:
        if char == '(':
            paren += 1
        elif char == ')':
            paren -= 1
        elif char == '[':
            bracket += 1
        elif char == ']':
            bracket -= 1
        
        if paren < 0 or bracket < 0:
            raise CQLValidationError("Invalid CQL: Unmatched closing bracket")
    
    if paren != 0 or bracket != 0:
        raise CQLValidationError("Invalid CQL: Unbalanced brackets")
    
    return cql
```

### Python Function: `validate_filter_values()`

**Signature**: `validate_filter_values(filters: dict) → None`

**Purpose**: Validate filter dictionary values

**Raises**: `CQLValidationError` on invalid value

**Implementation**:
```python
def validate_filter_values(filters: dict) -> None:
    """Validate filter values from form submission."""
    
    for filter_name, values in filters.items():
        if not isinstance(values, list):
            values = [values]
        
        for value in values:
            # Check null bytes
            if '\x00' in value:
                raise CQLValidationError(f"Invalid filter value: Null byte")
            
            # Check length
            if len(value) > 1000:
                raise CQLValidationError(f"Invalid filter: Value too long")
```

---

## HTTP Status Codes and Responses

### 400 Bad Request (Invalid CQL)

**Request**:
```
GET /search/advanced/data?q=palabra;DROP&mode=forma
```

**Response**:
```json
{
  "error": "invalid_cql",
  "message": "Invalid CQL: SQL comment injection detected",
  "detail": "Pattern ';--' or '; DROP' detected in query"
}
```

**Status**: 400  
**Content-Type**: `application/json`

### 400 Bad Request (Invalid Filter)

**Request**:
```
GET /search/advanced/data?q=palabra&country_code=INVALID
```

**Response**:
```json
{
  "error": "invalid_filter",
  "message": "Invalid filter value",
  "detail": "country_code: Unknown value 'INVALID'"
}
```

**Status**: 400  
**Content-Type**: `application/json`

### 200 OK (Valid)

**Request**:
```
GET /search/advanced/data?q=palabra&mode=forma
```

**Response**:
```json
{
  "draw": 1,
  "recordsTotal": 256,
  "recordsFiltered": 256,
  "data": [...]
}
```

---

## Security Hardening Timeline

| Date | Change | Reason |
|------|--------|--------|
| 2025-11-10 | Escaping + Validation | Defense-in-Depth |
| TBD | Rate limiting | Prevent abuse |
| TBD | CSP headers | Prevent XSS |
| TBD | Query logging | Audit trail |

---

## Testing CQL Escaping

### Test Suite: `scripts/test_advanced_hardening.py`

**Test 4: CQL Validation Rejection**

```python
def test_cql_validation_rejection():
    """Verify suspicious CQL patterns are rejected."""
    
    suspicious_patterns = [
        '"); DROP TABLE index; --',
        'word`id`.txt',
        '${SHELL_VAR}',
        'word (unclosed',
        'unbalanced]',
    ]
    
    for pattern in suspicious_patterns:
        response = requests.get(
            '/search/advanced/data',
            params={'q': pattern, 'mode': 'forma'}
        )
        assert response.status_code == 400
        assert response.json()['error'] == 'invalid_cql'
```

**Run**: `python scripts/test_advanced_hardening.py`  
**Expected**: Test 4 PASSES ✅

---

## Debugging Escaping Issues

### Issue: Quote escaping not working

**Symptoms**:
```
BlackLab error: "Unexpected character: '" in CQL
User sees: "Syntax error in search query"
```

**Diagnosis**:
1. Check escaping order: backslashes FIRST
2. Verify quotes are escaped: `"` → `\"`
3. Test with: `escape_cql_string('test"word')`
   - Expected: `test\"word`

**Fix**:
```python
# WRONG ORDER
cql = value.replace('"', '\\"').replace('\\', '\\\\')  # ❌

# RIGHT ORDER
cql = value.replace('\\', '\\\\').replace('"', '\\"')  # ✅
```

### Issue: Unbalanced bracket error

**Symptoms**:
```
HTTP 400: Invalid CQL: Unbalanced brackets
User sees: "Parentheses don't match"
```

**Diagnosis**:
1. Count opening `(`: 3
2. Count closing `)`: 2
3. Mismatch: +1 opening

**Fix**:
```
Input:  (word AND (test)
Fix:    (word AND (test))
        ^                ^
        1                2
```

---

## Siehe auch

- [Advanced Export Streaming](advanced-export-streaming.md) - Export endpoint specification
- [Rate Limiting Strategy](../operations/rate-limiting-strategy.md) - API rate limits
- [Advanced Search Architecture](../concepts/advanced-search-architecture.md) - System design
- [Hardening Implementation Report](../archived/IMPLEMENTATION-REPORT-2025-11-10-hardening.md) - Security improvements

---

**Document**: CQL Escaping and Validation Rules  
**Version**: 1.0  
**Status**: Active  
**Owner**: backend-team  
**Last Updated**: 2025-11-10
