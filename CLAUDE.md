# CLAUDE.md

*This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.*

## Current Configuration

**Single Worker App Architecture:**

- **Unified Application**: `http://localhost:4000` (configurable via `DEV_PORT` env var)
- **Frontend & Backend**: Single Cloudflare Worker with integrated Vite dev server
- **Database**: `postgres://postgres:postgres@localhost:5432/vibestack_dev`
- **Architecture**: Full-stack React app with Cloudflare Workers backend, unified in single app

## Single Worker App Architecture

**VibeStack has been unified into a single Cloudflare Worker application that combines both frontend and backend:**

### Key Benefits
- **Simplified Development**: Single `pnpm dev` command starts everything
- **Unified Deployment**: Single Worker handles both React frontend and API backend
- **No Port Conflicts**: One server serves both frontend and API routes
- **Better Performance**: No need for separate frontend/backend communication
- **Easier Debugging**: All logs in one place, unified error handling

### Architecture Details
- **Frontend**: React 19 with TanStack Router for file-based routing
- **Backend**: Hono with OpenAPI integration for API routes
- **Integration**: Cloudflare Vite plugin provides seamless HMR for both client and server code
- **Database**: PostgreSQL with Kysely ORM, optimized for Cloudflare Workers
- **Sync**: Real-time WebSocket sync via Durable Objects
- **Auth**: Better Auth with multi-tenant organization support

### Development Workflow
1. **Start dev server**: `pnpm dev` 
2. **Single URL**: `http://localhost:4000` (or `DEV_PORT`) serves both app and API
3. **Hot reloading**: Works for both React components and Worker API code
4. **API routes**: Available at same origin (e.g., `/api/auth/sign-in/email`)
5. **No CORS issues**: Frontend and backend on same origin

### File Structure
```
apps/worker/
├── src/
│   ├── components/          # React components
│   ├── routes/             # TanStack Router routes  
│   ├── server/             # Worker API code
│   │   ├── api/           # API route handlers
│   │   ├── lib/           # Database & utility code
│   │   └── sync/          # Real-time sync system
│   └── worker.ts          # Worker entry point
├── vite.config.ts         # Vite + Cloudflare config
└── wrangler.toml         # Cloudflare deployment config
```

### Common Troubleshooting
- **Reload Loops**: Fixed by ignoring `.wrangler/**` in Vite watch config
- **Port Conflicts**: Vite automatically finds next available port (5174→5175→etc.)
- **Database Issues**: Ensure PostgreSQL container is running with git-tracked data
- **Type Errors**: Use focused type check scripts for faster debugging

## ✅ API Authentication Testing

**Working curl commands for backend API testing:**

```bash
# RECOMMENDED: Use JSON file to avoid special character escaping issues
# IMPORTANT: Use heredoc with single quotes to prevent shell expansion of special characters
cat > /tmp/login_payload.json << 'EOF'
{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}
EOF
curl -X POST "http://localhost:4000/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d @/tmp/login_payload.json \
  -c cookies.txt

# Alternative: Direct JSON (requires careful escaping)
curl -X POST "http://localhost:4000/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"ceo@widecorp.com\", \"password\": \"WideCorp2024!CEO\"}" \
  -c cookies.txt

# Test protected API endpoints
curl -X GET "http://localhost:4000/api/organizations" -b cookies.txt
```

**Key points:**
- Correct endpoint: `/api/auth/sign-in/email` (not `/sign-in`)
- **Use JSON file approach** to avoid bash escaping problems with special characters
- Cookie authentication works for all protected endpoints
- Port should match current dev server (4000 by default, check with `pnpm dev` output)

### Quick API Testing Script

**Use the test script for convenient API testing:**

```bash
# Test different user roles with complete workflow
./scripts/test-api-login.sh CEO test     # Login + test protected endpoints
./scripts/test-api-login.sh CTO orgs     # Login + get organizations
./scripts/test-api-login.sh DEV1 login   # Login only
./scripts/test-api-login.sh PM1 health   # Health check

# Available user roles: CEO, CTO, PM1, DEV1 (all Wide Corp credentials)
```

The script handles JSON file creation automatically and includes all Wide Corp test credentials.

## Development Server Management

**IMPORTANT**: Use Claude Code's native background support for all development servers.

### Running Development Server:
```bash
# Start unified development server (web + API in single worker)
Bash(command="pnpm dev", run_in_background=true)

# Build processes
Bash(command="pnpm build --watch", run_in_background=true)
Bash(command="pnpm test --watch", run_in_background=true)
```

### Managing Background Processes:
- **Monitor logs**: Use `BashOutput(bash_id="...")` tool to check logs
- **Stop processes**: Use `KillBash(shell_id="...")` tool to stop servers
- **Background processes persist** even if Claude disconnects

