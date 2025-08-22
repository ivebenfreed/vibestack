/**
 * Request-Scoped Caching Middleware with Cross-Request Session Cache
 * 
 * Eliminates redundant database queries within the same HTTP request by caching:
 * - Authentication session data (with cross-request caching)
 * - Permission check results 
 * - Entity schema lookups
 * 
 * Request cache is cleared after each request. Session cache persists for 5 minutes.
 */

import { createMiddleware } from 'hono/factory';
import type { AppBindings } from '../types/hono';

// Request cache key types
type RequestCacheKey = 
  | `session:${string}`           // Session lookup by token
  | `user:${string}`              // User lookup by ID  
  | `permission:${string}:${string}:${string}:${string}` // userId:containerType:containerId:operation
  | `schema:${string}:${string}`; // orgId:entityName

// Request cache storage
interface RequestCache {
  get<T = any>(key: RequestCacheKey): T | undefined;
  set<T = any>(key: RequestCacheKey, value: T): void;
  has(key: RequestCacheKey): boolean;
  clear(): void;
  size(): number;
}

class MemoryRequestCache implements RequestCache {
  private cache = new Map<RequestCacheKey, any>();

  get<T = any>(key: RequestCacheKey): T | undefined {
    return this.cache.get(key);
  }

  set<T = any>(key: RequestCacheKey, value: T): void {
    this.cache.set(key, value);
  }

  has(key: RequestCacheKey): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Request caching middleware - adds cache to context
 */
export const requestCacheMiddleware = createMiddleware<AppBindings>(async (c, next) => {
  const cache = new MemoryRequestCache();
  
  // Add cache to context
  c.set('requestCache', cache);
  
  try {
    await next();
  } finally {
    // Clear cache after request completes
    const cacheSize = cache.size();
    cache.clear();
    
    // Log cache efficiency for debugging
    if (cacheSize > 0) {
      console.log(`[RequestCache] Cleared ${cacheSize} cached items after request to ${c.req.path}`);
    }
  }
});

/**
 * Utility functions for working with request cache
 */
export class RequestCacheUtils {
  
  /**
   * Get cached session data or execute fetcher and cache result
   */
  static async getCachedSession<T>(
    cache: RequestCache, 
    sessionToken: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key: RequestCacheKey = `session:${sessionToken}`;
    
    if (cache.has(key)) {
      const cached = cache.get<T>(key);
      console.log('[RequestCache] ✅ Session cache HIT:', { sessionToken: sessionToken.substring(0, 8) + '...' });
      return cached!;
    }
    
    const result = await fetcher();
    cache.set(key, result);
    console.log('[RequestCache] 💾 Session cache MISS - stored:', { sessionToken: sessionToken.substring(0, 8) + '...' });
    return result;
  }

  /**
   * Get cached user data or execute fetcher and cache result
   */
  static async getCachedUser<T>(
    cache: RequestCache,
    userId: string, 
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key: RequestCacheKey = `user:${userId}`;
    
    if (cache.has(key)) {
      const cached = cache.get<T>(key);
      console.log('[RequestCache] ✅ User cache HIT:', { userId });
      return cached!;
    }
    
    const result = await fetcher();
    cache.set(key, result);
    console.log('[RequestCache] 💾 User cache MISS - stored:', { userId });
    return result;
  }

  /**
   * Get cached permission result or execute fetcher and cache result
   */
  static async getCachedPermission<T>(
    cache: RequestCache,
    userId: string,
    containerType: string, 
    containerId: string,
    operation: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key: RequestCacheKey = `permission:${userId}:${containerType}:${containerId}:${operation}`;
    
    if (cache.has(key)) {
      const cached = cache.get<T>(key);
      console.log('[RequestCache] ✅ Permission cache HIT:', { userId, containerType, containerId, operation });
      return cached!;
    }
    
    const result = await fetcher();
    cache.set(key, result);
    console.log('[RequestCache] 💾 Permission cache MISS - stored:', { userId, containerType, containerId, operation });
    return result;
  }

  /**
   * Get cached schema data or execute fetcher and cache result
   */
  static async getCachedSchema<T>(
    cache: RequestCache,
    orgId: string,
    entityName: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key: RequestCacheKey = `schema:${orgId}:${entityName}`;
    
    if (cache.has(key)) {
      const cached = cache.get<T>(key);
      console.log('[RequestCache] ✅ Schema cache HIT:', { orgId, entityName });
      return cached!;
    }
    
    const result = await fetcher();
    cache.set(key, result);
    console.log('[RequestCache] 💾 Schema cache MISS - stored:', { orgId, entityName });
    return result;
  }
}

// ============ Cross-Request Session Cache ============

interface CachedSession {
  data: any;
  expiresAt: number;
}

// Global session cache that persists across requests (5 min TTL)
const globalSessionCache = new Map<string, CachedSession>();
let lastCleanup = 0;

/**
 * Enhanced session cache utilities with cross-request persistence
 */
export class EnhancedSessionCache {
  /**
   * Get cached session with cross-request persistence (5 min TTL)
   */
  static async getCachedSessionPersistent<T>(
    sessionToken: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const cacheKey = `session:${sessionToken}`;
    
    // Check global session cache first
    const cached = globalSessionCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      console.log('[SessionCache] ✅ Cross-request session cache HIT:', { 
        sessionToken: sessionToken.substring(0, 8) + '...',
        remainingMs: cached.expiresAt - now
      });
      return cached.data;
    }
    
    // Fetch fresh data
    const result = await fetcher();
    
    // Cache for 5 minutes across requests
    globalSessionCache.set(cacheKey, {
      data: result,
      expiresAt: now + (5 * 60 * 1000) // 5 minutes
    });
    
    console.log('[SessionCache] 💾 Cross-request session cache MISS - stored for 5min:', { 
      sessionToken: sessionToken.substring(0, 8) + '...',
      cacheSize: globalSessionCache.size
    });
    
    return result;
  }
  
  /**
   * Clear session from cross-request cache (logout, session invalidation)
   */
  static clearCachedSession(sessionToken: string): void {
    const cacheKey = `session:${sessionToken}`;
    globalSessionCache.delete(cacheKey);
    console.log('[SessionCache] 🗑️ Session cleared from cross-request cache:', { 
      sessionToken: sessionToken.substring(0, 8) + '...'
    });
  }
  
  /**
   * Get cache stats for debugging
   */
  static getCacheStats() {
    return {
      size: globalSessionCache.size,
      keys: Array.from(globalSessionCache.keys()).map(k => k.substring(0, 16) + '...')
    };
  }
}

// Export cache type for type augmentation
export type { RequestCache, RequestCacheKey };