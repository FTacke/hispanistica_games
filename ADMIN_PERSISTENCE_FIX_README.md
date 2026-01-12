# Branch: fix/admin-persistence

## Summary

This branch fixes the critical issue where **admin login credentials become invalid after every deployment**.

**Root Cause**: The Docker entrypoint script called `create_initial_admin.py` on every deploy, which overwrote the admin password even when the user already existed.

**Solution**: Separate deployment bootstrap (one-time setup) from normal deployments using an explicit `ADMIN_BOOTSTRAP=1` flag.

---

## Changes Made

### Code Changes

1. **`scripts/create_initial_admin.py`** (Lines 160-168)
   - Removed password overwrite for existing users
   - Existing admin is only unlocked/cleared, password preserved
   - New admins still created with provided password on first run

2. **`scripts/docker-entrypoint.sh`** (Lines 126-154)
   - Changed from: `if [ -n "$START_ADMIN_PASSWORD" ]`
   - Changed to: `if [ "${ADMIN_BOOTSTRAP:-0}" = "1" ]`
   - Bootstrap only runs when explicitly enabled

3. **`scripts/admin_reset_password.py`** (NEW)
   - New CLI tool for intentional password resets
   - Safe, audit-friendly approach to password management
   - Never called during deployments (manual only)

### Documentation Changes

1. **`docs/admin_access.md`** (NEW)
   - Complete guide for admin user lifecycle
   - Deployment procedures
   - Password reset instructions
   - Troubleshooting guide

2. **`docs/ADMIN_PERSISTENCE_FIX.md`** (NEW)
   - Technical summary of the fix
   - Detailed root cause analysis
   - Usage instructions
   - Verification checklist

3. **`.env.example`** 
   - Added `ADMIN_BOOTSTRAP` documentation
   - Bootstrap workflow instructions

4. **`.env.prod.example`**
   - Bootstrap variables commented out by default
   - Clear instructions on when to enable
   - Password reset guidance

### Tests

1. **`tests/test_admin_persistence.py`** (NEW)
   - Tests for password preservation across deployments
   - Bootstrap flag behavior validation
   - CLI password reset testing
   - Secret key validation

---

## How to Use

### First Deployment (Initial Setup)

```bash
export ADMIN_BOOTSTRAP=1
export START_ADMIN_PASSWORD=your-secure-password
docker-compose -f docker-compose.prod.yml up -d

# Then disable for subsequent deployments:
unset ADMIN_BOOTSTRAP
unset START_ADMIN_PASSWORD
```

### Normal Deployments (After Bootstrap)

```bash
# Just deploy - admin credentials are preserved
docker-compose -f docker-compose.prod.yml up -d
```

### Password Reset (When Needed)

```bash
ssh root@games.hispanistica.com
cd /srv/webapps/games_hispanistica/app
python scripts/admin_reset_password.py --username admin --password newpass
```

---

## Testing

```bash
# Run the admin persistence test suite
pytest tests/test_admin_persistence.py -v

# All tests should pass:
# - test_admin_bootstrap_creates_new_user
# - test_admin_password_not_overwritten_on_update
# - test_admin_reset_password_cli
# - test_admin_bootstrap_flag_controls_bootstrap
# - test_secret_key_validation
# - test_bootstrap_idempotent_preserves_password
```

---

## Verification Before Merging

### Manual Testing

- [ ] Create test admin with bootstrap enabled
- [ ] Verify password with `admin_reset_password.py`
- [ ] Redeploy without bootstrap
- [ ] Verify old password still works
- [ ] Deploy again
- [ ] Verify credentials still intact

### Automated Testing

- [ ] `pytest tests/test_admin_persistence.py -v` passes
- [ ] All existing tests still pass
- [ ] No new dependencies added

### Documentation

- [ ] README section updated (if needed)
- [ ] `docs/admin_access.md` is complete
- [ ] `.env.example` and `.env.prod.example` updated

---

## What's NOT Affected

- ✅ Regular user authentication
- ✅ Session management
- ✅ Quiz content or gameplay
- ✅ Database schema
- ✅ Performance
- ✅ Secret key management

---

## Rollback Plan

If needed, revert this branch and the issue returns to its previous state:

```bash
git checkout main
git reset --hard HEAD~1
```

The fix is entirely contained in startup scripts and CLI tools, so rollback is safe.

---

## Impact on Production

**Before**: Admin password changes on every deploy → credentials invalidated
**After**: Admin password only changes via explicit CLI or bootstrap flag

**Risk Level**: 🟢 **VERY LOW**
- Only affects startup behavior
- Backward compatible
- Bootstrap is disabled by default (safe)
- Includes comprehensive tests

---

## Questions?

See:
- [docs/admin_access.md](../docs/admin_access.md) - Complete usage guide
- [docs/ADMIN_PERSISTENCE_FIX.md](../docs/ADMIN_PERSISTENCE_FIX.md) - Technical details
- [tests/test_admin_persistence.py](../tests/test_admin_persistence.py) - Test coverage
