# Simple Contextual Logging System

**Simplified logging system with just two environment variables and easy runtime controls.**

## Quick Start

```typescript
import { syncLog, stateLog, uiLog } from '@/logger';

// In any component/file
const log = syncLog('MyFile.ts');
log.debug('WebSocket connected', { url });
log.info('Sync completed', { changes: 5 });
log.error('Connection failed', error); // Always shows
```

## Configuration (2 Environment Variables)

**In `apps/worker/.env.local`:**

```bash
# What contexts to show (if empty, shows all)
VITE_LOG_CONTEXTS=sync,state

# Log level threshold  
VITE_LOG_LEVEL=debug
```

## Quick Commands

```bash
# Focus on sync operations
pnpm log:sync          # Shows sync + state logs

# Focus on specific areas  
pnpm log:state         # State management 
pnpm log:ui            # UI components
pnpm log:data          # Data operations

# Control everything
pnpm log:all           # All contexts enabled
pnpm log:none          # Only errors show
pnpm log:clear         # Remove all config

# Custom combinations
pnpm log:focus sync,ui,data
```

## Runtime Controls (Browser Console)

```javascript
// Quick controls
logControl.only('sync', 'state');  // Only these contexts
logControl.enable('ui');            // Add UI logs  
logControl.disable('data');         // Remove data logs
logControl.all();                   // Enable everything
logControl.none();                  // Only errors
logControl.status();                // Show current config
```

## Available Contexts

- `sync` - WebSocket, sync operations, state machines
- `state` - State management, stores, Legend State
- `ui` - Components, interactions, rendering  
- `data` - CRUD operations, API calls, queries
- `auth` - Authentication, permissions
- `routing` - Navigation, route changes
- `performance` - Performance monitoring
- `testing` - Test-related logging
- `debug` - General debugging

## Benefits ✅

- **Simple**: Just 2 environment variables
- **No conflicts**: Runtime controls work predictably
- **Always errors**: Error logs always show regardless of settings
- **Easy switching**: Change contexts without restart via console
- **Clean output**: Contextual filtering prevents log pollution

## Migration from Old System

The new system automatically works with existing `syncLog()` and `stateLog()` calls. No code changes needed.

**Old complex env vars removed:**
- ~~`VITE_LOG_PATTERNS`~~ 
- ~~`VITE_LOG_DISABLED_PATTERNS`~~
- ~~`VITE_LOG_FOCUS_MODE`~~

**New simple env vars:**
- `VITE_LOG_CONTEXTS` - comma-separated contexts
- `VITE_LOG_LEVEL` - debug|info|warn|error

## Troubleshooting

**Logs not showing?**
1. Check contexts: `logControl.status()` in browser console
2. Check level: Lower level in `.env.local` (use `debug`)  
3. Restart dev server after env changes

**Too many logs?**
1. Focus on specific contexts: `pnpm log:sync` 
2. Use browser console: `logControl.only('sync', 'state')`

**No logs at all?**
1. Enable all: `logControl.all()` or `pnpm log:all`
2. Check if contexts are empty: `VITE_LOG_CONTEXTS=` shows nothing