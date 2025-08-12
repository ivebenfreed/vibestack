/**
 * Custom Kysely dialect for @neondatabase/serverless v1.0+
 * This replaces kysely-neon which is incompatible with v1.0+
 */

import {
  DatabaseConnection,
  Driver,
  CompiledQuery,
  QueryResult,
  Dialect,
  DialectAdapter,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  Kysely,
} from 'kysely';
import { neon, neonConfig } from '@neondatabase/serverless';

// HARDCODE: Always configure for local proxy
neonConfig.fetchEndpoint = (host) => {
  if (host === 'db.localtest.me') {
    console.log('[HARDCODED] Using local proxy for host:', host);
    return 'http://db.localtest.me:4444/sql';
  }
  return `https://${host}/sql`;
};
neonConfig.fetchFunction = fetch;

class NeonHTTPConnection implements DatabaseConnection {
  private sql: ReturnType<typeof neon>;

  constructor(connectionString: string) {
    // neonConfig should be configured globally before this point
    // The configuration is now done in auth.ts initializeAuth() function
    // Remove port 4444 if it's a local connection
    const cleanConnectionString = connectionString.includes('db.localtest.me') 
      ? connectionString.replace(':4444', '')
      : connectionString;
    this.sql = neon(cleanConnectionString);
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql: queryText, parameters } = compiledQuery;
    
    // DEBUG: Log ALL queries for debugging
    console.log('🔍 [Kysely Query]:', {
      query: queryText,
      parameters: parameters,
      paramCount: parameters?.length || 0
    });
    
    try {
      let result: any;
      
      if (parameters && parameters.length > 0) {
        // For parameterized queries, use the query() method which is available in v1.0+
        // The sql function returned by neon() has a .query() method for parameterized queries
        const rows = await this.sql.query(queryText, parameters as any[]);
        result = { rows, rowCount: rows.length };
      } else {
        // For non-parameterized queries, we can use the sql function directly as a tagged template
        // But since we have a plain string, we need to use the query method without parameters
        const rows = await this.sql.query(queryText, []);
        result = { rows, rowCount: rows.length };
      }
      
      return {
        rows: result.rows as R[],
        numAffectedRows: BigInt(result.rowCount ?? 0),
        numChangedRows: BigInt(result.rowCount ?? 0),
      };
    } catch (error: any) {
      console.error('NeonHTTPDialect error:', error);
      
      // DEBUG: Additional error context for sessions table
      if (queryText.toLowerCase().includes('sessions')) {
        console.error('🔍 DEBUG: Failed sessions query details:', {
          query: queryText,
          parameters: parameters,
          error: {
            message: error.message,
            code: error.code,
            detail: error.detail,
            column: error.column,
            table: error.table
          }
        });
      }
      
      throw error;
    }
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    chunkSize?: number
  ): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Streaming not supported with Neon HTTP');
  }
}

class NeonHTTPDriver implements Driver {
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async init(): Promise<void> {
    // Test connection using the query method for v1.0+
    // Remove port 4444 if it's a local connection
    const cleanConnectionString = this.connectionString.includes('db.localtest.me') 
      ? this.connectionString.replace(':4444', '')
      : this.connectionString;
    console.log('[NeonHTTPDriver] init() called with connectionString:', cleanConnectionString.substring(0, 50) + '...');
    const sql = neon(cleanConnectionString);
    try {
      await sql`SELECT 1`;
      console.log('[NeonHTTPDriver] init() successful');
    } catch (error) {
      console.error('[NeonHTTPDriver] init() failed:', error);
      throw error;
    }
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    return new NeonHTTPConnection(this.connectionString);
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery({ sql: 'BEGIN', parameters: [] } as CompiledQuery);
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery({ sql: 'COMMIT', parameters: [] } as CompiledQuery);
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    await connection.executeQuery({ sql: 'ROLLBACK', parameters: [] } as CompiledQuery);
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    // HTTP connections are stateless, nothing to release
  }

  async destroy(): Promise<void> {
    // Nothing to destroy for HTTP connections
  }
}

/**
 * Custom NeonHTTPDialect that works with @neondatabase/serverless v1.0+
 */
export class NeonHTTPDialectV1 implements Dialect {
  private connectionString: string;

  constructor(config: { connectionString: string }) {
    this.connectionString = config.connectionString;
  }

  createDriver(): Driver {
    return new NeonHTTPDriver(this.connectionString);
  }

  createAdapter(): DialectAdapter {
    return new PostgresAdapter();
  }

  createIntrospector(db: Kysely<any>): PostgresIntrospector {
    return new PostgresIntrospector(db);
  }

  createQueryCompiler(): PostgresQueryCompiler {
    return new PostgresQueryCompiler();
  }
}