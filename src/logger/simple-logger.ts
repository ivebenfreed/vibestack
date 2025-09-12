/**
 * Simplified File-Level Logging System
 * 
 * Each file can set its own LOG_LEVEL constant to control logging:
 * 
 * const LOG_LEVEL = 'debug';  // Show all logs from this file
 * const LOG_LEVEL = 'info';   // Show info and above
 * const LOG_LEVEL = 'warn';   // Show warnings and errors only  
 * const LOG_LEVEL = 'error';  // Errors only
 * const LOG_LEVEL = 'off';    // No logs from this file
 * 
 * Global default set via VITE_LOG_LEVEL env var (default: 'error')
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  off: 999
};

// Global default from environment
const GLOBAL_LOG_LEVEL = (import.meta.env.VITE_LOG_LEVEL || 'error') as LogLevel;

export interface Logger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

/**
 * Create a logger for a specific file
 * 
 * @param fileName - Name of the file for log identification
 * @param fileLogLevel - Optional override for this file's log level
 *                       - If undefined, uses global level
 *                       - If 'default', explicitly uses global level
 *                       - Any other value overrides the global level
 * @returns Logger instance
 * 
 * @example
 * // At the top of your file:
 * 
 * // Option 1: Always use global setting (no override)
 * const log = createLogger('MyComponent');
 * 
 * // Option 2: Explicit override - always debug regardless of global
 * const LOG_LEVEL = 'debug';
 * const log = createLogger('MyComponent', LOG_LEVEL);
 * 
 * // Option 3: Conditional override
 * const LOG_LEVEL = undefined;  // Change to 'debug' when debugging
 * const log = createLogger('MyComponent', LOG_LEVEL);
 */
export function createLogger(fileName: string, fileLogLevel?: LogLevel | 'default'): Logger {
  // Handle explicit 'default' to use global level
  const effectiveLevel = (fileLogLevel === 'default' || fileLogLevel === undefined) 
    ? GLOBAL_LOG_LEVEL 
    : fileLogLevel;
    
  const levelThreshold = LOG_LEVELS[effectiveLevel];
  
  // Extract just the file name without path/extension for cleaner logs
  const shortName = fileName.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || fileName;
  
  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= levelThreshold;
  };
  
  const formatMessage = (level: LogLevel, message: string): string => {
    const timestamp = new Date().toISOString().substr(11, 12);
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      off: ''
    }[level];
    
    return `${timestamp} [${shortName}] ${levelEmoji} ${message}`;
  };
  
  return {
    debug: (message: string, data?: any) => {
      if (shouldLog('debug')) {
        console.log(formatMessage('debug', message), data ?? '');
      }
    },
    
    info: (message: string, data?: any) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', message), data ?? '');
      }
    },
    
    warn: (message: string, data?: any) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', message), data ?? '');
      }
    },
    
    error: (message: string, data?: any) => {
      if (shouldLog('error')) {
        console.error(formatMessage('error', message), data ?? '');
      }
    }
  };
}

// Export a no-op logger for complete silence
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};