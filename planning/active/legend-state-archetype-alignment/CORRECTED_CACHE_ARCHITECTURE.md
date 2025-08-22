# Corrected Organization Actor Cache Architecture

## Actual Cache Invalidation Flow

### Current Working Architecture

```
┌─────────────────┐
│   PostgreSQL    │
│   Database      │
│  (Source of     │
│   Truth)        │
└────────┬────────┘
         │
         │ WAL Events
         │ (Write-Ahead Log)
         ▼
┌─────────────────┐
│  Durable Object │
│  (Org Actor)    │
│                 │
│  SQLite Cache   │
│  Auto-updates   │
│  from WAL       │
└────────┬────────┘
         │
         │ Cache already fresh!
         │
         ▼
┌─────────────────┐      WebSocket       ┌─────────────────┐
│  Server API     │──────Notification────▶│  Legend State   │
│                 │      (Schema/Perms    │  (Client)       │
│  Reads from     │       changed)        │                 │
│  Fresh Cache    │                       │  Updates local  │
└─────────────────┘                       │  observables    │
                                          └─────────────────┘
```

## Key Insights

### 1. Cache is Already Reactive
The Durable Object cache **automatically invalidates and updates** when PostgreSQL changes occur through:
- WAL event monitoring
- Database triggers
- Replication events

**No manual invalidation needed from server API!**

### 2. WebSocket Role Clarification
WebSocket is ONLY for:
- **Client notification** - Tell Legend State about changes
- **Schema updates** - Notify about new entities/fields
- **Permission changes** - Update client-side permission state
- **NOT for cache invalidation** - Cache already handles this via WAL

### 3. Schema Change Flow

```typescript
// CORRECT FLOW:

// 1. Schema change happens (new entity/field)
await createNewEntity(orgId, entityDef);
// ↓ PostgreSQL updated

// 2. WAL event triggers Durable Object update
// [AUTOMATIC - Durable Object detects change via WAL]
// Cache updates with new schema

// 3. Server notifies clients via WebSocket
await websocket.broadcast({
  type: 'SCHEMA_UPDATE',
  organizationId: orgId,
  tables: ['new_entity'],
  operation: 'CREATE'
});

// 4. Legend State reacts to WebSocket
window.addEventListener('vibestack:table-change-notification', (e) => {
  // Refresh schema in Legend State
  orgContext$.schema.set(await fetchUpdatedSchema());
  // Trigger entity store refresh
  entity$(e.detail.table).refresh();
});
```

## Revised Optimization Focus

### 1. Enhance WAL Monitoring (Server-Side)

```typescript
// Durable Object already does this, but we can optimize:
class OrganizationActor extends DurableObject {
  private walSubscription: WalSubscription;
  
  async initialize() {
    // Subscribe to specific tables for this org
    this.walSubscription = await subscribeToWAL({
      tables: [
        'organization_members',  // Role changes
        'permissions',           // Permission changes
        'custom_field_definitions', // Schema changes
        `org_${this.orgId}_*`   // Org-specific tables
      ],
      onChange: this.handleWalChange.bind(this)
    });
  }
  
  async handleWalChange(change: WalChange) {
    // Cache updates automatically based on change type
    switch(change.table) {
      case 'organization_members':
        await this.invalidateRoleCache(change.record.user_id);
        break;
      case 'permissions':
        await this.invalidatePermissionCache(change.record);
        break;
      case 'custom_field_definitions':
        await this.invalidateSchemaCache(change.record.entity_name);
        break;
    }
    
    // Queue notification for clients
    await this.queueClientNotification(change);
  }
}
```

### 2. Optimize Client Notification Path

