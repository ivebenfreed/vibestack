# Migration Strategy

## Overview

Safe migration from port-based to container-based worktree isolation with parallel deployment, rollback capabilities, and database sync preservation.

## Migration Approach

### Feature Flag Strategy

Use environment variable `CONTAINER_MODE` to toggle between systems:

```bash
# Enable container mode per worktree
export CONTAINER_MODE=true

# All scripts check this flag
if [ "${CONTAINER_MODE:-false}" = "true" ]; then
    # Use container-based isolation
    ./scripts/worktree-start.sh "$ISSUE_NUMBER"
else
    # Use existing tmux-based isolation  
    ./scripts/tmux-bg.sh "$SESSION_NAME" "$DEV_COMMAND"
fi
```

### Parallel System Operation

Both systems run simultaneously during migration:
- **Existing worktrees**: Continue using tmux + port arithmetic
- **New worktrees**: Opt into container mode
- **Testing**: Validate container mode before full migration
- **Rollback**: Instant fallback to tmux mode if needed

## Database Sync Preservation

### PostgreSQL Data Files in Git

Yes, we can keep PostgreSQL data files in git for easy syncing between systems:

```bash
# Add to .gitignore exceptions
!data/postgres/
!data/postgres/**/*.sql
!data/postgres/base/
!data/postgres/global/

# Sync strategy
git add data/postgres/
git commit -m "feat: sync PostgreSQL data files for easy worktree sharing"
```

### Container Volume Mounting

Mount git-tracked postgres data into containers:

```bash
docker run -d \
  --name "vibestack-issue-${ISSUE_NUMBER}" \
  -v "${PWD}/data/postgres-issue-${ISSUE_NUMBER}:/var/lib/postgresql/data" \
  -v "${PWD}:/app" \
  vibestack-dev:latest
```

### Database Sync Benefits

✅ **Version controlled**: Database schema and data changes tracked in git  
✅ **Easy sharing**: `git pull` syncs database state across worktrees  
✅ **Backup built-in**: Git history provides automatic database backups  
✅ **Branch isolation**: Each worktree has independent PostgreSQL data directory  
✅ **Migration replay**: Database changes can be replayed across environments  

### Sync Implementation

```bash
# scripts/sync-postgres-data.sh
#!/bin/bash
ISSUE_NUMBER="$1"
SOURCE_ISSUE="${2:-main}"

# Stop containers
docker stop "vibestack-issue-${ISSUE_NUMBER}" 2>/dev/null || true

# Sync postgres data from source
rsync -av \
  "data/postgres-issue-${SOURCE_ISSUE}/" \
  "data/postgres-issue-${ISSUE_NUMBER}/"

# Start container with synced data
./scripts/worktree-start.sh "$ISSUE_NUMBER"
```

## Migration Timeline

### Week 1: Foundation
- [ ] Create container image and management scripts
- [ ] Add `CONTAINER_MODE` feature flag to all scripts  
- [ ] Set up postgres data sync in git
- [ ] Test container mode in one worktree

### Week 2: Gradual Migration
- [ ] Migrate 1-2 worktrees to container mode
- [ ] Update test infrastructure for dynamic ports
- [ ] Validate database sync across containers
- [ ] Performance testing and optimization

### Week 3: Full Migration
- [ ] Default `CONTAINER_MODE=true` for new worktrees
- [ ] Migrate remaining active worktrees
- [ ] Remove legacy tmux code
- [ ] Update documentation

## Database Copy Strategy (Simplified)

No migration needed! Each new worktree container simply copies the current staging database state.

### Copy-from-Staging Approach

```bash
# When starting new worktree:
./scripts/worktree-start.sh 60

# Automatically:
1. Copy staging DB → container volume
2. Start container with fresh staging data
3. Ready to work immediately
```

### Git-Tracked Database Implementation (Simplified)

