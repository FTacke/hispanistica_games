# Security & Secrets Management

**Last Updated:** 2026-01-05  
**Status:** ✅ SECURE - No secrets exposed in Git  

---

## 1. Security Audit Summary

### Audit Scope:
- All tracked files in repository
- Private keys, certificates, tokens
- Environment files and configuration
- Database credentials
- API keys and tokens
- SSH keys and certificates

### Findings: ✅ **ALL CLEAR**

✅ **No secrets found in Git history**  
✅ **No private keys committed**  
✅ **No API keys exposed**  
✅ **No SSH keys in repo**  
✅ **All .env files properly ignored**  
✅ **Test credentials are non-production values**  

---

## 2. What NEVER Goes Into Git

### Prohibited Content:

| Type | Examples | Action |
|------|----------|--------|
| **Environment files** | `.env`, `.env.local`, `.env.production` | ✅ In `.gitignore` |
| **Password files** | `passwords.env`, `secrets.txt` | ✅ In `.gitignore` |
| **Private keys** | `*.pem`, `*.key`, `id_rsa`, `*.p12` | ✅ In `.gitignore` |
| **Certificates** | `*.crt`, `*.cer` (except CA bundles) | ✅ In `.gitignore` |
| **JWT secrets** | `JWT_SECRET_KEY`, `FLASK_SECRET_KEY` | ❌ NEVER hardcode |
| **Database credentials** | Passwords, connection strings | ❌ NEVER hardcode |
| **API keys** | Third-party service keys | ❌ NEVER hardcode |
| **Session secrets** | Flask session keys | ❌ NEVER hardcode |

---

## 3. Safe Configuration Files

### These ARE Safe to Commit:

✅ `.env.example` - Template with dummy values  
✅ `passwords.env.template` - Setup template  
✅ `pyproject.toml` - Dependency specifications  
✅ `requirements.txt` - Package list (no credentials)  
✅ `docker-compose.yml` - Infrastructure (with env var references)  
✅ CI/CD workflows - With test-only credentials  

### Example: Safe `.env.example`

```bash
# .env.example - SAFE TO COMMIT
# Copy this to .env and fill with real values

# Flask Configuration
FLASK_ENV=development
FLASK_SECRET_KEY=change-me-to-random-64-char-string
DEBUG=True

# Database (use environment-specific values)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
AUTH_DATABASE_URL=postgresql://user:password@localhost:5432/auth

# JWT Authentication
JWT_SECRET_KEY=change-me-to-random-64-char-string
JWT_COOKIE_CSRF_PROTECT=True

# Admin Setup
START_ADMIN_USERNAME=admin
START_ADMIN_PASSWORD=change-me
```

**Notice:** All values are placeholders like `change-me` or `user:password`

---

## 4. CI/CD Test Credentials

### GitHub Actions Test Values:

```yaml
# These are SAFE in CI because:
# 1. Ephemeral test environment
# 2. No production data
# 3. Destroyed after test run

env:
  FLASK_SECRET_KEY: test-key              # OK for CI
  JWT_SECRET_KEY: test-jwt-key            # OK for CI
  POSTGRES_PASSWORD: corapan_auth         # OK for CI
  START_ADMIN_PASSWORD: testpass123       # OK for CI
```

**Why safe:**
- Tests run in isolated containers
- No real user data
- Environment destroyed after run
- Not accessible from outside GitHub Actions

---

## 5. Production Secret Management

### Deployment Strategy:

```bash
# Production Server Setup

# 1. Create secure .env file (NEVER commit this!)
cat > /srv/webapps/hispanistica_games/.env << 'EOF'
FLASK_SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
DATABASE_URL=postgresql://produser:$(pwgen 32 1)@localhost/prod_db
EOF

# 2. Set restrictive permissions
chmod 600 /srv/webapps/hispanistica_games/.env
chown appuser:appgroup /srv/webapps/hispanistica_games/.env

# 3. Load in application
# Docker: Use --env-file flag
docker run --env-file /path/to/.env ...

# Systemd: EnvironmentFile directive
[Service]
EnvironmentFile=/srv/webapps/hispanistica_games/.env
```

### Secret Rotation:

```bash
# Generate new secrets
NEW_JWT_SECRET=$(openssl rand -hex 32)
NEW_FLASK_SECRET=$(openssl rand -hex 32)

# Update .env
sed -i "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$NEW_JWT_SECRET/" .env
sed -i "s/FLASK_SECRET_KEY=.*/FLASK_SECRET_KEY=$NEW_FLASK_SECRET/" .env

# Restart application
systemctl restart hispanistica-games
```

---

## 6. Gitignore Rules (Current State)

### Secrets Protection:

