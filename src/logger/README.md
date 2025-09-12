# Simple Logger System with File and Folder Level Overrides

**Simple 3-level logging system (info, error, debug) with global configuration and file/folder level overrides.**

This logger provides a simple but powerful logging system with persistent browser storage and runtime configuration via the logControl API.

## Features

- Three log levels: info, error, debug
- Global log level configuration
- File and folder level overrides
- Runtime configuration via logControl API
- Persistent browser storage
- Simple import - just `log(filename)`

## Quick Start

```typescript
import { log } from '@/logger';

// Create a logger for your file
const myLog = log('MyComponent.tsx');

// Use the three log levels
myLog.info('Component rendered', { props });
myLog.debug('Debug info', data);
myLog.error('Error occurred', error);
```

## Runtime Control (Browser Console)

The `logControl` API is available globally in the browser console:

### Basic Level Control
```javascript
// Set global log level (persistent)
logControl.setGlobalLevel('debug');         // Show all logs
logControl.setGlobalLevel('info');          // Show info and errors
logControl.setGlobalLevel('error');         // Show only errors

// Quick shortcuts
logControl.debug();    // Global debug mode
logControl.info();     // Global info mode  
logControl.error();    // Global error-only mode
```

### File-Level Control
```javascript
// Set specific file levels (persistent)
logControl.setFileLevel('MyComponent', 'debug');
logControl.setFileLevel('components/VerboseComponent', 'error');

// Clear file overrides
logControl.clearFileLevel('MyComponent');
```

### Folder-Level Control
```javascript
// Set folder patterns (persistent)
logControl.setFolderLevel('vibegrid', 'info');        // All VibeGrid files at info
logControl.setFolderLevel('components/custom', 'error'); // Folder hierarchy

// Clear folder overrides
logControl.clearFolderLevel('vibegrid');
```

### Utility Functions
```javascript
// Check current configuration
logControl.status();   // Shows complete config in console

// Utility shortcuts
logControl.quiet('vibegrid');           // Set vibegrid to error-only
logControl.focus('MyComponent');        // Focus on one file (others to error)

// Reset everything
logControl.reset();    // Back to default configuration
```

## File Path Normalization

File paths are automatically normalized for consistent matching:

```javascript
// These all resolve to the same normalized path:
log('/src/components/MyComponent.tsx')
log('src/components/MyComponent.tsx') 
log('components/MyComponent.tsx')
log('components/MyComponent')

// Normalization rules:
// - Remove leading slashes
// - Remove 'src/' prefix  
// - Remove file extensions (.ts, .tsx, .js, .jsx)
// Result: 'components/MyComponent'
```

## Configuration Persistence

All configuration is automatically saved to localStorage and persists across:
- Page reloads
- HMR (Hot Module Replacement)
- Browser sessions

The configuration is stored under the key `vibestack-logger-config`.

## Common Use Cases

### Example 1: Debug VibeGrid Components
```javascript
// In browser console:
logControl.setGlobalLevel('error');      // Quiet everything else
logControl.setFolderLevel('vibegrid', 'info');  // Enable VibeGrid logging
```

### Example 2: Focus on One Component
```javascript
// Debug just one problematic component
logControl.focus('MyProblemComponent');  // Only this component logs, others are error-only
```

### Example 3: Quiet Verbose Components  
```javascript
// Keep chatty components quiet while debugging
logControl.setGlobalLevel('info');           // Normal logging
logControl.quiet('components/ChattyTable'); // This one stays quiet
```

### Example 4: Debug Everything
```javascript
logControl.debug();  // Global debug mode - all logs show
```

## Pattern Matching

Folder patterns support partial matching. For example:

```javascript
logControl.setFolderLevel('vibegrid', 'debug');
```

This will match any file path containing 'vibegrid':
- `components/custom/vibegrid/VibeGrid`
- `components/custom/vibegrid/stores/pure-observables`
- `components/custom/vibegrid/overlays/SelectionOverlay`

## Log Level Priority

Log levels have the following priority (lower number = higher priority):

1. **error** (0) - Always shown (unless file specifically muted)
2. **info** (1) - Shown at info and debug levels
3. **debug** (2) - Only shown at debug level

## Browser Console Output

The logger provides styled console output:

- **🐛 [DEBUG]** - Orange text for debug messages
- **ℹ️ [INFO]** - Blue text for info messages  
- **❌ [ERROR]** - Red text for error messages

Each message includes the normalized file path for easy identification.

## Default Configuration

The logger starts with these defaults:

```javascript
{
  globalLevel: 'info',           // Show info and errors by default
  fileOverrides: {},             // No file-specific overrides
  folderOverrides: {
    'vibegrid': 'info'          // VibeGrid components at info level
  }
}
```

## Migration from Old System

The old contextual logger system (uiLog, syncLog, etc.) has been replaced with this simplified system. All imports should be updated to:

```typescript
// OLD (no longer works)
import { uiLog, syncLog, stateLog } from '@/logger';
const log = uiLog('MyComponent.tsx');

// NEW (simplified)
import { log } from '@/logger';
const myLog = log('MyComponent.tsx');
```

## Troubleshooting

**Logs not showing?**
1. Check configuration: `logControl.status()` in browser console
2. Verify global level allows your log level
3. Check if file/folder overrides are affecting your logs

**Too many logs?**  
1. Use `logControl.error()` for error-only mode
2. Set specific patterns to higher levels: `logControl.quiet('vibegrid')`
3. Use `logControl.focus('MyComponent')` to see only one component

**Configuration not persisting?**
1. Check localStorage is enabled in your browser
2. Configuration is stored under `vibestack-logger-config` key
3. Use `logControl.reset()` to clear and start fresh

**Logger not working?**
1. Verify logger is loaded: should see initialization message
2. Ensure using correct import: `import { log } from '@/logger'`
3. Check browser console for any logger system errors

## Advanced Usage

### Custom Log Control Functions

You can extend the logControl API with custom functions:

```javascript
// Add your own shortcuts
window.debugMyFeature = () => {
  logControl.setGlobalLevel('error');
  logControl.setFolderLevel('myfeature', 'debug');
  console.log('🎯 Focused on MyFeature debugging');
};
```

### Programmatic Configuration

```javascript
// Save current config for later
const savedConfig = logControl.status();

// Apply complex configuration
logControl.setGlobalLevel('error');
logControl.setFolderLevel('vibegrid', 'info');
logControl.setFileLevel('components/ImportantComponent', 'debug');

// Later restore
logControl.reset();
// Apply savedConfig settings...
```

The simple logger system provides powerful debugging capabilities while maintaining ease of use and excellent performance.