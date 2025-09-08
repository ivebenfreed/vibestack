/// <reference path="../worker-configuration.d.ts" />

// Set up node polyfills first
// reflect-metadata no longer needed with Drizzle

// Import other dependencies
import { Hono, Context } from 'hono';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { cors } from 'hono/cors'; // Re-add hono/cors import
import api from './api';
import { serverLogger } from './middleware/logger';
import { createStructuredLogger } from './middleware/logger';
// Removed manualCorsHeaders import
import type { AppBindings } from './types/hono';
import type { Env, ExecutionContext } from './types/env';
import { SyncDO } from './sync/SyncDO';
import { ReplicationDO } from './replication/ReplicationDO';
// OrgSchemaDO functionality removed - using direct PostgreSQL queries
// SuperAdminDO removed - will handle super admin differently
// OrgOpsDO archived - sync system is now pull-based
import { getAuth, AuthType, initializeAuth } from './lib/auth';
import { serverLogger as log } from './middleware/logger';
import { authMiddleware } from './middleware/auth'; // <-- Import the new middleware
import { databaseInit } from './middleware/database-init'; // <-- Import database initialization middleware
import authRouter from './api/auth';
import polarWebhooksRouter from './api/polar-webhooks';
import debugBillingRouter from './api/debug-billing';
import registrationRouter from './api/registration';
import billingRouter from './api/billing';
import { mountProtectedRoutes } from './routes/protected-routes';
import { cloudflareSecurityStack } from './middleware/cloudflare-security';
import { organizationActorRouter } from './routes/organization-actor';

// Remove temporary auth instance

/**
 * Main API router for PUBLIC endpoints
 * Handles all HTTP routes under the /api path
 */
const apiApp = new OpenAPIHono<AppBindings>().basePath('/api');

