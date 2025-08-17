# Universal Archetype Multi-Org Integration Plan

## Critical Gap Analysis

**Problem**: The Universal Archetype system (8 archetypes) is currently implemented as standalone patterns but lacks integration with the existing Phase 5 multi-org DataForge architecture that provides:

- ✅ **Multi-tenant organization isolation** (OrgSchemaDO)
- ✅ **User authentication & session management** (Better Auth + org membership)
- ✅ **EntityManager with CRUD operations** 
- ✅ **Debounced migration system** (30-second batching)
- ✅ **Access control system** (ContainerPermission + RBAC)
- ✅ **Real-time sync** (SyncDO + ReplicationDO)

**Current State**: Archetypes exist as TypeScript classes with field definitions but don't connect to the working multi-org infrastructure.

## Integration Strategy

### Phase 1: Multi-Org Schema Integration (Week 1)

#### 1.1 OrgSchemaDO Integration
**Goal**: Connect archetypes to organization-specific schema management

```typescript
// In OrgSchemaDO
async handleUniversalArchetype(request: {
  orgId: string;
  archetype: string; // 'project', 'task', etc.
  tableName: string;
  fieldDefinitions: Record<string, FieldDefinition>;
}) {
  // Get archetype pattern class
  const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
  
  // Generate DDL using archetype + custom fields
  const ddl = ArchetypeClass.generateCustomDDL(tableName, fieldDefinitions);
  
  // Use existing debounced migration system
  await this.enqueueMigration(ddl);
}
```

**Files to modify**:
- `src/dataforge/durable-objects/OrgSchemaDO.ts`
- `src/dataforge/entities/foundation/archetypes/*.ts` (add generateCustomDDL methods)

#### 1.2 Archetype-EntityManager Bridge
**Goal**: Enable EntityManager to work with archetype-based entities

```typescript
// New: ArchetypeEntityManager
export class ArchetypeEntityManager extends EntityManager {
  async createArchetypeEntity(
    orgId: string,
    archetype: string,
    tableName: string,
    data: Record<string, any>
  ) {
    // Validate using archetype pattern
    const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
    const validation = ArchetypeClass.validateEntityData(data);
    
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Use existing EntityManager infrastructure
    return await this.create(tableName, data, { orgId });
  }
}
```

**Files to create/modify**:
- `src/dataforge/services/ArchetypeEntityManager.ts` (new)
- Extend existing `EntityManager.ts` with archetype support

### Phase 2: Authentication & Authorization Integration (Week 2)

#### 2.1 Auth Middleware Integration
**Goal**: Ensure archetype operations require valid organization membership

```typescript
// Enhanced archetype routes with auth
app.post('/api/archetype/:archetype/:tableName', 
  authMiddleware,              // ✅ Already working
  orgMembershipMiddleware,     // ✅ Already working  
  async (c) => {
    const { user, activeOrganizationId } = c.get('auth');
    const { archetype, tableName } = c.req.param();
    
    // Use ArchetypeEntityManager with org isolation
    const manager = new ArchetypeEntityManager(c.env, activeOrganizationId);
    return await manager.createArchetypeEntity(
      activeOrganizationId,
      archetype,
      tableName,
      await c.req.json()
    );
  }
);
```

#### 2.2 Container Permission Integration
**Goal**: Apply RBAC to archetype-based entities

```typescript
// In ArchetypeEntityManager
async createArchetypeEntity(orgId: string, archetype: string, tableName: string, data: any) {
  // Check container permissions
  const hasPermission = await this.checkContainerPermission(
    this.userId,
    'entity',        // container_type
    tableName,       // container_id
    'create'         // action
  );
  
  if (!hasPermission) {
    throw new Error('Insufficient permissions');
  }
  
  // Proceed with creation...
}
```

### Phase 3: Migration System Integration (Week 3)

#### 3.1 Debounced Migration Support
**Goal**: Use existing 30-second batching for archetype schema changes

```typescript
// In universal-archetype-api.ts
app.post('/api/archetype/:archetype/schema', async (c) => {
  const { archetype } = c.req.param();
  const { tableName, fieldDefinitions } = await c.req.json();
  const { activeOrganizationId } = c.get('auth');
  
  // Get OrgSchemaDO instance
  const orgSchemaId = c.env.ORG_SCHEMA.idFromName(activeOrganizationId);
  const orgSchema = c.env.ORG_SCHEMA.get(orgSchemaId);
  
  // Use existing debounced migration system
  await orgSchema.fetch(new Request('http://localhost/migrate', {
    method: 'POST',
    body: JSON.stringify({
      type: 'universal_archetype',
      archetype,
      tableName,
      fieldDefinitions
    })
  }));
  
  return c.json({ success: true, message: 'Schema update queued' });
});
```

#### 3.2 Schema Evolution Support
**Goal**: Handle archetype field changes over time

```typescript
// In ArchetypeClass
static generateMigrationDDL(
  tableName: string,
  currentFields: Record<string, FieldDefinition>,
  newFields: Record<string, FieldDefinition>
): string[] {
  const migrations: string[] = [];
  
  // Add new columns
  for (const [fieldName, fieldDef] of Object.entries(newFields)) {
    if (!currentFields[fieldName]) {
      migrations.push(`ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${fieldDef.sqlType}`);
    }
  }
  
  return migrations;
}
```

