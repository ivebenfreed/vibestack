# Enhanced Contextual Logging System with File-Level Control

**Persistent logging configuration through dev scripts with file-level granularity:**
- VITE_LOG_CONTEXTS: comma-separated list (sync,state,ui,data,auth,routing,performance,testing,debug)
- VITE_LOG_LEVEL: debug|info|warn|error (default: error)
- VITE_LOG_FILE_LEVELS: file-specific levels (e.g., "vibegrid:info,universe-loader:debug")
- VITE_LOG_MUTED_FILES: comma-separated list of files to mute
- VITE_LOG_ONLY_FILES: comma-separated list of files to exclusively show

## Quick Start

```typescript
import { syncLog, stateLog, uiLog } from '@/logger';

// In any component/file
const log = uiLog('components/MyComponent.tsx');
log.debug('Component rendered', { props });
log.info('User action', { action });
log.error('Validation failed', error); // Always shows (unless file is muted)
```

## Dev Scripts with File-Level Control

**Logging configuration persists through HMR via wrapper script:**

```bash
# Silent mode (errors only)
pnpm dev:quiet

# Focus on UI components  
pnpm dev:ui                      # All UI at debug level

# UI with quiet VibeGrid (most UI quiet, VibeGrid at info)
pnpm dev:ui:quiet-vibegrid       # UI at error level, VibeGrid at info level

# Focus heavily on VibeGrid
pnpm dev:ui:focus-vibegrid       # UI at error level, VibeGrid at debug level

# Debug mode with quiet VibeGrid
pnpm dev:debug:quiet-vibegrid    # Multiple contexts at debug, VibeGrid at warn


# Focus on specific file
pnpm dev:focus                   # Only shows logs from universe-loader
```

## Custom Configuration

Use the wrapper script directly for custom configurations:

```bash
# Custom configuration example with file-level overrides
./scripts/dev-with-logging.sh custom \
  --contexts=ui,sync \
  --level=debug \
  --file-levels=vibegrid:warn,universe-loader:info \
  --muted=table-data-store
```

## Runtime Controls (Browser Console)

### Context Controls
```javascript
// Quick controls
logControl.only('sync', 'state');  // Only these contexts
logControl.enable('ui');            // Add UI logs  
logControl.disable('data');         // Remove data logs
logControl.all();                   // Enable everything
logControl.none();                  // Only errors
logControl.status();                // Show current config
```

### File-Level Controls (Lost on HMR)
```javascript
// File-specific controls (use dev scripts for persistence)
logControl.setFileLevel('components/custom/vibegrid/VibeGrid', 'debug');
logControl.muteFile('components/custom/vibegrid/stores/table-data-store');
logControl.onlyFiles(['components/MyComponent', 'services/MyService']);
logControl.clearFileFilters();

// Pattern-based control
logControl.setPatternLevel('vibegrid', 'warn');  // All VibeGrid files to warn

// Presets
logControl.quietVibeGrid();   // UI context with VibeGrid at warn
logControl.debugVibeGrid();   // UI context with VibeGrid at debug
logControl.focusFile('components/MyComponent');  // Only this file
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

## File-Level Configuration

### How It Works
1. **Global Level**: Set by `VITE_LOG_LEVEL` (default: error)
2. **File Overrides**: Set by `VITE_LOG_FILE_LEVELS` 
3. **Muted Files**: Set by `VITE_LOG_MUTED_FILES` (no logs at all)
4. **Only Mode**: Set by `VITE_LOG_ONLY_FILES` (only these files log)

### File Path Normalization
File paths are normalized for matching:
- Leading slashes removed
- `src/` prefix removed  
- File extensions removed
- Example: `/src/components/MyComponent.tsx` → `components/MyComponent`

### Pattern Support
The `vibegrid` pattern automatically matches all VibeGrid component files:
- `components/custom/vibegrid/VibeGrid`
- `components/custom/vibegrid/stores/*`
- `components/custom/vibegrid/actors/*`
- `components/custom/vibegrid/components/*`
- All VibeGridX core files and utilities

This makes it simple to control verbosity: `vibegrid:warn` quiets all VibeGrid files.

## Benefits ✅

- **Persistent Configuration**: Survives HMR reloads via dev scripts
- **File-Level Granularity**: Control verbosity per file or pattern
- **No .env.local Issues**: Direct environment variable passing
- **Always Errors**: Error logs always show (unless file is muted)
- **Easy Switching**: Multiple presets for common scenarios
- **Clean Output**: Precise control prevents log pollution

## Common Use Cases

### Debugging Specific Component
```bash
# Focus on one problematic component
./scripts/dev-with-logging.sh focus-file MyComponent
```

### Quiet Verbose Components
```bash
# Keep chatty components quiet while debugging others
pnpm dev:ui:quiet-vibegrid  # UI debugging with quiet VibeGrid
```

### Production-like Environment
```bash
# Minimal logging for performance testing
pnpm dev:quiet  # Only errors show
```

### Full Debug Mode
```bash
# Everything at maximum verbosity
pnpm dev:all  # All contexts at debug level
```

## Troubleshooting

**Logs not showing?**
1. Check configuration: `logControl.status()` in browser console
2. Verify context is enabled for your logger type
3. Check if file is muted or filtered
4. Use `pnpm dev:debug` for debug mode

**Too many logs?**
1. Use `pnpm dev:quiet` for silent mode
2. Set specific files to higher levels (warn/error)
3. Mute verbose files with `--muted=filename`

**File-level settings not persisting?**
1. Use dev scripts, not runtime controls for persistence
2. Runtime file-level controls are lost on HMR
3. Add custom presets to `scripts/dev-with-logging.sh`

**Logger not working?**
1. Verify logger loaded: Check for startup log message
2. Ensure using correct import (`uiLog`, `syncLog`, etc.)
3. Check file path is correctly passed to logger factory