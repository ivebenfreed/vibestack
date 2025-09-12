/**
 * @deprecated Use centralized database-manager instead
 * 
 * This file is deprecated. Use the new centralized database manager:
 * import { createDatabaseConnection, db } from './database-manager';
 * 
 * The new pattern prevents connection leaks and provides unified access.
 */

import { Kysely } from 'kysely';
import type { Env } from '../types/env';
import { createDatabaseConnection, getKysely } from './database-manager';

// TODO: Replace with server-only schema when DataForge is moved
type Database = any;

/**
 * @deprecated Use database-manager.createDatabaseConnection() and database-manager.db() instead
 * 
 * Legacy function - migrating to centralized database manager to prevent connection leaks
 */
export function getKyselyLegacy(env: Env): Kysely<Database> {
  console.warn('⚠️ getKysely() is deprecated. Use createDatabaseConnection() and db() from database-manager');
  
  // For backward compatibility, create connection if not exists and return Kysely
  try {
    return getKysely();
  } catch (error) {
    // Connection not initialized, initialize it
    createDatabaseConnection(env);
    return getKysely();
  }
}

/**
 * @deprecated Use cleanupDatabaseConnection() from database-manager instead
 */
export function cleanupKysely(kysely: Kysely<Database>) {
  console.warn('⚠️ cleanupKysely() is deprecated. Use cleanupDatabaseConnection() from database-manager');
  try {
    kysely.destroy();
  } catch (error) {
    console.warn('Error cleaning up Kysely instance:', error);
  }
}

/**
 * @deprecated Use createDatabaseConnection() and db() from database-manager instead
 * 
 * Legacy function - creates new connections which can leak.
 * New pattern: 
 * import { createDatabaseConnection, db } from './database-manager';
 * createDatabaseConnection(env); // Once per Worker
 * const kysely = db(); // Reuse connection
 */
export function db(env: Env): Kysely<Database> {
  console.warn('⚠️ db(env) is deprecated. Use createDatabaseConnection() once, then db() from database-manager');
  return getKyselyLegacy(env);
}