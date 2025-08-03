# CLAUDE.md

## Current Worktree Configuration

**This is PR #4 worktree with the following ports:**

- Web application: `http://localhost:5213`
- Server API: `http://localhost:8827`
- Database: `postgres://postgres:postgres@localhost:5472/vibestack_dev_issue_4`
- Proxy: Port 4494


This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Standards

### Linting and Type Checking

We use a unified ESLint and TypeScript configuration for the entire monorepo:

- **Lint**: `pnpm lint` - Runs ESLint with caching
- **Fix lint issues**: `pnpm lint:fix` - Auto-fixes what it can
- **Type check**: `pnpm type-check` - Runs TypeScript compiler in build mode
- **Full check**: `pnpm check` - Runs both type checking and linting

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
