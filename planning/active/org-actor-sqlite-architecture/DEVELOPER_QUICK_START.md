# Organization Actor SQLite Architecture: Developer Quick Start

## TL;DR - What Changed

**Before:** Complex PostgreSQL RLS with 20+ queries per request (200-300ms)  
**After:** Simple PostgreSQL org filtering + SQLite cache (20-50ms, **85-90% faster**)

### Key Changes

- **PostgreSQL RLS:** Simplified to organization-level filtering only
- **Role Permissions:** Moved to Organization Actor SQLite cache (0.1ms lookups)
- **New Middleware:** `hybridRLSOrgActorMiddleware` for dual-layer security
- **Zero-Latency Checks:** `security.hasPermission()`, `security.isAdmin()`, etc.

---

## Quick Migration Guide

### 1. Update Route Patterns

```typescript
// OLD: Path without organization context
app.get('/api/entities/:id', rlsSecurityMiddleware, handler);

// NEW: Organization-scoped with hybrid security
app.get('/api/org/:orgId/entities/:id', 
  hybridRLSOrgActorMiddleware,
  requirePermission('read'),
  handler
);
```

### 2. Replace Permission Checks

```typescript
// OLD: Database queries for permission checks
const canEdit = await checkPermission(userId, 'edit', resourceId);
if (!canEdit) return forbidden();

// NEW: Zero-latency cache lookups
const security = c.get('security');
if (!security.hasPermission('edit')) {
  return c.json({ error: 'Insufficient permissions' }, 403);
}
```

### 3. Use Security Context

```typescript
// Available in all route handlers after hybrid middleware
const security = c.get('security');

// Zero-latency permission checks
security.hasRole('admin')           // Check specific role
security.hasPermission('write')     // Check permission
security.isAdmin()                  // Admin check
security.isOwner()                  // Owner check
security.organizationId             // Current org ID
security.userId                     // Current user ID
security.roleInfo                   // Full role info with permissions
```

---

## Common Patterns

### Route Protection

```typescript
import { 
  hybridRLSOrgActorMiddleware,
  requireRole,
  requirePermission,
  requireAdmin,
  requireOwner
} from '../middleware/hybrid-rls-org-actor';

// Apply hybrid security to all organization routes
app.use('/api/org/:orgId/*', hybridRLSOrgActorMiddleware);

// Role-based protection
app.get('/api/org/:orgId/admin-settings', requireAdmin, handler);
app.delete('/api/org/:orgId/dangerous-action', requireOwner, handler);

// Permission-based protection
app.post('/api/org/:orgId/users', requirePermission('invite'), handler);
app.put('/api/org/:orgId/data', requirePermission('write'), handler);

// Multiple roles
app.get('/api/org/:orgId/management', requireRole(['owner', 'admin']), handler);

// Multiple permissions
app.post('/api/org/:orgId/reports', requirePermission(['read', 'admin']), handler);
```

### Custom Permission Logic

```typescript
app.delete('/api/org/:orgId/users/:userId',
  hybridRLSOrgActorMiddleware,
  async (c, next) => {
    const security = c.get('security');
    const targetUserId = c.req.param('userId');
    
    // Custom business logic with instant checks
    const canDelete = security.isOwner() || 
                     (security.hasPermission('admin') && 
                      targetUserId !== security.userId);
    
    if (!canDelete) {
      return c.json({ error: 'Cannot delete this user' }, 403);
    }
    
    await next();
  },
  async (c) => {
    // Delete logic here
  }
);
```

### Organization ID Extraction

The middleware automatically extracts organization ID from:

1. **Path parameter:** `/api/org/:orgId/data` → `orgId`
2. **Query parameter:** `/api/data?orgId=123` → `orgId` or `organizationId`
3. **Header:** `X-Organization-Id: 123`
4. **Request body:** `{ organizationId: "123", ... }` (for POST/PUT)

---

## Database Operations

### Automatic RLS Filtering

```typescript
// Database queries automatically filtered by organization
const projects = await database
  .selectFrom('org_123_projects')  // Business table
  .selectAll()
  .execute();
// ✅ Only returns projects for current organization (via RLS)

const members = await database
  .selectFrom('organization_members')  // Core table
  .selectAll()
  .execute();
// ✅ Only returns members for current organization (via RLS)
```

### Manual Cache Operations

```typescript
// Get cache service (available in routes with hybrid middleware)
const cache = c.get('orgActorCache');

// Check permissions manually
const hasAccess = await cache.checkAndCachePermission(
  organizationId,
  { userId, resourceType: 'project', resourceId: 'proj123', action: 'edit' },
  () => fetchPermissionFromDatabase() // Fallback
);

// Get role information
const roleInfo = await cache.getAndCacheRole(
  organizationId,
  userId,
  () => fetchRoleFromDatabase() // Fallback
);

// Cache management
await cache.invalidateRole(organizationId, userId);
await cache.bulkCacheRoles(organizationId, roleArray);
```

---

## Performance Guidelines

### Cache Hit Rate Optimization

```typescript
// Warm cache for active users
async function warmUserCache(userId: string, organizationId: string) {
  const cache = createOrgActorCache(env);
  
  // Preload user role
  await cache.getAndCacheRole(organizationId, userId, fetchRoleFromDB);
  
  // Preload common permissions
  const commonPermissions = ['read', 'write', 'admin'];
  for (const permission of commonPermissions) {
    await cache.checkAndCachePermission(
      organizationId,
      { userId, resourceType: 'general', resourceId: 'org', action: permission },
      () => checkPermissionInDB()
    );
  }
}
```

