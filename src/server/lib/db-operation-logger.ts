/**
 * Database Operation Logger
 * Tracks all database operations to identify phantom deletions
 */

import { Knex } from 'knex';

export class DbOperationLogger {
  private static instance: DbOperationLogger;
  private operationLog: any[] = [];
  private deleteLog: any[] = [];

  static getInstance(): DbOperationLogger {
    if (!DbOperationLogger.instance) {
      DbOperationLogger.instance = new DbOperationLogger();
    }
    return DbOperationLogger.instance;
  }

  logOperation(operation: string, table: string, data?: any, where?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      table,
      data,
      where,
      stack: new Error().stack,
      pid: process.pid,
    };

    this.operationLog.push(entry);

    // Special handling for DELETE operations
    if (operation === 'DELETE') {
      this.deleteLog.push(entry);
      console.error('🚨 DELETE OPERATION DETECTED:', {
        table,
        where,
        timestamp: entry.timestamp,
        stack: entry.stack?.split('\n').slice(2, 5).join('\n'),
      });
    }

    // Log to console with color coding
    const color = operation === 'DELETE' ? '\x1b[31m' : '\x1b[36m';
    console.log(
      `${color}[DB-OP] ${operation} on ${table}${where ? ` WHERE ${JSON.stringify(where)}` : ''}\x1b[0m`
    );

    // Keep only last 1000 operations in memory
    if (this.operationLog.length > 1000) {
      this.operationLog.shift();
    }
    if (this.deleteLog.length > 100) {
      this.deleteLog.shift();
    }
  }

  getRecentDeletes(limit = 10): any[] {
    return this.deleteLog.slice(-limit);
  }

  getAllOperations(limit = 100): any[] {
    return this.operationLog.slice(-limit);
  }

  // Wrap Knex query builder to intercept operations
  wrapKnexQuery(knex: Knex): Knex {
    const logger = this;
    const originalTable = knex.table.bind(knex);
    const originalRaw = knex.raw.bind(knex);

    // @ts-ignore
    knex.table = function(tableName: string) {
      const query = originalTable(tableName);
      const originalDelete = query.delete.bind(query);
      const originalInsert = query.insert.bind(query);
      const originalUpdate = query.update.bind(query);

      // @ts-ignore
      query.delete = function(...args: any[]) {
        logger.logOperation('DELETE', tableName, null, this._single?.where);
        return originalDelete(...args);
      };

      // @ts-ignore
      query.insert = function(data: any) {
        logger.logOperation('INSERT', tableName, data);
        return originalInsert(data);
      };

      // @ts-ignore
      query.update = function(data: any) {
        logger.logOperation('UPDATE', tableName, data, this._single?.where);
        return originalUpdate(data);
      };

      return query;
    };

    // @ts-ignore
    knex.raw = function(sql: string, ...args: any[]) {
      if (sql.toLowerCase().includes('delete')) {
        logger.logOperation('DELETE_RAW', 'RAW_QUERY', { sql, args });
      }
      return originalRaw(sql, ...args);
    };

    return knex;
  }

  // Create express middleware for checking recent deletes
  getExpressMiddleware() {
    return (req: any, res: any, next: any) => {
      if (req.path === '/api/debug/db-operations') {
        return res.json({
          recentDeletes: this.getRecentDeletes(20),
          allOperations: this.getAllOperations(50),
        });
      }
      next();
    };
  }
}

// Export singleton instance
export const dbLogger = DbOperationLogger.getInstance();