import { CompiledQuery, DatabaseConnection, QueryResult } from 'kysely';
import { neon } from '@neondatabase/serverless';
import type { NeonHTTPDialectConfig } from '../types';

export class NeonHTTPConnection implements DatabaseConnection {
  private sql: ReturnType<typeof neon>;
  private config: NeonHTTPDialectConfig;
  private queryCount = 0;

  constructor(config: NeonHTTPDialectConfig) {
    this.config = config;
    const cleanConnectionString = this.cleanConnectionString(config.connectionString);
    this.sql = neon(cleanConnectionString);
  }

  private cleanConnectionString(connectionString: string): string {
    if (connectionString.includes('db.localtest.me')) {
      return connectionString.replace(/:(\d+)/, '');
    }
    return connectionString;
  }

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql: queryText, parameters } = compiledQuery;
    const queryId = ++this.queryCount;
    
    if (this.config.debug) {
      console.log(`[NeonHTTP Query #${queryId}]`, {
        query: queryText.substring(0, 100),
        paramCount: parameters?.length || 0,
      });
    }

    const startTime = Date.now();
    
    try {
      // Use the query method for parameterized queries
      // The query method returns rows directly by default
      const result = await this.sql.query(queryText, parameters as any[]);
      const rows = Array.isArray(result) ? result : result.rows || [];

      const duration = Date.now() - startTime;
      
      if (this.config.debug) {
        console.log(`[NeonHTTP Query #${queryId}] Completed in ${duration}ms, returned ${rows.length} rows`);
      }

      // Extract metadata from the result if available
      const rowCount = this.extractRowCount(queryText, rows);
      
      return {
        rows: rows as R[],
        numAffectedRows: BigInt(rowCount),
        numChangedRows: BigInt(rowCount),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.config.debug) {
        console.error(`[NeonHTTP Query #${queryId}] Failed after ${duration}ms:`, error);
      }

      // Enhanced error handling with context
      if (error instanceof Error) {
        const enhancedError = new Error(
          `NeonHTTPConnection query failed: ${error.message}\n` +
          `Query: ${queryText.substring(0, 200)}${queryText.length > 200 ? '...' : ''}`
        );
        // Attach original error as cause (ES2022+) or fallback to stack trace
        if ('cause' in enhancedError) {
          (enhancedError as any).cause = error;
        }
        throw enhancedError;
      }
      
      throw error;
    }
  }

  private extractRowCount(queryText: string, rows: any[]): number {
    const upperQuery = queryText.toUpperCase();
    
    // For SELECT queries, return the number of rows fetched
    if (upperQuery.startsWith('SELECT')) {
      return rows.length;
    }
    
    // For INSERT/UPDATE/DELETE with RETURNING clause
    if (upperQuery.includes('RETURNING')) {
      return rows.length;
    }
    
    // For data modification queries, try to extract count from result
    if (upperQuery.startsWith('INSERT') || 
        upperQuery.startsWith('UPDATE') || 
        upperQuery.startsWith('DELETE')) {
      // Neon might return affected row count in different ways
      // This is a fallback - actual implementation depends on Neon's response
      return rows.length || 0;
    }
    
    return 0;
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    _chunkSize?: number
  ): AsyncIterableIterator<QueryResult<R>> {
    // HTTP connections don't support true streaming
    // Return all results in a single chunk
    yield await this.executeQuery<R>(compiledQuery);
  }
}