### Monitor Cache Performance

```typescript
// Get cache statistics
const cache = c.get('orgActorCache');
const stats = cache.getStats();
const efficiency = cache.getCacheEfficiency();

console.log('Cache hit rates:', {
  permissions: `${(efficiency.permissionHitRate * 100).toFixed(1)}%`,
  roles: `${(efficiency.roleHitRate * 100).toFixed(1)}%`,
  schema: `${(efficiency.schemaHitRate * 100).toFixed(1)}%`
});

// Target hit rates: 95%+ for production
```

---

## Error Handling

### Common Errors and Solutions

```typescript
// Error: Organization context not found
// Solution: Ensure route includes :orgId parameter
app.get('/api/org/:orgId/data', hybridRLSOrgActorMiddleware, handler);

// Error: Security context not established  
// Solution: Use hybrid middleware before permission checks
app.use('/api/org/:orgId/*', hybridRLSOrgActorMiddleware);
app.get('/api/org/:orgId/data', requirePermission('read'), handler);

// Error: User not member of organization
// Solution: Verify user has active membership
const members = await database
  .selectFrom('organization_members')
  .select(['status'])
  .where('user_id', '=', userId)
  .where('organization_id', '=', organizationId)
  .executeTakeFirst();
```

### Graceful Fallbacks

```typescript
// The system automatically falls back to PostgreSQL when cache fails
try {
  const hasPermission = security.hasPermission('admin');
  // Use cached result
} catch (error) {
  // Fallback to direct database check
  const hasPermission = await checkPermissionInDatabase();
}
```

---

## Testing

### Unit Tests

```typescript
import { createTestContext } from '../test-utils';
import { hybridRLSOrgActorMiddleware } from '../middleware/hybrid-rls-org-actor';

describe('Hybrid Security Middleware', () => {
  it('should set security context for valid user', async () => {
    const c = createTestContext({
      user: { id: 'user123', email: 'test@example.com' },
      params: { orgId: 'org456' }
    });
    
    await hybridRLSOrgActorMiddleware(c, async () => {});
    
    const security = c.get('security');
    expect(security.organizationId).toBe('org456');
    expect(security.userId).toBe('user123');
    expect(security.hasRole).toBeDefined();
  });
});
```

### Integration Tests

```typescript
describe('API with Hybrid Security', () => {
  it('should allow admin access to admin endpoints', async () => {
    const response = await request(app)
      .get('/api/org/org123/admin-data')
      .set('Authorization', 'Bearer admin-token')
      .expect(200);
    
    expect(response.body.data).toBeDefined();
  });
  
  it('should deny non-admin access to admin endpoints', async () => {
    await request(app)
      .get('/api/org/org123/admin-data')
      .set('Authorization', 'Bearer member-token')
      .expect(403);
  });
});
```

---

## Migration Checklist

### For Existing Routes

- [ ] Update route pattern to include `:orgId` parameter
- [ ] Replace `rlsSecurityMiddleware` with `hybridRLSOrgActorMiddleware`
- [ ] Replace permission database queries with `security.hasPermission()`
- [ ] Replace role checks with `security.hasRole()` or `security.isAdmin()`
- [ ] Test cache hit rates and performance
- [ ] Update unit tests for new security context

### Example Migration

```typescript
// BEFORE
app.get('/api/projects/:id',
  rlsSecurityMiddleware,
  async (c) => {
    const user = c.get('user');
    
    // Slow database permission check
    const canAccess = await checkUserProjectAccess(user.id, projectId);
    if (!canAccess) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const project = await getProject(projectId);
    return c.json(project);
  }
);

// AFTER
app.get('/api/org/:orgId/projects/:id',
  hybridRLSOrgActorMiddleware,
  requirePermission('read'),
  async (c) => {
    const security = c.get('security');
    const projectId = c.req.param('id');
    
    // Fast database query with automatic RLS filtering
    const project = await database
      .selectFrom('projects')
      .selectAll()
      .where('id', '=', projectId)
      .executeTakeFirst();
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404);
    }
    
    return c.json(project);
  }
);
```

---

## FAQ

**Q: Do I need to update all routes at once?**  
A: No! The hybrid middleware works alongside existing middleware. Migrate routes gradually.

**Q: What happens if the Organization Actor cache fails?**  
A: The system automatically falls back to PostgreSQL for all operations. No data loss.

**Q: How do I warm the cache for better performance?**  
A: Use `bulkCacheRoles()` when users join an organization or during application startup.

**Q: Can I still use direct database queries for permissions?**  
A: Yes, but you'll miss the performance benefits. The cache is designed to be the fast path.

**Q: How do I invalidate cache when roles change?**  
A: Call `cache.invalidateRole(orgId, userId)` after updating roles in the database.

**Q: What's the performance difference?**  
A: 85-90% faster API responses, 99%+ faster permission checks, 90%+ fewer database queries.

---

## Getting Help

- **Architecture Docs:** See `TECHNICAL_ARCHITECTURE.md` for detailed implementation
- **Migration Plan:** See `COMPREHENSIVE_MIGRATION_PLAN.md` for full migration strategy
- **Type Definitions:** Check `src/middleware/hybrid-rls-org-actor.ts` for interfaces
- **Examples:** Look at existing migrated routes in `src/routes/`

---

*Quick Start Version: 1.0*  
*Last Updated: August 21, 2025*