// Add Hono's CORS middleware FIRST
apiApp.use('*', cors({
  origin: (origin, c) => {
    // For unified worker architecture, the frontend and backend run on the same port
    const isDev = c.env.ENVIRONMENT === 'development' || !c.env.ENVIRONMENT;
    console.log(`[CORS DEBUG] Environment: ${c.env.ENVIRONMENT}, checking origin: ${origin}`);
    
    // Build allowed origins based on environment
    const allowedOrigins = [];
    
    if (isDev) {
      // In development, allow common localhost ports for unified worker architecture
      allowedOrigins.push(
        'http://localhost:4000',  // Default unified worker port
        'http://localhost:5173',  // Legacy Vite dev server port
        'http://localhost:5174',  // Alternative Vite port
        'http://localhost:5175',  // Alternative Vite port
        'http://127.0.0.1:4000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
        'http://127.0.0.1:5175'
      );
    } else {
      // Production origins
      allowedOrigins.push(
        'https://dev.codevibesmatter.com',
        'https://app.codevibesmatter.com'
      );
    }
    
    if (!origin) {
      // For same-origin requests (unified worker), allow null origin
      return null;
    }
    
    if (allowedOrigins.includes(origin)) {
      return origin; // Return the exact matching origin
    } else {
      // Log and reject non-matching origins
      console.warn(`[CORS] Rejected origin: ${origin}`);
      return null; // Return null to disallow the origin instead of a default
    }
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // Allow cookies/credentials
  maxAge: 86400, // Cache preflight for 1 day
  exposeHeaders: ['Set-Cookie'], // Expose Set-Cookie header to JavaScript
}));

// Use our structured logger middleware
apiApp.use('*', createStructuredLogger());

// Add request-scoped caching middleware after logging
import { requestCacheMiddleware } from './middleware/request-cache';
apiApp.use('*', requestCacheMiddleware);

// Add Cloudflare security middleware stack after CORS and logging
cloudflareSecurityStack.forEach(middleware => {
  apiApp.use('*', middleware);
});


// Mount PUBLIC OpenAPI routes BEFORE authMiddleware (no authentication required)
import publicOpenAPIRouter from './api/public-openapi';
apiApp.route('/', publicOpenAPIRouter);


// Test postgres.js directly
apiApp.get('/db/postgres-test', async (c) => {
  try {
    const postgres = (await import('postgres')).default;
    const connectionString = c.env.DATABASE_URL;
    
    if (!connectionString) {
      return c.json({ error: 'DATABASE_URL not set' }, 500);
    }
    
    console.log('Testing postgres.js connection directly...');
    const sql = postgres(connectionString, {
      connect_timeout: 2,
      max: 1,
      debug: true
    });
    
    console.log('Running simple query...');
    const result = await sql`SELECT 1 as test`;
    console.log('Query result:', result);
    
    await sql.end();
    
    return c.json({ success: true, result });
  } catch (error) {
    console.error('Postgres.js test failed:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Test INSERT/UPDATE/DELETE with affected rows
apiApp.post('/db/test-mutations', async (c) => {
  try {
    const { createDatabaseConnection, getKysely } = await import('./lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    // Test INSERT - create a test entry
    console.log('Testing INSERT with affected rows...');
    const insertResult = await kysely
      .insertInto('organizations')
      .values({
        id: '0198f650-0000-7000-8000-000000000001',
        name: 'Test Organization',
        slug: 'test-org-' + Date.now(),
        created_at: new Date(),
        updated_at: new Date()
      })
      .executeTakeFirst();
    
    console.log('INSERT result:', insertResult);
    
    // Test UPDATE - modify the test entry
    console.log('Testing UPDATE with affected rows...');
    const updateResult = await kysely
      .updateTable('organizations')
      .set({ 
        name: 'Updated Test Organization',
        updated_at: new Date()
      })
      .where('id', '=', '0198f650-0000-7000-8000-000000000001')
      .executeTakeFirst();
      
    console.log('UPDATE result:', updateResult);
    
    // Test DELETE - remove the test entry
    console.log('Testing DELETE with affected rows...');
    const deleteResult = await kysely
      .deleteFrom('organizations')
      .where('id', '=', '0198f650-0000-7000-8000-000000000001')
      .executeTakeFirst();
      
    console.log('DELETE result:', deleteResult);
    
    // Convert BigInt values to strings for JSON serialization
    const serializeResult = (result: any) => {
      if (!result) return result;
      const serialized: any = {};
      
      // Handle all possible BigInt properties from Kysely results
      for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'bigint') {
          serialized[key] = value.toString();
        } else {
          serialized[key] = value;
        }
      }
      
      return serialized;
    };

    return c.json({ 
      success: true, 
      results: {
        insert: serializeResult(insertResult),
        update: serializeResult(updateResult),
        delete: serializeResult(deleteResult)
      }
    });
  } catch (error) {
    console.error('Mutations test failed:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Test transactions with isolation levels
apiApp.post('/db/test-transactions', async (c) => {
  try {
    const { createDatabaseConnection, getKysely } = await import('./lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    const isolationLevel = c.req.query('isolation') || 'READ COMMITTED';
    console.log(`Testing transaction with isolation level: ${isolationLevel}...`);
    
    const result = await kysely.transaction()
      .setIsolationLevel(isolationLevel as any)
      .execute(async (trx) => {
        // Create a test organization
        const org = await trx
          .insertInto('organizations')
          .values({
            id: '0198f650-0000-7000-8000-000000000002',
            name: 'Transaction Test Org',
            slug: 'tx-test-org-' + Date.now(),
            created_at: new Date(),
            updated_at: new Date()
          })
          .returningAll()
          .executeTakeFirst();
        
        // Update it in the same transaction
        const updated = await trx
          .updateTable('organizations')
          .set({ name: 'Transaction Test Org Updated' })
          .where('id', '=', '0198f650-0000-7000-8000-000000000002')
          .returningAll()
          .executeTakeFirst();
        
        // Clean up
        await trx
          .deleteFrom('organizations')
          .where('id', '=', '0198f650-0000-7000-8000-000000000002')
          .execute();
        
        return { created: org, updated };
      });
    
    return c.json({ 
      success: true, 
      isolationLevel,
      result 
    });
  } catch (error) {
    console.error('Transaction test failed:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Test streaming queries
apiApp.get('/db/test-streaming', async (c) => {
  try {
    const { createDatabaseConnection, getKysely } = await import('./lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    const chunkSize = parseInt(c.req.query('chunkSize') || '2');
    console.log(`Testing streaming query with chunk size: ${chunkSize}...`);
    
    const chunks: any[] = [];
    let totalRows = 0;
    
    // Stream users in chunks
    const query = kysely
      .selectFrom('user')
      .select(['id', 'email', 'name'])
      .limit(10);
    
    // Workers don't support streaming, go straight to fallback
    const isWorker = typeof navigator !== 'undefined' && navigator.userAgent?.includes('Cloudflare-Workers');
    
    if (isWorker || true) { // Always use fallback in Workers environment
      console.log('Workers environment detected, using fallback query...');
      const fallbackResult = await query.execute();
      
      return c.json({ 
        success: true, 
        streaming: false,
        fallbackUsed: true,
        reason: 'Streaming not supported in Cloudflare Workers environment',
        totalRows: fallbackResult.length,
        data: fallbackResult
      });
    }
    
    try {
      for await (const chunk of kysely.stream(query, chunkSize)) {
        chunks.push({
          chunkIndex: chunks.length,
          rows: chunk.rows.length,
          data: chunk.rows
        });
        totalRows += chunk.rows.length;
        console.log(`Streamed chunk ${chunks.length}: ${chunk.rows.length} rows`);
      }
      
      return c.json({ 
        success: true, 
        streaming: true,
        chunkSize,
        totalChunks: chunks.length,
        totalRows,
        chunks 
      });
    } catch (streamError) {
      console.log('Streaming failed, falling back to regular query...');
      const fallbackResult = await query.execute();
      
      return c.json({ 
        success: true, 
        streaming: false,
        fallbackUsed: true,
        reason: streamError instanceof Error ? streamError.message : 'Streaming failed',
        totalRows: fallbackResult.length,
        data: fallbackResult
      });
    }
  } catch (error) {
    console.error('Streaming test failed:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Test connection handling and performance
apiApp.get('/db/test-connections', async (c) => {
  try {
    const { createDatabaseConnection, getKysely } = await import('./lib/database-manager');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    
    const concurrent = parseInt(c.req.query('concurrent') || '3');
    console.log(`Testing ${concurrent} concurrent connections...`);
    
    const startTime = Date.now();
    
    // Run multiple queries concurrently
    const promises = Array.from({ length: concurrent }, async (_, i) => {
      const queryStart = Date.now();
      const result = await kysely
        .selectFrom('user')
        .select(['id', 'email'])
        .where('id', 'is not', null)
        .limit(1)
        .execute();
      const queryEnd = Date.now();
      
      return {
        queryIndex: i,
        duration: queryEnd - queryStart,
        resultCount: result.length,
        userId: result[0]?.id
      };
    });
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    return c.json({ 
      success: true, 
      concurrent,
      totalDuration: endTime - startTime,
      averageDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      results 
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Add Hyperdrive test endpoint for debugging
import testHyperdriveApp from './test-hyperdrive-endpoint';
apiApp.route('/', testHyperdriveApp);
apiApp.get('/env/debug', (c) => {
  // Debug endpoint to verify which environment is being used
  const dbUrl = c.env.DATABASE_URL || 'NOT SET';
  const environment = c.env.ENVIRONMENT || 'NOT SET';
  const webPort = c.env.WEB_PORT || 'NOT SET';
  const serverPort = c.env.SERVER_PORT || 'NOT SET';
  
  // Parse database URL to show which database is being used
  let dbInfo = 'unknown';
  if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    const portMatch = dbUrl.match(/:(\d+)\//);
    dbInfo = `local (port ${portMatch ? portMatch[1] : 'unknown'})`;
  } else if (dbUrl.includes('neon.tech')) {
    dbInfo = 'remote (Neon)';
  }
  
  return c.json({
    environment,
    database: dbInfo,
    databaseUrl: dbUrl.substring(0, 50) + '...',  // Show partial URL for security
    ports: {
      web: webPort,
      server: serverPort
    },
    issueNumber: c.env.ISSUE_NUMBER || 'NOT SET'
  });
});
apiApp.get('/db/health', async (c) => {
  try {
    const url = c.env.DATABASE_URL;
    if (!url) {
      return c.json({
        success: false,
        data: { healthy: false, error: 'DATABASE_URL not set' }
      }, 503);
    }
    
    const isLocal = url.includes('localtest.me');
    
    return c.json({
      success: true,
      data: {
        healthy: true,
        mode: isLocal ? 'local' : 'remote',
        proxy: isLocal ? 'http://db.localtest.me:4444/sql' : 'neon-serverless',
        message: `Database configured in ${isLocal ? 'local' : 'remote'} mode`
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      data: {
        healthy: false,
        error: error instanceof Error ? error.message : 'Configuration error'
      }
    }, 503);
  }
});

// Kysely database debug endpoint - simplified test
apiApp.get('/db/kysely-test', async (c) => {
  try {
    console.log('Starting Kysely test...');
    const { createDatabaseConnection, getKysely } = await import('./lib/database-manager');
    
    const url = c.env.DATABASE_URL;
    if (!url) {
      return c.json({
        success: false,
        error: 'DATABASE_URL not set'
      }, 503);
    }
    
    console.log('Getting Kysely instance...');
    createDatabaseConnection(c.env);
    const kysely = getKysely();
    console.log('Kysely instance created, running simple query...');
    
    // Test with simplest possible query
    const result = await kysely.selectFrom('user').select('id').limit(1).execute();
    console.log('Query completed, result:', result);
    
    return c.json({
      success: true,
      data: { message: 'Kysely works!', resultCount: result.length }
    });
  } catch (error) {
    console.error('Kysely test error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 500);
  }
});

// Mount Drizzle test router BEFORE auth middleware (unprotected for testing)
// Drizzle test route removed - using generic API instead

// Mount KV test router for testing session storage
import { testKVRouter } from './api/test-kv';
apiApp.route('/', testKVRouter);

// Mount Polar webhook endpoints BEFORE auth middleware (webhooks must be public)
apiApp.route('/', polarWebhooksRouter);

// Mount debug endpoints BEFORE auth middleware (for testing)
apiApp.route('/', debugBillingRouter);

// Mount registration routes (public - no auth required)
apiApp.route('/registration', registrationRouter);

// Mount billing routes (public - for getting products, but auth required for actions)
apiApp.route('/', billingRouter);

// Initialize database connection ONCE per request before auth and other operations
apiApp.use('*', databaseInit);

// Apply the authentication middleware to check session status on all requests
// for routes mounted AFTER this middleware.
apiApp.use('*', authMiddleware);

// Apply RLS security middleware after authentication
// DISABLED: Now using hybrid RLS+OrgActor middleware for better performance
// import { rlsSecurityMiddleware } from './middleware/rls-security';
// apiApp.use('*', rlsSecurityMiddleware);

// Mount the auth router (which will be protected by authMiddleware)
apiApp.route('/auth', authRouter);


// Mount admin routes (platform orchestration)
import { adminRouter } from './routes/admin.js';
apiApp.route('/admin', adminRouter);

// Mount organization-scoped admin routes
import { orgAdminRouter } from './routes/organization-admin.js';
apiApp.route('/org-admin', orgAdminRouter);

// Mount MCP agent routes (requires auth for now)
import { mcpRouter } from './routes/mcp';
apiApp.route('/mcp', mcpRouter);

// Mount protected routes with mandatory context validation
mountProtectedRoutes(apiApp);

// Mount Organization Actor routes (for permissions caching, not schema caching)
apiApp.route('/org-actor', organizationActorRouter);

// Mount PROTECTED OpenAPI routes AFTER authMiddleware (authentication required)
import protectedOpenAPIRouter from './api/protected-openapi';
apiApp.route('/', protectedOpenAPIRouter);

// Mount OTHER public API routes (which will also be protected by authMiddleware)
apiApp.route('/', api);

/**
 * Router for INTERNAL service-to-service communication
 */
const internalApp = new Hono<AppBindings>().basePath('/internal');

// Use logger for internal routes too
internalApp.use('*', createStructuredLogger());

/**
 * Main worker export
 * 
 * This is the entry point for all requests to the worker.
 * It handles:
 * 1. WebSocket upgrade requests for real-time sync
 * 2. Regular HTTP API requests via the Hono router
 */
const worker = {
  /**
   * Main fetch handler for the worker
   * 
   * @param request - The incoming request
   * @param env - Environment variables and bindings
   * @param ctx - Execution context
   * @returns Response to the request
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = request.headers.get('cf-request-id') || `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    // console.log(`[${requestId}] Worker fetch called for: ${request.url}`); // Removed log
    // console.log(`[${requestId}] Request method: ${request.method}`); // Removed log
    // console.log(`[${requestId}] Request headers:`, Object.fromEntries(request.headers.entries())); // Removed log
    
    const url = new URL(request.url);

    /**
     * WebSocket handling for sync
     * 
     * WebSocket connections are handled directly here (not through Hono) because:
     * 1. They need to be routed to specific Durable Object instances
     * 2. They require special response handling (101 status code)
     * 3. They use Cloudflare's WebSocket Hibernation API
     * 
     * Routes to Organization Actor instead of SyncDO for better per-org caching
     */
    if (url.pathname === '/api/sync') {
      // --- BEGIN CORS CHECK for /api/sync ---
      const origin = request.headers.get('Origin');
      console.log(`[${requestId}] [Sync CORS DEBUG] Unified worker, origin: ${origin}`);
      
      // For unified worker, everything is same-origin so we allow localhost with any port
      const isDev = env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
      const allowedOrigins = [];
      
      if (isDev) {
        // In development, allow localhost with any port (Vite handles dynamic ports)
        allowedOrigins.push(
          'http://localhost',
          'https://localhost', 
          'http://127.0.0.1',
          'https://127.0.0.1'
        );
      } else {
        // Production/staging origins
        allowedOrigins.push(
          'https://dev.codevibesmatter.com',
          'https://app.codevibesmatter.com'
        );
      }
      
      let allowedOrigin = null;

      if (origin) {
        // Check if origin matches any allowed pattern
        const isAllowed = isDev ? 
          (origin.startsWith('http://localhost') || origin.startsWith('https://localhost') || 
           origin.startsWith('http://127.0.0.1') || origin.startsWith('https://127.0.0.1')) :
          allowedOrigins.includes(origin);
           
        if (isAllowed) {
          allowedOrigin = origin;
          console.log(`[${requestId}] [Sync CORS] Allowed origin: ${origin}`);
        } else {
          console.warn(`[${requestId}] [Sync CORS] Forbidden origin: ${origin}`);
          return new Response('Forbidden', { status: 403 });
        }
      } else {
        // Origin header is missing - for same-origin requests this is normal
        console.log(`[${requestId}] [Sync CORS] Origin header missing, proceeding (same-origin).`);
      }
      // --- END CORS CHECK ---

      // --- BEGIN AUTH CHECK for /api/sync ---
      let authenticatedUser: any = null; // Declare outside try block
      
      try {
        // WebSocket operations need their own database connections (separate from HTTP middleware)
        const { createDatabaseConnection } = await import('./lib/database-manager');
        createDatabaseConnection(env);
        
        const auth = initializeAuth(env); // Initialize auth with fresh DB connection
        
        // Debug: Log all headers and cookies
        console.log(`[${requestId}] [Sync Auth DEBUG] Request headers:`, Object.fromEntries(request.headers.entries()));
        console.log(`[${requestId}] [Sync Auth DEBUG] Cookie header:`, request.headers.get('Cookie'));
        
        // Check for auth token in query parameters (for WebSocket connections)
        const authToken = url.searchParams.get('auth');
        let sessionData = null;
        
        if (authToken) {
          // Create a modified request with the auth token in the Authorization header
          console.log(`[${requestId}] [Sync Auth] Attempting to authenticate with token parameter`);
          try {
            // Create a new request with the token in the Authorization header
            const modifiedHeaders = new Headers(request.headers);
            modifiedHeaders.set('Cookie', `better-auth.session_token=${authToken}`);
            
            // Try to get session using the modified headers
            sessionData = await auth.api.getSession({ headers: modifiedHeaders });
          } catch (tokenError) {
            console.error(`[${requestId}] [Sync Auth] Token-based auth failed:`, tokenError);
          }
        }
        
        // If no token or token validation failed, fall back to cookie-based auth
        if (!sessionData && auth.api && typeof auth.api.getSession === 'function') {
          console.log(`[${requestId}] [Sync Auth] Attempting cookie-based auth`);
          sessionData = await auth.api.getSession({ headers: request.headers });
        }
        
        if (!sessionData) {
          // No valid session, reject the request before WebSocket upgrade
          console.log(`[${requestId}] [Sync Auth] No valid session found`);
          return new Response('Unauthorized: No active session found.', { status: 401 });
        }
        
        // Session is valid, proceed with WebSocket logic
        const user = sessionData.user as any;
        console.log(`[${requestId}] [Sync Auth] User ${user?.id ?? 'ID_UNKNOWN'} authenticated for sync.`);
        
        // Store user info for later use after clientId extraction
        authenticatedUser = user;
      } catch (error) {
        console.error(`[${requestId}] [Sync Auth] Error during session check:`, error);
        return new Response('Internal Server Error during authentication.', { status: 500 });
      }
      // --- END AUTH CHECK for /api/sync ---

      // Check for WebSocket upgrade request
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      // Extract client ID from query params or generate a new one
      const clientId = url.searchParams.get('clientId');
      if (!clientId) {
        return new Response('Client ID is required', { status: 400 });
      }
      
      // Store user context in KV for SyncDO to retrieve (now that we have clientId)
      // NOTE: We don't store userRole here because that comes from organization_members table,
      // not from the Better Auth user object. The SyncDO will look up the org-specific role.
      const userContext = {
        userId: authenticatedUser?.id,
        userEmail: authenticatedUser?.email,
        userName: authenticatedUser?.name,
        timestamp: Date.now()
      };
      
      try {
        await env.CLIENT_REGISTRY.put(
          `auth:${clientId}`,
          JSON.stringify(userContext),
          { expirationTtl: 300 } // 5 minutes TTL
        );
        console.log(`[${requestId}] [Sync Auth] Stored user context for client ${clientId}`);
      } catch (authStoreError) {
        console.error(`[${requestId}] [Sync Auth] Failed to store user context:`, authStoreError);
        // Continue anyway - this is not critical for WebSocket functionality
      }
      
      // Create unique SyncDO instance for this client
      // Use a consistent identifier based on clientId to ensure all messages
      // from the same client go to the same DO instance
      const id = env.SYNC.idFromName(`client:${clientId}`);
      const obj = env.SYNC.get(id);
      
      // Forward the request to the Durable Object
      const doResponse = await obj.fetch(request);

      // Add CORS headers to the DO response if origin was allowed
      if (allowedOrigin) {
        const responseWithCors = new Response(doResponse.body, doResponse);
        responseWithCors.headers.set('Access-Control-Allow-Origin', allowedOrigin);
        responseWithCors.headers.set('Access-Control-Allow-Credentials', 'true');
        // Add Vary header to indicate that the response depends on the Origin header
        responseWithCors.headers.append('Vary', 'Origin'); 
        console.log(`[${requestId}] [Sync CORS] Added CORS headers for origin: ${allowedOrigin}`);
        return responseWithCors;
      } else {
        // Return the original DO response if origin wasn't explicitly allowed (e.g., missing origin header)
        return doResponse;
      }
    }

    // --- Route to PUBLIC API router ---
    if (url.pathname.startsWith('/api/')) {
      // console.log(`[${requestId}] Routing to public API app for path: ${url.pathname}`); // Removed log
      try {
        // Hono app (apiApp) will handle the actual GET/POST for /api/auth/**
        // including setting CORS headers on the response via the .on() handler
        const response = await apiApp.fetch(request, env, ctx);
        // console.log(`[${requestId}] API response status: ${response.status}`); // Removed log
        // console.log(`[${requestId}] API response headers:`, Object.fromEntries(response.headers.entries())); // Removed log
        return response;
      } catch (error) {
        console.error(`[${requestId}] Error handling request:`, error);
        return new Response(JSON.stringify({
          ok: false,
          error: {
            type: 'InternalServerError',
            message: 'An unexpected error occurred'
          }
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }
    
    // --- Route to INTERNAL router ---
    if (url.pathname.startsWith('/internal/')) {
      // serverLogger.debug(`Routing to internal app for path: ${url.pathname}`); // Keep debug log potentially
      try {
        return await internalApp.fetch(request, env, ctx);
      } catch (error) {
        serverLogger.error('Error handling internal request', error);
        return new Response(JSON.stringify({ ok: false, error: { type: 'InternalServerError', message: 'Internal communication error' }}), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Handle static assets and SPA routing for non-API routes
    // Skip API routes - they should be handled above
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/internal/')) {
      return new Response('Not Found', { status: 404 });
    }
    
    // Handle static assets first
    try {
      if (env.ASSETS) {
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404) {
          return response;
        }
      }
    } catch (_e) {
      // If ASSETS is not available, continue to SPA fallback
    }

    // For SPA routing, serve index.html for non-API routes
    try {
      if (env.ASSETS) {
        const indexRequest = new Request(new URL('/index.html', url), request);
        return await env.ASSETS.fetch(indexRequest);
      }
    } catch (_e) {
      // Fallback for development when ASSETS is not available
    }

    // Development fallback - serve a basic HTML page that loads the Vite dev server
    return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VibeStack</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  },

  /**
   * Scheduled handler that runs on cron triggers
   * Removed replication heartbeat - ReplicationDO is now activated on-demand by client activity
   * 
   * @param event - The scheduled event
   * @param env - Environment variables and bindings
   * @param ctx - Execution context
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<Response> {
    serverLogger.info('Scheduled task triggered', {
      cron: event.cron,
      scheduledTime: new Date(event.scheduledTime).toISOString()
    });

    // ReplicationDO is now activated on-demand when clients send data
    // This allows it to hibernate naturally when no client activity occurs
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Scheduled handler active - ReplicationDO uses on-demand activation' 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  }
};

export { SyncDO, ReplicationDO };
export { OrganizationActor } from './actors/OrganizationActor';
export default worker; 