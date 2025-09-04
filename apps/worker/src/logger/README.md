# Simple Contextual Logging System

**Single environment variable controls what logs show:**
- VITE_LOG_CONTEXTS: comma-separated list (sync,state,ui,data,auth,routing,performance,testing,debug)
- VITE_LOG_LEVEL: debug|info|warn|error (default: info)

## Quick Start

```typescript
import { syncLog, stateLog, uiLog } from '@/logger';

// In any component/file
const log = syncLog('MyFile.ts');
log.debug('WebSocket connected', { url });
log.info('Sync completed', { changes: 5 });
log.error('Connection failed', error); // Always shows
```

## Dev Scripts Control Logging

**Environment variables are set by dev scripts, not .env.local files:**

```bash
# Silent mode (errors only)
pnpm dev:quiet      # VITE_LOG_CONTEXTS='' VITE_LOG_LEVEL='error'

# Focus on sync operations  
pnpm dev:sync       # VITE_LOG_CONTEXTS='sync,state' VITE_LOG_LEVEL='debug'

# Focus on UI components
pnpm dev:ui         # VITE_LOG_CONTEXTS='ui' VITE_LOG_LEVEL='debug'

# Debug mode (multiple contexts)
pnpm dev:debug      # VITE_LOG_CONTEXTS='sync,state,ui,data' VITE_LOG_LEVEL='debug'

# All contexts enabled
pnpm dev:all        # VITE_LOG_CONTEXTS='sync,state,ui,data,auth,routing,performance,testing,debug' VITE_LOG_LEVEL='debug'
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

- **Simple**: Environment variables set by dev scripts only
- **No caching issues**: Dev scripts control everything directly
- **Always errors**: Error logs always show regardless of settings
- **Easy switching**: Change contexts without restart via console
- **Clean output**: Contextual filtering prevents log pollution
- **Instant quiet mode**: Runtime controls work immediately

## Key Features

### Dev Script Control
- Initial logging state set by `pnpm dev:*` commands
- No `.env.local` file dependencies (prevents caching issues)
- Restart server to change initial logging configuration

### Runtime Controls (No Restart Required)
- `logControl.none()` - Instant quiet mode
- `logControl.only('sync')` - Focus on specific contexts
- `logControl.status()` - Check current state
- Perfect for quick debugging without server restarts

## Migration from Old System

The new system automatically works with existing `syncLog()` and `stateLog()` calls. No code changes needed.

**Old complex env vars removed:**
- ~~`VITE_LOG_PATTERNS`~~ 
- ~~`VITE_LOG_DISABLED_PATTERNS`~~
- ~~`VITE_LOG_FOCUS_MODE`~~
- ~~`.env.local` logging configuration~~

**New simple approach:**
- Dev scripts control initial state via environment variables
- Runtime controls for instant switching without restarts

## Troubleshooting

**Logs not showing?**
1. Check contexts: `logControl.status()` in browser console
2. Use dev script: `pnpm dev:debug` for debug mode
3. Runtime enable: `logControl.all()` to see everything

**Too many logs?**
1. Use dev scripts: `pnpm dev:quiet` for silent mode
2. Runtime control: `logControl.none()` for instant quiet

**Need to switch contexts quickly?**
1. Use runtime controls (no restart): `logControl.only('sync', 'state')`
2. For permanent change: restart with different dev script

**Logger not working?**
1. Verify logger loaded: `typeof window.logControl === 'object'`
2. Clear any cached filters: `logControl.clear()`