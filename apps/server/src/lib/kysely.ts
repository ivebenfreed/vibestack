import { Kysely } from 'kysely';
import { NeonHTTPDialect } from 'kysely-neon-http';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

// Import the generated Kysely types
import type { Database } from '@repo/dataforge/kysely-types';

let kyselyInstance: Kysely<Database> | null = null;


/**
 * Get or create a Kysely instance with proper configuration
 * @param env - Environment variables containing DATABASE_URL
 * @returns Configured Kysely instance
 */
export function getKysely(env: Env): Kysely<Database> {
  // Return existing instance if available
  if (kyselyInstance) {
    return kyselyInstance;
  }
  
  // Create Kysely instance with auto-configuration
  // The dialect automatically detects local development from the connection string
  kyselyInstance = new Kysely<Database>({
    dialect: new NeonHTTPDialect({
      connectionString: env.DATABASE_URL,
      debug: env.LOG_LEVEL === 'debug',
      // Auto-detection handles local proxy configuration automatically
      // Override only if needed: localProxyPort, localProxyPath, autoDetect
    }),
    log: (event) => {
      if (event.level === 'query') {
        dbLogger.debug('Kysely Query', {
          sql: event.query.sql,
          parameters: event.query.parameters,
          duration: event.queryDurationMillis
        }, 'kysely');
      } else if (event.level === 'error') {
        dbLogger.error('Kysely Error', event.error, undefined, 'kysely');
      }
    }
  });
  
  return kyselyInstance;
}

/**
 * Reset the global Kysely instance (mainly for testing)
 */
export function resetKysely() {
  if (kyselyInstance) {
    kyselyInstance.destroy();
    kyselyInstance = null;
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