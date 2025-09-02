/**
 * Database Initialization Middleware for Cloudflare Workers
 * 
 * Initializes database connection ONCE per Worker request using Hyperdrive.
 * This middleware must run before any code that uses database connections.
 * 
 * Follows Cloudflare Workers + Hyperdrive best practices:
 * - Single connection per request execution  
 * - Uses env.HYPERDRIVE_DB.connectionString for production
 * - Falls back to env.DATABASE_URL for local development
 * - No connection pooling (Workers handles lifecycle)
 */

import type { Context, Next } from 'hono';
import { createDatabaseConnection } from '../lib/database-manager';
import type { AppContext } from '../types/hono';

/**
 * Database initialization middleware - call this FIRST in middleware chain
 * 
 * Usage in Hono app:
 * ```typescript
 * import { databaseInit } from './middleware/database-init';
 * 
 * app.use('*', databaseInit);  // Initialize DB for all routes
 * app.use('/api/*', databaseInit);  // Initialize DB for API routes only
 * ```
 */
export async function databaseInit(c: AppContext, next: Next) {
  const startTime = Date.now();
  
  try {
    // Initialize database connection once per request
    console.log('🚀 [Database Middleware] Initializing connection for request:', c.req.method, c.req.url);
    
    createDatabaseConnection(c.env);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Database Middleware] Connection initialized in ${duration}ms`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Database Middleware] Connection failed in ${duration}ms:`, error);
    
    // Return 503 Service Unavailable if database connection fails
    return c.json({
      error: 'Database connection failed',
      message: 'Service temporarily unavailable',
      details: error instanceof Error ? error.message : 'Unknown database error'
    }, 503);
  }
  
  // Continue to next middleware/route handler
  await next();
}

/**
 * Database initialization for specific route groups
 * Only initializes DB for routes that need it
 */
export const databaseInitForAPI = databaseInit;
export const databaseInitForAuth = databaseInit;
export const databaseInitForSync = databaseInit;

/**
 * Conditional database initialization 
 * Only initializes if not already initialized (for middleware composition)
 */
export async function conditionalDatabaseInit(c: AppContext, next: Next) {
  try {
    // Try to get existing connection without creating new one
    const { getKysely } = await import('../lib/database-manager');
    getKysely(); // This will throw if connection doesn't exist
    
    console.log('📡 [Database Middleware] Using existing connection');
    await next();
    
  } catch (error) {
    // Connection doesn't exist, initialize it
    console.log('🆕 [Database Middleware] No existing connection, initializing...');
    await databaseInit(c, next);
  }
}

export default databaseInit;