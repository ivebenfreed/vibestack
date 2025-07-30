# Development Workflow Rules

## 🚨 MANDATORY WORKFLOW

### Rule 1: GitHub Issue First
- **NEVER** start coding without a GitHub issue
- Issue must include:
  - Clear problem statement or feature description
  - Acceptance criteria (what "done" looks like)
  - Technical notes/approach (if complex)
  - Appropriate labels (bug, feature, enhancement, etc.)

### Rule 2: Use Git Worktrees for All Issues
- **NEVER** work directly in main worktree for issues
- **ALWAYS** create isolated worktree for each GitHub issue
- Format: `git worktree add ../vibestack-issue-[NUMBER] -b issue-[NUMBER]`
- Example: Issue #123 → branch `issue-123` → worktree `../vibestack-issue-123`

### Rule 3: Setup PR Environment for Each Issue
- **ALWAYS** run `PR_NUMBER=[ISSUE] ./scripts/setup-pr-env.sh` in new worktree
- This ensures:
  - Isolated database with fresh production data
  - Unique ports (no conflicts with other issues)
  - Clean environment state
  - Consistent starting point

### Rule 4: Branch Naming Convention
- Format: `issue-[NUMBER]` (e.g., `issue-123`)
- This links the branch to the GitHub issue automatically
- Makes tracking and organization simple

### Rule 5: PR Must Reference Issue
- PR title: `[#123] Brief description of changes`
- PR description must include: `Fixes #123` or `Closes #123`
- This auto-links and auto-closes the issue when PR merges

### Rule 6: Clean Up After Merge
- **ALWAYS** run cleanup script: `PR_NUMBER=[ISSUE] ./scripts/cleanup-pr-env.sh`
- **ALWAYS** remove worktree: `git worktree remove ../vibestack-issue-[NUMBER]`
- This prevents resource leaks and keeps the system clean

## 🛠️ Commands Reference

### Starting New Issue Work
```bash
# 1. Create GitHub issue first (get issue number)

# 2. Create worktree and switch to it
git worktree add ../vibestack-issue-123 -b issue-123
cd ../vibestack-issue-123

# 3. Setup PR environment
PR_NUMBER=123 ./scripts/setup-pr-env.sh

# 4. Start development
pnpm dev:local
```

### Working on Multiple Issues
```bash
# Switch between issues instantly
cd ../vibestack-issue-123  # Work on issue 123
cd ../vibestack-issue-456  # Switch to issue 456
cd ../vibestack            # Back to main for reviews/admin
```

### Finishing Issue Work
```bash
# 1. Push branch and create PR
git push -u origin issue-123

# 2. Create PR with title: "[#123] Your feature description"
# 3. Include "Fixes #123" in PR description

# 4. After PR is merged, cleanup
PR_NUMBER=123 ./scripts/cleanup-pr-env.sh
cd ../vibestack
git worktree remove ../vibestack-issue-123
```

## 🎯 Benefits of This Workflow

### For Individual Developers
- **Zero context switching** - each issue is completely isolated
- **No stashing/committing** - switch between issues instantly
- **Fresh environment** - every issue starts with clean production data
- **Parallel work** - work on multiple issues simultaneously

### For Teams
- **Consistent environments** - everyone gets the same starting state
- **Easy collaboration** - teammates can spin up identical environments
- **No conflicts** - isolated ports and databases prevent interference
- **Better reviews** - reviewers can test PRs in dedicated environments

### For Project Management
- **Clear traceability** - every change links back to a specific issue
- **Better planning** - issues force upfront thinking about requirements
- **Automatic documentation** - GitHub maintains the issue → PR → commit history

## ❌ What NOT to Do

- ❌ Start coding without a GitHub issue
- ❌ Work directly in the main worktree for features
- ❌ Create branches without the `issue-[NUMBER]` format
- ❌ Skip the PR environment setup
- ❌ Forget to cleanup after PR merge
- ❌ Create PRs without referencing the issue

## 🔧 Troubleshooting

### "Port already in use" errors
- Check if you have multiple PR environments running
- Run cleanup script for unused PR numbers
- Use `docker ps` to see running containers

### "Worktree already exists" errors  
- List existing worktrees: `git worktree list`
- Remove old worktree: `git worktree remove ../vibestack-issue-[NUMBER]`

### Database connection issues
- Ensure Docker containers are running: `docker ps`
- Check if PostgreSQL is ready: `docker logs vibestack-postgres`
- Restart containers: `docker-compose restart`

## 📋 Quick Checklist

Before starting any new work:
- [ ] GitHub issue created with clear specs
- [ ] Worktree created: `git worktree add ../vibestack-issue-[N] -b issue-[N]`  
- [ ] Switched to worktree: `cd ../vibestack-issue-[N]`
- [ ] PR environment setup: `PR_NUMBER=[N] ./scripts/setup-pr-env.sh`
- [ ] Development server started: `pnpm dev:local`

Before creating PR:
- [ ] Branch pushed: `git push -u origin issue-[N]`
- [ ] PR title includes issue: `[#N] Description`
- [ ] PR description includes: `Fixes #N` or `Closes #N`

After PR merge:
- [ ] Environment cleaned up: `PR_NUMBER=[N] ./scripts/cleanup-pr-env.sh`
- [ ] Worktree removed: `git worktree remove ../vibestack-issue-[N]`