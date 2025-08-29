# Contextual Logging System

Contextual logging with focus modes to prevent log pollution when working on specific parts of the frontend.

## Quick Start

```typescript
import { uiLog, syncLog, dataLog, logControl } from '@/logger';

// In any component/file
const log = uiLog('components/MyComponent.tsx');
log.debug('Component rendered', { props });
log.info('User interaction', { action: 'click' });
log.error('Validation failed', error); // Always logs
```

## Focus Modes (3 Ways)

### 1. npm Scripts (Recommended)
```bash
pnpm log:vibegrid    # Focus on VibeGrid development
pnpm log:sync        # Debug sync operations  
pnpm log:quiet       # Silent mode (errors only)
pnpm log:clear       # Remove all log configuration
pnpm log:focus       # Show all available options
```

### 2. Runtime Control (Browser Console)
```javascript
logControl.focus('ui');           // Only UI logs
logControl.only('ui', 'sync');    // Only UI and sync logs  
logControl.focus('none');         // Silent mode (errors only)
logControl.status();              // Check current filters
```

### 3. Environment Configuration (.env.local)
```bash
VITE_LOG_PATTERNS=components/tables/*,sync/*
VITE_LOG_CONTEXTS=ui,sync
VITE_LOG_LEVEL=debug
VITE_LOG_FOCUS_MODE=ui
```

## Context Types

- `ui` - Components, interactions, rendering
- `sync` - WebSocket, sync operations, state machines  
- `data` - CRUD operations, API calls, queries
- `state` - State management, stores
- `auth` - Authentication, permissions
- `routing` - Navigation, route changes
- `performance` - Performance monitoring
- `testing` - Test-related logging
- `debug` - General debugging

## Benefits

✅ **No more log pollution** - Focus on what you're working on  
✅ **Context isolation** - Filter by UI, sync, data, etc  
✅ **Pattern-based control** - Enable entire folders at once  
✅ **Runtime switching** - Change focus without restarting  
✅ **Errors always show** - Never miss critical issues  
✅ **Zero config required** - Works out of the box  

See `examples.ts` for detailed usage patterns.