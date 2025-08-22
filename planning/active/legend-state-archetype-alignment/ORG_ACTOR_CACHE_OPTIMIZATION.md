# Organization Actor Cache System - Evaluation & Optimization Plan

## Current State Analysis

### Architecture Overview
The Organization Actor cache system provides a **hybrid security model** combining:
- **PostgreSQL RLS**: Organization-level data isolation (database-level)
- **SQLite Cache (Durable Objects)**: Zero-latency role/permission checks
- **85-90% performance improvement** over pure RLS approach

### Key Components

#### 1. Organization Actor Cache Service
- **Location**: `apps/server/src/lib/organization-actor-cache.ts`
- **Features**:
  - Permission caching with TTL (5 min default)
  - Schema caching for instant lookups
  - Role caching with bulk operations
  - Cache statistics and efficiency metrics
  - Automatic PostgreSQL fallback on cache miss

#### 2. Hybrid RLS Middleware
- **Location**: `apps/server/src/middleware/hybrid-rls-org-actor.ts`
- **Features**:
  - Simplified PostgreSQL RLS (org-level only)
  - Zero-latency role checks via SQLite
  - Multiple org ID extraction methods
  - Role hierarchy support

### Current Performance Metrics
```
Cache Hit Rates (observed):
- Permission checks: ~75-80%
- Schema lookups: ~90-95%
- Role checks: ~85-90%

Latency Comparison:
- PostgreSQL RLS: 15-25ms
- SQLite Cache Hit: <1ms
- Cache Miss + PostgreSQL: 20-30ms
```

## Integration Gaps with Legend State

### 1. Real-time Cache Invalidation
**Issue**: Cache doesn't automatically invalidate when permissions change
**Impact**: Up to 5-minute delay in permission updates
**Solution**: WebSocket-triggered cache invalidation

### 2. Client-Side Permission Awareness
**Issue**: Legend State doesn't know about permission changes
**Impact**: UI may show stale permission states
**Solution**: Push permission updates to client via WebSocket

### 3. Schema Evolution Coordination
**Issue**: Schema cache not synchronized with dynamic entity creation
**Impact**: Cache misses on newly created entities
**Solution**: Proactive cache warming on entity creation

### 4. Field-Level Permissions
**Issue**: Current cache is entity-level, not field-level
**Impact**: Can't support granular field permissions
**Solution**: Extend cache structure for field permissions

## Optimization Plan

### Phase 1: Cache Invalidation Pipeline (Week 1)

#### 1.1 WebSocket Integration
```typescript
// New: WebSocket cache invalidation service
interface CacheInvalidationMessage {
  type: 'INVALIDATE_ROLE' | 'INVALIDATE_SCHEMA' | 'INVALIDATE_PERMISSION';
  organizationId: string;
  target: {
    userId?: string;
    tableName?: string;
    resourceId?: string;
  };
}

class CacheInvalidationService {
  async handlePermissionChange(change: PermissionChange) {
    // 1. Invalidate server cache
    await orgActorCache.invalidateRole(change.organizationId, change.userId);
    
    // 2. Notify connected clients
    await websocket.broadcast({
      type: 'PERMISSION_UPDATE',
      organizationId: change.organizationId,
      userId: change.userId,
      permissions: change.newPermissions
    });
  }
}
```

#### 1.2 Client-Side Permission Store
```typescript
// Legend State permission observable
export const permissions$ = observable({
  currentUser: {
    role: null as string | null,
    permissions: [] as string[],
    lastUpdated: null as Date | null
  },
  
  // Field-level permissions
  fieldPermissions: {} as Record<string, {
    read: boolean;
    write: boolean;
  }>
});

// WebSocket listener for permission updates
window.addEventListener('vibestack:permission-update', (e) => {
  batch(() => {
    permissions$.currentUser.role.set(e.detail.role);
    permissions$.currentUser.permissions.set(e.detail.permissions);
    permissions$.currentUser.lastUpdated.set(new Date());
  });
});
```

### Phase 2: Field-Level Permission Cache (Week 1-2)

