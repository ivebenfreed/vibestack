import { Kysely } from 'kysely';
import { NeonHTTPDialectV1 } from './kysely-neon-v1-adapter';
import { neonConfig } from '@neondatabase/serverless';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

// Import the generated Kysely types
import type { Database } from '@repo/dataforge/kysely-types';

let kyselyInstance: Kysely<Database> | null = null;

/**
 * Configure Neon for local development - must be called once before any Kysely usage
 */
export function configureNeonForEnvironment(env: Env) {
  const databaseUrl = env.DATABASE_URL;
  const isLocal = databaseUrl.includes('db.localtest.me') || 
                  env.ENVIRONMENT === "local" || 
                  env.ENVIRONMENT === "development";
  
  if (isLocal) {
    dbLogger.debug("Configuring Neon for local development", {
      databaseUrl: databaseUrl.substring(0, 50) + '...'
    }, 'kysely');
    
    // Configure the fetch endpoint for the local proxy
    neonConfig.fetchEndpoint = (host) => {
      if (host === 'db.localtest.me') {
        return 'http://db.localtest.me:4444/sql';
      }
      return `https://${host}/sql`;
    };
    neonConfig.fetchFunction = fetch;
    
    // Configure WebSocket settings (disabled in Workers)
    neonConfig.useSecureWebSocket = false;
    neonConfig.wsProxy = (host) => `${host}:4444/v1`;
    neonConfig.webSocketConstructor = undefined;
  }
}

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
  
  // Configure Neon for the environment
  configureNeonForEnvironment(env);
  
  // Get connection string and remove port 4444 for local connections
  let connectionString = env.DATABASE_URL;
  if (connectionString.includes('db.localtest.me')) {
    connectionString = connectionString.replace(':4444', '');
  }
  
  // Create Kysely instance with logging
  kyselyInstance = new Kysely<Database>({
    dialect: new NeonHTTPDialectV1({ connectionString }),
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