/**
 * Simple Logger System with File and Folder Level Overrides
 * 
 * This logger provides a simple 4-level logging system (debug, info, warn, error)
 * with global configuration and file/folder level overrides.
 * 
 * Features:
 * - Four log levels: debug, info, warn, error
 * - Global log level configuration
 * - File and folder level overrides
 * - Runtime configuration via logControl API
 * - Persistent browser storage
 * 
 * Usage Examples:
 * 
 * import { log } from '@/logger';
 * const myLog = log('MyComponent.tsx');
 * myLog.info('Component rendered', { props });
 * myLog.debug('Debug info', data);
 * myLog.warn('Warning message', warning);
 * myLog.error('Error occurred', error);
 * 
 * // Runtime control (browser console)
 * logControl.setGlobalLevel('debug');         // Set global level
 * logControl.setFileLevel('MyComponent', 'info'); // Set specific file level
 * logControl.setFolderLevel('vibegrid', 'error');  // Set folder level
 */

// Log levels (in priority order)
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Log configuration interface
interface LogConfig {
  globalLevel: LogLevel;
  fileOverrides: Record<string, LogLevel>;
  folderOverrides: Record<string, LogLevel>;
}

// Default configuration
const DEFAULT_CONFIG: LogConfig = {
  globalLevel: 'info',
  fileOverrides: {},
  folderOverrides: {}
};

// Log level priorities (lower number = higher priority)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Browser storage key
const STORAGE_KEY = 'vibestack-logger-config';

/**
 * Normalize file path for consistent matching
 */
function normalizeFilePath(filePath: string): string {
  return filePath
    .replace(/^\/+/, '')           // Remove leading slashes
    .replace(/^src\//, '')         // Remove src/ prefix
    .replace(/\.(ts|tsx|js|jsx)$/, ''); // Remove file extension
}

/**
 * Logger configuration manager
 */
class LoggerConfig {
  private config: LogConfig;
  
  constructor() {
    this.config = this.loadConfig();
  }
  
  private loadConfig(): LogConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load logger config from localStorage:', error);
    }
    return { ...DEFAULT_CONFIG };
  }
  
  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.warn('Failed to save logger config to localStorage:', error);
    }
  }
  
  /**
   * Check if a log level should be shown for a given file
   */
  shouldLog(level: LogLevel, filePath: string): boolean {
    const normalizedPath = normalizeFilePath(filePath);
    
    // Get effective log level for this file
    const effectiveLevel = this.getEffectiveLevel(normalizedPath);
    
    // Check if current log level meets the threshold
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[effectiveLevel];
  }
  
  private getEffectiveLevel(normalizedPath: string): LogLevel {
    // Check for exact file match first
    if (this.config.fileOverrides[normalizedPath]) {
      return this.config.fileOverrides[normalizedPath];
    }
    
    // Check for folder matches (check from most specific to least specific)
    const pathParts = normalizedPath.split('/');
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const folderPath = pathParts.slice(0, i + 1).join('/');
      if (this.config.folderOverrides[folderPath]) {
        return this.config.folderOverrides[folderPath];
      }
      
      // Also check partial folder names (e.g., 'vibegrid' matches any folder containing 'vibegrid')
      for (const [folderPattern, level] of Object.entries(this.config.folderOverrides)) {
        if (normalizedPath.includes(folderPattern)) {
          return level;
        }
      }
    }
    
    // Fall back to global level
    return this.config.globalLevel;
  }
  
  /**
   * Set global log level
   */
  setGlobalLevel(level: LogLevel): void {
    this.config.globalLevel = level;
    this.saveConfig();
  }
  
  /**
   * Set log level for a specific file
   */
  setFileLevel(filePath: string, level: LogLevel): void {
    const normalizedPath = normalizeFilePath(filePath);
    this.config.fileOverrides[normalizedPath] = level;
    this.saveConfig();
  }
  
  /**
   * Set log level for a folder pattern
   */
  setFolderLevel(folderPattern: string, level: LogLevel): void {
    this.config.folderOverrides[folderPattern] = level;
    this.saveConfig();
  }
  
  /**
   * Remove file-specific override
   */
  clearFileLevel(filePath: string): void {
    const normalizedPath = normalizeFilePath(filePath);
    delete this.config.fileOverrides[normalizedPath];
    this.saveConfig();
  }
  
  /**
   * Remove folder-specific override
   */
  clearFolderLevel(folderPattern: string): void {
    delete this.config.folderOverrides[folderPattern];
    this.saveConfig();
  }
  
  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig();
  }
  
  /**
   * Get current configuration status
   */
  getStatus(): LogConfig {
    return { ...this.config };
  }
}

