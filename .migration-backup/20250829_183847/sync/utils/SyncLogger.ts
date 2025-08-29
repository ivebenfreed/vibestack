/**
 * SyncLogger - Centralized Logging for Sync System
 * 
 * Replaces scattered console.log statements with a unified logging system
 * that supports different log levels and development-aware output.
 * 
 * Part of Phase 2: Logging Infrastructure and Event Types cleanup
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SyncLoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix: string;
  enableTimestamps: boolean;
  enableStateLogging: boolean;
  enableServiceLogging: boolean;
}

const DEFAULT_CONFIG: SyncLoggerConfig = {
  enabled: true,
  level: 'info',
  prefix: '[SyncMachineV3]',
  enableTimestamps: true,
  enableStateLogging: true,
  enableServiceLogging: true
};

export class SyncLogger {
  private config: SyncLoggerConfig;
  private logLevels = ['debug', 'info', 'warn', 'error'];

  constructor(config: Partial<SyncLoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    
    const currentLevelIndex = this.logLevels.indexOf(this.config.level);
    const messageLevelIndex = this.logLevels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, category: string, message: string, data?: any): string {
    const timestamp = this.config.enableTimestamps ? new Date().toISOString() : '';
    const levelIcon = this.getLevelIcon(level);
    const categoryIcon = this.getCategoryIcon(category);
    
    let formatted = `${this.config.prefix} ${levelIcon} ${categoryIcon} ${message}`;
    
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

  private getCategoryIcon(category: string): string {
    switch (category) {
      case 'state': return '📊';
      case 'connection': return '🔌';
      case 'service': return '⚙️';
      case 'message': return '📨';
      case 'validation': return '🔍';
      case 'error': return '💥';
      case 'lifecycle': return '🔄';
      case 'performance': return '⚡';
      default: return '📝';
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, category, message, data);
    
    switch (level) {
      case 'debug':
      case 'info':
        console.log(formatted, data ? data : '');
        break;
      case 'warn':
        console.warn(formatted, data ? data : '');
        break;
      case 'error':
        console.error(formatted, data ? data : '');
        break;
    }
  }

  // State transition logging
  stateTransition(from: string, to: string, event?: string): void {
    if (!this.config.enableStateLogging) return;
    this.log('info', 'state', `State transition: ${from} → ${to}${event ? ` (${event})` : ''}`);
  }

  stateEntry(state: string, context?: any): void {
    if (!this.config.enableStateLogging) return;
    this.log('info', 'state', `Entered state: ${state}`, context);
  }

  stateExit(state: string): void {
    if (!this.config.enableStateLogging) return;
    this.log('info', 'state', `Exited state: ${state}`);
  }

  // Service logging
  serviceInitialized(serviceName: string, config?: any): void {
    if (!this.config.enableServiceLogging) return;
    this.log('info', 'service', `${serviceName} initialized`, config);
  }

  serviceError(serviceName: string, error: Error, context?: string): void {
    this.log('error', 'service', `${serviceName} error${context ? ` (${context})` : ''}`, error);
  }

  serviceCallback(serviceName: string, callbackType: string, data?: any): void {
    if (!this.config.enableServiceLogging) return;
    this.log('debug', 'service', `${serviceName} callback: ${callbackType}`, data);
  }

  // Connection logging
  connectionAttempt(url: string): void {
    this.log('info', 'connection', `Attempting connection to ${url}`);
  }

  connectionEstablished(serverLSN?: string): void {
    this.log('info', 'connection', `Connection established${serverLSN ? ` (server LSN: ${serverLSN})` : ''}`);
  }

  connectionLost(reason?: string): void {
    this.log('warn', 'connection', `Connection lost${reason ? `: ${reason}` : ''}`);
  }

  // Message logging (with heartbeat filtering)
  messageReceived(messageType: string, size?: number): void {
    if (messageType === 'srv_heartbeat') return; // Filter heartbeats
    this.log('debug', 'message', `Received: ${messageType}${size ? ` (${size} bytes)` : ''}`);
  }

  messageSent(messageType: string, size?: number): void {
    if (messageType === 'clt_heartbeat') return; // Filter heartbeats
    this.log('debug', 'message', `Sent: ${messageType}${size ? ` (${size} bytes)` : ''}`);
  }

  messageProcessed(messageType: string, count?: number): void {
    if (messageType === 'srv_heartbeat') return; // Filter heartbeats
    this.log('info', 'message', `Processed: ${messageType}${count ? ` (${count} items)` : ''}`);
  }

  // Validation logging
  validationStarted(reason: string): void {
    this.log('info', 'validation', `Validation started: ${reason}`);
  }

  validationCompleted(isValid: boolean, issueCount: number = 0): void {
    const level = isValid ? 'info' : 'warn';
    const status = isValid ? 'passed' : 'failed';
    this.log(level, 'validation', `Validation ${status}${issueCount > 0 ? ` (${issueCount} issues)` : ''}`);
  }

  validationError(error: Error, reason?: string): void {
    this.log('error', 'validation', `Validation error${reason ? ` (${reason})` : ''}`, error);
  }

  // Performance logging
  performance(operation: string, duration: number, details?: any): void {
    this.log('debug', 'performance', `${operation} completed in ${duration}ms`, details);
  }

  // LSN logging
  lsnUpdate(from: string, to: string, source: string): void {
    this.log('info', 'state', `LSN update: ${from} → ${to} (source: ${source})`);
  }

  // General logging methods
  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  // Configuration methods
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  updateConfig(config: Partial<SyncLoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SyncLoggerConfig {
    return { ...this.config };
  }
}

// Export singleton instance for V3
export const syncLogger = new SyncLogger({
  prefix: '[SyncMachineV3]',
  level: 'info' // Use info level by default to filter debug messages
});

// Export factory for creating loggers with different prefixes
export const createSyncLogger = (config: Partial<SyncLoggerConfig>): SyncLogger => {
  return new SyncLogger(config);
};