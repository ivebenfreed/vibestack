import { CompiledQuery, DatabaseConnection, QueryResult } from 'kysely';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import type { NeonHTTPDialectConfig } from '../types';

/**
 * Enhanced Neon HTTP connection that extracts more metadata from query results
 * Automatically routes DDL operations to direct endpoint and queries to pooler
 */
export class NeonHTTPConnection implements DatabaseConnection {
  private sqlPooler: NeonQueryFunction<false, true>; // For queries (pooler endpoint)
  private sqlDirect: NeonQueryFunction<false, true>; // For DDL (direct endpoint)  
  private config: NeonHTTPDialectConfig;
  private queryCount = 0;
  private poolerEndpoint: string;
  private directEndpoint: string;

  constructor(config: NeonHTTPDialectConfig) {
    this.config = config;
    
    // Set up both pooler and direct endpoints
    const { pooler, direct } = this.setupEndpoints(config.connectionString);
    this.poolerEndpoint = pooler;
    this.directEndpoint = direct;
    
    // Create query functions for both endpoints
    this.sqlPooler = neon(this.cleanConnectionString(pooler), { fullResults: true });
    this.sqlDirect = neon(this.cleanConnectionString(direct), { fullResults: true });
  }

  private setupEndpoints(connectionString: string): { pooler: string; direct: string } {
    // For local connections, use the same endpoint for both
    if (this.isLocalConnection(connectionString)) {
      return { pooler: connectionString, direct: connectionString };
    }

    // Auto-routing disabled, use provided endpoint for both
    if (this.config.autoRouting === false) {
      return { pooler: connectionString, direct: connectionString };
    }

    // Parse the connection string
    const url = new URL(connectionString.replace(/^postgres(ql)?:/, 'https:'));
    const hostname = url.hostname;

    // Detect if this is a pooler endpoint
    if (hostname.includes('-pooler')) {
      // Convert pooler to direct by removing '-pooler'
      const directHostname = hostname.replace('-pooler', '');
      const directUrl = new URL(url.toString());
      directUrl.hostname = directHostname;
      return {
        pooler: connectionString,
        direct: directUrl.toString().replace(/^https:/, 'postgresql:'),
      };
    } else {
      // Convert direct to pooler by adding '-pooler' before the region
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        // Format: ep-name-hash.region.aws.neon.tech
        // Insert -pooler after the hash part
        const [endpointPart, ...rest] = parts;
        const poolerHostname = `${endpointPart}-pooler.${rest.join('.')}`;
        const poolerUrl = new URL(url.toString());
        poolerUrl.hostname = poolerHostname;
        return {
          pooler: poolerUrl.toString().replace(/^https:/, 'postgresql:'),
          direct: connectionString,
        };
      }
    }

    // Fallback: use same endpoint for both
    return { pooler: connectionString, direct: connectionString };
  }

  private isLocalConnection(connectionString: string): boolean {
    return connectionString.includes('db.localtest.me') ||
           connectionString.includes('localhost') ||
           connectionString.includes('127.0.0.1');
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
    
    // Determine if this is a DDL operation
    const isDDL = this.isDDLQuery(queryText);
    const endpoint = isDDL ? 'direct' : 'pooler';
    const sql = isDDL ? this.sqlDirect : this.sqlPooler;
    
    if (this.config.debug) {
      console.log(`[NeonHTTP Query #${queryId}]`, {
        query: queryText.substring(0, 100),
        paramCount: parameters?.length || 0,
        endpoint,
      });
    }

    const startTime = Date.now();
    
    try {
      // Use full results mode to get more metadata
      // Use sql.query for parameterized queries (v1.0+ API)
      const result = await sql.query(queryText, parameters as any[]);
      
      const duration = Date.now() - startTime;
      
      if (this.config.debug) {
        console.log(`[NeonHTTP Query #${queryId}] Completed in ${duration}ms`, {
          command: result.command,
          rowCount: result.rowCount,
          fields: result.fields?.length,
        });
      }

      // Extract proper metadata from full results
      const queryResult: QueryResult<R> = {
        rows: result.rows as R[],
        numAffectedRows: this.extractAffectedRows(result),
      };

      // Add insertId for INSERT queries with serial/identity columns
      const insertId = this.extractInsertId(result);
      if (insertId !== undefined) {
        queryResult.insertId = insertId;
      }

      // PostgreSQL doesn't distinguish between affected and changed rows
      // Only MySQL has this distinction
      if (queryResult.numAffectedRows !== undefined) {
        queryResult.numChangedRows = queryResult.numAffectedRows;
      }

      return queryResult;
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
        // Attach original error as cause
        if ('cause' in enhancedError) {
          (enhancedError as any).cause = error;
        }
        throw enhancedError;
      }
      
      throw error;
    }
  }

  private extractAffectedRows(result: any): bigint | undefined {
    // For SELECT queries, don't set numAffectedRows
    if (result.command === 'SELECT') {
      return undefined;
    }

    // For INSERT, UPDATE, DELETE, MERGE - use rowCount
    if (result.command && ['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(result.command)) {
      return BigInt(result.rowCount || 0);
    }

    // If we have rows from a RETURNING clause, count them
    if (result.rows && result.rows.length > 0) {
      return BigInt(result.rows.length);
    }

    return undefined;
  }

  private extractInsertId(result: any): bigint | undefined {
    // PostgreSQL doesn't have lastInsertId like MySQL
    // But if it's an INSERT with RETURNING id, we can extract it
    if (result.command === 'INSERT' && result.rows?.length === 1) {
      const row = result.rows[0];
      // Check for common id field names
      if (row.id !== undefined && typeof row.id === 'number') {
        return BigInt(row.id);
      }
    }
    return undefined;
  }

  private isDDLQuery(query: string): boolean {
    // Normalize query for checking
    const normalizedQuery = query.trim().toUpperCase();
    
    // DDL operations that should use direct connection
    const ddlPatterns = [
      'CREATE ',
      'ALTER ',
      'DROP ',
      'TRUNCATE ',
      'RENAME ',
      'COMMENT ',
      'GRANT ',
      'REVOKE ',
      'ANALYZE ',
      'VACUUM ',
      'REINDEX ',
      'CLUSTER ',
      'REFRESH MATERIALIZED VIEW',
      'CREATE OR REPLACE',
      'SET ',
      'RESET ',
      'SHOW ',
      'COPY ',
    ];
    
    return ddlPatterns.some(pattern => normalizedQuery.startsWith(pattern));
  }

  async *streamQuery<R>(
    compiledQuery: CompiledQuery,
    chunkSize?: number
  ): AsyncIterableIterator<QueryResult<R>> {
    // HTTP connections don't support true streaming
    // But we can simulate chunking for large result sets
    const fullResult = await this.executeQuery<R>(compiledQuery);
    
    if (chunkSize && fullResult.rows.length > chunkSize) {
      // Split results into chunks
      const rows = fullResult.rows;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        yield {
          rows: chunk,
          // Only include metadata in first chunk
          ...(i === 0 ? {
            numAffectedRows: fullResult.numAffectedRows,
            numChangedRows: fullResult.numChangedRows,
            insertId: fullResult.insertId,
          } : {})
        };
      }
    } else {
      // Return all results in a single chunk
      yield fullResult;
    }
  }
}