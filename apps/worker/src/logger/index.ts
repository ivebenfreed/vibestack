/**
 * Simple Contextual Logging System
 * 
 * Single environment variable controls what logs show:
 * - VITE_LOG_CONTEXTS: comma-separated list (sync,state,ui,data,auth,routing,performance,testing,debug)
 * - VITE_LOG_LEVEL: debug|info|warn|error (default: info)
 * 
 * Usage:
 *   import { syncLog } from '@/logger';
 *   const log = syncLog('MyFile.ts');
 *   log.debug('message', data);
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

class SimpleLogger {
  private enabledContexts: Set<LogContext> = new Set();
  private logLevel: LogLevel = 'info';
  private logLevels = ['debug', 'info', 'warn', 'error'];

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // Simple: just read enabled contexts and log level
    const contexts = import.meta.env.VITE_LOG_CONTEXTS;
    const level = import.meta.env.VITE_LOG_LEVEL || 'info';
    
    this.logLevel = level as LogLevel;
    
    if (contexts === undefined) {
      // No env var specified, enable all contexts
      this.enabledContexts = new Set(['sync', 'ui', 'data', 'auth', 'routing', 'performance', 'state', 'testing', 'debug']);
    } else if (contexts === '') {
      // Empty string explicitly set, disable all contexts (quiet mode)
      this.enabledContexts = new Set();
    } else {
      // Specific contexts set
      this.enabledContexts = new Set(contexts.split(',').filter(Boolean) as LogContext[]);
    }
  }

  shouldLog(context: LogContext, level: LogLevel): boolean {
    // Errors always show
    if (level === 'error') return true;
    
    // Check if context is enabled
    if (!this.enabledContexts.has(context)) return false;
    
    // Check log level
    const currentLevelIndex = this.logLevels.indexOf(this.logLevel);
    const messageLevelIndex = this.logLevels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  log(context: LogContext, level: LogLevel, filePath: string, message: string, data?: any): void {
    if (!this.shouldLog(context, level)) return;

    const fileName = filePath.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || 'App';
    const timestamp = new Date().toISOString().substr(11, 12);
    const contextIcon = this.getContextIcon(context);
    const levelIcon = this.getLevelIcon(level);
    
    const formatted = `${timestamp} [${context.toUpperCase()}:${fileName}] ${contextIcon} ${levelIcon} ${message}`;
    
    switch (level) {
      case 'debug':
      case 'info':
        console.info(formatted, data ?? '');
        break;
      case 'warn':
        console.warn(formatted, data ?? '');
        break;
      case 'error':
        console.error(formatted, data ?? '');
        break;
    }
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

  // Runtime control - simple context toggling
  enable(...contexts: LogContext[]): void {
    contexts.forEach(ctx => this.enabledContexts.add(ctx));
    console.info('✅ Enabled contexts:', contexts.join(', '));
  }

  disable(...contexts: LogContext[]): void {
    contexts.forEach(ctx => this.enabledContexts.delete(ctx));
    console.info('❌ Disabled contexts:', contexts.join(', '));
  }

  only(...contexts: LogContext[]): void {
    this.enabledContexts.clear();
    contexts.forEach(ctx => this.enabledContexts.add(ctx));
    console.info('🎯 Only enabled contexts:', contexts.join(', '));
  }

  all(): void {
    this.enabledContexts = new Set(['sync', 'ui', 'data', 'auth', 'routing', 'performance', 'state', 'testing', 'debug']);
    console.info('🌍 All contexts enabled');
  }

  none(): void {
    this.enabledContexts.clear();
    console.info('🔇 All contexts disabled (errors will still show)');
  }

  status(): void {
    console.info('📊 Enabled contexts:', Array.from(this.enabledContexts));
    console.info('📏 Log level:', this.logLevel);
  }
}

const logger = new SimpleLogger();

// Simple logger factory
function createContextLogger(context: LogContext) {
  return (filePath: string) => ({
    debug: (message: string, data?: any) => logger.log(context, 'debug', filePath, message, data),
    info: (message: string, data?: any) => logger.log(context, 'info', filePath, message, data),
    warn: (message: string, data?: any) => logger.log(context, 'warn', filePath, message, data),
    error: (message: string, data?: any) => logger.log(context, 'error', filePath, message, data),
  });
}

// Context-specific loggers
export const syncLog = createContextLogger('sync');
export const uiLog = createContextLogger('ui');
export const dataLog = createContextLogger('data');
export const authLog = createContextLogger('auth');
export const stateLog = createContextLogger('state');
export const routingLog = createContextLogger('routing');
export const performanceLog = createContextLogger('performance');
export const testingLog = createContextLogger('testing');
export const debugLog = createContextLogger('debug');

// Global control (available in console)
export const logControl = {
  enable: (...contexts: LogContext[]) => logger.enable(...contexts),
  disable: (...contexts: LogContext[]) => logger.disable(...contexts),
  only: (...contexts: LogContext[]) => logger.only(...contexts),
  all: () => logger.all(),
  none: () => logger.none(),
  status: () => logger.status(),
};

// Make available in dev console
if (typeof window !== 'undefined') {
  (window as any).logControl = logControl;
}