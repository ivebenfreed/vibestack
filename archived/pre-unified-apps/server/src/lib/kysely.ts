import { Kysely } from 'kysely';
import postgres from 'postgres';
import { PostgresJSDialect } from 'kysely-postgres-js';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger.ts';
import { PostgresJSDialectPatched } from './kysely-postgres-js-patch.ts';

// TODO: Replace with server-only schema when DataForge is moved
// import type { Database } from '@repo/dataforge/kysely-types';
type Database = any; // Temporary stub

/**
 * Get a fresh Kysely instance optimized for Cloudflare Workers
 * Always creates new instances per request (Workers pattern)
 * Uses postgres.js for both local dev and Hyperdrive connections
 * @param env - Environment variables containing database configuration
 * @returns Configured Kysely instance
 */
export function getKysely(env: Env): Kysely<Database> {
  // For local development, skip Hyperdrive completely and use DATABASE_URL directly
  // Only use Hyperdrive in production where it has a real connection string
  const isLocal = env.ENVIRONMENT === 'local' || env.ENVIRONMENT === 'development';
  const connectionString = isLocal ? env.DATABASE_URL : (env.HYPERDRIVE_DB?.connectionString || env.DATABASE_URL);
  
  if (!connectionString) {
    throw new Error('No database connection available. Please provide either HYPERDRIVE_DB or DATABASE_URL');
  }
  
  // Determine connection source for logging
  const source = isLocal ? 'Direct (Local)' : (env.HYPERDRIVE_DB ? 'Hyperdrive' : 'Direct');
  console.log(`🚀 Creating fresh Kysely instance with postgres.js (${source})...`);
  
  // Create postgres.js client with Workers-specific settings for serverless
  const sql = postgres(connectionString, {
    // Critical Workers/serverless settings
    max: 1,                    // Single connection only - no pooling in serverless
    idle_timeout: 0,           // Disable idle timeout - let Workers handle cleanup
    connect_timeout: 5,        // Reasonable connection timeout
    fetch_types: false,        // Reduce latency by not fetching column types
    prepare: false,            // Disable prepared statements - causes issues in Workers
    transform: undefined,      // Disable transforms to avoid compatibility issues
    // Disable debug in production for performance
    debug: false,
  });
  
  const kysely = new Kysely<Database>({
    dialect: new PostgresJSDialectPatched(sql),
    // Simplified logging for Workers
    log: (event) => {
      if (event.level === 'query') {
        console.log(`🔍 KYSELY QUERY (${source}):`, event.query.sql);
        console.log('📝 PARAMETERS:', event.query.parameters);
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
  
  console.log(`✅ Kysely initialized with postgres.js (${source})`);
  return kysely;
}

/**
 * Clean up a Kysely instance when done (Workers cleanup pattern)
 * Call this at the end of request processing if needed
 */
export function cleanupKysely(kysely: Kysely<Database>) {
  try {
    kysely.destroy();
  } catch (error) {
    console.warn('Error cleaning up Kysely instance:', error);
  }
}

/**
 * Type-safe database query builder
 * Use this for all database operations in the server
 * 
 * @example
 * import { db } from '@/lib/kysely';
 * 
 * // In your API route
 * const users = await db(c.env)
 *   .selectFrom('user')
 *   .selectAll()
 *   .execute();
 */
export function db(env: Env): Kysely<Database> {
  return getKysely(env);
}