### Development Server Details:
```bash
# Start unified Cloudflare Worker with Vite integration
pnpm dev  # Runs on port 4000 by default

# Configure port for worktrees (recommended)
export DEV_PORT=4001  # For issue-123 worktree
export DEV_PORT=4002  # For issue-456 worktree
pnpm dev

# Test API directly
curl -X GET http://localhost:4000/health
psql postgres://postgres:postgres@localhost:5432/vibestack_dev -c "SELECT * FROM organizations;"

# Test authentication (recommended approach using JSON file with heredoc)
cat > /tmp/login_payload.json << 'EOF'
{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}
EOF
curl -X POST "http://localhost:4000/api/auth/sign-in/email" -H "Content-Type: application/json" -d @/tmp/login_payload.json -c cookies.txt

# Test protected endpoints with cookies
curl -X GET "http://localhost:4000/api/organizations" -b cookies.txt
```

### Port Configuration for Worktrees:
- **Main branch**: `DEV_PORT=4000` (default)
- **Worktrees**: Set `DEV_PORT=400X` where X is unique per worktree
- **StrictPort**: Enabled to prevent port confusion - server will fail if port is unavailable
- **Environment**: Add `export DEV_PORT=4001` to your shell profile for persistent worktree ports

## Enhanced Contextual Logging System with File-Level Control

**Persistent logging configuration via dev scripts with file-level granularity.**

### Quick Commands
```bash
pnpm dev:quiet                   # Silent mode (errors only)
pnpm dev:sync                    # Focus on sync and state operations  
pnpm dev:ui                      # UI components at debug level
pnpm dev:ui:quiet-vibegrid       # Most UI quiet, VibeGrid at info level
pnpm dev:ui:focus-vibegrid       # Most UI quiet, VibeGrid at debug level
pnpm dev:debug                   # Multiple contexts at debug level
pnpm dev:debug:quiet-vibegrid    # Debug mode with VibeGrid at warn level
pnpm dev:all                     # All contexts enabled at debug level
pnpm dev:focus                   # Focus on specific file (universe-loader)
```

### Custom Configuration
```bash
# Use wrapper script for custom configurations
./scripts/dev-with-logging.sh custom \
  --contexts=ui,sync \
  --level=debug \
  --file-levels=vibegrid:warn,universe-loader:info \
  --muted=table-data-store
```

### Runtime Control (Browser Console)
```javascript
// Context controls (persistent)
logControl.only('ui', 'sync');    // Only these contexts
logControl.none();                 // Silent mode (errors only)
logControl.status();               // Check current configuration

// File-level controls (lost on HMR - use dev scripts for persistence)
logControl.setFileLevel('components/MyComponent', 'debug');
logControl.muteFile('components/VerboseComponent');
logControl.setPatternLevel('vibegrid', 'warn');  // All VibeGrid files

// Presets
logControl.quietVibeGrid();       // UI with VibeGrid at warn
logControl.focusFile('MyComponent'); // Only show logs from one file
```

### Usage in Code
```typescript
import { uiLog, syncLog, dataLog } from '@/logger';

const log = uiLog('components/MyComponent.tsx');
log.debug('Component rendered', { props });
log.info('User action', { action });
log.error('Validation failed', error); // Always shows (unless file muted)
```

### Available Contexts
- `sync` - WebSocket, sync operations, state machines
- `state` - State management, stores, Legend State
- `ui` - Components, interactions, rendering  
- `data` - CRUD operations, API calls, queries
- `auth` - Authentication, permissions
- `routing` - Navigation, route changes
- `performance` - Performance monitoring
- `testing` - Test-related logging
- `debug` - General debugging

### File-Level Configuration
- **Global Level**: Base log level for all files in context
- **File Overrides**: Specific files can have different levels
- **Pattern Support**: `vibegrid` matches all VibeGrid components
- **Persistent**: Configuration survives HMR via dev scripts

### Troubleshooting Logger Issues

If logging configuration isn't working:

1. **Use dev scripts for persistence**: Runtime file controls are lost on HMR
2. **Check configuration**: `logControl.status()` in browser console
3. **Verify context enabled**: Ensure your logger type's context is active
4. **File path normalization**: Paths auto-normalized (no src/, no extension)

**📖 Complete documentation:** [`apps/worker/src/logger/README.md`](apps/worker/src/logger/README.md)

## Database Configuration: Postgres + Hyperdrive

**Current Setup**: Direct PostgreSQL with Cloudflare Hyperdrive optimization for production performance.

**Migration Note**: The project has migrated from Neon serverless to direct PostgreSQL + Hyperdrive for better performance and simpler local development. The Neon HTTP proxy and related configurations have been removed.