```bash
#!/bin/bash
# scripts/worktree-start.sh - Ultra-simple with git-tracked database
ISSUE_NUMBER="$1"
CONTAINER_NAME="vibestack-issue-${ISSUE_NUMBER}"

echo "🚀 Starting worktree container for Issue #${ISSUE_NUMBER}..."

# Copy git-tracked postgres data to container volume
echo "📋 Copying database from git-tracked data..."
docker volume create "vibestack-db-issue-${ISSUE_NUMBER}"
docker run --rm \
  -v "${PWD}/data/postgres-base:/source:ro" \
  -v "vibestack-db-issue-${ISSUE_NUMBER}:/target" \
  alpine:latest \
  sh -c "cp -a /source/. /target/"

# Start container with git-synced database  
echo "🎯 Starting container with ports 60${ISSUE_NUMBER}0, 61${ISSUE_NUMBER}0..."
docker run -d --name "$CONTAINER_NAME" \
  -p "$((6000 + ISSUE_NUMBER)):5173" \
  -p "$((6100 + ISSUE_NUMBER)):8787" \
  -p "$((6400 + ISSUE_NUMBER)):5432" \
  -v "vibestack-db-issue-${ISSUE_NUMBER}:/var/lib/postgresql/data" \
  -v "${PWD}:/app" \
  vibestack-dev:latest

echo "✅ Container ready! Access at http://localhost:$((6000 + ISSUE_NUMBER))"
```

### Git Repository Structure

```bash
vibestack/
├── apps/
├── packages/  
├── data/
│   └── postgres-base/          # 📋 Committed to git
│       ├── base/
│       ├── global/
│       ├── pg_commit_ts/
│       ├── pg_dynshmem/
│       ├── pg_logical/
│       ├── pg_multixact/
│       ├── pg_notify/
│       ├── pg_replslot/
│       ├── pg_serial/
│       ├── pg_snapshots/
│       ├── pg_stat/
│       ├── pg_stat_tmp/
│       ├── pg_subtrans/
│       ├── pg_tblspc/
│       ├── pg_twophase/
│       ├── pg_wal/
│       ├── pg_xact/
│       ├── postgresql.auto.conf
│       ├── postgresql.conf
│       ├── postmaster.opts
│       └── PG_VERSION
└── .gitignore                  # Track postgres-base/, ignore volumes
```

### Perfect Cross-Machine Experience

| Machine State | Database Source | Setup Time |
|---------------|-----------------|------------|
| **Fresh clone** | `data/postgres-base/` from git | ~5 seconds |
| **Git pull** | Updated `data/postgres-base/` | ~5 seconds |
| **New worktree** | Same `data/postgres-base/` | ~5 seconds |

### Benefits of Git-Tracked Database

✅ **Perfect sync**: Every `git clone` gets identical database state  
✅ **Zero configuration**: No remote downloads or .dev.vars needed  
✅ **Version controlled**: Database changes tracked with code changes  
✅ **Cross-machine consistency**: Same data everywhere  
✅ **Offline ready**: Works without internet or Neon access  
✅ **Instant startup**: No downloads, just copy from git data  
✅ **Independent worktrees**: Each container can modify data freely

## Rollback Procedures

### Immediate Rollback

```bash
# Set flag to disable container mode
export CONTAINER_MODE=false

# Stop all containers
docker stop $(docker ps -q --filter "name=vibestack-issue-*")

# Restart tmux-based development
./scripts/dev-start.sh
```

### Data Recovery

```bash
# If container data corruption occurs:
# 1. Stop container
docker stop "vibestack-issue-${ISSUE_NUMBER}"

# 2. Restore from git-tracked data
git checkout HEAD -- "data/postgres-issue-${ISSUE_NUMBER}/"

# 3. Restart container
./scripts/worktree-start.sh "$ISSUE_NUMBER"
```

### Validation Checkpoints

Each phase includes validation:

```bash
# scripts/validate-migration.sh
#!/bin/bash

echo "🧪 Validating container migration..."

# Test container startup
./scripts/worktree-start.sh 999
sleep 30

# Test web access
curl -f http://localhost:6999/health || exit 1

# Test API access  
curl -f http://localhost:7099/health || exit 1

# Test database access
docker exec vibestack-issue-999 pg_isready -h localhost -p 5432 || exit 1

# Test Playwright
CONTAINER_MODE=true ./scripts/playwright-test.sh tests/playwright/smoke/ || exit 1

echo "✅ Container migration validation passed"
./scripts/worktree-stop.sh 999
```

## Risk Mitigation

### Low-Risk Migration
- **Parallel systems**: No disruption to current workflow
- **Feature flags**: Instant toggle between modes
- **Data preservation**: Git-tracked database state
- **Incremental**: Migrate one worktree at a time

### Contingency Plans
1. **Performance issues**: Tune container resource limits
2. **Port conflicts**: Adjust base port ranges  
3. **Database corruption**: Restore from git history
4. **Test failures**: Fix test infrastructure before full migration
5. **Developer resistance**: Maintain tmux option during transition

This strategy ensures safe migration while preserving the PostgreSQL data sync capabilities that make worktree switching seamless.