```typescript
// Server API - After any change that affects schema/permissions
class EntityManager {
  async createEntity(orgId: string, entityDef: any) {
    // 1. Create in PostgreSQL
    const result = await db.createTable(entityDef);
    
    // 2. Cache will auto-update via WAL
    // NO NEED TO MANUALLY INVALIDATE!
    
    // 3. Just notify clients
    await this.notifyClients({
      type: 'ENTITY_CREATED',
      orgId,
      entityName: entityDef.name,
      schema: entityDef.schema
    });
    
    return result;
  }
}
```

### 3. Legend State Subscription to Cache State

```typescript
// Legend State can subscribe to cache state changes
export function subscribeToOrgActorCache(orgId: string) {
  // Create EventSource or WebSocket connection to Durable Object
  const eventSource = new EventSource(
    `/api/org/${orgId}/cache-stream`
  );
  
  eventSource.addEventListener('cache-update', (e) => {
    const update = JSON.parse(e.data);
    
    // Update Legend State based on cache changes
    switch(update.type) {
      case 'SCHEMA_CHANGE':
        orgContext$.schema.set(update.schema);
        break;
      case 'PERMISSION_CHANGE':
        permissions$.currentUser.permissions.set(update.permissions);
        break;
      case 'ROLE_CHANGE':
        permissions$.currentUser.role.set(update.role);
        break;
    }
  });
  
  return eventSource;
}
```

## Real Performance Bottlenecks to Address

### 1. WAL Processing Latency
**Issue**: Time between PostgreSQL change and cache update
**Current**: ~10-50ms
**Target**: <5ms
**Solution**: 
- Use PostgreSQL NOTIFY/LISTEN for instant notifications
- Direct Durable Object subscription to specific tables

### 2. Client Notification Latency
**Issue**: Time to propagate changes to all connected clients
**Current**: ~100-200ms
**Target**: <50ms
**Solution**:
- Use Cloudflare Durable Object Alarms for batching
- WebSocket connection pooling
- Regional edge workers for notification distribution

### 3. Schema Propagation
**Issue**: Large schemas slow to transmit
**Current**: Full schema sent on every change
**Target**: Differential updates only
**Solution**:
```typescript
// Send only changed fields
interface SchemaUpdate {
  type: 'SCHEMA_DIFF';
  entityName: string;
  changes: {
    added?: FieldDefinition[];
    removed?: string[];
    modified?: Array<{
      field: string;
      changes: Partial<FieldDefinition>;
    }>;
  };
}
```

## Correct Integration Points

### 1. Durable Object ↔ PostgreSQL
- **WAL subscription** for real-time updates
- **Automatic cache invalidation** on changes
- **No manual intervention needed**

### 2. Server API ↔ Durable Object
- **Read from cache** (always fresh due to WAL)
- **Write to PostgreSQL** (cache auto-updates)
- **No manual cache invalidation**

### 3. Server API ↔ Legend State
- **WebSocket for notifications only**
- **Schema diffs for efficiency**
- **Batched updates for performance**

### 4. Legend State ↔ Durable Object
- **Could establish direct connection** for lower latency
- **Server-Sent Events** for cache state stream
- **Bypass API layer for read-only operations**

## Revised Optimization Priorities

### High Priority
1. **Optimize WAL processing** in Durable Objects
2. **Implement schema diff protocol** for client updates
3. **Direct Legend State ↔ Durable Object connection** for reads

### Medium Priority
1. **Batch client notifications** using DO Alarms
2. **Regional notification distribution** via edge workers
3. **Compression for large schema updates**

### Low Priority
1. **Cache warming strategies** (already fast enough)
2. **Predictive caching** (WAL keeps it fresh)
3. **Complex TTL strategies** (not needed with WAL)

## Key Takeaway

The Organization Actor cache is **already reactive and self-updating** through WAL monitoring. The optimization focus should be on:

1. **Reducing WAL processing latency**
2. **Optimizing client notification paths**
3. **Implementing efficient diff protocols**
4. **Possibly establishing direct client ↔ Durable Object connections**

The cache invalidation problem is already solved - we just need to optimize the notification pipeline!