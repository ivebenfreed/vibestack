# CLAUDE.md

## ✅ API Authentication Testing

**Working curl commands for backend API testing:**

```bash
# Login with test user
curl -X POST "http://localhost:8787/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"ceo@widecorp.com\", \"password\": \"WideCorp2024!CEO\"}" \
  -c cookies.txt

# Test protected API endpoints
curl -X GET "http://localhost:8787/api/organizations" -b cookies.txt
```

**Key points:**
- Correct endpoint: `/api/auth/sign-in/email` (not `/sign-in`)
- Proper JSON escaping in bash
- Cookie authentication works for all protected endpoints

## Current Configuration

**This is the main staging branch with the following default ports:**

- Web application: `http://localhost:5173`
- Server API: `http://localhost:8787`
- Database: `postgres://postgres:postgres@localhost:5432/vibestack_dev`


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Server Management

**IMPORTANT**: Use Claude Code's native background support for all development servers.

### Running Development Servers:
```bash
# Start main development servers (web + API)
Bash(command="pnpm dev", run_in_background=true)

# Or start specific services
Bash(command="pnpm dev:web", run_in_background=true)    # Web app only
Bash(command="pnpm dev:server", run_in_background=true) # API server only

# Build processes
Bash(command="pnpm build --watch", run_in_background=true)
Bash(command="pnpm test --watch", run_in_background=true)
```

### Managing Background Processes:
- **Monitor logs**: Use `BashOutput(bash_id="...")` tool to check logs
- **Stop processes**: Use `KillBash(shell_id="...")` tool to stop servers
- **Background processes persist** even if Claude disconnects

### Server-Only Development:
```bash
# API server only for backend development  
Bash(command="pnpm dev:server", run_in_background=true)

# Test API directly
curl -X GET http://localhost:8787/health
psql postgres://localhost:5432/vibestack_dev -c "SELECT * FROM organizations;"
```

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

### Common Database Connection Issues

If you see repeated `NeonHTTPDriver: Failed to connect` errors in the server logs:

1. **Start Docker containers** (if not running):
   ```bash
   docker compose up -d  # Starts postgres + neon-proxy
   ```

2. **Create missing control plane table** (if missing):
   ```bash
   docker exec vibestack-postgres psql -U postgres -d vibestack_dev -c \
     "CREATE SCHEMA IF NOT EXISTS neon_control_plane; 
      CREATE TABLE IF NOT EXISTS neon_control_plane.endpoints (
        endpoint_id VARCHAR(255) PRIMARY KEY, 
        allowed_ips VARCHAR(255)
      );"
   ```

3. **Fix SSL issues** - Ensure DATABASE_URL includes `?sslmode=disable`:
   ```bash
   # In apps/server/.env.local, use:
   DATABASE_URL=postgres://postgres:postgres@db.localtest.me:4444/vibestack_dev?sslmode=disable
   ```

4. **Restart dev servers** to pick up config changes:
   ```bash
   # Kill existing servers and restart
   pnpm dev
   ```

**Error patterns to look for:**
- `Error: Network connection lost` → Docker containers not running
- `invalid hostname: Common name inferred from SNI` → SSL certificate issue, add `?sslmode=disable`
- `Console request failed` → Missing neon_control_plane.endpoints table

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
3. Build artifacts and generated files are ignored
4. Run essential baseline tests (see Testing section below)

## Browser Automation with MCP Playwright Tools

### IMPORTANT: Use MCP Tools, Not Test Files

**For browser automation and testing during development, use the MCP Playwright tools directly in Claude Code instead of writing Playwright test files.**

The MCP Playwright tools provide immediate browser control with persistent profiles:
- `mcp__playwright__browser_navigate` - Navigate to URLs
- `mcp__playwright__browser_click` - Click elements
- `mcp__playwright__browser_type` - Type text into forms
- `mcp__playwright__browser_snapshot` - Get page state
- `mcp__playwright__browser_take_screenshot` - Take screenshots
- And many more browser control tools