### Local Development Database

**Connection Priority**:
1. **Hyperdrive** (via `env.HYPERDRIVE_DB.connectionString`) - Preferred for optimal performance
2. **Direct PostgreSQL** (via `env.DATABASE_URL`) - Fallback for local development

**Docker Setup**:
```bash
# Start local PostgreSQL database with git-tracked data
cd main-postgres
docker compose up -d

# Database will be available at:
# postgres://postgres:postgres@localhost:5432/vibestack_dev
```

**IMPORTANT**: The PostgreSQL container uses `data/postgres-live/` as its data directory, which contains git-tracked database state. This ensures consistent database schema and test data across all development environments.

**Data Directory**: `/home/benfreed/dev/vibestack/data/postgres-live/`
- Contains complete PostgreSQL data directory
- Includes all tables, schemas, and test data
- Automatically synced to git on commits via pre-commit hook

### Database Clients

The project uses two complementary database clients:

1. **Kysely** (Primary ORM): `apps/worker/src/server/lib/kysely.ts`
   - Type-safe query builder with postgres.js dialect
   - Optimized for Cloudflare Workers
   - Uses Hyperdrive when available, falls back to direct connection
   - Usage: `const users = await db(c.env).selectFrom('user').selectAll().execute()`

2. **postgres.js** (Direct queries): `apps/worker/src/server/lib/db.ts`
   - For raw SQL operations and health checks
   - Lightweight serverless-optimized client
   - Consistent connection handling with Kysely
   - Usage: `const result = await sql(c, 'SELECT * FROM users WHERE id = $1', [userId])`

### Common Database Connection Issues

If you see database connection errors:

1. **Start PostgreSQL container** (if not running):
   ```bash
   cd main-postgres
   docker compose up -d
   ```

2. **Verify git-tracked data exists**:
   ```bash
   ls -la data/postgres-live/
   # Should contain PostgreSQL data files
   ```

3. **Check container status**:
   ```bash
   docker ps | grep postgres
   # Should show vibestack-postgres running on port 5432
   ```

4. **Verify database connectivity**:
   ```bash
   docker exec vibestack-postgres pg_isready -U postgres
   ```

**Error patterns to look for:**
- `Error: proxy request failed, cannot connect to the specified address` → PostgreSQL container not running
- `PostgresError: relation "user" does not exist` → Database using wrong data directory
- `Connection timeout` → PostgreSQL container not started or unhealthy

**If authentication still fails after database is running:**
- Check that PostgreSQL container is mounted correctly with git-tracked data
- Restart the unified development server: `pnpm dev` (with background: true)
- The WebSocket sync connection should now work with 200 responses
- Check Vite config if experiencing reload loops (should ignore .wrangler directory)

## Database Synchronization

### Initialize Local Database from Remote

When starting fresh on the main/staging branch or setting up a new development environment:

```bash
./scripts/init-local-from-remote.sh
```

This will:
- Reset your local database (prompts for confirmation)
- Clone all data from the remote database
- Use the DATABASE_URL from `apps/worker/.dev.vars`

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
- **`./scripts/type-check-focused/type-check-worker.sh`** - Worker app type check (full-stack unified app)

These scripts are particularly useful when:
- Full `pnpm type-check` hangs or is slow
- You need to debug specific package errors
- Working on systematic error fixes
- The monorepo type check times out

**Example workflow for fixing type errors:**
```bash
# Check all packages with summary
./scripts/type-check-focused/type-check-all.sh

# Focus on the worker app with errors
./scripts/type-check-focused/type-check-worker.sh

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
# ✅ Use MCP tools in Claude Code (adjust port as needed):
mcp__playwright__browser_navigate(url="http://localhost:5175")
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
- **UltraTable**: Restructured from flat files to organized subfolder at `apps/worker/src/components/custom/ultratable/`
  - Main components: `UltraTable.tsx`, `UltraTableCell.tsx`, `UltraTableEditor.tsx`, `UltraTableSelection.tsx`
  - Core engine: `core/UltraTableRenderer.ts`, `core/UltraTableDataManager.ts`
  - Utilities: `utils/clipboard.ts`, `state/selection-state.ts`, `hooks/use-ultra-table-selection.ts`

## Interaction Protocol Memorization

- Maintain a precise understanding of the interaction flow between components
- Track message types, data transformations, and sync mechanisms
- Memorize the nuanced communication patterns in the VibeStack architecture
- Pay special attention to WebSocket message structures and sync protocols


## Test User Credentials

**IMPORTANT**: Use Wide Corp test users for all tests unless otherwise prompted.

### Wide Corp Solutions Test Credentials
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
- Login at: `http://localhost:4000/sign-in` (or check current dev server port with `pnpm dev`)