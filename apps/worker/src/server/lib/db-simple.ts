/**
 * Simplified Database Connection for Cloudflare Workers
 * Following postgres.js documentation pattern for Workers
 * 
 * Postgres.js has built-in support for the TCP socket API in Cloudflare Workers.
 * We can use it directly or via Hyperdrive for connection pooling and query caching.
 */

import postgres from 'postgres';
import type { Env } from '../types/env';

interface QueryResultRow {
  [column: string]: any;
}

/**
 * Create postgres.js client following Cloudflare Workers best practices
 * Uses Hyperdrive when available, falls back to direct connection
 */
export function createPostgresClient(env: Env): ReturnType<typeof postgres> {
  // Prefer Hyperdrive for connection pooling and query caching
  const connectionString = env.HYPERDRIVE_DB?.connectionString || env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('No database connection available. Please provide either HYPERDRIVE_DB or DATABASE_URL');
  }

  const source = env.HYPERDRIVE_DB?.connectionString ? 'Hyperdrive' : 'Direct';
  console.log(`🚀 Creating postgres.js client (${source})`);

  // Simple postgres.js client - no complex configuration needed
  const sql = postgres(connectionString);
  
  return sql;
}

/**
 * Execute a query with parameters
 */
export async function executeQuery<T extends QueryResultRow = QueryResultRow>(
  sql: ReturnType<typeof postgres>,
  query: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const result = await sql.unsafe(query, params);
    return result as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Execute a query and return first result or null
 */
export async function executeQuerySingle<T extends QueryResultRow = QueryResultRow>(
  sql: ReturnType<typeof postgres>,
  query: string,
  params: any[] = []
): Promise<T | null> {
  const results = await executeQuery<T>(sql, query, params);
  return results[0] || null;
}

/**
 * Health check helper
 */
export async function checkDatabaseHealth(sql: ReturnType<typeof postgres>): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    await sql`SELECT 1`;
    
    return {
      healthy: true,
      latency: Date.now() - start
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}