```gitignore
# Environment Variables & Secrets (CRITICAL - NEVER COMMIT!)
.env
.env.local
.env.production
passwords.env
*.env.backup

# JWT Keys (CRITICAL - NEVER COMMIT!)
config/keys/
*.key
*.pem
*.crt
*.cer
```

### Verified Coverage:

✅ All `.env` variants ignored  
✅ All private key types ignored  
✅ Password files ignored  
✅ Certificate files ignored  
✅ JWT key directory ignored  

---

## 7. Audit Commands (Run Periodically)

### Check for Exposed Secrets:

```bash
# Search for potential secrets in committed files
git grep -iE "(password|secret|token|api_key|private_key)" | \
  grep -v ".gitignore" | \
  grep -v "CHANGELOG.md" | \
  grep -v ".env.example" | \
  grep -v "docs/"

# Should return: Empty or only safe references

# Check for private keys
find . -type f \( -name "*.pem" -o -name "*.key" \) \
  -not -path "./.venv/*" -not -path "./venv/*"

# Should return: Empty

# Verify .env is not tracked
git ls-files | grep "\.env$"

# Should return: Empty (only .env.example should be tracked)
```

### Check Git History (if paranoid):

```bash
# Search entire history for accidentally committed secrets
git log --all --full-history --source --oneline -- '*.env'
git log --all --full-history --source --oneline -- '*.pem'
git log --all --full-history --source --oneline -- '*.key'

# Should return: Empty
```

---

## 8. Incident Response

### If a Secret is Accidentally Committed:

**1. IMMEDIATE ROTATION:**
```bash
# Rotate the exposed secret IMMEDIATELY
# Generate new value and update production server
```

**2. Git Cleanup (Use ONLY if absolutely necessary):**
```bash
# Option A: Remove from history (DANGEROUS - coordinate with team)
git filter-repo --path path/to/secret/file --invert-paths

# Option B: BFG Repo-Cleaner (safer)
bfg --delete-files secret-file.env

# After cleanup: Force push (requires team coordination)
git push --force
```

**3. GitHub Secret Scanning:**
```bash
# If secret was pushed to GitHub, they may auto-detect it
# Check: Repository > Security > Secret scanning alerts
```

**4. Documentation:**
- Document incident in `docs/security-incidents.md`
- Update this file with lessons learned
- Review .gitignore rules

---

## 9. Best Practices

### ✅ DO:

1. **Use .env files** for all secrets (ignored by Git)
2. **Use environment variables** in code (`os.getenv()`)
3. **Rotate secrets regularly** (every 90 days)
4. **Use strong random values** (at least 32 characters)
5. **Set restrictive file permissions** (600 for .env files)
6. **Use separate secrets** for dev/staging/prod
7. **Document secret management** in deployment docs
8. **Audit regularly** (monthly git grep for secrets)

### ❌ DON'T:

1. **Never hardcode secrets** in code
2. **Never commit .env files** (even for "just dev")
3. **Never share secrets** via email/Slack/GitHub issues
4. **Never use default values** in production
5. **Never reuse secrets** across environments
6. **Never store secrets** in database without encryption
7. **Never log secrets** (even in debug mode)
8. **Never copy secrets** to clipboard (use password managers)

---

## 10. Verification Checklist

**Before Making Repo Public:**

- [ ] Run `git ls-files | grep "\.env"` → Should be empty
- [ ] Run `git ls-files | grep "password"` → Should be empty
- [ ] Check `.gitignore` includes all secret patterns
- [ ] Verify no private keys in `config/keys/`
- [ ] Search history: `git log --all -- '*.env'` → Empty
- [ ] Review CI/CD workflows for production secrets
- [ ] Confirm all production secrets are rotated
- [ ] Ensure `passwords.env` is not tracked
- [ ] Check for hardcoded database credentials
- [ ] Verify JWT secrets are environment variables

**Current Status (2026-01-05):**

✅ All checks passed  
✅ No secrets exposed  
✅ Safe for public release  

---

## 11. Contact & Reporting

### Report a Security Issue:

🔒 **PRIVATE** security issues:  
**DO NOT** create public GitHub issues for security vulnerabilities.

**Instead:**
- Email: security@hispanistica-games.example (if available)
- GitHub Security Advisory: Use "Report a vulnerability" button
- Maintainer direct contact: [Provide secure channel]

### Questions About This Document:

For non-security questions about secret management:
- Create a GitHub issue (if repo is public)
- Check `docs/operations/deployment.md` for deployment-specific setup

---

**Document Owner:** DevOps / Security Team  
**Review Frequency:** Quarterly or after any security incident  
**Last Security Audit:** 2026-01-05 ✅ PASSED
