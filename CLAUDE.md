# CLAUDE.md

## Current Configuration

**This is the main staging branch with the following default ports:**

- Web application: `http://localhost:5173`
- Server API: `http://localhost:8787`
- Database: `postgres://postgres:postgres@localhost:5432/vibestack_dev`


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Server Management

**IMPORTANT**: Claude Code now has native support for background processes. Use the `run_in_background` parameter with the Bash tool for long-running commands.

### Running Development Servers in Background:
```bash
# Use native Claude Code background support
Bash(command="pnpm dev", run_in_background=true)
Bash(command="pnpm dev:local", run_in_background=true)
Bash(command="pnpm dev:server", run_in_background=true)
Bash(command="pnpm dev:web", run_in_background=true)
Bash(command="pnpm build --watch", run_in_background=true)
Bash(command="pnpm test --watch", run_in_background=true)
```

### Monitoring Background Processes:
- Use `BashOutput` tool to check logs from background processes
- Use `KillBash` tool to stop background processes
- Background processes continue running even if Claude disconnects

### POC Server Management:
For running POC servers (like Function Factory POCs) that need persistent background execution, create simple tmux sessions manually:
```bash
# Create dedicated tmux session for POC servers
tmux new-session -d -s poc-server "cd /path/to/poc && npx wrangler dev --port 8789"

# Attach to view logs
tmux attach -t poc-server

# Detach while keeping running: Ctrl+B, then D
# Kill session when done
tmux kill-session -t poc-server
```

### Server-Only Development:
For working on server-only DataForge development without the webapp:
```bash
# Use regular dev start - webapp won't interfere with server testing
./scripts/dev-start.sh

# API testing workflow
curl -X GET http://localhost:8787/health
psql postgres://localhost:5432/vibestack_dev -c "SELECT * FROM organizations;"
```

### Alternative: tmux-based Management (if preferred):
If you prefer using tmux scripts instead of native background support:
1. Use `./scripts/tmux-bg.sh <session-name> <command>` to start processes in tmux
2. Use `./scripts/bg-status.sh` to check running processes
3. Use `./scripts/bg-logs.sh <session>` to view logs
4. Use `./scripts/bg-stop.sh <session>` to stop processes

### DO NOT:
- Use `&` or `nohup` for background processes (use native background or tmux)
- Kill processes with `pkill` (use `KillBash` or `./scripts/bg-stop.sh`)

## CRITICAL: Neon Proxy Requirements

**⚠️ IMPORTANT**: The local Neon HTTP proxy requires a special system table to function properly. If you ever drop/recreate the database, you MUST recreate this table:

```sql
-- Required by the local Neon proxy (ghcr.io/timowilhelm/local-neon-http-proxy)
CREATE SCHEMA IF NOT EXISTS neon_control_plane;
CREATE TABLE neon_control_plane.endpoints (
    endpoint_id VARCHAR(255) PRIMARY KEY,
    allowed_ips VARCHAR(255)
);
```

Without this table, all Kysely/Neon connections will fail with "Console request failed" errors.

## Database Synchronization

### Initialize Local Database from Remote

When starting fresh on the main/staging branch or setting up a new development environment:

```bash
./scripts/init-local-from-remote.sh
```

This will:
- Reset your local database (prompts for confirmation)
- Clone all data from the remote Neon database
- Use the DATABASE_URL from `apps/server/.dev.vars`

### Sync Remote to Local

To update your existing local database with latest remote data:

```bash
./scripts/sync-remote-to-local.sh
```

This preserves your local test data while pulling in new records from remote.

### Verify Sync Status

Check if your databases are in sync:

```bash
npx tsx scripts/verify-sync-status.ts
```

### Database Ports

- **Main/Staging**: Port 5432 (default)
- **Worktree Issue #N**: Port = 5580 + (N % 100)
  - Example: Issue #60 uses port 5640

## Development Standards

### Linting and Type Checking