### MCP Playwright Setup

The MCP Playwright is configured with persistent browser profiles:
- Login once per worktree, stay logged in forever
- Full browser state persistence (cookies, localStorage, IndexedDB)
- Realistic testing environment like a real user
- Profile stored in `.playwright/profiles/profile-{issue}/`

#### Configuration

The MCP Playwright wrapper (`scripts/playwright-mcp-wrapper.js`) automatically:
- Detects the current worktree/branch
- Uses the persistent profile at `.playwright/profiles/profile-main/` (or `profile-{issue}` for worktrees)
- Maintains browser state across Claude Code sessions
- **NO `--isolated` flag** - uses persistent storage on disk

#### Using MCP Tools Instead of Writing Tests

**DON'T write test files:**
```javascript
// ❌ Don't create test files like this:
import { test, expect } from '@playwright/test';
test('my test', async ({ page }) => {
  await page.goto('/');
  await page.click('button');
});
```

**DO use MCP tools directly:**
```bash
# ✅ Use MCP tools in Claude Code:
mcp__playwright__browser_navigate(url="http://localhost:5173")
mcp__playwright__browser_click(element="Sign In button", ref="e23")
mcp__playwright__browser_type(element="Email input", ref="e45", text="ceo@widecorp.com")
mcp__playwright__browser_snapshot()  # Get current page state
```

#### Benefits of MCP Tools
- **Immediate execution** - No need to save files and run tests
- **Persistent browser** - Stays logged in between commands
- **Visual feedback** - See the browser window (not headless by default)
- **Interactive debugging** - Pause and inspect at any point
- **Same profile as tests** - Uses the same `.playwright/profiles/` directory

### When Playwright Test Files ARE Needed

For CI/CD pipelines or automated test suites, test files are still used. **But for development and debugging, prefer MCP tools.**

#### Running Test Files

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
Bash(command="pnpm dev", run_in_background=true)
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
SERVER_PORT=8787 WEB_PORT=5173 DB_PORT=5432 Bash(command="pnpm dev", run_in_background=true)
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

# Rebuild and run type checks
pnpm build && pnpm type-check

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
# 1. Ensure clean build
pnpm build && pnpm type-check

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

# 2. Stop any running background processes
# Use KillBash tool in Claude Code

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
- **Verify before cleanup**: Check `git worktree list` and active background processes

### Current Active Worktrees
After recent cleanup, only active issues remain:
```bash
git worktree list
# /home/benfreed/vibestack                     [staging]
# /home/benfreed/vibestack/worktrees/issue-60  [issue-60]
```

All completed issues (38, 53, 57) have been cleaned up.

## Test User Credentials

**IMPORTANT**: Use Wide Corp test users for all tests unless otherwise prompted.

Complete test user credentials are documented in:
📋 **[planning/active/testing-infrastructure/test-org-central/credentials/COMPLETE_ROLE_CREDENTIALS.md](planning/active/testing-infrastructure/test-org-central/credentials/COMPLETE_ROLE_CREDENTIALS.md)**

### Quick Reference - Wide Corp Solutions
**Organization ID:** `01920000-1000-7000-8000-000000000001`

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| **Owner** | ceo@widecorp.com | WideCorp2024!CEO | Full org access (Alice CEO) |
| **Admin** | cto@widecorp.com | WideCorp2024!CTO | Tech admin (Bob CTO) |
| **Manager** | pm1@widecorp.com | WideCorp2024!PM1 | Project management (Carol PM) |
| **Member** | dev1@widecorp.com | WideCorp2024!DEV1 | Developer access (Eve Developer) |

### WebSocket Sync Testing
For testing WebSocket connection and sync functionality:
- Use **Alice CEO** (Owner role) for comprehensive access
- Organization ID: `01920000-1000-7000-8000-000000000001` 
- 12 business entity tables available for sync testing
- Login at: `http://localhost:5173/sign-in`