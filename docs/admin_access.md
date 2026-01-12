# Admin Access Management

> **This document describes how admin users are created, accessed, and managed across deployments without losing access due to deployment changes.**

## Quick Answer: Why Admin Access Disappears

**Root Cause**: In previous deployments, the `docker-entrypoint.sh` called `create_initial_admin.py` **on every deployment**, which would **overwrite the admin password** even if the user already existed. This happened because:

1. Deploy script had no guard against overwriting existing admins
2. `START_ADMIN_PASSWORD` env var would reset the password on every deploy
3. Old credentials became invalid after each deploy

**The Fix**: Separate bootstrap (initial setup) from normal deployments using the `ADMIN_BOOTSTRAP=1` flag.

---

## 🚀 Initial Deployment: Setting Up Admin

### On First Deployment (Initial Setup)

Use `ADMIN_BOOTSTRAP=1` to enable admin user creation:

```bash
# Set environment variables
export ADMIN_BOOTSTRAP=1
export START_ADMIN_USERNAME=admin
export START_ADMIN_PASSWORD=your-secure-password-here

# Deploy the app
docker-compose -f docker-compose.prod.yml up -d
```

Or via `.env` file:

```dotenv
# .env.prod
ADMIN_BOOTSTRAP=1
START_ADMIN_USERNAME=admin
START_ADMIN_PASSWORD=your-secure-password-here

# ... other config ...
```

**What happens**:
1. `docker-entrypoint.sh` checks for `ADMIN_BOOTSTRAP=1`
2. If set, calls `create_initial_admin.py` to create the user
3. If user doesn't exist: creates new admin with given password
4. If user exists: unlocks it but **preserves** the existing password

### After Initial Setup: Disable Bootstrap

Once admin user is created and you can log in:

```bash
# Remove bootstrap variables from .env
# .env.prod
ADMIN_BOOTSTRAP=0  # or just omit this line

# Redeploy to apply changes
docker-compose -f docker-compose.prod.yml up -d
```

**Why**: This prevents accidental password resets on future deployments.

---

## 🔐 Normal Deployments: Protecting Admin Credentials

### Before Each Deploy

**Verify**:
- `ADMIN_BOOTSTRAP` is **NOT** set or is `0`
- `START_ADMIN_PASSWORD` is **NOT** set or is empty

```bash
# Check current env
grep ADMIN_BOOTSTRAP .env.prod
grep START_ADMIN_PASSWORD .env.prod

# Should output nothing or ADMIN_BOOTSTRAP=0
```

**What happens on deploy** (with bootstrap disabled):
1. `docker-entrypoint.sh` runs
2. Skips admin bootstrap (because `ADMIN_BOOTSTRAP != 1`)
3. App starts with existing admin credentials intact
4. Admin can log in with the same password as before

---

## 🔑 Resetting Admin Password (In Production)

If the admin password is forgotten or needs rotation:

### Option 1: CLI Command (Recommended)

SSH into the server and use the dedicated password reset tool:

```bash
# SSH to server
ssh root@games.hispanistica.com

# Navigate to app directory
cd /srv/webapps/games_hispanistica/app

# Reset admin password
python scripts/admin_reset_password.py \
  --username admin \
  --password your-new-secure-password

# Output:
# ✓ Password reset for admin user 'admin'
# ✓ Account unlocked and cleared of failed login flags
```

**What this does**:
- Changes ONLY the password hash
- Unlocks the account if locked
- Clears failed login count
- Preserves all other user data (created_at, email, etc.)

**What this does NOT do**:
- Does not create the user (must exist first)
- Does not change username or email
- Does not modify role or permissions

### Option 2: Using Environment Variables

If you prefer to reset via deployment:

```bash
# This will ONLY work if you explicitly enable bootstrap
# Set these variables:
export ADMIN_BOOTSTRAP=1
export START_ADMIN_PASSWORD=new-secure-password

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Then disable bootstrap again for future deploys
```

**⚠️ Caution**: Don't leave `ADMIN_BOOTSTRAP=1` enabled permanently.

---

## 📋 Environment Variables Reference

### Bootstrap Variables (First Deploy Only)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `ADMIN_BOOTSTRAP` | No | `1` | Set to `1` to enable. Defaults to `0` (disabled) |
| `START_ADMIN_USERNAME` | No | `admin` | Defaults to `"admin"` if not set |
| `START_ADMIN_PASSWORD` | **Yes** (if `ADMIN_BOOTSTRAP=1`) | (secure string) | Must be set if bootstrap is enabled |

### Security Variables (All Deployments)

| Variable | Required | Example |
|----------|----------|---------|
| `FLASK_SECRET_KEY` | **Yes** | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_SECRET_KEY` | **Yes** | Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `AUTH_DATABASE_URL` | **Yes** (Prod) | `postgresql://user:pass@host:5432/dbname` |

### Complete `.env.prod` Template

```dotenv
# ============================================
# Flask & Security
# ============================================
FLASK_ENV=production
FLASK_DEBUG=false
FLASK_SECRET_KEY=<generate-strong-random-secret>
JWT_SECRET_KEY=<generate-strong-random-secret>

# ============================================
# Database
# ============================================
AUTH_DATABASE_URL=postgresql://hispanistica_auth:password@localhost:5432/hispanistica_auth

# ============================================
# Admin User - FIRST DEPLOYMENT ONLY
# ============================================
# Uncomment these lines ONLY for initial deployment
# Remove them after admin can log in
# ADMIN_BOOTSTRAP=1
# START_ADMIN_USERNAME=admin
# START_ADMIN_PASSWORD=your-secure-password

# ============================================
# Session & Cookies
# ============================================
JWT_COOKIE_SECURE=true
JWT_COOKIE_SAMESITE=lax
FLASK_SESSION_SAMESITE=lax
```