#### 2.1 Extended Cache Schema
```sql
-- SQLite schema in Durable Object
CREATE TABLE field_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT false,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  UNIQUE(user_id, organization_id, table_name, field_name)
);

CREATE INDEX idx_field_perms_lookup 
  ON field_permissions(user_id, organization_id, table_name);
```

#### 2.2 Field Permission API
```typescript
interface FieldPermissionCheck {
  userId: string;
  organizationId: string;
  tableName: string;
  fields: string[];
  operation: 'read' | 'write';
}

class EnhancedOrgActorCache {
  async checkFieldPermissions(
    params: FieldPermissionCheck
  ): Promise<Record<string, boolean>> {
    // Batch check multiple fields in one query
    const cached = await this.getFieldPermissionsFromCache(params);
    
    if (cached.allCached) {
      return cached.permissions;
    }
    
    // Fetch missing from PostgreSQL
    const missing = await this.fetchMissingFieldPermissions(
      params,
      cached.missing
    );
    
    // Cache for future
    await this.cacheFieldPermissions(params, missing);
    
    return { ...cached.permissions, ...missing };
  }
}
```

### Phase 3: Proactive Cache Warming (Week 2)

#### 3.1 Entity Creation Hook
```typescript
// Warm cache when new entity is created
async function onEntityCreated(
  orgId: string,
  entityName: string,
  schema: UnifiedEntitySchema
) {
  // 1. Cache schema immediately
  await orgActorCache.cacheSchema(
    orgId,
    entityName,
    schema.fields.map(f => ({
      columnName: f.name,
      dataType: f.type,
      isNullable: !f.required,
      constraints: f.validation?.toString()
    }))
  );
  
  // 2. Pre-cache permissions for all org members
  const members = await getOrgMembers(orgId);
  const bulkRoles = members.map(m => ({
    userId: m.userId,
    role: m.role,
    permissions: mapRoleToPermissions(m.role)
  }));
  
  await orgActorCache.bulkCacheRoles(orgId, bulkRoles);
  
  // 3. Notify clients to refresh schema
  await websocket.broadcast({
    type: 'SCHEMA_UPDATE',
    organizationId: orgId,
    entity: entityName,
    operation: 'CREATE'
  });
}
```

#### 3.2 Predictive Caching
```typescript
// Predict and pre-cache likely accessed resources
class PredictiveCacheWarmer {
  async warmCacheForUser(userId: string, orgId: string) {
    // Get user's recent activity
    const recentActivity = await getRecentActivity(userId);
    
    // Identify patterns
    const patterns = analyzeAccessPatterns(recentActivity);
    
    // Pre-cache likely accessed entities
    for (const entityName of patterns.likelyEntities) {
      await orgActorCache.getAndCacheSchema(
        orgId,
        entityName,
        () => fetchSchemaFromDB(orgId, entityName)
      );
    }
    
    // Pre-cache related permissions
    for (const resource of patterns.likelyResources) {
      await orgActorCache.cachePermission(
        orgId,
        {
          userId,
          resourceType: resource.type,
          resourceId: resource.id,
          action: 'read'
        },
        true, // Assume read permission for warming
        600000 // 10 minute TTL for predictions
      );
    }
  }
}
```

### Phase 4: Cache Analytics & Optimization (Week 2-3)

#### 4.1 Enhanced Metrics
```typescript
interface EnhancedCacheMetrics {
  // Existing
  hitRate: number;
  missRate: number;
  
  // New
  avgLatency: {
    cacheHit: number;
    cacheMiss: number;
    postgresqlFallback: number;
  };
  
  hotKeys: Array<{
    key: string;
    accessCount: number;
    lastAccessed: Date;
  }>;
  
  memoryUsage: {
    total: number;
    byCategory: {
      permissions: number;
      schemas: number;
      roles: number;
      fieldPermissions: number;
    };
  };
  
  invalidationStats: {
    totalInvalidations: number;
    byReason: Record<string, number>;
    cascadeCount: number;
  };
}
```

