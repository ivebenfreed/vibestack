# MVP Security Implementation Plan

## 🎯 **OBJECTIVE**
Implement critical security measures for VibeStack MVP SaaS release, excluding database pooling (serverless architecture).

## 📋 **SCOPE**
8 critical security and reliability implementations needed before production launch.

---

## 🔐 **SECURITY IMPLEMENTATIONS**

### **1. Rate Limiting Middleware**
**Priority**: 🔥 CRITICAL  
**Timeline**: 2 days  
**Risk**: Brute force attacks on authentication

#### Implementation Plan
```typescript
// File: apps/server/src/middleware/rate-limiting.ts
import { createMiddleware } from 'hono/factory'
import type { AppBindings } from '../types/hono'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const rateLimitStore: RateLimitStore = {}

export const createRateLimit = (options: {
  windowMs: number
  maxRequests: number
  keyGenerator?: (c: any) => string
  message?: string
}) => {
  return createMiddleware<AppBindings>(async (c, next) => {
    const key = options.keyGenerator ? options.keyGenerator(c) : c.req.header('CF-Connecting-IP') || 'anonymous'
    const now = Date.now()
    const windowStart = now - options.windowMs
    
    // Clean expired entries
    if (rateLimitStore[key] && rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key]
    }
    
    // Initialize or increment
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = { count: 1, resetTime: now + options.windowMs }
    } else {
      rateLimitStore[key].count++
    }
    
    // Check limit
    if (rateLimitStore[key].count > options.maxRequests) {
      return c.json({
        error: options.message || 'Too many requests',
        retryAfter: Math.ceil((rateLimitStore[key].resetTime - now) / 1000)
      }, 429)
    }
    
    await next()
  })
}

// Specific limiters
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') || 'anonymous',
  message: 'Too many authentication attempts. Please try again later.'
})

export const apiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: (c) => {
    const user = c.get('user')
    return user ? user.id : (c.req.header('CF-Connecting-IP') || 'anonymous')
  },
  message: 'API rate limit exceeded. Please slow down.'
})
```

#### Integration Points
- `/api/auth/sign-in/*` - 5 attempts per 15 minutes
- `/api/auth/sign-up/*` - 3 attempts per hour
- `/api/*` - 100 requests per minute per user
- WebSocket connections - 10 connections per user

#### Testing Plan
- [ ] Unit tests for rate limiting logic
- [ ] Integration tests with real IP addresses
- [ ] Load testing to verify limits work under pressure
- [ ] Test rate limit reset functionality

---

### **2. CSRF Protection**
**Priority**: 🔥 CRITICAL  
**Timeline**: 1 day  
**Risk**: Cross-site request forgery attacks

#### Implementation Plan
```typescript
// File: apps/server/src/middleware/csrf.ts
import { createMiddleware } from 'hono/factory'
import { generateRandomString } from '../lib/crypto-utils'

export const csrfProtection = createMiddleware<AppBindings>(async (c, next) => {
  const method = c.req.method
  
  // Skip CSRF for safe methods and public endpoints
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    await next()
    return
  }
  
  // Skip for auth endpoints (they have their own protection)
  if (c.req.path.startsWith('/api/auth/')) {
    await next()
    return
  }
  
  // Check CSRF token
  const token = c.req.header('X-CSRF-Token') || c.req.header('CSRF-Token')
  const sessionToken = c.get('session')?.csrfToken
  
  if (!token || !sessionToken || token !== sessionToken) {
    return c.json({
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_MISMATCH'
    }, 403)
  }
  
  await next()
})

// Generate CSRF token for sessions
export const generateCSRFToken = (): string => {
  return generateRandomString(32)
}
```

#### Integration Points
- All POST/PUT/DELETE endpoints except auth
- Session creation includes CSRF token
- Frontend includes token in headers
- WebSocket upgrade requests

#### Testing Plan
- [ ] Test CSRF protection blocks unauthorized requests
- [ ] Test legitimate requests with valid tokens pass
- [ ] Test token generation and validation
- [ ] Cross-browser compatibility testing

---

