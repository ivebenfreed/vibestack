# CLAUDE.md

*Essential guidance for Claude Code when working with this repository.*

## API Documentation

**OpenAPI Documentation Access:**
- **Raw OpenAPI Spec**: `http://localhost:4000/api/openapi` (public, no auth)
- **External Swagger UI**: Paste `http://localhost:4000/api/openapi` into https://editor.swagger.io
- **Internal Swagger UI**: `http://localhost:4000/api/ui` (requires authentication)

## Architecture

**Single Cloudflare Worker app with unified frontend and backend:**
- **Dev Server**: `pnpm dev` (runs on port 4000)
- **Database**: PostgreSQL at `postgres://postgres:postgres@localhost:5432/elevra_dev`
- **Frontend**: React 19 + TanStack Router
- **Backend**: Hono API + Kysely ORM
- **Sync**: Real-time WebSocket via Durable Objects

## Development Workflow

### 1. Start Environment
```bash
# Check running processes first
ps aux | grep -E "(node|pnpm|dev)" | grep -v grep

# Start dev server
Bash(command="pnpm dev", run_in_background=true)

# Start console monitoring
Bash(command="pnpm chrome-remote", run_in_background=true)
```

### 2. Browser Automation
```bash
# Navigation
mcp__browsermcp__browser_navigate(url="http://localhost:4000")
mcp__browsermcp__browser_snapshot()

# Interactions
mcp__browsermcp__browser_click(element="Button", ref="s1e23")
mcp__browsermcp__browser_type(element="Input", ref="s1e45", text="value", submit=false)
```

### 3. Console Monitoring
```bash
# All browser console output from Playwright
BashOutput(bash_id="[chrome-remote-id]")

# Filtered console output (errors and warnings only)
BashOutput(bash_id="[chrome-remote-id]", filter="ERROR|WARNING")

# Recent logs (timestamps are UTC, not local time!)
# Get UTC: date -u +"%H:%M"
# Last 5 min example: filter="01:0[0-5]:[0-9]{2}"
```

**Chrome Remote Console Features:**
- **Real-time monitoring**: Captures all `console.log`, `console.error`, `console.warn`, etc.
- **Playwright integration**: Connects directly to Playwright browser profile
- **Color-coded output**: Different colors for log levels (error=red, warn=yellow, info=cyan)
- **Structured data**: Formats objects and arrays from console output
- **Consistent config**: Chrome remote debugging port managed via `config/chrome-debug.json`

**Chrome Debug Configuration:**
```bash
# Update remote debugging port (affects both Playwright and chrome-remote)
# Edit config/chrome-debug.json, then regenerate Playwright config
pnpm config:playwright
```

## Database

### Start PostgreSQL
```bash
cd main-postgres
docker compose up -d
```

### Test Connection
```bash
psql postgres://postgres:postgres@localhost:5432/elevra_dev -c "SELECT * FROM organizations;"
```

## API Testing

### Authentication
```bash
cat > /tmp/login.json << 'EOF'
{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}
EOF
curl -X POST "http://localhost:4000/api/auth/sign-in/email" -H "Content-Type: application/json" -d @/tmp/login.json -c cookies.txt

# Test protected endpoint
curl -X GET "http://localhost:4000/api/organizations" -b cookies.txt
```

## Test Credentials

**Wide Corp Solutions** (`01920000-1000-7000-8000-000000000001`)

| Role | Email | Password |
|------|-------|----------|
| **Owner** | ceo@widecorp.com | WideCorp2024!CEO |
| **Admin** | cto@widecorp.com | WideCorp2024!CTO |
| **Manager** | pm1@widecorp.com | WideCorp2024!PM1 |
| **Member** | dev1@widecorp.com | WideCorp2024!DEV1 |

## Troubleshooting

### Browser MCP Issues
If clicking fails with "No tab with given id":
1. Reconnect: `/mcp` command
2. Fresh snapshot: `mcp__browsermcp__browser_snapshot()`
3. Check processes: `ps aux | grep -E "(pnpm|node)"`

### Database Issues
1. Start container: `cd main-postgres && docker compose up -d`
2. Check status: `docker ps | grep postgres`
3. Test connection: `docker exec elevra-postgres pg_isready -U postgres`

## Type Checking

```bash
# Full check
pnpm type-check

# Focused checks (faster)
./scripts/type-check-focused/type-check-worker.sh
```

## Logger System

### In Code
```typescript
import { log } from '@/logger';
const myLog = log('MyComponent.tsx');
myLog.debug('Debug info', data);
myLog.info('Info message', info);
myLog.error('Error occurred', error);
```

### Browser Console
```javascript
logControl.debug();    // Global debug mode
logControl.error();    // Error-only mode
logControl.status();   // Show config
logControl.reset();    // Reset to default
```

## Performance Optimization

### Navigation Performance Pattern
**Problem**: TanStack Router loads all component dependencies synchronously during navigation, causing 500ms+ delays.

**Solution**: Lazy load heavy components to reduce initial bundle:

```typescript
// ⚡ PERFORMANCE: Lazy load heavy components
const EntityCreationDialog = React.lazy(() => import('./EntityCreationDialog').then(m => ({ default: m.EntityCreationDialog })))
const KnowledgeTab = React.lazy(() => import('./KnowledgeTab').then(m => ({ default: m.KnowledgeTab })))

// Wrap in Suspense
<React.Suspense fallback={<div>Loading...</div>}>
  <KnowledgeTab {...props} />
</React.Suspense>
```

**Router Config**: Enable aggressive preloading:
```typescript
defaultPreload: 'intent',    // Preload on hover
defaultPreloadDelay: 50,     // 50ms hover delay
```

**Result**: 600ms → 150ms (74% faster navigation)

## Key Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm chrome-remote         # Chrome DevTools console monitoring
pnpm type-check            # Type checking

# Database
cd main-postgres && docker compose up -d    # Start DB

# Background processes
ps aux | grep -E "(pnpm|node)" | grep -v grep    # Check running
BashOutput(bash_id="...")                        # Monitor output
KillShell(shell_id="...")                        # Stop process
```

## Project Focus

**VibeGrid**: High-performance data grid with Legend State + hybrid React/DOM rendering
- **Location**: `src/components/custom/vibegrid/`
- **Architecture**: Three-layer state (data, visual, interaction)
- **Testing**: Use Browser MCP tools for E2E testing