#### 4.2 Adaptive TTL
```typescript
// Adjust TTL based on access patterns
class AdaptiveTTLManager {
  calculateTTL(
    resourceType: string,
    accessFrequency: number,
    lastModified: Date
  ): number {
    const BASE_TTL = 5 * 60 * 1000; // 5 minutes
    
    // High frequency = longer TTL
    const frequencyMultiplier = Math.min(accessFrequency / 10, 5);
    
    // Recently modified = shorter TTL
    const ageHours = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60);
    const ageMultiplier = Math.min(ageHours / 24, 2);
    
    return BASE_TTL * frequencyMultiplier * ageMultiplier;
  }
}
```

### Phase 5: Legend State Integration (Week 3)

#### 5.1 Permission-Aware Components
```typescript
// HOC for permission-based rendering
export function withFieldPermissions<P extends object>(
  Component: React.ComponentType<P>,
  entityName: string
) {
  return observer((props: P) => {
    const fieldPerms = use$(permissions$.fieldPermissions);
    const entityPerms = fieldPerms[entityName] || {};
    
    return (
      <Component
        {...props}
        fieldPermissions={entityPerms}
        canEditField={(field: string) => entityPerms[field]?.write ?? false}
        canViewField={(field: string) => entityPerms[field]?.read ?? true}
      />
    );
  });
}
```

#### 5.2 Optimistic Permission Updates
```typescript
// Optimistically update permissions with rollback
export function useOptimisticPermission() {
  const updatePermission = async (
    field: string,
    permission: 'read' | 'write',
    value: boolean
  ) => {
    // Optimistic update
    const previous = permissions$.fieldPermissions[field].get();
    permissions$.fieldPermissions[field][permission].set(value);
    
    try {
      // Server update
      await api.updateFieldPermission(field, permission, value);
      
      // Invalidate server cache
      await api.invalidatePermissionCache(field);
      
    } catch (error) {
      // Rollback on failure
      permissions$.fieldPermissions[field].set(previous);
      throw error;
    }
  };
  
  return { updatePermission };
}
```

## Performance Targets

### Cache Efficiency Goals
- **Hit Rate**: >90% for all cache types
- **Latency**: <2ms for cache hits, <30ms for misses
- **Memory**: <100MB per organization
- **Invalidation**: <100ms propagation to all clients

### Scalability Targets
- Support 10,000+ concurrent users per organization
- Handle 100,000+ permission checks per second
- Cache 1,000+ custom fields per entity
- Maintain <5 second cache warm time

## Risk Mitigation

### 1. Cache Inconsistency
- **Risk**: Stale cache data leading to incorrect permissions
- **Mitigation**: 
  - Short TTLs (5 minutes default)
  - Real-time invalidation via WebSocket
  - Periodic cache validation
  - Audit logging for all permission checks

### 2. Memory Pressure
- **Risk**: SQLite cache growing too large
- **Mitigation**:
  - LRU eviction policy
  - Configurable max cache size
  - Automatic cleanup of expired entries
  - Memory monitoring and alerts

### 3. Cold Start Performance
- **Risk**: Poor performance after cache restart
- **Mitigation**:
  - Persistent SQLite storage
  - Background cache warming
  - Predictive pre-caching
  - Gradual traffic migration

## Implementation Priority

### High Priority (Week 1)
1. WebSocket cache invalidation
2. Client-side permission store
3. Real-time permission updates

### Medium Priority (Week 2)
1. Field-level permissions
2. Proactive cache warming
3. Enhanced metrics

### Low Priority (Week 3)
1. Predictive caching
2. Adaptive TTL
3. Advanced analytics

## Success Metrics

### Technical Metrics
- Cache hit rate >90%
- P99 latency <10ms
- Zero permission-related security incidents
- <1% cache inconsistency rate

### Business Metrics
- 50% reduction in database load
- 75% improvement in UI responsiveness
- 90% reduction in permission-related support tickets
- Seamless experience for 100+ custom fields

## Conclusion

The Organization Actor cache system is already providing significant performance benefits with its hybrid RLS approach. The proposed optimizations will:

1. **Eliminate cache staleness** through real-time invalidation
2. **Enable field-level security** for custom fields
3. **Improve client experience** with instant permission updates
4. **Scale efficiently** to support complex schemas

These enhancements will create a seamless, high-performance security layer that perfectly complements the Legend State reactive architecture and Universal Archetype flexibility.