### **3. Input Validation Middleware**
**Priority**: 🔥 CRITICAL  
**Timeline**: 2 days  
**Risk**: Injection attacks, data corruption

#### Implementation Plan
```typescript
// File: apps/server/src/middleware/validation.ts
import { z } from 'zod'
import { createMiddleware } from 'hono/factory'

// Request size limits
export const requestSizeLimit = createMiddleware<AppBindings>(async (c, next) => {
  const contentLength = c.req.header('content-length')
  const maxSize = 10 * 1024 * 1024 // 10MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return c.json({
      error: 'Request too large',
      maxSize: '10MB'
    }, 413)
  }
  
  await next()
})

// Schema validation middleware
export const validateSchema = (schema: z.ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return createMiddleware<AppBindings>(async (c, next) => {
    try {
      let data
      
      switch (target) {
        case 'body':
          data = await c.req.json()
          break
        case 'query':
          data = c.req.query()
          break
        case 'params':
          data = c.req.param()
          break
      }
      
      const result = schema.safeParse(data)
      
      if (!result.success) {
        return c.json({
          error: 'Validation failed',
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        }, 400)
      }
      
      // Store validated data in context
      c.set(`validated_${target}`, result.data)
      await next()
      
    } catch (error) {
      return c.json({
        error: 'Invalid request format',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 400)
    }
  })
}

// Common validation schemas
export const commonSchemas = {
  organizationId: z.string().uuid(),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
}

// File upload validation
export const validateFileUpload = createMiddleware<AppBindings>(async (c, next) => {
  const contentType = c.req.header('content-type') || ''
  
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/json'
  ]
  
  if (contentType.startsWith('multipart/form-data')) {
    // Will need additional validation for actual file content
    await next()
  } else if (allowedTypes.some(type => contentType.startsWith(type))) {
    await next()
  } else {
    return c.json({
      error: 'Unsupported file type',
      allowedTypes
    }, 415)
  }
})
```

#### Integration Points
- All API endpoints receive schema validation
- File upload endpoints have type restrictions
- Request size limits on all endpoints
- Query parameter validation

#### Testing Plan
- [ ] Test all validation schemas with valid/invalid data
- [ ] Test file upload restrictions
- [ ] Test request size limits
- [ ] Test error message format consistency

---

### **4. Security Event Logging**
**Priority**: 🔥 CRITICAL  
**Timeline**: 1 day  
**Risk**: Undetected security incidents

#### Implementation Plan
```typescript
// File: apps/server/src/middleware/security-logging.ts
import { createMiddleware } from 'hono/factory'

export interface SecurityEvent {
  type: 'failed_login' | 'rate_limit_exceeded' | 'invalid_token' | 'permission_denied' | 'suspicious_activity'
  userId?: string
  email?: string
  ip: string
  userAgent?: string
  details: Record<string, any>
  timestamp: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export class SecurityLogger {
  private events: SecurityEvent[] = []
  
  logEvent(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString()
    }
    
    this.events.push(securityEvent)
    
    // In production, send to external logging service
    console.log(`[SECURITY] ${securityEvent.severity.toUpperCase()}: ${securityEvent.type}`, securityEvent)
    
    // Alert on critical events
    if (securityEvent.severity === 'critical') {
      this.sendAlert(securityEvent)
    }
  }
  
  private async sendAlert(event: SecurityEvent) {
    // TODO: Implement alerting (email, Slack, etc.)
    console.error('🚨 CRITICAL SECURITY EVENT:', event)
  }
  
  getRecentEvents(limit = 100): SecurityEvent[] {
    return this.events.slice(-limit)
  }
  
  getEventsByType(type: SecurityEvent['type'], limit = 50): SecurityEvent[] {
    return this.events.filter(e => e.type === type).slice(-limit)
  }
}

export const securityLogger = new SecurityLogger()

// Middleware to log security events
export const securityLogging = createMiddleware<AppBindings>(async (c, next) => {
  const startTime = Date.now()
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const userAgent = c.req.header('User-Agent') || 'unknown'
  
  try {
    await next()
    
    // Log failed authentication attempts
    if (c.req.path.includes('/auth/sign-in') && c.res.status === 401) {
      const body = await c.req.json().catch(() => ({}))
      securityLogger.logEvent({
        type: 'failed_login',
        email: body.email,
        ip,
        userAgent,
        details: { endpoint: c.req.path },
        severity: 'medium'
      })
    }
    
  } catch (error) {
    // Log any unhandled errors as potential security issues
    securityLogger.logEvent({
      type: 'suspicious_activity',
      ip,
      userAgent,
      details: { 
        endpoint: c.req.path,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      severity: 'high'
    })
    throw error
  }
})
```

