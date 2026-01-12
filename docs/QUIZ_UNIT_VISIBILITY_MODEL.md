# Quiz Unit Visibility Model - Refactored

**Status**: Implemented  
**Date**: 2026-01-12

## Overview

Quiz unit visibility is now controlled **solely by the `is_active` flag** on `QuizTopic` and `QuizQuestion` records. The release system (`quiz_content_releases`) is used only for **import history tracking** and no longer gates visibility.

## Key Changes

### Before (Release-Based Visibility)
- Units were visible only if their `release_id` corresponded to a **published** release
- Importing new units required a "publish" step to make them visible
- Unpublishing a release hid all its units from the frontend
- Admin couldn't control individual unit visibility independently

### After (Active-Flag Visibility)
- Units are visible if `is_active == true` (regardless of release status)
- Releases track import history only (when/where content came from)
- Admin can toggle individual units on/off at any time
- New imports are active immediately (no publish step needed)

## Data Model

### QuizTopic / QuizQuestion
```python
is_active: bool  # Controls visibility (default: True on import)
release_id: str | None  # Import history only (optional tracking)
```

### QuizContentRelease
```python
status: str  # "draft" | "published" | "unpublished"
# ⚠️ This field NO LONGER affects unit visibility
# It's kept for import history and workflow tracking only
```

## Behavior

### Frontend Visibility (`get_active_topics()`)
```python
# Returns ALL active topics, regardless of release status
SELECT * FROM quiz_topics WHERE is_active = true ORDER BY order_index
```

### Question Selection (`_select_questions_for_run()`)
```python
# Uses ALL active questions, regardless of release status
SELECT * FROM quiz_questions 
WHERE topic_id = ? AND is_active = true
```

### Import Behavior
- New units: Created with `is_active = true` by default
- Existing units: `is_active` preserved during reimport (admin decision respected)
- Release record: Updated with import metadata, status set to "draft"

### Delete Behavior
- Soft delete: Sets `is_active = false`
- Unit remains in database with all historical data
- Immediately removed from frontend quiz overview

## Admin Workflows

### Adding/Activating Units

1. **Import new content** → Units are active immediately
2. **Toggle inactive units** → Set `is_active = true` in Admin Dashboard
3. **No publish step needed** → Changes take effect instantly

### Deactivating/Removing Units

1. **Toggle off** → Set `is_active = false` (soft delete)
2. **Or use trash button** → Same as above
3. **Unit disappears from quiz overview** → But data preserved for history

### Managing Releases

- **Publish/Unpublish buttons** → Optional workflow markers, don't affect visibility
- **Import history** → Track when/where content came from
- **Recommendation**: Keep publish buttons disabled or mark as "Legacy/Optional"

## Migration Notes

### Production Safety

**Existing Data**: No schema changes required. All existing units remain visible because:
- Units created before this change have `is_active = true` by default
- Release filtering removed means previously-hidden draft units may become visible
  - **Action**: Check draft releases in production, set `is_active = false` on any units that shouldn't be visible yet

### Troubleshooting

**Unit not appearing in quiz overview?**
1. Check `QuizTopic.is_active` (must be `true`)
2. Check `QuizTopic.order_index` (determines sort order)
3. Releases don't matter anymore

**Imported unit not visible?**
1. Should be active by default on fresh import
2. Check if it was previously deactivated (reimport preserves `is_active = false`)
3. Manually set `is_active = true` if needed

## API Endpoints

### Get Active Topics
```
GET /api/quiz/topics
→ Returns all topics where is_active = true
```

### Toggle Unit Activation
```
PATCH /api/units/<slug>
Body: {"is_active": true/false}
→ Immediately affects visibility
```

### Soft Delete Unit
```
DELETE /api/units/<slug>
→ Sets is_active = false (soft delete)
```

## Testing

### Test Coverage
- `test_active_topic_visible_regardless_of_release_status()` ✓
- `test_active_topic_in_draft_release_visible()` ✓
- `test_active_topic_in_unpublished_release_visible()` ✓
- `test_mixed_releases_all_active_visible()` ✓
- `test_admin_can_toggle_visibility_independently()` ✓
- `test_new_import_can_be_active_immediately()` ✓

See: [tests/test_quiz_release_filtering.py](../tests/test_quiz_release_filtering.py)

## Verification Commands

### Check active units
```sql
SELECT id, title_key, is_active, release_id, order_index 
FROM quiz_topics 
WHERE is_active = true 
ORDER BY order_index;
```

### Check import history
```sql
SELECT release_id, status, imported_at, units_count, questions_count 
FROM quiz_content_releases 
ORDER BY imported_at DESC;
```

### Activate/deactivate unit
```sql
-- Activate
UPDATE quiz_topics SET is_active = true WHERE id = 'unit_slug';

-- Deactivate
UPDATE quiz_topics SET is_active = false WHERE id = 'unit_slug';
```

## Related Files

**Core Logic**:
- [game_modules/quiz/services.py](../game_modules/quiz/services.py) - `get_active_topics()`, `_select_questions_for_run()`
- [game_modules/quiz/import_service.py](../game_modules/quiz/import_service.py) - Import logic with `is_active` preservation

**Models**:
- [game_modules/quiz/models.py](../game_modules/quiz/models.py) - `QuizTopic`, `QuizQuestion`
- [game_modules/quiz/release_model.py](../game_modules/quiz/release_model.py) - `QuizContentRelease`

**Admin API**:
- [src/app/routes/quiz_admin.py](../src/app/routes/quiz_admin.py) - Unit management endpoints

**Tests**:
- [tests/test_quiz_release_filtering.py](../tests/test_quiz_release_filtering.py) - Visibility behavior tests

## Summary

✅ **Visibility = `is_active` flag only**  
✅ **Releases = Import history only**  
✅ **Admin can toggle units independently**  
✅ **Soft delete preserves data**  
✅ **Import merge semantics work correctly**  
✅ **Existing prod data stays visible**
