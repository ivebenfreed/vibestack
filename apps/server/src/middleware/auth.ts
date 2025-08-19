import { createMiddleware } from 'hono/factory';
import { getAuth, AuthType } from '../lib/auth'; // Assuming getAuth is the way to get runtime auth instance
import type { AppBindings } from '../types/hono'; // Import your AppBindings if they define Variables

// Define the middleware using createMiddleware for better typing
export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const auth = getAuth(c); // Get the configured auth instance for this request

  // Try to get the session using headers from the raw request
  // Note: Ensure your getAuth provides an instance with the 'api' property
  if (auth.api && typeof auth.api.getSession === 'function') {
    try {
      const sessionData = await auth.api.getSession({ headers: c.req.raw.headers });
      
      if (sessionData && sessionData.user) {
        // Session found, set user and session in context
        c.set('user', sessionData.user as any);
        c.set('session', sessionData.session as any);
        console.log('[Auth Middleware] ✅ User authenticated:', (sessionData.user as any)?.email || 'unknown');
      } else {
        // No session found, explicitly set to null
        c.set('user', null);
        c.set('session', null);
        
        // Define public paths that don't require authentication
        const publicPaths = [
          '/api/auth/',
          '/api/health',
          '/api/env/debug',
          '/api/db/health',
          '/api/db/kysely-test',
          '/api/db/query',
          '/api/bootstrap/',
          '/api/archetype/health',
          '/api/sync/connect/',  // WebSocket connections have custom auth logic in index.ts
          '/api/dataforge/'  // Temporarily public - should work with session auth
        ];
        
        const isPublicPath = publicPaths.some(path => c.req.path.startsWith(path));
        
        if (!isPublicPath) {
          console.log('[Auth Middleware] ❌ Blocking unauthenticated access to:', c.req.path);
          return c.json({ 
            error: 'Authentication required', 
            code: 'UNAUTHORIZED',
            message: 'You must be signed in to access this resource'
          }, 401);
        } else {
          console.log('[Auth Middleware] ✅ Allowing public access to:', c.req.path);
        }
      }
    } catch (error) {
      console.error('[Auth Middleware] Error getting session:', error);
      c.set('user', null);
      c.set('session', null);
      
      // For now, allow access on auth errors to prevent system breakage
      // In production, you might want to be more strict
      console.log('[Auth Middleware] ⚠️ Allowing access due to auth error for:', c.req.path);
    }
  } else {
    // Handle case where getSession is not available (e.g., configuration issue)
    console.error("[Auth Middleware] Could not find auth.api.getSession. Ensure getAuth provides the necessary methods.");
    c.set('user', null);
    c.set('session', null);
  }

  // Proceed to the next middleware or route handler
  await next();
});

// Alias for backward compatibility
export const requireAuth = authMiddleware; 