#### Integration Points
- Failed login attempt tracking
- Rate limit violation logging
- Permission denial tracking
- Suspicious activity detection

#### Testing Plan
- [ ] Test security event logging for various scenarios
- [ ] Test event storage and retrieval
- [ ] Test alerting for critical events
- [ ] Test log rotation and cleanup

---

## ⚡ **RELIABILITY IMPLEMENTATIONS**

### **5. Global Error Handler with Retry Logic**
**Priority**: 🔥 CRITICAL  
**Timeline**: 2 days  
**Risk**: Cascading failures, poor user experience

#### Implementation Plan
```typescript
// File: apps/server/src/middleware/error-handling.ts
export class ErrorHandler {
  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number
      baseDelay?: number
      maxDelay?: number
      exponential?: boolean
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      exponential = true
    } = options
    
    let lastError: Error | undefined
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        // Don't retry on the last attempt
        if (attempt === maxAttempts) break
        
        // Don't retry client errors (4xx)
        if (this.isClientError(lastError)) break
        
        // Calculate delay
        const delay = exponential 
          ? Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
          : baseDelay
          
        console.log(`[RETRY] Attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message)
        await this.delay(delay)
      }
    }
    
    throw lastError
  }
  
  private isClientError(error: Error): boolean {
    // Check if error is a client error that shouldn't be retried
    return error.message.includes('400') || 
           error.message.includes('401') || 
           error.message.includes('403') || 
           error.message.includes('404')
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Global error handler middleware
export const globalErrorHandler = createMiddleware<AppBindings>(async (c, next) => {
  try {
    await next()
  } catch (error) {
    console.error('[ERROR HANDLER] Unhandled error:', error)
    
    // Log error for monitoring
    securityLogger.logEvent({
      type: 'suspicious_activity',
      ip: c.req.header('CF-Connecting-IP') || 'unknown',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        endpoint: c.req.path
      },
      severity: 'high'
    })
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        return c.json({ error: 'Validation error', message: error.message }, 400)
      }
      if (error.message.includes('unauthorized')) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }
      if (error.message.includes('forbidden')) {
        return c.json({ error: 'Forbidden', message: 'Insufficient permissions' }, 403)
      }
    }
    
    // Generic server error
    return c.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    }, 500)
  }
})

export const errorHandler = new ErrorHandler()
```

#### Integration Points
- Database operations
- External API calls
- WebSocket connection handling
- File operations

#### Testing Plan
- [ ] Test retry logic with transient failures
- [ ] Test error categorization
- [ ] Test circuit breaker behavior
- [ ] Test error logging and alerting

---

### **6. Health Check Endpoints**
**Priority**: 🔥 CRITICAL  
**Timeline**: 1 day  
**Risk**: Poor operational visibility

#### Implementation Plan
```typescript
// File: apps/server/src/api/health.ts
import { Hono } from 'hono'
import type { AppBindings } from '../types/hono'

const healthApp = new Hono<AppBindings>()

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency?: number
  error?: string
  details?: Record<string, any>
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: HealthCheck[]
}

// Lightweight health check
healthApp.get('/health', async (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() })
})