We use a unified ESLint and TypeScript configuration for the entire monorepo:

- **Lint**: `pnpm lint` - Runs ESLint with caching
- **Fix lint issues**: `pnpm lint:fix` - Auto-fixes what it can
- **Type check**: `pnpm type-check` - Runs TypeScript compiler in build mode
- **Full check**: `pnpm check` - Runs both type checking and linting

#### Focused Type Checking Scripts

For debugging and fixing type errors systematically, use the focused type check scripts:

- **`./scripts/type-check-focused/type-check-all.sh`** - Runs focused checks on all packages with summary
- **`./scripts/type-check-focused/type-check-server.sh`** - Server-only type check (faster than full monorepo check)
- **`./scripts/type-check-focused/type-check-web.sh`** - Web app type check
- **`./scripts/type-check-focused/type-check-dataforge.sh`** - DataForge package type check

These scripts are particularly useful when:
- Full `pnpm type-check` hangs or is slow
- You need to debug specific package errors
- Working on systematic error fixes
- The monorepo type check times out

**Example workflow for fixing type errors:**
```bash
# Check all packages with summary
./scripts/type-check-focused/type-check-all.sh

# Focus on specific package with errors
./scripts/type-check-focused/type-check-server.sh

# After fixes, verify with full check
pnpm type-check
```

#### ESLint Rules
- Catches real errors: unreachable code, duplicate cases, invalid types
- Warns on code quality issues: console.log, debugger, var usage
- Async/Promise rules enabled to catch floating promises
- Server code allows console.log, client code doesn't
- All generated code and config files are ignored

#### TypeScript Configuration
- Strict mode enabled with helpful checks
- Base configuration in `tsconfig.base.json`
- Each package extends the base with specific settings
- Use `noUncheckedIndexedAccess` for safer array/object access
- `noImplicitOverride` requires explicit override keyword

### Before Committing
1. Run `pnpm check` to ensure no type or lint errors
2. Fix any issues before pushing
3. Generated files in `packages/dataforge/src/generated/` are ignored
4. Run essential baseline tests (see Testing section below)

## Playwright Testing with Persistent Browser Profiles

### Browser Profile Persistence

Each worktree uses a **persistent browser profile** that maintains login state across test runs:
- Login once per worktree, stay logged in forever
- Full browser state persistence (cookies, localStorage, IndexedDB)
- Realistic testing environment like a real user
- Profile stored in `.playwright/profiles/profile-{issue}/`

#### Quick Start

**IMPORTANT**: Always use `./scripts/playwright-test.sh` wrapper script instead of `npx playwright test` directly. The wrapper script automatically:
- Detects the correct issue number and ports for worktrees
- Sources `.env.local` for proper configuration
- Uses the correct persistent browser profile
- Ensures dev servers are running

```bash
# 🔐 IMPORTANT: Initial authentication setup (run this FIRST in new worktrees!)
./scripts/playwright-test.sh tests/playwright/setup/01-initial-auth.spec.js

# Run essential baseline tests (RECOMMENDED for every worktree)
./scripts/playwright-test.sh tests/playwright/smoke  # Verify app loads
./scripts/playwright-test.sh tests/playwright/sync   # Verify sync works
./scripts/playwright-test.sh tests/playwright/ui     # Verify UI works

# Run all tests (headless by default, uses saved profile)
./scripts/playwright-test.sh

# Run specific test  
./scripts/playwright-test.sh tests/playwright/core/test-vibegantt-ready.spec.js

# Run with browser UI visible
./scripts/playwright-test.sh --headed

# Run in debug mode (automatically shows browser)
./scripts/playwright-test.sh --debug
```

**Note**: Running `npx playwright test` directly will use incorrect ports and configuration. Always use the wrapper script.

#### Essential Baseline Tests for Every Worktree

When working on any issue, these baseline tests ensure your changes don't break core functionality:

1. **Smoke Tests** (`tests/playwright/smoke/`)
   - App loads successfully
   - Authentication state works
   - All main pages accessible
   
2. **Sync Tests** (`tests/playwright/sync/`)
   - Initial sync for new clients
   - Catchup sync after disconnect
   - Live sync between tabs
   - Uses XState inspection for monitoring

3. **UI Tests** (`tests/playwright/ui/`)
   - Task CRUD operations
   - Project management
   - Navigation and routing
   - Search and filtering

Run them with:
```bash
# Quick baseline validation (< 2 minutes)
./scripts/playwright-test.sh tests/playwright/smoke tests/playwright/sync tests/playwright/ui
```

#### Using Persistent Context

All tests should use the persistent context fixture by default:

```javascript
import { test, expect } from '../fixtures/persistent-context.js';

test('my test', async ({ page }) => {
  await page.goto('/'); // Already logged in!
  // Your test code here
});
```

**Note**: The test template at `tests/playwright/core/test-template.spec.js` is pre-configured to use the persistent context fixture.

#### Isolated Tests (When Needed)

For tests that need a clean browser state:

```javascript
// Use standard Playwright test for isolated context
import { test, expect } from '@playwright/test';

test('isolated test', async ({ page }) => {
  // Fresh browser context - must handle login
  await page.goto('/sign-in');
});
```

#### Multiple User Testing

For testing with different user accounts, create custom fixtures:

```javascript
// See tests/playwright/TESTING-GUIDE.md for examples
```

#### Route Ready Detection

Use `usePlaywrightReady` hook in components for better test synchronization:

```javascript
// In your React component
import { usePlaywrightReady } from '@/hooks/use-playwright-ready';

function MyComponent() {
  usePlaywrightReady('[PLAYWRIGHT_READY] My component loaded');
  // ...
}
```

Tests can wait for readiness:
```javascript
await page.waitForFunction(() => 
  document.body.getAttribute('data-playwright-ready') === 'true'
);
```

#### Test Organization

- `tests/playwright/setup/` - One-time setup (authentication)
- `tests/playwright/smoke/` - Quick essential tests
- `tests/playwright/sync/` - Synchronization tests with XState
- `tests/playwright/auth/` - Authentication flow tests
- `tests/playwright/error-scenarios/` - Error handling tests
- `tests/playwright/ui/` - User interface tests
- `tests/playwright/core/` - Core tests and utilities
- `tests/playwright/issue-{number}/` - Issue-specific tests
- `tests/playwright/fixtures/` - Custom test fixtures
- `tests/playwright/helpers/` - Test helpers and utilities

#### Profile Management

```bash
# View profile directory
ls -la .playwright/profiles/profile-main/

# Reset profile (if needed)
rm -rf .playwright/profiles/profile-main/

# Profiles are automatically created per worktree
```

## Running Dev Servers on Main/Staging Ports

When testing merge-ready branches or working on the main/staging branch, use:

```bash
# Start dev server with default main/staging ports (5173, 8787, 5432)
./scripts/dev-main.sh

# Or manually with MAIN_MODE flag
MAIN_MODE=true ./scripts/tmux-bg.sh vibestack-dev-main "pnpm dev:local"
```

This bypasses the automatic issue number detection and uses the default ports:
- Web: http://localhost:5173
- Server: http://localhost:8787  
- Database: postgres://localhost:5432/vibestack_dev
- Proxy: Port 4444

## Staging Server Mocking for Merge Testing

When testing merge-ready branches (like `issue-57-pure-merge`) that need to simulate production-like conditions, you can mock the staging server configuration:

### Method 1: Using MAIN_MODE (Recommended)
```bash
# Start dev servers with staging ports and database
MAIN_MODE=true ./scripts/tmux-bg.sh vibestack-dev-main "pnpm dev:local"

# Or use the convenience script
./scripts/dev-main.sh
```

