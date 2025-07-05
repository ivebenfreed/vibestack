/**
 * Centralized logging service for VibeGridOptimus
 * Provides structured logging with different levels and contexts
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogContext = 'grid' | 'cell' | 'persistence' | 'performance' | 'cleanup'

interface LogEntry {
  timestamp: number
  level: LogLevel
  context: LogContext
  message: string
  data?: any
  error?: Error
}

class GridLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000
  private enabledLevels: Set<LogLevel> = new Set(['info', 'warn', 'error'])
  private enabledContexts: Set<LogContext> = new Set(['grid', 'cell', 'persistence', 'performance', 'cleanup'])

  constructor() {
    // Enable debug logging in development
    if (process.env.NODE_ENV === 'development') {
      this.enabledLevels.add('debug')
    }
  }

  private shouldLog(level: LogLevel, context: LogContext): boolean {
    return this.enabledLevels.has(level) && this.enabledContexts.has(context)
  }

  private formatMessage(context: LogContext, message: string): string {
    const contextEmojis = {
      grid: '📊',
      cell: '🔲', 
      persistence: '💾',
      performance: '⚡',
      cleanup: '🧹'
    }
    return `${contextEmojis[context]} [${context.toUpperCase()}] ${message}`
  }

  private addLog(level: LogLevel, context: LogContext, message: string, data?: any, error?: Error) {
    if (!this.shouldLog(level, context)) return

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      context,
      message,
      data,
      error
    }

    this.logs.push(entry)

    // Trim logs if exceeding max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Console output with proper formatting
    const formattedMessage = this.formatMessage(context, message)
    const consoleMethod = level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error'
    
    if (data && error) {
      console[consoleMethod](formattedMessage, data, error)
    } else if (data) {
      console[consoleMethod](formattedMessage, data)
    } else if (error) {
      console[consoleMethod](formattedMessage, error)
    } else {
      console[consoleMethod](formattedMessage)
    }
  }

  debug(context: LogContext, message: string, data?: any) {
    this.addLog('debug', context, message, data)
  }

  info(context: LogContext, message: string, data?: any) {
    this.addLog('info', context, message, data)
  }

  warn(context: LogContext, message: string, data?: any) {
    this.addLog('warn', context, message, data)
  }

  error(context: LogContext, message: string, error?: Error, data?: any) {
    this.addLog('error', context, message, data, error)
  }

  // Performance logging
  time(context: LogContext, label: string): () => void {
    const start = performance.now()
    this.debug(context, `⏱️ Started: ${label}`)
    
    return () => {
      const duration = performance.now() - start
      this.info('performance', `⏱️ ${label}: ${duration.toFixed(2)}ms`)
    }
  }

  // Get recent logs for debugging
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count)
  }

  // Get logs by context
  getLogsByContext(context: LogContext, count = 50): LogEntry[] {
    return this.logs
      .filter(log => log.context === context)
      .slice(-count)
  }

  // Clear logs
  clearLogs() {
    this.logs = []
    this.info('grid', 'Logs cleared')
  }

  // Configure logging levels
  setLogLevel(levels: LogLevel[]) {
    this.enabledLevels = new Set(levels)
    this.info('grid', `Log levels set to: ${levels.join(', ')}`)
  }

  // Configure logging contexts
  setLogContexts(contexts: LogContext[]) {
    this.enabledContexts = new Set(contexts)
    this.info('grid', `Log contexts set to: ${contexts.join(', ')}`)
  }
}

// Singleton instance
export const gridLogger = new GridLogger()

// Convenience exports
export const logGrid = (level: LogLevel, message: string, data?: any, error?: Error) => {
  if (level === 'error') {
    gridLogger.error('grid', message, error, data)
  } else {
    gridLogger[level]('grid', message, data)
  }
}

export const logCell = (level: LogLevel, message: string, data?: any, error?: Error) => {
  if (level === 'error') {
    gridLogger.error('cell', message, error, data)
  } else {
    gridLogger[level]('cell', message, data)
  }
}

export const logPerformance = (label: string) => gridLogger.time('performance', label)