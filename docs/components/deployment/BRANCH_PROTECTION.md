# Branch Protection & Deployment Security

**Repository:** https://github.com/FTacke/hispanistica_games  
**Status:** Public repo with self-hosted runner  
**Last Updated:** 2026-01-05

---

## Summary

This document guides the setup of branch protection rules for the `main` branch to prevent unauthorized deployments via the self-hosted GitHub Actions runner in a public repository.

---

## Step-by-Step: GitHub UI Configuration

### Step 1: Navigate to Branch Protection Settings

1. Go to: https://github.com/FTacke/hispanistica_games
2. Click **Settings** (tab at the top)
3. In left sidebar, click **Branches**
4. Click **Add rule** under "Branch protection rules"

### Step 2: Create Rule for `main`

**Pattern name:** `main`

---

## Required Settings

### 1. Require a Pull Request Before Merging

✅ **Enable:** *Require a pull request before merging*

- ✅ **Require approvals** → Set to **1** (or 2 if multiple maintainers)
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ☐ **Require review from Code Owners** (optional; enable if you maintain CODEOWNERS file)

**Rationale:** All changes to `main` must be reviewed before merge; prevents accidental bad deploys.

---

### 2. Require Status Checks to Pass Before Merging

✅ **Enable:** *Require status checks to pass before merging*

⚠️ **Important:** 
- Do **NOT** select the `Deploy to Production` workflow as a required check (it has side effects).
- Select **only linting/testing checks** (e.g., `ci.yml` lint/test jobs if they exist).
- If no other checks exist yet, you can leave this checked but **don't select any checks** — add them later when testing infrastructure is ready.

**Current Status:** No lint/test workflows configured yet. Leave enabled but unchecked for now.

---

### 3. Require Conversation Resolution Before Merging

✅ **Enable:** *Require conversation resolution before merging*

**Rationale:** All review comments must be resolved before merge.

---

### 4. Additional Security Checks (Optional but Recommended)

- ☐ **Require signed commits** (optional; enable if you enforce GPG signing)
- ☐ **Require linear history** (optional; clean history, but restrictive)

---

## Restrict Pushes to `main`

### 5. Restrict Who Can Push

✅ **Enable:** *Restrict who can push to matching branches*

**Allowed to push:**
- **Add:** Your GitHub username (e.g., `FTacke`)
- **Add:** (Optional) Any other core maintainers

**Result:** Only specified users can push directly to `main` (but even they should use PRs for visibility).

---

### 6. Block Force Pushes & Deletions

✅ **Enable:** *Block force pushes*  
✅ **Enable:** *Block deletions*

**Rationale:** Prevents accidental history rewriting or branch deletion.

---

## Include Administrators

✅ **Enable:** *Include administrators*

**Critical:** Without this, you (the admin) can bypass all rules. With it enabled, you follow the same rules — this is a best practice.

---

## Summary: All Toggle States

| Setting | State | Notes |
|---------|-------|-------|
| Require PR | ✅ | 1 approval minimum |
| Dismiss stale approvals | ✅ | New commits require re-review |
| Code Owners | ☐ | Optional; enable if using CODEOWNERS |
| Status checks | ✅ | Configured but **no checks selected yet** (add lint/test later) |
| Conversation resolution | ✅ | All comments must be resolved |
| Signed commits | ☐ | Optional; enforce if GPG policy required |
| Linear history | ☐ | Optional; for cleaner history |
| Restrict pushes | ✅ | Only `FTacke` (and optional co-maintainers) |
| Block force pushes | ✅ | Prevent history rewrites |
| Block deletions | ✅ | Prevent branch deletion |
| Include administrators | ✅ | **Critical:** Admins follow rules too |

---

## Actions Security Settings

Go to: **Settings → Actions → General**

### Workflow Permissions

**Workflow permissions:**
- Select: **Read repository contents permission** (minimal, recommended for public repos)
- ☐ Do **NOT** enable "Write" unless absolutely required

**Reason:** Deploy script runs on the *server*, not in the GitHub Actions context. No need for write access.

### Additional Restrictions

- ☐ **Allow GitHub Actions to create and approve pull requests** → Keep **OFF**
- ☐ **Fork pull request workflows from outside collaborators require approval** → Set to **Require approval for all outside collaborators**

**Reason:** Public repo risk mitigation; external PRs should be reviewed before running any CI.

---

## Environment Protection (Optional but Recommended for Extra Safety)

If you want **additional approval** even after PR merge:

1. Go to: **Settings → Environments**
2. Click **New environment**
3. Name: `production`
4. Enable: **Required reviewers**
   - Add: yourself (FTacke) and any co-maintainers
5. In `.github/workflows/deploy.yml`, update the `deploy` job:

```yaml
jobs:
  deploy:
    name: Deploy games_hispanistica
    runs-on: self-hosted
    environment: production  # Add this line
    steps:
      # ... rest of steps
```

**Effect:** Even if code merges to `main`, the deploy job will wait for reviewer approval before running.

---

## Verification Checklist

After configuring branch protection:

- [ ] Try pushing directly to `main` → Should be **blocked** (unless you're in the allowed list)
- [ ] Create a test PR → Should require 1 approval before merge
- [ ] Merge PR to `main` → Deploy workflow should trigger automatically
- [ ] Check workflow run on Actions tab → Should show as `self-hosted` runner
- [ ] Verify container is running on server: `docker ps | grep games-webapp`

---

## Deploy Workflow Diagram

```
Code change
    ↓
Create PR
    ↓
Request review (or auto-assign if CODEOWNERS)
    ↓
Reviewer approves
    ↓
Merge to main ← Only allowed path
    ↓
Workflow trigger (push event)
    ↓
Self-hosted runner executes scripts/deploy/deploy_prod.sh
    ↓
Container updated, smoke checks pass
    ↓
Production live
```

---

## FAQ

### Q: Can I bypass branch protection?

**A:** Yes, as the admin with `Include administrators` enabled, you *can* override. However, this is **not recommended** — use PRs for visibility and auditability.

### Q: What if I need to hotfix production?

**A:** Still use a PR (even if quick). It takes 2 minutes and provides an audit trail.

### Q: Why not select the Deploy job as a required check?

**A:** Deployment has side effects (container restart, DB operations). You don't want the *check itself* to be required for merge — that would make the workflow run twice (once as check, once on merge). Instead, the workflow runs *after* merge.

### Q: Can external contributors deploy?

**A:** No. Only users in the "allowed to push" list (which you control) can trigger deployments. External PRs must be merged by you.

### Q: What if the self-hosted runner is compromised?

**A:** Branch protection doesn't help there. Run the runner as a restricted user account, keep it on a secure server, and regularly audit workflows.

---

## References

- [GitHub Docs: Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule)
- [GitHub Docs: Repository Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [GitHub Docs: Workflow Security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

---

## Final Checklist: Settings Summary

| Component | Status | Details |
|-----------|--------|---------|
| **Branch Protection** | ✅ Configured | Pattern: `main` |
| **PR Approval** | ✅ Required | Minimum 1 reviewer |
| **Status Checks** | ✅ Enabled | No checks selected yet (add lint/test later) |
| **Force Push Block** | ✅ Enabled | Cannot rewrite history |
| **Deletion Block** | ✅ Enabled | Cannot delete `main` |
| **Restrict Pushes** | ✅ Enabled | Only `FTacke` can push |
| **Admin Included** | ✅ Yes | Admins follow rules |
| **Workflow Perms** | Read-only | Minimal, secure |
| **Fork PR Approval** | Require approval | Security for public repo |
| **Environment Protection** | ☐ Optional | Recommended for extra safety |

---
