# Quick Branch Protection Setup Checklist

**Repo:** https://github.com/FTacke/hispanistica_games  
**Target:** Protect `main` branch from unauthorized deployments

---

## 🔐 GitHub UI Checklist (5 min setup)

### Phase 1: Create Rule

- [ ] Open: https://github.com/FTacke/hispanistica_games/settings/branches
- [ ] Click **Add rule**
- [ ] Enter pattern: `main`

### Phase 2: Enable Protections

#### Pull Request Requirements
- [ ] ✅ Require a pull request before merging
  - [ ] ✅ Require approvals: **1**
  - [ ] ✅ Dismiss stale pull request approvals when new commits are pushed
  - [ ] ☐ Require review from Code Owners (optional)

#### Status Checks
- [ ] ✅ Require status checks to pass before merging
  - [ ] ⚠️ **Do NOT select Deploy workflow**
  - [ ] (Select lint/test checks when available; leave empty for now)

#### Conversation & Commits
- [ ] ✅ Require conversation resolution before merging
- [ ] ☐ Require signed commits (optional)
- [ ] ☐ Require linear history (optional)

#### Administrative Controls
- [ ] ✅ Include administrators (CRITICAL!)

### Phase 3: Restrict Pushes

- [ ] ✅ Restrict who can push to matching branches
  - [ ] Add: `FTacke` (yourself)
  - [ ] (Add other maintainers if applicable)

### Phase 4: Block Destructive Actions

- [ ] ✅ Block force pushes
- [ ] ✅ Block deletions

### Phase 5: Click Save

- [ ] Click **Create** or **Save** button

---

## 🔒 Actions Security Settings (2 min setup)

- [ ] Open: https://github.com/FTacke/hispanistica_games/settings/actions
- [ ] **Workflow permissions:** Set to `Read repository contents permission`
- [ ] **Create & approve PRs:** OFF
- [ ] **Fork PR workflows:** ON "Require approval for all outside collaborators"
- [ ] Click **Save**

---

## ✅ Verification (After Setup)

### Can you push directly to main?
```bash
git checkout main
git commit --allow-empty -m "test"
git push origin main
# Expected: REJECTED (branch protection active)
```

### Create a test PR
- [ ] Create feature branch
- [ ] Make a test commit
- [ ] Push and create PR on GitHub
- [ ] Approve your own PR (if you're the reviewer)
- [ ] Merge to main
- [ ] Deploy workflow should trigger automatically

### Check deployment
- [ ] Visit: https://github.com/FTacke/hispanistica_games/actions
- [ ] Should see "Deploy to Production" workflow running
- [ ] Should show `self-hosted` as runner
- [ ] Verify container is updated on server

---

## 📋 Final Configuration Summary

```
Branch:                main
Require PR:            YES (1 approval)
Status Checks:         YES (none selected yet)
Conversation Resolve:  YES
Restrict Pushes:       YES (FTacke only)
Block Force Push:      YES
Block Delete:          YES
Include Admins:        YES
Signed Commits:        NO
Linear History:        NO
Workflow Perms:        Read-only
Environment Protect:   NO (optional, not enabled)
```

---

## 🚀 Expected Workflow After Setup

1. **Developer makes change** → Push to feature branch
2. **Create PR** → Automatic review request (if CODEOWNERS set)
3. **Reviewer approves** → 1 approval required
4. **Merge to main** → Only via GitHub UI (branch protection enforced)
5. **Deployment auto-triggers** → `push` event on `main` fires workflow
6. **Self-hosted runner executes** → `scripts/deploy/deploy_prod.sh` runs
7. **Smoke checks verify** → Health endpoint confirms deployment

---

## 🔑 Key Points

- ✅ No direct pushes to `main` (unless you override protection)
- ✅ All merges require PR + approval
- ✅ Deploy only happens on successful merge to `main`
- ✅ Deploy can also be triggered manually via `workflow_dispatch` (GitHub UI: Actions tab → Deploy to Production → Run workflow)
- ✅ Public repo is protected from external malicious PR exploits
- ✅ Self-hosted runner is only invoked by protected pushes

---

## ⚠️ Important Notes

1. **Don't select Deploy workflow as status check** — it's side-effecty and would run twice
2. **Include administrators must be ON** — without it, you can bypass protections
3. **Only allow trusted users to push** — we set `FTacke` only
4. **Fork PRs require approval** — external contributors can't trigger unwanted deploys

---

**Done?** Update the main deployment README and commit the branch protection docs.

```bash
git add docs/components/deployment/BRANCH_PROTECTION.md
git commit -m "docs: add branch protection setup guide"
git push origin main
```
