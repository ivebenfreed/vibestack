/**
 * EXAMPLE LOGGING PATTERNS - NEW SYSTEM
 *
 * This file demonstrates the new logger system with runtime controls
 * via the logControl API.
 */

import { log } from '@/logger';

// ============================================
// PATTERN 1: Standard file logging
// ============================================
const fileLog = log('ExampleComponent');

export function demonstrateNewLogging() {
  // Standard usage - controlled by runtime logControl API
  fileLog.debug('Debug information - controlled by logControl');
  fileLog.info('Info message - controlled by logControl');
  fileLog.warn('Warning message - controlled by logControl');
  fileLog.error('Error message - always important');

  // The logging level is controlled at runtime via browser console:
  // logControl.setGlobalLevel('debug');  // Show all logs
  // logControl.setFileLevel('ExampleComponent', 'error'); // Only errors for this file
  // logControl.setFolderLevel('vibegrid', 'info'); // Set folder-level controls
}

/**
 * NEW LOGGER USAGE GUIDELINES:
 *
 * 1. STANDARD PATTERN: Use this in all files
 *    import { log } from '@/logger';
 *    const fileLog = log('ComponentName');
 *
 * 2. RUNTIME CONTROL: Use browser console to control logging
 *    logControl.setGlobalLevel('debug');         // Global debug mode
 *    logControl.setFileLevel('MyComponent', 'error'); // File-specific level
 *    logControl.setFolderLevel('vibegrid', 'info');   // Folder-level control
 *
 * 3. UTILITY FUNCTIONS:
 *    logControl.debug();           // Global debug mode
 *    logControl.error();           // Global error-only mode
 *    logControl.quiet('vibegrid'); // Set component/folder to error-only
 *    logControl.focus('MyComponent'); // Focus on one component
 *    logControl.status();          // Check current config
 *    logControl.reset();           // Reset to defaults
 *
 * 4. PERSISTENT CONFIGURATION:
 *    - All settings saved to localStorage automatically
 *    - Survives page reloads and HMR
 *    - Per-origin (including port) storage
 *
 * 5. BENEFITS OVER OLD SYSTEM:
 *    - No need to modify source code to change log levels
 *    - Runtime control via browser console
 *    - File and folder-level granular control
 *    - Persistent configuration
 *    - Global settings with specific overrides
 */

/**
 * MIGRATION FROM OLD SYSTEM:
 *
 * OLD (simple-logger):
 *   import { createLogger, type LogLevel } from '@/logger/simple-logger';
 *   const LOG_LEVEL: LogLevel = 'debug';
 *   const log = createLogger('ComponentName', LOG_LEVEL);
 *
 * NEW (runtime-controlled):
 *   import { log } from '@/logger';
 *   const fileLog = log('ComponentName');
 *   // Control via browser console: logControl.setFileLevel('ComponentName', 'debug')
 */