/**
 * Patched Kysely postgres.js adapter for Cloudflare Workers compatibility
 * Fixes hanging query issues by implementing proper connection management
 */

import { 
  DatabaseConnection,
  Driver,
  Dialect,
  DialectAdapter,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  CompiledQuery,
  QueryResult
} from 'kysely';

class PostgresJSConnection implements DatabaseConnection {
  private reservedConnection: any;

  constructor(reservedConnection: any) {
    this.reservedConnection = reservedConnection;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql: queryText, parameters } = compiledQuery;
    
    try {
      console.log('🔍 Executing query:', queryText);
      console.log('📝 Parameters:', parameters);
      
      // Use unsafe with reserved connection and slice parameters for safety
      const result = await this.reservedConnection.unsafe(
        queryText, 
        parameters.slice()
      );
      
      // Convert result properly like the original
      const rows = Array.from(result.values ? result.values() : result) as R[];
      console.log('✅ Query completed, rows:', rows.length);
      
      // Handle affected rows for INSERT/UPDATE/DELETE operations
      if (["INSERT", "UPDATE", "DELETE"].includes(result.command)) {
        const numAffectedRows = BigInt(result.count ?? 0);
        return { 
          rows, 
          numAffectedRows,
          numChangedRows: numAffectedRows 
        };
      }
      
      return { rows };
    } catch (error) {
      console.error('❌ Kysely postgres.js patch error:', error);
      throw error;
    }
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    chunkSize?: number
  ): AsyncIterableIterator<QueryResult<R>> {
    // Enable streaming for Workers where supported
    if (!Number.isInteger(chunkSize) || chunkSize! <= 0) {
      throw new Error('chunkSize must be a positive integer');
    }
    
    try {
      const cursor = this.reservedConnection.unsafe(
        compiledQuery.sql, 
        compiledQuery.parameters.slice()
      ).cursor(chunkSize);
      
      for await (const rows of cursor) {
        yield { rows };
      }
    } catch (error) {
      console.error('❌ Streaming query failed:', error);
      throw error;
    }
  }
}

export class PostgresJSDriver implements Driver {
  private sql: any;

  constructor(sql: any) {
    this.sql = sql;
  }

  async init(): Promise<void> {
    console.log('🚀 Initializing postgres.js driver...');
    // Test connection with simple query
    try {
      await this.sql`SELECT 1`;
      console.log('✅ postgres.js driver initialized successfully');
    } catch (error) {
      console.error('❌ postgres.js driver initialization failed:', error);
      throw error;
    }
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    console.log('📡 Acquiring postgres.js connection...');
    // Try to reserve a connection, fallback to direct usage for Workers compatibility
    try {
      const reservedConnection = await this.sql.reserve();
      return new PostgresJSConnection(reservedConnection);
    } catch (error) {
      console.log('⚠️ Connection reservation failed, using direct connection for Workers');
      return new PostgresJSConnection(this.sql);
    }
  }

  async beginTransaction(connection: DatabaseConnection, settings?: { isolationLevel?: string }): Promise<void> {
    const pgConn = connection as PostgresJSConnection;
    const { isolationLevel } = settings ?? {};
    const sql = isolationLevel 
      ? `START TRANSACTION ISOLATION LEVEL ${isolationLevel.toUpperCase()}`
      : 'BEGIN';
    await pgConn.executeQuery({ sql, parameters: [] } as CompiledQuery);
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const pgConn = connection as PostgresJSConnection;
    await pgConn.executeQuery({ sql: 'COMMIT', parameters: [] } as CompiledQuery);
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const pgConn = connection as PostgresJSConnection;
    await pgConn.executeQuery({ sql: 'ROLLBACK', parameters: [] } as CompiledQuery);
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    console.log('🔓 Releasing postgres.js connection...');
    const pgConn = connection as PostgresJSConnection;
    // Properly release the connection if it was reserved
    if ((pgConn as any).reservedConnection?.release) {
      try {
        (pgConn as any).reservedConnection.release();
        (pgConn as any).reservedConnection = null;
      } catch (error) {
        console.log('⚠️ Connection release failed (expected in Workers):', error.message);
      }
    }
  }

  async destroy(): Promise<void> {
    console.log('💥 Destroying postgres.js driver...');
    try {
      await this.sql.end();
      console.log('✅ postgres.js driver destroyed successfully');
    } catch (error) {
      console.error('❌ Error destroying postgres.js driver:', error);
    }
  }
}

export class PostgresJSDialectPatched implements Dialect {
  private sql: any;

  constructor(sql: any) {
    this.sql = sql;
  }

  createDriver(): Driver {
    return new PostgresJSDriver(this.sql);
  }

  createQueryCompiler(): PostgresQueryCompiler {
    return new PostgresQueryCompiler();
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter();
  }

  createIntrospector(db: Kysely<any>) {
    return new PostgresIntrospector(db);
  }
}