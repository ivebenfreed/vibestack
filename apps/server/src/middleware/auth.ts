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
        
        // Only log missing session for protected routes, not public auth routes
        const publicPaths = ['/api/auth/sign-in', '/api/auth/sign-up', '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/get-session'];
        const isPublicPath = publicPaths.some(path => c.req.path.startsWith(path));
        
        if (!isPublicPath) {
          console.log('[Auth Middleware] ❌ No valid session for:', c.req.path);
        }
      }
    } catch (error) {
      console.error('[Auth Middleware] Error getting session:', error);
      c.set('user', null);
      c.set('session', null);
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