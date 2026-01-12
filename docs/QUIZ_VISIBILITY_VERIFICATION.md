# Quiz Unit Visibility - Verification Guide

**Purpose**: Verify that quiz unit visibility is controlled by `is_active` flag only, independent of release status.

## Quick Verification Steps

### 1. Admin Dashboard → API → Frontend Flow

```bash
# Terminal 1: Start local server
python manage.py runserver 8000

# Terminal 2: Test API
# Get active topics (should show all where is_active=true)
curl http://localhost:8000/api/quiz/topics

# Expected: All topics with is_active=true, regardless of release_id
```

### 2. Toggle Unit Visibility

**Via Admin Dashboard**:
1. Navigate to Quiz Admin (typically `/admin/quiz` or similar)
2. Find a unit in the list
3. Click toggle/activate button
4. Verify:
   - Unit appears/disappears in quiz topic list immediately
   - No publish step required
   - Release status doesn't matter

**Via API**:
```bash
# Deactivate a unit
curl -X PATCH http://localhost:8000/api/units/demo_topic \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# Check it's gone from topics
curl http://localhost:8000/api/quiz/topics
# Should NOT contain demo_topic

# Reactivate
curl -X PATCH http://localhost:8000/api/units/demo_topic \
  -H "Content-Type: application/json" \
  -d '{"is_active": true}'

# Check it's back
curl http://localhost:8000/api/quiz/topics
# Should contain demo_topic
```

### 3. Import New Units

```bash
# Import a new release (simulated)
# Units should be active immediately without publish step

# Check database
psql -U your_user -d hispanistica_games -c "
  SELECT id, title_key, is_active, release_id 
  FROM quiz_topics 
  WHERE release_id = 'new_release_id';
"

# Verify is_active = true for new units
# Check API includes them
curl http://localhost:8000/api/quiz/topics | jq
```

### 4. Verify Release Status Doesn't Affect Visibility

```bash
# Get units from a draft release
psql -U your_user -d hispanistica_games -c "
  SELECT t.id, t.title_key, t.is_active, r.status 
  FROM quiz_topics t
  JOIN quiz_content_releases r ON t.release_id = r.release_id
  WHERE r.status = 'draft';
"

# If any have is_active=true, they should appear in API
curl http://localhost:8000/api/quiz/topics | jq '.[] | select(.id=="unit_id_from_draft")'
# Should return the unit (not 404)
```

## Database Verification

### Check Active Units
```sql
-- All visible units
SELECT id, title_key, is_active, release_id, order_index
FROM quiz_topics
WHERE is_active = true
ORDER BY order_index;

-- Units by release status (should NOT affect visibility)
SELECT 
  t.id,
  t.title_key,
  t.is_active,
  r.status AS release_status,
  r.release_id
FROM quiz_topics t
LEFT JOIN quiz_content_releases r ON t.release_id = r.release_id
ORDER BY t.is_active DESC, r.status, t.order_index;
```

### Check Import History
```sql
-- Recent imports
SELECT 
  release_id,
  status,
  imported_at,
  units_count,
  questions_count,
  published_at
FROM quiz_content_releases
ORDER BY imported_at DESC
LIMIT 10;
```

### Find Potentially Problematic Units
```sql
-- Units that are inactive (won't show in quiz)
SELECT id, title_key, release_id, is_active
FROM quiz_topics
WHERE is_active = false;

-- Questions without active topics (orphaned)
SELECT q.id, q.topic_id, t.is_active AS topic_active
FROM quiz_questions q
LEFT JOIN quiz_topics t ON q.topic_id = t.id
WHERE t.is_active = false OR t.id IS NULL;
```

## Expected Behavior Matrix

| Unit Status | Release Status | Visible in Frontend? |
|-------------|----------------|---------------------|
| `is_active=true` | published | ✅ YES |
| `is_active=true` | draft | ✅ YES |
| `is_active=true` | unpublished | ✅ YES |
| `is_active=true` | NULL (legacy) | ✅ YES |
| `is_active=false` | published | ❌ NO |
| `is_active=false` | draft | ❌ NO |
| `is_active=false` | unpublished | ❌ NO |

## Integration Test Scenarios

### Scenario 1: New Import Workflow
1. Import fresh content → units created with `is_active=true`
2. Check `/api/quiz/topics` → new units appear immediately
3. No publish step needed → works out of the box

### Scenario 2: Incremental Management
1. Deactivate unit A → disappears from quiz
2. Import new version of unit A → `is_active` preserved as false
3. Manually activate unit A → appears in quiz
4. Toggle unit B off → disappears immediately

### Scenario 3: Mixed Release States
1. Import release R1 (draft, not published)
2. Units from R1 with `is_active=true` → visible
3. Import release R2 (published)
4. Units from R2 with `is_active=true` → visible
5. Both R1 and R2 units coexist → visibility independent of release status

## Troubleshooting

### Unit not showing in quiz despite is_active=true

**Check**:
```sql
SELECT id, title_key, is_active, order_index, release_id
FROM quiz_topics
WHERE id = 'problematic_unit_id';
```

**Possible causes**:
- `is_active` is actually `false` (check carefully)
- `order_index` is extremely high (sorts to bottom)
- API caching (unlikely but check)

**Fix**:
```sql
UPDATE quiz_topics 
SET is_active = true, order_index = 10 
WHERE id = 'problematic_unit_id';
```

### Units from draft releases not visible

**This is expected only if**:
- `is_active = false` on those specific units
- NOT because the release is draft (that doesn't matter anymore)

**Verify**:
```sql
SELECT t.id, t.is_active, r.status
FROM quiz_topics t
JOIN quiz_content_releases r ON t.release_id = r.release_id
WHERE r.status = 'draft' AND t.is_active = true;
-- These SHOULD be visible
```

### Import doesn't make units visible

**Check import log**:
```bash
tail -f data/import_logs/import_<release_id>.log
```

**Verify import succeeded**:
```sql
SELECT * FROM quiz_content_releases 
WHERE release_id = '<release_id>';
-- Check imported_at is set, units_count > 0
```

**Check if units were created inactive**:
```sql
SELECT id, is_active 
FROM quiz_topics 
WHERE release_id = '<release_id>';
-- Should be true for new units
-- May be false if previously deactivated (preserved on reimport)
```

## Success Criteria

✅ Active units visible regardless of release status  
✅ Inactive units hidden regardless of release status  
✅ Admin can toggle visibility without touching releases  
✅ New imports are active by default  
✅ Reimports preserve manual is_active changes  
✅ Soft delete (is_active=false) removes from frontend  
✅ No data loss (units remain in DB)

## Related Documentation

- [QUIZ_UNIT_VISIBILITY_MODEL.md](./QUIZ_UNIT_VISIBILITY_MODEL.md) - Full technical spec
- [tests/test_quiz_release_filtering.py](../tests/test_quiz_release_filtering.py) - Automated tests
- [game_modules/quiz/services.py](../game_modules/quiz/services.py) - Implementation
