/**
 * Patched Kysely-Neon adapter for compatibility with @neondatabase/serverless 1.0.1
 * The new version changed from sql(query, params) to sql.query(query, params)
 */

import { 
  DatabaseConnection,
  Driver,
  CompiledQuery,
  QueryResult
} from 'kysely';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Enable WebSocket for Neon in Node.js environment
if (typeof process !== 'undefined' && process.versions?.node) {
  neonConfig.webSocketConstructor = ws;
}

class NeonConnection implements DatabaseConnection {
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql: queryText, parameters } = compiledQuery;
    
    try {
      // Use sql.query() instead of sql() for new @neondatabase/serverless API
      const result = await this.client.query(queryText, parameters as any[]);
      
      return {
        rows: result.rows as R[],
        numAffectedRows: BigInt(result.rowCount ?? 0),
        numChangedRows: BigInt(result.rowCount ?? 0),
      };
    } catch (error) {
      console.error('Kysely-Neon patch error:', error);
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

export class NeonDriver implements Driver {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async init(): Promise<void> {
    // Test connection
    const client = await this.pool.connect();
    await client.release();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const client = await this.pool.connect();
    return new NeonConnection(client);
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    const neonConn = connection as NeonConnection;
    await neonConn.executeQuery({ sql: 'BEGIN', parameters: [] } as CompiledQuery);
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const neonConn = connection as NeonConnection;
    await neonConn.executeQuery({ sql: 'COMMIT', parameters: [] } as CompiledQuery);
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const neonConn = connection as NeonConnection;
    await neonConn.executeQuery({ sql: 'ROLLBACK', parameters: [] } as CompiledQuery);
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    const neonConn = connection as NeonConnection;
    if ((neonConn as any).client?.release) {
      await (neonConn as any).client.release();
    }
  }

  async destroy(): Promise<void> {
    await this.pool.end();
  }
}