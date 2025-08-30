import { uiLog } from '@/logger';
const log = uiLog('logger/index.ts');
/**
 * Contextual Logging System with Focus Modes
 * 
 * Environment + Pattern-Based logging with context isolation
 * to prevent log pollution when working on specific parts of the app.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogContext = 
  | 'sync'           // Sync operations, WebSocket, state machines
  | 'ui'             // UI components, interactions, rendering
  | 'data'           // Data operations, CRUD, queries
  | 'auth'           // Authentication, permissions
  | 'routing'        // Navigation, route changes
  | 'performance'    // Performance monitoring, optimization
  | 'state'          // State management, stores
  | 'testing'        // Test-related logging
  | 'debug';         // General debugging

export interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  context: LogContext;
  prefix: string;
  enableTimestamps: boolean;
}

class LoggingManager {
  private patterns: string[] = [];
  private disabledPatterns: string[] = [];
  private globalLevel: LogLevel = 'info';
  private focusMode: LogContext | 'all' | 'none' = 'all';
  private contextFilters: Set<LogContext> = new Set();

  constructor() {
    this.loadEnvironmentConfig();
  }

  private loadEnvironmentConfig() {
    // Environment-based configuration
    const patterns = import.meta.env.VITE_LOG_PATTERNS || '';
    const disabledPatterns = import.meta.env.VITE_LOG_DISABLED_PATTERNS || '';
    const level = import.meta.env.VITE_LOG_LEVEL || 'info';
    const focusMode = import.meta.env.VITE_LOG_FOCUS_MODE || 'all';
    const contextFilters = import.meta.env.VITE_LOG_CONTEXTS || '';

    this.patterns = patterns.split(',').filter(Boolean);
    this.disabledPatterns = disabledPatterns.split(',').filter(Boolean);
    this.globalLevel = level as LogLevel;
    this.focusMode = focusMode as LogContext | 'all' | 'none';
    
    if (contextFilters) {
      this.contextFilters = new Set(contextFilters.split(',') as LogContext[]);
    }
  }

  private matchesPattern(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    });
  }

  private shouldLogForFile(filePath: string): boolean {
    // Check if file is disabled
    if (this.disabledPatterns.length && this.matchesPattern(filePath, this.disabledPatterns)) {
      return false;
    }

    // If no patterns specified, log everything (unless disabled)
    if (this.patterns.length === 0) return true;

    // Check if file matches enabled patterns
    return this.matchesPattern(filePath, this.patterns);
  }

  private shouldLogForContext(context: LogContext): boolean {
    // Focus mode overrides everything
    if (this.focusMode === 'none') return false;
    if (this.focusMode !== 'all' && this.focusMode !== context) return false;

    // Context filters
    if (this.contextFilters.size > 0) {
      return this.contextFilters.has(context);
    }

    return true;
  }

  shouldLog(filePath: string, context: LogContext, level: LogLevel): boolean {
    // Errors always log (unless focus mode is 'none')
    if (level === 'error' && this.focusMode !== 'none') return true;

    // Check file pattern matching
    if (!this.shouldLogForFile(filePath)) return false;

    // Check context filtering
    if (!this.shouldLogForContext(context)) return false;

    // Check log level
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.globalLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  // Runtime configuration methods
  setFocusMode(mode: LogContext | 'all' | 'none') {
    this.focusMode = mode;
    log.info(`🎯 Log focus mode: ${mode}`);
  }

  addContextFilter(...contexts: LogContext[]) {
    contexts.forEach(ctx => this.contextFilters.add(ctx));
    log.info(`🔍 Added context filters: ${contexts.join(', ')}`);
  }

  removeContextFilter(...contexts: LogContext[]) {
    contexts.forEach(ctx => this.contextFilters.delete(ctx));
    log.info(`🚫 Removed context filters: ${contexts.join(', ')}`);
  }

  clearContextFilters() {
    this.contextFilters.clear();
    log.info('🗑️ Cleared all context filters');
  }

  getFocusMode() {
    return this.focusMode;
  }

  getContextFilters() {
    return Array.from(this.contextFilters);
  }
}

const loggingManager = new LoggingManager();

export class Logger {
  private config: LoggerConfig;
  private logLevels = ['debug', 'info', 'warn', 'error'];
  private filePath: string;

  constructor(filePath: string, context: LogContext, config: Partial<LoggerConfig> = {}) {
    this.filePath = filePath;
    
    const fileName = filePath.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || 'App';
    
    this.config = {
      enabled: true,
      level: 'info',
      context,
      prefix: `[${context.toUpperCase()}:${fileName}]`,
      enableTimestamps: true,
      ...config
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return loggingManager.shouldLog(this.filePath, this.config.context, level);
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = this.config.enableTimestamps ? 
      new Date().toISOString().substr(11, 12) : '';
    const levelIcon = this.getLevelIcon(level);
    const contextIcon = this.getContextIcon(this.config.context);
    
    let formatted = `${this.config.prefix} ${contextIcon} ${levelIcon} ${message}`;
    
    if (this.config.enableTimestamps) {
      formatted = `${timestamp} ${formatted}`;
    }
    
    return formatted;
  }

  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case 'debug': return '🔍';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  private getContextIcon(context: LogContext): string {
    switch (context) {
      case 'sync': return '🔄';
      case 'ui': return '🎨';
      case 'data': return '💾';
      case 'auth': return '🔐';
      case 'routing': return '🗺️';
      case 'performance': return '⚡';
      case 'state': return '📊';
      case 'testing': return '🧪';
      case 'debug': return '🐛';
      default: return '📝';
    }
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message);
    
    switch (level) {
      case 'debug':
      case 'info':
        log.info(formatted, data ?? '');
        break;
      case 'warn':
        log.warn(formatted, data ?? '');
        break;
      case 'error':
        log.error(formatted, data ?? '');
        break;
    }
  }

  // Main logging methods
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
}

// Factory functions
export const createLogger = (
  filePath: string, 
  context: LogContext, 
  config?: Partial<LoggerConfig>
): Logger => {
  return new Logger(filePath, context, config);
};

// Convenience function that auto-detects file path
export const useLogger = (context: LogContext, config?: Partial<LoggerConfig>): Logger => {
  // In a real implementation, you'd use a build-time transform to inject __filename
  // For now, use stack trace to get caller file
  const stack = new Error().stack;
  const callerFile = stack?.split('\n')[2]?.match(/\((.+?):\d+:\d+\)/)?.[1] || 'unknown';
  return createLogger(callerFile, context, config);
};

// Global logging control functions (available in dev console)
export const logControl = {
  focus: (context: LogContext | 'all' | 'none') => loggingManager.setFocusMode(context),
  only: (...contexts: LogContext[]) => {
    loggingManager.clearContextFilters();
    loggingManager.addContextFilter(...contexts);
  },
  add: (...contexts: LogContext[]) => loggingManager.addContextFilter(...contexts),
  remove: (...contexts: LogContext[]) => loggingManager.removeContextFilter(...contexts),
  clear: () => loggingManager.clearContextFilters(),
  status: () => {
    log.info('🎯 Focus mode:', loggingManager.getFocusMode());
    log.info('🔍 Context filters:', loggingManager.getContextFilters());
  }
};

// Make available in dev console
if (typeof window !== 'undefined') {
  (window as any).logControl = logControl;
}

// Quick context-specific loggers
export const syncLog = (filePath: string) => createLogger(filePath, 'sync');
export const uiLog = (filePath: string) => createLogger(filePath, 'ui');
export const dataLog = (filePath: string) => createLogger(filePath, 'data');
export const authLog = (filePath: string) => createLogger(filePath, 'auth');
export const stateLog = (filePath: string) => createLogger(filePath, 'state');
export const debugLog = (filePath: string) => createLogger(filePath, 'debug');