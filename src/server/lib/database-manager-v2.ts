/**
 * Ultra-Minimal Database Manager for Cloudflare Workers
 *
 * Uses PgBouncer for connection pooling (infrastructure level)
 * Zero application-level connection management needed
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Env } from '../types/env';

// Worker-scoped singleton - PgBouncer handles ALL pooling
let cachedDB: ReturnType<typeof drizzle> | null = null;

/**
 * Get database connection - ultra lightweight with PgBouncer pooling
 * PgBouncer handles connection pooling, we just provide connection string
 */
export function getDB(env: Env) {
  if (!cachedDB) {
    const connectionString = env.ENVIRONMENT === 'local' || env.ENVIRONMENT === 'development'
      ? 'postgres://postgres:postgres@localhost:6432/postgres'  // PgBouncer (maps to elevra_dev)
      : env.HYPERDRIVE_DB?.connectionString || env.DATABASE_URL;   // Hyperdrive in production

    console.log('🚀 Creating Drizzle DB connection via PgBouncer');

    // Use postgres.js with Workers-compatible settings
    const sql = postgres(connectionString, {
      max: 1,              // Single connection - PgBouncer handles pooling
      idle_timeout: 20,    // Quick cleanup
      connect_timeout: 10, // Fast connects
      prepare: false       // Disable prepared statements for Workers
    });

    cachedDB = drizzle(sql);  // Zero setup time - PgBouncer handles pooling
  }
  return cachedDB;
}

/**
 * Initialize database manager - minimal setup
 */
export function initDB(env: Env): void {
  console.log('🔧 Ultra-minimal DB manager initialized (PgBouncer handles pooling)');
}

/**
 * Legacy compatibility - just calls getDB
 */
export function createDatabaseConnection(env: Env) {
  return getDB(env);
}

/**
 * No cleanup needed - PgBouncer manages connections
 */
export async function cleanupDatabaseConnection(): Promise<void> {
  console.log('✅ No cleanup needed - PgBouncer handles connection lifecycle');
}

/**
 * Compatibility adapter for existing withKysely pattern
 * Allows DataForge to use Drizzle transparently
 */
export async function withDrizzle<T>(env: Env, fn: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const db = getDB(env);
  return await fn(db);
}