// Detailed health check
healthApp.get('/health/detailed', async (c) => {
  const startTime = Date.now()
  const checks: HealthCheck[] = []
  
  // Database health check
  try {
    const dbStart = Date.now()
    // Simple query to test database
    await c.env.DB.prepare('SELECT 1').first()
    checks.push({
      name: 'database',
      status: 'healthy',
      latency: Date.now() - dbStart
    })
  } catch (error) {
    checks.push({
      name: 'database',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
  
  // Auth service health check
  try {
    const authStart = Date.now()
    // Test auth service availability
    const auth = getAuth(c)
    if (auth) {
      checks.push({
        name: 'auth',
        status: 'healthy',
        latency: Date.now() - authStart
      })
    } else {
      throw new Error('Auth service not available')
    }
  } catch (error) {
    checks.push({
      name: 'auth',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
  
  // Overall status
  const overallStatus = checks.every(c => c.status === 'healthy') 
    ? 'healthy' 
    : checks.some(c => c.status === 'unhealthy') 
    ? 'unhealthy' 
    : 'degraded'
  
  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    checks
  }
  
  const statusCode = overallStatus === 'healthy' ? 200 : 503
  return c.json(healthStatus, statusCode)
})

// Ready check for Kubernetes/load balancers
healthApp.get('/ready', async (c) => {
  // Check if service is ready to accept traffic
  try {
    await c.env.DB.prepare('SELECT 1').first()
    return c.json({ ready: true })
  } catch (error) {
    return c.json({ ready: false, error: 'Database not ready' }, 503)
  }
})

export default healthApp
```

#### Integration Points
- Load balancer health checks
- Monitoring system integration
- Kubernetes readiness/liveness probes
- Status page integration

#### Testing Plan
- [ ] Test health checks under normal conditions
- [ ] Test health checks with degraded services
- [ ] Test health check response times
- [ ] Test integration with monitoring systems

---

### **7. Sync Failure Recovery**
**Priority**: 🔥 CRITICAL  
**Timeline**: 2 days  
**Risk**: Data inconsistency, poor user experience

#### Implementation Plan
```typescript
// File: apps/server/src/sync/recovery-manager.ts
export class SyncRecoveryManager {
  private reconnectionAttempts = new Map<string, number>()
  private pendingChanges = new Map<string, any[]>()
  private maxReconnectionAttempts = 5
  private baseReconnectionDelay = 1000
  
  async handleConnectionFailure(clientId: string, organizationId: string) {
    console.log(`[SYNC RECOVERY] Connection failed for client: ${clientId}`)
    
    // Queue any pending changes
    await this.queuePendingChanges(clientId)
    
    // Attempt reconnection
    await this.scheduleReconnection(clientId, organizationId)
  }
  
  private async queuePendingChanges(clientId: string) {
    // Store pending changes in memory (in production, use Redis/database)
    if (!this.pendingChanges.has(clientId)) {
      this.pendingChanges.set(clientId, [])
    }
    
    console.log(`[SYNC RECOVERY] Queued pending changes for client: ${clientId}`)
  }
  
  private async scheduleReconnection(clientId: string, organizationId: string) {
    const attempts = this.reconnectionAttempts.get(clientId) || 0
    
    if (attempts >= this.maxReconnectionAttempts) {
      console.error(`[SYNC RECOVERY] Max reconnection attempts reached for client: ${clientId}`)
      this.cleanupClient(clientId)
      return
    }
    
    const delay = this.baseReconnectionDelay * Math.pow(2, attempts)
    this.reconnectionAttempts.set(clientId, attempts + 1)
    
    console.log(`[SYNC RECOVERY] Scheduling reconnection attempt ${attempts + 1} for client: ${clientId} in ${delay}ms`)
    
    setTimeout(async () => {
      try {
        await this.attemptReconnection(clientId, organizationId)
      } catch (error) {
        console.error(`[SYNC RECOVERY] Reconnection failed for client: ${clientId}`, error)
        await this.scheduleReconnection(clientId, organizationId)
      }
    }, delay)
  }
  
  private async attemptReconnection(clientId: string, organizationId: string) {
    // In a real implementation, this would trigger a new WebSocket connection
    console.log(`[SYNC RECOVERY] Attempting reconnection for client: ${clientId}`)
    
    // Simulate reconnection logic
    const success = Math.random() > 0.3 // 70% success rate for simulation
    
    if (success) {
      console.log(`[SYNC RECOVERY] Reconnection successful for client: ${clientId}`)
      await this.restorePendingChanges(clientId)
      this.reconnectionAttempts.delete(clientId)
    } else {
      throw new Error('Reconnection failed')
    }
  }
  
  private async restorePendingChanges(clientId: string) {
    const pendingChanges = this.pendingChanges.get(clientId) || []
    
    if (pendingChanges.length > 0) {
      console.log(`[SYNC RECOVERY] Restoring ${pendingChanges.length} pending changes for client: ${clientId}`)
      
      // Send pending changes to client
      for (const change of pendingChanges) {
        // In real implementation, send via WebSocket
        console.log(`[SYNC RECOVERY] Sending pending change:`, change)
      }
      
      this.pendingChanges.delete(clientId)
    }
  }
  
  private cleanupClient(clientId: string) {
    this.reconnectionAttempts.delete(clientId)
    this.pendingChanges.delete(clientId)
    console.log(`[SYNC RECOVERY] Cleaned up failed client: ${clientId}`)
  }
  
  // Health check for sync system
  getRecoveryStats() {
    return {
      activeRecoveries: this.reconnectionAttempts.size,
      pendingChangesQueues: this.pendingChanges.size,
      totalPendingChanges: Array.from(this.pendingChanges.values()).reduce((sum, changes) => sum + changes.length, 0)
    }
  }
}

export const syncRecoveryManager = new SyncRecoveryManager()
```

#### Integration Points
- WebSocket connection handling
- Sync message processing
- Client state management
- Health monitoring

#### Testing Plan
- [ ] Test connection failure detection
- [ ] Test reconnection logic
- [ ] Test pending change queue
- [ ] Test recovery health monitoring

---

## 📊 **IMPLEMENTATION TIMELINE**

### **Week 1: Security Foundation**
- **Day 1-2**: Rate Limiting Middleware ✅
- **Day 3**: CSRF Protection ✅
- **Day 4-5**: Input Validation Middleware ✅
- **Day 6**: Security Event Logging ✅
- **Day 7**: Integration Testing & Bug Fixes

### **Week 2: Reliability Foundation**
- **Day 8-9**: Global Error Handler with Retry Logic ✅
- **Day 10**: Health Check Endpoints ✅
- **Day 11-12**: Sync Failure Recovery ✅
- **Day 13-14**: End-to-End Testing & Performance Validation

---

## 🧪 **TESTING STRATEGY**

### **Security Testing**
- [ ] Penetration testing of rate limits
- [ ] CSRF attack simulation
- [ ] Input fuzzing and injection testing
- [ ] Security event logging validation

### **Reliability Testing**
- [ ] Chaos engineering for error handling
- [ ] Load testing with health checks
- [ ] Sync failure scenario testing
- [ ] Recovery time measurement

### **Integration Testing**
- [ ] Full security middleware stack testing
- [ ] Production-like environment validation
- [ ] Performance impact assessment
- [ ] Monitoring system integration

---

## 📈 **SUCCESS METRICS**

### **Security KPIs**
- ✅ Rate limiting active: < 5 auth attempts per 15 minutes
- ✅ CSRF protection: 100% coverage on mutation endpoints
- ✅ Input validation: 100% API endpoint coverage
- ✅ Security logging: All failed attempts tracked

### **Reliability KPIs**
- ✅ Error recovery: 95% transient failure recovery rate
- ✅ Health checks: < 500ms response time
- ✅ Sync recovery: < 30 seconds to restore connection
- ✅ System availability: 99.9% uptime target

---

## 🚀 **DEPLOYMENT STRATEGY**

### **Phase 1: Security Hardening**
1. Deploy rate limiting to staging
2. Enable CSRF protection
3. Activate input validation
4. Start security logging

### **Phase 2: Reliability Enhancement**
1. Deploy error handling middleware
2. Enable health check endpoints
3. Activate sync recovery system
4. Performance monitoring

### **Phase 3: Production Readiness**
1. Full integration testing
2. Security audit
3. Performance benchmarking
4. Go-live preparation

**This plan addresses all critical security and reliability gaps while maintaining our serverless architecture advantages.**