import { uiLog } from '@/logger';

const log = uiLog('logger/examples.ts');

/**
 * Logger Usage Examples & Configuration Guide
 * 
 * How to use the contextual logging system to prevent log pollution
 * and focus on specific parts of the frontend during development.
 */

import { uiLog, syncLog, dataLog, stateLog, logControl } from './logger';

// ============================================================================
// 1. BASIC USAGE IN FILES
// ============================================================================

// In a UI component file:
const log = uiLog('src/components/UltraTable/UltraTable.tsx');
log.debug('Table rendered', { rowCount: 100 });
log.info('User selected cell', { row: 5, col: 2 });
log.error('Validation failed', new Error('Invalid data'));

// In a sync service file:
const syncLogger = syncLog('src/sync/WebSocketService.ts');
syncLogger.debug('WebSocket message received', { type: 'srv_data' });
syncLogger.info('Sync completed', { duration: '150ms' });

// In a data management file:
const dataLogger = dataLog('src/stores/entityStore.ts');
dataLogger.debug('Entity updated', { id: '123', changes: { name: 'New Name' } });

// ============================================================================
// 2. ENVIRONMENT CONFIGURATION (.env.local)
// ============================================================================

/*
# Basic pattern-based control
VITE_LOG_PATTERNS=sync/*,components/tables/*,state-machines/*
VITE_LOG_DISABLED_PATTERNS=tests/*,archive/*,node_modules/*
VITE_LOG_LEVEL=info

# Context-based isolation (only show specific contexts)
VITE_LOG_CONTEXTS=ui,sync
VITE_LOG_FOCUS_MODE=ui

# Example configurations for different scenarios:

# Working on tables only:
VITE_LOG_PATTERNS=components/tables/*,components/custom/vibegrid/*
VITE_LOG_CONTEXTS=ui,state
VITE_LOG_LEVEL=debug

# Working on sync issues:
VITE_LOG_PATTERNS=sync/*,state-machines/*
VITE_LOG_CONTEXTS=sync,state
VITE_LOG_LEVEL=debug

# Working on auth:
VITE_LOG_PATTERNS=auth/*,routes/*
VITE_LOG_CONTEXTS=auth,routing
VITE_LOG_LEVEL=info

# Disable all logging except errors:
VITE_LOG_FOCUS_MODE=none
VITE_LOG_LEVEL=error
*/

// ============================================================================
// 3. RUNTIME CONTROL (Available in Browser Dev Console)
// ============================================================================

// Focus on specific context (hides all other contexts)
// logControl.focus('ui');     // Only UI logs
// logControl.focus('sync');   // Only sync logs
// logControl.focus('none');   // No logs (except errors)
// logControl.focus('all');    // All logs

// Filter by multiple contexts
// logControl.only('ui', 'state');        // Only UI and state logs
// logControl.add('data');                 // Add data logs to current filters
// logControl.remove('ui');                // Remove UI from current filters
// logControl.clear();                     // Clear all context filters

// Check current status
// logControl.status();

// ============================================================================
// 4. PRACTICAL WORKFLOWS
// ============================================================================

// Scenario A: Working on UltraTable component
export const focusOnTables = () => {
  logControl.focus('ui');
  // Now you only see UI logs, no sync/auth/routing noise
  // Set in .env.local: VITE_LOG_PATTERNS=components/tables/*,components/custom/vibegrid/*
};

// Scenario B: Debugging sync issues
export const focusOnSync = () => {
  logControl.only('sync', 'state');
  // Only sync and state management logs
  // Set in .env.local: VITE_LOG_PATTERNS=sync/*,state-machines/*
};

// Scenario C: Clean development (only errors)
export const quietMode = () => {
  logControl.focus('none');
  // Only errors will show
};

// Scenario D: Performance debugging
export const focusOnPerformance = () => {
  logControl.only('performance', 'ui');
  // Only performance and UI logs
};

// ============================================================================
// 5. MIGRATION FROM console.log
// ============================================================================

// Before:
// console.log('User clicked button', { userId: '123' });

// After:
// const log = uiLog('src/components/MyButton.tsx');
// log.debug('User clicked button', { userId: '123' });

// Before:
// console.error('API request failed', error);

// After:
// const log = dataLog('src/api/userService.ts');
// log.error('API request failed', error);

// ============================================================================
// 6. COMMON PATTERNS
// ============================================================================

// Pattern 1: Component logging
export const createComponentLogger = (componentName: string) => {
  return uiLog(`src/components/${componentName}`);
};

// Pattern 2: Service logging
export const createServiceLogger = (serviceName: string, context: 'sync' | 'data' | 'auth') => {
  if (context === 'sync') return syncLog(`src/services/${serviceName}`);
  if (context === 'data') return dataLog(`src/services/${serviceName}`);
  return dataLog(`src/services/${serviceName}`);
};

// Pattern 3: Hook logging
export const createHookLogger = (hookName: string) => {
  return stateLog(`src/hooks/${hookName}`);
};

// ============================================================================
// 7. VSCODE SNIPPETS (Add to your settings.json)
// ============================================================================

/*
"typescript-log-ui": {
  "prefix": "logui",
  "body": [
    "const log = uiLog('${TM_FILEPATH/.*\\/src\\///}');",
    "log.${1|debug,info,warn,error|}('$2', $3);"
  ],
  "description": "Create UI logger"
},
"typescript-log-sync": {
  "prefix": "logsync", 
  "body": [
    "const log = syncLog('${TM_FILEPATH/.*\\/src\\///}');",
    "log.${1|debug,info,warn,error|}('$2', $3);"
  ],
  "description": "Create sync logger"
}
*/