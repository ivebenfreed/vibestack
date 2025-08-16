import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import type { Env } from '../types/env'

// Type definitions for Cloudflare rate limiting bindings
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

// Extend environment with rate limit bindings
interface CloudflareEnv extends Env {
  auth_rate_limit?: RateLimitBinding
  api_rate_limit?: RateLimitBinding
  signup_rate_limit?: RateLimitBinding
}

// Type for Hono context with Cloudflare bindings
type CloudflareContext = Context<{ Bindings: CloudflareEnv }>

// Fallback in-memory rate limiting for local development
interface RateLimitEntry {
  count: number
  resetTime: number
}

class LocalRateLimiter {
  private store = new Map<string, RateLimitEntry>()
  
  async limit(key: string, limit: number, windowMs: number): Promise<{ success: boolean }> {
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Clean expired entries
    const entry = this.store.get(key)
    if (entry && entry.resetTime < now) {
      this.store.delete(key)
    }
    
    // Get or create entry
    const currentEntry = this.store.get(key)
    if (!currentEntry) {
      this.store.set(key, { count: 1, resetTime: now + windowMs })
      return { success: true }
    }
    
    // Check limit
    if (currentEntry.count >= limit) {
      return { success: false }
    }
    
    // Increment count
    currentEntry.count++
    return { success: true }
  }
}

const localRateLimiter = new LocalRateLimiter()

/**
 * Rate limiting middleware using Cloudflare's free rate limiting API
 */
export const cloudflareRateLimit = createMiddleware<{ Bindings: CloudflareEnv }>(async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'anonymous'
  const path = c.req.path
  const method = c.req.method
  
  try {
    // Auth endpoint rate limiting (5 requests per 15 minutes)
    if (path.includes('/api/auth/sign-in') || path.includes('/api/auth/sign-up')) {
      let success = true
      
      if (c.env.auth_rate_limit) {
        // Use Cloudflare rate limiting in production
        const result = await c.env.auth_rate_limit.limit({ key: ip })
        success = result.success
      } else {
        // Use local rate limiting in development
        const result = await localRateLimiter.limit(`auth:${ip}`, 5, 15 * 60 * 1000)
        success = result.success
      }
      
      if (!success) {
        console.log(`[RATE LIMIT] Auth rate limit exceeded for IP: ${ip}`)
        return c.json({
          error: 'Too many authentication attempts',
          message: 'Please try again in 15 minutes',
          retryAfter: 900
        }, 429)
      }
    }
    
    // Sign-up specific rate limiting (3 per hour)
    if (path.includes('/api/auth/sign-up') && method === 'POST') {
      let success = true
      
      if (c.env.signup_rate_limit) {
        // Use Cloudflare rate limiting in production
        const result = await c.env.signup_rate_limit.limit({ key: ip })
        success = result.success
      } else {
        // Use local rate limiting in development
        const result = await localRateLimiter.limit(`signup:${ip}`, 3, 60 * 60 * 1000)
        success = result.success
      }
      
      if (!success) {
        console.log(`[RATE LIMIT] Signup rate limit exceeded for IP: ${ip}`)
        return c.json({
          error: 'Too many signup attempts',
          message: 'Please try again in 1 hour',
          retryAfter: 3600
        }, 429)
      }
    }
    
    // General API rate limiting (100 requests per minute)
    if (path.startsWith('/api/') && !path.startsWith('/api/auth/')) {
      // Use user ID if authenticated, otherwise IP
      const user = c.get('user')
      const key = user ? `user:${user.id}` : `ip:${ip}`
      let success = true
      
      if (c.env.api_rate_limit) {
        // Use Cloudflare rate limiting in production
        const result = await c.env.api_rate_limit.limit({ key })
        success = result.success
      } else {
        // Use local rate limiting in development
        const result = await localRateLimiter.limit(`api:${key}`, 100, 60 * 1000)
        success = result.success
      }
      
      if (!success) {
        console.log(`[RATE LIMIT] API rate limit exceeded for key: ${key}`)
        return c.json({
          error: 'API rate limit exceeded',
          message: 'Please slow down your requests',
          retryAfter: 60
        }, 429)
      }
    }
    
    await next()
  } catch (error) {
    console.error('[RATE LIMIT] Error checking rate limits:', error)
    // Continue without rate limiting if there's an error
    await next()
  }
})

/**
 * Security headers middleware using Cloudflare security information
 */