This configuration:
- Uses staging database: `postgres://localhost:5432/vibestack_dev`
- Runs web app on staging port: `http://localhost:5173`  
- Runs API server on staging port: `http://localhost:8787`
- Avoids port conflicts with worktree environments

### Method 2: Manual Environment Override
```bash
# Set explicit environment variables for staging-like testing
SERVER_PORT=8787 WEB_PORT=5173 DB_PORT=5432 pnpm dev:local
```

### When to Use Staging Mocking
- **Merge testing**: Before creating PRs, test with staging-like configuration
- **Integration testing**: Verify features work with production database schema
- **Performance testing**: Test against the same database used in staging
- **Branch validation**: Confirm branches work outside worktree environments

### Database Considerations
The staging mock uses the main `vibestack_dev` database, so:
- ✅ Same schema as production staging
- ✅ Realistic data volumes for testing  
- ⚠️ **Caution**: Changes affect the main development database
- 💡 **Tip**: Use database migrations to test schema changes safely

## Background Process Management

### tmux-based Background Processes

We use tmux to manage long-running background processes without blocking Claude Code. This is especially useful for development servers and build processes.

#### Core Scripts

- **`./scripts/tmux-bg.sh <session-name> <command>`** - Start any command in a background tmux session
  ```bash
  ./scripts/tmux-bg.sh dev-servers "pnpm dev:local"
  ./scripts/tmux-bg.sh build-watch "pnpm build --watch"
  ```

- **`./scripts/bg-status.sh [session-name]`** - Check status of background processes
  ```bash
  ./scripts/bg-status.sh                # List all sessions
  ./scripts/bg-status.sh dev-servers    # Check specific session
  ```

- **`./scripts/bg-logs.sh <session-name> [lines]`** - View logs from background processes
  ```bash
  ./scripts/bg-logs.sh dev-servers 100  # Last 100 lines
  ./scripts/bg-logs.sh dev-servers      # Last 50 lines (default)
  ```

- **`./scripts/bg-stop.sh <session-name>`** - Stop background processes cleanly
  ```bash
  ./scripts/bg-stop.sh dev-servers
  ```

#### Development Server Shortcuts

- **`./scripts/dev-start.sh`** - Start development servers (web + API) in background
- **`./scripts/dev-logs.sh [lines]`** - Quick access to development server logs

#### Standard Session Names

**All session names are worktree-specific:**

- `vibestack-dev-issue-{N}` - Main development servers (`pnpm dev:local`)
- `vibestack-build-issue-{N}` - Build processes
- `vibestack-test-issue-{N}` - Test runners
- `vibestack-migrate-issue-{N}` - Database migrations

