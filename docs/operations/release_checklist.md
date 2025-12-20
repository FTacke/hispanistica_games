# Release Checklist

> **Version:** 1.0  
> **Last Updated:** 2025-11-27

Use this checklist before every production deployment.

---

## Pre-Release

### Code Quality

- [ ] All CI checks pass (lint, tests, MD3 guards)
- [ ] No ruff errors: `ruff check src tests scripts`
- [ ] No format issues: `ruff format --check src tests scripts`
- [ ] MD3 lint passes: `python scripts/md3-lint.py`

### Tests

- [ ] Unit tests pass: `pytest`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] Manual smoke test on staging (if available)

### Security

- [ ] No hardcoded secrets in codebase
- [ ] `.env.example` updated if new variables added
- [ ] FLASK_SECRET_KEY and JWT_SECRET_KEY are production-strength
- [ ] JWT_COOKIE_SECURE=True for HTTPS

### Database

- [ ] Auth migrations applied
- [ ] Backup created before schema changes
- [ ] Admin account verified

### Documentation

- [ ] CHANGELOG.md updated with version and changes
- [ ] Breaking changes documented
- [ ] New features documented in relevant docs/

---

## Deployment

### Before

- [ ] Notify team of deployment window
- [ ] Create database backup
- [ ] Note current git SHA for rollback

### During

- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Apply migrations if needed
- [ ] Restart application server

### After

- [ ] Verify health endpoint: `curl https://your-domain/health`
- [ ] Verify BlackLab: `curl https://your-domain/health/bls`
- [ ] Verify auth: `curl https://your-domain/health/auth`
- [ ] Test login flow manually
- [ ] Check error logs for issues

---

## Post-Release Smoke Tests

### Authentication

- [ ] Login with valid credentials → success
- [ ] Login with invalid credentials → error message
- [ ] Logout → session cleared
- [ ] Password reset request → email sent (if configured)

### Search

- [ ] Simple search returns results
- [ ] Advanced search with filters works
- [ ] Player loads audio correctly

### Admin

- [ ] Admin dashboard accessible (admin user)
- [ ] User list loads
- [ ] Can create new user invite

### Pages

- [ ] Landing page loads
- [ ] Impressum/Privacy pages load
- [ ] 404 page renders for invalid URLs

---

## Rollback Procedure

If issues are detected:

1. **Immediate:** Revert to previous git SHA
   ```bash
   git checkout <previous-sha>
   pip install -r requirements.txt
   # Restart server
   ```

2. **Database:** Restore from backup if schema changes caused issues

3. **Notify:** Alert team of rollback and root cause

---

## Emergency Contacts

- **Lead Developer:** [Add contact]
- **DevOps/Hosting:** [Add contact]
- **Security Issues:** [Add contact]
