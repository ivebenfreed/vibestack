# CLAUDE.md

*This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.*

## Current Configuration

**Main staging branch with default ports:**

- Web application: `http://localhost:5173`
- Server API: `http://localhost:8787`
- Database: `postgres://postgres:postgres@localhost:5432/vibestack_dev`

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
psql postgres://postgres:postgres@localhost:5432/vibestack_dev -c "SELECT * FROM organizations;"
```

## Contextual Logging System

**Control frontend logging to prevent console pollution and focus on specific areas during development.**

### Quick Commands
```bash
pnpm log:vibegrid       # Focus on VibeGrid components
pnpm log:sync           # Debug sync operations  
pnpm log:quiet          # Silent mode (errors only)
pnpm log:quiet-except 'file1,file2'  # Quiet except specific files
pnpm log:clear          # Remove logging config
```

### Runtime Control (Browser Console)
```javascript
logControl.focus('ui');           // Only UI logs
logControl.focus('none');         // Silent mode
logControl.only('ui', 'sync');    // Multiple contexts
logControl.status();              // Check current filters
```

### Usage in Code
```typescript
import { uiLog, syncLog, dataLog } from '@/logger';

const log = uiLog('components/MyComponent.tsx');
log.debug('Component rendered', { props });
log.error('Validation failed', error); // Always logs
```

**📖 Complete documentation:** [`apps/web/src/logger/README.md`](apps/web/src/logger/README.md)

## Database Configuration: Postgres + Hyperdrive

**Current Setup**: Direct PostgreSQL with Cloudflare Hyperdrive optimization for production performance.

**Migration Note**: The project has migrated from Neon serverless to direct PostgreSQL + Hyperdrive for better performance and simpler local development. The Neon HTTP proxy and related configurations have been removed.

### Local Development Database

**Connection Priority**:
1. **Hyperdrive** (via `env.HYPERDRIVE_DB.connectionString`) - Preferred for optimal performance
2. **Direct PostgreSQL** (via `env.DATABASE_URL`) - Fallback for local development

**Docker Setup**:
```bash
# Start local PostgreSQL database
docker compose up -d postgres

# Database will be available at:
# postgres://postgres:postgres@localhost:5432/vibestack_dev
```

### Database Clients

The project uses two complementary database clients:

1. **Kysely** (Primary ORM): `apps/server/src/lib/kysely.ts`
   - Type-safe query builder with postgres.js dialect
   - Optimized for Cloudflare Workers
   - Uses Hyperdrive when available, falls back to direct connection
   - Usage: `const users = await db(c.env).selectFrom('user').selectAll().execute()`

2. **postgres.js** (Direct queries): `apps/server/src/lib/db.ts`
   - For raw SQL operations and health checks
   - Lightweight serverless-optimized client
   - Consistent connection handling with Kysely
   - Usage: `const result = await sql(c, 'SELECT * FROM users WHERE id = $1', [userId])`

### Common Database Connection Issues

If you see database connection errors:

1. **Start Docker containers** (if not running):
   ```bash
   docker compose up -d postgres
   ```

2. **Check connection variables**:
   ```bash
   # For local development, ensure either:
   HYPERDRIVE_DB=available  # (automatically configured in wrangler dev)
   # OR
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/vibestack_dev
   ```

3. **Verify PostgreSQL is healthy**:
   ```bash
   docker exec vibestack-postgres pg_isready -U postgres
   ```

**Error patterns to look for:**
- `Error: Network connection lost` → Docker containers not running
- `No database connection available` → Missing both HYPERDRIVE_DB and DATABASE_URL
- `Connection timeout` → PostgreSQL container not started or unhealthy

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


## Development Standards

### Type Checking

We use TypeScript with strict configuration for the entire monorepo:

- **Type check**: `pnpm type-check` - Runs TypeScript compiler in build mode

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

#### TypeScript Configuration
- Strict mode enabled with helpful checks
- Base configuration in `tsconfig.base.json`
- Each package extends the base with specific settings
- Use `noUncheckedIndexedAccess` for safer array/object access
- `noImplicitOverride` requires explicit override keyword

### Before Committing
1. Run `pnpm type-check` to ensure no type errors
2. Fix any issues before pushing
3. Build artifacts and generated files are ignored

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

# Run specific test file
./scripts/playwright-test.sh tests/playwright/core/my-test.spec.js

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




## Current Project Focus: Sync Simplification & Legend State

**Active Development Areas:**
- **Sync Architecture Simplification**: Moving away from complex WAL-based sync to simpler notification-based approach
- **Legend State Integration**: Implementing Legend State for reactive state management and sync
- **UltraTable Improvements**: Enhanced table component with better performance and state management
- **Testing Infrastructure**: Sophisticated test data seeding and multi-org simulation

**Key Planning Documents:**
- `planning/active/sync-simplification/` - Core architecture changes
- `planning/active/testing-infrastructure/` - Test system improvements

**Component Organization:**
- **UltraTable**: Restructured from flat files to organized subfolder at `apps/web/src/components/tables/UltraTable/`
  - Main components: `UltraTable.tsx`, `UltraTableCell.tsx`, `UltraTableEditor.tsx`, `UltraTableSelection.tsx`
  - Utilities: `utils/clipboard.ts`, `state/selection-state.ts`, `hooks/use-ultra-table-selection.ts`

## Interaction Protocol Memorization

- Maintain a precise understanding of the interaction flow between components
- Track message types, data transformations, and sync mechanisms
- Memorize the nuanced communication patterns in the VibeStack architecture
- Pay special attention to WebSocket message structures and sync protocols


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