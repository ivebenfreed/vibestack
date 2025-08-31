# Multi-Environment Development Setup

**Unified Cloudflare Worker with Port-Based Isolation**

This system provides 3 persistent development environments that share the same PostgreSQL database but allow isolated code development with different git branches/worktrees.

## Architecture

Each environment runs the **same unified Cloudflare Worker** (frontend + backend) on different ports:

- **main**: `http://localhost:5174` - Staging branch development  
- **dev-1**: `http://localhost:5175` - Feature branch development
- **dev-2**: `http://localhost:5176` - Feature branch development

**Key Benefits:**
- ✅ **Shared Database**: All environments use the same PostgreSQL database
- ✅ **Isolated Code**: Each environment can run different git branches
- ✅ **Persistent**: Environments stay running between sessions
- ✅ **No Conflicts**: Port-based separation prevents conflicts
- ✅ **Unified Worker**: Same architecture as production
- ✅ **Pull Request Workflow**: Easy to submit PRs from feature branches

## Quick Start

### 1. Start All Environments
```bash
./dev-environments/start-all.sh
```

### 2. Work in Specific Environment
```bash
# Switch to dev-1 for feature work
./dev-environments/switch-to.sh dev-1

# Your terminal is now in dev-1 environment
# Make changes, commit, push, create PR
git checkout -b feature/my-new-feature
# ... make changes ...
git commit -m "Add new feature"
git push origin feature/my-new-feature
```

### 3. Manage Environments
```bash
# Check status of all environments
./dev-environments/status.sh

# Stop specific environment
./dev-environments/stop.sh dev-1

# Restart environment
./dev-environments/restart.sh dev-2
```

## Environment Details

| Environment | Port | Directory | Purpose |
|------------|------|-----------|---------|
| **main** | 5174 | `/home/benfreed/dev/vibestack` | Staging branch work |
| **dev-1** | 5175 | `/home/benfreed/dev/vibestack-dev-1` | Feature development |
| **dev-2** | 5176 | `/home/benfreed/dev/vibestack-dev-2` | Feature development |

## Database Sharing

All environments connect to the same PostgreSQL database:
- **Connection**: `postgresql://postgres:postgres@localhost:5432/vibestack_dev`
- **Shared State**: Organizations, users, tasks, etc. are shared
- **Test Data**: Use different organization IDs for isolation when needed

## Git Worktree Integration

Each environment uses git worktrees for true isolation:

```bash
# dev-1 and dev-2 are separate git worktrees
# You can have different branches checked out simultaneously
# Changes in one environment don't affect others until committed
```

## Environment Variables

Each environment has its own configuration:

```bash
# main environment (.env.local)
BETTER_AUTH_URL=http://localhost:5174
VITE_API_BASE_URL=http://localhost:5174/api

# dev-1 environment (.env.local) 
BETTER_AUTH_URL=http://localhost:5175
VITE_API_BASE_URL=http://localhost:5175/api

# dev-2 environment (.env.local)
BETTER_AUTH_URL=http://localhost:5176  
VITE_API_BASE_URL=http://localhost:5176/api
```

## Workflow Examples

### Daily Development
```bash
# Morning: Start all environments
./dev-environments/start-all.sh

# Work on staging in main environment (automatic)
cd /home/benfreed/dev/vibestack
git pull origin staging
pnpm install
# Main environment auto-refreshes at http://localhost:5174

# Start new feature in dev-1
./dev-environments/switch-to.sh dev-1
git checkout -b feature/new-component
# Work at http://localhost:5175

# Bug fix in dev-2  
./dev-environments/switch-to.sh dev-2
git checkout -b fix/auth-issue
# Work at http://localhost:5176
```

### Pull Request Workflow
```bash
# Feature complete in dev-1
cd /home/benfreed/dev/vibestack-dev-1
git add .
git commit -m "feat: implement new dashboard component"
git push origin feature/new-component

# Create PR via GitHub CLI
gh pr create --title "Add new dashboard component" --body "Implements XYZ feature"

# Continue working on different feature in dev-2
./dev-environments/switch-to.sh dev-2
# dev-1 keeps running for testing while you work on dev-2
```

### Testing Across Environments
```bash
# Test same feature across environments
# main (staging): http://localhost:5174  
# dev-1 (feature): http://localhost:5175
# dev-2 (fix): http://localhost:5176

# All share same database - can test integration
```

## Management Commands

All scripts are in `./dev-environments/`:

- `start-all.sh` - Start all environments
- `stop-all.sh` - Stop all environments  
- `status.sh` - Check status of all environments
- `switch-to.sh <env>` - Switch terminal context to environment
- `restart.sh <env>` - Restart specific environment
- `logs.sh <env>` - Show logs for environment
- `sync.sh <env>` - Sync environment with latest code
- `cleanup.sh` - Clean build artifacts across all environments