---

## 🔄 How Deployments Work Now

### Before Fix (Broken)

```
Deploy #1:
  - START_ADMIN_PASSWORD=pass1
  - Admin "admin" created with pass1
  
Deploy #2 (with START_ADMIN_PASSWORD=pass1):
  - Script sees admin exists
  - Script OVERWRITES password anyway ⚠️
  - Still pass1, but refreshed...

Deploy #3 (with START_ADMIN_PASSWORD=pass2):
  - Script OVERWRITES password to pass2 ⚠️
  - Admin now locked out from using old credentials!
```

### After Fix (Secure)

```
Deploy #1 (with ADMIN_BOOTSTRAP=1, START_ADMIN_PASSWORD=pass1):
  - Admin "admin" created with pass1
  
Deploy #2 (ADMIN_BOOTSTRAP=0):
  - Script sees admin exists
  - Script ONLY unlocks (doesn't touch password) ✓
  - Admin can still use pass1

Deploy #3 (ADMIN_BOOTSTRAP=0):
  - Script skips bootstrap entirely ✓
  - Admin password untouched
  - Admin can still use pass1

Password reset (explicit):
  - Use admin_reset_password.py script
  - Only when intentionally needed
```

---

## ✅ Testing Admin Persistence

### Local Development

After deploying locally, verify admin still works:

```bash
# Login as admin
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Should return 200 with auth token, not 401
```

### Production Testing

```bash
# SSH to server
ssh root@games.hispanistica.com

# Test admin login
curl -X POST https://games.hispanistica.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Should return 200 with auth token
```

---

## 🛠️ Troubleshooting

### Problem: Admin account locked out

**Symptoms**: 
- Can't log in with old password
- Getting "Invalid credentials" repeatedly

**Solution**:

```bash
# SSH to server
ssh root@games.hispanistica.com
cd /srv/webapps/games_hispanistica/app

# Reset password
python scripts/admin_reset_password.py \
  --username admin \
  --password new-secure-password

# Try logging in again
```

### Problem: `ADMIN_BOOTSTRAP=1` but admin creation fails

**Check**:

1. Is `START_ADMIN_PASSWORD` set and non-empty?
   ```bash
   echo $START_ADMIN_PASSWORD
   ```

2. Is database running?
   ```bash
   pg_isready -h localhost -p 5432
   ```

3. Check container logs:
   ```bash
   docker logs games-webapp --tail=50
   ```

### Problem: Admin password changed unexpectedly after deploy

**Check**:

1. Is `ADMIN_BOOTSTRAP=1` still set?
   ```bash
   grep ADMIN_BOOTSTRAP .env.prod
   ```

2. Was `START_ADMIN_PASSWORD` recently changed?
   ```bash
   grep START_ADMIN_PASSWORD .env.prod
   ```

**Fix**: Disable bootstrap and redeploy:
```bash
# In .env.prod
ADMIN_BOOTSTRAP=0

# Redeploy
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📚 Related Documents

- [Configuration Guide](../DEPLOYMENT_GUIDE.md)
- [Auth System Overview](../AUTHENTICATION.md)
- [Deployment Checklist](../DEPLOY_CHECKLIST_UTC_TIMER.md)

---

## 🔍 Implementation Details

### How Bootstrap Detection Works

In `scripts/docker-entrypoint.sh`:

```bash
# Only runs if ADMIN_BOOTSTRAP=1
if [ "${ADMIN_BOOTSTRAP:-0}" = "1" ]; then
    # Create or unlock admin user
    python scripts/create_initial_admin.py \
        --username admin \
        --password "$START_ADMIN_PASSWORD"
else
    # Bootstrap disabled - existing credentials preserved
    echo "Skipping admin bootstrap (ADMIN_BOOTSTRAP not set)"
fi
```

### Why Password is Preserved

In `scripts/create_initial_admin.py`:

```python
if existing:
    # Update account state (unlock, clear locks)
    existing.role = "admin"
    existing.is_active = True
    existing.login_failed_count = 0
    # IMPORTANT: NOT setting existing.password_hash here
    # This preserves the existing password on redeploys
    session.commit()
else:
    # Create new user (only on first run)
    new_user = User(
        username=username,
        password_hash=hash_password(password),
        role="admin",
        ...
    )
    session.add(new_user)
    session.commit()
```

---

## 📝 Summary

| Action | When | How | Result |
|--------|------|-----|--------|
| **Create Admin** | First deploy | Set `ADMIN_BOOTSTRAP=1` | New admin created |
| **Preserve Creds** | Normal deploy | `ADMIN_BOOTSTRAP=0` | Password unchanged |
| **Reset Password** | Lost access | Run `admin_reset_password.py` | Password reset, account unlocked |
| **Unlock Account** | Locked after failed logins | Run `admin_reset_password.py` | Cleared login counter, unlocked |

The key principle: **Bootstrap happens once (explicitly), normal deployments don't touch credentials.**
