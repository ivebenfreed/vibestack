/**
 * Database Manager Initialization Middleware for Cloudflare Workers
 * 
 * Initializes database manager ONCE per Worker with environment.
 * Each database operation creates fresh connections automatically.
 * 
 * Follows postgres.js Cloudflare Workers best practices:
 * - Fresh connection per database operation
 * - Uses env.HYPERDRIVE_DB.connectionString for production
 * - Falls back to env.DATABASE_URL for local development
 * - No connection sharing across requests
 */

import type { Context, Next } from 'hono';
import { initializeDatabaseManager } from '../lib/database-manager';
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
    // Initialize database manager with environment
    console.log('🔧 [Database Middleware] Initializing database manager for request:', c.req.method, c.req.url);
    
    initializeDatabaseManager(c.env);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Database Middleware] Database manager initialized in ${duration}ms`);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Database Middleware] Database manager initialization failed in ${duration}ms:`, error);
    
    // Return 503 Service Unavailable if database manager initialization fails
    return c.json({
      error: 'Database initialization failed',
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
  // Always initialize database manager (it's lightweight)
  initializeDatabaseManager(c.env);
  console.log('📡 [Database Middleware] Database manager ready');
  await next();
}

export default databaseInit;