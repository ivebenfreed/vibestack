import { Kysely } from 'kysely';
import postgres from 'postgres';
import { PostgresJSDialectPatched } from './kysely-postgres-js-patch';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

// TODO: Replace with server-only schema when DataForge is moved
type Database = any;

/**
 * Centralized Database Connection for Cloudflare Workers
 * 
 * Creates one postgres.js connection per Worker request, shared by both
 * Kysely ORM and raw SQL operations. No pooling - each Worker execution
 * gets a single connection that's automatically cleaned up.
 * 
 * Workers pattern: connection per request, not connection pooling
 */

let requestConnection: {
  pgClient: ReturnType<typeof postgres>;
  kyselyInstance: Kysely<Database>;
  env: Env;
} | null = null;

/**
 * Create database connection for this Worker request
 * Call once at the start of request processing
 */
export function createDatabaseConnection(env: Env): void {
  // Clean up any existing connection first
  if (requestConnection) {
    console.log('⚠️ Cleaning up existing connection before creating new one');
    cleanupDatabaseConnection();
  }

  // Determine connection string
  const isLocal = env.ENVIRONMENT === 'local' || env.ENVIRONMENT === 'development';
  const connectionString = isLocal 
    ? env.DATABASE_URL 
    : (env.HYPERDRIVE_DB?.connectionString || env.DATABASE_URL);
  
  if (!connectionString) {
    throw new Error('No database connection available. Please provide either HYPERDRIVE_DB or DATABASE_URL');
  }

  const source = isLocal ? 'Direct (Local)' : (env.HYPERDRIVE_DB ? 'Hyperdrive' : 'Direct');
  console.log(`🚀 Creating single postgres.js connection for Worker request (${source})...`);

  // Single postgres.js connection for this Worker execution - NO POOLING
  const pgClient = postgres(connectionString, {
    // Workers-specific: single connection, no pooling
    max: 1,                    // One connection only
    idle_timeout: 0,           // No idle timeout - Worker handles lifecycle
    connect_timeout: 5,        // Quick connection timeout
    fetch_types: false,        // Reduce latency
    prepare: false,            // No prepared statements
    transform: undefined,      // No transforms
    debug: false,              // No debug logging
  });

  // Create Kysely instance using the same postgres.js connection
  const kyselyInstance = new Kysely<Database>({
    dialect: new PostgresJSDialectPatched(pgClient),
    log: (event) => {
      if (event.level === 'query') {
        console.log(`🔍 KYSELY QUERY (${source}):`, event.query.sql);
        dbLogger.debug(`Kysely ${source} Query`, {
          sql: event.query.sql,
          parameters: event.query.parameters,
          duration: event.queryDurationMillis
        }, `kysely-${source.toLowerCase()}`);
      } else if (event.level === 'error') {
        console.log(`❌ KYSELY ${source.toUpperCase()} ERROR:`, event.error);
        dbLogger.error(`Kysely ${source} Error`, event.error, undefined, `kysely-${source.toLowerCase()}`);
      }
    }
  });

  // Store connection for this request
  requestConnection = { pgClient, kyselyInstance, env };
  console.log(`✅ Single database connection created for Worker request (${source})`);
}

/**
 * Get Kysely ORM instance for this request
 * Uses the single postgres.js connection
 */
export function getKysely(): Kysely<Database> {
  if (!requestConnection) {
    throw new Error('No database connection. Call createDatabaseConnection(env) first.');
  }
  return requestConnection.kyselyInstance;
}

/**
 * Get raw postgres.js client for this request
 * Same connection used by Kysely - no additional connections
 */
export function getPostgresClient(): ReturnType<typeof postgres> {
  if (!requestConnection) {
    throw new Error('No database connection. Call createDatabaseConnection(env) first.');
  }
  return requestConnection.pgClient;
}

/**
 * Execute raw SQL query using the shared postgres.js connection
 */
export async function executeSQL<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const client = getPostgresClient();
  try {
    const result = await client.unsafe(query, params);
    return result as T[];
  } catch (error) {
    console.error('SQL query error:', error);
    throw error;
  }
}

/**
 * Cleanup database connection for this Worker request
 * Workers handle this automatically, but can be called manually
 */
export function cleanupDatabaseConnection(): void {
  if (requestConnection) {
    try {
      // postgres.js connections clean up automatically in Workers
      // Just clear the reference
      requestConnection = null;
      console.log('✅ Database connection cleaned up');
    } catch (error) {
      console.error('❌ Database cleanup error:', error);
    }
  }
}

// Convenience exports that match existing patterns
export const db = getKysely;
export const pgClient = getPostgresClient; 
export const sql = executeSQL;