// Global configuration instance
const config = new LoggerConfig();

/**
 * Log control API for runtime configuration
 */
export const logControl = {
  /**
   * Set global log level
   */
  setGlobalLevel: (level: LogLevel) => config.setGlobalLevel(level),
  
  /**
   * Set log level for a specific file
   */
  setFileLevel: (filePath: string, level: LogLevel) => config.setFileLevel(filePath, level),
  
  /**
   * Set log level for a folder pattern
   */
  setFolderLevel: (folderPattern: string, level: LogLevel) => config.setFolderLevel(folderPattern, level),
  
  /**
   * Clear file-specific override
   */
  clearFileLevel: (filePath: string) => config.clearFileLevel(filePath),
  
  /**
   * Clear folder-specific override
   */
  clearFolderLevel: (folderPattern: string) => config.clearFolderLevel(folderPattern),
  
  /**
   * Reset to default configuration
   */
  reset: () => config.reset(),
  
  /**
   * Get current configuration status
   */
  status: () => {
    const status = config.getStatus();
    console.log('📊 Logger Configuration:', status);
    return status;
  },
  
  /**
   * Enable debug mode globally
   */
  debug: () => config.setGlobalLevel('debug'),
  
  /**
   * Enable info mode globally
   */
  info: () => config.setGlobalLevel('info'),
  
  /**
   * Enable warn mode globally
   */
  warn: () => config.setGlobalLevel('warn'),
  
  /**
   * Enable error only mode globally
   */
  error: () => config.setGlobalLevel('error'),
  
  /**
   * Quiet a specific file or folder pattern
   */
  quiet: (pattern: string) => config.setFolderLevel(pattern, 'error'),
  
  /**
   * Focus on a specific file or folder pattern (debug level)
   */
  focus: (pattern: string) => {
    config.setGlobalLevel('error');    // Quiet everything else
    config.setFolderLevel(pattern, 'debug');  // Focus on this pattern
  }
};

/**
 * Create a logger instance for a specific file
 */
function createLogger(filename: string) {
  const normalizedPath = normalizeFilePath(filename);
  
  return {
    debug: (message: string, data?: any) => {
      if (config.shouldLog('debug', normalizedPath)) {
        const prefix = `🐛 [DEBUG] ${normalizedPath}`;
        console.log(
          `%c${prefix}%c ${message}`,
          'color: #F97316; font-weight: bold',
          'color: inherit',
          data !== undefined ? data : ''
        );
      }
    },
    
    info: (message: string, data?: any) => {
      if (config.shouldLog('info', normalizedPath)) {
        const prefix = `ℹ️ [INFO] ${normalizedPath}`;
        console.info(
          `%c${prefix}%c ${message}`,
          'color: #3B82F6; font-weight: bold',
          'color: inherit',
          data !== undefined ? data : ''
        );
      }
    },
    
    warn: (message: string, data?: any) => {
      if (config.shouldLog('warn', normalizedPath)) {
        const prefix = `⚠️ [WARN] ${normalizedPath}`;
        console.warn(
          `%c${prefix}%c ${message}`,
          'color: #F59E0B; font-weight: bold',
          'color: inherit',
          data !== undefined ? data : ''
        );
      }
    },
    
    error: (message: string, data?: any) => {
      if (config.shouldLog('error', normalizedPath)) {
        const prefix = `❌ [ERROR] ${normalizedPath}`;
        console.error(
          `%c${prefix}%c ${message}`,
          'color: #EF4444; font-weight: bold',
          'color: inherit',
          data !== undefined ? data : ''
        );
      }
    }
  };
}

/**
 * Main log function
 * 
 * Usage:
 * import { log } from '@/logger';
 * const myLog = log('MyComponent.tsx');
 * myLog.info('Something happened', data);
 */
export const log = (filename: string) => createLogger(filename);

// Expose logControl in browser console
if (typeof window !== 'undefined') {
  (window as any).logControl = logControl;
}

// Initialize with sensible defaults for VibeStack development
if (typeof window !== 'undefined') {
  // Set VibeGrid components to info level by default (reduce noise)
  logControl.setFolderLevel('vibegrid', 'info');
}