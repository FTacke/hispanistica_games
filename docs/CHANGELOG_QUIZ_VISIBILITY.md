# CHANGELOG - Quiz Unit Visibility Refactoring

## [Unreleased] - 2026-01-12

### Changed - Quiz Unit Management

#### Core Behavior: Visibility Now Controlled by `is_active` Flag Only

**Breaking Change**: Release status (published/draft/unpublished) no longer affects unit visibility.

- **Before**: Units visible only if `is_active=true` AND in a published release
- **After**: Units visible if `is_active=true` (release status ignored)

#### Impact

**Positive**:
- ✅ Incremental unit management: toggle individual units on/off
- ✅ Immediate visibility control: no publish workflow required
- ✅ Import simplification: new units active by default
- ✅ Flexible mixing: combine units from any release

**Caution**:
- ⚠️ Units from draft/unpublished releases with `is_active=true` will now become visible
- **Action Required**: Before deployment, audit draft releases and set `is_active=false` on units that shouldn't be public

#### Files Modified

**Core Logic**:
- `game_modules/quiz/services.py`
  - `get_active_topics()`: Removed release filtering, filters only by `is_active`
  - `_select_questions_for_run()`: Removed release filtering from question selection

**API Clarifications**:
- `src/app/routes/quiz_admin.py`
  - Updated `publish_release()` docstring: Now labeled as "workflow/history tracking only"
  - Updated `unpublish_release()` docstring: Clarified it doesn't affect visibility

**Tests**:
- `tests/test_quiz_release_filtering.py`
  - Updated test expectations to reflect new behavior
  - Added tests for independent visibility control
  - Tests verify: active units visible regardless of release status

**Documentation** (New):
- `docs/QUIZ_UNIT_VISIBILITY_MODEL.md`: Complete technical specification
- `docs/QUIZ_VISIBILITY_VERIFICATION.md`: Testing and verification guide
- `docs/QUIZ_VISIBILITY_REFACTORING_SUMMARY.md`: Implementation summary
- `docs/ADMIN_GUIDE_QUIZ_UNITS.md`: Admin user guide

#### Migration Notes

**No Database Schema Changes**:
- Existing columns sufficient (is_active, release_id)
- No migrations required

**Data Safety**:
- Existing visible units remain visible (no breaking changes)
- Inactive units remain inactive
- Import service preserves admin's `is_active` decisions

**Pre-Deployment Verification**:
```sql
-- Find units that will newly become visible
SELECT t.id, t.title_key, r.status, t.is_active
FROM quiz_topics t
LEFT JOIN quiz_content_releases r ON t.release_id = r.release_id
WHERE t.is_active = true 
  AND (r.status IN ('draft', 'unpublished') OR r.status IS NULL);
```

#### API Endpoints Affected

**Behavior Unchanged**:
- `GET /api/quiz/topics` - Still returns active topics, but now ignores release status
- `PATCH /api/units/<slug>` - Still toggles is_active (unchanged)
- `DELETE /api/units/<slug>` - Still soft-deletes (unchanged)

**Behavior Clarified**:
- `POST /api/releases/<id>/publish` - Now labeled as workflow tracking only
- `POST /api/releases/<id>/unpublish` - Now labeled as workflow tracking only

#### Rollback Procedure

If needed, revert commits affecting:
1. `game_modules/quiz/services.py` (restore release filtering)
2. `tests/test_quiz_release_filtering.py` (restore old test expectations)
3. Deploy without documentation changes (optional)

#### Testing

**Automated Tests**:
```bash
python -m pytest tests/test_quiz_release_filtering.py -v
```

**Manual Verification**:
1. Import new units → verify visible immediately
2. Toggle unit off → verify disappears from `/api/quiz/topics`
3. Toggle unit on → verify reappears
4. Check draft release units with `is_active=true` → should be visible

See `docs/QUIZ_VISIBILITY_VERIFICATION.md` for complete testing procedures.

#### References

- **Technical Spec**: `docs/QUIZ_UNIT_VISIBILITY_MODEL.md`
- **Verification Guide**: `docs/QUIZ_VISIBILITY_VERIFICATION.md`
- **Implementation Summary**: `docs/QUIZ_VISIBILITY_REFACTORING_SUMMARY.md`
- **Admin Guide**: `docs/ADMIN_GUIDE_QUIZ_UNITS.md`

#### Credits

Implemented as requested: Enable incremental quiz unit management with individual activate/deactivate controls, independent of release workflows.
