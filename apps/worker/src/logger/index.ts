/**
 * Enhanced Contextual Logging System with File-Level Control
 * 
 * Environment variables control what logs show:
 * - VITE_LOG_CONTEXTS: comma-separated list (sync,state,ui,data,auth,routing,performance,testing,debug)
 * - VITE_LOG_LEVEL: debug|info|warn|error (default: error)
 * 
 * File-level control via runtime:
 * - logControl.setFileLevel('path/to/file.ts', 'debug')
 * - logControl.muteFile('path/to/file.ts')
 * - logControl.onlyFiles(['file1.ts', 'file2.ts'])
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

interface FileLogConfig {
  level?: LogLevel;
  muted?: boolean;
}

class SimpleLogger {
  private enabledContexts: Set<LogContext> = new Set();
  private logLevel: LogLevel = 'info';
  private logLevels = ['debug', 'info', 'warn', 'error'];
  
  // File-level configuration
  private fileConfigs: Map<string, FileLogConfig> = new Map();
  private fileOnlyMode: Set<string> | null = null; // If set, only these files can log

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // Read environment variables set by dev scripts (no .env.local caching issues)
    const contexts = import.meta.env.VITE_LOG_CONTEXTS;
    const level = import.meta.env.VITE_LOG_LEVEL || 'error';
    
    this.logLevel = level as LogLevel;
    
    if (contexts === undefined) {
      // No env var specified, default to quiet mode
      this.enabledContexts = new Set();
    } else if (contexts === '') {
      // Empty string explicitly set, disable all contexts (quiet mode)
      this.enabledContexts = new Set();
    } else {
      // Specific contexts set via dev script
      this.enabledContexts = new Set(contexts.split(',').filter(Boolean) as LogContext[]);
    }
    
    // Load file-level configurations from environment
    // VITE_LOG_FILE_LEVELS="vibegrid:warn,universe-loader:info"
    const fileLevels = import.meta.env.VITE_LOG_FILE_LEVELS;
    if (fileLevels) {
      const configs = fileLevels.split(',');
      configs.forEach((config: string) => {
        const [pattern, fileLevel] = config.split(':');
        if (pattern && fileLevel) {
          // Handle patterns (e.g., "vibegrid/*" or specific files)
          if (pattern.includes('vibegrid')) {
            this.setPatternLevel('vibegrid', fileLevel as LogLevel);
          } else {
            this.setFileLevel(pattern, fileLevel as LogLevel);
          }
        }
      });
    }
    
    // Load muted files from environment
    // VITE_LOG_MUTED_FILES="file1,file2"
    const mutedFiles = import.meta.env.VITE_LOG_MUTED_FILES;
    if (mutedFiles) {
      mutedFiles.split(',').forEach((file: string) => {
        if (file) this.muteFile(file);
      });
    }
    
    // Load file-only mode from environment
    // VITE_LOG_ONLY_FILES="file1,file2"
    const onlyFiles = import.meta.env.VITE_LOG_ONLY_FILES;
    if (onlyFiles) {
      this.onlyFiles(onlyFiles.split(',').filter(Boolean));
    }
    
    const configInfo = [];
    configInfo.push(`contexts=${contexts || 'none'}`);
    configInfo.push(`level=${level}`);
    if (fileLevels) configInfo.push(`file-levels=${fileLevels}`);
    if (mutedFiles) configInfo.push(`muted=${mutedFiles}`);
    if (onlyFiles) configInfo.push(`only-files=${onlyFiles}`);
    
    console.log(`🔧 [Logger] Loaded: ${configInfo.join(', ')}`);
  }

  private getFileKey(filePath: string): string {
    // Normalize file path for consistent matching
    // Remove leading slashes, src/, and file extensions
    return filePath
      .replace(/^\/+/, '')
      .replace(/^src\//, '')
      .replace(/\.(ts|tsx|js|jsx)$/, '');
  }

  shouldLog(context: LogContext, level: LogLevel, filePath: string): boolean {
    // Errors always show unless file is muted
    const fileKey = this.getFileKey(filePath);
    const fileConfig = this.fileConfigs.get(fileKey);
    
    // Check if file is muted
    if (fileConfig?.muted) return false;
    
    // Check file-only mode
    if (this.fileOnlyMode && !this.fileOnlyMode.has(fileKey)) return false;
    
    // Errors always show (unless muted)
    if (level === 'error') return true;
    
    // Check if context is enabled
    if (!this.enabledContexts.has(context)) return false;
    
    // Determine effective log level (file-specific or global)
    const effectiveLevel = fileConfig?.level || this.logLevel;
    const currentLevelIndex = this.logLevels.indexOf(effectiveLevel);
    const messageLevelIndex = this.logLevels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  log(context: LogContext, level: LogLevel, filePath: string, message: string, data?: any): void {
    if (!this.shouldLog(context, level, filePath)) return;

    const fileName = filePath.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '') || 'App';
    const timestamp = new Date().toISOString().substr(11, 12);
    const contextIcon = this.getContextIcon(context);
    const levelIcon = this.getLevelIcon(level);
    
    // Add file-level indicator if configured
    const fileKey = this.getFileKey(filePath);
    const fileConfig = this.fileConfigs.get(fileKey);
    const fileIndicator = fileConfig?.level ? `[${fileConfig.level[0].toUpperCase()}]` : '';
    
    const formatted = `${timestamp} [${context.toUpperCase()}:${fileName}]${fileIndicator} ${contextIcon} ${levelIcon} ${message}`;
    
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

  // File-level control methods
  setFileLevel(filePath: string, level: LogLevel): void {
    const key = this.getFileKey(filePath);
    const config = this.fileConfigs.get(key) || {};
    config.level = level;
    this.fileConfigs.set(key, config);
    console.info(`📄 Set ${key} to ${level} level`);
  }

  muteFile(filePath: string): void {
    const key = this.getFileKey(filePath);
    const config = this.fileConfigs.get(key) || {};
    config.muted = true;
    this.fileConfigs.set(key, config);
    console.info(`🔇 Muted ${key}`);
  }

  unmuteFile(filePath: string): void {
    const key = this.getFileKey(filePath);
    const config = this.fileConfigs.get(key);
    if (config) {
      config.muted = false;
      if (!config.level) {
        this.fileConfigs.delete(key);
      }
    }
    console.info(`🔊 Unmuted ${key}`);
  }

  onlyFiles(filePaths: string[]): void {
    this.fileOnlyMode = new Set(filePaths.map(p => this.getFileKey(p)));
    console.info(`📁 Only logging from:`, Array.from(this.fileOnlyMode));
  }

  clearFileFilters(): void {
    this.fileOnlyMode = null;
    this.fileConfigs.clear();
    console.info('🗑️ Cleared all file-level filters');
  }

  // Set level for multiple files matching a pattern
  setPatternLevel(pattern: string, level: LogLevel): void {
    // Store pattern-based rules for evaluation
    // For simplicity, we'll handle common patterns
    if (pattern.includes('vibegrid')) {
      // Set level for all VibeGrid files
      const vibegridFiles = [
        'components/custom/vibegrid/VibeGrid',
        'components/custom/vibegrid/stores/table-data-store',
        'components/custom/vibegrid/stores/table-data-store-atomic',
        'components/custom/vibegrid/stores/legend-state-atomic-bridge',
        'components/custom/vibegrid/actors/renderer-actor',
        'components/custom/vibegrid/actors/canvas-actor',
        'components/custom/vibegrid/systems/EventDelegationManager',
        'components/custom/vibegrid/systems/EventSystemMigration',
        'components/custom/vibegrid/coordinates/VibeGridXCoordinateManager',
        'components/custom/vibegrid/VibeGridXEvents',
        'components/custom/vibegrid/VibeGridXCore',
        'components/custom/vibegrid/VibeGridXHooks',
        'components/custom/vibegrid/components/ContextMenuRenderer',
        'components/custom/vibegrid/components/VibeGridXColumnVisibility',
        'components/custom/vibegrid/components/VibeGridXHeader'
      ];
      vibegridFiles.forEach(file => this.setFileLevel(file, level));
      console.info(`🎯 Set all VibeGrid files to ${level} level`);
    }
  }

  status(): void {
    console.info('📊 Enabled contexts:', Array.from(this.enabledContexts));
    console.info('📏 Global log level:', this.logLevel);
    if (this.fileConfigs.size > 0) {
      console.info('📄 File-specific levels:');
      this.fileConfigs.forEach((config, file) => {
        if (config.level) console.info(`  - ${file}: ${config.level}`);
        if (config.muted) console.info(`  - ${file}: MUTED`);
      });
    }
    if (this.fileOnlyMode) {
      console.info('📁 File-only mode:', Array.from(this.fileOnlyMode));
    }
  }

  // Focus on specific context with optional file filtering
  focus(context: LogContext | 'none', options?: { files?: string[], level?: LogLevel }): void {
    if (context === 'none') {
      this.none();
      return;
    }
    
    this.only(context);
    
    if (options?.files) {
      this.onlyFiles(options.files);
    }
    
    if (options?.level) {
      this.logLevel = options.level;
    }
    
    console.info(`🎯 Focused on ${context}`, options || '');
  }
}

// Singleton instance
const logger = new SimpleLogger();

// Expose logger controls in browser console
if (typeof window !== 'undefined') {
  (window as any).logControl = {
    // Context controls
    enable: (...contexts: LogContext[]) => logger.enable(...contexts),
    disable: (...contexts: LogContext[]) => logger.disable(...contexts),
    only: (...contexts: LogContext[]) => logger.only(...contexts),
    all: () => logger.all(),
    none: () => logger.none(),
    clear: () => logger.none(),
    focus: (context: LogContext | 'none', options?: any) => logger.focus(context, options),
    
    // File-level controls
    setFileLevel: (file: string, level: LogLevel) => logger.setFileLevel(file, level),
    muteFile: (file: string) => logger.muteFile(file),
    unmuteFile: (file: string) => logger.unmuteFile(file),
    onlyFiles: (files: string[]) => logger.onlyFiles(files),
    clearFileFilters: () => logger.clearFileFilters(),
    setPatternLevel: (pattern: string, level: LogLevel) => logger.setPatternLevel(pattern, level),
    
    // Status
    status: () => logger.status(),
    
    // Presets for common scenarios
    quietVibeGrid: () => {
      logger.only('ui');
      logger.setPatternLevel('vibegrid', 'warn');
      console.info('🎯 VibeGrid set to warn level, other UI components at info');
    },
    
    debugVibeGrid: () => {
      logger.only('ui');
      logger.setPatternLevel('vibegrid', 'debug');
      console.info('🎯 VibeGrid set to debug level');
    },
    
    focusFile: (file: string) => {
      logger.all();
      logger.onlyFiles([file]);
      console.info(`🎯 Focused on single file: ${file}`);
    }
  };
}

// Logger factory functions for each context
function createContextLogger(context: LogContext) {
  return (filePath: string) => ({
    debug: (message: string, data?: any) => logger.log(context, 'debug', filePath, message, data),
    info: (message: string, data?: any) => logger.log(context, 'info', filePath, message, data),
    warn: (message: string, data?: any) => logger.log(context, 'warn', filePath, message, data),
    error: (message: string, data?: any) => logger.log(context, 'error', filePath, message, data),
  });
}

// Export context-specific loggers
export const syncLog = createContextLogger('sync');
export const uiLog = createContextLogger('ui');
export const dataLog = createContextLogger('data');
export const authLog = createContextLogger('auth');
export const routingLog = createContextLogger('routing');
export const performanceLog = createContextLogger('performance');
export const stateLog = createContextLogger('state');
export const testingLog = createContextLogger('testing');
export const debugLog = createContextLogger('debug');

// Export global logger for advanced use cases
export { logger };