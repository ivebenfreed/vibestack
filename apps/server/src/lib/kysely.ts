import { Kysely, PostgresDialect } from 'kysely';
import { NeonHTTPDialect } from 'kysely-neon-http';
import { Pool as NeonPool } from '@neondatabase/serverless';
import postgres from 'postgres';
import { PostgresJSDialect } from 'kysely-postgres-js';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

// TODO: Replace with server-only schema when DataForge is moved
// import type { Database } from '@repo/dataforge/kysely-types';
type Database = any; // Temporary stub

let kyselyInstance: Kysely<Database> | null = null;

/**
 * Get or create a Kysely instance with proper configuration
 * Prioritizes Hyperdrive connection string over DATABASE_URL
 * Uses PostgresJS for local dev (fresh instances) and Hyperdrive for production
 * @param env - Environment variables containing database configuration
 * @returns Configured Kysely instance
 */
export function getKysely(env: Env): Kysely<Database> {
  // For postgres.js, create fresh instances per request to avoid Workers I/O context issues
  const isLocalDev = env.HYPERDRIVE_DB?.host?.includes('.hyperdrive.local');
  if (isLocalDev && env.DATABASE_URL) {
    // Always create fresh postgres.js instance for local development
    console.log('🚀 Creating fresh Kysely instance with postgres.js for local development...');
    
    const sql = postgres(env.LOCAL_DATABASE_URL || env.DATABASE_URL, {
      max: 5,
      idle_timeout: 0,
      connect_timeout: 10,
    });
    
    return new Kysely<Database>({
      dialect: new PostgresJSDialect({
        postgres: sql,
      }),
      log: (event) => {
        if (event.level === 'query') {
          console.log('🔍 KYSELY QUERY (postgres.js):', event.query.sql);
          console.log('📝 PARAMETERS:', event.query.parameters);
          dbLogger.debug('Kysely postgres.js Query', {
            sql: event.query.sql,
            parameters: event.query.parameters,
            duration: event.queryDurationMillis
          }, 'kysely-postgres');
        } else if (event.level === 'error') {
          console.log('❌ KYSELY POSTGRES ERROR:', event.error);
          dbLogger.error('Kysely postgres.js Error', event.error, undefined, 'kysely-postgres');
        }
      }
    });
  }

  // For production/hyperdrive, use singleton instance (safe for Workers)
  if (kyselyInstance) {
    return kyselyInstance;
  }
  
  // Priority 1: Use Hyperdrive in production, postgres.js in local development
  if (env.HYPERDRIVE_DB?.connectionString) {
    // Detect if we're in local development (hyperdrive.local domain won't resolve)
    const isLocalDev = env.HYPERDRIVE_DB.host?.includes('.hyperdrive.local');
    
    if (isLocalDev && env.DATABASE_URL) {
      // Local development: Use postgres.js with LOCAL_DATABASE_URL for direct connection
      console.log('🚀 Initializing Kysely with postgres.js for local development...');
      
      const sql = postgres(env.LOCAL_DATABASE_URL || env.DATABASE_URL, {
        max: 5,
        idle_timeout: 0,
        connect_timeout: 10,
      });
      
      kyselyInstance = new Kysely<Database>({
        dialect: new PostgresJSDialect({
          postgres: sql,
        }),
        log: (event) => {
          if (event.level === 'query') {
            console.log('🔍 KYSELY QUERY (postgres.js):', event.query.sql);
            console.log('📝 PARAMETERS:', event.query.parameters);
            dbLogger.debug('Kysely postgres.js Query', {
              sql: event.query.sql,
              parameters: event.query.parameters,
              duration: event.queryDurationMillis
            }, 'kysely-postgres');
          } else if (event.level === 'error') {
            console.log('❌ KYSELY POSTGRES ERROR:', event.error);
            dbLogger.error('Kysely postgres.js Error', event.error, undefined, 'kysely-postgres');
          }
        }
      });
      
      console.log('✅ Kysely initialized with postgres.js for local development');
    } else {
      // Production: Use Hyperdrive with @neondatabase/serverless
      console.log('🚀 Initializing Kysely with Hyperdrive (@neondatabase/serverless)...');
      
      const pool = new NeonPool({ connectionString: env.HYPERDRIVE_DB.connectionString });
      
      kyselyInstance = new Kysely<Database>({
        dialect: new PostgresDialect({
          pool: pool,
        }),
        log: (event) => {
        if (event.level === 'query') {
          console.log('🔍 KYSELY QUERY (Hyperdrive):', event.query.sql);
          console.log('📝 PARAMETERS:', event.query.parameters);
          dbLogger.debug('Kysely Hyperdrive Query', {
            sql: event.query.sql,
            parameters: event.query.parameters,
            duration: event.queryDurationMillis
          }, 'kysely-hyperdrive');
        } else if (event.level === 'error') {
          console.log('❌ KYSELY HYPERDRIVE ERROR:', event.error);
          dbLogger.error('Kysely Hyperdrive Error', event.error, undefined, 'kysely-hyperdrive');
        }
      }
    });
    
      console.log('✅ Kysely initialized with Hyperdrive via @neondatabase/serverless');
    }
  } 
  // Priority 2: Fallback to regular DATABASE_URL  
  else if (env.DATABASE_URL) {
    console.log('⚡ Initializing Kysely with Neon HTTP dialect (fallback)...');
    
    kyselyInstance = new Kysely<Database>({
      dialect: new NeonHTTPDialect({
        connectionString: env.DATABASE_URL,
        debug: env.LOG_LEVEL === 'debug',
        // Auto-detection handles local proxy configuration automatically
        // Override only if needed: localProxyPort, localProxyPath, autoDetect
      }),
      log: (event) => {
        if (event.level === 'query') {
          console.log('🔍 KYSELY QUERY (Neon):', event.query.sql);
          console.log('📝 PARAMETERS:', event.query.parameters);
          dbLogger.debug('Kysely Neon Query', {
            sql: event.query.sql,
            parameters: event.query.parameters,
            duration: event.queryDurationMillis
          }, 'kysely-neon');
        } else if (event.level === 'error') {
          console.log('❌ KYSELY NEON ERROR:', event.error);
          dbLogger.error('Kysely Neon Error', event.error, undefined, 'kysely-neon');
        }
      }
    });
    
    console.log('✅ Kysely initialized with Neon HTTP dialect');
  }
  // No database configuration available
  else {
    throw new Error('No database configuration available. Please provide either HYPERDRIVE_DB or DATABASE_URL');
  }
  
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