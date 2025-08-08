# CLAUDE.md

## Current Configuration

**This is the main staging branch with the following default ports:**

- Web application: `http://localhost:5173`
- Server API: `http://localhost:8787`
- Database: `postgres://postgres:postgres@localhost:5432/vibestack_dev` staging


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY: Automatic tmux Integration

**IMPORTANT**: Claude Code is configured to automatically redirect all long-running development commands to tmux background sessions. This happens transparently via PreToolUse hooks.

### Commands Automatically Redirected to tmux:
- `pnpm dev` → Runs in `vibestack-dev-issue-{N}` tmux session (worktree-specific)
- `pnpm dev:local` → Runs in `vibestack-dev-issue-{N}` tmux session (worktree-specific)
- `pnpm dev:server` → Runs in `vibestack-dev-issue-{N}` tmux session (worktree-specific)
- `pnpm dev:web` → Runs in `vibestack-dev-issue-{N}` tmux session (worktree-specific)
- `pnpm build --watch` → Runs in `vibestack-build-issue-{N}` tmux session (worktree-specific)
- `pnpm test --watch` → Runs in `vibestack-test-issue-{N}` tmux session (worktree-specific)
- `npm run dev` → Runs in `vibestack-dev-issue-{N}` tmux session (worktree-specific)
- `yarn dev` → Runs in `vibestack-dev-issue-{N}` tmux session (worktree-specific)
- `wrangler dev` → Runs in `vibestack-dev-issue-{N}` tmux session (worktree-specific)

### How It Works:
1. PreToolUse hook intercepts all Bash commands
2. Development commands are automatically wrapped with `./scripts/tmux-bg.sh`
3. Commands run in background without blocking Claude Code
4. Use `./scripts/bg-status.sh` to check running processes
5. Use `./scripts/bg-logs.sh <session>` to view logs

### DO NOT:
- Run dev servers directly (they will be redirected automatically)
- Use `&` or `nohup` for background processes (use tmux instead)
- Kill processes with `pkill` (use `./scripts/bg-stop.sh`)

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

## Playwright Testing with Persistent Browser Profiles

### Browser Profile Persistence

Each worktree uses a **persistent browser profile** that maintains login state across test runs:
- Login once per worktree, stay logged in forever
- Full browser state persistence (cookies, localStorage, IndexedDB)
- Realistic testing environment like a real user
- Profile stored in `.playwright/profiles/profile-{issue}/`

#### Quick Start

```bash
# Profile is automatically created during worktree setup with --test-setup flag
# No manual setup needed!

# Run all tests (headless by default, uses saved profile)
./scripts/playwright-test.sh

# Run specific test  
./scripts/playwright-test.sh tests/playwright/core/test-vibegantt-ready.spec.js

# Run with browser UI visible
./scripts/playwright-test.sh --headed

# Run in debug mode (automatically shows browser)
./scripts/playwright-test.sh --debug

# 🔐 IMPORTANT: Initial authentication setup (run this FIRST in new worktrees!)
npx playwright test tests/playwright/core/initial-auth-setup.spec.js
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

- `tests/playwright/core/` - Core tests and utilities
- `tests/playwright/issue-{number}/` - Issue-specific tests
- `tests/playwright/fixtures/` - Custom test fixtures
- `tests/playwright/TESTING-GUIDE.md` - Detailed testing guide

#### Profile Management

```bash
# View profile directory
ls -la .playwright/profiles/profile-main/

# Reset profile (if needed)
rm -rf .playwright/profiles/profile-main/

# Profiles are automatically created per worktree
```

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