Where `{N}` is the issue number (e.g., `vibestack-dev-issue-24` for Issue #24)

#### Usage Patterns

1. **Starting development servers:**
   ```bash
   ./scripts/dev-start.sh  # Starts servers in background
   # Continue working while servers start up
   ```

2. **Checking if servers are running:**
   ```bash
   ./scripts/bg-status.sh vibestack-dev-issue-24  # For Issue #24
   ```

3. **Viewing server logs while working:**
   ```bash
   ./scripts/dev-logs.sh 50  # View last 50 lines (auto-detects issue number)
   ```

4. **Stopping servers when done:**
   ```bash
   ./scripts/bg-stop.sh vibestack-dev-issue-24  # For Issue #24
   ```

#### Benefits

- **Non-blocking**: Start long-running processes without waiting
- **Process safety**: Prevents duplicate server instances
- **Log access**: View real-time logs from any background process
- **Clean shutdown**: Graceful process termination with Ctrl-C then force kill
- **Session persistence**: Processes continue running even if Claude disconnects

## Interaction Protocol Memorization

- Maintain a precise understanding of the interaction flow between components
- Track message types, data transformations, and sync mechanisms
- Memorize the nuanced communication patterns in the VibeStack architecture
- Pay special attention to WebSocket message structures and sync protocols

## Worktree-Specific Rules

### 🔐 First-Time Worktree Setup

**IMPORTANT**: When setting up a new worktree, you MUST run the initial authentication setup:

```bash
# After creating worktree and installing dependencies
npx playwright test tests/playwright/core/initial-auth-setup.spec.js
```

This creates a persistent browser profile with authentication. Without this, all other tests will fail!

### Playwright Test Organization

When working in a worktree for a specific issue:
- **ALWAYS** create new test files in `tests/playwright/issue-{number}/` folder
- **NEVER** modify tests in `tests/playwright/core/` unless fixing a bug
- **PREFER** using existing test helpers from `core/db-test-helpers.js`
- **USE** `core/test-template.spec.js` as a starting point for new tests

Example for Issue #25:
```bash
# Good - issue-specific test
tests/playwright/issue-25/feature-validation.spec.js

# Bad - adding to core without good reason
tests/playwright/core/my-feature-test.spec.js
```

The Playwright config automatically detects the issue number and only runs:
- All tests in `core/`
- Tests specific to the current issue folder

### Worktree Merge Strategy

**Problem**: Features work in worktree but break after merging due to conflicts, missing generated files, and configuration drift.

**Solution**: Create clean branches instead of complex merges.

#### Method 1: Clean Branch from Staging
```bash
# Instead of merging staging into worktree
cd /main/repo
git checkout staging && git pull
git checkout -b issue-42-clean

# Cherry-pick your commits
git cherry-pick <commit1> <commit2>...
# OR use range: git cherry-pick <first>^..<last>

# Regenerate everything fresh
cd packages/dataforge && pnpm forge:build

# Force push to replace messy branch
git push --force-with-lease origin issue-42-clean:issue-42
```

#### Method 2: Rebase onto Staging
```bash
# In your worktree
git fetch origin staging
git rebase origin/staging

# Resolve conflicts once, cleanly
# This replays your commits on top of latest staging
```

#### Before Creating PR - Always Do:
```bash
# 1. Commit generated files
cd packages/dataforge && pnpm forge:build
git add src/generated/ && git commit -m "chore: commit generated files"

# 2. Create migrations if entities changed
pnpm migration:generate:server -- src/migrations/server/DescriptiveName
git add src/migrations/ && git commit -m "feat: add migration"

# 3. Check for hardcoded ports
grep -r "558\|919\|584" apps/  # Look for worktree-specific ports

# 4. Test clean build
pnpm build && pnpm type-check
```

This avoids merge conflicts, stale files, and ensures features work after merge.

## Worktree Cleanup Process

When issues are completed and merged, clean up the associated resources to maintain a tidy development environment.

### Manual Cleanup (Selective)
Clean up specific completed issues:

```bash
# 1. Close the GitHub issue
gh issue close 57 --comment "Completed: Description of what was accomplished"

# 2. Stop any running tmux sessions
./scripts/bg-stop.sh vibestack-dev-issue-57

# 3. Clean up Docker resources  
./scripts/cleanup-pr-docker.sh 57

# 4. Remove the worktree and branch
git worktree remove --force worktrees/issue-57
git branch -D issue-57
```

### Automated Cleanup (All worktrees)
⚠️ **Caution**: This removes ALL worktrees except the main repository

```bash
# Clean up everything (worktrees, Docker, tmux, branches)
./scripts/cleanup-all-worktrees.sh
```

### Best Practices
- **Keep active issues**: Only clean up completed/merged issues
- **Preserve issue-60**: Currently in progress, should not be cleaned
- **Close GitHub issues first**: This maintains the paper trail
- **Verify before cleanup**: Check `git worktree list` and `./scripts/bg-status.sh`

### Current Active Worktrees
After recent cleanup, only active issues remain:
```bash
git worktree list
# /home/benfreed/vibestack                     [staging]
# /home/benfreed/vibestack/worktrees/issue-60  [issue-60]
```

All completed issues (38, 53, 57) have been cleaned up.
