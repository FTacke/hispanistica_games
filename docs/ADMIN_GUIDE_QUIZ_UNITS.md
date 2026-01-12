# Quiz Admin: Unit Management Guide

**For**: Content Administrators  
**Updated**: 2026-01-12

## Quick Start

### Making Units Visible/Invisible

**Unit visibility is now controlled by a simple on/off switch** - the `is_active` flag. No need to worry about "releases" or "publishing" anymore.

### Three Ways to Control Visibility

#### 1. **Toggle Button** (Recommended)
- Find unit in admin dashboard
- Click the toggle switch
- Unit appears/disappears immediately in quiz

#### 2. **Delete Button**
- Click the trash/delete icon
- Unit is soft-deleted (hidden but data preserved)
- Can be reactivated by toggling back on

#### 3. **API** (For automation)
```bash
# Hide a unit
curl -X PATCH /api/units/unit_slug -d '{"is_active": false}'

# Show a unit
curl -X PATCH /api/units/unit_slug -d '{"is_active": true}'
```

## Common Tasks

### Adding New Units

1. **Import Content**
   - Upload JSON files + media
   - Units are **active by default** ✅
   - No publish step needed
   - Users can play immediately

2. **Verify in Quiz**
   - Navigate to quiz topic list
   - New units should appear right away

### Removing/Hiding Units

1. **Temporary Hide** (Recommended)
   - Toggle unit off in admin
   - Unit disappears from quiz
   - Data preserved, can toggle back on

2. **Permanent Remove**
   - Same as above (we don't hard-delete)
   - Keep toggled off forever
   - Or: actually delete from database if needed (use with care!)

### Managing Multiple Units

**Scenario**: Import 10 new units, but only want 5 visible

1. Import all 10 (they're active by default)
2. Toggle off the 5 you don't want yet
3. Toggle them on later when ready

**No batch operations needed** - each unit is independent.

### Updating Existing Units

1. Re-import the content (same slug)
2. Content updates automatically
3. **Important**: `is_active` status is preserved!
   - If you had toggled a unit off, it stays off after reimport
   - If you want it visible, toggle it back on manually

## What Changed (For Existing Admins)

### Old Model ❌
- Import → hidden by default
- Must "publish" the release to make units visible
- Unpublishing hides all units in that release
- Can't control individual units

### New Model ✅
- Import → visible by default
- Toggle individual units on/off anytime
- "Publish" is optional (just a workflow marker)
- Full control per unit

## Understanding Releases (Optional Reading)

**Releases are now just import history tracking.** They don't control what users see.

- **Draft** = Recently imported, not marked as final
- **Published** = Marked as "official"
- **Unpublished** = Rolled back or archived

**None of these affect visibility!** Only the is_active toggle matters.

### When to Use Publish/Unpublish

- Internal workflow tracking
- Marking "official" versions
- Keeping import history organized

**NOT needed for**:
- Making units visible (use toggle instead)
- Hiding units (use toggle instead)

## FAQ

### Q: I imported new units but they're not showing?

**A**: Check these:
1. Is `is_active = true`? (Should be by default)
2. Did you import successfully? (Check import logs)
3. If it's a reimport of a previously-hidden unit, you need to toggle it back on

### Q: Can I hide specific units from a release?

**A**: Yes! Just toggle those units off. Other units in the same release can stay visible.

### Q: What happens if I "unpublish" a release?

**A**: Nothing visible to users. Releases don't control visibility anymore. To hide units, toggle them off individually.

### Q: Do I need to publish releases?

**A**: No, it's optional. Only if you want to mark them as "official" for your own tracking.

### Q: Can I have multiple active releases?

**A**: Yes! Units from any release can be active simultaneously. Mix and match as needed.

### Q: What's the difference between delete and toggle off?

**A**: Same thing! Delete is a soft delete (sets is_active=false). You can toggle it back on if needed.

### Q: Will reimporting overwrite my toggle decisions?

**A**: No! If you toggled a unit off, it stays off after reimport. Manual admin decisions are respected.

## Troubleshooting

### Unit Won't Hide

- Check if toggle actually changed (refresh page)
- Verify API call succeeded (check browser console)
- Database issue? Check `is_active` flag directly

### Unit Won't Show

- Was it previously toggled off? (Import preserves that)
- Check `order_index` (might be sorted way down)
- Verify it's in the database (check quiz_topics table)

### Unexpected Units Appearing

- Check which units have `is_active=true`
- Might be old draft/unpublished units now visible (new behavior)
- Toggle off any you don't want public

## Advanced

### Bulk Operations (Via Database)

```sql
-- Hide all units from a specific release
UPDATE quiz_topics 
SET is_active = false 
WHERE release_id = 'release_xyz';

-- Show all units
UPDATE quiz_topics 
SET is_active = true;

-- Check what's visible
SELECT id, title_key, is_active, order_index 
FROM quiz_topics 
WHERE is_active = true 
ORDER BY order_index;
```

### API Automation

```bash
# Get all units
curl /api/units

# Toggle specific unit
curl -X PATCH /api/units/demo_topic \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# Bulk update (multiple units)
curl -X PATCH /api/units/bulk \
  -H "Content-Type: application/json" \
  -d '{"updates": [
    {"id": "unit1", "is_active": false},
    {"id": "unit2", "is_active": true}
  ]}'
```

## Summary

✅ **Simple**: Just toggle units on/off  
✅ **Immediate**: Changes take effect instantly  
✅ **Flexible**: Mix units from any release  
✅ **Safe**: Soft delete preserves data  
✅ **Independent**: Each unit controlled separately  

**Bottom line**: Ignore releases, use toggles.

---

**Questions?** See [QUIZ_UNIT_VISIBILITY_MODEL.md](./QUIZ_UNIT_VISIBILITY_MODEL.md) for technical details.
