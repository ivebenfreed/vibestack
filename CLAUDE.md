# CLAUDE.md

## Current Worktree Configuration

**This is Issue #20 worktree with the following ports:**

- Web application: `http://localhost:5373`
- Server API: `http://localhost:8987`
- Database: `postgres://postgres:postgres@localhost:5632/vibestack_dev_issue_20`
- Proxy: Port 4654

### Playwright Test Environment

**✅ READY TO USE** - This worktree has pre-configured Playwright authentication:

- **Auth file**: `.playwright/auth/auth-20.json` (1110 bytes)
- **Current LSN**: `0/1E04FA0` (sync state persisted)
- **User**: ben@getelevra.com (authenticated with valid session)
- **Expiry**: 2025-08-12 (tokens are valid)

**DO NOT re-run auth setup** - use existing state for all tests.


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY: Automatic tmux Integration

**IMPORTANT**: Claude Code is configured to automatically redirect all long-running development commands to tmux background sessions. This happens transparently via PreToolUse hooks.

### Commands Automatically Redirected to tmux:
- `pnpm dev` → Runs in `vibestack-dev` tmux session
- `pnpm dev:local` → Runs in `vibestack-dev` tmux session
- `pnpm dev:server` → Runs in `vibestack-dev` tmux session
- `pnpm dev:web` → Runs in `vibestack-dev` tmux session
- `pnpm build --watch` → Runs in `vibestack-build` tmux session
- `pnpm test --watch` → Runs in `vibestack-test` tmux session
- `npm run dev` → Runs in `vibestack-dev` tmux session
- `yarn dev` → Runs in `vibestack-dev` tmux session
- `wrangler dev` → Runs in `vibestack-dev` tmux session

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

## Playwright Testing with Isolated Profiles

### Automated Browser Testing per Worktree

Each worktree gets its own isolated browser profile for Playwright testing. This ensures that:
- Login sessions don't interfere between branches
- Browser state is isolated per issue/feature
- Screenshots and videos are saved per worktree

#### Quick Start

**IMPORTANT**: This worktree was created with `--test-setup` flag, which means:
- ✅ Authentication state is already saved to `.playwright/auth/auth-20.json`
- ✅ Browser profile is pre-configured with login and sync state  
- ✅ LSN is properly persisted from initial sync
- ✅ **DO NOT re-run auth setup** - use existing state

```bash
# Run all Playwright tests with existing isolated profile
./scripts/playwright-test.sh

# Run specific test file  
./scripts/playwright-test.sh tests/playwright/vibegantt-debug-route.spec.js

# Run in debug mode
./scripts/playwright-test.sh --debug

# Run headless
./scripts/playwright-test.sh --headed=false
```

#### Pre-configured Auth State

The auth file `.playwright/auth/auth-20.json` contains:
- Valid session cookies for user: ben@getelevra.com
- Sync state with current LSN: `0/1E04FA0`
- Authentication tokens with expiry: 2025-08-12

**When writing new tests**: Tests automatically use this auth state via `playwright.config.js` - no additional setup needed.

#### How It Works

1. **Auto-Detection**: Script detects issue number from branch name (`issue-10` → Issue #10)
2. **Port Calculation**: Calculates correct ports for the worktree (Issue #10 → Web: 5273, Server: 8887)
3. **Profile Isolation**: Uses `.playwright/profiles/profile-{issue}` for browser data
4. **Screenshot Storage**: Saves screenshots to `./screenshots/` directory

#### Test Configuration

The `playwright.config.js` automatically:
- Detects the current branch/issue number
- Calculates the correct ports for the worktree
- Sets up isolated browser profiles
- Configures screenshot and video recording

#### Directory Structure

```
worktrees/issue-10/
├── .playwright/
│   └── profiles/
│       └── profile-10/          # Isolated browser profile
├── screenshots/                 # Test screenshots
├── test-results/               # Test artifacts
├── tests/
│   └── playwright/
│       └── *.spec.js           # Test files
└── playwright.config.js       # Auto-configured for this worktree
```

#### Integration with Development Workflow

1. Create new worktree: `git worktree add worktrees/issue-123 -b issue-123`
2. Install dependencies: `cd worktrees/issue-123 && pnpm install`
3. Start dev servers: `./scripts/dev-start.sh`
4. Run tests: `./scripts/playwright-test.sh`

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

- `vibestack-dev` - Main development servers (`pnpm dev:local`)
- `vibestack-build` - Build processes
- `vibestack-test` - Test runners
- `vibestack-migrate` - Database migrations

#### Usage Patterns

1. **Starting development servers:**
   ```bash
   ./scripts/dev-start.sh  # Starts servers in background
   # Continue working while servers start up
   ```

2. **Checking if servers are running:**
   ```bash
   ./scripts/bg-status.sh vibestack-dev
   ```

3. **Viewing server logs while working:**
   ```bash
   ./scripts/dev-logs.sh 50  # View last 50 lines
   ```

4. **Stopping servers when done:**
   ```bash
   ./scripts/bg-stop.sh vibestack-dev
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

[... rest of the existing file content remains unchanged ...]
