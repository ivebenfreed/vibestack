import { Kysely } from 'kysely';
import postgres from 'postgres';
import { PostgresJSDialectPatched } from './kysely-postgres-js-patch';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';

// TODO: Replace with server-only schema when DataForge is moved
type Database = any;

/**
 * Cloudflare Workers Database Connection
 * 
 * Following postgres.js documentation for Workers:
 * - Create fresh connection per request (no sharing across requests)  
 * - Workers handle connection lifecycle automatically
 * - Use Hyperdrive when available for connection pooling
 */

// Store env for creating connections on-demand
let workerEnv: Env | null = null;

/**
 * Initialize database manager with environment
 * Call once at worker startup
 */
export function initializeDatabaseManager(env: Env): void {
  workerEnv = env;
  console.log('🔧 Database manager initialized');
}

/**
 * Create fresh postgres.js connection for each request
 * Following Cloudflare Workers best practices
 */
function createPostgresConnection(): ReturnType<typeof postgres> {
  if (!workerEnv) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager(env) first.');
  }

  // Determine connection string
  const isLocal = workerEnv.ENVIRONMENT === 'local' || workerEnv.ENVIRONMENT === 'development';
  const connectionString = isLocal 
    ? workerEnv.DATABASE_URL 
    : (workerEnv.HYPERDRIVE_DB?.connectionString || workerEnv.DATABASE_URL);
  
  if (!connectionString) {
    throw new Error('No database connection available. Please provide either HYPERDRIVE_DB or DATABASE_URL');
  }

  const source = isLocal ? 'Direct (Local)' : (workerEnv.HYPERDRIVE_DB ? 'Hyperdrive' : 'Direct');
  
  // Create fresh postgres.js connection for this request
  // postgres.js handles Workers-specific optimizations automatically
  const pgClient = postgres(connectionString);
  
  console.log(`🚀 Created fresh postgres.js connection (${source})`);
  return pgClient;
}

/**
 * Execute queries using Kysely with automatic connection cleanup
 * This creates a connection, executes the queries, and immediately closes the connection
 */
export async function withKysely<T>(fn: (db: Kysely<Database>) => Promise<T>): Promise<T> {
  if (!workerEnv) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager(env) first.');
  }

  const pgClient = createPostgresConnection();
  const source = workerEnv.ENVIRONMENT === 'local' || workerEnv.ENVIRONMENT === 'development'
    ? 'Direct (Local)' 
    : (workerEnv.HYPERDRIVE_DB ? 'Hyperdrive' : 'Direct');

  const db = new Kysely<Database>({
    dialect: new PostgresJSDialectPatched(pgClient),
    log: (event) => {
      if (event.level === 'query') {
        dbLogger.debug(`Kysely ${source} Query`, {
          sql: event.query.sql,
          parameters: event.query.parameters,
          duration: event.queryDurationMillis
        }, `kysely-${source.toLowerCase()}`);
      } else if (event.level === 'error') {
        dbLogger.error(`Kysely ${source} Error`, event.error, undefined, `kysely-${source.toLowerCase()}`);
      }
    }
  });

  try {
    return await fn(db);
  } finally {
    // Always close the connection after queries complete
    try {
      await db.destroy();
    } catch (error) {
      console.warn('Connection cleanup warning:', error);
    }
  }
}

/**
 * Execute queries using postgres.js client with automatic connection cleanup
 */
export async function withPostgresClient<T>(fn: (client: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const client = createPostgresConnection();
  try {
    return await fn(client);
  } finally {
    // Always close the connection after queries complete
    try {
      await client.end();
    } catch (error) {
      console.warn('Connection cleanup warning:', error);
    }
  }
}

/**
 * Create a long-lived Kysely instance for systems that need persistent connections
 * ONLY use this for Better Auth and other systems that manage their own connection lifecycle
 * This creates a connection that MUST be manually destroyed when done
 */
export function createKyselyForPersistentUse(): Kysely<Database> {
  if (!workerEnv) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager(env) first.');
  }

  const pgClient = createPostgresConnection();
  const source = workerEnv.ENVIRONMENT === 'local' || workerEnv.ENVIRONMENT === 'development'
    ? 'Direct (Local)' 
    : (workerEnv.HYPERDRIVE_DB ? 'Hyperdrive' : 'Direct');

  console.warn('⚠️ Creating long-lived Kysely connection - ensure it gets destroyed!');

  return new Kysely<Database>({
    dialect: new PostgresJSDialectPatched(pgClient),
    log: (event) => {
      if (event.level === 'query') {
        dbLogger.debug(`Kysely ${source} Query`, {
          sql: event.query.sql,
          parameters: event.query.parameters,
          duration: event.queryDurationMillis
        }, `kysely-${source.toLowerCase()}`);
      } else if (event.level === 'error') {
        dbLogger.error(`Kysely ${source} Error`, event.error, undefined, `kysely-${source.toLowerCase()}`);
      }
    }
  });
}

/**
 * @deprecated Use withKysely() to ensure connections are properly closed
 * Temporary implementation - creates a connection that needs manual cleanup
 */
export function getKysely(): Kysely<Database> {
  console.warn('⚠️ getKysely() is deprecated and creates connection leaks! Use withKysely() instead');
  
  if (!workerEnv) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager(env) first.');
  }

  const pgClient = createPostgresConnection();
  const source = workerEnv.ENVIRONMENT === 'local' || workerEnv.ENVIRONMENT === 'development'
    ? 'Direct (Local)' 
    : (workerEnv.HYPERDRIVE_DB ? 'Hyperdrive' : 'Direct');

  const db = new Kysely<Database>({
    dialect: new PostgresJSDialectPatched(pgClient),
    log: (event) => {
      if (event.level === 'query') {
        dbLogger.debug(`Kysely ${source} Query`, {
          sql: event.query.sql,
          parameters: event.query.parameters,
          duration: event.queryDurationMillis
        }, `kysely-${source.toLowerCase()}`);
      } else if (event.level === 'error') {
        dbLogger.error(`Kysely ${source} Error`, event.error, undefined, `kysely-${source.toLowerCase()}`);
      }
    }
  });

  console.log(`⚠️ Created long-lived Kysely connection - ensure it gets destroyed!`);
  return db;
}

/**
 * @deprecated Use withPostgresClient() to ensure connections are properly closed
 * Legacy function that creates unclosed connections - DO NOT USE
 */
export function getPostgresClient(): ReturnType<typeof postgres> {
  console.error('❌ getPostgresClient() is deprecated and creates connection leaks! Use withPostgresClient() instead');
  throw new Error('getPostgresClient() is disabled to prevent connection leaks. Use withPostgresClient() instead.');
}

/**
 * Execute raw SQL query with fresh connection
 * Connection is automatically closed after query completes
 */
export async function executeSQL<T = any>(query: string, params: any[] = []): Promise<T[]> {
  const client = createPostgresConnection();
  try {
    const result = await client.unsafe(query, params);
    return result as T[];
  } catch (error) {
    console.error('SQL query error:', error);
    throw error;
  } finally {
    // Close connection after query completes
    await client.end();
  }
}

// New safe exports that ensure connections are closed
export const db = withKysely;
export const pgClient = withPostgresClient; 
export const sql = executeSQL;

// Legacy compatibility - create database connection (now just initializes manager)
export function createDatabaseConnection(env: Env): void {
  initializeDatabaseManager(env);
}

// Legacy cleanup function (no-op since we don't share connections)
export function cleanupDatabaseConnection(): void {
  // No-op: postgres.js connections clean up automatically in Workers
}