### Phase 4: Real-time Sync Integration (Week 4)

#### 4.1 SyncDO Integration
**Goal**: Include archetype entities in real-time synchronization

```typescript
// In SyncDO
async handleMessage(message: any) {
  if (message.type === 'archetype_entity_change') {
    // Use existing sync infrastructure
    await this.broadcastToClients({
      type: 'entity_update',
      archetype: message.archetype,
      tableName: message.tableName,
      entityId: message.entityId,
      data: message.data,
      operation: message.operation // 'create', 'update', 'delete'
    });
  }
}
```

#### 4.2 ReplicationDO Integration  
**Goal**: Include archetype entities in cross-region replication

```typescript
// In ReplicationDO
async replicateArchetypeEntity(change: {
  orgId: string;
  archetype: string;
  tableName: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data?: any;
}) {
  // Use existing replication infrastructure
  await this.replicateChange({
    table: tableName,
    id: change.entityId,
    operation: change.operation,
    data: change.data,
    metadata: {
      archetype: change.archetype,
      orgId: change.orgId
    }
  });
}
```

## Implementation Timeline

### Week 1: Foundation Integration
- **Day 1-2**: OrgSchemaDO archetype support
- **Day 3-4**: ArchetypeEntityManager creation
- **Day 5**: Basic CRUD operations with org isolation

### Week 2: Auth & Permissions
- **Day 1-2**: Auth middleware integration
- **Day 3-4**: Container permission integration
- **Day 5**: Role-based access control testing

### Week 3: Migration System
- **Day 1-2**: Debounced migration integration
- **Day 3-4**: Schema evolution support
- **Day 5**: Migration testing and validation

### Week 4: Real-time Features
- **Day 1-2**: SyncDO integration
- **Day 3-4**: ReplicationDO integration
- **Day 5**: End-to-end testing and optimization

## Success Criteria

### ✅ **Multi-Org Isolation**
```bash
# Test: User A (Org 1) cannot see User B's (Org 2) archetype entities
curl -H "Cookie: session=user_a_token" /api/archetype/project/my_projects
# Should only return Org 1 projects
```

### ✅ **Authentication Required**
```bash
# Test: Unauthenticated requests are rejected
curl /api/archetype/task/my_tasks
# Should return 401 Unauthorized
```

### ✅ **Permission Enforcement**
```bash
# Test: Users without 'create' permission cannot create entities
curl -X POST -H "Cookie: session=limited_user" /api/archetype/project/my_projects
# Should return 403 Forbidden
```

### ✅ **Schema Evolution**
```bash
# Test: Adding new fields to existing archetype entities
curl -X POST /api/archetype/project/schema -d '{"fieldDefinitions": {"new_field": {"type": "text"}}}'
# Should queue migration and update schema
```

### ✅ **Real-time Sync**
```bash
# Test: Changes appear in other browser tabs instantly
# User creates project in Tab 1 -> Tab 2 receives update via WebSocket
```

## Risk Mitigation

### **Risk 1**: Breaking existing DataForge functionality
**Mitigation**: Incremental integration with feature flags, comprehensive testing

### **Risk 2**: Performance impact from additional abstraction layers
**Mitigation**: Benchmark before/after, optimize hot paths, use caching

### **Risk 3**: Complex debugging across multiple systems
**Mitigation**: Enhanced logging, request tracing, development tools

### **Risk 4**: Data consistency across org boundaries
**Mitigation**: Strict validation, transaction boundaries, rollback mechanisms

## Files to Create/Modify

### New Files
- `src/dataforge/services/ArchetypeEntityManager.ts`
- `src/dataforge/middleware/archetype-auth.ts`
- `src/dataforge/services/ArchetypePermissionService.ts`
- `src/routes/universal-archetype-api-v2.ts` (integrated version)

### Modified Files
- `src/dataforge/durable-objects/OrgSchemaDO.ts`
- `src/dataforge/durable-objects/SyncDO.ts`
- `src/dataforge/durable-objects/ReplicationDO.ts`
- `src/dataforge/entities/foundation/archetypes/*.ts`
- `src/api/index.ts` (route mounting)

### Test Files
- `src/dataforge/test-multi-org-archetype-integration.test.ts`
- `src/dataforge/test-archetype-auth.test.ts`
- `src/dataforge/test-archetype-permissions.test.ts`
- `src/dataforge/test-archetype-migrations.test.ts`
- `src/dataforge/test-archetype-sync.test.ts`

## Conclusion

This integration plan bridges the gap between the standalone Universal Archetype system and the working Phase 5 multi-org DataForge architecture. By following this plan, we'll have:

1. **Archetype entities that respect organization boundaries**
2. **Authentication and authorization for all archetype operations**
3. **Automatic schema management through the existing migration system**
4. **Real-time synchronization of archetype entity changes**
5. **Full RBAC support for fine-grained permissions**

The result will be a unified system where users can create custom entity types (using archetypes) within the secure, multi-tenant environment we've already built and tested.