export const cloudflareSecurityHeaders = createMiddleware<{ Bindings: CloudflareEnv }>(async (c, next) => {
  // Get Cloudflare security headers
  const country = c.req.header('CF-IPCountry')
  const threatScore = c.req.header('CF-Threat-Score')
  const botScore = c.req.header('CF-Bot-Score')
  const ip = c.req.header('CF-Connecting-IP')
  
  // Log security information for monitoring
  if (threatScore || botScore) {
    console.log(`[CF-SECURITY] Request from ${ip} (${country}): Threat=${threatScore}, Bot=${botScore}`)
  }
  
  // Block high threat scores (optional - be careful with false positives)
  if (threatScore && parseInt(threatScore) > 50) {
    console.warn(`[CF-SECURITY] Blocking high threat score request: ${threatScore} from ${ip}`)
    return c.json({
      error: 'Request blocked by security policy',
      message: 'Your request appears suspicious'
    }, 403)
  }
  
  // Add security headers to response
  await next()
  
  // Set security response headers
  c.res.headers.set('X-Frame-Options', 'DENY')
  c.res.headers.set('X-Content-Type-Options', 'nosniff')
  c.res.headers.set('X-XSS-Protection', '1; mode=block')
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Content Security Policy for web endpoints
  if (c.req.path.startsWith('/') && !c.req.path.startsWith('/api/')) {
    c.res.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ws: wss:; font-src 'self';"
    )
  }
})

/**
 * Geographic blocking middleware (optional for compliance)
 */
export const geoBlocking = createMiddleware<{ Bindings: CloudflareEnv }>(async (c, next) => {
  const country = c.req.header('CF-IPCountry')
  
  // Example: Block specific countries if required for compliance
  // Be very careful with this - only use if legally required
  const blockedCountries: string[] = []
  // Example: ['CN', 'RU', 'KP'] - only if legally required
  
  if (country && blockedCountries.includes(country)) {
    console.log(`[GEO-BLOCK] Blocking request from country: ${country}`)
    return c.json({
      error: 'Service not available in your region',
      message: 'This service is not available in your geographic location'
    }, 451) // 451 Unavailable For Legal Reasons
  }
  
  await next()
})

/**
 * Bot detection middleware using Cloudflare bot scores
 */
export const botProtection = createMiddleware<{ Bindings: CloudflareEnv }>(async (c, next) => {
  const botScore = c.req.header('CF-Bot-Score')
  const userAgent = c.req.header('User-Agent')
  
  // Block empty user agents (common for bots)
  if (!userAgent || userAgent.trim() === '') {
    console.log('[BOT-PROTECTION] Blocking empty user agent')
    return c.json({
      error: 'Invalid request',
      message: 'User agent is required'
    }, 400)
  }
  
  // Block very low bot scores (likely automated)
  if (botScore && parseInt(botScore) < 10) {
    console.log(`[BOT-PROTECTION] Blocking low bot score: ${botScore}`)
    return c.json({
      error: 'Automated requests not allowed',
      message: 'This endpoint does not accept automated requests'
    }, 403)
  }
  
  await next()
})

/**
 * Security logging middleware for failed requests
 */
export const securityLogging = createMiddleware<{ Bindings: CloudflareEnv }>(async (c, next) => {
  const startTime = Date.now()
  const ip = c.req.header('CF-Connecting-IP') || 'unknown'
  const userAgent = c.req.header('User-Agent') || 'unknown'
  const country = c.req.header('CF-IPCountry') || 'unknown'
  
  try {
    await next()
    
    // Log security events for specific status codes
    if (c.res.status === 401) {
      console.log(`[SECURITY-LOG] Unauthorized access attempt: ${c.req.method} ${c.req.path} from ${ip} (${country})`)
    } else if (c.res.status === 403) {
      console.log(`[SECURITY-LOG] Forbidden access attempt: ${c.req.method} ${c.req.path} from ${ip} (${country})`)
    } else if (c.res.status === 429) {
      console.log(`[SECURITY-LOG] Rate limit exceeded: ${c.req.method} ${c.req.path} from ${ip} (${country})`)
    }
  } catch (error) {
    // Log any unhandled errors as potential security issues
    console.error(`[SECURITY-LOG] Error processing request: ${c.req.method} ${c.req.path} from ${ip} (${country})`, error)
    throw error
  }
})

/**
 * Combined Cloudflare security middleware stack
 */
export const cloudflareSecurityStack = [
  securityLogging,
  cloudflareRateLimit,
  cloudflareSecurityHeaders,
  botProtection
  // geoBlocking - only enable if legally required
]

export default {
  cloudflareRateLimit,
  cloudflareSecurityHeaders,
  geoBlocking,
  botProtection,
  securityLogging,
  cloudflareSecurityStack
}